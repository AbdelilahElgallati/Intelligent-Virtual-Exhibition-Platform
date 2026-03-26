"""
backfill_slugs.py — One-time idempotent script to add URL-safe slugs to all
existing events and stands that do not yet have a `slug` field.

Run from the backend/ directory:
    python -m scripts.backfill_slugs

Requirements: MongoDB must be reachable (uses the same MONGO_URI as the app).
"""

import asyncio
import re
import sys
import os

# Allow importing from the app package
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings


def _slugify(text: str) -> str:
    """Convert any string into a URL-safe kebab-case slug (max 60 chars)."""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text)
    text = re.sub(r"-+", "-", text)
    return str(text[:60]).strip("-")


async def backfill_collection(db, collection_name: str, name_field: str) -> None:
    collection = db[collection_name]
    cursor = collection.find({"$or": [{"slug": {"$exists": False}}, {"slug": None}]})
    docs = await cursor.to_list(length=None)

    if not docs:
        print(f"  [{collection_name}] All documents already have a slug — nothing to do.")
        return

    print(f"  [{collection_name}] Backfilling {len(docs)} document(s)...")
    updated = 0
    for doc in docs:
        doc_id = doc["_id"]
        raw_name = doc.get(name_field, "")
        base_slug = _slugify(str(raw_name)) if raw_name else "item"
        short_suffix = str(doc_id)[-4:]
        slug = f"{base_slug}-{short_suffix}" if base_slug else short_suffix

        await collection.update_one({"_id": doc_id}, {"$set": {"slug": slug}})
        updated += 1

    print(f"  [{collection_name}] Done — {updated} slug(s) written.")


async def main() -> None:
    print("Connecting to MongoDB...")
    client = AsyncIOMotorClient(settings.MONGO_URI)
    db = client[settings.DATABASE_NAME]

    print("Starting slug backfill...")
    await backfill_collection(db, "events", "title")
    await backfill_collection(db, "stands", "name")
    await backfill_collection(db, "organizations", "name")
    await backfill_collection(db, "conferences", "title")

    client.close()
    print("\nBackfill complete!")


if __name__ == "__main__":
    asyncio.run(main())
