# -*- coding: utf-8 -*-
"""Translate g7SectionQuizEnrichments descriptions into sectionQuizI18n.json (resume-safe)."""
from __future__ import annotations

import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from deep_translator import GoogleTranslator

ROOT = Path(__file__).resolve().parents[1]
ENRICH = ROOT / "src/data/g7SectionQuizEnrichments.json"
OUT = ROOT / "src/data/sectionQuizI18n.json"
PARTS = ROOT / "scripts/_generated/enrich-desc-parts"
WORKERS = 4
SEP = "\n<<<>>>\n"


def load(path: Path, fallback):
    if not path.exists():
        return fallback
    return json.loads(path.read_text(encoding="utf-8"))


def save(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def tx(text: str, target: str, retries: int = 5) -> str:
    text = (text or "").strip()
    if not text:
        return ""
    tr = GoogleTranslator(source="ru", target=target)
    last = None
    for attempt in range(retries):
        try:
            return (tr.translate(text[:4500]) or "").strip()
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(1.2 * (attempt + 1))
    raise RuntimeError(str(last))


def translate_one(key: str, description: str, explanation: str) -> dict:
    joined = description + SEP + (explanation or "")
    en = tx(joined, "en").split("<<<>>>")
    uz = tx(joined, "uz").split("<<<>>>")
    while len(en) < 2:
        en.append("")
    while len(uz) < 2:
        uz.append("")
    return {
        "descriptionEn": en[0].strip(),
        "descriptionUz": uz[0].strip(),
        "explanationEn": en[1].strip(),
        "explanationUz": uz[1].strip(),
    }


def main() -> None:
    enrich = load(ENRICH, {})
    out = load(OUT, {})
    PARTS.mkdir(parents=True, exist_ok=True)

    # Skip §1 — hand-translated in TS enrichments
    skip = {f"g7-c1-s01-q0{i}" for i in range(1, 9)}
    pending = []
    for key, e in enrich.items():
        if key in skip:
            continue
        part = PARTS / f"{key}.json"
        if part.exists():
            try:
                pe = json.loads(part.read_text(encoding="utf-8"))
                if pe.get("descriptionEn") and pe.get("descriptionUz"):
                    continue
            except Exception:  # noqa: BLE001
                pass
        existing = out.get(key) or {}
        if existing.get("descriptionEn") and existing.get("descriptionUz"):
            continue
        pending.append((key, e.get("description") or "", e.get("explanation") or ""))

    print(f"enrich descriptions pending={len(pending)}", flush=True)
    done = 0

    def one(item):
        key, desc, expl = item
        entry = translate_one(key, desc, expl)
        save(PARTS / f"{key}.json", entry)
        return key, entry

    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        futs = [ex.submit(one, p) for p in pending]
        for fut in as_completed(futs):
            try:
                key, entry = fut.result()
                cur = out.get(key) or {}
                cur.update({k: v for k, v in entry.items() if v})
                out[key] = cur
                done += 1
                if done % 10 == 0 or done == len(pending):
                    save(OUT, out)
                    print(f"  saved {done}/{len(pending)}", flush=True)
            except Exception as e:  # noqa: BLE001
                print(f"  FAIL: {e}", flush=True)
                time.sleep(1)

    # Merge any leftover parts
    for part in PARTS.glob("*.json"):
        key = part.stem
        try:
            entry = json.loads(part.read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001
            continue
        cur = out.get(key) or {}
        cur.update({k: v for k, v in entry.items() if v})
        out[key] = cur
    save(OUT, out)
    print("done", flush=True)


if __name__ == "__main__":
    main()
