"""Extract TOC for g8/g9 from curriculum + PDF page scan.

Usage:
  python scripts/extract-textbook-toc.py g8
  python scripts/extract-textbook-toc.py g9

Output: src/data/g8BookToc.json or g9BookToc.json
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]

# Curriculum mapping: chapter -> list of (section_id_num, titleRu)
G8_CURRICULUM = {
    1: [
        (1, "Основные химические понятия"),
        (2, "Классы неорганических соединений"),
        (3, "Оксиды"),
        (4, "Основания и кислоты"),
        (5, "Соли: понятие и номенклатура"),
        (6, "Соли: свойства и получение"),
        (7, "Генетическая связь классов соединений"),
    ],
    2: [
        (3, "Ранняя классификация элементов"),
        (4, "Природные семейства элементов"),
        (5, "Периодический закон"),
        (6, "Периодическая система элементов"),
        (7, "Свойства элементов"),
        (8, "Электронная конфигурация"),
        (9, "Валентные электроны"),
        (10, "Атомный радиус"),
        (11, "Малые периоды"),
        (12, "Большие периоды"),
        (13, "Повторение"),
    ],
    3: [
        (14, "Химическая связь"),
        (15, "Ковалентная связь"),
        (16, "Ионная связь"),
        (17, "Кристаллическая решётка"),
        (18, "Водородная связь"),
        (19, "Окислительно-восстановительные реакции"),
        (20, "Примеры ОВР"),
        (21, "Металлическая связь"),
    ],
    4: [
        (21, "Общие свойства неметаллов"),
        (22, "Галогены"),
        (23, "Хлор"),
        (24, "Хлороводород"),
        (25, "Закон Авогадро"),
        (26, "Закон эквивалентов"),
        (27, "Соляная кислота"),
        (28, "Фтор, бром, йод"),
        (29, "Азот"),
        (30, "Сера"),
        (31, "Минеральные удобрения"),
    ],
    5: [
        (32, "Классификация химических реакций"),
        (33, "Закон сохранения массы веществ"),
        (34, "Термохимические уравнения"),
        (35, "Молярный объём газов"),
        (36, "Расчёты по уравнениям реакций"),
    ],
}

G9_CURRICULUM = {
    1: [
        (1, "Свойства металлов"),
        (2, "Химические свойства металлов"),
        (3, "Ряд активности металлов"),
        (4, "Коррозия металлов"),
        (5, "Применение металлов"),
        (6, "Повторение"),
    ],
    2: [
        (1, "Алюминий"),
        (2, "Соединения алюминия"),
        (3, "Цинк"),
        (4, "Амфотерные гидроксиды"),
        (5, "Амфотерные оксиды"),
        (6, "Хром и марганец"),
        (7, "Железо"),
        (8, "Повторение"),
    ],
    3: [
        (1, "Электролиты"),
        (2, "Теория электролиза"),
        (3, "Электролиз водных растворов"),
        (4, "Электролиз расплавов"),
        (5, "Выделение водорода и кислорода"),
        (6, "Законы Фарадея"),
        (7, "Получение металлов"),
        (8, "Гальванические элементы"),
        (9, "Лабораторная работа"),
        (10, "Повторение"),
    ],
    4: [
        (1, "Плотность и моль"),
        (2, "Растворы"),
        (3, "Массовая доля"),
        (4, "Химические уравнения"),
        (5, "Избыточный реагент"),
        (6, "Выход продукта"),
        (7, "Кислоты и основания"),
        (8, "Качественный анализ"),
        (9, "Группа анионов"),
        (10, "Группа катионов"),
        (11, "Повторение"),
        (12, "Сборник задач"),
        (13, "Лабораторная работа"),
        (14, "Техника безопасности"),
        (15, "Итоговый анализ"),
    ],
    5: [
        (1, "Химическая промышленность"),
        (2, "Производство серной кислоты"),
        (3, "Экология"),
        (4, "Повторение"),
    ],
    6: [
        (43, "Кристаллические решётки и виды связи"),
        (44, "Скорость реакции, катализ и равновесие"),
        (45, "Реакции ионного обмена"),
        (46, "Гидролиз солей"),
        (47, "Электронный баланс ОВР"),
        (48, "Повторение"),
    ],
    7: [
        (49, "Галогены — систематизация"),
        (50, "Сера и её соединения"),
        (51, "Азот и фосфор"),
        (52, "Углерод и кремний"),
        (53, "Повторение"),
    ],
}

GRADE_META = {
    "g8": {
        "pdf": ROOT / "public" / "textbooks" / "kimyo-8-ru.pdf",
        "out": ROOT / "src" / "data" / "g8BookToc.json",
        "curriculum": G8_CURRICULUM,
        "start_page": 8,
    },
    "g9": {
        "pdf": ROOT / "public" / "textbooks" / "kimyo-9-ru.pdf",
        "out": ROOT / "src" / "data" / "g9BookToc.json",
        "curriculum": G9_CURRICULUM,
        "start_page": 8,
    },
}


def normalize(s: str) -> str:
    s = s.lower()
    s = re.sub(r"[§\.\,\-\—\(\)]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def find_page_for_title(reader: PdfReader, title: str, min_page: int = 0) -> int | None:
    needle = normalize(title)
    words = [w for w in needle.split() if len(w) >= 4]
    if not words:
        words = needle.split()[:2]
    best_page = None
    best_score = 0
    for i, page in enumerate(reader.pages):
        if i < min_page:
            continue
        text = normalize(page.extract_text() or "")
        score = sum(1 for w in words if w in text)
        if score > best_score:
            best_score = score
            best_page = i + 1
    return best_page if best_score >= max(1, len(words) // 2) else None


def build_toc(grade_id: str) -> list[dict]:
    meta = GRADE_META[grade_id]
    reader = PdfReader(str(meta["pdf"]))
    curriculum = meta["curriculum"]
    toc: list[dict] = []
    last_page = meta["start_page"] - 1

    for ch, sections in sorted(curriculum.items()):
        for sec_idx, (sec_num, title_ru) in enumerate(sections):
            page = find_page_for_title(reader, title_ru, min_page=last_page)
            if page is None:
                page = last_page + 4 if last_page else meta["start_page"]
            last_page = max(last_page, page - 1)
            toc.append(
                {
                    "ch": ch,
                    "sec": sec_idx + 1,
                    "kp": sec_num,
                    "page": page,
                    "titleRu": title_ru,
                    "titleEn": title_ru,
                }
            )
    return toc


def main() -> None:
    grade_id = sys.argv[1] if len(sys.argv) > 1 else "g8"
    if grade_id not in GRADE_META:
        raise SystemExit("Use g8 or g9")

    toc = build_toc(grade_id)
    out = GRADE_META[grade_id]["out"]
    out.write_text(json.dumps(toc, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(toc)} entries -> {out}")


if __name__ == "__main__":
    main()
