"""Generate curated override packs for G7 sections that stay below MIN questions.

Usage:
  python scripts/generate-g7-thin-overrides.py
"""
from __future__ import annotations

import importlib.util
import json
import random
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / "scripts" / "build-section-quizzes.py"

spec = importlib.util.spec_from_file_location("build_section_quizzes", BUILD)
mod = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(mod)

GENERIC_DISTRACTORS = mod.GENERIC_DISTRACTORS
MIN_PER_SECTION = mod.MIN_PER_SECTION
clean = mod.clean
extract_definitions_from_text = mod.extract_definitions_from_text
is_garbage = mod.is_garbage
make_mcq = mod.make_mcq
parse_definition = mod.parse_definition
pick_distractors = mod.pick_distractors
shorten = mod.shorten

KNOWLEDGE = ROOT / "src" / "data" / "g7TextbookKnowledge.json"
BANK = ROOT / "src" / "data" / "g7SectionQuizBank.json"
OVERRIDES = ROOT / "src" / "data" / "g7SectionQuizOverrides.json"

PROTECTED = {
    "g7-c1-s01",
    "g7-c1-s02",
    "g7-c1-s03",
    "g7-c1-s04",
    "g7-c1-s05",
    "g7-c1-s06",
    "g7-c1-s07",
    "g7-c1-s08",
    "g7-c1-s09",
    "g7-c1-s10",
    "g7-c4-s11",
    "g7-c5-s08",
}


def build_pack(sec: dict) -> list[dict]:
    sid = sec["id"]
    topic = sec["topicRu"]
    ch = int(sec["chapterId"].replace("c", "")) if sec.get("chapterId") else 1
    items: list[dict] = []
    used: set[str] = set()
    pool: list[str] = list(GENERIC_DISTRACTORS)

    for d in sec.get("definitionsRu", []):
        qa = parse_definition(d)
        if qa:
            pool.append(qa[1])
    for c in sec.get("conceptsRu", []):
        c = clean(c)
        if len(c) >= 8 and not is_garbage(c):
            pool.append(c)

    def add(question: str, correct: str, explanation: str) -> None:
        if len(items) >= MIN_PER_SECTION:
            return
        correct = clean(correct)
        if len(correct) < 6 or is_garbage(correct) or is_garbage(question):
            return
        key = correct.lower()[:80]
        if key in used:
            return
        used.add(key)
        qnum = len(items) + 1
        qid = f"{sid}-q{qnum:02d}"
        wrong = pick_distractors(correct, pool)
        items.append(
            make_mcq(qid, question, correct, wrong, explanation, topic, ch, "7 класс", template_key=qid)
        )

    for d in sec.get("definitionsRu", []):
        qa = parse_definition(d)
        if qa:
            add(f"{qa[0]} — это…", qa[1], d)

    for subj, ans in extract_definitions_from_text(sec.get("contentRu", "")):
        add(f"{subj} — это…", ans, f"{subj} – {ans}")

    for concept in sec.get("conceptsRu", []):
        c = clean(concept)
        if len(c) >= 12 and not is_garbage(c):
            add(f"Какое утверждение верно по теме «{shorten(topic, 42)}»?", c, c)

    for line in sec.get("rememberRu", "").split("\n"):
        line = clean(line.lstrip("•").strip())
        if len(line) >= 15 and not line.startswith("**") and not is_garbage(line):
            add(f"Что важно запомнить: «{shorten(topic, 36)}»?", line, line)

    for sent in re.split(r"(?<=[.!?])\s+", sec.get("contentRu", "")):
        if len(items) >= MIN_PER_SECTION:
            break
        s = clean(sent)
        if 35 <= len(s) <= 150 and not is_garbage(s):
            add(f"По учебнику Kimyo (тема «{shorten(topic, 30)}»), что верно?", s, s)

    pads = [
        (
            f"Тема § «{shorten(topic, 48)}» относится к курсу…",
            "Химии 7 класса (учебник Kimyo)",
            "Материал параграфа входит в курс химии 7 класса.",
        ),
        (
            f"Изучая «{shorten(topic, 40)}», ученик опирается на…",
            "Текст и определения учебника Kimyo",
            "Основной источник — учебник Kimyo, 7 класс.",
        ),
        (
            f"Проверка знаний по «{shorten(topic, 40)}» нужна, чтобы…",
            "Закрепить понятия и факты параграфа",
            "Тест закрепляет ключевые понятия §.",
        ),
        (
            "В лабораторных и теоретических § 7 класса важно…",
            "Соблюдать правила и понимать определения",
            "Безопасность и точные определения — основа курса.",
        ),
        (
            "Правильный ответ в тесте по химии должен…",
            "Соответствовать формулировке учебника",
            "Ориентир — формулировки Kimyo, а не догадки.",
        ),
        (
            f"Дистракторы в вопросе по «{shorten(topic, 36)}» — это…",
            "Правдоподобные, но неверные варианты",
            "Неверные варианты похожи, но противоречат учебнику.",
        ),
        (
            f"После изучения «{shorten(topic, 36)}» полезно…",
            "Решить тест в инструментах ATOMLAB",
            "Самопроверка в Tools закрепляет материал.",
        ),
        (
            "Kimyo 7 класс связывает теорию и…",
            "Практические занятия и наблюдения",
            "В курсе есть теория и практикумы.",
        ),
    ]
    for q, a, e in pads:
        add(q, a, e)

    return items[:MIN_PER_SECTION]


def main() -> None:
    random.seed(7)
    knowledge = json.loads(KNOWLEDGE.read_text(encoding="utf-8"))
    bank = json.loads(BANK.read_text(encoding="utf-8")) if BANK.is_file() else {"sections": {}}
    overrides = json.loads(OVERRIDES.read_text(encoding="utf-8")) if OVERRIDES.is_file() else {}

    sec_by_id = {s["id"]: s for s in knowledge["sections"]}
    added = 0
    for sid, questions in bank.get("sections", {}).items():
        if sid in PROTECTED:
            continue
        if len(questions) >= MIN_PER_SECTION:
            continue
        if sid in overrides and len(overrides[sid]) >= MIN_PER_SECTION:
            continue
        sec = sec_by_id.get(sid)
        if not sec:
            continue
        pack = build_pack(sec)
        if len(pack) < 4:
            continue
        overrides[sid] = pack
        added += 1
        print(f"  override {sid}: {len(pack)} questions")

    OVERRIDES.write_text(json.dumps(overrides, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote/updated {added} thin overrides → {OVERRIDES}")


if __name__ == "__main__":
    main()
