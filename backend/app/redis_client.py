import redis.asyncio as aioredis
from app.config import settings
import json
import logging
from typing import Optional, Any

logger = logging.getLogger(__name__)

class RedisService:
    def __init__(self):
        self.client: Optional[aioredis.Redis] = None
        self._memory_cache = {}

    async def connect(self):
        try:
            self.client = aioredis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_timeout=3.0,
                socket_connect_timeout=3.0,
            )
            await self.client.ping()
            logger.info("Connected to Redis server successfully.")
        except Exception as e:
            logger.warning(f"Could not connect to Redis, using in-memory cache fallback: {e}")
            self.client = None

    async def close(self):
        if self.client:
            await self.client.close()

    async def get(self, key: str) -> Optional[Any]:
        if self.client:
            try:
                val = await self.client.get(key)
                if val:
                    try:
                        return json.loads(val)
                    except json.JSONDecodeError:
                        return val
            except Exception as e:
                logger.error(f"Redis get error: {e}")
        return self._memory_cache.get(key)

    async def set(self, key: str, value: Any, expire_seconds: int = 60) -> bool:
        if self.client:
            try:
                serial = json.dumps(value) if not isinstance(value, str) else value
                await self.client.set(key, serial, ex=expire_seconds)
                return True
            except Exception as e:
                logger.error(f"Redis set error: {e}")
        self._memory_cache[key] = value
        return True

    async def is_healthy(self) -> bool:
        if not self.client:
            return False
        try:
            return bool(await self.client.ping())
        except Exception:
            return False


redis_service = RedisService()
