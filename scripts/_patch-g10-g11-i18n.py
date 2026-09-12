"""Patch gradesOutline*.ts with g10/g11 keys."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    for lang, fname in [
        ("Ru", "gradesOutlineRu.ts"),
        ("En", "gradesOutlineEn.ts"),
        ("Uz", "gradesOutlineUz.ts"),
    ]:
        path = ROOT / "src" / "i18n" / "learn" / fname
        text = path.read_text(encoding="utf-8")
        if "'learn.g10.title'" in text:
            print(fname, "already has g10")
            continue

        frag = ""
        for grade in ("g10", "g11"):
            frag += (ROOT / "scripts" / "_generated" / f"{grade}Outline{lang}.tsfrag").read_text(
                encoding="utf-8"
            )

        if lang == "Ru":
            text = text.replace("7–9 класс", "7–11 класс").replace("7-9 класс", "7-11 класс")
        elif lang == "En":
            text = text.replace("Grades 7–9", "Grades 7–11")
        else:
            text = text.replace("7–9-sinf", "7–11-sinf").replace("7-9-sinf", "7-11-sinf")
            # also common uz lead variants
            text = text.replace("7–9 sinf", "7–11 sinf")

        frames = {
            "Ru": (
                "  'learn.textbook.frameTitleG10': 'Просмотр учебника химии, 10 класс',\n"
                "  'learn.textbook.frameTitleG11': 'Просмотр учебника химии, 11 класс',\n"
            ),
            "En": (
                "  'learn.textbook.frameTitleG10': 'Chemistry textbook, grade 10',\n"
                "  'learn.textbook.frameTitleG11': 'Chemistry textbook, grade 11',\n"
            ),
            "Uz": (
                "  'learn.textbook.frameTitleG10': 'Kimyo darsligi ko\\'rinishi, 10-sinf',\n"
                "  'learn.textbook.frameTitleG11': 'Kimyo darsligi ko\\'rinishi, 11-sinf',\n"
            ),
        }[lang]

        marker = "'learn.textbook.frameTitleG9':"
        if marker in text and "frameTitleG10" not in text:
            i = text.find(marker)
            j = text.find("\n", i)
            text = text[: j + 1] + frames + text[j + 1 :]

        needle = "} as const"
        idx = text.rfind(needle)
        if idx < 0:
            raise SystemExit(f"no as const in {fname}")
        before = text[:idx].rstrip()
        if not before.endswith(","):
            before += ","
        text = before + "\n\n" + frag + needle + text[idx + len(needle) :]
        path.write_text(text, encoding="utf-8")
        print("updated", fname)


if __name__ == "__main__":
    main()
