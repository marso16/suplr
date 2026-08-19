import pytest
from unittest.mock import patch, MagicMock


@pytest.mark.asyncio
async def test_create_invoice_from_confirmed_order(client, auth_headers):
    c = await client.post(
        "/clients",
        json={"name": "B", "whatsapp_number": "+9611111111"},
        headers=auth_headers,
    )
    order = await client.post(
        "/orders",
        json={
            "client_id": c.json()["id"],
            "currency": "USD",
            "items": [
                {
                    "product_name_raw": "Soap",
                    "quantity": "2",
                    "unit": "box",
                    "price": "5.00",
                }
            ],
        },
        headers=auth_headers,
    )
    order_id = order.json()["id"]
    await client.patch(f"/orders/{order_id}/confirm", headers=auth_headers)

    resp = await client.post(
        "/invoices", json={"order_id": order_id}, headers=auth_headers
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["total"] == "10.00"
    assert data["currency"] == "USD"
    assert "INV-" in data["number"]


@pytest.mark.asyncio
async def test_cannot_invoice_unconfirmed_order(client, auth_headers):
    c = await client.post(
        "/clients",
        json={"name": "B", "whatsapp_number": "+9611111112"},
        headers=auth_headers,
    )
    order = await client.post(
        "/orders",
        json={
            "client_id": c.json()["id"],
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

    resp = await client.post(
        "/invoices", json={"order_id": order_id}, headers=auth_headers
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_invoice_pdf_returns_bytes(client, auth_headers):
    c = await client.post(
        "/clients",
        json={"name": "B", "whatsapp_number": "+9611111113"},
        headers=auth_headers,
    )
    order = await client.post(
        "/orders",
        json={
            "client_id": c.json()["id"],
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
    await client.patch(f"/orders/{order_id}/confirm", headers=auth_headers)
    inv = await client.post(
        "/invoices", json={"order_id": order_id}, headers=auth_headers
    )
    invoice_id = inv.json()["id"]

    mock_html = MagicMock()
    mock_html.return_value.write_pdf.return_value = b"%PDF-fake"
    with patch("invoices.pdf.HTML", mock_html):
        resp = await client.get(f"/invoices/{invoice_id}/pdf", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
