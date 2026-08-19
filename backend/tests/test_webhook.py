import pytest
import hmac
import hashlib
import json
from unittest.mock import patch


def make_signature(body: bytes, secret: str) -> str:
    return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


@pytest.mark.asyncio
async def test_webhook_stores_message(client, auth_headers):
    me = await client.get("/auth/me", headers=auth_headers)
    supplier_id = me.json()["id"]

    payload = {
        "messages": [
            {
                "id": "wamid.abc123",
                "from": "+9611234567",
                "type": "text",
                "text": {"body": "3 boxes soap please"},
            }
        ]
    }
    body = json.dumps(payload).encode()
    sig = make_signature(body, "test-webhook-secret")

    with patch("whatsapp.sender.send_message") as mock_send:
        resp = await client.post(
            f"/webhook/{supplier_id}",
            content=body,
            headers={"Content-Type": "application/json", "X-Webhook-Signature": sig},
        )

    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_webhook_rejects_invalid_signature(client, auth_headers):
    me = await client.get("/auth/me", headers=auth_headers)
    supplier_id = me.json()["id"]

    payload = {"messages": []}
    body = json.dumps(payload).encode()

    resp = await client.post(
        f"/webhook/{supplier_id}",
        content=body,
        headers={"Content-Type": "application/json", "X-Webhook-Signature": "badhash"},
    )
    assert resp.status_code == 403
