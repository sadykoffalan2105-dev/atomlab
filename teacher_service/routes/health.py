from __future__ import annotations

from teacher_service.chat.ollama import check_ollama
from teacher_service.config import G7_KNOWLEDGE_PATH, OLLAMA_MODEL, OLLAMA_URL


async def health_payload() -> dict:
    ollama_ok = await check_ollama()
    return {
        "status": "ok",
        "ollama": ollama_ok,
        "ollamaUrl": OLLAMA_URL,
        "ollamaModel": OLLAMA_MODEL,
        "textbookLoaded": G7_KNOWLEDGE_PATH.is_file(),
    }
