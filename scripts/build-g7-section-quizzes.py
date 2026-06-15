"""Build section-specific quiz bank from Kimyo 7 textbook knowledge JSON.

Strictly uses definitions, facts, and rules from each § — no invented chapter templates.
Output: src/data/g7SectionQuizBank.json

Run: python scripts/build-g7-section-quizzes.py
"""
from __future__ import annotations

import json
import random
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KNOWLEDGE = ROOT / "src" / "data" / "g7TextbookKnowledge.json"
OUT = ROOT / "src" / "data" / "g7SectionQuizBank.json"
OVERRIDES = ROOT / "src" / "data" / "g7SectionQuizOverrides.json"

MIN_PER_SECTION = 8
MAX_PER_SECTION = 12

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
    """Numbered lab-safety / procedure rules from §."""
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
            # Turn into "По учебнику: ..." completion
            words = s.split()
            if len(words) > 6:
                q = " ".join(words[:4]) + "… (продолжите по учебнику)"
                facts.append((q, s))
    return facts[:6]


def chapter_pool(sections: list[dict], chapter_id: str, exclude_sid: str) -> list[str]:
    pool: list[str] = []
    for sec in sections:
        if sec["chapterId"] != chapter_id or sec["id"] == exclude_sid:
            continue
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
    for p in pool:
        p = shorten(p, 100)
        if p not in seen and len(p) >= 8:
            seen.add(p)
            uniq.append(p)
    return uniq


def pick_distractors(correct: str, pool: list[str], n: int = 3) -> list[str]:
    wrong = [d for d in pool if d != correct]
    random.shuffle(wrong)
    picks = wrong[:n]
    fallbacks = [
        "Утверждение не соответствует учебнику",
        "В § этого не сказано",
        "Это относится к другому параграфу",
    ]
    fi = 0
    while len(picks) < n:
        fb = fallbacks[fi % len(fallbacks)]
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
) -> dict:
    correct = shorten(correct, 110)
    wrong = [shorten(d, 110) for d in distractors if shorten(d, 110) != correct][:3]
    while len(wrong) < 3:
        wrong.append("Утверждение не соответствует учебнику")
    q = question if question.endswith("?") or question.endswith("…") else question + "…"
    return {
        "id": qid,
        "templateKey": qid,
        "question": q,
        "choices": [correct, wrong[0], wrong[1], wrong[2]],
        "correctIndex": 0,
        "explanation": shorten(explanation, 200),
        "description": f"§ «{topic_ru}» (Kimyo, 7 класс). {shorten(explanation, 400)}",
        "visualId": f"c{visual_ch}-t01",
    }


def build_review_lesson_questions(sec: dict, all_sections: list[dict]) -> list[dict]:
    """Урок закрепления — вопросы из всех § той же главы."""
    ch = sec["chapterId"]
    sid = sec["id"]
    topic = sec["topicRu"]
    ch_num = int(ch.replace("c", "")) if ch else 1
    pool = chapter_pool(all_sections, ch, sid)
    items: list[dict] = []
    used: set[str] = set()

    chapter_secs = [s for s in all_sections if s["chapterId"] == ch and s["id"] != sid]

    def add(q: str, a: str, expl: str) -> None:
        if len(items) >= MAX_PER_SECTION or a in used:
            return
        used.add(a)
        qnum = len(items) + 1
        qid = f"{sid}-q{qnum:02d}"
        wrong = pick_distractors(a, pool)
        items.append(make_mcq(qid, q, a, wrong, expl, topic, ch_num))

    for prev in chapter_secs:
        for d in prev.get("definitionsRu", []):
            qa = parse_definition(d)
            if qa:
                add(f"По главе {ch_num} (закрепление): {qa[0]} — это…", qa[1], d)
        for subj, ans in extract_definitions_from_text(prev.get("contentRu", "")):
            add(f"Закрепление § «{shorten(prev['topicRu'], 30)}»: {subj} — это…", ans, f"{subj} – {ans}")

    return items


