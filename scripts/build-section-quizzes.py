"""Build section-specific quiz banks from textbook knowledge (grades 7–9).

Usage:
  python scripts/build-section-quizzes.py g7
  python scripts/build-section-quizzes.py g8
  python scripts/build-section-quizzes.py g9
  python scripts/build-section-quizzes.py all

Output: src/data/{grade}SectionQuizBank.json
"""
from __future__ import annotations

import argparse
import json
import random
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

MIN_PER_SECTION = 8
MAX_PER_SECTION = 12

GRADE_CONFIG = {
    "g7": {
        "knowledge": ROOT / "src" / "data" / "g7TextbookKnowledge.json",
        "out": ROOT / "src" / "data" / "g7SectionQuizBank.json",
        "overrides": ROOT / "src" / "data" / "g7SectionQuizOverrides.json",
        "grade_label": "7 класс",
    },
    "g8": {
        "knowledge": ROOT / "src" / "data" / "g8TextbookKnowledge.json",
        "out": ROOT / "src" / "data" / "g8SectionQuizBank.json",
        "overrides": None,
        "grade_label": "8 класс",
    },
    "g9": {
        "knowledge": ROOT / "src" / "data" / "g9TextbookKnowledge.json",
        "out": ROOT / "src" / "data" / "g9SectionQuizBank.json",
        "overrides": None,
        "grade_label": "9 класс",
    },
}

TEMPLATES = ROOT / "scripts" / "g8g9-quiz-templates.json"
G7_TEMPLATES = ROOT / "scripts" / "g7-quiz-templates.json"

GARBAGE_PATTERNS = [
    r"какая информация вам",
    r"источник:",
    r"задания$",
    r"домашнее задание",
    r"необходимые оборудован",
    r"ход работы",
    r"рис\.",
    r"www\.",
    r"персидские растворители",
    r"египетские стеклодувы",
    r"^\?\s*$",
    r"исследовательская работа",
    r"мысли вслух",
    r"вспомните",
    r"^мысли",
    r"продолжите по учебнику",
    r"фармонов",
    r"хотя яблоко не",
    r"позволило создать выс",
    r"в результате было создано определ",
    r"если какое\s*—\s*это",
    r"урок закрепления.+\?\s*$",
]

GENERIC_DISTRACTORS = [
    "Это утверждение относится к другому параграфу учебника",
    "В данном § такой информации нет",
    "Так описывается другое явление или вещество",
    "Это неверная формулировка по учебнику",
    "Так можно сказать только о другом классе соединений",
]


def clean(s: str) -> str:
    s = re.sub(r"(\w)-\s+(\w)", r"\1\2", s)
    s = re.sub(r"\s+", " ", s).strip()
    s = s.replace(" - ", " – ")
    s = re.sub(r"^это\s+", "", s, flags=re.I)
    return s


def shorten(s: str, max_len: int = 110) -> str:
    s = clean(s)
    if len(s) <= max_len:
        return s
    cut = s[:max_len].rsplit(" ", 1)[0]
    return cut + "…"


def norm_key(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower().strip())[:72]


def is_garbage(text: str) -> bool:
    t = text.lower()
    if len(t) < 8:
        return True
    return any(re.search(p, t) for p in GARBAGE_PATTERNS)


def parse_definition(defn: str) -> tuple[str, str] | None:
    d = clean(defn)
    if is_garbage(d):
        return None
    for sep in [" – ", " — ", " - ", " это ", " являются ", " является ", " называют ", " называется "]:
        if sep not in d:
            continue
        parts = d.split(sep, 1)
        if len(parts) != 2:
            continue
        left, right = clean(parts[0]), clean(parts[1]).rstrip(".")
        if left.endswith("?"):
            continue
        if 3 <= len(left) <= 70 and 6 <= len(right) <= 200:
            return left, right
    return None


