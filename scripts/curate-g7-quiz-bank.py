"""Curate high-quality G7 section quizzes: literate Russian, fact-checked.

Uses textbook knowledge + verified school-chemistry facts (cross-checked with
standard definitions: atom structure, air composition ≈78% N2 / 21% O2,
Avogadro 6.02×10²³, valence, acids/bases, etc.).

Writes/merges into g7SectionQuizOverrides.json (keeps hand §1 packs),
then run: python scripts/build-g7-section-quizzes.py

Usage:
  python scripts/curate-g7-quiz-bank.py
"""
from __future__ import annotations

import json
import random
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KNOWLEDGE = ROOT / "src" / "data" / "g7TextbookKnowledge.json"
OVERRIDES = ROOT / "src" / "data" / "g7SectionQuizOverrides.json"
TOC = ROOT / "src" / "data" / "g7BookToc.json"

# Keep fully hand-crafted chapter-1 packs from generate-g7-ch1-overrides.py
KEEP_SECTIONS = {
    "g7-c1-s01",
    "g7-c1-s02",
    "g7-c1-s03",
    "g7-c1-s04",
    "g7-c1-s05",
    "g7-c1-s06",
    "g7-c1-s07",
    "g7-c1-s08",
    "g7-c1-s09",
    "g7-c1-s10",
}

GENERIC_WRONG = [
    "Это относится к другому параграфу учебника",
    "Так в школьном курсе не формулируют",
    "Утверждение противоречит определению",
    "Верно только для другого класса веществ",
]

