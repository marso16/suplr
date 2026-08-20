import base64
from datetime import datetime, timezone
from typing import Optional
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


async def enqueue_broadcast(
    bsp_endpoint: str,
    bsp_api_key: str,
    numbers: list[str],
    message: str,
    scheduled_at: Optional[datetime] = None,
) -> str:
    delay_ms = 0
    if scheduled_at:
        delta = scheduled_at - datetime.now(timezone.utc)
        delay_ms = max(0, int(delta.total_seconds() * 1000))
    async with httpx.AsyncClient() as http:
        resp = await http.post(
            f"{bsp_endpoint.rstrip('/')}/queue/broadcast",
            json={"numbers": numbers, "message": message, "delayMs": delay_ms},
            headers=_headers(bsp_api_key),
            timeout=10.0,
        )
        resp.raise_for_status()
        return resp.json().get("jobId", "")


async def enqueue_reminder(
    bsp_endpoint: str,
    bsp_api_key: str,
    number: str,
    message: str,
    fire_at: datetime,
    job_id: Optional[str] = None,
) -> str:
    delta = fire_at - datetime.now(timezone.utc)
    delay_ms = max(0, int(delta.total_seconds() * 1000))
    payload: dict = {"number": number, "message": message, "delayMs": delay_ms}
    if job_id:
        payload["jobId"] = job_id
    async with httpx.AsyncClient() as http:
        resp = await http.post(
            f"{bsp_endpoint.rstrip('/')}/queue/reminder",
            json=payload,
            headers=_headers(bsp_api_key),
            timeout=10.0,
        )
        resp.raise_for_status()
        return resp.json().get("jobId", "")


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
