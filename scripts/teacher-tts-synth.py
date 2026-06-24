#!/usr/bin/env python3
"""
ATOMLAB Teacher Voice — локальный neural TTS без API-ключей.
Microsoft Edge Neural (Dmitry / Guy) + подготовка текста «как живой учитель».
stdin JSON → stdout JSON { audioBase64, mimeType, source }
"""
from __future__ import annotations

import asyncio
import base64
import json
import re
import sys

# Windows: stdin/stdout по умолчанию cp1251 — кириллица из Node (UTF-8) ломается.
# Принудительно переключаем оба потока на UTF-8, иначе TTS читает «кракозябры».
for _stream in (sys.stdin, sys.stdout):
    try:
        _stream.reconfigure(encoding="utf-8")  # type: ignore[union-attr]
    except Exception:
        pass

import edge_tts

VOICE_RU = "ru-RU-DmitryNeural"
VOICE_EN = "en-US-GuyNeural"
RATE = "-12%"
PITCH = "-4Hz"

# Пауза между предложениями — на клиенте (TTS_CHUNK_GAP_MS)
SENTENCE_GAP_MS = 380


def normalize_teacher_text(text: str, locale: str) -> str:
    """Лёгкая очистка — основная подготовка уже на клиенте."""
    t = text.strip()
    t = re.sub(r"```[\s\S]*?```", " ", t)
    t = re.sub(r"`([^`]+)`", r"\1", t)
    t = re.sub(r"\*\*([^*]+)\*\*", r"\1", t)
    t = re.sub(r"\*([^*]+)\*", r"\1", t)
    t = re.sub(r"#{1,6}\s+", "", t)
    t = re.sub(r"[📖✦•·▪|]", " ", t)
    t = re.sub(r"\s{2,}", " ", t)

    if locale != "en":
        t = re.sub(r"§\s*(\d+)", r"параграф \1", t)
        t = re.sub(r"→|⟶|->", ", затем ", t)
        t = re.sub(r"⇌|↔", ", реакция обратима, ", t)
    else:
        t = re.sub(r"§\s*(\d+)", r"section \1", t)

    t = re.sub(r"…+", ".", t)
    t = re.sub(r"\.{2,}", ".", t)
    t = re.sub(r"[\u200b-\u200d\ufeff\u00ad]", "", t)
    t = re.sub(r"\s+([,.!?;:])", r"\1", t)
    t = re.sub(r"([,;])\s*", r"\1 ", t)
    return t.strip()


def split_sentences(text: str, max_len: int = 180) -> list[str]:
    raw = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
    if not raw:
        return [text] if text else []

    parts: list[str] = []
    for sentence in raw:
        if len(sentence) <= max_len:
            parts.append(sentence)
            continue
        for chunk in re.split(r"(?<=[,;:])\s+", sentence):
            chunk = chunk.strip()
            if not chunk:
                continue
            if len(chunk) <= max_len:
                parts.append(chunk)
            else:
                words = chunk.split()
                buf = ""
                for w in words:
                    if not buf:
                        buf = w
                    elif len(buf) + 1 + len(w) <= max_len:
                        buf += " " + w
                    else:
                        parts.append(buf)
                        buf = w
                if buf:
                    parts.append(buf)
    return parts


# Серверы Microsoft иногда отдают «No audio was received» — транзиентный сбой.
# Ретраим, иначе фраза молча падает на браузерный (роботизированный) голос.
_TTS_ATTEMPTS = 3


async def synth_text(text: str, voice: str) -> bytes:
    last_err: Exception | None = None
    for attempt in range(_TTS_ATTEMPTS):
        try:
            communicate = edge_tts.Communicate(text, voice, rate=RATE, pitch=PITCH)
            chunks: list[bytes] = []
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    chunks.append(chunk["data"])
            audio = b"".join(chunks)
            if audio:
                return audio
        except Exception as exc:  # network / no-audio / token refresh
            last_err = exc
        if attempt + 1 < _TTS_ATTEMPTS:
            await asyncio.sleep(0.6 * (attempt + 1))
    if last_err is not None:
        raise last_err
    return b""


async def synthesize_teacher(text: str, locale: str, voice: str | None, *, prepared: bool = False) -> bytes:
    v = voice or (VOICE_EN if locale == "en" else VOICE_RU)
    spoken = text.strip() if prepared else normalize_teacher_text(text, locale)
    if not spoken:
        return b""
    # Клиент уже разбил на фразы — озвучиваем ровно то, что пришло
    return await synth_text(spoken, v)


def main() -> None:
    try:
        payload = json.load(sys.stdin)
        text = (payload.get("text") or "").strip()
        locale = payload.get("locale") or "ru"
        voice = payload.get("voice")
        prepared = bool(payload.get("prepared"))
        if not text:
            print(json.dumps({"error": "empty_text"}))
            sys.exit(1)

        audio = asyncio.run(synthesize_teacher(text, locale, voice, prepared=prepared))
        if len(audio) < 128:
            print(json.dumps({"error": "tts_empty"}))
            sys.exit(1)

        print(
            json.dumps(
                {
                    "audioBase64": base64.b64encode(audio).decode("ascii"),
                    "mimeType": "audio/mpeg",
                    "source": "edge",
                },
                ensure_ascii=False,
            )
        )
    except Exception as exc:
        print(json.dumps({"error": str(exc)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
