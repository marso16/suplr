import pytest


@pytest.mark.asyncio
async def test_create_product(client, auth_headers):
    resp = await client.post(
        "/products",
        json={
            "name": "Sunflower Oil 5L",
            "sku": "OIL-5L",
            "unit": "bottle",
            "price_usd": "3.50",
            "price_lbp": None,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["sku"] == "OIL-5L"


@pytest.mark.asyncio
async def test_list_active_products(client, auth_headers):
    await client.post(
        "/products",
        json={
            "name": "A",
            "sku": "A1",
            "unit": "box",
            "price_usd": "1.00",
            "price_lbp": None,
        },
        headers=auth_headers,
    )
    resp = await client.get("/products", headers=auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()) >= 1
