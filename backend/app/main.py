from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.config import settings
from .db.mongo import connect_to_mongo, close_mongo_connection

app = FastAPI(
    title=settings.APP_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Set up CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    await connect_to_mongo()

@app.on_event("shutdown")
async def shutdown_event():
    await close_mongo_connection()

@app.get("/")
def read_root():
    return {"message": "Welcome to IVEP API"}

# Router inclusion
from .modules.chat.router import router as chat_router
from .modules.ai_rag.router import router as rag_router
from .modules.ai_translation.router import router as translation_router
from .modules.transcripts.router import router as transcripts_router
from .modules.analytics.router import router as analytics_router
from .modules.meetings.router import router as meetings_router
from .modules.resources.router import router as resources_router
from .modules.leads.router import router as leads_router
from .modules.recommendations.router import router as recommendations_router

app.include_router(chat_router, prefix=f"{settings.API_V1_STR}/chat", tags=["chat"])
app.include_router(rag_router, prefix=f"{settings.API_V1_STR}/assistant", tags=["assistant"])
app.include_router(translation_router, prefix=f"{settings.API_V1_STR}/translation", tags=["translation"])
app.include_router(transcripts_router, prefix=f"{settings.API_V1_STR}/transcripts", tags=["transcripts"])
app.include_router(analytics_router, prefix=f"{settings.API_V1_STR}/analytics", tags=["analytics"])
app.include_router(meetings_router, prefix=f"{settings.API_V1_STR}/meetings", tags=["meetings"])
app.include_router(resources_router, prefix=f"{settings.API_V1_STR}/resources", tags=["resources"])
app.include_router(leads_router, prefix=f"{settings.API_V1_STR}/leads", tags=["leads"])
app.include_router(recommendations_router, prefix=f"{settings.API_V1_STR}/recommendations", tags=["recommendations"])