# Fact packs verified against standard chemistry references (Wikipedia / school texts).
CHAPTER_FACTS: dict[int, list[tuple[str, str, list[str], str]]] = {
    2: [
        (
            "Атом — это…",
            "Электронейтральная частица, состоящая из ядра и электронов",
            ["Только ядро без электронов", "Заряженная молекула", "Смесь двух газов"],
            "Атом электронейтрален: ядро (+) и электроны (−).",
        ),
        (
            "Протон — это…",
            "Положительно заряженная частица ядра атома",
            ["Отрицательная частица оболочки", "Нейтральная частица ядра", "Молекула кислорода"],
            "Протон p⁺ входит в состав ядра, заряд +1.",
        ),
        (
            "Нейтрон — это…",
            "Электрически нейтральная частица ядра атома",
            ["Частица с зарядом +1", "Электрон оболочки", "Ион хлора"],
            "Нейтрон n⁰ не имеет электрического заряда.",
        ),
        (
            "Электрон — это…",
            "Отрицательно заряженная частица электронной оболочки",
            ["Частица ядра с зарядом +1", "Нейтральная частица ядра", "Молекула воды"],
            "Электрон e⁻ движется вокруг ядра, заряд −1.",
        ),
        (
            "Химический элемент — это…",
            "Вид атомов с одинаковым зарядом ядра (числом протонов)",
            ["Любая смесь веществ", "Только молекула H₂O", "Любой предмет"],
            "Элемент = атомы с одинаковым Z (числом протонов).",
        ),
        (
            "Валентность — это…",
            "Способность атома образовывать определённое число химических связей",
            ["Масса атома в граммах", "Цвет вещества", "Температура кипения"],
            "Валентность показывает, сколько связей может образовать атом.",
        ),
        (
            "Моль — это…",
            "Количество вещества, содержащее 6,02·10²³ частиц",
            ["Единица длины", "Только масса в килограммах", "Давление газа"],
            "1 моль содержит число Авогадро частиц ≈ 6,02·10²³.",
        ),
        (
            "Простое вещество состоит из…",
            "Атомов одного химического элемента",
            ["Атомов разных элементов", "Только ионов разных знаков", "Случайной смеси газов"],
            "O₂, Fe, S — простые; H₂O, CO₂ — сложные.",
        ),
    ],
    3: [
        (
            "Периодическая система Менделеева упорядочивает элементы по…",
            "Возрастанию атомного номера и периодическому повторению свойств",
            ["Алфавиту названий", "Цвету простых веществ", "Случайному порядку"],
            "Основа ПС — атомный номер и периодичность свойств.",
        ),
        (
            "Галогены — это элементы…",
            "VIIA группы (F, Cl, Br, I и др.)",
            ["Только благородные газы", "Только щелочные металлы", "Только актиноиды"],
            "Галогены — семейство VIIA группы.",
        ),
        (
            "Период в таблице Менделеева — это…",
            "Горизонтальный ряд элементов",
            ["Вертикальный столбец", "Только металлы", "Только газы"],
            "Периоды — горизонтальные ряды ПС.",
        ),
        (
            "Группа (семейство) в таблице Менделеева — это…",
            "Вертикальный столбец сходных по свойствам элементов",
            ["Только одна строка таблицы", "Список смесей", "Список реакций"],
            "Группы — вертикальные столбцы.",
        ),
    ],
    4: [
        (
            "В сухом воздухе больше всего по объёму…",
            "Азота (около 78 %)",
            ["Кислорода (около 78 %)", "Углекислого газа (около 78 %)", "Водорода (около 78 %)"],
            "Сухой воздух: N₂ ≈ 78 %, O₂ ≈ 21 % (по объёму).",
        ),
        (
            "Объёмная доля кислорода в воздухе примерно…",
            "Около 21 % по объёму",
            ["Около 78 % по объёму", "Около 50 % по объёму", "Около 1 % по объёму"],
            "Кислорода в воздухе ≈ 21 % по объёму.",
        ),
        (
            "Горение — это…",
            "Химическая реакция вещества с кислородом, сопровождающаяся выделением тепла и света",
            ["Только изменение агрегатного состояния", "Механическое измельчение", "Растворение соли в воде без реакции"],
            "Горение — окисление с теплом и светом.",
        ),
        (
            "Оксид — это…",
            "Сложное вещество из двух элементов, один из которых — кислород",
            ["Чистое простое вещество металла", "Смесь азота и аргона", "Любая кислота"],
            "Примеры оксидов: CO₂, H₂O, Fe₂O₃.",
        ),
        (
            "Кислород поддерживает…",
            "Дыхание и горение",
            ["Только фотосинтез без дыхания", "Только плавление льда", "Только фильтрацию"],
            "O₂ необходим для дыхания и горения.",
        ),
    ],
    5: [
        (
            "Водород в таблице Менделеева имеет символ…",
            "H (Hydrogenium)",
            ["He (гелий)", "Hg (ртуть)", "Ho (гольмий)"],
            "Символ водорода — H.",
        ),
        (
            "Кислота в школьном определении — это…",
            "Сложное вещество, образующее в водном растворе ионы H⁺ (H₃O⁺)",
            ["Любой оксид металла", "Чистое простое вещество", "Только твёрдая соль"],
            "Кислоты дают в воде ионы водорода.",
        ),
        (
            "Показатель pH характеризует…",
            "Кислотность или щёлочность раствора",
            ["Только температуру кипения", "Только плотность металла", "Массу моля"],
            "pH < 7 — кислая среда, pH = 7 — нейтральная, pH > 7 — щелочная.",
        ),
        (
            "При взаимодействии кислоты с металлом часто выделяется…",
            "Газообразный водород H₂",
            ["Только азот воздуха", "Только аргон", "Только гелий"],
            "Многие металлы вытесняют H₂ из кислот.",
        ),
    ],
    6: [
        (
            "Химическая формула воды…",
            "H₂O (два атома водорода и один атом кислорода)",
            ["H₂O₂ (пероксид водорода)", "CO₂ (углекислый газ)", "NaCl (поваренная соль)"],
            "Вода — H₂O.",
        ),
        (
            "Основание (гидроксид) — это…",
            "Сложное вещество, образующее в растворе ионы OH⁻",
            ["Любой оксид неметалла", "Чистый азот", "Только кислота"],
            "Основания дают гидроксид-ионы OH⁻.",
        ),
        (
            "Реакция нейтрализации — это…",
            "Взаимодействие кислоты с основанием с образованием соли и воды",
            ["Только горение угля", "Фильтрация смеси", "Возгонка иода"],
            "Кислота + основание → соль + вода.",
        ),
        (
            "Раствор — это…",
            "Однородная смесь растворённого вещества и растворителя",
            ["Только механическая смесь песка и соли", "Чистое простое вещество", "Только газ без растворителя"],
            "Раствор однороден (гомогенен).",
        ),
    ],
    7: [
        (
            "Биогенные элементы — это…",
            "Элементы, необходимые для жизни организмов",
            ["Только благородные газы", "Только искусственные элементы", "Только радиоактивные отходы"],
            "C, H, O, N, P, S и др. — биогенные.",
        ),
        (
            "Углеводы — это…",
            "Органические вещества, состоящие из углерода, водорода и кислорода (сахара и др.)",
            ["Только металлы", "Только соли азотной кислоты", "Только оксиды железа"],
            "Глюкоза, крахмал — углеводы.",
        ),
        (
            "Витамины — это…",
            "Органические вещества, нужные организму в малых количествах",
            ["Только неорганические соли в килограммах", "Только инертные газы", "Только металлы группы железа"],
            "Витамины регулируют обмен веществ.",
        ),
    ],
    8: [
        (
            "Литосфера — это…",
            "Твёрдая оболочка Земли",
            ["Только атмосфера", "Только гидросфера", "Только биосфера без пород"],
            "Литосфера — твёрдая земная оболочка.",
        ),
        (
            "Полезные ископаемые — это…",
            "Природные минеральные образования, используемые человеком",
            ["Только искусственные сплавы", "Только растворы кислот", "Только лабораторные смеси"],
            "Руда, нефть, уголь — полезные ископаемые.",
        ),
        (
            "Экологические аспекты добычи связаны с…",
            "Воздействием на природу при разработке месторождений",
            ["Только названием минерала", "Только цветом руды", "Только температурой плавления без среды"],
            "Добыча влияет на почву, воду и воздух.",
        ),
    ],
}


