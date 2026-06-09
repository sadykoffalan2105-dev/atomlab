from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from teacher_service.brain.brain_pack import build_knowledge_block, build_task_coach_knowledge
from teacher_service.brain.guard import filter_assistant_reply, filter_task_coach_reply
from teacher_service.brain.prompts import build_assistant_system_prompt, build_task_coach_system_prompt
from teacher_service.chat.ollama import OllamaError, chat_completion
from teacher_service.config import MAX_HISTORY, MAX_USER_CHARS


class ChatMessage(BaseModel):
    role: str
    content: str = ""


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(default_factory=list)
    context: dict[str, Any] | None = None


class ChatResponse(BaseModel):
    reply: str | None = None
    source: str = "ollama"
    error: str | None = None


def _trim_messages(messages: list[ChatMessage]) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for msg in messages:
        if msg.role not in ("user", "assistant"):
            continue
        out.append({"role": msg.role, "content": msg.content[:MAX_USER_CHARS]})
    return out[-MAX_HISTORY:]


def _last_user_text(messages: list[ChatMessage]) -> str:
    for msg in reversed(messages):
        if msg.role == "user":
            return msg.content.strip()
    return ""


async def handle_chat(body: ChatRequest) -> ChatResponse:
    ctx = body.context or {}
    messages = _trim_messages(body.messages)
    user_query = _last_user_text(body.messages)

    if not user_query:
        return ChatResponse(reply=None, source="error", error="empty_message")

    try:
        if ctx.get("taskCoach"):
            knowledge = build_task_coach_knowledge(user_query, ctx)
            system = build_task_coach_system_prompt(ctx, knowledge)
            raw = await chat_completion(system, messages)
            reply = filter_task_coach_reply(raw)
            return ChatResponse(reply=reply, source="ollama")

        knowledge, _score = build_knowledge_block(user_query, ctx)
        system = build_assistant_system_prompt(ctx, knowledge)
        raw = await chat_completion(system, messages)
        reply = filter_assistant_reply(raw)
        return ChatResponse(reply=reply, source="ollama")
    except OllamaError as exc:
        return ChatResponse(reply=None, source="error", error=str(exc))
