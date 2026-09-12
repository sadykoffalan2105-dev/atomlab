#!/usr/bin/env python3
"""Синтез речи через edge_tts — stdin JSON, stdout JSON с audioBase64."""
from __future__ import annotations

import asyncio
import base64
import json
import sys

import edge_tts

VOICE_RU = "ru-RU-DmitryNeural"
VOICE_EN = "en-US-GuyNeural"
RATE = "-12%"
PITCH = "-4Hz"


async def synthesize(text: str, locale: str, voice: str | None) -> bytes:
    v = voice or (VOICE_EN if locale == "en" else VOICE_RU)
    communicate = edge_tts.Communicate(text, v, rate=RATE, pitch=PITCH)
    chunks: list[bytes] = []
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            chunks.append(chunk["data"])
    return b"".join(chunks)


def main() -> None:
    try:
        payload = json.load(sys.stdin)
        text = (payload.get("text") or "").strip()
        locale = payload.get("locale") or "ru"
        voice = payload.get("voice")
        if not text:
            print(json.dumps({"error": "empty_text"}))
            sys.exit(1)
        audio = asyncio.run(synthesize(text, locale, voice))
        if len(audio) < 128:
            print(json.dumps({"error": "tts_empty"}))
            sys.exit(1)
        print(
            json.dumps(
                {
                    "audioBase64": base64.b64encode(audio).decode("ascii"),
                    "mimeType": "audio/mpeg",
                }
            )
        )
    except Exception as exc:
        print(json.dumps({"error": str(exc)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
