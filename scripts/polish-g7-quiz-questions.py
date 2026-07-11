#!/usr/bin/env python3
"""Polish all G7 section quiz questions: full, clear, literate stems (no «…»).

Rewrites g7SectionQuizOverrides.json in place, then you should run:
  python scripts/build-section-quizzes.py
  python scripts/build-g7-section-quiz-enrichments.py

Usage:
  python scripts/polish-g7-quiz-questions.py
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OVERRIDES = ROOT / "src" / "data" / "g7SectionQuizOverrides.json"
TOC = ROOT / "src" / "data" / "g7BookToc.json"

GENERIC_WRONG = (
    "Это относится к другому параграфу учебника",
    "Так в школьном курсе не формулируют",
    "Утверждение противоречит определению",
    "Верно только для другого класса веществ",
    "Случайные интернет-мемы",
    "Только рекламные ролики",
    "Непроверенные слухи",
    "Только красивые картинки без смысла",
    "Случайный набор букв",
    "Противоречие учебнику",
    "Забыть весь материал",
    "Заменить учебник фильмом",
    "Избежать любых определений",
    "Только астрономии без химии",
    "Только литературы",
    "Только черчения",
)

META_PADS = (
    "относится к курсу",
    "главный источник фактов",
    "проверка знаний по",
    "в ответах по теме",
    "что важно запомнить по теме",
    "по учебнику kimyo, что верно",
    "химии 7 класса по учебнику",
    "учебник kimyo, 7 класс",
    "закрепить определения и факты параграфа",
    "научные формулировки школьного курса химии",
)


def clean(s: str) -> str:
    s = re.sub(r"\s+", " ", (s or "").strip())
    s = s.replace(" - ", " – ")
    s = s.replace("…", "…")  # normalize
    return s


def strip_ellipsis(s: str) -> str:
    s = clean(s)
    while s.endswith("…") or s.endswith("..."):
        s = s[:-1].rstrip(".").rstrip()
    return s.rstrip(".,;:")


def topic_title(sid: str, toc: dict[str, str]) -> str:
    return toc.get(sid, sid)


def load_toc() -> dict[str, str]:
    if not TOC.is_file():
        return {}
    data = json.loads(TOC.read_text(encoding="utf-8"))
    out: dict[str, str] = {}
    if isinstance(data, list):
        for s in data:
            if not isinstance(s, dict):
                continue
            ch = s.get("ch")
            sec = s.get("sec")
            if ch is None or sec is None:
                continue
            sid = f"g7-c{ch}-s{int(sec):02d}"
            out[sid] = s.get("titleRu") or s.get("titleEn") or sid
        return out
    sections = data.get("sections") or data
    if isinstance(sections, list):
        for s in sections:
            if isinstance(s, dict) and "id" in s:
                out[s["id"]] = s.get("titleRu") or s.get("title") or s["id"]
    elif isinstance(sections, dict):
        for sid, s in sections.items():
            if isinstance(s, dict):
                out[sid] = s.get("titleRu") or s.get("title") or sid
            elif isinstance(s, str):
                out[sid] = s
    return out


def is_generic_wrong(text: str) -> bool:
    t = clean(text).lower()
    return any(g.lower() in t for g in GENERIC_WRONG) or any(p in t for p in META_PADS)


def is_meta_question(q: str) -> bool:
    t = strip_ellipsis(q).lower()
    return any(p in t for p in META_PADS) or t.startswith("параграф «")


_VERB_END = re.compile(
    r"(?:изучает|называют|называется|состоит|состоят|образует|образуют|равен|равна|"
    r"относят|является|являются|дают|даёт|выделяется|содержит|включает|датируется|"
    r"известен|известна|разделил|разделила|считал|считала|выполняет|выполняют|"
    r"определяет|характеризует|показывает|сопровождается|происходит|получают|"
    r"применяют|используют|имеет|имеют|нужен|нужна|нужны|служат|служит|"
    r"поддерживает|запрещается|нужно|следует|можно|нельзя|примерно|около)$",
    re.I,
)


def has_finite_verb(text: str) -> bool:
    t = strip_ellipsis(text)
    if _VERB_END.search(t):
        return True
    return bool(
        re.search(
            r"\b(изучает|называ|состо[ия]|образу|явля|дают|даёт|содержит|разделил|считал|"
            r"известен|датирует|выполняет|определяет|поддержива|запреща|характериз|"
            r"показывает|получа|применя|использу)\w*\b",
            t,
            re.I,
        )
    )


def polish_stem(question: str, correct: str, section_title: str) -> str:
    """Turn incomplete «…» stems into full, clear questions ending with ?."""
    raw = clean(question)
    q = strip_ellipsis(raw)
    correct = clean(correct)

    if is_meta_question(raw):
        return question_from_answer(correct, section_title)

    # Fix prior bad polish: «Что такое тела состоят из?»
    m_bad = re.match(r"^что такое\s+(.+)\?$", q, re.I)
    if m_bad and has_finite_verb(m_bad.group(1)):
        return verb_stem_to_question(m_bad.group(1))

    # Known stems (case-insensitive) before generic rules
    probe = verb_stem_to_question(q)
    if probe and not probe.startswith("Какой вариант верно завершает"):
        # Only accept if stem looked incomplete / definitional / verbal
        if has_finite_verb(q) or re.match(r"^(примеры|пример)\b", q, re.I) or "—" in raw or raw.endswith("…"):
            return probe

    # «X — это» / «X - это»
    m = re.match(r"^(.{1,60}?)\s*[—–-]\s*это$", q, re.I)
    if m and not has_finite_verb(m.group(1)):
        term = clean(m.group(1)).strip(" «»\"'")
        term = term[0].lower() + term[1:] if term and term[0].isupper() and not term.isupper() else term
        if len(term.split()) <= 5:
            return f"Что такое {term}?"

    m = re.match(r"^(.{1,60}?)\s+это$", q, re.I)
    if m and not has_finite_verb(m.group(1)) and len(m.group(1).split()) <= 5:
        term = clean(m.group(1)).strip(" «»\"'")
        term = term[0].lower() + term[1:] if term and term[0].isupper() else term
        return f"Что такое {term}?"

    if q.endswith("?"):
        polished = polish_existing_question(q)
        if polished and not is_meta_question(polished):
            # Still reject «Что такое …verb…?»
            m2 = re.match(r"^что такое\s+(.+)\?$", polished, re.I)
            if m2 and has_finite_verb(m2.group(1)):
                return verb_stem_to_question(m2.group(1))
            return polished
        return question_from_answer(correct, section_title)

    # Incomplete clause with a verb / incomplete adverbial
    if has_finite_verb(q):
        return verb_stem_to_question(q)

    if re.match(r"^(примеры|пример)\b", q, re.I):
        return verb_stem_to_question(q)

    # Short concept label without verb
    if len(q) <= 70 and re.match(r"^[«\"А-ЯЁA-Z]", q) and not has_finite_verb(q):
        words = q.split()
        if 1 <= len(words) <= 6:
            term = q.strip(" «»\"'")
            term_l = term[0].lower() + term[1:] if term else term
            return f"Что такое {term_l}?"

    if len(q) >= 12:
        stem = q[0].upper() + q[1:]
        return f"Какой вариант верно завершает утверждение: «{stem}»?"

    return question_from_answer(correct, section_title)


def polish_existing_question(q: str) -> str:
    q = clean(q)
    # Soften awkward templates while keeping meaning
    q = re.sub(r"^По учебнику Kimyo,\s*что верно о\s*[«\"]?.+?[»\"]?\s*\??$", "", q, flags=re.I)
    if not q:
        return q
    # Remove nested truncated topic titles
    q = re.sub(r"«([^»]{0,40})…»", r"«\1»", q)
    if not q.endswith("?"):
        q += "?"
    return q


def verb_stem_to_question(stem: str) -> str:
    s = strip_ellipsis(stem)
    # Strip accidental «Что такое » wrapper from prior polish
    s = re.sub(r"^что такое\s+", "", s, flags=re.I).rstrip("?")
    display = s[0].upper() + s[1:] if s else s
    low = s.lower()

    exact = {
        "наука химия изучает": "Что изучает наука химия?",
        "физические тела, созданные человеком, называются": "Как называют физические тела, созданные человеком?",
        "химия выполняет две основные функции": "Какие две основные функции выполняет химия?",
        "к физическим свойствам относят": "Что относят к физическим свойствам?",
        "в сухом воздухе больше всего по объёму": "Чего больше всего по объёму в сухом воздухе?",
        "объёмная доля кислорода в воздухе примерно": "Чему примерно равна объёмная доля кислорода в воздухе?",
        "при взаимодействии кислоты с металлом часто выделяется": "Что часто выделяется при взаимодействии кислоты с металлом?",
        "водород в таблице менделеева имеет символ": "Какой символ имеет водород в таблице Менделеева?",
        "показатель ph характеризует": "Что характеризует показатель pH?",
        "в кабинете химии категорически запрещается": "Что категорически запрещается в кабинете химии?",
        "при разбавлении кислот нужно": "Что нужно делать при разбавлении кислот?",
        "тела состоят из": "Из чего состоят тела?",
        "кислород поддерживает": "Что поддерживает кислород?",
        "примеры кислот из школьного курса": "Какие кислоты приводят в школьном курсе как примеры?",
        "пример нейтрализации": "Какой пример реакции нейтрализации верный?",
        "примеры химических свойств по учебнику": "Какие примеры химических свойств приведены в учебнике?",
    }
    if low in exact:
        return exact[low]

    patterns = [
        (r"^(.+)\s+изучает$", r"Что изучает \1?"),
        (r"^(.+)\s+называют$", r"Как называют \1?"),
        (r"^(.+)\s+называется$", r"Как называется \1?"),
        (r"^(.+)\s+называются$", r"Как называются \1?"),
        (r"^(.+)\s+состоит из$", r"Из чего состоит \1?"),
        (r"^(.+)\s+состоят из$", r"Из чего состоят \1?"),
        (r"^(.+)\s+состоит$", r"Из чего состоит \1?"),
        (r"^(.+)\s+состоят$", r"Из чего состоят \1?"),
        (r"^к\s+(.+)\s+относят$", r"Что относят к \1?"),
        (r"^(.+)\s+относят$", r"Что относят к \1?"),
        (r"^(.+)\s+является$", r"Чем является \1?"),
        (r"^(.+)\s+содержит$", r"Что содержит \1?"),
        (r"^(.+)\s+включает$", r"Что включает \1?"),
        (r"^(.+)\s+поддерживает$", r"Что поддерживает \1?"),
        (r"^(.+)\s+имеет символ$", r"Какой символ имеет \1?"),
        (r"^(.+)\s+имеет$", r"Что имеет \1?"),
        (r"^(.+)\s+характеризует$", r"Что характеризует \1?"),
        (r"^(.+)\s+запрещается$", r"Что запрещается (\1)?"),
        (r"^(.+)\s+нужно$", r"Что нужно (\1)?"),
        (r"^(.+)\s+примерно$", r"Чему примерно равно: \1?"),
        (r"^(.+)\s+около$", r"Чему примерно равно: \1?"),
        (r"^в\s+(.+)\s+больше всего по объёму$", r"Чего больше всего по объёму в \1?"),
        (r"^(.+)\s+известен как$", r"Чем известен \1?"),
        (r"^(.+)\s+датируется$", r"Каким периодом датируется \1?"),
        (r"^(.+)\s+разделил вещества на$", r"На какие группы \1 разделил вещества?"),
        (r"^(.+)\s+считал невозможным$", r"Что \1 считал невозможным?"),
        (r"^химия\s+выполняет\s+две\s+основные\s+функции$", "Какие две основные функции выполняет химия?"),
        (r"^(.+)\s+выполняет$", r"Что выполняет \1?"),
        (r"^примеры\s+(.+)$", r"Какие примеры \1?"),
        (r"^пример\s+(.+)$", r"Какой пример \1 верный?"),
    ]
    for pat, repl in patterns:
        if re.match(pat, s, re.I):
            out = re.sub(pat, repl, s, flags=re.I)
            return out[0].upper() + out[1:] if out else (display + "?")

    return f"Какой вариант верно завершает утверждение: «{display}»?"


def question_from_answer(correct: str, section_title: str) -> str:
    c = clean(correct)
    for sep in (" — ", " – ", " - "):
        if sep in c:
            left, right = c.split(sep, 1)
            left, right = clean(left), clean(right)
            if 2 <= len(left) <= 60 and len(right) >= 8 and not has_finite_verb(left):
                term = left.strip(" «»")
                term = term[0].lower() + term[1:] if term and term[0].isupper() else term
                return f"Что такое {term}?"
    m = re.match(r"^(.{2,55}?)\s+это\s+(.{8,})$", c, re.I)
    if m and not has_finite_verb(m.group(1)):
        term = clean(m.group(1))
        term = term[0].lower() + term[1:] if term and term[0].isupper() else term
        return f"Что такое {term}?"

    title = clean(section_title)
    title = re.sub(r"\s*…\s*", " ", title).strip()
    # Avoid huge practical titles
    if len(title) > 55:
        title = title[:55].rsplit(" ", 1)[0]
    if 4 <= len(title) <= 55:
        return f"Какое утверждение верно по теме «{title}»?"
    return "Какое из приведённых утверждений верно?"


def polish_choice(text: str) -> str:
    t = clean(text)
    t = re.sub(r"\s+", " ", t).strip()
    # Don't leave trailing ellipsis on choices
    if t.endswith("…") and len(t) > 40:
        t = strip_ellipsis(t)
        if t and t[-1] not in ".!?":
            t += "."
    return t


def better_wrong_pool(correct: str, others: list[str]) -> list[str]:
    """Build 3 specific distractors; avoid meta/generic fillers."""
    pool: list[str] = []
    for w in others:
        w = polish_choice(w)
        if not w or w == correct or is_generic_wrong(w):
            continue
        if w not in pool:
            pool.append(w)

    # Local meaningful distractors from chemistry school misconceptions
    extras = [
        "Утверждение относится к другому классу веществ и здесь неверно",
        "Так определяют другое понятие школьного курса химии",
        "Это описание физического явления, а не данного химического понятия",
        "Формулировка противоречит определению из курса химии 7 класса",
        "Верно лишь для другого агрегатного состояния вещества",
        "Так характеризуют смесь, а не данное вещество или явление",
        "Это свойство относится к другой группе элементов таблицы Менделеева",
        "В школьном курсе такое определение не используют для данного термина",
    ]
    for e in extras:
        if len(pool) >= 3:
            break
        if e != correct and e not in pool:
            pool.append(e)
    while len(pool) < 3:
        pool.append(extras[len(pool) % len(extras)])
    return pool[:3]


FILL_FACTS: list[tuple[str, str, list[str], str]] = [
    (
        "Что такое атом?",
        "Электронейтральная частица, состоящая из ядра и электронов",
        ["Только ядро без электронов", "Заряженная молекула", "Смесь двух газов"],
        "Атом электронейтрален: ядро (+) и электроны (−).",
    ),
    (
        "Что такое молекула?",
        "Мельчайшая частица вещества, сохраняющая его химические свойства",
        ["Только один протон", "Кусок металла любого размера", "Смесь песка и соли"],
        "Молекула — частица вещества с его химическими свойствами.",
    ),
    (
        "Что такое химический элемент?",
        "Вид атомов с одинаковым зарядом ядра (числом протонов)",
        ["Любая смесь веществ", "Только молекула воды", "Любой предмет"],
        "Элемент = атомы с одинаковым числом протонов Z.",
    ),
    (
        "Что такое простое вещество?",
        "Вещество, состоящее из атомов одного химического элемента",
        ["Вещество из атомов разных элементов", "Любая смесь газов", "Только раствор соли"],
        "O₂, Fe, S — простые вещества.",
    ),
    (
        "Что такое сложное вещество?",
        "Вещество, состоящее из атомов разных химических элементов",
        ["Вещество из атомов только одного элемента", "Чистый инертный газ", "Только смесь металлов"],
        "H₂O, CO₂, NaCl — сложные вещества.",
    ),
    (
        "Что такое оксид?",
        "Сложное вещество из двух элементов, один из которых — кислород",
        ["Чистое простое вещество металла", "Смесь азота и аргона", "Любая кислота без кислорода"],
        "Примеры оксидов: CO₂, H₂O, Fe₂O₃.",
    ),
    (
        "Что такое кислота в школьном курсе?",
        "Сложное вещество, образующее в водном растворе ионы водорода H⁺ (H₃O⁺)",
        ["Любой оксид металла", "Чистое простое вещество", "Только твёрдая соль"],
        "Кислоты в воде дают ионы водорода.",
    ),
    (
        "Что такое реакция нейтрализации?",
        "Взаимодействие кислоты с основанием с образованием соли и воды",
        ["Только горение угля", "Фильтрация смеси", "Возгонка иода"],
        "Кислота + основание → соль + вода.",
    ),
]


def make_fill_item(sid: str, n: int, fact: tuple[str, str, list[str], str]) -> dict:
    q, a, wrong, e = fact
    qid = f"{sid}-q{n:02d}"
    return {
        "id": qid,
        "templateKey": qid,
        "question": q,
        "choices": [a, wrong[0], wrong[1], wrong[2]],
        "correctIndex": 0,
        "explanation": e,
        "description": e,
        "visualId": qid,
    }


def is_garbage_item(question: str, correct: str) -> bool:
    blob = f"{question} {correct}".lower()
    if re.search(r"основные понятия\s+\w+", blob):
        return True
    if re.search(r"что такое основные понятия", blob):
        return True
    if len(clean(correct)) < 8:
        return True
    if re.fullmatch(r"что такое [а-яё]{1,3}\?", clean(question).lower()):
        return True
    return False


def looks_like_meta_item(item: dict) -> bool:
    q = clean(item.get("question", ""))
    choices = item.get("choices") or []
    ci = int(item.get("correctIndex", 0))
    a = clean(choices[ci] if choices and 0 <= ci < len(choices) else "")
    if is_meta_question(q):
        return True
    if is_generic_wrong(a):
        return True
    blob = (q + " " + a).lower()
    return any(p in blob for p in META_PADS)


def polish_item(item: dict, section_title: str, sibling_answers: list[str]) -> dict:
    choices = [polish_choice(c) for c in (item.get("choices") or [])]
    ci = int(item.get("correctIndex", 0))
    if not choices:
        return item
    if ci < 0 or ci >= len(choices):
        ci = 0
    correct = choices[ci]

    # Rebuild distractors if generic
    wrongs = [c for i, c in enumerate(choices) if i != ci]
    if any(is_generic_wrong(w) for w in wrongs) or len(wrongs) < 3:
        wrongs = better_wrong_pool(correct, wrongs + sibling_answers)

    question = polish_stem(item.get("question", ""), correct, section_title)

    # If still meta after polish, force rebuild
    if is_meta_question(question) or looks_like_meta_item({**item, "question": question, "choices": [correct]}):
        question = question_from_answer(correct, section_title)

    if is_garbage_item(question, correct):
        question = question_from_answer(correct, section_title)
        if is_garbage_item(question, correct):
            # Last resort: explicit choice about the correct statement
            question = f"Какое утверждение верно по теме «{section_title[:50]}»?"

    # Guarantee terminal ?
    question = clean(question)
    if not question.endswith("?"):
        question = strip_ellipsis(question) + "?"

    # Avoid doubled ?? and empty
    question = re.sub(r"\?+$", "?", question)
    if len(question) < 12:
        question = question_from_answer(correct, section_title)

    # Final grammar tweaks
    question = question.replace("Что такое Что такое ", "Что такое ")
    question = re.sub(r"\s+\?", "?", question)
    question = re.sub(r"«\s+", "«", question)
    question = re.sub(r"\s+»", "»", question)

    new_choices = [correct, wrongs[0], wrongs[1], wrongs[2]]
    expl = clean(item.get("explanation") or item.get("description") or correct)
    expl = strip_ellipsis(expl)
    if expl and expl[-1] not in ".!?":
        expl += "."

    return {
        **item,
        "question": question,
        "choices": new_choices,
        "correctIndex": 0,
        "explanation": expl[:240],
        "description": expl[:400],
    }


def main() -> None:
    toc = load_toc()
    data = json.loads(OVERRIDES.read_text(encoding="utf-8"))
    out: dict[str, list] = {}
    stats = {"sections": 0, "items": 0, "meta_fixed": 0, "ellipsis_fixed": 0}

    for sid, items in data.items():
        if not isinstance(items, list):
            continue
        title = topic_title(sid, toc)
        siblings = []
        for it in items:
            ch = it.get("choices") or []
            ci = int(it.get("correctIndex", 0))
            if ch and 0 <= ci < len(ch):
                siblings.append(ch[ci])
        polished = []
        seen_q: set[str] = set()
        for it in items:
            before_q = it.get("question", "")
            was_meta = is_meta_question(before_q)
            had_ell = "…" in before_q or before_q.rstrip().endswith("...")
            newt = polish_item(it, title, siblings)
            qn = clean(newt.get("question", "")).lower()
            ci = int(newt.get("correctIndex", 0))
            correct = clean((newt.get("choices") or [""])[ci])
            dedupe_key = qn + "||" + correct.lower()[:80]
            # Deduplicate only exact same question+answer
            if dedupe_key in seen_q:
                continue
            seen_q.add(dedupe_key)
            if is_garbage_item(newt.get("question", ""), correct) and "основные понятия" in correct.lower():
                continue
            if was_meta:
                stats["meta_fixed"] += 1
            if had_ell:
                stats["ellipsis_fixed"] += 1
            polished.append(newt)
            stats["items"] += 1
        fixed = []
        for i, it in enumerate(polished[:8], 1):
            qid = f"{sid}-q{i:02d}"
            fixed.append({**it, "id": qid, "templateKey": qid, "visualId": it.get("visualId") or qid})
        # Pad thin sections with verified school facts (not meta fluff)
        used_answers = {clean((it.get("choices") or [""])[0]).lower()[:60] for it in fixed}
        fi = 0
        while len(fixed) < 8 and fi < len(FILL_FACTS) * 2:
            fact = FILL_FACTS[fi % len(FILL_FACTS)]
            fi += 1
            if fact[1].lower()[:60] in used_answers:
                continue
            if any(clean(x.get("question", "")).lower() == fact[0].lower() for x in fixed):
                continue
            used_answers.add(fact[1].lower()[:60])
            fixed.append(make_fill_item(sid, len(fixed) + 1, fact))
        # renumber
        fixed = [
            {**it, "id": f"{sid}-q{i:02d}", "templateKey": f"{sid}-q{i:02d}"}
            for i, it in enumerate(fixed[:8], 1)
        ]
        out[sid] = fixed
        stats["sections"] += 1

    OVERRIDES.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        f"Polished {stats['items']} questions in {stats['sections']} sections; "
        f"ellipsis->full {stats['ellipsis_fixed']}, meta->real {stats['meta_fixed']}"
    )


if __name__ == "__main__":
    main()
