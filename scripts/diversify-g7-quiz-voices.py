#!/usr/bin/env python3
"""Diversify G7 quiz stems: many voices, no mono «Что такое…?», no broken templates."""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OVERRIDES = ROOT / "src" / "data" / "g7SectionQuizOverrides.json"
TOC = ROOT / "src" / "data" / "g7BookToc.json"

# Each template ends WITHOUT «?»; we append once.
DEF = [
    "Что в курсе химии 7 класса называют словом «{term}»",
    "Какое определение точнее всего описывает «{term}»",
    "Как правильно понимать термин «{term}»",
    "Выберите верную формулировку понятия «{term}»",
    "Среди ответов найдите правильный смысл «{term}»",
    "Какая характеристика относится к понятию «{term}»",
    "Отметьте точное описание для «{term}»",
    "Какой вариант верно раскрывает смысл «{term}»",
]

FACT = [
    "Какой факт по теме «{topic}» сформулирован без ошибки",
    "Что из перечисленного соответствует материалу параграфа «{topic}»",
    "Выберите утверждение, согласованное с курсом химии 7 класса",
    "Какой вывод по теме «{topic}» можно считать верным",
    "Найдите ответ, который точно отражает содержание урока",
    "Что здесь сказано химически корректно",
    "Какой вариант отражает реальное свойство или явление из параграфа",
    "Отметьте корректное утверждение по изученному материалу",
]

PROCESS = [
    "Что происходит при таком процессе: «{hint}»",
    "Какой результат типичен для «{hint}»",
    "Чем обычно сопровождается «{hint}»",
    "Какой признак верно описывает процесс «{hint}»",
    "Что следует ожидать при «{hint}»",
    "Какой ответ лучше объясняет суть процесса «{hint}»",
]

QUANT = [
    "Какое значение (число, доля или символ) указано верно",
    "Чему примерно равно искомое количество или доля",
    "Выберите правильную числовую или символьную характеристику",
    "Какой порядок величины здесь соответствует факту урока",
]

EXAMPLE = [
    "Какой пример удачно иллюстрирует тему «{topic}»",
    "Что из перечисленного можно привести как пример по уроку",
    "Отметьте корректный пример из школьного курса химии",
    "Какой вариант подходит как образец к теме «{topic}»",
]

WHY = [
    "Какое обоснование по теме «{topic}» химически корректно",
    "На каком факте держится верный вывод по теме «{topic}»",
    "Почему именно этот ответ считают правильным — выберите формулировку факта",
]

COMPARE = [
    "Что характерно именно для «{term}», а не для смежного понятия",
    "Какая формулировка точнее отделяет «{term}» от похожих идей",
    "Чем «{term}» отличается по смыслу — выберите верное описание",
]

CHOOSE = [
    "Выберите единственный верный вариант про «{term}»",
    "Какое утверждение о «{term}» является правильным",
    "Отметьте правильный ответ, связанный с «{term}»",
]

# Generic fill answers we want quieter / re-voiced as section facts when possible
FILL_ANSWERS = {
    "электронейтральная частица, состоящая из ядра и электронов",
    "мельчайшая частица вещества, сохраняющая его химические свойства",
    "вид атомов с одинаковым зарядом ядра (числом протонов)",
}


def clean(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip())


def load_toc() -> dict[str, str]:
    data = json.loads(TOC.read_text(encoding="utf-8"))
    out: dict[str, str] = {}
    for s in data:
        sid = f"g7-c{s['ch']}-s{int(s['sec']):02d}"
        out[sid] = s.get("titleRu") or sid
    return out


def short_topic(title: str) -> str:
    t = clean(title)
    for sep in (". ", "; "):
        if sep in t and len(t.split(sep)[0]) >= 12:
            t = t.split(sep)[0]
            break
    # Prefer first clause before long enumeration
    if ", " in t and len(t) > 40:
        head = t.split(",")[0].strip()
        if len(head) >= 12:
            t = head
    if len(t) > 44:
        t = t[:44].rsplit(" ", 1)[0]
    return t.rstrip(" ,;:")