def build_section_questions(sec: dict, all_sections: list[dict]) -> list[dict]:
    sid = sec["id"]
    topic = sec["topicRu"]
    ch = int(sec["chapterId"].replace("c", "")) if sec.get("chapterId") else 1
    pool = chapter_pool(all_sections, sec["chapterId"], sid)
    items: list[dict] = []
    used_correct: set[str] = set()
    used_questions: set[str] = set()

    def add_item(question: str, correct: str, explanation: str) -> None:
        if len(items) >= MAX_PER_SECTION:
            return
        correct = clean(correct)
        qkey = question.lower()[:60]
        if correct in used_correct or len(correct) < 4 or qkey in used_questions:
            return
        if is_garbage(correct):
            return
        used_correct.add(correct)
        used_questions.add(qkey)
        qnum = len(items) + 1
        qid = f"{sid}-q{qnum:02d}"
        wrong = pick_distractors(correct, pool)
        items.append(make_mcq(qid, question, correct, wrong, explanation, topic, ch))

    content = sec.get("contentRu", "")

    # 1) definitionsRu
    for d in sec.get("definitionsRu", []):
        qa = parse_definition(d)
        if qa:
            subj, ans = qa
            add_item(f"По учебнику: {subj} — это…", ans, d)

    # 2) rememberRu bullets
    remember = sec.get("rememberRu", "")
    for line in remember.split("\n"):
        line = line.strip().lstrip("•").strip()
        if line.startswith("**") or line.startswith("Источник"):
            continue
        qa = parse_definition(line)
        if qa:
            add_item(f"{qa[0]} — это…", qa[1], line)

    # 3) definitions embedded in content
    for subj, ans in extract_definitions_from_text(content):
        add_item(f"По § «{shorten(topic, 40)}»: {subj} — это…", ans, f"{subj} – {ans}")

    # 4) numbered safety / procedure rules (practical §)
    if "практическ" in topic.lower() or "правил" in content.lower():
        for q, ans in extract_numbered_rules(content):
            add_item(q, ans, ans)

    # 5) key facts
    for subj, ans in extract_fact_sentences(content):
        add_item(f"По учебнику: {subj} — это…", ans, f"{subj} – {ans}")

    # 6) equipment / usage patterns
    for m in re.finditer(
        r"([А-ЯЁ][а-яё]+(?:\s+[а-яё]+){0,3})\s+(?:используется|используют|предназначен[аы]?|применяют)\s+([^.\n]{10,120}\.)",
        content,
    ):
        name, usage = clean(m.group(1)), clean(m.group(2)).rstrip(".")
        if not is_garbage(name):
            add_item(f"Для чего по учебнику используется {name.lower()}?", usage, f"{name}: {usage}")

    # 7) урок закрепления — добор из § главы
    if "закреплен" in topic.lower() and len(items) < MIN_PER_SECTION:
        for ri in build_review_lesson_questions(sec, all_sections):
            if len(items) >= MAX_PER_SECTION:
                break
            correct = clean(ri["choices"][0])
            if correct in used_correct:
                continue
            used_correct.add(correct)
            qnum = len(items) + 1
            ri = {**ri, "id": f"{sid}-q{qnum:02d}", "templateKey": f"{sid}-q{qnum:02d}"}
            items.append(ri)

    return items[:MAX_PER_SECTION]


def main() -> None:
    random.seed(42)
    data = json.loads(KNOWLEDGE.read_text(encoding="utf-8"))
    sections = data["sections"]
    bank: dict[str, list[dict]] = {}
    stats = {"sections": 0, "questions": 0, "low": []}

    for sec in sections:
        sid = sec["id"]
        items = build_section_questions(sec, sections)
        if len(items) < 4:
            stats["low"].append(sid)
        bank[sid] = items
        stats["sections"] += 1
        stats["questions"] += len(items)

    if OVERRIDES.is_file():
        overrides = json.loads(OVERRIDES.read_text(encoding="utf-8"))
        for sid, items in overrides.items():
            bank[sid] = items
        print(f"Applied overrides for {len(overrides)} sections")

    total_q = sum(len(v) for v in bank.values())
    payload = {
        "source": data.get("source", "Kimyo 7"),
        "generatedFrom": "g7TextbookKnowledge.json",
        "totalSections": stats["sections"],
        "totalQuestions": total_q,
        "sections": bank,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {total_q} questions for {stats['sections']} sections -> {OUT}")
    if stats["low"]:
        print(f"Low question count ({len(stats['low'])}): {', '.join(stats['low'])}")


if __name__ == "__main__":
    main()