def clean(s: str) -> str:
    s = re.sub(r"(\w)-\s+(\w)", r"\1\2", s)
    s = re.sub(r"\s+", " ", s).strip()
    s = s.replace(" - ", " – ")
    return s


def shorten(s: str, n: int = 110) -> str:
    s = clean(s)
    if len(s) <= n:
        return s
    return s[:n].rsplit(" ", 1)[0] + "…"


def is_garbage(text: str) -> bool:
    t = text.lower()
    if len(t) < 8:
        return True
    bad = [
        r"какая информация вам",
        r"источник:",
        r"домашнее задание",
        r"ход работы",
        r"рис\.",
        r"www\.",
        r"мысли вслух",
        r"продолжите по учебнику",
        r"фармонов",
        r"хотя яблоко",
        r"задания$",
        r"необходимые оборудован",
    ]
    return any(re.search(p, t) for p in bad)


def parse_definition(defn: str) -> tuple[str, str] | None:
    d = clean(defn)
    if is_garbage(d):
        return None
    for sep in (" – ", " — ", " - "):
        if sep in d:
            left, right = d.split(sep, 1)
            left, right = clean(left), clean(right).rstrip(".")
            if 3 <= len(left) <= 70 and 8 <= len(right) <= 180 and not left.endswith("?"):
                if not is_garbage(left) and not is_garbage(right):
                    return left, right
    m = re.search(r"^(.{3,70}?)\s+это\s+(.{8,180})$", d, re.I)
    if m:
        left, right = clean(m.group(1)), clean(m.group(2)).rstrip(".")
        if not is_garbage(left) and not is_garbage(right):
            return left, right
    return None


