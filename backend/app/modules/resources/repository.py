from bson import ObjectId
from typing import List, Optional
from datetime import datetime
from ...db.mongo import get_database
from .schemas import ResourceCreate, ResourceSchema

class ResourceRepository:
    @property
    def db(self):
        return get_database()

    @property
    def collection(self):
        return self.db.resources

    async def create_resource(self, resource_data: ResourceCreate) -> dict:
        doc = resource_data.model_dump()
        doc["upload_date"] = datetime.utcnow()
        doc["downloads"] = 0
        result = await self.collection.insert_one(doc)
        doc["_id"] = str(result.inserted_id)
        return doc

    async def get_resources_by_stand(self, stand_id: str) -> List[dict]:
        cursor = self.collection.find({"stand_id": stand_id})
        resources = await cursor.to_list(length=100)
        for r in resources:
            r["_id"] = str(r["_id"])
        return resources

    async def increment_downloads(self, resource_id: str):
        await self.collection.update_one(
            {"_id": ObjectId(resource_id)},
            {"$inc": {"downloads": 1}}
        )

    async def get_resource(self, resource_id: str) -> Optional[dict]:
        result = await self.collection.find_one({"_id": ObjectId(resource_id)})
        if result:
            result["_id"] = str(result["_id"])
        return result

resource_repo = ResourceRepository()
