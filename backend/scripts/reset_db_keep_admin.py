#!/usr/bin/env python3
"""Reset MongoDB data while preserving admin user account(s).

Default mode is dry-run and prints what would be deleted.
Use --execute --yes-i-understand to apply deletion.
"""

from __future__ import annotations

import argparse
import os
import sys
from typing import Any

from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.database import Database


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Wipe MongoDB collections while keeping admin user(s)."
    )
    parser.add_argument(
        "--mongo-uri",
        default=None,
        help="MongoDB URI. Defaults to MONGO_URI from backend/.env",
    )
    parser.add_argument(
        "--database",
        default=None,
        help="Database name. Defaults to DATABASE_NAME from backend/.env",
    )
    parser.add_argument(
        "--users-collection",
        default="users",
        help="Users collection name (default: users)",
    )
    parser.add_argument(
        "--admin-role",
        default="admin",
        help="Admin role value to preserve in users collection (default: admin)",
    )
    parser.add_argument(
        "--admin-email",
        default=None,
        help="Optional specific admin email to keep (if set, only this admin is preserved).",
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Actually delete data. Without this flag, script runs in dry-run mode.",
    )
    parser.add_argument(
        "--yes-i-understand",
        action="store_true",
        help="Required with --execute to confirm irreversible deletion.",
    )
    return parser.parse_args()


def load_env_defaults() -> tuple[str, str]:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.dirname(script_dir)
    env_path = os.path.join(backend_dir, ".env")
    load_dotenv(env_path)

    mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    database_name = os.getenv("DATABASE_NAME", "ivep_db")
    return mongo_uri, database_name


def build_admin_filter(admin_role: str, admin_email: str | None) -> dict[str, Any]:
    # Handle both plain string and enum-like persisted values.
    role_values = [admin_role]
    if not admin_role.startswith("Role."):
        role_values.append(f"Role.{admin_role.upper()}")

    base_filter: dict[str, Any] = {"role": {"$in": role_values}}
    if admin_email:
        base_filter["email"] = admin_email
    return base_filter


def get_collection_names(db: Database) -> list[str]:
    names = db.list_collection_names()
    return [name for name in names if not name.startswith("system.")]


def collect_plan(
    db: Database,
    users_collection_name: str,
    admin_filter: dict[str, Any],
) -> tuple[list[dict[str, Any]], list[Any], list[dict[str, Any]]]:
    users_collection = db[users_collection_name]
    admins = list(users_collection.find(admin_filter, {"_id": 1, "email": 1, "role": 1}))
    keep_ids = [admin["_id"] for admin in admins]

    if not keep_ids:
        return admins, keep_ids, []

    plan: list[dict[str, Any]] = []
    for name in get_collection_names(db):
        col = db[name]
        if name == users_collection_name:
            to_delete = col.count_documents({"_id": {"$nin": keep_ids}})
            total = col.count_documents({})
            keep = total - to_delete
        else:
            to_delete = col.count_documents({})
            keep = 0

        plan.append(
            {
                "collection": name,
                "delete_count": int(to_delete),
                "keep_count": int(keep),
            }
        )

    return admins, keep_ids, plan


def execute_plan(db: Database, users_collection_name: str, keep_ids: list[Any], plan: list[dict[str, Any]]) -> None:
    for item in plan:
        name = item["collection"]
        col = db[name]

        if name == users_collection_name:
            result = col.delete_many({"_id": {"$nin": keep_ids}})
        else:
            result = col.delete_many({})

        item["deleted_actual"] = int(result.deleted_count)


def main() -> int:
    args = parse_args()
    env_mongo_uri, env_database = load_env_defaults()

    mongo_uri = args.mongo_uri or env_mongo_uri
    database_name = args.database or env_database

    if args.execute and not args.yes_i_understand:
        print("ERROR: --execute requires --yes-i-understand")
        return 2

    client = MongoClient(mongo_uri)
    db = client[database_name]

    try:
        admin_filter = build_admin_filter(args.admin_role, args.admin_email)
        admins, keep_ids, plan = collect_plan(db, args.users_collection, admin_filter)

        print(f"Database: {database_name}")
        print(f"Users collection: {args.users_collection}")
        print(f"Admin filter: {admin_filter}")

        if not keep_ids:
            print("\nABORTED: No admin account matched the filter. Nothing deleted.")
            return 1

        print("\nAdmin account(s) to keep:")
        for admin in admins:
            print(f"  - {admin.get('email', '<no-email>')} ({admin.get('role')})")

        if not plan:
            print("\nNo collections found. Nothing to do.")
            return 0

        print("\nDeletion plan:")
        total_to_delete = 0
        for item in plan:
            total_to_delete += item["delete_count"]
            print(
                f"  - {item['collection']}: delete {item['delete_count']}, keep {item['keep_count']}"
            )

        print(f"\nTotal documents to delete: {total_to_delete}")

        if not args.execute:
            print("\nDry-run mode only. No data deleted.")
            print(
                "Run again with: --execute --yes-i-understand to apply this plan."
            )
            return 0

        execute_plan(db, args.users_collection, keep_ids, plan)

        print("\nDeletion completed:")
        for item in plan:
            print(
                f"  - {item['collection']}: deleted {item.get('deleted_actual', 0)}"
            )

        print("\nDone. Database was reset and admin account(s) preserved.")
        return 0

    finally:
        client.close()


if __name__ == "__main__":
    sys.exit(main())
