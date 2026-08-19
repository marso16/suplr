import pytest
from unittest.mock import patch, AsyncMock, MagicMock


async def empty_aiter():
    return
    yield  # makes it an async generator


@pytest.mark.asyncio
async def test_sse_rejects_unauthenticated(client):
    resp = await client.get("/sse/orders")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_sse_accepts_bearer_token(client, auth_headers):
    mock_pubsub = AsyncMock()
    mock_pubsub.subscribe = AsyncMock()
    mock_pubsub.listen = MagicMock(return_value=empty_aiter())
    mock_pubsub.unsubscribe = AsyncMock()

    mock_redis = AsyncMock()
    mock_redis.pubsub = MagicMock(return_value=mock_pubsub)
    mock_redis.aclose = AsyncMock()

    with patch("sse.events.get_redis", return_value=mock_redis):
        async with client.stream("GET", "/sse/orders", headers=auth_headers) as resp:
            assert resp.status_code == 200
            assert "text/event-stream" in resp.headers["content-type"]


@pytest.mark.asyncio
async def test_sse_accepts_query_param_token(client, auth_headers):
    # Register and login to get a token
    # auth_headers is {"Authorization": "Bearer <token>"} — extract the token
    bearer = auth_headers["Authorization"]
    token = bearer.removeprefix("Bearer ")

    mock_pubsub = AsyncMock()
    mock_pubsub.subscribe = AsyncMock()
    mock_pubsub.listen = MagicMock(return_value=empty_aiter())
    mock_pubsub.unsubscribe = AsyncMock()

    mock_redis = AsyncMock()
    mock_redis.pubsub = MagicMock(return_value=mock_pubsub)
    mock_redis.aclose = AsyncMock()

    with patch("sse.events.get_redis", return_value=mock_redis):
        async with client.stream("GET", f"/sse/orders?token={token}") as resp:
            assert resp.status_code == 200
            assert "text/event-stream" in resp.headers["content-type"]
