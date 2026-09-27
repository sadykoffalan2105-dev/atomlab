import type { AngleKey, BondKey } from '../../../../chemistry/data/bondData'

/**
 * СПЕЦИФИКАЦИЯ ШКОЛЬНОЙ СЦЕНЫ «образование молекулы» (Kimyo 7–8): сцена задаётся ДАННЫМИ, рисует её
 * один класс SchoolReactionScene (по образцу NaClReactionScene). Спецификацию пишет химик — движок её
 * не правит, тест scripts/test-school-scene.mts её проверяет.
 *
 * Модель электронов — школьная (Льюис): у каждого атома считаются ТОЛЬКО электроны внешнего слоя
 * (H 1, C 4, N 5, O 6, S 6 — см. chemistry/data/electronLevels). Каждый электрон внешнего слоя в каждой
 * фазе сцены принадлежит ровно одному «месту»:
 *   • общей паре связи (две точки между ядрами);
 *   • неподелённой паре атома (две точки у атома);
 *   • неспаренному электрону (одна точка с мягким свечением).
 * Для каждого атома в каждой фазе:
 *   вклад в общие пары + 2 · неподелённые пары + неспаренные = число электронов внешнего слоя.
 * Вклад в пару: 'ab' — по одному электрону от каждого атома (обменный механизм, как в учебнике);
 * 'a' — оба электрона от атома a (донорно-акцепторная пара, a — донор; CO, N₂O, N₂O₅); 'b' — оба от b.
 *
 * Фазы сцены (шаги урока фиксированы — SCHOOL_STEP_IDS):
 *   1 reactants — исходные вещества (молекулы в местах place, связи штрихами, подписи «газ», «2 : 1»);
 *   2 atoms     — строение атомов: облака внешнего слоя, электроны точками (пары связи между ядрами,
 *                 неподелённые пары у атомов), схема слоёв (H +1 )1; O +8 )2 )6);
 *   3 breaking  — разрыв связей исходных молекул, которых нет в продуктах: каждая общая пара 'ab'
 *                 расходится по одному электрону к атомам (гомолиз), пара 'a' уходит к донору; атомы
 *                 (и сохранившиеся фрагменты) расходятся в позиции split;
 *   4 pairs     — образование общих пар в порядке products[].bonds: облака перекрываются, по электрону
 *                 от каждого атома сходятся в пару между ядрами;
 *   5 molecule  — пары превращаются в штрихи связей (кратная связь — 2 или 3 штриха), геометрия
 *                 встаёт точно по ядру (длины из bondData, углы из BOND_ANGLES), неподелённые пары видны;
 *   6 result    — облёт итоговых молекул, уравнение, баланс атомов, наблюдение из учебника.
 * Связь «сохраняется», если та же пара атомов связана и в реагентах, и в продуктах (NO + O₂ → NO₂:
 * N=O остаётся); лишние пары продукта образуются, лишние пары реагента рвутся.
 *
 * ЕДИНИЦЫ: координаты — пикометры (пм) в системе сцены: x вправо, y вверх, z к зрителю. Движок сам
 * переводит пм в размер сцены (одинаковый масштаб для всех веществ).
 */

export type SchoolLocale = 'ru' | 'en' | 'uz'

/** Текст на трёх языках. DOM-текст: индексы и заряды — настоящими символами (₂, ⁺, ⁻, →). */
export type SchoolText = Readonly<Record<SchoolLocale, string>>

/** Точка в пм: [x, y, z]. */
export type SchoolVec3 = readonly [number, number, number]

export const SCHOOL_STEP_IDS = ['reactants', 'atoms', 'breaking', 'pairs', 'molecule', 'result'] as const

export type SchoolStepId = (typeof SCHOOL_STEP_IDS)[number]

/** Происхождение электронов общей пары: 'ab' — по одному от a и b; 'a' / 'b' — оба от донора a / b. */
export type SchoolPairOrigin = 'ab' | 'a' | 'b'

/** Элементы школьных сцен (у каждого — z, электроны внешнего слоя, CPK-цвет в движке). */
export type SchoolElement = 'H' | 'C' | 'N' | 'O' | 'S' | 'Na' | 'Cl'

export type SchoolAtomSpec = {
  /** Уникальный в сцене id: 'O1', 'H3'. */
  readonly id: string
  readonly element: SchoolElement
}

export type SchoolBondSpec = {
  readonly a: string
  readonly b: string
  /**
   * Общие пары связи; число пар = порядок связи (1 — одинарная, 2 — двойная, 3 — тройная).
   * Первая пара — σ (на оси), остальные — π (рисуются рядом с осью).
   */
  readonly pairs: readonly SchoolPairOrigin[]
  /** Длина из научного ядра (bondData.ts). Тест требует |coords(a) − coords(b)| = длине ± 0,5 пм. */
  readonly bondKey?: BondKey
  /** Если ключа в ядре нет: длина (пм) и источник (NIST CCCBDB …). Используется, только когда нет bondKey. */
  readonly lengthPm?: number
  readonly source?: string
}

