from typing import Any
from bson import ObjectId


def stringify_object_ids(obj: Any) -> Any:
    """
    Recursively convert bson.ObjectId values to strings.
    Also mirrors the value to an "id" field when the source key is "_id".
    """
    if isinstance(obj, list):
        return [stringify_object_ids(item) for item in obj]

    if isinstance(obj, dict):
        normalized = {}
        for key, value in obj.items():
            if key == "_id" and isinstance(value, ObjectId):
                normalized[key] = str(value)
                # Preserve an "id" mirror so schemas that expect id can still populate
                normalized.setdefault("id", str(value))
            else:
                normalized[key] = stringify_object_ids(value)
        return normalized

    if isinstance(obj, ObjectId):
        return str(obj)

    return obj
