"""One-off: extract Kimyo 7 PDF outline and paragraph page hints."""
from __future__ import annotations

import re
import sys
from pathlib import Path

from pypdf import PdfReader

PDF = Path(__file__).resolve().parents[1] / "книга 7 класс" / "www.idum.uz__Kimyo_7_rus_2022.pdf"


def main() -> None:
    r = PdfReader(str(PDF))
    print("pages", len(r.pages))

    if r.outline:
        print("\n=== OUTLINE ===")

        def walk(items, depth=0):
            for it in items:
                if isinstance(it, list):
                    walk(it, depth + 1)
                else:
                    try:
                        pg = r.get_destination_page_number(it) + 1
                    except Exception:
                        pg = "?"
                    print("  " * depth + f"{it.title} -> p{pg}")

        walk(r.outline)

    print("\n=== PARSED TOC ENTRIES ===")
    toc_text = ""
    for i, page in enumerate(r.pages[:6]):
        t = page.extract_text() or ""
        if "СОДЕРЖАНИЕ" in t or re.search(r"\d\.\d+\.", t):
            toc_text += "\n" + t

    entry_re = re.compile(r"(\d)\.(\d+)\.\s+(.+?)\s+\.+(\d+)\s*$", re.M)
    for m in entry_re.finditer(toc_text):
        ch, sec, title, pg = m.groups()
        print(f"g7 c{ch} s{sec.zfill(2)} -> p{pg} | {title.strip()[:60]}")

    # fallback: lines ending with page number after dots
    line_re = re.compile(r"^(\d)\.(\d+)\.\s+(.+?)\.{2,}\s*(\d+)\s*$", re.M)
    for m in line_re.finditer(toc_text):
        ch, sec, title, pg = m.groups()
        print(f"LINE g7 c{ch} s{sec.zfill(2)} -> p{pg}")


if __name__ == "__main__":
    main()
