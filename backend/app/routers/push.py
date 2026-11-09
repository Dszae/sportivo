from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.match import PushSubscription
from app.schemas.match import PushSubscribeRequest

router = APIRouter(prefix="/api/push", tags=["Push Notifications"])


@router.post("/subscribe", status_code=status.HTTP_201_CREATED)
async def subscribe_push(req: PushSubscribeRequest, db: AsyncSession = Depends(get_db)):
    """Registers push token or web push subscription in PostgreSQL."""
    try:
        query = select(PushSubscription).where(PushSubscription.endpoint == req.endpoint)
        result = await db.execute(query)
        existing = result.scalar_one_or_none()

        if existing:
            existing.p256dh = req.p256dh
            existing.auth = req.auth
            existing.device_token = req.deviceToken
            existing.platform = req.platform
            existing.subscribed_topics = req.topics or []
        else:
            sub = PushSubscription(
                endpoint=req.endpoint,
                p256dh=req.p256dh,
                auth=req.auth,
                device_token=req.deviceToken,
                platform=req.platform,
                subscribed_topics=req.topics or [],
            )
            db.add(sub)

        await db.commit()
        return {"success": True, "message": "Subscribed to push notifications successfully"}
    except Exception as e:
        await db.rollback()
        return {"success": False, "error": str(e)}
