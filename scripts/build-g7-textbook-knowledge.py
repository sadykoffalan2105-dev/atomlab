"""Extract Kimyo 7 (2022) textbook into structured knowledge JSON for the AI teacher."""
from __future__ import annotations

import json
import re
from pathlib import Path

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
PDF = ROOT / "public" / "textbooks" / "kimyo-7-ru-2022.pdf"
TOC = ROOT / "scripts" / "g7-toc-complete.json"
OUT = ROOT / "src" / "data" / "g7TextbookKnowledge.json"

MAX_CONTENT_CHARS = 6500


def fix_spaced_letters(text: str) -> str:
    """Fix PDF artifacts like 'Ч и с т ы е' -> 'Чистые'."""
    return re.sub(
        r"\b((?:[А-ЯA-Z]\s){2,}[А-ЯA-Zа-яa-z])\b",
        lambda m: m.group(1).replace(" ", ""),
        text,
    )


def clean_text(raw: str) -> str:
    t = raw.replace("\u00ad", "").replace("\ufeff", "")
    t = re.sub(r"(\w)-\s+(\w)", r"\1\2", t)
    t = fix_spaced_letters(t)
    t = re.sub(r"\s+", " ", t).strip()
    # drop repeated page headers
    t = re.sub(r"\b\d+\s+Глава\s+[IVX]+\.\s+\d+-тема\s+", " ", t, flags=re.I)
    t = re.sub(r"\s{2,}", " ", t).strip()
    return t


def extract_concepts(text: str) -> list[str]:
    concepts: list[str] = []
    m = re.search(
        r"Изучаемые понятия\s*(.+?)(?:\d+\.\d+\.|Практическое|Урок|Задание|Вопрос|Что |Как |§|$)",
        text,
        re.I,
    )
    if m:
        block = m.group(1)
        for part in re.split(r"[•·]\s*", block):
            part = re.sub(r"\s+", " ", part).strip(" .,-")
            if 3 <= len(part) <= 120 and not re.match(r"^\d", part):
                concepts.append(part)
    return concepts[:12]


def extract_definitions(text: str) -> list[str]:
    defs: list[str] = []
    m = re.search(
        r"Основные понятия\s*(.+?)(?:Историческ|Задани|Домаш|Ход эксп|Вывод|§|\d+\.\s+[А-ЯA-Z]|$)",
        text,
        re.I,
    )
    if not m:
        return defs
    block = m.group(1)
    for sent in re.split(r"(?<=[.!?])\s+", block):
        sent = re.sub(r"\s+", " ", sent).strip()
        if 25 <= len(sent) <= 320:
            defs.append(sent)
    return defs[:6]


def extract_conclusions(text: str) -> list[str]:
    hits: list[str] = []
    for m in re.finditer(r"Вывод[:\s—-]+(.{15,240}?)(?:\.|$)", text, re.I):
        s = m.group(1).strip()
        if s and s not in hits:
            hits.append(s)
    return hits[:4]


def build_remember_ru(title: str, concepts: list[str], text: str) -> str:
    lines: list[str] = []
    if concepts:
        lines.append("**Изучаемые понятия:** " + "; ".join(concepts[:10]) + ".")
    for d in extract_definitions(text):
        lines.append(f"• {d}")
    for c in extract_conclusions(text):
        lines.append(f"• **Вывод:** {c}.")
    if not lines:
        m = re.search(r"([А-ЯA-Z][^.!?]{40,200}[.!?])", text)
        if m:
            lines.append(f"• {m.group(1).strip()}")
    lines.append(f"• Источник: учебник Kimyo, 7 класс (2022), § «{title}».")
    return "\n".join(lines)


def build_keywords(title: str, concepts: list[str]) -> list[str]:
    kws: set[str] = set()
    for w in re.findall(r"[\wа-яА-ЯёЁ]{4,}", title.lower()):
        kws.add(w[:20])
    for c in concepts:
        for w in re.findall(r"[\wа-яА-ЯёЁ]{4,}", c.lower()):
            kws.add(w[:20])
    return sorted(kws)[:18]


def build_en_summary(title_en: str, concepts: list[str], remember_ru: str) -> str:
    concept_en = "; ".join(concepts[:6]) if concepts else title_en
    remember_en = remember_ru.replace("Изучаемые понятия", "Key terms").replace(
        "Параграф учебника", "Textbook section"
    )
    return (
        f"**{title_en}** (Kimyo Chemistry, grade 7, 2022).\n\n"
        f"Key terms: {concept_en}.\n\n"
        f"{remember_en[:600]}"
    )


def main() -> None:
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
        if len(text) > MAX_CONTENT_CHARS:
            text = text[:MAX_CONTENT_CHARS].rsplit(".", 1)[0] + "."

        concepts = extract_concepts(raw)
        remember_ru = build_remember_ru(entry["titleRu"], concepts, text)
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
                "keywords": build_keywords(entry["titleRu"], concepts),
                "contentRu": text,
                "rememberRu": remember_ru,
                "contentEn": build_en_summary(entry["titleEn"], concepts, remember_ru),
                "rememberEn": remember_ru.replace("Изучаемые понятия", "Key terms"),
            }
        )

    payload = {
        "source": "Kimyo 7 rus 2022 (Askarov et al.)",
        "totalSections": len(sections),
        "sections": sections,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(sections)} sections -> {OUT}")
    print(f"Total content chars: {sum(len(s['contentRu']) for s in sections)}")


if __name__ == "__main__":
    main()
