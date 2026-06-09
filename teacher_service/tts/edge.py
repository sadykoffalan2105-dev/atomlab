from __future__ import annotations

import asyncio
import base64
import hashlib
from collections import OrderedDict

import edge_tts

from teacher_service.config import (
    EDGE_PITCH,
    EDGE_RATE,
    EDGE_VOICE_EN,
    EDGE_VOICE_RU,
    MAX_TTS_CHARS,
    TTS_CHUNK_CHARS,
)
from teacher_service.tts.text_prep import prepare_text_for_tts, split_for_tts

_CACHE: OrderedDict[str, tuple[str, str]] = OrderedDict()
_CACHE_MAX = 128


def _voice(locale: str) -> str:
    return EDGE_VOICE_EN if locale == "en" else EDGE_VOICE_RU


def _cache_key(text: str, locale: str) -> str:
    digest = hashlib.sha256(f"{locale}:{text}".encode("utf-8")).hexdigest()
    return digest


def _cache_get(key: str) -> tuple[str, str] | None:
    if key in _CACHE:
        _CACHE.move_to_end(key)
        return _CACHE[key]
    return None


def _cache_put(key: str, audio_b64: str, mime: str) -> None:
    _CACHE[key] = (audio_b64, mime)
    _CACHE.move_to_end(key)
    while len(_CACHE) > _CACHE_MAX:
        _CACHE.popitem(last=False)


async def _synthesize_chunk(text: str, locale: str) -> bytes:
    communicate = edge_tts.Communicate(text, _voice(locale), rate=EDGE_RATE, pitch=EDGE_PITCH)
    chunks: list[bytes] = []
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            chunks.append(chunk["data"])
    return b"".join(chunks)


async def synthesize_speech(text: str, locale: str = "ru") -> tuple[str, str]:
    prepared = prepare_text_for_tts(text[:MAX_TTS_CHARS], locale)
    if not prepared:
        raise ValueError("empty_text")

    key = _cache_key(prepared, locale)
    cached = _cache_get(key)
    if cached:
        return cached

    parts = split_for_tts(prepared, TTS_CHUNK_CHARS)
    audio = b""
    for part in parts:
        audio += await _synthesize_chunk(part, locale)

    if not audio:
        raise RuntimeError("tts_empty")

    audio_b64 = base64.b64encode(audio).decode("ascii")
    mime = "audio/mpeg"
    _cache_put(key, audio_b64, mime)
    return audio_b64, mime


async def warmup_voice(locale: str = "ru") -> None:
    try:
        await synthesize_speech("Готов к уроку.", locale)
    except Exception:
        pass


def warmup_voice_sync() -> None:
    try:
        asyncio.run(warmup_voice("ru"))
    except Exception:
        pass
