# -*- coding: utf-8 -*-
"""RU → EN/UZ quiz translation. One JSON file per question (no races), then merge."""
from __future__ import annotations

import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from deep_translator import GoogleTranslator

ROOT = Path(__file__).resolve().parents[1]
SECTION_SRC = ROOT / "scripts/_generated/quiz-i18n-source.json"
LOGICAL_SRC = ROOT / "scripts/_generated/logical-quiz-i18n-source.json"
SECTION_PARTS = ROOT / "scripts/_generated/quiz-i18n-parts"
LOGICAL_PARTS = ROOT / "scripts/_generated/logical-i18n-parts"
SECTION_OUT = ROOT / "src/data/sectionQuizI18n.json"
LOGICAL_OUT = ROOT / "src/data/g7LogicalQuizI18n.json"

SEP = "\n|||\n"
WORKERS = 4


def load(path: Path, fallback):
    if not path.exists():
        return fallback
    return json.loads(path.read_text(encoding="utf-8"))


def save(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def is_complete(entry) -> bool:
    return bool(
        entry
        and isinstance(entry.get("questionEn"), str)
        and entry["questionEn"].strip()
        and isinstance(entry.get("questionUz"), str)
        and entry["questionUz"].strip()
        and isinstance(entry.get("choicesEn"), list)
        and len(entry["choicesEn"]) == 4
        and isinstance(entry.get("choicesUz"), list)
        and len(entry["choicesUz"]) == 4
    )


def fields(q: dict) -> list[str]:
    ch = list(q.get("choices") or [])
    while len(ch) < 4:
        ch.append("")
    return [q.get("question") or "", ch[0], ch[1], ch[2], ch[3], q.get("explanation") or ""]


def split_parts(text: str) -> list[str]:
    parts = [p.strip() for p in (text or "").split("|||")]
    while len(parts) < 6:
        parts.append("")
    return parts[:6]


def translate_joined(parts: list[str], target: str, retries: int = 5) -> list[str]:
    joined = SEP.join(parts)
    if not joined.replace("|", "").strip():
        return ["", "", "", "", "", ""]
    translator = GoogleTranslator(source="ru", target=target)
    last_err = None
    for attempt in range(retries):
        try:
            raw = translator.translate(joined[:4500]) or ""
            return split_parts(raw)
        except Exception as e:  # noqa: BLE001
            last_err = e
            time.sleep(1.1 * (attempt + 1))
    raise RuntimeError(str(last_err))


def translate_item(q: dict) -> dict:
    parts = fields(q)
    en = translate_joined(parts, "en")
    uz = translate_joined(parts, "uz")
    return {
        "questionEn": en[0],
        "questionUz": uz[0],
        "choicesEn": en[1:5],
        "choicesUz": uz[1:5],
        "explanationEn": en[5],
        "explanationUz": uz[5],
    }


def part_path(parts_dir: Path, key: str) -> Path:
    safe = key.replace("/", "_").replace("\\", "_")
    return parts_dir / f"{safe}.json"


def merge_parts(parts_dir: Path, out_path: Path) -> int:
    merged = load(out_path, {})
    if not parts_dir.exists():
        save(out_path, merged)
        return len(merged)
    for f in parts_dir.glob("*.json"):
        try:
            entry = json.loads(f.read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001
            continue
        if is_complete(entry):
            merged[f.stem] = entry
    # also keep already-good keys from out
    save(out_path, {k: v for k, v in merged.items() if is_complete(v)})
    return len(load(out_path, {}))


def process(src: Path, parts_dir: Path, out_path: Path, key_field: str) -> None:
    parts_dir.mkdir(parents=True, exist_ok=True)
    source = load(src, [])
    # Seed parts from existing out file
    existing = load(out_path, {})
    for key, entry in existing.items():
        if is_complete(entry):
            save(part_path(parts_dir, key), entry)

    pending = []
    for q in source:
        key = q.get(key_field) or q["id"]
        p = part_path(parts_dir, key)
        if p.exists():
            try:
                if is_complete(json.loads(p.read_text(encoding="utf-8"))):
                    continue
            except Exception:  # noqa: BLE001
                pass
        pending.append(q)

    print(f"{out_path.name}: total={len(source)} pending={len(pending)} workers={WORKERS}", flush=True)
    done = 0

    def one(q: dict):
        key = q.get(key_field) or q["id"]
        entry = translate_item(q)
        save(part_path(parts_dir, key), entry)
        return key

    if pending:
        with ThreadPoolExecutor(max_workers=WORKERS) as ex:
            futures = [ex.submit(one, q) for q in pending]
            for fut in as_completed(futures):
                try:
                    fut.result()
                    done += 1
                    if done % 10 == 0 or done == len(pending):
                        n = merge_parts(parts_dir, out_path)
                        print(f"  parts {done}/{len(pending)} merged={n}", flush=True)
                except Exception as e:  # noqa: BLE001
                    print(f"  FAIL: {e}", flush=True)
                    time.sleep(0.5)

    n = merge_parts(parts_dir, out_path)
    print(f"  final merged={n}", flush=True)


def main() -> None:
    process(SECTION_SRC, SECTION_PARTS, SECTION_OUT, "id")
    if LOGICAL_SRC.exists():
        process(LOGICAL_SRC, LOGICAL_PARTS, LOGICAL_OUT, "templateKey")
    print("done", flush=True)


if __name__ == "__main__":
    main()
