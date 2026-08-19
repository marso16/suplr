import pytest


@pytest.mark.asyncio
async def test_create_client(client, auth_headers):
    resp = await client.post(
        "/clients",
        json={"name": "Baraka Grocery", "whatsapp_number": "+9611234567"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["name"] == "Baraka Grocery"


@pytest.mark.asyncio
async def test_list_clients(client, auth_headers):
    await client.post(
        "/clients",
        json={"name": "A", "whatsapp_number": "+9610000001"},
        headers=auth_headers,
    )
    await client.post(
        "/clients",
        json={"name": "B", "whatsapp_number": "+9610000002"},
        headers=auth_headers,
    )
    resp = await client.get("/clients", headers=auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 2
