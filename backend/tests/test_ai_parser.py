import pytest
from unittest.mock import patch, MagicMock
from ai.parser import parse_order_message, ParsedOrder
from products.models import Product
from decimal import Decimal


def make_product(id, name, sku, unit):
    p = Product()
    p.id = id
    p.name = name
    p.sku = sku
    p.unit = unit
    return p


@pytest.mark.asyncio
async def test_parse_returns_parsed_order():
    products = [make_product(1, "Sunflower Oil 5L", "OIL-5L", "bottle")]

    mock_response = MagicMock()
    mock_response.choices[0].message.content = (
        '{"is_order": true, "confidence": "high", "items": [{"product_name_raw": "oil 5L", "product_id": 1, "quantity": 3, "unit": "bottle", "notes": null}]}'
    )

    with patch(
        "ai.parser.groq_client.chat.completions.create", return_value=mock_response
    ):
        result = await parse_order_message("3 bottles oil 5L please", products)

    assert isinstance(result, ParsedOrder)
    assert result.is_order is True
    assert len(result.items) == 1
    assert result.items[0].quantity == Decimal("3")


@pytest.mark.asyncio
async def test_parse_non_order_returns_low_confidence():
    mock_response = MagicMock()
    mock_response.choices[0].message.content = (
        '{"is_order": false, "confidence": "low", "items": []}'
    )

    with patch(
        "ai.parser.groq_client.chat.completions.create", return_value=mock_response
    ):
        result = await parse_order_message("Hey how are you", [])

    assert result.is_order is False
    assert result.confidence == "low"


@pytest.mark.asyncio
async def test_parse_gracefully_handles_exception():
    with patch(
        "ai.parser.groq_client.chat.completions.create",
        side_effect=Exception("API error"),
    ):
        result = await parse_order_message("some text", [])

    assert result.is_order is False
    assert result.confidence == "low"