export type SchoolAngleSpec = {
  /** Угол a–center–b. */
  readonly a: string
  readonly center: string
  readonly b: string
  /** Угол из ядра (BOND_ANGLES); без ключа — deg + source. Тест: ± 0,5°. */
  readonly angleKey?: AngleKey
  readonly deg?: number
  readonly source?: string
}

export type SchoolMoleculeSpec = {
  /** Уникальный id молекулы в сцене: 'H2a', 'W1'. */
  readonly id: string
  /** Формула для подписи: 'H₂', 'H₂O'. */
  readonly formula: string
  /** Агрегатное состояние при условиях реакции (подпись «газ» / «тв.»). */
  readonly state: 'g' | 'l' | 's' | 'aq'
  /** id атомов (атом входит ровно в одну молекулу реагентов и ровно в одну молекулу продуктов). */
  readonly atoms: readonly string[]
  readonly bonds: readonly SchoolBondSpec[]
  /** Неподелённые пары: id атома → число пар (атомы без пар можно не указывать). */
  readonly lonePairs?: Readonly<Record<string, number>>
  /** Неспаренные электроны (NO, NO₂, атом C в реагентах): id атома → число. */
  readonly unpaired?: Readonly<Record<string, number>>
  /** Координаты атомов, пм, в системе молекулы (центр — у центрального атома или в центре масс). */
  readonly coords: Readonly<Record<string, SchoolVec3>>
  /** Углы, которые проверяет тест (и подписывает сцена на шаге molecule). */
  readonly angles?: readonly SchoolAngleSpec[]
  /** Сдвиг молекулы в сцене, пм (реагенты — на шагах reactants/atoms; продукты — molecule/result). */
  readonly place: SchoolVec3
}

/**
 * Электроны свободного атома после разрыва (шаги breaking → pairs), если их надо показать иначе, чем
 * получается из разрыва: например, C в CO₂ — 4 неспаренных (возбуждённое состояние, валентность IV).
 * 2 · lone + unpaired обязано равняться числу электронов внешнего слоя.
 */
export type SchoolSplitElectrons = { readonly lone: number; readonly unpaired: number }

export type SchoolStepText = {
  readonly title: string
  /** 2–4 предложения для панели урока. */
  readonly body: string
  /** Уравнение или схема стадии (строка DOM). */
  readonly equation: string
  /** Честная оговорка об упрощении (школьная модель против реальности). */
  readonly note?: string
  /** Короткая реплика учителя. */
  readonly speak: string
}

export type SchoolLessonText = {
  readonly intro: { readonly title: string; readonly speak: string }
  readonly steps: Readonly<Record<SchoolStepId, SchoolStepText>>
  readonly legend: {
    /** Точка-электрон внешнего слоя. */
    readonly electron: string
    /** Общая пара / штрих связи. */
    readonly sharedPair: string
    /** Неподелённая пара. */
    readonly lonePair: string
    /** Неспаренный электрон (есть не у всех сцен — тогда пустая строка). */
    readonly unpaired: string
  }
  readonly safety: string
}

export type SchoolStepTiming = {
  readonly id: SchoolStepId
  /** Время сюжета, с (сплошное: to шага = from следующего; всего 26–34 с). */
  readonly from: number
  readonly to: number
}

export type SchoolSceneSpec = {
  /** Ключ сцены: 'h2o', 'co2', 'no' … (папка, id урока). */
  readonly id: string
  /** Формула продукта-героя (как в каталоге): 'H₂O'. */
  readonly product: string
  /** Уравнение: '2H₂ + O₂ → 2H₂O'. */
  readonly equation: string
  /** Откуда реакция: учебник, класс, параграф, страница. */
  readonly textbook: { readonly grade: number; readonly section?: string; readonly page: number }
  readonly atoms: readonly SchoolAtomSpec[]
  readonly reactants: readonly SchoolMoleculeSpec[]
  readonly products: readonly SchoolMoleculeSpec[]
  /**
   * Позиции атомов, пм, в конце шага breaking (свободные атомы / фрагменты расходятся). Обязательны
   * для всех атомов. Сохранившиеся связи фрагмента обязаны сохранить длину (тест).
   */
  readonly split: Readonly<Record<string, SchoolVec3>>
  /** Необязательная перестройка электронов свободного атома (см. SchoolSplitElectrons). */
  readonly splitElectrons?: Readonly<Record<string, SchoolSplitElectrons>>
  /** Шесть шагов по порядку SCHOOL_STEP_IDS. */
  readonly steps: readonly SchoolStepTiming[]
  /** Подписи в 3D (коротко): условия реакции, «газ», наблюдение. */
  readonly captions: {
    /** Подпись над реагентами на шаге reactants: 'гремучая смесь 2 : 1'. */
    readonly reactants: SchoolText
    /** Подпись над продуктами на шаге result: 'вода — H–O–H, 104,5°'. */
    readonly result: SchoolText
    /** Условие реакции (над стрелкой): 'поджиг', 't°', 'кат. V₂O₅'. */
    readonly condition?: SchoolText
  }
  readonly text: Readonly<Record<SchoolLocale, SchoolLessonText>>
}
