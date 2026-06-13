#!/usr/bin/env python3
"""Persistent Edge TTS worker — one JSON request per line, one JSON response per line."""
from __future__ import annotations

import asyncio
import base64
import json
import runpy
import sys
from pathlib import Path

_mod = runpy.run_path(str(Path(__file__).with_name("teacher-tts-synth.py")))
synthesize_teacher = _mod["synthesize_teacher"]


async def handle(payload: dict) -> dict:
    text = (payload.get("text") or "").strip()
    locale = payload.get("locale") or "ru"
    voice = payload.get("voice")
    prepared = bool(payload.get("prepared"))
    if not text:
        return {"error": "empty_text"}
    audio = await synthesize_teacher(text, locale, voice, prepared=prepared)
    if len(audio) < 128:
        return {"error": "tts_empty"}
    return {
        "audioBase64": base64.b64encode(audio).decode("ascii"),
        "mimeType": "audio/mpeg",
        "source": "edge",
    }


def main() -> None:
    for raw in sys.stdin:
        line = raw.strip()
        if not line:
            continue
        try:
            payload = json.loads(line)
            result = asyncio.run(handle(payload))
        except Exception as exc:
            result = {"error": str(exc)}
        print(json.dumps(result, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
