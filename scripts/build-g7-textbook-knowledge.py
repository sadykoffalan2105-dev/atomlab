"""Extract Kimyo 7 (2022) textbook into structured knowledge JSON for the AI teacher.

Output: src/data/g7TextbookKnowledge.json
Run: python scripts/build-g7-textbook-knowledge.py
Requires: pip install pypdf
"""
from __future__ import annotations

import json
import re
from pathlib import Path

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
PDF = ROOT / "public" / "textbooks" / "kimyo-7-ru-2022.pdf"
TOC = ROOT / "scripts" / "g7-toc-complete.json"
OUT = ROOT / "src" / "data" / "g7TextbookKnowledge.json"

# Per-section full text cap (avoid runaway PDF bleed into next §)
MAX_SECTION_CHARS = 14_000
# Sub-chunks for RAG retrieval (paragraph-aware)
RAG_PART_TARGET = 3_200
RAG_PART_MAX = 4_500


def fix_spaced_letters(text: str) -> str:
    """Fix PDF artifacts like 'Ч и с т ы е' -> 'Чистые'."""
    return re.sub(
        r"\b((?:[А-ЯA-Z]\s){2,}[А-ЯA-Zа-яa-z])\b",
        lambda m: m.group(1).replace(" ", ""),
        text,
    )


def fix_broken_words(text: str) -> str:
    """Fix 'опре деленным' — only known PDF hyphenation gaps."""
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
    # Page headers like "8 Глава I. 1-тема"
    t = re.sub(r"\b\d+\s*Глава\s+[IVXLC]+\.?\s*\d*\s*-?\s*тема\s+", " ", t, flags=re.I)
    # Drop isolated page numbers (not list markers like "1. ")
    t = re.sub(r"(?<![.\d])\s+\d{1,3}\s+(?=[А-ЯA-Z«])", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def split_rag_parts(text: str) -> list[str]:
    """Split long § text into retrieval-sized parts at sentence boundaries."""
    if len(text) <= RAG_PART_MAX:
        return [text] if text.strip() else []

    parts: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + RAG_PART_TARGET, len(text))
        if end < len(text):
            # Prefer break at paragraph or sentence
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
        if re.match(r"^\d+\.", s):
            continue
        if "?" in s[:20]:
            continue
        if s and s not in hits:
            hits.append(s)
    return hits[:4]


def build_remember_ru(title: str, concepts: list[str], definitions: list[str], conclusions: list[str]) -> str:
    lines: list[str] = []
    if concepts:
        lines.append("**Изучаемые понятия:** " + "; ".join(concepts[:12]) + ".")
    for d in definitions:
        lines.append(f"• {d}")
    for c in conclusions:
        lines.append(f"• **Вывод:** {c}.")
    if not lines:
        lines.append(f"• Параграф «{title}» — учебник Kimyo, 7 класс (2022).")
    lines.append(f"• Источник: Kimyo, 7 класс (2022), § «{title}».")
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


def build_en_summary(title_en: str, concepts: list[str], remember_ru: str, content_ru: str) -> str:
    """English teacher summary — key terms + first substantive paragraph."""
    concept_en = "; ".join(concepts[:8]) if concepts else title_en
    lead = ""
    for sent in re.split(r"(?<=[.!?])\s+", content_ru):
        if len(sent) >= 40 and not sent.startswith("Изучаем"):
            lead = sent[:400]
            break
    return (
        f"**{title_en}** (Kimyo Chemistry, grade 7, 2022).\n\n"
        f"Key terms: {concept_en}.\n\n"
        f"{lead}\n\n"
        f"See Russian textbook excerpt in the knowledge base for full detail."
    )


def main() -> None:
    if not PDF.is_file():
        raise SystemExit(f"PDF not found: {PDF}")
    if not TOC.is_file():
        raise SystemExit(f"TOC not found: {TOC}")

    toc = json.loads(TOC.read_text(encoding="utf-8"))
    reader = PdfReader(str(PDF))
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
        remember_ru = build_remember_ru(entry["titleRu"], concepts, definitions, conclusions)

        body = text
        if len(body) > MAX_SECTION_CHARS:
            body = body[:MAX_SECTION_CHARS].rsplit(".", 1)[0] + "."

        rag_parts = split_rag_parts(body)
        if not rag_parts and body:
            rag_parts = [body]

        chapter_id = f"c{entry['ch']}"
        section_id = f"s{entry['sec']:02d}"

        sections.append(
            {
                "id": f"g7-{chapter_id}-{section_id}",
                "gradeId": "g7",
                "chapterId": chapter_id,
                "sectionId": section_id,
                "kp": entry["sec"],
                "page": entry["page"],
                "topicRu": entry["titleRu"],
                "topicEn": entry["titleEn"],
                "keywords": build_keywords(entry["titleRu"], concepts, definitions),
                "conceptsRu": concepts,
                "definitionsRu": definitions,
                "contentRu": body,
                "ragParts": rag_parts,
                "rememberRu": remember_ru,
                "contentEn": build_en_summary(entry["titleEn"], concepts, remember_ru, body),
                "rememberEn": remember_ru.replace("Изучаемые понятия", "Key terms").replace(
                    "Источник", "Source"
                ),
            }
        )

    payload = {
        "source": "Kimyo 7 rus 2022 (Askarov et al.)",
        "totalSections": len(sections),
        "extractedAt": __import__("datetime").date.today().isoformat(),
        "sections": sections,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    total_chars = sum(len(s["contentRu"]) for s in sections)
    total_parts = sum(len(s["ragParts"]) for s in sections)
    print(f"Wrote {len(sections)} sections -> {OUT}")
    print(f"Total contentRu chars: {total_chars:,}")
    print(f"RAG sub-parts: {total_parts}")


if __name__ == "__main__":
    main()
