from bson import ObjectId
from typing import List, Optional, Tuple
from datetime import datetime, timezone
from app.db.mongo import get_database
from app.db.utils import stringify_object_ids
from .schemas import ProductCreate, ProductUpdate, ProductStatus, ProductRequestRead

class EnterpriseRepository:
    @property
    def db(self):
        return get_database()

    @property
    def products(self):
        return self.db.products

    @property
    def product_requests(self):
        return self.db.product_requests

    # --- Product Management ---

    async def create_product(self, enterprise_id: str, organization_id: str, data: ProductCreate) -> dict:
        product_dict = data.model_dump()
        product_dict.update({
            "enterprise_id": str(enterprise_id),
            "organization_id": str(organization_id),
            "created_at": datetime.now(timezone.utc),
            "is_active": True
        })
        result = await self.products.insert_one(product_dict)
        product_dict["_id"] = result.inserted_id
        return stringify_object_ids(product_dict)

    async def get_products(self, enterprise_id: str, skip: int = 0, limit: int = 20) -> Tuple[List[dict], int]:
        query = {"enterprise_id": str(enterprise_id), "is_active": True}
        total = await self.products.count_documents(query)
        cursor = self.products.find(query).skip(skip).limit(limit).sort("created_at", -1)
        products = await cursor.to_list(length=limit)
        return stringify_object_ids(products), total

    async def get_product_by_id(self, product_id: str) -> Optional[dict]:
        doc = await self.products.find_one({"_id": ObjectId(product_id)})
        return stringify_object_ids(doc) if doc else None

    async def update_product(self, product_id: str, enterprise_id: str, data: ProductUpdate) -> Optional[dict]:
        update_data = {k: v for k, v in data.model_dump().items() if v is not None}
        if not update_data:
            return await self.get_product_by_id(product_id)
            
        from pymongo import ReturnDocument
        doc = await self.products.find_one_and_update(
            {"_id": ObjectId(product_id), "enterprise_id": str(enterprise_id)},
            {"$set": update_data},
            return_document=ReturnDocument.AFTER
        )
        return stringify_object_ids(doc) if doc else None

    async def delete_product(self, product_id: str, enterprise_id: str) -> bool:
        # Soft delete
        result = await self.products.update_one(
            {"_id": ObjectId(product_id), "enterprise_id": str(enterprise_id)},
            {"$set": {"is_active": False}}
        )
        return result.modified_count > 0

    async def set_product_image(self, product_id: str, enterprise_id: str, image_url: str) -> Optional[dict]:
        """Set the product's image_url field."""
        from pymongo import ReturnDocument
        doc = await self.products.find_one_and_update(
            {"_id": ObjectId(product_id), "enterprise_id": str(enterprise_id)},
            {"$set": {"image_url": image_url}},
            return_document=ReturnDocument.AFTER
        )
        return stringify_object_ids(doc) if doc else None

    # --- Product Request Management ---

    async def create_product_request(
        self,
        visitor_id: str,
        enterprise_id: str,
        product_id: str,
        event_id: str,
        message: str,
        quantity: Optional[int] = None,
    ) -> dict:
        request_dict = {
            "visitor_id": str(visitor_id),
            "enterprise_id": str(enterprise_id),
            "product_id": str(product_id),
            "event_id": str(event_id),
            "message": message,
            "quantity": quantity,
            "status": ProductStatus.PENDING,
            "created_at": datetime.now(timezone.utc)
        }
        result = await self.product_requests.insert_one(request_dict)
        request_dict["_id"] = result.inserted_id
        return stringify_object_ids(request_dict)

    async def get_enterprise_requests(self, enterprise_id: str) -> List[dict]:
        cursor = self.product_requests.find({"enterprise_id": str(enterprise_id)}).sort("created_at", -1)
        requests = await cursor.to_list(length=100)
        enriched = []
        for req in stringify_object_ids(requests):
            # Enrich with visitor name (handle both ObjectId and UUID string IDs)
            vid = req.get("visitor_id")
            if vid:
                try:
                    if ObjectId.is_valid(str(vid)):
                        visitor = await self.db.users.find_one({"_id": ObjectId(str(vid))})
                    else:
                        visitor = await self.db.users.find_one({"_id": vid})
                    if not visitor:
                        visitor = await self.db.users.find_one({"id": str(vid)})
                    if visitor:
                        req["visitor_name"] = visitor.get("full_name") or visitor.get("name") or visitor.get("email", "")
                        req["visitor_email"] = visitor.get("email", "")
                        req["visitor_phone"] = visitor.get("phone") or visitor.get("org_phone") or "" # Try common fields
                except Exception:
                    pass
            # Enrich with product name (handle both ObjectId and UUID string IDs)
            pid = req.get("product_id")
            if pid:
                try:
                    if ObjectId.is_valid(str(pid)):
                        product = await self.db.products.find_one({"_id": ObjectId(str(pid))})
                    else:
                        product = await self.db.products.find_one({"_id": pid})
                    if product:
                        req["product_name"] = product.get("name", "")
                        req["product_type"] = product.get("type", "product")
                        # backward compat: derive is_service from type
                        req["product_is_service"] = product.get("type") == "service"
                except Exception:
                    pass
            enriched.append(req)
        return enriched

    async def update_request_status(self, request_id: str, enterprise_id: str, status: ProductStatus) -> Optional[dict]:
        from pymongo import ReturnDocument
        doc = await self.product_requests.find_one_and_update(
            {"_id": ObjectId(request_id), "enterprise_id": str(enterprise_id)},
            {"$set": {"status": status}},
            return_document=ReturnDocument.AFTER
        )
        return stringify_object_ids(doc) if doc else None

enterprise_repo = EnterpriseRepository()
