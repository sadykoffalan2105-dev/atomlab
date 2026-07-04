from __future__ import annotations

from pydantic import BaseModel, Field

from teacher_service.tts.edge import synthesize_speech


class TtsRequest(BaseModel):
    text: str = ""
    locale: str = "ru"
    prepared: bool = False


class TtsResponse(BaseModel):
    audioBase64: str | None = None
    mimeType: str = "audio/mpeg"
    source: str = "edge"
    error: str | None = None


async def handle_tts(body: TtsRequest) -> TtsResponse:
    locale = "en" if body.locale == "en" else "uz" if body.locale == "uz" else "ru"
    text = (body.text or "").strip()
    if not text:
        return TtsResponse(error="empty_text")

    try:
        audio_b64, mime = await synthesize_speech(text, locale, prepared=body.prepared)
        return TtsResponse(audioBase64=audio_b64, mimeType=mime, source="edge")
    except Exception as exc:
        return TtsResponse(error=str(exc))