def extract_definitions_from_text(text: str) -> list[tuple[str, str]]:
    found: list[tuple[str, str]] = []
    seen: set[str] = set()
    for m in re.finditer(
        r"([А-ЯЁA-Z«][А-ЯЁа-яёA-Za-z«»\-\s]{2,60}?)\s*(?:–|—|-)\s*(?:это\s+)?([А-ЯЁа-яё][^.\n]{5,180}\.)",
        text,
    ):
        subj = clean(m.group(1))
        ans = clean(m.group(2)).rstrip(".")
        if is_garbage(subj) or is_garbage(ans):
            continue
        key = subj.lower()
        if key in seen:
            continue
        seen.add(key)
        found.append((subj, ans))
    return found[:12]


def extract_numbered_rules(text: str) -> list[tuple[str, str]]:
    rules: list[tuple[str, str]] = []
    for m in re.finditer(r"(?<!\d)(\d{1,2})\.\s+([А-ЯЁ][^.\n]{20,220}\.)", text):
        num, body = m.group(1), clean(m.group(2))
        if re.search(r"(задани|домашн|рис\.|www\.)", body, re.I):
            continue
        q = f"По правилам §: что верно о пункте {num}?"
        rules.append((q, body))
    return rules[:8]


def extract_fact_sentences(text: str) -> list[tuple[str, str]]:
    facts: list[tuple[str, str]] = []
    for sent in re.split(r"(?<=[.!?])\s+", text):
        s = clean(sent)
        if len(s) < 30 or len(s) > 200 or is_garbage(s):
            continue
        qa = parse_definition(s)
        if qa:
            facts.append(qa)
            continue
        if re.search(r"\b(впервые|известен|состоит из|используется для|предназначен|делятся на|примерами)\b", s, re.I):
            words = s.split()
            if len(words) > 6:
                q = " ".join(words[:4]) + "… (продолжите по учебнику)"
                facts.append((q, s))
    return facts[:6]


def section_pool(sections: list[dict], chapter_id: str, sid: str) -> list[str]:
    """Distractor pool — только из текущего § (без «утечки» тем соседних параграфов)."""
    pool: list[str] = []
    sec = next((s for s in sections if s["id"] == sid), None)
    if not sec:
        return GENERIC_DISTRACTORS[:]
    for d in sec.get("definitionsRu", []):
        qa = parse_definition(d)
        if qa:
            pool.append(qa[1])
    for c in sec.get("conceptsRu", []):
        c = clean(c)
        if not is_garbage(c) and len(c) >= 6:
            pool.append(c)
    for subj, ans in extract_definitions_from_text(sec.get("contentRu", "")):
        pool.append(ans)
    uniq: list[str] = []
    seen: set[str] = set()
    for p in pool + GENERIC_DISTRACTORS:
        p = shorten(p, 100)
        if p not in seen and len(p) >= 8:
            seen.add(p)
            uniq.append(p)
    return uniq


def balance_distractor_length(correct: str, distractor: str) -> str:
    d = shorten(distractor, 110)
    target = len(correct)
    if abs(len(d) - target) <= 18:
        return d
    if len(d) < target - 10:
        suffix = " (по учебнику)"
        while len(d) + len(suffix) <= 110 and len(d) < target - 6:
            d += suffix
            suffix = " — неверно"
    return shorten(d, 110)


