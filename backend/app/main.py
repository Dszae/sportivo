from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.config import settings
from app.database import engine, Base
from app.redis_client import redis_service
from app.routers import health, npl, streams, matches, push

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("sportivo-api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager: connects Redis & sets up DB schema."""
    logger.info(f"Starting {settings.APP_NAME} in {settings.ENVIRONMENT} mode...")
    
    # Initialize Redis connection
    await redis_service.connect()
    
    # Initialize DB tables (idempotent)
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database schemas verified.")
    except Exception as e:
        logger.warning(f"Database schema auto-creation notice: {e}")

    yield

    # Clean shutdown
    logger.info("Shutting down Sportivo API...")
    await redis_service.close()
    await engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    version="1.1.4",
    description="High-performance async sports desk API for Sportivo (Web & React Native Expo)",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS Middleware (supports mobile app and web frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers
app.include_router(health.router)
app.include_router(npl.router)
app.include_router(streams.router)
app.include_router(matches.router)
app.include_router(push.router)


@app.get("/")
async def root():
    return {
        "app": settings.APP_NAME,
        "version": "1.1.4",
        "documentation": "/docs",
        "status": "operational",
    }
