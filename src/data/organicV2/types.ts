/**
 * Органика v2 — общий контракт данных (план: docs/plans/organic-v2.md).
 *
 * Молекулы и реакции считаются ОФЛАЙН в RDKit (scripts/organic-v2/*.py) и лежат готовым JSON:
 *  - src/data/organicV2/molecules.json — 329 молекул реестра (те же id, что в organicMoleculeRegistry.ts);
 *  - src/data/organicV2/reactions.json — органические реакции учебников Kimyo 10–11 с атомным соответствием
 *    (какой атом слева стал каким атомом справа) и маршруты получения каждой молекулы.
 * В браузере геометрия не «релаксируется» — координаты уже правильные (ETKDGv3 + MMFF94).
 */

/** Гибридизация атома (у H и галогенов — ''). */
export type OV2Hybridization = '' | 'sp' | 'sp2' | 'sp3'

export interface OV2Atom {
  /** символ элемента: C, H, O, N, S, Cl, Br, I, Na, K, … */
  readonly el: string
  /** 3D-координаты, Å (RDKit ETKDGv3 + MMFF94, конформер с наименьшей энергией) */
  readonly p: readonly [number, number, number]
  /** 2D-координаты скелетной формулы (RDKit Compute2DCoords; единица ≈ длина связи) */
  readonly p2: readonly [number, number]
  readonly hyb: OV2Hybridization
  /** частичный заряд (Гастайгер) — для δ+ / δ− */
  readonly q: number
  /** формальный заряд (N⁺ нитрогруппы, O⁻) */
  readonly ch: number
  /** атом ароматического кольца */
  readonly ar: boolean
  /** CIP-метка стереоцентра */
  readonly cip?: 'R' | 'S'
}

export interface OV2Bond {
  readonly a: number
  readonly b: number
  /** кратность в форме Кекуле (школьная запись: бензол — чередование 1 и 2) */
  readonly o: 1 | 2 | 3
  /** связь ароматического кольца (для режима «кольцо с кружком») */
  readonly ar?: boolean
  /** геометрия двойной связи */
  readonly ez?: 'E' | 'Z'
}

/** Функциональная группа: ключ группы и атомы-якоря. Подписи — в i18n по ключу. */
export type OV2GroupKey =
  | 'hydroxyl' | 'phenolOH' | 'carbonylAldehyde' | 'carbonylKetone' | 'carboxyl' | 'ester' | 'ether'
  | 'amino' | 'nitro' | 'halogen' | 'alkene' | 'alkyne' | 'arene' | 'sulfo' | 'nitrile' | 'amide' | 'nitrate'

export interface OV2Group {
  readonly key: OV2GroupKey
  readonly atoms: readonly number[]
}

export interface OV2Molecule {
  /** тот же id, что в ORGANIC_MOLECULES */
  readonly id: string
  /** изомерный SMILES (со стереохимией, где она важна) */
  readonly smiles: string
  readonly inchikey: string
  /** брутто-формула по Хиллу (C₆H₁₄ → "C6H14") */
  readonly formula: string
  readonly atoms: readonly OV2Atom[]
  readonly bonds: readonly OV2Bond[]
  readonly groups: readonly OV2Group[]
  /** кольца — списки индексов атомов */
  readonly rings: readonly (readonly number[])[]
  /** классы школы по учебнику (compoundGradeMap), напр. [10] или [10, 11] */
  readonly grades: readonly number[]
  /** энергия выбранного конформера, MMFF94, ккал/моль (для отладки конвейера; добавлено, необязательное) */
  readonly energy?: number
}

/** Школьный тип органической реакции (по механизму, Kimyo 10). */
export type OV2ReactionType =
  | 'combustion' | 'substitutionRadical' | 'substitution' | 'addition' | 'hydrogenation' | 'halogenation'
  | 'hydrohalogenation' | 'hydration' | 'elimination' | 'dehydration' | 'dehydrogenation'
  | 'dehydrohalogenation' | 'esterification' | 'hydrolysis' | 'polymerization' | 'polycondensation'
  | 'oxidation' | 'reduction' | 'nitration' | 'sulfonation' | 'fermentation' | 'cracking' | 'isomerization'
  | 'wurtz' | 'acidBase' | 'metal' | 'trimerization' | 'other'

/** Участник реакции (одна копия; коэффициент 2 → две копии с разными атомами). */
export interface OV2Species {
  /** id молекулы реестра или 'inorg:<формула>' (H2O, HCl, Cl2, NaOH, …) */
  readonly ref: string
  readonly smiles: string
  readonly side: 'L' | 'R'
  readonly atoms: readonly OV2Atom[]
  readonly bonds: readonly OV2Bond[]
  /**
   * номер соответствия каждого атома: атом слева и атом справа с одинаковым номером — это ОДИН атом
   * (так анимация знает, куда он летит). Номера 1..N уникальны в пределах реакции.
   */
  readonly map: readonly number[]
}

export interface OV2BondChange {
  /** номера соответствия концов связи */
  readonly a: number
  readonly b: number
  /** кратность до (0 — связи не было) и после (0 — связь разорвана) */
  readonly from: 0 | 1 | 2 | 3
  readonly to: 0 | 1 | 2 | 3
}

export interface OV2Reaction {
  readonly id: string
  /** как в учебнике (Unicode) */
  readonly equation: string
  readonly conditions?: string
  readonly type: OV2ReactionType
  /** источник: класс, страница, § и id реакции в equations-g10/g11.json */
  readonly source: { readonly grade: 10 | 11; readonly page?: number; readonly section?: string; readonly bookId?: string }
  /** общая схема с R (показывается на конкретном примере) */
  readonly generic?: boolean
  /** полимеризация показана тремя звеньями */
  readonly polymer?: boolean
  readonly species: readonly OV2Species[]
  /** изменения связей (по номерам соответствия) — для этапов «разрыв» и «образование» */
  readonly changes: readonly OV2BondChange[]
}

export interface OV2ReactionsFile {
  readonly reactions: readonly OV2Reaction[]
  /** id молекулы → id реакций, где она ПРОДУКТ (маршруты «Как образуется / синтез») */
  readonly routes: Readonly<Record<string, readonly string[]>>
  /** id молекулы → id реакций, где она ИСХОДНОЕ вещество (её химические свойства) */
  readonly uses: Readonly<Record<string, readonly string[]>>
}
