import re

BLOCKED_PATTERNS = [
    re.compile(r"взрывчат", re.I),
    re.compile(r"\bexplosive\b", re.I),
    re.compile(r"наркотик", re.I),
    re.compile(r"\bdrug\s+synth", re.I),
    re.compile(r"отравить\s+человек", re.I),
    re.compile(r"poison\s+someone", re.I),
]

TASK_ANSWER_LEAK = [
    re.compile(r"\bответ\s*[:=—-]\s*[\d,.]+", re.I),
    re.compile(r"\bитого\s*[:=—-]\s*[\d,.]+", re.I),
    re.compile(r"\bполучается\s+[\d,.]+\s*(г|кг|моль|л|мл|%)", re.I),
    re.compile(r"\bthe answer is\s+[\d,.]+", re.I),
    re.compile(r"\bвариант\s+[а-гa-d]\s*—?\s*верн", re.I),
    re.compile(r"\bcorrect (option|answer)\s*(is|:)\s*", re.I),
]

BLOCKED_REPLY = (
    "Я не могу давать инструкции по опасным или вредным веществам. "
    "Задайте вопрос по школьной химии, лабораторной безопасности или расчётам — "
    "помогу в рамках учебной программы."
)

TASK_COACH_FALLBACK = (
    "Запиши в черновик «Дано» и «Найти», затем спроси следующий шаг — "
    "я подскажу направление, не ответ."
)


def filter_assistant_reply(text: str) -> str:
    trimmed = (text or "").strip()
    if not trimmed:
        return trimmed
    for pattern in BLOCKED_PATTERNS:
        if pattern.search(trimmed):
            return BLOCKED_REPLY
    return trimmed


def filter_task_coach_reply(text: str) -> str:
    out = filter_assistant_reply(text)
    for pattern in TASK_ANSWER_LEAK:
        out = pattern.sub("", out).strip()
    if len(out) < 12:
        return TASK_COACH_FALLBACK
    return out