def mcq(sid: str, n: int, question: str, correct: str, wrong: list[str], explanation: str) -> dict:
    qid = f"{sid}-q{n:02d}"
    choices = [correct, wrong[0], wrong[1], wrong[2]]
    # Keep correct at index 0 for overrides (engine may shuffle later — bank stores as-is; UI shuffles in some paths)
    # Existing ch1 overrides use correctIndex 0 with correct first — topic quiz engine shuffles choices when drawing.
    return {
        "id": qid,
        "templateKey": qid,
        "question": question if question.endswith(("?", "…")) else question + "…",
        "choices": choices,
        "correctIndex": 0,
        "explanation": shorten(explanation, 200),
        "description": shorten(explanation, 400),
        "visualId": qid,
    }


def pick_wrong(correct: str, pool: list[str]) -> list[str]:
    out: list[str] = []
    for w in pool + GENERIC_WRONG:
        w = shorten(w, 100)
        if w and w != correct and w not in out:
            out.append(w)
        if len(out) >= 3:
            break
    while len(out) < 3:
        out.append(GENERIC_WRONG[len(out) % len(GENERIC_WRONG)])
    return out[:3]


def is_weak_answer(text: str) -> bool:
    t = clean(text)
    if len(t) < 12:
        return True
    # bare noun titles from TOC/concepts without a statement
    if len(t.split()) <= 3 and not re.search(r"[—–-]|\bэто\b|\bявля|\bсосто|\bобразу|\bравен|\bоколо\b|\d", t, re.I):
        return True
    if re.fullmatch(r"[А-ЯЁA-Z][а-яёa-z]+(?:\s+[а-яёa-z]+){0,2}", t) and len(t) < 40:
        return True
    return False


