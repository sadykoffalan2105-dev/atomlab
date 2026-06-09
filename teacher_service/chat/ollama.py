from __future__ import annotations

from typing import Any

import httpx

from teacher_service.config import OLLAMA_MODEL, OLLAMA_TIMEOUT_SEC, OLLAMA_URL


class OllamaError(Exception):
    pass


async def chat_completion(
    system: str,
    messages: list[dict[str, str]],
    *,
    model: str | None = None,
    temperature: float = 0.42,
) -> str:
    payload = {
        "model": model or OLLAMA_MODEL,
        "messages": [{"role": "system", "content": system}, *messages],
        "stream": False,
        "options": {"temperature": temperature, "num_predict": 900},
    }
    url = f"{OLLAMA_URL}/api/chat"
    try:
        async with httpx.AsyncClient(timeout=OLLAMA_TIMEOUT_SEC) as client:
            res = await client.post(url, json=payload)
    except httpx.RequestError as exc:
        raise OllamaError(f"ollama_unreachable: {exc}") from exc

    if res.status_code != 200:
        raise OllamaError(f"ollama_http_{res.status_code}")

    data = res.json()
    content = (data.get("message") or {}).get("content") or ""
    return content.strip()


async def check_ollama() -> bool:
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            res = await client.get(f"{OLLAMA_URL}/api/tags")
            return res.status_code == 200
    except httpx.RequestError:
        return False
