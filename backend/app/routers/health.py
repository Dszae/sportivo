from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
from app.redis_client import redis_service
from app.config import settings

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    """Comprehensive healthcheck probing FastAPI, PostgreSQL, and Redis."""
    db_healthy = False
    try:
        res = await db.execute(text("SELECT 1"))
        db_healthy = res.scalar() == 1
    except Exception:
        db_healthy = False

    redis_healthy = await redis_service.is_healthy()

    overall_status = "healthy" if (db_healthy and redis_healthy) else "degraded" if (db_healthy or redis_healthy) else "unhealthy"

    return {
        "status": overall_status,
        "app": settings.APP_NAME,
        "environment": settings.ENVIRONMENT,
        "services": {
            "api": "online",
            "postgres": "online" if db_healthy else "offline",
            "redis": "online" if redis_healthy else "offline",
        }
    }
