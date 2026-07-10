"""Generate g10/g11 TOC JSON + i18n outline snippets from textbook structure.

Run: python scripts/gen-g10-g11-curriculum.py
"""
from __future__ import annotations

import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Grade 10 — Kimyo 10 (organic), pages from PDF TOC
G10 = {
    1: {
        "titleRu": "Начальные понятия о теории строения органической химии",
        "titleEn": "Introduction to organic structure theory",
        "titleUz": "Organik kimyo tuzilishi nazariyasi haqida boshlang'ich tushunchalar",
        "summaryRu": "История органики, теория строения, изомерия, номенклатура, типы реакций.",
        "summaryEn": "History of organic chemistry, structure theory, isomerism, nomenclature.",
        "summaryUz": "Organik kimyo tarixi, tuzilish nazariyasi, izomeriya, nomenklatura.",
        "totem": "co2",
        "sections": [
            (1, 7, "История органической химии. Специфические свойства органических соединений"),
            (2, 12, "Теория строения органических соединений"),
            (3, 15, "Валентность и степени окисления углерода в органических соединениях"),
            (4, 18, "Изомерия и её виды"),
            (5, 22, "Классификация органических соединений"),
            (6, 26, "Типы реакций, характерных для органических соединений"),
            (7, 29, "Номенклатура органических соединений"),
            (8, 33, "Решение задач по номенклатуре и изомерии"),
            (9, 35, "Практическое занятие. Образцы органических соединений"),
            (10, 37, "Практическое занятие. Анализ состава органических соединений"),
        ],
    },
    2: {
        "titleRu": "Углеводороды",
        "titleEn": "Hydrocarbons",
        "titleUz": "Uglevodorodlar",
        "summaryRu": "Алканы, циклоалканы, алкены, алкадиены, алкины, арены, природные источники.",
        "summaryEn": "Alkanes, cycloalkanes, alkenes, alkadienes, alkynes, aromatics, natural sources.",
        "summaryUz": "Alkanlar, tsikloalkanlar, alkenlar, alkadienlar, alkinlar, arenlar.",
        "totem": "co2",
        "sections": [
            (1, 39, "Алканы"),
            (2, 43, "Изомерия и названия алканов"),
            (3, 46, "Получение и физические свойства алканов"),
            (4, 48, "Химические свойства и применение алканов"),
            (5, 51, "Строение циклоалканов. Изомерия. Номенклатура"),
            (6, 54, "Получение, свойства и применение циклоалканов"),
            (7, 56, "Алкены. Номенклатура. Изомерия"),
            (8, 59, "Получение, свойства и применение алкенов"),
            (9, 62, "Практическое занятие. Получение и свойства этилена"),
            (10, 63, "Алкадиены. Гомологический ряд. Изомерия"),
            (11, 66, "Получение, свойства, применение алкадиенов"),
            (12, 69, "Каучук. Резина"),
            (13, 72, "Алкины. Гомологический ряд. Изомерия. Номенклатура"),
            (14, 74, "Получение, свойства, применение алкинов"),
            (15, 77, "Ароматические углеводороды. Гомологический ряд. Изомерия"),
            (16, 79, "Получение, свойства, применение ароматических углеводородов"),
            (17, 82, "Стирол: производство, свойства, применение"),
            (18, 84, "Природные источники углеводородов. Природный газ"),
            (19, 88, "Нефть и нефтепереработка"),
            (20, 92, "Каменный уголь"),
            (21, 95, "Практическое занятие. Шаростержневые модели углеводородов"),
            (22, 96, "Эффективное использование природных источников углеводородов"),
            (23, 100, "Задачи по классам углеводородов"),
            (24, 103, "Задачи на закрепление главы"),
        ],
    },
    3: {
        "titleRu": "Кислородные органические соединения",
        "titleEn": "Oxygen-containing organic compounds",
        "titleUz": "Kislorodli organik birikmalar",
        "summaryRu": "Спирты, фенолы, альдегиды, кетоны, карбоновые кислоты, эфиры, жиры, углеводы.",
        "summaryEn": "Alcohols, phenols, aldehydes, ketones, carboxylic acids, esters, fats, carbohydrates.",
        "summaryUz": "Spirtlar, fenollar, aldegidlar, ketonlar, karbon kislotalar, efirlar, yog'lar, uglevodlar.",
        "totem": "h2o",
        "sections": [
            (1, 107, "Насыщенные одноатомные спирты. Гомологический ряд. Номенклатура. Изомерия"),
            (2, 110, "Получение, свойства и применение насыщенных одноатомных спиртов"),
            (3, 115, "Многоатомные спирты"),
            (4, 119, "Этиленгликоль. Свойства глицерина"),
            (5, 122, "Практическое занятие. Опыты с многоатомными спиртами"),
            (6, 123, "Фенолы и ароматические спирты"),
            (7, 127, "Фенолы и ароматические спирты. Получение. Применение"),
            (8, 130, "Простые эфиры. Получение и свойства"),
            (9, 133, "Оксосоединения. Альдегиды. Получение и свойства"),
            (10, 136, "Практическое занятие. Реакции спиртов и альдегидов"),
            (11, 137, "Кетоны. Получение и свойства"),
            (12, 140, "Карбоновые кислоты. Получение и свойства"),
            (13, 144, "Решение задач по теме «Карбоновые кислоты»"),
            (14, 146, "Сложные эфиры"),
            (15, 150, "Практическое занятие. Сложные эфиры в составе растений"),
            (16, 152, "Жиры. Получение и свойства"),
            (17, 155, "Практическое занятие. Получение мыла из жиров"),
            (18, 156, "Углеводы. Моносахариды"),
            (19, 160, "Дисахариды. Мальтоза. Сахароза"),
            (20, 163, "Полисахариды. Крахмал. Целлюлоза"),
            (21, 167, "Практическое занятие. Опыты с углеводами"),
            (22, 169, "Природные и искусственные волокна"),
            (23, 173, "Практическое занятие. Определение органических соединений"),
            (24, 175, "Решение задач и упражнений (1)"),
            (25, 178, "Решение задач и упражнений (2)"),
        ],
    },
    4: {
        "titleRu": "Окружающая среда. Охрана окружающей среды",
        "titleEn": "Environment and environmental protection",
        "titleUz": "Atrof-muhit. Atrof-muhitni muhofaza qilish",
        "summaryRu": "Промышленность органики, отходы и технологии переработки.",
        "summaryEn": "Organic industry, waste and recycling technologies.",
        "summaryUz": "Organik sanoat, chiqindilar va qayta ishlash texnologiyalari.",
        "totem": "co2",
        "sections": [
            (1, 182, "Промышленность по переработке органических веществ"),
            (2, 185, "Органические отходы и технологии их переработки"),
            (3, 189, "Практическое занятие. Переработка бумаги"),
        ],
    },
}

