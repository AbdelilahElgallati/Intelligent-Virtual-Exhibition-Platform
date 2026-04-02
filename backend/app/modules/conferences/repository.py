"""
Conference repository — MongoDB CRUD for conferences, registrations, Q&A.
"""
from bson import ObjectId
from typing import List, Optional
from datetime import datetime, timezone
import re
import unicodedata

from app.db.mongo import get_database
from app.db.utils import stringify_object_ids, _oid_or_value


class ConferenceRepository:
    @property
    def db(self):
        return get_database()

    # ── Conferences ───────────────────────────────────────────────────────────

    def _slugify(self, text: str) -> str:
        text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
        text = re.sub(r"[^\w\s-]", "", text).strip().lower()
        return re.sub(r"[-\s]+", "-", text)

    async def create(self, doc: dict) -> dict:
        if not doc.get("slug"):
            base_slug = self._slugify(doc.get("title", "conference"))
            # Ensure uniqueness
            slug = base_slug
            counter = 1
            while await self.db.conferences.find_one({"slug": slug}):
                slug = f"{base_slug}-{counter}"
                counter += 1
            doc["slug"] = slug
            
        doc["created_at"] = datetime.now(timezone.utc)
        doc["updated_at"] = datetime.now(timezone.utc)
        doc["attendee_count"] = 0
        result = await self.db.conferences.insert_one(doc)
        doc["_id"] = str(result.inserted_id)
        return doc

    async def get_by_id(self, conf_id: str) -> Optional[dict]:
        """Resolves either ObjectId string or slug."""
        if ObjectId.is_valid(conf_id):
            doc = await self.db.conferences.find_one({"_id": ObjectId(conf_id)})
        else:
            doc = await self.db.conferences.find_one({"slug": conf_id})
        return stringify_object_ids(doc) if doc else None

    async def get_by_slug(self, slug: str) -> Optional[dict]:
        doc = await self.db.conferences.find_one({"slug": slug})
        return stringify_object_ids(doc) if doc else None

    async def resolve_conf_id(self, identifier: str) -> str:
        """Returns the internal ObjectId string for a given slug or ID."""
        if ObjectId.is_valid(identifier):
            return identifier
        doc = await self.db.conferences.find_one({"slug": identifier}, {"_id": 1})
        if doc:
            return str(doc["_id"])
        return identifier

    async def list_by_event(self, event_id: str) -> List[dict]:
        cursor = self.db.conferences.find({"event_id": event_id}).sort("start_time", 1)
        docs = await cursor.to_list(length=200)
        return stringify_object_ids(docs)

    async def list_by_enterprise(self, enterprise_id: str) -> List[dict]:
        cursor = self.db.conferences.find({"assigned_enterprise_id": enterprise_id}).sort("start_time", 1)
        docs = await cursor.to_list(length=100)
        return stringify_object_ids(docs)

    async def list_public(
        self,
        event_id: Optional[str] = None,
        status: Optional[str] = None,
        event_id_aliases: Optional[List[str]] = None,
    ) -> List[dict]:
        query: dict = {}
        if event_id or event_id_aliases:
            candidates = [str(x) for x in (event_id_aliases or []) if x]
            if event_id:
                candidates.append(str(event_id))
            # De-dupe while preserving order
            seen: set[str] = set()
            uniq: List[str] = []
            for c in candidates:
                if c and c not in seen:
                    seen.add(c)
                    uniq.append(c)
            if len(uniq) == 1:
                query["event_id"] = uniq[0]
            elif len(uniq) > 1:
                query["event_id"] = {"$in": uniq}
        if status:
            query["status"] = status
        # No default status filter — return all (scheduled, live, ended)
        cursor = self.db.conferences.find(query).sort("start_time", 1)
        docs = await cursor.to_list(length=200)
        return stringify_object_ids(docs)

    async def update(self, conf_id: str, fields: dict) -> Optional[dict]:
        fields["updated_at"] = datetime.now(timezone.utc)
        result = await self.db.conferences.find_one_and_update(
            {"_id": ObjectId(conf_id)},
            {"$set": fields},
            return_document=True
        )
        return stringify_object_ids(result) if result else None

    async def set_status(self, conf_id: str, new_status: str, extra: Optional[dict] = None) -> Optional[dict]:
        patch = {"status": new_status, "updated_at": datetime.now(timezone.utc)}
        if extra:
            patch.update(extra)
        result = await self.db.conferences.find_one_and_update(
            {"_id": ObjectId(conf_id)},
            {"$set": patch},
            return_document=True
        )
        return stringify_object_ids(result) if result else None

    async def increment_attendee_count(self, conf_id: str, delta: int = 1):
        await self.db.conferences.update_one(
            {"_id": ObjectId(conf_id)},
            {"$inc": {"attendee_count": delta}}
        )

    # ── Registrations ─────────────────────────────────────────────────────────

    async def register(self, conf_id: str, user_id: str, user_role: str) -> bool:
        """Upsert registration. Returns True if newly registered."""
        existing = await self.db.conference_registrations.find_one(
            {"conference_id": conf_id, "user_id": user_id}
        )
        if existing:
            return False
        await self.db.conference_registrations.insert_one({
            "conference_id": conf_id,
            "user_id": user_id,
            "user_role": user_role,
            "registered_at": datetime.now(timezone.utc),
            "joined_at": None,
            "left_at": None,
        })
        await self.increment_attendee_count(conf_id, 1)
        return True

    async def unregister(self, conf_id: str, user_id: str) -> bool:
        result = await self.db.conference_registrations.delete_one(
            {"conference_id": conf_id, "user_id": user_id}
        )
        if result.deleted_count:
            await self.increment_attendee_count(conf_id, -1)
            return True
        return False

    async def is_registered(self, conf_id: str, user_id: str) -> bool:
        doc = await self.db.conference_registrations.find_one(
            {"conference_id": conf_id, "user_id": user_id}
        )
        return doc is not None

    async def get_registrations(self, conf_id: str) -> List[dict]:
        cursor = self.db.conference_registrations.find({"conference_id": conf_id})
        docs = await cursor.to_list(length=1000)
        return stringify_object_ids(docs)

    # ── Q&A ───────────────────────────────────────────────────────────────────

    async def add_question(self, conf_id: str, user_id: str, user_name: str, question: str) -> dict:
        doc = {
            "conference_id": conf_id,
            "user_id": user_id,
            "user_name": user_name,
            "question": question,
            "is_answered": False,
            "answer": None,
            "upvotes": 0,
            "created_at": datetime.now(timezone.utc),
        }
        result = await self.db.conference_qa.insert_one(doc)
        doc["_id"] = str(result.inserted_id)
        return stringify_object_ids(doc)

    async def list_questions(self, conf_id: str) -> List[dict]:
        cursor = self.db.conference_qa.find({"conference_id": conf_id}).sort("upvotes", -1)
        docs = await cursor.to_list(length=200)
        return stringify_object_ids(docs)

    async def answer_question(self, qa_id: str, answer: str) -> Optional[dict]:
        if not ObjectId.is_valid(qa_id):
            return None
        result = await self.db.conference_qa.find_one_and_update(
            {"_id": ObjectId(qa_id)},
            {"$set": {"answer": answer, "is_answered": True}},
            return_document=True
        )
        return stringify_object_ids(result) if result else None

    async def upvote_question(self, qa_id: str) -> Optional[dict]:
        if not ObjectId.is_valid(qa_id):
            return None
        result = await self.db.conference_qa.find_one_and_update(
            {"_id": ObjectId(qa_id)},
            {"$inc": {"upvotes": 1}},
            return_document=True
        )
        return stringify_object_ids(result) if result else None


conf_repo = ConferenceRepository()
