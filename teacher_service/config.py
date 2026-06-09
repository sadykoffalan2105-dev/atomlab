import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
G7_KNOWLEDGE_PATH = REPO_ROOT / "src" / "data" / "g7TextbookKnowledge.json"

TEACHER_SERVICE_PORT = int(os.environ.get("TEACHER_SERVICE_PORT", "8765"))
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434").rstrip("/")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.2")
OLLAMA_TIMEOUT_SEC = float(os.environ.get("OLLAMA_TIMEOUT_SEC", "120"))

EDGE_VOICE_RU = os.environ.get("EDGE_TTS_VOICE_RU", "ru-RU-DmitryNeural")
EDGE_VOICE_EN = os.environ.get("EDGE_TTS_VOICE_EN", "en-US-GuyNeural")
EDGE_RATE = os.environ.get("EDGE_TTS_RATE", "-4%")
EDGE_PITCH = os.environ.get("EDGE_TTS_PITCH", "+0Hz")

MAX_USER_CHARS = 2000
MAX_HISTORY = 12
MAX_TTS_CHARS = 3600
TTS_CHUNK_CHARS = 800

CORS_ORIGINS = [
    o.strip()
    for o in os.environ.get(
        "TEACHER_CORS_ORIGINS",
        "http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:4173,http://localhost:4173",
    ).split(",")
    if o.strip()
]
