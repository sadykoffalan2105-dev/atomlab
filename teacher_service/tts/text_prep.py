"""Text preprocessing for Edge TTS (ported from learnSpeechText.ts)."""

from __future__ import annotations

import re

_SUBSCRIPT = str.maketrans("₀₁₂₃₄₅₆₇₈₉", "0123456789")
_SUPERSCRIPT = str.maketrans("⁰¹²³⁴⁵⁶⁷⁸⁹", "0123456789")

_RU_LEXICON = {
    "h2o": "эич два о",
    "co2": "си о два",
    "o2": "о два",
    "n2": "эн два",
    "naoh": "гидроксид натрия",
    "hcl": "хлороводородная кислота",
    "h2so4": "серная кислота",
    "nh3": "аммиак",
    "ph": "пэ аш",
    "kimyo": "Кимё",
}


def strip_markdown(text: str) -> str:
    t = re.sub(r"```[\s\S]*?```", " ", text)
    t = re.sub(r"`([^`]+)`", r"\1", t)
    t = re.sub(r"\*\*([^*]+)\*\*", r"\1", t)
    t = re.sub(r"\*([^*]+)\*", r"\1", t)
    t = re.sub(r"#{1,6}\s+", "", t)
    t = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", t)
    t = re.sub(r"[📖✦•·▪|]", " ", t)
    t = re.sub(r"\n{2,}", ". ", t)
    t = re.sub(r"\n", " ", t)
    t = re.sub(r"\s{2,}", " ", t)
    return t.strip()


def normalize_chemical_notation(text: str) -> str:
    t = text.translate(_SUBSCRIPT).translate(_SUPERSCRIPT)
    return t.replace("⁺", "+").replace("⁻", "-")


def prepare_text_for_tts(text: str, locale: str) -> str:
    t = strip_markdown(text)
    t = normalize_chemical_notation(t)

    if locale == "en":
        t = re.sub(r"§\s*(\d+)", r"section \1", t)
        t = re.sub(r"→|⟶|->", ", then ", t)
        t = re.sub(r"⇌|↔", ", reversible reaction, ", t)
    else:
        t = re.sub(r"§\s*(\d+)", r"параграф \1", t)
        t = re.sub(r"---\s*ЗАПОМНИТЬ\s*---", ". Важно запомнить.", t, flags=re.I)
        t = re.sub(r"ЗАПОМНИТЬ|Запомнить по учебнику", "Важно запомнить", t, flags=re.I)
        t = re.sub(r"\bKimyo\b", "Кимё", t, flags=re.I)
        t = re.sub(r"→|⟶|->", ", затем ", t)
        t = re.sub(r"⇌|↔", ", реакция обратима, ", t)
        t = re.sub(r"\bт\.?\s*д\.?\b", "так далее", t, flags=re.I)
        t = re.sub(r"\bт\.?\s*е\.?\b", "то есть", t, flags=re.I)
        t = re.sub(r"…+", ".", t)
        for key, spoken in _RU_LEXICON.items():
            t = re.sub(re.escape(key), spoken, t, flags=re.I)

    t = re.sub(r"[+=→⟶⇌↔]", " ", t)
    t = re.sub(r"\s{2,}", " ", t)
    return t.strip()


def split_for_tts(text: str, max_chars: int) -> list[str]:
    if len(text) <= max_chars:
        return [text] if text else []

    parts: list[str] = []
    buf = ""
    for sentence in re.split(r"(?<=[.!?;:])\s+", text):
        if not sentence:
            continue
        if len(buf) + len(sentence) + 1 <= max_chars:
            buf = f"{buf} {sentence}".strip()
        else:
            if buf:
                parts.append(buf)
            if len(sentence) <= max_chars:
                buf = sentence
            else:
                for i in range(0, len(sentence), max_chars):
                    parts.append(sentence[i : i + max_chars])
                buf = ""
    if buf:
        parts.append(buf)
    return parts