def pick_distractors(correct: str, pool: list[str], n: int = 3) -> list[str]:
    wrong = [d for d in pool if d != correct and shorten(d, 110) != correct]
    wrong.sort(key=lambda d: abs(len(shorten(d, 110)) - len(correct)))
    random.shuffle(wrong[len(wrong) // 2 :])  # partial shuffle among similar-length
    picks: list[str] = []
    for d in wrong:
        bd = balance_distractor_length(correct, d)
        if bd not in picks and bd != correct:
            picks.append(bd)
        if len(picks) >= n:
            break
    fi = 0
    while len(picks) < n:
        fb = balance_distractor_length(correct, GENERIC_DISTRACTORS[fi % len(GENERIC_DISTRACTORS)])
        if fb not in picks and fb != correct:
            picks.append(fb)
        fi += 1
    return picks[:n]


def make_mcq(
    qid: str,
    question: str,
    correct: str,
    distractors: list[str],
    explanation: str,
    topic_ru: str,
    visual_ch: int,
    grade_label: str,
    template_key: str | None = None,
) -> dict:
    correct = shorten(correct, 110)
    wrong = [balance_distractor_length(correct, d) for d in distractors if shorten(d, 110) != correct][:3]
    while len(wrong) < 3:
        wrong.append(balance_distractor_length(correct, GENERIC_DISTRACTORS[len(wrong)]))
    q = question if question.endswith("?") or question.endswith("…") else question + "?"
    choices = [correct, wrong[0], wrong[1], wrong[2]]
    random.shuffle(choices)
    correct_index = choices.index(correct)
    return {
        "id": qid,
        "templateKey": template_key or qid,
        "question": q,
        "choices": choices,
        "correctIndex": correct_index,
        "explanation": shorten(explanation, 200),
        "description": f"§ «{topic_ru}» (Kimyo, {grade_label}). {shorten(explanation, 400)}",
        "visualId": qid if str(qid).startswith("g7-") or str(qid).startswith("g8-") or str(qid).startswith("g9-") else f"c{visual_ch}-t01",
    }


def supplement_from_templates(
    grade_id: str,
    sec: dict,
    items: list[dict],
    global_questions: set[str],
    chapter_templates: dict,
    grade_label: str,
) -> None:
    if grade_id not in ("g7", "g8", "g9"):
        return
    ch = int(sec["chapterId"].replace("c", "")) if sec.get("chapterId") else 1
    sec_n = int(sec.get("sectionId", "s01").replace("s", "")) if sec.get("sectionId") else 1
    templates = chapter_templates.get(str(ch), [])
    if not templates:
        return
    topic = sec["topicRu"]
    sid = sec["id"]

    needed = max(0, MIN_PER_SECTION - len(items))
    if needed == 0:
        return

    start = (sec_n - 1) * 2
    for k in range(min(needed + 4, max(len(templates) * 2, needed + 1))):
        if len(items) >= MIN_PER_SECTION:
            break
        t = templates[(start + k) % len(templates)]
        qtext = t["question"]
        correct = t["correct"]
        qkey = norm_key(f"{sid}:{qtext}")
        if qkey in global_questions:
            continue
        if is_garbage(qtext) or is_garbage(correct):
            continue
        global_questions.add(qkey)
        qnum = len(items) + 1
        qid = f"{sid}-q{qnum:02d}"
        wrong_pool = list(t.get("wrong") or []) + GENERIC_DISTRACTORS
        wrong = pick_distractors(correct, wrong_pool)
        items.append(
            make_mcq(
                qid,
                f"По теме §: {qtext}",
                correct,
                wrong,
                t.get("explanation") or correct,
                topic,
                ch,
                grade_label,
                template_key=qid,
            )
        )


def fill_minimum_section(
    grade_id: str,
    sec: dict,
    items: list[dict],
    global_questions: set[str],
    grade_label: str,
) -> None:
    """Добор качественных вопросов из conceptsRu / rememberRu / contentRu, если § бедный."""
    if len(items) >= MIN_PER_SECTION:
        return
    sid = sec["id"]
    topic = sec["topicRu"]
    ch = int(sec["chapterId"].replace("c", "")) if sec.get("chapterId") else 1
    used_correct = {clean(it["choices"][it["correctIndex"]]) for it in items}
    pool = section_pool([sec], sec.get("chapterId", "c1"), sid)

    def try_add(question: str, correct: str, explanation: str) -> None:
        if len(items) >= MIN_PER_SECTION:
            return
        correct = clean(correct)
        qkey = norm_key(f"{sid}:{question}")
        if len(correct) < 6 or correct in used_correct or qkey in global_questions or is_garbage(correct):
            return
        if is_garbage(question):
            return
        used_correct.add(correct)
        global_questions.add(qkey)
        qnum = len(items) + 1
        qid = f"{sid}-q{qnum:02d}"
        wrong = pick_distractors(correct, pool if pool else GENERIC_DISTRACTORS)
        items.append(make_mcq(qid, question, correct, wrong, explanation, topic, ch, grade_label, template_key=qid))

    for concept in sec.get("conceptsRu", []):
        c = clean(concept)
        if len(c) >= 12 and not is_garbage(c):
            try_add(f"Какое утверждение верно по теме «{shorten(topic, 40)}»?", c, c)

    for d in sec.get("definitionsRu", []):
        qa = parse_definition(d)
        if qa:
            try_add(f"{qa[0]} — это…", qa[1], d)

    for subj, ans in extract_definitions_from_text(sec.get("contentRu", "")):
        try_add(f"{subj} — это…", ans, f"{subj} – {ans}")

    for part in sec.get("ragParts", []):
        for sent in re.split(r"(?<=[.!?])\s+", part):
            s = clean(sent)
            if 25 <= len(s) <= 180 and not is_garbage(s):
                words = s.split()
                if len(words) >= 5:
                    lead = " ".join(words[:5])
                    try_add(f"{lead}… — что верно?", s, s)

    remember = sec.get("rememberRu", "")
    for line in remember.split("\n"):
        line = clean(line.lstrip("•").strip())
        if len(line) >= 15 and not line.startswith("**") and not is_garbage(line):
            try_add(f"Что важно запомнить по теме «{shorten(topic, 36)}»?", line, line)

    # Последний добор: короткие факты из content
    for sent in re.split(r"(?<=[.!?])\s+", sec.get("contentRu", "")):
        if len(items) >= MIN_PER_SECTION:
            break
        s = clean(sent)
        if 40 <= len(s) <= 160 and not is_garbage(s) and re.search(r"[а-яё]{4,}", s, re.I):
            try_add(f"По учебнику Kimyo (7 класс), что верно о теме «{shorten(topic, 28)}»?", s, s)


def build_section_questions(
    grade_id: str,
    sec: dict,
    all_sections: list[dict],
    global_questions: set[str],
    chapter_templates: dict,
) -> list[dict]:
    sid = sec["id"]
    topic = sec["topicRu"]
    ch = int(sec["chapterId"].replace("c", "")) if sec.get("chapterId") else 1
    pool = section_pool(all_sections, sec["chapterId"], sid)
    items: list[dict] = []
    grade_label = GRADE_CONFIG[grade_id]["grade_label"]
    used_correct: set[str] = set()

    def add_item(question: str, correct: str, explanation: str, template_key: str | None = None) -> None:
        if len(items) >= MAX_PER_SECTION:
            return
        correct = clean(correct)
        qkey = norm_key(question)
        if correct in used_correct or len(correct) < 4 or qkey in global_questions:
            return
        if is_garbage(correct):
            return
        used_correct.add(correct)
        global_questions.add(qkey)
        qnum = len(items) + 1
        qid = f"{sid}-q{qnum:02d}"
        wrong = pick_distractors(correct, pool)
        items.append(
            make_mcq(qid, question, correct, wrong, explanation, topic, ch, grade_label, template_key)
        )

    content = sec.get("contentRu", "")

    for d in sec.get("definitionsRu", []):
        qa = parse_definition(d)
        if qa:
            subj, ans = qa
            add_item(f"По учебнику: {subj} — это…", ans, d)

    remember = sec.get("rememberRu", "")
    for line in remember.split("\n"):
        line = line.strip().lstrip("•").strip()
        if line.startswith("**") or line.startswith("Источник"):
            continue
        qa = parse_definition(line)
        if qa:
            add_item(f"{qa[0]} — это…", qa[1], line)

    for subj, ans in extract_definitions_from_text(content):
        add_item(f"По § «{shorten(topic, 40)}»: {subj} — это…", ans, f"{subj} – {ans}")

    if "практическ" in topic.lower() or "правил" in content.lower():
        for q, ans in extract_numbered_rules(content):
            add_item(q, ans, ans)

    for subj, ans in extract_fact_sentences(content):
        add_item(f"По учебнику: {subj} — это…", ans, f"{subj} – {ans}")

    for m in re.finditer(
        r"([А-ЯЁ][а-яё]+(?:\s+[а-яё]+){0,3})\s+(?:используется|используют|предназначен[аы]?|применяют)\s+([^.\n]{10,120}\.)",
        content,
    ):
        name, usage = clean(m.group(1)), clean(m.group(2)).rstrip(".")
        if not is_garbage(name):
            add_item(f"Для чего по учебнику используется {name.lower()}?", usage, f"{name}: {usage}")

    if len(items) < MIN_PER_SECTION:
        supplement_from_templates(grade_id, sec, items, global_questions, chapter_templates, grade_label)

    if len(items) < MIN_PER_SECTION:
        fill_minimum_section(grade_id, sec, items, global_questions, grade_label)

    return items[:MAX_PER_SECTION]


def build_grade(grade_id: str) -> None:
    cfg = GRADE_CONFIG[grade_id]
    data = json.loads(cfg["knowledge"].read_text(encoding="utf-8"))
    sections = data["sections"]
    chapter_templates: dict = {}
    if grade_id == "g7" and G7_TEMPLATES.is_file():
        chapter_templates = json.loads(G7_TEMPLATES.read_text(encoding="utf-8"))
    elif grade_id in ("g8", "g9") and TEMPLATES.is_file():
        all_tpl = json.loads(TEMPLATES.read_text(encoding="utf-8"))
        chapter_templates = all_tpl.get(grade_id, {})

    global_questions: set[str] = set()
    bank: dict[str, list[dict]] = {}
    stats = {"sections": 0, "questions": 0, "low": []}

    for sec in sections:
        sid = sec["id"]
        items = build_section_questions(
            grade_id, sec, sections, global_questions, chapter_templates
        )
        items = [
            it
            for it in items
            if not is_garbage(it["question"])
            and not is_garbage(it["choices"][it["correctIndex"]])
        ]
        if len(items) < MIN_PER_SECTION:
            fill_minimum_section(grade_id, sec, items, global_questions, cfg["grade_label"])
        if len(items) < 4:
            stats["low"].append(sid)
        bank[sid] = items
        stats["sections"] += 1
        stats["questions"] += len(items)

    overrides_path = cfg.get("overrides")
    if overrides_path and overrides_path.is_file():
        overrides = json.loads(overrides_path.read_text(encoding="utf-8"))
        for sid, items in overrides.items():
            bank[sid] = items
        print(f"[{grade_id}] Applied overrides for {len(overrides)} sections")

    total_q = sum(len(v) for v in bank.values())
    payload = {
        "source": data.get("source", f"Kimyo {grade_id}"),
        "generatedFrom": cfg["knowledge"].name,
        "totalSections": stats["sections"],
        "totalQuestions": total_q,
        "sections": bank,
    }
    cfg["out"].write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[{grade_id}] Wrote {total_q} questions / {stats['sections']} sections -> {cfg['out']}")
    if stats["low"]:
        print(f"[{grade_id}] Low count ({len(stats['low'])}): {', '.join(stats['low'][:12])}")


def main() -> None:
    random.seed(42)
    parser = argparse.ArgumentParser()
    parser.add_argument("grade", nargs="?", default="g7", choices=["g7", "g8", "g9", "all"])
    args = parser.parse_args()
    grades = ["g7", "g8", "g9"] if args.grade == "all" else [args.grade]
    for g in grades:
        build_grade(g)


if __name__ == "__main__":
    main()
