import asyncio
import json
import logging
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from redis.asyncio import Redis
from config import get_settings
from auth.dependencies import get_current_supplier
from suppliers.models import Supplier

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sse", tags=["sse"])


def get_redis() -> Redis:
    settings = get_settings()
    return Redis.from_url(settings.redis_url, decode_responses=True)


async def check_redis() -> bool:
    """Ping Redis and log the result. Called on startup."""
    try:
        redis = get_redis()
        await redis.ping()
        await redis.aclose()
        logger.info("✅ Redis connected successfully (%s)", get_settings().redis_url)
        return True
    except Exception as e:
        logger.error("❌ Redis connection FAILED: %s", e)
        return False


async def publish_order_event(supplier_id: int, event_type: str, order_id: int) -> None:
    try:
        redis = get_redis()
        channel = f"supplier:{supplier_id}:orders"
        payload = json.dumps({"type": event_type, "order_id": order_id})
        await redis.publish(channel, payload)
        await redis.aclose()
        logger.debug(
            "📤 Published %s for order %d on channel %s", event_type, order_id, channel
        )
    except Exception as e:
        logger.error(
            "❌ Redis publish failed (supplier=%d, order=%d): %s",
            supplier_id,
            order_id,
            e,
        )


@router.get("/orders")
async def order_stream(supplier: Supplier = Depends(get_current_supplier)):
    redis = get_redis()
    pubsub = redis.pubsub()
    channel = f"supplier:{supplier.id}:orders"

    try:
        await pubsub.subscribe(channel)
        logger.info(
            "📡 SSE stream opened for supplier %d on channel %s", supplier.id, channel
        )
    except Exception as e:
        logger.error("❌ Redis subscribe failed for supplier %d: %s", supplier.id, e)
        raise

    async def event_generator():
        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    logger.debug(
                        "📨 SSE message → supplier %d: %s", supplier.id, message["data"]
                    )
                    yield f"data: {message['data']}\n\n"
        except Exception as e:
            logger.error("❌ SSE stream error for supplier %d: %s", supplier.id, e)
        finally:
            await pubsub.unsubscribe()
            await redis.aclose()
            logger.info("🔌 SSE stream closed for supplier %d", supplier.id)

    return StreamingResponse(event_generator(), media_type="text/event-stream")
