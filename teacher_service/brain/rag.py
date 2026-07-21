"""RAG index over g7 textbook + keyword retrieval."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any

from teacher_service.config import (
    G7_KNOWLEDGE_PATH,
    TEACHER_MEGA_PACK_PATH,
    TEXTBOOK_KNOWLEDGE_PATHS,
)

_YO_MAP = str.maketrans({"ё": "е", "Ё": "Е"})
_TOKEN_RE = re.compile(r"[a-zа-я0-9]+", re.I)


def normalize_text(text: str) -> str:
    return text.translate(_YO_MAP).lower()


def tokenize(text: str) -> list[str]:
    return _TOKEN_RE.findall(normalize_text(text))


@dataclass
class RagChunk:
    chunk_id: str
    section_key: str
    topic: str
    body_ru: str
    body_en: str
    keywords: list[str]
    norm_text: str
    kp: int
    grade_id: str
    chapter_id: str
    section_id: str


def _format_body(section: dict[str, Any], locale: str) -> str:
    topic = section["topicEn"] if locale == "en" else section["topicRu"]
    content = section["contentEn"] if locale == "en" else section["contentRu"]
    remember = section["rememberEn"] if locale == "en" else section["rememberRu"]
    page = section.get("page", "")
    if locale == "en":
        header = f"TEXTBOOK (Kimyo, grade 7, 2022) · page {page}"
        remember_label = "REMEMBER"
    else:
        header = f"УЧЕБНИК (Kimyo, 7 класс, 2022) · стр. {page}"
        remember_label = "ЗАПОМНИТЬ"
    return f"{header}\n**{topic}**\n\n{content}\n\n--- {remember_label} ---\n{remember}"


class RagIndex:
    def __init__(self) -> None:
        self.chunks: list[RagChunk] = []
        self._by_id: dict[str, RagChunk] = {}
        self._by_section: dict[str, RagChunk] = {}
        self._native_ready = False

    def load(self) -> None:
        self.chunks.clear()
        self._by_id.clear()
        self._by_section.clear()

        loaded_any = False
        for path in TEXTBOOK_KNOWLEDGE_PATHS:
            if not path.is_file():
                continue
            loaded_any = True
            data = json.loads(path.read_text(encoding="utf-8"))
            sections = data.get("sections") or []
            grade_fallback = "g7"
            if "g8" in path.name:
                grade_fallback = "g8"
            elif "g9" in path.name:
                grade_fallback = "g9"

            for section in sections:
                keywords = list(section.get("keywords") or [])
                keywords.extend(section.get("conceptsRu") or [])
                grade_id = section.get("gradeId", grade_fallback)
                keywords.extend(
                    [
                        section.get("topicRu", ""),
                        section.get("topicEn", ""),
                        f"§{section.get('kp', 0)}",
                        f"параграф {section.get('kp', 0)}",
                        section.get("chapterId", ""),
                        section.get("sectionId", ""),
                        "учебник",
                        "kimyo",
                        f"{grade_id.replace('g', '')} класс",
                    ]
                )
                kw_unique = [k for k in dict.fromkeys(k.strip() for k in keywords if k and k.strip())]
                rag_parts = section.get("ragParts") or [section.get("contentRu", "")]
                if not rag_parts:
                    rag_parts = [section.get("contentRu", "")]

                for idx, part in enumerate(rag_parts):
                    if not (part and str(part).strip()):
                        continue
                    part_id = section["id"] if len(rag_parts) == 1 else f"{section['id']}-p{idx + 1}"
                    topic_base = f"§{section.get('kp', 0)}. {section.get('topicRu', '')}"
                    topic = topic_base if len(rag_parts) == 1 else f"{topic_base} ({idx + 1}/{len(rag_parts)})"
                    section_copy = {
                        **section,
                        "contentRu": part,
                        "contentEn": part if idx else section.get("contentEn", ""),
                    }
                    body_ru = _format_body(section_copy, "ru")
                    body_en = _format_body(section_copy, "en")
                    norm_parts = " ".join(
                        [
                            section.get("topicRu", ""),
                            section.get("topicEn", ""),
                            str(part)[:2500],
                            " ".join(kw_unique),
                        ]
                    )
                    chunk = RagChunk(
                        chunk_id=part_id,
                        section_key=f"{section.get('chapterId')}-{section.get('sectionId')}",
                        topic=topic,
                        body_ru=body_ru,
                        body_en=body_en,
                        keywords=kw_unique,
                        norm_text=normalize_text(norm_parts),
                        kp=int(section.get("kp") or 0),
                        grade_id=grade_id,
                        chapter_id=section.get("chapterId", ""),
                        section_id=section.get("sectionId", ""),
                    )
                    self.chunks.append(chunk)
                    self._by_id[chunk.chunk_id] = chunk
                    if part_id == section["id"] or idx == 0:
                        self._by_section[chunk.section_key] = chunk

        if TEACHER_MEGA_PACK_PATH.is_file():
            loaded_any = True
            mega = json.loads(TEACHER_MEGA_PACK_PATH.read_text(encoding="utf-8"))
            for item in mega.get("chunks") or []:
                cid = str(item.get("id") or "").strip()
                if not cid or cid in self._by_id:
                    continue
                ru = str(item.get("ru") or "").strip()
                if len(ru) < 20:
                    continue
                en = str(item.get("en") or ru).strip()
                topic = str(item.get("topic") or cid)
                kws = [str(k) for k in (item.get("keywords") or []) if k]
                grades = item.get("grades") or []
                grade_id = f"g{grades[0]}" if grades else "g7"
                chunk = RagChunk(
                    chunk_id=cid,
                    section_key=f"mega-{cid}",
                    topic=topic,
                    body_ru=ru,
                    body_en=en,
                    keywords=kws,
                    norm_text=normalize_text(f"{topic} {ru} {' '.join(kws)}"),
                    kp=0,
                    grade_id=grade_id,
                    chapter_id="mega",
                    section_id=cid,
                )
                self.chunks.append(chunk)
                self._by_id[chunk.chunk_id] = chunk

        if not loaded_any:
            raise FileNotFoundError(f"Missing textbook knowledge: {G7_KNOWLEDGE_PATH}")

        self._native_ready = self._load_native()

    def _load_native(self) -> bool:
        try:
            from teacher_service.native.rag_bridge import load_index_into_native

            return load_index_into_native(self.chunks)
        except Exception:
            return False

    def get_section(self, chapter_id: str, section_id: str) -> RagChunk | None:
        return self._by_section.get(f"{chapter_id}-{section_id}")

    def search(
        self,
        query: str,
        *,
        k: int = 5,
        min_score: float = 1.0,
        grade_id: str | None = None,
        section_title: str | None = None,
        chapter_id: str | None = None,
        requested_kp: int | None = None,
    ) -> list[tuple[RagChunk, float]]:
        if not query.strip():
            return []

        if self._native_ready:
            try:
                from teacher_service.native.rag_bridge import native_top_k

                hits = native_top_k(query, k * 2)
                out: list[tuple[RagChunk, float]] = []
                for chunk_id, score in hits:
                    chunk = self._by_id.get(chunk_id)
                    if chunk and score >= min_score:
                        if requested_kp is not None and chunk.kp == requested_kp:
                            score += 15.0
                        if chapter_id and chunk.chapter_id == chapter_id:
                            score += 5.0
                        out.append((chunk, score))
                if out:
                    out.sort(key=lambda x: x[1], reverse=True)
                    return out[:k]
            except Exception:
                pass

        return self._python_search(
            query,
            k=k,
            min_score=min_score,
            grade_id=grade_id,
            section_title=section_title,
            chapter_id=chapter_id,
            requested_kp=requested_kp,
        )

    def _python_search(
        self,
        query: str,
        *,
        k: int,
        min_score: float,
        grade_id: str | None,
        section_title: str | None,
        chapter_id: str | None = None,
        requested_kp: int | None = None,
    ) -> list[tuple[RagChunk, float]]:
        tokens = tokenize(query)
        if not tokens:
            return []

        title_tokens = tokenize(section_title or "") if requested_kp is None else []
        scored: list[tuple[RagChunk, float]] = []

        for chunk in self.chunks:
            if grade_id and chunk.grade_id != grade_id:
                continue
            score = 0.0
            norm_kw = normalize_text(" ".join(chunk.keywords))
            for tok in tokens:
                if len(tok) < 2:
                    continue
                if tok in chunk.norm_text:
                    score += 2.0
                if tok in norm_kw:
                    score += 3.0
            for tok in title_tokens:
                if tok in chunk.norm_text or tok in norm_kw:
                    score += 1.5
            if requested_kp is not None:
                if chunk.kp == requested_kp:
                    score += 20.0
                    if chapter_id and chunk.chapter_id == chapter_id:
                        score += 10.0
            elif chapter_id and chunk.chapter_id == chapter_id:
                score += 3.0
            if score >= min_score:
                scored.append((chunk, score))

        scored.sort(key=lambda x: x[1], reverse=True)
        return scored[:k]


_INDEX: RagIndex | None = None


def get_rag_index() -> RagIndex:
    global _INDEX
    if _INDEX is None:
        _INDEX = RagIndex()
        _INDEX.load()
    return _INDEX