def extract_term(question: str, correct: str) -> str | None:
    q = clean(question)
    patterns = [
        r"^Что такое\s+(.+)\?$",
        r"понятием «([^»]+)»",
        r"термин «([^»]+)»",
        r"описывает «([^»]+)»",
        r"для «([^»]+)»",
        r"про «([^»]+)»",
        r"о «([^»]+)»",
        r"слово[м]? «([^»]+)»",
        r"смысл[уа]? «([^»]+)»",
        r"«([^»]+)»",
    ]
    for pat in patterns:
        m = re.search(pat, q, re.I)
        if m:
            term = clean(m.group(1)).strip(" «»\"'")
            if 2 <= len(term) <= 55 and not term.endswith("?"):
                return term
    for sep in (" — ", " – ", " - "):
        if sep in correct:
            left = clean(correct.split(sep, 1)[0])
            if 2 <= len(left) <= 50 and not re.search(r"\d\s*%|kimyo|учебник", left, re.I):
                return left.strip(" «»")
    m = re.match(r"^(.{2,45}?)\s+это\s+", correct, re.I)
    if m:
        return clean(m.group(1))
    return None


def is_fill_answer(correct: str) -> bool:
    return clean(correct).lower().rstrip(".") in FILL_ANSWERS


def classify(question: str, correct: str) -> str:
    q = clean(question).lower()
    a = clean(correct).lower()
    blob = q + " " + a
    if re.search(r"\d\s*%|около\s+\d|6,02|10\s*²|\bph\b|символ\s+[a-zа-я]{1,2}\b", blob):
        return "quant"
    if re.search(r"пример|какие кислот|какой пример", q) or re.search(r"^hcl|^h₂so|^ch₃|^nacl\s*\+", a):
        return "example"
    # Process only when the question itself is about a process/result
    if re.search(
        r"происходит|выделяется|сопровожда|при взаимодей|нейтрализац|разбавлен|поддерживает|что часто",
        q,
    ) or re.search(r"→|соль и вода|выделяется|сопровождающ", a):
        return "process"
    if extract_term(question, correct) and (
        re.search(r"^что такое|определение|термин|поняти", q)
        or re.search(r"\bэто\b|—|–", a)
        or len(a) < 120
    ):
        # definition-like answers
        if re.search(r"частица|вещество|способность|вид атомов|смесь|сложное|простое", a):
            return "def"
    if extract_term(question, correct):
        return "def"
    return "fact"


def fingerprint(tpl: str) -> str:
    return " ".join(tpl.split()[:2])


def pick(pool: list[str], key: str, used: set[str]) -> str:
    h = int(hashlib.md5(key.encode("utf-8")).hexdigest(), 16)
    ordered = [pool[(h + i) % len(pool)] for i in range(len(pool))]
    for tpl in ordered:
        if fingerprint(tpl) not in used:
            return tpl
    return ordered[0]


def keep_original(q: str) -> bool:
    """Distinctive stems already creative enough."""
    return bool(
        re.match(
            r"^(Чем известен |На какие группы |Каким периодом |Как называют |Из чего |"
            r"Чего больше |Чему примерно |По какому принципу |Какие две |Какой символ |"
            r"Что часто выделяется |Что изучает |Что Ибн |Какие кислоты |Какой пример реакции |"
            r"Какие элементы называют |Что поддерживает |Что происходит |Чем сопровождается )",
            clean(q),
        )
    )


def finish(q: str) -> str:
    q = clean(q).rstrip(" ?.")
    q = q.replace("?.", "?").replace(".?", "?")
    if not q.endswith("?"):
        q += "?"
    q = re.sub(r"\?+$", "?", q)
    q = q.replace("««", "«").replace("»»", "»")
    # Mid-sentence common nouns after verbs
    q = q.replace("датируется Эпоха", "датируется эпоха")
    return q