# Grade 11 — Umumiy kimyo (general chemistry), pages from standard TOC
G11 = {
    1: {
        "titleRu": "Строение атомов и молекул. Периодический закон",
        "titleEn": "Atomic and molecular structure. Periodic law",
        "titleUz": "Atom va molekulalar tuzilishi. Davriy qonun",
        "summaryRu": "Строение атома, периодический закон, химическая связь, кристаллические решётки.",
        "summaryEn": "Atomic structure, periodic law, chemical bonding, crystal lattices.",
        "summaryUz": "Atom tuzilishi, davriy qonun, kimyoviy bog'lanish, kristall panjaralar.",
        "totem": "h2o",
        "sections": [
            (1, 4, "Строение атома"),
            (2, 11, "Периодический закон. Периодическая система Д. И. Менделеева"),
            (3, 16, "Состав атома. Ядерные реакции"),
            (4, 23, "Типы химических связей. Кристаллические решётки"),
        ],
    },
    2: {
        "titleRu": "Количество вещества",
        "titleEn": "Amount of substance",
        "titleUz": "Modda miqdori",
        "summaryRu": "Моль, закон Авогадро, эквивалент, уравнение Менделеева–Клапейрона.",
        "summaryEn": "Mole, Avogadro's law, equivalent, Mendeleev–Clapeyron equation.",
        "summaryUz": "Mol, Avogadro qonuni, ekvivalent, Mendeleyev–Klapeyron tenglamasi.",
        "totem": "co2",
        "sections": [
            (1, 31, "Количество вещества"),
            (2, 34, "Закон Авогадро. Смеси газов"),
            (3, 39, "Эквивалент"),
            (4, 45, "Уравнение Менделеева–Клапейрона"),
        ],
    },
    3: {
        "titleRu": "Электролиты. Диссоциация. Гидролиз",
        "titleEn": "Electrolytes. Dissociation. Hydrolysis",
        "titleUz": "Elektrolitlar. Dissotsiatsiya. Gidroliz",
        "summaryRu": "Сильные и слабые электролиты, ионные уравнения, гидролиз солей.",
        "summaryEn": "Strong and weak electrolytes, ionic equations, salt hydrolysis.",
        "summaryUz": "Kuchli va kuchsiz elektrolitlar, ionli tenglamalar, tuzlar gidrolizi.",
        "totem": "nacl",
        "sections": [
            (1, 51, "Сильные и слабые электролиты"),
            (2, 54, "Степень диссоциации. Краткие и полные ионные уравнения"),
            (3, 58, "Гидролиз солей и среда раствора"),
        ],
    },
    4: {
        "titleRu": "Растворы",
        "titleEn": "Solutions",
        "titleUz": "Eritmalar",
        "summaryRu": "Растворимость, массовая доля, молярная и нормальная концентрации.",
        "summaryEn": "Solubility, mass percent, molar and normal concentrations.",
        "summaryUz": "Eruvchanlik, massa ulushi, molyar va normal konsentratsiya.",
        "totem": "h2o",
        "sections": [
            (1, 62, "Понятие о растворах"),
            (2, 65, "Растворимость"),
            (3, 70, "Задачи на растворимость"),
            (4, 73, "Концентрация раствора. Процентная концентрация"),
            (5, 76, "Задачи на процентную концентрацию"),
            (6, 84, "Связь процентной концентрации, массы, объёма и плотности"),
            (7, 86, "Молярная концентрация"),
            (8, 88, "Нормальная концентрация"),
            (9, 92, "Связь процентной и молярной концентраций"),
            (10, 94, "Связь процентной и нормальной концентраций"),
        ],
    },
    5: {
        "titleRu": "Скорость химической реакции",
        "titleEn": "Chemical reaction rate",
        "titleUz": "Kimyoviy reaksiya tezligi",
        "summaryRu": "Скорость реакции, влияние условий, катализ, расчётные задачи.",
        "summaryEn": "Reaction rate, effect of conditions, catalysis, calculation problems.",
        "summaryUz": "Reaksiya tezligi, sharoitlar ta'siri, kataliz, hisob-kitob masalalari.",
        "totem": "h2o",
        "sections": [
            (1, 98, "Понятие о скорости реакции"),
            (2, 104, "Влияние давления, объёма и температуры. Катализатор"),
            (3, 109, "Задачи по теме «Скорость реакции»"),
        ],
    },
    6: {
        "titleRu": "Химическое равновесие",
        "titleEn": "Chemical equilibrium",
        "titleUz": "Kimyoviy muvozanat",
        "summaryRu": "Обратимые реакции, равновесие и факторы, влияющие на него.",
        "summaryEn": "Reversible reactions, equilibrium and factors that shift it.",
        "summaryUz": "Qaytar reaksiyalar, muvozanat va unga ta'sir etuvchi omillar.",
        "totem": "h2o",
        "sections": [
            (1, 112, "Обратимые и необратимые реакции. Химическое равновесие"),
            (2, 116, "Факторы, влияющие на химическое равновесие"),
            (3, 121, "Задачи по теме «Химическое равновесие»"),
        ],
    },
    7: {
        "titleRu": "Окислительно-восстановительные реакции",
        "titleEn": "Redox reactions",
        "titleUz": "Oksidlanish-qaytarilish reaksiyalari",
        "summaryRu": "Метод полуреакций, влияние среды, эквиваленты в ОВР.",
        "summaryEn": "Half-reaction method, medium effects, equivalents in redox.",
        "summaryUz": "Yarim reaksiya usuli, muhit ta'siri, OVR da ekvivalentlar.",
        "totem": "fe2o3",
        "sections": [
            (1, 127, "Уравнивание ОВР методом полуреакций"),
            (2, 132, "ОВР и среда раствора"),
            (3, 135, "Эквивалентные массы веществ в ОВР"),
        ],
    },
    8: {
        "titleRu": "Электролиз",
        "titleEn": "Electrolysis",
        "titleUz": "Elektroliz",
        "summaryRu": "Электролиз растворов и расплавов, законы Фарадея, задачи.",
        "summaryEn": "Electrolysis of solutions and melts, Faraday's laws, problems.",
        "summaryUz": "Eritma va suyuqlanma elektrolizi, Faraday qonunlari, masalalar.",
        "totem": "nacl",
        "sections": [
            (1, 139, "Понятие об электролизе. Электролиз растворов и расплавов"),
            (2, 144, "Законы электролиза"),
            (3, 149, "Задачи по теме «Электролиз»"),
        ],
    },
}


