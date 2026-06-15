"""Build textbook knowledge JSON for grades 7, 8, or 9.

Usage:
  python scripts/build-textbook-knowledge-grade.py g7
  python scripts/build-textbook-knowledge-grade.py g8
  python scripts/build-textbook-knowledge-grade.py g9

Requires: pip install pypdf
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]

GRADE_CONFIG = {
    "g7": {
        "pdf": ROOT / "public" / "textbooks" / "kimyo-7-ru-2022.pdf",
        "toc": ROOT / "scripts" / "g7-toc-complete.json",
        "out": ROOT / "src" / "data" / "g7TextbookKnowledge.json",
        "source": "Kimyo 7 rus 2022 (Askarov et al.)",
        "grade_num": 7,
    },
    "g8": {
        "pdf": ROOT / "public" / "textbooks" / "kimyo-8-ru.pdf",
        "toc": ROOT / "src" / "data" / "g8BookToc.json",
        "out": ROOT / "src" / "data" / "g8TextbookKnowledge.json",
        "source": "Kimyo 8 rus (Askarov et al.)",
        "grade_num": 8,
    },
    "g9": {
        "pdf": ROOT / "public" / "textbooks" / "kimyo-9-ru.pdf",
        "toc": ROOT / "src" / "data" / "g9BookToc.json",
        "out": ROOT / "src" / "data" / "g9TextbookKnowledge.json",
        "source": "Kimyo 9 rus (Askarov et al.)",
        "grade_num": 9,
    },
}

MAX_SECTION_CHARS = 14_000
RAG_PART_TARGET = 3_200
RAG_PART_MAX = 4_500


def fix_spaced_letters(text: str) -> str:
    return re.sub(
        r"\b((?:[А-ЯA-Z]\s){2,}[А-ЯA-Zа-яa-z])\b",
        lambda m: m.group(1).replace(" ", ""),
        text,
    )


def fix_broken_words(text: str) -> str:
    return re.sub(
        r"\b(опре|соз|опреде|состав)\s+(деленным|данные|ленным|ляющ)\b",
        lambda m: m.group(1) + m.group(2),
        text,
        flags=re.I,
    )


def clean_text(raw: str) -> str:
    t = raw.replace("\u00ad", "").replace("\ufeff", "")
    t = re.sub(r"(\w)-\s+(\w)", r"\1\2", t)
    t = fix_spaced_letters(t)
    t = fix_broken_words(t)
    t = re.sub(r"\b\d+\s*Глава\s+[IVXLC]+\.?\s*\d*\s*-?\s*тема\s+", " ", t, flags=re.I)
    t = re.sub(r"(?<![.\d])\s+\d{1,3}\s+(?=[А-ЯA-Z«])", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def split_rag_parts(text: str) -> list[str]:
    if len(text) <= RAG_PART_MAX:
        return [text] if text.strip() else []
    parts: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + RAG_PART_TARGET, len(text))
        if end < len(text):
            chunk = text[start:end]
            for sep in ["\n\n", ". ", "? ", "! "]:
                idx = chunk.rfind(sep)
                if idx > RAG_PART_TARGET // 2:
                    end = start + idx + len(sep)
                    break
        part = text[start:end].strip()
        if part:
            parts.append(part)
        start = end
    return parts


def extract_concepts(text: str) -> list[str]:
    concepts: list[str] = []
    m = re.search(r"Изучаемые понятия\s*((?:•[^\n•]{2,100}\s*)+)", text, re.I)
    if not m:
        return concepts
    for part in re.split(r"•\s*", m.group(1)):
        part = re.sub(r"\s+", " ", part).strip(" .,-\n")
        if 3 <= len(part) <= 120 and not re.match(r"^\d", part):
            concepts.append(part)
    return concepts[:14]


def extract_definitions(text: str) -> list[str]:
    defs: list[str] = []
    m = re.search(
        r"Основные понятия\s*(.+?)(?:Историческ|Задани|Домаш|Ход эксп|Вывод|Практическ|§|\n\d+\.\s+[А-ЯA-Z])",
        text,
        re.I | re.S,
    )
    if not m:
        return defs
    block = re.sub(r"\s+", " ", m.group(1)).strip()
    for sent in re.split(r"(?<=[.!?])\s+", block):
        sent = sent.strip()
        if not (20 <= len(sent) <= 400):
            continue
        if re.match(r"^\d+\.", sent):
            continue
        if sent.count("?") >= 2:
            continue
        defs.append(sent)
    return defs[:8]


def extract_conclusions(text: str) -> list[str]:
    hits: list[str] = []
    for m in re.finditer(r"Вывод[:\s—-]+(.{20,220}?)(?:\.|$)", text, re.I):
        s = m.group(1).strip()
        if re.match(r"^\d+\.", s) or "?" in s[:20]:
            continue
        if s and s not in hits:
            hits.append(s)
    return hits[:4]


def build_remember_ru(title: str, concepts: list[str], definitions: list[str], conclusions: list[str], grade: int) -> str:
    lines: list[str] = []
    if concepts:
        lines.append("**Изучаемые понятия:** " + "; ".join(concepts[:12]) + ".")
    for d in definitions:
        lines.append(f"• {d}")
    for c in conclusions:
        lines.append(f"• **Вывод:** {c}.")
    if not lines:
        lines.append(f"• Параграф «{title}» — учебник Kimyo, {grade} класс.")
    lines.append(f"• Источник: Kimyo, {grade} класс, § «{title}».")
    return "\n".join(lines)


def build_keywords(title: str, concepts: list[str], definitions: list[str]) -> list[str]:
    kws: set[str] = set()
    for src in [title, *concepts]:
        for w in re.findall(r"[\wа-яА-ЯёЁ]{4,}", src.lower()):
            kws.add(w[:24])
    for d in definitions:
        for w in re.findall(r"[\wа-яА-ЯёЁ]{5,}", d.lower()):
            kws.add(w[:24])
    return sorted(kws)[:24]


def build_en_summary(title_en: str, concepts: list[str], content_ru: str, grade: int) -> str:
    concept_en = "; ".join(concepts[:8]) if concepts else title_en
    lead = ""
    for sent in re.split(r"(?<=[.!?])\s+", content_ru):
        if len(sent) >= 40 and not sent.startswith("Изучаем"):
            lead = sent[:400]
            break
    return (
        f"**{title_en}** (Kimyo Chemistry, grade {grade}).\n\n"
        f"Key terms: {concept_en}.\n\n"
        f"{lead}\n\n"
        f"See Russian textbook excerpt in the knowledge base for full detail."
    )


def main() -> None:
    grade_id = sys.argv[1] if len(sys.argv) > 1 else "g7"
    if grade_id not in GRADE_CONFIG:
        raise SystemExit(f"Unknown grade: {grade_id}. Use g7, g8, or g9.")

    cfg = GRADE_CONFIG[grade_id]
    pdf_path: Path = cfg["pdf"]
    toc_path: Path = cfg["toc"]
    out_path: Path = cfg["out"]

    if not pdf_path.is_file():
        raise SystemExit(f"PDF not found: {pdf_path}")
    if not toc_path.is_file():
        raise SystemExit(f"TOC not found: {toc_path}. Run extract-textbook-toc.py first.")

    toc = json.loads(toc_path.read_text(encoding="utf-8"))
    reader = PdfReader(str(pdf_path))
    total_pages = len(reader.pages)
    sections: list[dict] = []

    for i, entry in enumerate(toc):
        start = entry["page"] - 1
        end = (toc[i + 1]["page"] - 1) if i + 1 < len(toc) else total_pages
        end = min(end, total_pages)
        raw = "\n".join((reader.pages[p].extract_text() or "") for p in range(start, end))
        text = clean_text(raw)

        concepts = extract_concepts(raw)
        definitions = extract_definitions(raw)
        conclusions = extract_conclusions(raw)
        title_ru = entry.get("titleRu") or entry.get("title", "")
        title_en = entry.get("titleEn", title_ru)
        remember_ru = build_remember_ru(title_ru, concepts, definitions, conclusions, cfg["grade_num"])

        body = text
        if len(body) > MAX_SECTION_CHARS:
            body = body[:MAX_SECTION_CHARS].rsplit(".", 1)[0] + "."

        rag_parts = split_rag_parts(body)
        if not rag_parts and body:
            rag_parts = [body]

        chapter_id = f"c{entry['ch']}"
        sec_num = entry["sec"]
        section_id = f"s{sec_num:02d}"

        sections.append(
            {
                "id": f"{grade_id}-{chapter_id}-{section_id}",
                "gradeId": grade_id,
                "chapterId": chapter_id,
                "sectionId": section_id,
                "kp": sec_num,
                "page": entry["page"],
                "topicRu": title_ru,
                "topicEn": title_en,
                "keywords": build_keywords(title_ru, concepts, definitions),
                "conceptsRu": concepts,
                "definitionsRu": definitions,
                "contentRu": body,
                "ragParts": rag_parts,
                "rememberRu": remember_ru,
                "contentEn": build_en_summary(title_en, concepts, body, cfg["grade_num"]),
                "rememberEn": remember_ru.replace("Изучаемые понятия", "Key terms").replace("Источник", "Source"),
            }
        )

    payload = {
        "source": cfg["source"],
        "totalSections": len(sections),
        "extractedAt": __import__("datetime").date.today().isoformat(),
        "sections": sections,
    }
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    total_chars = sum(len(s["contentRu"]) for s in sections)
    total_parts = sum(len(s["ragParts"]) for s in sections)
    print(f"Wrote {len(sections)} sections -> {out_path}")
    print(f"Total contentRu chars: {total_chars:,}")
    print(f"RAG sub-parts: {total_parts}")


if __name__ == "__main__":
    main()