def rewrite(question: str, correct: str, topic: str, idx: int, sid: str, used: set[str]) -> str:
    q0 = clean(question)
    topic_s = short_topic(topic)
    term = extract_term(question, correct)

    # Keep vivid originals always
    if keep_original(q0):
        used.add(fingerprint(q0))
        return finish(q0)

    kind = classify(question, correct)
    if is_fill_answer(correct):
        # Don't pretend fill pads are the lesson's main compare-item
        kind = "fact"
        term = None

    # Rotate genres — but never fight content type
    slot = ["def", "fact", "why", "choose", "compare", "fact", "def", "why"][idx % 8]
    if kind == "quant":
        slot = "quant"
    elif kind == "example":
        slot = "example" if idx % 2 == 0 else "fact"
    if kind == "process":
        slot = "process"
        # Prefer process name from term/question, not whole chapter title
        if term and len(term) < len(topic_s):
            pass
        elif re.search(r"нейтрализац|горен|разбавлен|взаимодей", q0.lower()):
            m = re.search(
                r"(реакци[яю] нейтрализации|горение|разбавлени[еюя] кислот|взаимодействи[ея][^?]{0,40})",
                q0.lower(),
            )
            if m:
                term = m.group(1)
    elif kind == "def":
        if slot not in ("def", "compare", "choose", "why", "fact"):
            slot = "def"
        if not term and slot in ("def", "compare", "choose"):
            slot = "fact"
    else:
        if slot in ("def", "compare", "choose") and not term:
            slot = "fact"
        # never process/quant/example unless content matches
        if slot in ("process", "quant", "example"):
            slot = "fact"

    pools = {
        "def": DEF,
        "fact": FACT,
        "process": PROCESS,
        "quant": QUANT,
        "example": EXAMPLE,
        "why": WHY,
        "compare": COMPARE,
        "choose": CHOOSE,
    }
    if slot in ("def", "compare", "choose") and not term:
        slot = "fact"

    pool = pools[slot]
    tpl = pick(pool, f"{sid}|{idx}|{slot}|{correct[:30]}", used)
    used.add(fingerprint(tpl))

    hint = term or topic_s
    out = tpl.format(term=term or topic_s, topic=topic_s, hint=hint)
    return finish(out)


def main() -> None:
    toc = load_toc()
    data = json.loads(OVERRIDES.read_text(encoding="utf-8"))
    out: dict[str, list] = {}
    changed = 0

    for sid, items in data.items():
        topic = toc.get(sid, sid)
        used: set[str] = set()
        seen_q: set[str] = set()
        new_items: list[dict] = []

        for idx, it in enumerate(items):
            choices = list(it.get("choices") or [])
            ci = int(it.get("correctIndex", 0))
            if not choices:
                new_items.append(it)
                continue
            if not (0 <= ci < len(choices)):
                ci = 0
            correct = choices[ci]
            old_q = it.get("question", "")
            new_q = rewrite(old_q, correct, topic, idx, sid, used)

            n = 0
            while new_q.lower() in seen_q and n < 8:
                new_q = rewrite(old_q + f"#{n}", correct, topic, (idx + n + 3) % 8, sid, used)
                n += 1
            if new_q.lower() in seen_q:
                term = extract_term(old_q, correct) or short_topic(topic)
                for alt in (
                    f"Какой ответ о «{term}» здесь правильный",
                    f"Отметьте верный факт про «{term}»",
                    f"Что из вариантов точно говорит о «{term}»",
                    f"Выберите корректную характеристику «{term}»",
                ):
                    cand = finish(alt)
                    if cand.lower() not in seen_q:
                        new_q = cand
                        break
            seen_q.add(new_q.lower())
            if new_q != clean(old_q) and new_q != finish(old_q):
                changed += 1

            wrongs = [c for i, c in enumerate(choices) if i != ci]
            while len(wrongs) < 3:
                wrongs.append("Так определяют другое понятие школьного курса химии")
            new_items.append(
                {
                    **it,
                    "question": new_q,
                    "choices": [correct, wrongs[0], wrongs[1], wrongs[2]],
                    "correctIndex": 0,
                }
            )

        out[sid] = [
            {**it, "id": f"{sid}-q{i:02d}", "templateKey": f"{sid}-q{i:02d}"}
            for i, it in enumerate(new_items[:8], 1)
        ]

    OVERRIDES.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Diversified stems changed~{changed}, sections={len(out)}")


if __name__ == "__main__":
    main()
