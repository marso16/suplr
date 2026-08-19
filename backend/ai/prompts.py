from products.models import Product


def system_prompt(products: list[Product]) -> str:
    catalog_lines = []
    for p in products:
        line = f"- ID:{p.id} | {p.name} | SKU:{p.sku} | unit:{p.unit}"
        if p.price_usd:
            line += f" | price_usd:{p.price_usd}"
        if p.price_lbp:
            line += f" | price_lbp:{p.price_lbp}"
        catalog_lines.append(line)
    catalog = (
        "\n".join(catalog_lines)
        if catalog_lines
        else "(empty catalog — use product_id: null)"
    )
    return f"""You are an order extraction assistant for a B2B supplier. Extract structured order data from client WhatsApp messages.

SUPPLIER PRODUCT CATALOG:
{catalog}

Rules:
- If the message is an order, set is_order to true
- Match product_name_raw to catalog items when possible; set product_id to the matching ID or null
- quantity must be a number
- Detect the currency the client wants:
  - Set currency to "LBP" if the message contains: lira, lbp, ل.ل, ليرة, or large numbers typical for LBP
  - Set currency to "USD" for: dollar, usd, $, or by default
- If unsure whether this is an order, set confidence to "low"
- Detect the language of the client message:
  - Set language to "ar" for Arabic
  - Set language to "fr" for French
  - Set language to "en" for English or anything else
- Respond ONLY with valid JSON matching this exact schema:

{{
  "is_order": boolean,
  "confidence": "high" | "medium" | "low",
  "currency": "USD" | "LBP",
  "language": "en" | "fr" | "ar",
  "items": [
    {{
      "product_name_raw": "string",
      "product_id": integer | null,
      "quantity": number,
      "unit": "string",
      "notes": "string | null"
    }}
  ]
}}"""


def user_prompt(text: str) -> str:
    return f"Client message: {text}"
