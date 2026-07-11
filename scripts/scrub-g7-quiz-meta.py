#!/usr/bin/env python3
"""Remove meta/pad answers from polished G7 overrides and pad with real facts."""
from __future__ import annotations

import json
import re
from pathlib import Path

import importlib.util

ROOT = Path(__file__).resolve().parents[1]
OV = ROOT / "src" / "data" / "g7SectionQuizOverrides.json"

spec = importlib.util.spec_from_file_location("pol", ROOT / "scripts" / "polish-g7-quiz-questions.py")
pol = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(pol)

META_ANS = tuple(pol.META_PADS) + (
    "химии 7 класса по учебнику",
    "учебник kimyo",
    "закрепить определения",
    "научные формулировки школьного курса",
)


def is_meta_answer(text: str) -> bool:
    t = pol.clean(text).lower()
    return any(m in t for m in META_ANS)


def main() -> None:
    data = json.loads(OV.read_text(encoding="utf-8"))
    removed = 0
    for sid, items in list(data.items()):
        kept: list[dict] = []
        for it in items:
            choices = it.get("choices") or []
            ci = int(it.get("correctIndex", 0))
            ans = choices[ci] if choices and 0 <= ci < len(choices) else ""
            if is_meta_answer(ans) or is_meta_answer(it.get("question", "")):
                removed += 1
                continue
            kept.append(it)

        used_q = {pol.clean(it.get("question", "")).lower() for it in kept}
        fi = 0
        while len(kept) < 8 and fi < len(pol.FILL_FACTS) * 4:
            fact = pol.FILL_FACTS[fi % len(pol.FILL_FACTS)]
            fi += 1
            if fact[0].lower() in used_q:
                continue
            if is_meta_answer(fact[1]):
                continue
            used_q.add(fact[0].lower())
            kept.append(pol.make_fill_item(sid, len(kept) + 1, fact))

        # Deduplicate question text
        seen: set[str] = set()
        final: list[dict] = []
        for it in kept:
            q = pol.clean(it.get("question", ""))
            if q.lower() in seen:
                a = (it.get("choices") or [""])[0]
                key = re.split(r"[.,;—–]", a)[0].strip()
                if 3 < len(key) <= 55 and not is_meta_answer(key) and not pol.has_finite_verb(key):
                    term = key[0].lower() + key[1:] if key and key[0].isupper() else key
                    it = {**it, "question": f"Что такое {term}?"}
                    if it["question"].lower() in seen:
                        continue
                    q = it["question"]
                else:
                    continue
            seen.add(q.lower())
            final.append(it)

        fi = 0
        while len(final) < 8 and fi < len(pol.FILL_FACTS) * 4:
            fact = pol.FILL_FACTS[fi % len(pol.FILL_FACTS)]
            fi += 1
            if fact[0].lower() in {pol.clean(x["question"]).lower() for x in final}:
                continue
            final.append(pol.make_fill_item(sid, len(final) + 1, fact))

        data[sid] = [
            {**it, "id": f"{sid}-q{i:02d}", "templateKey": f"{sid}-q{i:02d}", "visualId": it.get("visualId") or f"{sid}-q{i:02d}"}
            for i, it in enumerate(final[:8], 1)
        ]

    OV.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    total = sum(len(v) for v in data.values())
    print(f"Scrubbed meta answers removed={removed}; total questions={total}; sections={len(data)}")


if __name__ == "__main__":
    main()