def build_section(sec: dict) -> list[dict]:
    sid = sec["id"]
    topic = sec.get("topicRu", sid)
    ch = int(str(sec.get("chapterId", "c1")).replace("c", "") or "1")
    items: list[dict] = []
    used: set[str] = set()
    pool: list[str] = []

    for d in sec.get("definitionsRu", []):
        qa = parse_definition(d)
        if qa and not is_weak_answer(qa[1]):
            pool.append(qa[1])
    for c in sec.get("conceptsRu", []):
        c = clean(c)
        if len(c) >= 20 and not is_garbage(c) and not is_weak_answer(c):
            pool.append(c)

    def add(q: str, a: str, e: str, wrong: list[str] | None = None) -> None:
        if len(items) >= 8:
            return
        q = clean(q).replace("– —", "—").replace("- —", "—").replace("— —", "—")
        a = shorten(clean(a), 110)
        if len(a) < 8 or is_garbage(a) or is_garbage(q):
            return
        # Verified packs may have short correct answers (e.g. "Дыхание и горение")
        if wrong is None and is_weak_answer(a):
            return
        if re.search(
            r"производится в промышленности\.?$|кисловатый вкус|рассмотренном нами случае",
            a + " " + e,
            re.I,
        ):
            return
        key = a.lower()[:70]
        qkey = q.lower()[:60]
        if key in used or qkey in used:
            return
        used.add(key)
        used.add(qkey)
        w = wrong if wrong and len(wrong) >= 3 else pick_wrong(a, pool)
        items.append(mcq(sid, len(items) + 1, q, a, w[:3], e))

    # Verified section + chapter facts first (internet-checked)
    for q, a, wrong, e in SECTION_FACTS.get(sid, []):
        add(q, a, e, wrong)

    topic_l = topic.lower()
    ranked: list[tuple[int, tuple]] = []
    for fact in CHAPTER_FACTS.get(ch, []):
        q, a, wrong, e = fact
        blob = (q + " " + a).lower()
        score = sum(1 for w in re.findall(r"[а-яё]{4,}", blob) if w in topic_l)
        if any(
            k in topic_l
            for k in ("воздух", "кислород", "водород", "кислот", "вод", "атом", "валент", "нейтрал", "изотоп")
        ):
            if any(k in blob for k in re.findall(r"[а-яё]{5,}", topic_l)):
                score += 3
        ranked.append((score, fact))
    ranked.sort(key=lambda x: -x[0])
    for score, (q, a, wrong, e) in ranked:
        if len(items) >= 8:
            break
        if score < 1 and len(items) >= 4:
            continue
        add(q, a, e, wrong)

    for d in sec.get("definitionsRu", []):
        qa = parse_definition(d)
        if qa:
            add(f"{qa[0]} — это…", qa[1], d)

    for c in sec.get("conceptsRu", []):
        c = clean(c)
        if 25 <= len(c) <= 140 and not is_garbage(c) and not is_weak_answer(c):
            if re.search(r"\b(это|явля|состо|образу|использу|примен|равен|около|называ)\b|[—–]", c, re.I):
                add(f"Какое утверждение верно по теме «{shorten(topic, 40)}»?", c, c)

    for line in sec.get("rememberRu", "").split("\n"):
        line = clean(line.lstrip("•").strip())
        if line.startswith("**") or is_garbage(line) or is_weak_answer(line) or len(line) < 30:
            continue
        if re.search(r"производится|кисловатый|имеются природные и синтетические типы", line, re.I):
            continue
        add(f"Что важно запомнить по теме «{shorten(topic, 36)}»?", line, line)

    for sent in re.split(r"(?<=[.!?])\s+", sec.get("contentRu", "")):
        if len(items) >= 8:
            break
        s = clean(sent)
        if not (50 <= len(s) <= 140) or is_garbage(s) or is_weak_answer(s):
            continue
        if re.match(r"^(но|как|если|тогда|поэтому|однако|также|особой)\b", s, re.I):
            continue
        if not re.match(r"^[А-ЯЁA-Z«]", s):
            continue
        if not re.search(r"\b(это|является|называ|состоит|образу|примен|использу|равен|около)\b", s, re.I):
            continue
        add(f"По учебнику Kimyo, что верно о «{shorten(topic, 32)}»?", s, s)

    for q, a, wrong, e in CHAPTER_FACTS.get(ch, CHAPTER_FACTS[2]):
        if len(items) >= 8:
            break
        add(q, a, e, wrong)

    pads = [
        (
            f"Параграф «{shorten(topic, 42)}» относится к курсу…",
            "Химии 7 класса по учебнику Kimyo",
            "Материал входит в курс химии 7 класса (Kimyo).",
            ["Только астрономии без химии", "Только литературы", "Только черчения"],
        ),
        (
            f"Главный источник фактов по теме «{shorten(topic, 36)}»…",
            "Учебник Kimyo, 7 класс",
            "Опирайтесь на формулировки учебника Kimyo.",
            ["Случайные интернет-мемы", "Только рекламные ролики", "Непроверенные слухи"],
        ),
        (
            f"Проверка знаний по «{shorten(topic, 36)}» нужна, чтобы…",
            "Закрепить определения и факты параграфа",
            "Тест закрепляет ключевые понятия §.",
            ["Забыть весь материал", "Заменить учебник фильмом", "Избежать любых определений"],
        ),
        (
            f"В ответах по теме «{shorten(topic, 36)}» ориентир — это…",
            "Научные формулировки школьного курса химии",
            "Верный ответ должен соответствовать школьной химии.",
            ["Только красивые картинки без смысла", "Случайный набор букв", "Противоречие учебнику"],
        ),
    ]
    for q, a, e, wrong in pads:
        if len(items) >= 8:
            break
        add(q, a, e, wrong)

    fixed = []
    for i, it in enumerate(items[:8], 1):
        qid = f"{sid}-q{i:02d}"
        fixed.append({**it, "id": qid, "templateKey": qid, "visualId": qid})
    return fixed


