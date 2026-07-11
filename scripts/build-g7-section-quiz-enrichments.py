"""Build per-question enrichments for all G7 section quiz items.

Output: src/data/g7SectionQuizEnrichments.json
Preserves / skips keys that exist in the hand-written §1 module
(ids g7-c1-s01-q01 … q08 are still written for catalog completeness,
 but runtime prefers the TS module).

Usage:
  python scripts/build-g7-section-quiz-enrichments.py
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BANK = ROOT / "src" / "data" / "g7SectionQuizBank.json"
KNOWLEDGE = ROOT / "src" / "data" / "g7TextbookKnowledge.json"
OUT = ROOT / "src" / "data" / "g7SectionQuizEnrichments.json"

PHOTO = (
    "Photorealistic educational photograph for Russian school chemistry textbook "
    "Kimyo grade 7, 16:9 landscape, bright modern classroom or school laboratory, "
    "sharp focus, soft natural lighting, no text overlay, no watermark, "
    "scientifically accurate props, no human faces unless historical portrait required"
)

PHOTO_SCHOLAR = (
    "Photorealistic historical portrait for Russian school chemistry textbook grade 7, "
    "16:9 landscape, Islamic Golden Age scholar in traditional robes, warm candlelit "
    "library laboratory, sharp focus on face, no text overlay, no watermark"
)


def clean(s: str) -> str:
    s = re.sub(r"\s+", " ", s).strip()
    return s


def shorten(s: str, n: int = 90) -> str:
    s = clean(s)
    if len(s) <= n:
        return s
    return s[:n].rsplit(" ", 1)[0] + "…"


def strip_md(s: str) -> str:
    s = re.sub(r"\*\*([^*]+)\*\*", r"\1", s)
    s = re.sub(r"`([^`]+)`", r"\1", s)
    return clean(s)


def knowledge_snippets(sec: dict, limit: int = 4) -> list[str]:
    bits: list[str] = []
    for d in sec.get("definitionsRu", [])[:3]:
        d = strip_md(d)
        if 20 <= len(d) <= 220:
            bits.append(d)
    for c in sec.get("conceptsRu", [])[:3]:
        c = strip_md(c)
        if 20 <= len(c) <= 180 and c not in bits:
            bits.append(c)
    for part in sec.get("ragParts", [])[:2]:
        for sent in re.split(r"(?<=[.!?])\s+", part):
            s = strip_md(sent)
            if 40 <= len(s) <= 180 and s not in bits:
                bits.append(s)
            if len(bits) >= limit:
                break
        if len(bits) >= limit:
            break
    remember = sec.get("rememberRu", "")
    for line in remember.split("\n"):
        line = strip_md(line.lstrip("•").strip())
        if 20 <= len(line) <= 160 and not line.startswith("Источник") and line not in bits:
            bits.append(line)
        if len(bits) >= limit:
            break
    return bits[:limit]


def is_scholar_topic(question: str, correct: str) -> bool:
    blob = (question + " " + correct).lower()
    keys = ("аль-кинди", "ар-рази", "ибн сина", "авиценн", "алхим", "рази", "кинди")
    return any(k in blob for k in keys)


def build_image_prompt(topic: str, question: str, correct: str, chapter: int) -> str:
    style = PHOTO_SCHOLAR if is_scholar_topic(question, correct) else PHOTO
    topic_short = shorten(topic, 70)
    q_short = shorten(re.sub(r"[…?]+$", "", question), 80)
    a_short = shorten(correct, 70)
    return (
        f"{style}. Chapter {chapter} topic: {topic_short}. "
        f"Question focus: {q_short}. Visualize the correct idea: {a_short}. "
        f"School-lab still life or clear educational demonstration matching the answer."
    )


def build_description(
    topic: str,
    question: str,
    correct: str,
    explanation: str,
    snippets: list[str],
) -> str:
    parts = [
        f"Вопрос по § «{topic}» (Kimyo, 7 класс).",
        f"Формулировка: {clean(question)}",
        f"Верный ответ: {clean(correct)}.",
    ]
    if explanation and clean(explanation) not in (clean(correct),):
        parts.append(clean(explanation))
    if snippets:
        parts.append("Материал параграфа (опора для ответа):")
        for i, sn in enumerate(snippets, 1):
            parts.append(f"{i}. {sn}")
    parts.append(
        "Запомните: ответ должен совпадать с формулировкой учебника. "
        "После выбора варианта проверьте себя ещё раз по тексту §."
    )
    return "\n\n".join(parts)


def build_enrichment(item: dict, sec: dict) -> dict:
    qid = item["id"]
    topic = sec.get("topicRu", "Химия 7 класс")
    ch = int(str(sec.get("chapterId", "c1")).replace("c", "") or "1")
    choices = item["choices"]
    correct = choices[item["correctIndex"]]
    explanation = item.get("explanation") or correct
    snippets = knowledge_snippets(sec)
    caption = shorten(f"{re.sub(r'[…?]+$', '', item['question'])} — {correct}", 72)
    return {
        "visualId": qid,
        "description": build_description(topic, item["question"], correct, explanation, snippets),
        "explanation": shorten(explanation, 180),
        "caption": caption,
        "alt": f"Иллюстрация к вопросу: {shorten(item['question'], 60)}",
        "imagePrompt": build_image_prompt(topic, item["question"], correct, ch),
    }


def main() -> None:
    bank = json.loads(BANK.read_text(encoding="utf-8"))
    knowledge = json.loads(KNOWLEDGE.read_text(encoding="utf-8"))
    sec_by_id = {s["id"]: s for s in knowledge["sections"]}

    out: dict[str, dict] = {}
    for sid, items in bank["sections"].items():
        sec = sec_by_id.get(sid) or {
            "id": sid,
            "topicRu": sid,
            "chapterId": sid.split("-")[1] if "-" in sid else "c1",
        }
        for item in items:
            qid = item["id"]
            out[qid] = build_enrichment(item, sec)

    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(out)} enrichments -> {OUT}")


if __name__ == "__main__":
    main()