def toc_entries(grade_data: dict) -> list[dict]:
    out = []
    for ch, meta in sorted(grade_data.items()):
        for sec, page, title in meta["sections"]:
            out.append(
                {
                    "ch": ch,
                    "sec": sec,
                    "kp": sec,
                    "page": page,
                    "titleRu": title,
                    "titleEn": title,
                }
            )
    return out


def roman(n: int) -> str:
    return ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"][n - 1]


def emit_outline(lang: str, grade: str, data: dict) -> list[str]:
    lines: list[str] = []
    grade_num = grade[1:]
    if lang == "ru":
        lines.append(f"  'learn.{grade}.title': '{grade_num} класс',")
        if grade == "g10":
            lines.append(
                "  'learn.g10.textbook': 'Kimyo, 10 класс (Исматов и др., 2022) — органическая химия',"
            )
        else:
            lines.append(
                "  'learn.g11.textbook': 'Umumiy kimyo, 11 класс — общая химия',"
            )
    elif lang == "en":
        lines.append(f"  'learn.{grade}.title': 'Grade {grade_num}',")
        if grade == "g10":
            lines.append(
                "  'learn.g10.textbook': 'Kimyo, grade 10 (Ismatov et al., 2022) — organic chemistry',"
            )
        else:
            lines.append(
                "  'learn.g11.textbook': 'Umumiy kimyo, grade 11 — general chemistry',"
            )
    else:
        lines.append(f"  'learn.{grade}.title': '{grade_num}-sinf',")
        if grade == "g10":
            lines.append(
                "  'learn.g10.textbook': 'Kimyo, 10-sinf (Ismatov va boshq., 2022) — organik kimyo',"
            )
        else:
            lines.append(
                "  'learn.g11.textbook': 'Umumiy kimyo, 11-sinf — umumiy kimyo',"
            )

    for ch, meta in sorted(data.items()):
        title = meta[f"title{lang.capitalize()}" if lang != "uz" else "titleUz"]
        summary = meta[f"summary{lang.capitalize()}" if lang != "uz" else "summaryUz"]
        if lang == "ru":
            ch_title = f"Глава {roman(ch)}. {title}"
            sec_prefix = "§"
        elif lang == "en":
            ch_title = f"Chapter {ch}. {title}"
            sec_prefix = "§"
        else:
            ch_title = f"{roman(ch)} bob. {title}"
            sec_prefix = "§"
        lines.append(f"  'learn.{grade}.c{ch}.title': {json.dumps(ch_title, ensure_ascii=False)},")
        lines.append(f"  'learn.{grade}.c{ch}.summary': {json.dumps(summary, ensure_ascii=False)},")
        for sec, _page, sec_title in meta["sections"]:
            sid = f"s{sec:02d}"
            full = f"{sec_prefix}{sec}. {sec_title}"
            lines.append(
                f"  'learn.{grade}.c{ch}.{sid}.title': {json.dumps(full, ensure_ascii=False)},"
            )
        lines.append("")
    return lines


