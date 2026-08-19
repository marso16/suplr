import base64
import httpx


def _headers(bsp_api_key: str) -> dict:
    h = {"Content-Type": "application/json"}
    if bsp_api_key:
        h["Authorization"] = f"Bearer {bsp_api_key}"
    return h


async def send_message(bsp_endpoint: str, bsp_api_key: str, to: str, text: str) -> None:
    async with httpx.AsyncClient() as http:
        resp = await http.post(
            f"{bsp_endpoint.rstrip('/')}/send",
            json={"to": to, "message": text},
            headers=_headers(bsp_api_key),
            timeout=10.0,
        )
        resp.raise_for_status()


async def send_document(
    bsp_endpoint: str, bsp_api_key: str, to: str, pdf_bytes: bytes, filename: str
) -> None:
    async with httpx.AsyncClient() as http:
        resp = await http.post(
            f"{bsp_endpoint.rstrip('/')}/send-document",
            json={
                "to": to,
                "filename": filename,
                "base64": base64.b64encode(pdf_bytes).decode(),
            },
            headers=_headers(bsp_api_key),
            timeout=30.0,
        )
        resp.raise_for_status()
