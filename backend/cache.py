"""
Shared Redis helpers for:
  - Webhook idempotency  (key: idem:{supplier_id}:{msg_id},  TTL 24 h)
  - Report result cache  (key: report:{supplier_id}:{period}, TTL 2 min)
"""
import json
import logging
from redis.asyncio import Redis
from config import get_settings

logger = logging.getLogger(__name__)

_TTL_WEBHOOK = 86_400   # 24 h — covers any WhatsApp re-delivery window
_TTL_REPORT  = 120      # 2 min


def _redis() -> Redis:
    return Redis.from_url(get_settings().redis_url, decode_responses=True)


# ── Idempotency ───────────────────────────────────────────────────────────────

async def is_message_seen(supplier_id: int, msg_id: str) -> bool:
    """Return True if this msg_id was already processed. Fails open (returns False) on error."""
    try:
        r = _redis()
        seen = await r.exists(f"idem:{supplier_id}:{msg_id}")
        await r.aclose()
        return bool(seen)
    except Exception as e:
        logger.warning("Redis idempotency check failed: %s", e)
        return False  # fail open — better to process twice than silently drop


async def mark_message_seen(supplier_id: int, msg_id: str) -> None:
    """Record msg_id so duplicate deliveries are skipped."""
    try:
        r = _redis()
        await r.set(f"idem:{supplier_id}:{msg_id}", "1", ex=_TTL_WEBHOOK)
        await r.aclose()
    except Exception as e:
        logger.warning("Redis mark-seen failed: %s", e)


# ── Report cache ──────────────────────────────────────────────────────────────

async def get_cached_report(supplier_id: int, period: str) -> dict | None:
    try:
        r = _redis()
        raw = await r.get(f"report:{supplier_id}:{period}")
        await r.aclose()
        return json.loads(raw) if raw else None
    except Exception as e:
        logger.warning("Redis report cache read failed: %s", e)
        return None


async def set_cached_report(supplier_id: int, period: str, data: dict) -> None:
    try:
        r = _redis()
        await r.set(f"report:{supplier_id}:{period}", json.dumps(data), ex=_TTL_REPORT)
        await r.aclose()
    except Exception as e:
        logger.warning("Redis report cache write failed: %s", e)


async def invalidate_report_cache(supplier_id: int) -> None:
    """Delete all cached report periods for this supplier (called on order state change)."""
    try:
        r = _redis()
        keys = await r.keys(f"report:{supplier_id}:*")
        if keys:
            await r.delete(*keys)
        await r.aclose()
    except Exception as e:
        logger.warning("Redis report cache invalidation failed: %s", e)