def copy_pdfs() -> None:
    dest = ROOT / "public" / "textbooks"
    dest.mkdir(parents=True, exist_ok=True)
    mapping = {
        "10": ("kimyo-10-ru-2022.pdf", 192),
        "11": ("kimyo-11-ru.pdf", 160),
    }
    for d in ROOT.iterdir():
        if not d.is_dir() or "книга" not in d.name:
            continue
        for key, (name, _) in mapping.items():
            if key not in d.name:
                continue
            for f in d.iterdir():
                if f.suffix.lower() == ".pdf":
                    target = dest / name
                    if not target.exists() or target.stat().st_size != f.stat().st_size:
                        shutil.copy2(f, target)
                        print(f"copied {f.name} -> {target.name}")
                    else:
                        print(f"ok {target.name}")


def main() -> None:
    copy_pdfs()
    data_dir = ROOT / "src" / "data"
    g10 = toc_entries(G10)
    g11 = toc_entries(G11)
    (data_dir / "g10BookToc.json").write_text(
        json.dumps(g10, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (data_dir / "g11BookToc.json").write_text(
        json.dumps(g11, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"g10: {len(g10)} sections, g11: {len(g11)} sections")

    meta = {
        "g10": {
            ch: {
                "totem": m["totem"],
                "sectionCount": len(m["sections"]),
            }
            for ch, m in G10.items()
        },
        "g11": {
            ch: {
                "totem": m["totem"],
                "sectionCount": len(m["sections"]),
            }
            for ch, m in G11.items()
        },
    }
    (data_dir / "g10g11ChapterMeta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    out_dir = ROOT / "scripts" / "_generated"
    out_dir.mkdir(exist_ok=True)
    for lang in ("ru", "en", "uz"):
        for grade, data in (("g10", G10), ("g11", G11)):
            text = "\n".join(emit_outline(lang, grade, data))
            (out_dir / f"{grade}Outline{lang.capitalize()}.tsfrag").write_text(
                text + "\n", encoding="utf-8"
            )
    print("wrote outline fragments to scripts/_generated/")


if __name__ == "__main__":
    main()
