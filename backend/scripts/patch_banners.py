"""Quick one-time script to patch banner_url on existing seeded events."""
import asyncio
from app.db.mongo import connect_to_mongo, close_mongo_connection, get_database

UNSPLASH = "https://images.unsplash.com/photo-"

BANNERS = {
    "Future Tech Expo 2026": f"{UNSPLASH}1540575467063-178a50c2c397?w=1400&h=400&fit=crop",
    "Healthcare Innovations Summit": f"{UNSPLASH}1576085898323-218337e3e43c?w=1400&h=400&fit=crop",
    "Global Education Expo": f"{UNSPLASH}1524178232363-1fb2b075b655?w=1400&h=400&fit=crop",
    "FinTech World Forum": f"{UNSPLASH}1559136555-9303baea8ebd?w=1400&h=400&fit=crop",
    "Green Energy Conference": f"{UNSPLASH}1473341304170-971dccb5ac1e?w=1400&h=400&fit=crop",
    "Cybersecurity Defense Summit": f"{UNSPLASH}1550751827-4bd374c3f58b?w=1400&h=400&fit=crop",
    "Digital Marketing Masterclass": f"{UNSPLASH}1460925895917-afdab827c52f?w=1400&h=400&fit=crop",
    "AI & Data Science Conference": f"{UNSPLASH}1485827404703-89b55fcc595e?w=1400&h=400&fit=crop",
    "Startup Innovation Hackathon": f"{UNSPLASH}1519389950473-47ba0277781c?w=1400&h=400&fit=crop",
    "Enterprise Cloud Summit": f"{UNSPLASH}1451187580459-43490279c0fa?w=1400&h=400&fit=crop",
}


async def main():
    await connect_to_mongo()
    db = get_database()
    col = db["events"]
    for title, url in BANNERS.items():
        r = await col.update_one({"title": title}, {"$set": {"banner_url": url}})
        print(f"  {title}: matched={r.matched_count} modified={r.modified_count}")
    await close_mongo_connection()
    print("Done!")


if __name__ == "__main__":
    asyncio.run(main())
