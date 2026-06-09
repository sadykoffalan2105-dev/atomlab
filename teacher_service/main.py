from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from teacher_service.brain.rag import get_rag_index
from teacher_service.config import CORS_ORIGINS, TEACHER_SERVICE_PORT
from teacher_service.routes.chat import ChatRequest, ChatResponse, handle_chat
from teacher_service.routes.health import health_payload
from teacher_service.routes.tts import TtsRequest, TtsResponse, handle_tts
from teacher_service.tts.edge import warmup_voice


@asynccontextmanager
async def lifespan(_app: FastAPI):
    get_rag_index()
    asyncio.create_task(warmup_voice("ru"))
    yield


app = FastAPI(title="ATOMLAB Teacher Service", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return await health_payload()


@app.post("/v1/chat", response_model=ChatResponse)
async def chat_route(body: ChatRequest):
    return await handle_chat(body)


@app.post("/v1/tts", response_model=TtsResponse)
async def tts_route(body: TtsRequest):
    return await handle_tts(body)


def run() -> None:
    uvicorn.run(
        "teacher_service.main:app",
        host="127.0.0.1",
        port=TEACHER_SERVICE_PORT,
        reload=False,
        log_level="info",
    )


if __name__ == "__main__":
    run()