# Extra verified facts keyed by section id (internet + school standards)
SECTION_FACTS: dict[str, list[tuple[str, str, list[str], str]]] = {
    "g7-c2-s05": [
        (
            "Изотопы — это…",
            "Атомы одного элемента с одинаковым числом протонов, но разным числом нейтронов",
            [
                "Атомы разных элементов с одинаковым числом нейтронов",
                "Молекулы с одинаковой массой без учёта ядер",
                "Только ионы с зарядом +1",
            ],
            "Изотопы: одинаковый Z, разный N (например, ¹H и ²H).",
        ),
        (
            "Изобары — это…",
            "Атомы разных элементов с одинаковым массовым числом A",
            [
                "Атомы одного элемента с разным числом протонов",
                "Молекулы воды разного агрегатного состояния",
                "Только электроны на внешнем уровне",
            ],
            "Изобары: одинаковое A, разный Z.",
        ),
        (
            "Изотоны — это…",
            "Атомы разных элементов с одинаковым числом нейтронов",
            [
                "Атомы одного элемента с одинаковым Z и N",
                "Только благородные газы",
                "Смеси кислорода и азота",
            ],
            "Изотоны: одинаковый N, разный Z.",
        ),
    ],
    "g7-c4-s01": [
        (
            "Воздух — это…",
            "Смесь газов, в основном азота и кислорода",
            ["Чистое простое вещество", "Только углекислый газ", "Только водяной пар"],
            "Воздух — смесь; сухо: ≈78 % N₂ и ≈21 % O₂.",
        ),
        (
            "В сухом воздухе больше всего по объёму…",
            "Азота (около 78 %)",
            ["Кислорода (около 78 %)", "Аргона (около 78 %)", "CO₂ (около 78 %)"],
            "Азот — главный компонент сухого воздуха по объёму.",
        ),
    ],
    "g7-c5-s04": [
        (
            "Кислота — это…",
            "Сложное вещество, дающее в водном растворе ионы водорода H⁺ (H₃O⁺)",
            ["Любой оксид металла", "Чистое простое вещество H₂", "Только щёлочь NaOH"],
            "Кислоты в воде образуют ионы водорода.",
        ),
        (
            "Примеры кислот из школьного курса…",
            "HCl, H₂SO₄, HNO₃, CH₃COOH",
            ["Только NaCl и KCl", "Только O₂ и N₂", "Только Fe и Cu"],
            "Соляная, серная, азотная, уксусная — кислоты.",
        ),
    ],
    "g7-c6-s06": [
        (
            "Реакция нейтрализации — это…",
            "Взаимодействие кислоты с основанием с образованием соли и воды",
            ["Только горение углерода", "Фильтрация песка", "Возгонка иода без реакции"],
            "Кислота + основание → соль + вода (H⁺ + OH⁻ → H₂O).",
        ),
        (
            "Пример нейтрализации…",
            "HCl + NaOH → NaCl + H₂O",
            ["2H₂ + O₂ → 2H₂O (только горение водорода)", "O₂ → O₃ без реагентов", "NaCl → Na + Cl₂ при комнатной температуре без тока"],
            "Классический пример: HCl + NaOH.",
        ),
    ],
}


def main() -> None:
    random.seed(42)
    knowledge = json.loads(KNOWLEDGE.read_text(encoding="utf-8"))
    existing = json.loads(OVERRIDES.read_text(encoding="utf-8")) if OVERRIDES.is_file() else {}

    out: dict[str, list] = {k: v for k, v in existing.items() if k in KEEP_SECTIONS}
    built = 0
    for sec in knowledge["sections"]:
        sid = sec["id"]
        if sid in KEEP_SECTIONS:
            continue
        pack = build_section(sec)
        out[sid] = pack
        built += 1

    OVERRIDES.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Curated overrides: kept {len(KEEP_SECTIONS)} hand packs, built {built} sections, total keys {len(out)}")


if __name__ == "__main__":
    main()
