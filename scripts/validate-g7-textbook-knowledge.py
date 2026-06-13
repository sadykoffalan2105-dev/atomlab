"""Validate g7TextbookKnowledge.json integrity."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JSON_PATH = ROOT / "src" / "data" / "g7TextbookKnowledge.json"
TOC_PATH = ROOT / "scripts" / "g7-toc-complete.json"

MIN_CONTENT_LEN = 200


def main() -> None:
    errors: list[str] = []

    if not JSON_PATH.is_file():
        errors.append(f"Missing {JSON_PATH}")
        sys.exit(1)

    data = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    sections = data.get("sections") or []
    toc = json.loads(TOC_PATH.read_text(encoding="utf-8"))

    if len(sections) != len(toc):
        errors.append(f"Section count mismatch: json={len(sections)} toc={len(toc)}")

    for s in sections:
        sid = s.get("id", "?")
        content = s.get("contentRu") or ""
        if len(content) < MIN_CONTENT_LEN:
            errors.append(f"{sid}: contentRu too short ({len(content)} chars)")
        if not s.get("rememberRu"):
            errors.append(f"{sid}: missing rememberRu")
        parts = s.get("ragParts") or []
        if not parts:
            errors.append(f"{sid}: missing ragParts")

    total = sum(len(s.get("contentRu") or "") for s in sections)
    if total < 200_000:
        errors.append(f"Total contentRu suspiciously low: {total}")

    if errors:
        print("[validate:g7-textbook] FAILED")
        for e in errors[:20]:
            print(" -", e)
        if len(errors) > 20:
            print(f" ... and {len(errors) - 20} more")
        sys.exit(1)

    parts = sum(len(s.get("ragParts") or []) for s in sections)
    print(f"[validate:g7-textbook] OK — {len(sections)} sections, {parts} RAG parts, {total:,} chars")


if __name__ == "__main__":
    main()
