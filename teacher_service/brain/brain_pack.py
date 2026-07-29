from __future__ import annotations

from typing import Any

from teacher_service.brain.rag import RagChunk, get_rag_index
from teacher_service.brain.topic_parse import parse_requested_topic_number


def _section_by_kp(index, chapter_id: str | None, kp: int) -> RagChunk | None:
    matches = [c for c in index.chunks if c.kp == kp]
    if chapter_id:
        in_chapter = [c for c in matches if c.chapter_id == chapter_id]
        if in_chapter:
            return in_chapter[0]
    return matches[0] if matches else None


def build_knowledge_block(
    query: str,
    ctx: dict[str, Any],
    *,
    max_chars: int = 16000,
) -> tuple[str, float]:
    locale = ctx.get("locale") or "ru"
    speech = "en" if locale == "en" else "ru"
    index = get_rag_index()

    blocks: list[str] = []
    best_score = 0.0

    grade_id = ctx.get("gradeId")
    chapter_id = ctx.get("chapterId")
    section_id = ctx.get("sectionId")

    requested_kp = parse_requested_topic_number(query)
    requested_section: RagChunk | None = None
    if requested_kp is not None and grade_id == "g7":
        requested_section = _section_by_kp(index, chapter_id, requested_kp)

    if requested_section:
        body = requested_section.body_en if speech == "en" else requested_section.body_ru
        blocks.append(f"[§{requested_kp} по запросу ученика — главный источник]\n{body}")
        best_score = max(best_score, 20.0)
    elif grade_id == "g7" and chapter_id and section_id:
        section = index.get_section(chapter_id, section_id)
        if section:
            body = section.body_en if speech == "en" else section.body_ru
            blocks.append(f"[Текущий § учебника — главный источник]\n{body}")
            best_score = max(best_score, 10.0)

    hits = index.search(
        query,
        k=8,
        min_score=1.0,
        grade_id=grade_id if grade_id == "g7" else None,
        section_title=ctx.get("sectionTitle"),
        chapter_id=chapter_id if requested_kp is None else None,
        requested_kp=requested_kp,
    )
    for chunk, score in hits:
        best_score = max(best_score, score)
        body = chunk.body_en if speech == "en" else chunk.body_ru
        header = chunk.topic
        block = f"### {header}\n{body}"
        if block not in blocks and not any(block[:80] in b for b in blocks):
            blocks.append(block)

    combined = "\n\n---\n\n".join(blocks)
    if len(combined) > max_chars:
        combined = combined[: max_chars - 3] + "..."
    return combined, best_score


def build_task_coach_knowledge(query: str, ctx: dict[str, Any]) -> str:
    block, _ = build_knowledge_block(query, ctx, max_chars=2000)
    tc = ctx.get("taskCoach") or {}
    title = tc.get("categoryTitle") or ctx.get("sectionTitle") or ""
    if title:
        return f"Topic: {title}\n\n{block}"
    return block
