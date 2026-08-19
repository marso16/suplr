import json
from decimal import Decimal
from dataclasses import dataclass, field
from typing import Optional
from groq import Groq
from config import get_settings
from ai.prompts import system_prompt, user_prompt
from products.models import Product

settings = get_settings()
groq_client = Groq(api_key=settings.groq_api_key)


@dataclass
class ParsedItem:
    product_name_raw: str
    quantity: Decimal
    unit: str
    product_id: Optional[int] = None
    notes: Optional[str] = None


@dataclass
class ParsedOrder:
    is_order: bool
    confidence: str
    currency: str = "USD"
    language: str = "en"
    items: list[ParsedItem] = field(default_factory=list)


async def parse_order_message(text: str, products: list[Product]) -> ParsedOrder:
    try:
        response = groq_client.chat.completions.create(
            model="openai/gpt-oss-20b",
            messages=[
                {"role": "system", "content": system_prompt(products)},
                {"role": "user", "content": user_prompt(text)},
            ],
            temperature=0,
            max_tokens=500,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content
        data = json.loads(raw)
        items = [
            ParsedItem(
                product_name_raw=i["product_name_raw"],
                quantity=Decimal(str(i["quantity"])),
                unit=i.get("unit", "unit"),
                product_id=i.get("product_id"),
                notes=i.get("notes"),
            )
            for i in data.get("items", [])
        ]
        return ParsedOrder(
            is_order=data.get("is_order", False),
            confidence=data.get("confidence", "low"),
            currency=data.get("currency", "USD"),
            language=data.get("language", "en"),
            items=items,
        )
    except Exception:
        return ParsedOrder(is_order=False, confidence="low")
