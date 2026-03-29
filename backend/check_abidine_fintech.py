from bson import ObjectId
import asyncio
from app.db.mongo import connect_to_mongo, get_database

async def check():
    await connect_to_mongo()
    db = get_database()
    
    # Find Abidine Ent user
    user = await db.users.find_one({'full_name': {'$regex': 'Abidine', '$options': 'i'}})
    if user:
        print(f'Abidine user _id={user["_id"]} email={user.get("email")}')
        
        # Find their participation in FinTech event
        fintech_event = await db.events.find_one({'slug': 'fintech-world-forum-e1df'})
        if fintech_event:
            event_id = str(fintech_event['_id'])
            print(f'FinTech event_id={event_id}')
            
            # Check stands collection
            stand = await db.stands.find_one({
                'enterprise_id': str(user['_id']),
                'event_id': event_id
            })
            print(f'Stand for Abidine in FinTech: {stand}')
            
            # Check participants collection  
            participant = await db.participants.find_one({
                'enterprise_id': str(user['_id']),
                'event_id': event_id
            })
            print(f'Participant record: {participant}')

asyncio.run(check())
// file removed
