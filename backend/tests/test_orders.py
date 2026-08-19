import pytest


@pytest.mark.asyncio
async def test_create_order(client, auth_headers):
    c = await client.post(
        "/clients",
        json={"name": "Baraka", "whatsapp_number": "+9611111111"},
        headers=auth_headers,
    )
    client_id = c.json()["id"]

    resp = await client.post(
        "/orders",
        json={
            "client_id": client_id,
            "currency": "USD",
            "items": [
                {
                    "product_name_raw": "Soap 5kg",
                    "quantity": "3",
                    "unit": "box",
                    "price": "5.00",
                }
            ],
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "pending"
    assert len(data["items"]) == 1
    assert data["total"] == "15.00"


@pytest.mark.asyncio
async def test_confirm_order(client, auth_headers):
    c = await client.post(
        "/clients",
        json={"name": "Baraka", "whatsapp_number": "+9611111112"},
        headers=auth_headers,
    )
    client_id = c.json()["id"]
    order = await client.post(
        "/orders",
        json={
            "client_id": client_id,
            "currency": "USD",
            "items": [
                {
                    "product_name_raw": "Soap",
                    "quantity": "1",
                    "unit": "box",
                    "price": "5.00",
                }
            ],
        },
        headers=auth_headers,
    )
    order_id = order.json()["id"]

    resp = await client.patch(f"/orders/{order_id}/confirm", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "confirmed"
    assert resp.json()["confirmed_at"] is not None


@pytest.mark.asyncio
async def test_cannot_access_another_suppliers_order(client, auth_headers):
    await client.post(
        "/auth/register",
        json={"name": "Other", "email": "other@test.com", "password": "pass"},
    )
    resp2 = await client.post(
        "/auth/login", json={"email": "other@test.com", "password": "pass"}
    )
    other_headers = {"Authorization": f"Bearer {resp2.json()['access_token']}"}

    c = await client.post(
        "/clients",
        json={"name": "X", "whatsapp_number": "+9611111113"},
        headers=auth_headers,
    )
    order = await client.post(
        "/orders",
        json={
            "client_id": c.json()["id"],
            "currency": "USD",
            "items": [
                {
                    "product_name_raw": "A",
                    "quantity": "1",
                    "unit": "box",
                    "price": "1.00",
                }
            ],
        },
        headers=auth_headers,
    )
    order_id = order.json()["id"]

    resp = await client.patch(f"/orders/{order_id}/confirm", headers=other_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_orders(client, auth_headers):
    c = await client.post(
        "/clients",
        json={"name": "Test", "whatsapp_number": "+9611111114"},
        headers=auth_headers,
    )
    await client.post(
        "/orders",
        json={
            "client_id": c.json()["id"],
            "currency": "USD",
            "items": [
                {
                    "product_name_raw": "Item",
                    "quantity": "2",
                    "unit": "kg",
                    "price": "3.00",
                }
            ],
        },
        headers=auth_headers,
    )

    resp = await client.get("/orders", headers=auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()) >= 1
