import { CLO2_CUES, CLO2_STEPS, clo2StepById, clo2StepIndexAt, type Clo2CueId, type Clo2StepId } from './clo2Steps'

/**
 * Энергетика урока ClO₂: чистые функции и константы для DOM-виджетов
 * (энергетический профиль, счётчик электронов) и для тестов. Без THREE и React.
 *
 * Всё, что можно посчитать, считается здесь из измеренных величин — числа в
 * профиле не вбиты руками. Источники:
 *   • k₁ (Cl₂ + ClO₂⁻ → ClOClO + Cl⁻) = (5,7 ± 0,2)·10⁵ М⁻¹с⁻¹, 25 °C —
 *     Nicoson & Margerum, Inorg. Chem. 2002, 41, 342 (PubMed 11800623).
 *     Там же: хлорат образуется из Cl₂O₂ и воды, поэтому избыток хлорита
 *     сдвигает выход к ClO₂; выход ClO₂ «заметно меньше 100 %».
 *   • Angyal, Fábián, Szabó, Inorg. Chem. 2023 (PMC10091416) — модель системы HOCl–ClO₂⁻:
 *       R5  Cl₂ + ClO₂⁻ → Cl₂O₂ + Cl⁻            k = 5,0·10⁵ (взято как заданное, не новое измерение)
 *       R7  Cl₂O₂ + ClO₂⁻ → 2 ClO₂ + Cl⁻         k = 1,0·10⁵ М⁻¹с⁻¹
 *       R9  Cl₂O₂ + ClO₂⁻ + H₂O → 2 HOCl + ClO₃⁻  k = 3,9·10⁴ М⁻¹с⁻¹ (вода в константе)
 *     В модели есть и R8 Cl₂O₂ + HClO₂ → 2 ClO₂, R10 Cl₂O₂ + HOCl → ClO₃⁻, а главный
 *     источник хлората там — R6 Cl₂O + HClO₂. Вывод авторов: избыток ClO₂⁻ (и Cl⁻)
 *     сдвигает выход к ClO₂ — это СОГЛАСУЕТСЯ с Nicoson & Margerum 2002. Отличие одно:
 *     вместо прямого гидролиза Cl₂O₂ в модели 2023 г. — реакции R9/R10.
 *     Соотношение 72 : 28 ниже — только отношение R7 : R9 (доли Cl₂O₂ по этим двум путям),
 *     а не соотношение продуктов: путь R7 даёт 2 ClO₂, путь R9 — 1 ClO₃⁻.
 *     Энергий переходных состояний модель не даёт.
 *   • ΔfG° (NBS, 298,15 K, кДж/моль): ClO₂⁻(aq) +17,2; ClO₃⁻(aq) −7,95; HOCl(aq) −79,9;
 *     Cl⁻(aq) −131,228; H₂O(ж) −237,129; Cl₂(г) 0 — для уровня конца хлоратной ветки.
 *   • Комплекс [ClOCl(O)OClO]⁻ и его распад по двум путям — Jia, Margerum &
 *     Francisco, Inorg. Chem. 2000, 39, 2614 (расчёт: «структура возможна»).
 *   • E°(Cl₂(г)/Cl⁻) = 1,358 В; E°(ClO₂/ClO₂⁻) = 0,954 В (в другой сводке 0,936 В;
 *     см. J. Phys. Chem. C, doi 10.1021/acs.jpcc.2c08136).
 *
 * Оговорки, без которых график врёт:
 *   • ΔG‡ по Эйрингу — КАЖУЩИЕСЯ барьеры (κ = 1, стандарт 1 М, 298,15 K),
 *     каждый отсчитан от СВОИХ реагентов; сравнивать высоты разных стадий на
 *     одной абсолютной шкале нельзя;
 *   • медленная стадия определяется стационарной кинетикой, а не высотой пика;
 *   • глубина ям ClOClO и комплекса не измерена — на рисунке это схема;
 *   • ΔG° отнесён к Cl₂ в стандартном состоянии газа.
 */

// ——— Физические константы (CODATA 2018, точные значения SI) ———

export const PHYS = {
  /** Дж/(моль·K) */
  R: 8.314462618,
  /** Кл/моль */
  F: 96485.33212,
  /** Дж/K */
  kB: 1.380649e-23,
  /** Дж·с */
  h: 6.62607015e-34,
} as const

/** 25 °C */
export const CLO2_T_K = 298.15

// ——— Измеренные величины ———

/** E°(Cl₂(г)/Cl⁻), В */
export const E0_CL2_CL = 1.358
/** E°(ClO₂/ClO₂⁻), В */
export const E0_CLO2_CLO2M = 0.954
/** E°(ClO₂/ClO₂⁻), В — альтернативная сводка */
export const E0_CLO2_CLO2M_ALT = 0.936
/** электронов в суммарном уравнении 2 ClO₂⁻ + Cl₂ → 2 ClO₂ + 2 Cl⁻ */
export const CLO2_REDOX_N = 2

/** Константы скорости, М⁻¹с⁻¹, 25 °C. */
export const CLO2_RATE = {
  /** Cl₂ + ClO₂⁻ → ClOClO + Cl⁻ (Nicoson & Margerum 2002) */
  k1: 5.7e5,
  k1Err: 0.2e5,
  /** k₅ модели 2023 г. (Cl₂ + ClO₂⁻ → Cl₂O₂ + Cl⁻) — задан без погрешности, не независимое измерение */
  k1Model2023: 5.0e5,
  /** R7: Cl₂O₂ + ClO₂⁻ → 2 ClO₂ + Cl⁻ (Angyal и др. 2023) */
  kClo2Branch: 1.0e5,
  /** R9: Cl₂O₂ + ClO₂⁻ + H₂O → 2 HOCl + ClO₃⁻ (Angyal и др. 2023, вода в константе) */
  kChlorateBranch: 3.9e4,
} as const

/** ΔfG°, кДж/моль, 298,15 K (таблицы NBS) — для уровня конца хлоратной ветки. */
export const DFG_KJ = {
  ClO2m_aq: 17.2,
  ClO3m_aq: -7.95,
  HOCl_aq: -79.9,
  Clm_aq: -131.228,
  H2O_l: -237.129,
  Cl2_g: 0,
} as const

/** ΔG° ветки 2 ClO₂⁻ + Cl₂(г) + H₂O → ClO₃⁻ + 2 HOCl + Cl⁻ из ΔfG° (≈ −96 кДж/моль). */
export function chlorateBranchGibbsKJ(): number {
  const products = DFG_KJ.ClO3m_aq + 2 * DFG_KJ.HOCl_aq + DFG_KJ.Clm_aq
  const reactants = 2 * DFG_KJ.ClO2m_aq + DFG_KJ.Cl2_g + DFG_KJ.H2O_l
  return products - reactants
}

// ——— Чистые формулы ———

/** ΔG° = −nF(E°окислителя − E°восстановителя), кДж/моль. */
export function reactionGibbsKJ(n: number, eOxidantV: number, eReductantV: number): number {
  return (-n * PHYS.F * (eOxidantV - eReductantV)) / 1000
}

/** kB·T/h, с⁻¹ (≈ 6,21·10¹² при 298,15 K). */
export function eyringPrefactor(tempK = CLO2_T_K): number {
  return (PHYS.kB * tempK) / PHYS.h
}

/**
 * Кажущаяся энергия Гиббса активации по Эйрингу, кДж/моль:
 * ΔG‡ = RT·ln(kB·T / (h·k)). Для k второго порядка (М⁻¹с⁻¹) число верно
 * в стандартном состоянии 1 М; трансмиссионный коэффициент κ = 1.
 */
export function eyringBarrierKJ(kPerMs: number, tempK = CLO2_T_K): number {
  return (PHYS.R * tempK * Math.log(eyringPrefactor(tempK) / kPerMs)) / 1000
}

/** Разность барьеров двух параллельных каналов с общими реагентами: RT·ln(k_быстр/k_медл), кДж/моль. */
export function barrierGapKJ(kFast: number, kSlow: number, tempK = CLO2_T_K): number {
  return (PHYS.R * tempK * Math.log(kFast / kSlow)) / 1000
}

/** Доли параллельных каналов с одинаковым порядком по реагентам: kA/(kA+kB). */
export function branchFraction(kThis: number, kOther: number): number {
  return kThis / (kThis + kOther)
}

/** Период полупревращения при псевдопервом порядке (реагент в избытке), с. */
export function pseudoFirstOrderHalfLifeS(k2PerMs: number, excessMolar: number): number {
  return Math.LN2 / (k2PerMs * excessMolar)
}

// ——— Посчитанные величины урока ———

/** Пример «реального времени»: хлорит 10 мМ в избытке, Cl₂ расходуется с t½. */
export const CLO2_HALF_LIFE_EXAMPLE_M = 0.01

export const CLO2_ENERGETICS = {
  /** ΔG° суммарной реакции, кДж/моль (E° ClO₂/ClO₂⁻ = 0,954 В) ≈ −78 */
  dG0KJ: reactionGibbsKJ(CLO2_REDOX_N, E0_CL2_CL, E0_CLO2_CLO2M),
  /** то же с 0,936 В ≈ −81 */
  dG0AltKJ: reactionGibbsKJ(CLO2_REDOX_N, E0_CL2_CL, E0_CLO2_CLO2M_ALT),
  /** ΔG‡ стадии 1 от реагентов ≈ 40,2 */
  ts1KJ: eyringBarrierKJ(CLO2_RATE.k1),
  /** ΔG‡ стадии 1 по константе модели 2023 г. ≈ 40,5 */
  ts1Model2023KJ: eyringBarrierKJ(CLO2_RATE.k1Model2023),
  /** ΔG‡ канала ClO₂ от Cl₂O₂ + ClO₂⁻ ≈ 44,5 */
  ts2KJ: eyringBarrierKJ(CLO2_RATE.kClo2Branch),
  /** ΔG‡ хлоратного канала от Cl₂O₂ + ClO₂⁻ (+H₂O) ≈ 46,8 */
  chlorateTsKJ: eyringBarrierKJ(CLO2_RATE.kChlorateBranch),
  /** ΔΔG‡ между каналами ≈ 2,3 */
  branchGapKJ: barrierGapKJ(CLO2_RATE.kClo2Branch, CLO2_RATE.kChlorateBranch),
  /** отношение R7 : R9 — доля Cl₂O₂ (только шаги с ClO₂⁻) по пути к ClO₂ ≈ 0,72 */
  clo2Fraction: branchFraction(CLO2_RATE.kClo2Branch, CLO2_RATE.kChlorateBranch),
  /** доля Cl₂O₂ по пути к ClO₃⁻ ≈ 0,28 */
  chlorateFraction: branchFraction(CLO2_RATE.kChlorateBranch, CLO2_RATE.kClo2Branch),
  /** мольная доля ClO₂ среди продуктов этих двух путей: 2k₇ / (2k₇ + k₉) ≈ 0,84 (путь R7 даёт 2 ClO₂) */
  clo2MolarShare: (2 * CLO2_RATE.kClo2Branch) / (2 * CLO2_RATE.kClo2Branch + CLO2_RATE.kChlorateBranch),
  /** ΔG° хлоратной ветки из ΔfG° NBS ≈ −96 — ниже продуктов ClO₂: выход ClO₂ задаёт кинетика, а не выгодность */
  chlorateEndKJ: chlorateBranchGibbsKJ(),
  /** t½ для Cl₂ при 10 мМ хлорита, с ≈ 1,2·10⁻⁴ */
  halfLifeS: pseudoFirstOrderHalfLifeS(CLO2_RATE.k1, CLO2_HALF_LIFE_EXAMPLE_M),
} as const

// ——— Модель профиля для рисования ———

export type Clo2ProfilePointId = 'reactants' | 'ts1' | 'clOclO' | 'ts2' | 'adduct' | 'products' | 'chlorateBranch'

/**
 * measured  — прямо из измеренных табличных величин (ΔG° = −nFE° — тождество);
 * derived   — пересчитано из измерений через модель (Эйринг, κ = 1);
 * schematic — не измерено, уровень выбран только для рисунка.
 */
export type Clo2ProfileKind = 'measured' | 'derived' | 'schematic'

export type Clo2ProfilePoint = {
  id: Clo2ProfilePointId
  /** ΔG от исходных реагентов на общей шкале, кДж/моль; null — на общей шкале не определено */
  gKJ: number | null
  kind: Clo2ProfileKind
  /** шаг урока, к которому относится точка */
  stepId: Clo2StepId
  /** стационарная точка: минимум, максимум (переходное состояние) или конец пути */
  role: 'minimum' | 'maximum' | 'end'
  /** кажущийся барьер ΔG‡ от собственных реагентов, кДж/моль; null — не барьер */
  barrierKJ: number | null
  /** уровень, от которого отсчитан barrierKJ */
  barrierFrom: Clo2ProfilePointId | null
  /** доля канала после развилки; null — не развилка */
  fraction: number | null
  /** уровень на рисунке, кДж/моль: gKJ, если он известен, иначе схема (+ барьер от схемы) */
  drawKJ: number
  /** координата реакции на рисунке, 0…1 */
  x: number
  branch: 'main' | 'chlorate'
  /** формула частиц (DOM-текст, одинаков во всех языках) */
  formula: string
  /** пояснение для разработчика — не UI-текст (UI: clo2MechanismText.energy) */
  caveat: string | null
}

/**
 * Уровни, которых нет в данных. Выбраны так, чтобы рисунок не внушал ложного:
 * пик стадии 2 ниже пика стадии 1 (стадия 1 — медленная по кинетике), обе ямы
 * мельче продуктов. Это НЕ оценки энергии.
 */
export const CLO2_PROFILE_SCHEMATIC_KJ = {
  clOclO: -18,
  adduct: -32,
} as const

export const CLO2_PROFILE_POINTS: readonly Clo2ProfilePoint[] = [
  {
    id: 'reactants',
    gKJ: 0,
    kind: 'measured',
    stepId: 'reagents',
    role: 'end',
    barrierKJ: null,
    barrierFrom: null,
    fraction: null,
    drawKJ: 0,
    x: 0.07,
    branch: 'main',
    formula: '2ClO₂⁻ + Cl₂',
    caveat: 'Опорный уровень: реагенты в стандартных состояниях, Cl₂ — газ.',
  },
  {
    id: 'ts1',
    gKJ: CLO2_ENERGETICS.ts1KJ,
    kind: 'derived',
    stepId: 'clTransfer',
    role: 'maximum',
    barrierKJ: CLO2_ENERGETICS.ts1KJ,
    barrierFrom: 'reactants',
    fraction: null,
    drawKJ: CLO2_ENERGETICS.ts1KJ,
    x: 0.22,
    branch: 'main',
    formula: '[O···Cl···Cl]‡',
    caveat: 'Кажущийся ΔG‡ из k₁ по Эйрингу; реагенты стадии совпадают с исходными, поэтому точка на общей шкале.',
  },
  {
    id: 'clOclO',
    gKJ: null,
    kind: 'schematic',
    stepId: 'intermediate',
    role: 'minimum',
    barrierKJ: null,
    barrierFrom: null,
    fraction: null,
    drawKJ: CLO2_PROFILE_SCHEMATIC_KJ.clOclO,
    x: 0.37,
    branch: 'main',
    formula: 'ClOClO',
    caveat: 'Глубина ямы не измерена; изомеры Cl₂O₂ посчитаны только для газа.',
  },
  {
    id: 'ts2',
    gKJ: null,
    kind: 'derived',
    stepId: 'attack',
    role: 'maximum',
    barrierKJ: CLO2_ENERGETICS.ts2KJ,
    barrierFrom: 'clOclO',
    fraction: null,
    drawKJ: CLO2_PROFILE_SCHEMATIC_KJ.clOclO + CLO2_ENERGETICS.ts2KJ,
    x: 0.51,
    branch: 'main',
    formula: '‡',
    caveat: 'Барьер отсчитан от ClOClO + ClO₂⁻, а их уровень схематичен — абсолютная высота пика условна.',
  },
  {
    id: 'adduct',
    gKJ: null,
    kind: 'schematic',
    stepId: 'attack',
    role: 'minimum',
    barrierKJ: null,
    barrierFrom: null,
    fraction: null,
    drawKJ: CLO2_PROFILE_SCHEMATIC_KJ.adduct,
    x: 0.63,
    branch: 'main',
    formula: '[Cl₃O₄]⁻',
    caveat: 'Комплекс — по расчётам Jia 2000; в растворе не наблюдался, глубина неизвестна.',
  },
  {
    id: 'products',
    gKJ: CLO2_ENERGETICS.dG0KJ,
    kind: 'measured',
    stepId: 'products',
    role: 'end',
    barrierKJ: null,
    barrierFrom: null,
    fraction: CLO2_ENERGETICS.clo2Fraction,
    drawKJ: CLO2_ENERGETICS.dG0KJ,
    x: 0.86,
    branch: 'main',
    formula: '2ClO₂ + 2Cl⁻',
    caveat: 'ΔG° = −2F·(E°(Cl₂/Cl⁻) − E°(ClO₂/ClO₂⁻)) из табличных E°; альтернативный E° = 0,936 В даёт на ≈ 3 кДж/моль ниже.',
  },
  {
    id: 'chlorateBranch',
    gKJ: CLO2_ENERGETICS.chlorateEndKJ,
    kind: 'measured',
    stepId: 'split',
    role: 'end',
    barrierKJ: CLO2_ENERGETICS.chlorateTsKJ,
    barrierFrom: 'clOclO',
    fraction: CLO2_ENERGETICS.chlorateFraction,
    drawKJ: CLO2_ENERGETICS.chlorateEndKJ,
    x: 0.8,
    branch: 'chlorate',
    formula: 'ClO₃⁻ + 2HOCl',
    caveat:
      'Уровень конца ветки — из табличных ΔfG° (NBS; HOCl 1 М, Cl₂ газ, H₂O жидкость), источник иной, чем E° для ClO₂. ' +
      'Хлорат термодинамически ниже, но ClO₂ образуется быстрее — это кинетический контроль. Барьер и доля пути — R9 : R7 из Angyal и др. 2023; ' +
      'развилка нарисована после комплекса по схеме Jia 2000.',
  },
]

export function clo2ProfilePoint(id: Clo2ProfilePointId): Clo2ProfilePoint {
  return CLO2_PROFILE_POINTS.find((p) => p.id === id)!
}

/** Основной путь (без хлоратной ветки) — по нему ездит бегунок. Индекс = позиция бегунка. */
export const CLO2_PROFILE_MAIN: readonly Clo2ProfilePoint[] = CLO2_PROFILE_POINTS.filter((p) => p.branch === 'main')

// ——— Бегунок: story time → позиция на основном пути ———

type PlayheadStop = { t: number; pos: number }

function cueAt(id: Clo2CueId): number {
  return CLO2_CUES.find((c) => c.id === id)!.at
}

function mainIndex(id: Clo2ProfilePointId): number {
  return CLO2_PROFILE_MAIN.findIndex((p) => p.id === id)
}

/**
 * Движения бегунка: позиция — дробный индекс в CLO2_PROFILE_MAIN.
 *   reagents/approach → reactants;
 *   clTransfer → ts1 (метка 'clTransfer') → clOclO;
 *   intermediate → clOclO;
 *   attack → ts2 → adduct (метка 'adduct');
 *   split → products (к метке 'radicals'); products/balance → products.
 */
export const CLO2_PLAYHEAD_MOVES: readonly (readonly PlayheadStop[])[] = (() => {
  const clTransfer = clo2StepById('clTransfer')
  const attack = clo2StepById('attack')
  const split = clo2StepById('split')
  const adductAt = cueAt('adduct')
  return [
    [
      { t: clTransfer.from, pos: mainIndex('reactants') },
      { t: cueAt('clTransfer'), pos: mainIndex('ts1') },
      { t: clTransfer.to, pos: mainIndex('clOclO') },
    ],
    [
      { t: attack.from, pos: mainIndex('clOclO') },
      { t: (attack.from + adductAt) / 2, pos: mainIndex('ts2') },
      { t: adductAt, pos: mainIndex('adduct') },
    ],
    [
      { t: split.from, pos: mainIndex('adduct') },
      { t: cueAt('radicals'), pos: mainIndex('products') },
    ],
  ]
})()

function smooth01(u: number): number {
  const x = u <= 0 ? 0 : u >= 1 ? 1 : u
  return x * x * (3 - 2 * x)
}

/**
 * Позиция бегунка в момент t (без аллокаций — зовётся в requestAnimationFrame).
 * Внутри движения время сглажено целиком (плавный старт и финиш), а промежуточные
 * остановки попадают точно в свои метки времени.
 */
export function clo2ProfilePosAt(t: number): number {
  const moves = CLO2_PLAYHEAD_MOVES
  let pos = moves[0]![0]!.pos
  for (let m = 0; m < moves.length; m++) {
    const move = moves[m]!
    const first = move[0]!
    const last = move[move.length - 1]!
    if (t <= first.t) return first.pos
    if (t < last.t) {
      const span = last.t - first.t
      const e = smooth01((t - first.t) / span)
      for (let i = 0; i < move.length - 1; i++) {
        const a = move[i]!
        const b = move[i + 1]!
        const ea = smooth01((a.t - first.t) / span)
        const eb = smooth01((b.t - first.t) / span)
        if (e <= eb || i === move.length - 2) {
          const k = eb > ea ? (e - ea) / (eb - ea) : 1
          return a.pos + (b.pos - a.pos) * Math.min(1, Math.max(0, k))
        }
      }
    }
    pos = last.pos
  }
  return pos
}

/** Без анимации (prefers-reduced-motion): бегунок сразу стоит там, где закончится текущий шаг. */
export function clo2ProfilePosAtStepEnd(t: number): number {
  return clo2ProfilePosAt(CLO2_STEPS[clo2StepIndexAt(t)]!.to)
}

// ——— Счётчик валентных электронов ———

export type Clo2Species = {
  formula: string
  count: number
  cl: number
  o: number
  h?: number
  charge: number
}

/** Валентные электроны: Cl 7, O 6, H 1, минус заряд; умножено на число частиц. */
export function valenceElectrons(s: Clo2Species): number {
  return s.count * (7 * s.cl + 6 * s.o + (s.h ?? 0) - s.charge)
}

export type Clo2LedgerStageId = 'start' | 'afterClTransfer' | 'complex' | 'end'

export type Clo2LedgerStage = {
  id: Clo2LedgerStageId
  /** метка, с которой стадия начинается; null — с начала урока */
  fromCue: Clo2CueId | null
  species: readonly Clo2Species[]
  /** «40 + 14» — посчитано из species */
  breakdown: string
  /** «2ClO₂⁻ + Cl₂» */
  formula: string
  total: number
}

function stage(id: Clo2LedgerStageId, fromCue: Clo2CueId | null, species: Clo2Species[]): Clo2LedgerStage {
  const counts = species.map(valenceElectrons)
  return {
    id,
    fromCue,
    species,
    breakdown: counts.join(' + '),
    formula: species.map((s) => (s.count > 1 ? `${s.count}${s.formula}` : s.formula)).join(' + '),
    total: counts.reduce((a, b) => a + b, 0),
  }
}

const CLO2M: Omit<Clo2Species, 'count'> = { formula: 'ClO₂⁻', cl: 1, o: 2, charge: -1 }
const CL2: Omit<Clo2Species, 'count'> = { formula: 'Cl₂', cl: 2, o: 0, charge: 0 }
const CLM: Omit<Clo2Species, 'count'> = { formula: 'Cl⁻', cl: 1, o: 0, charge: -1 }

/** Атомы и заряд сохраняются — значит, и валентных электронов всё время 54. */
export const CLO2_LEDGER_STAGES: readonly Clo2LedgerStage[] = [
  stage('start', null, [
    { ...CLO2M, count: 2 },
    { ...CL2, count: 1 },
  ]),
  stage('afterClTransfer', 'chlorideOut', [
    { formula: 'ClOClO', count: 1, cl: 2, o: 2, charge: 0 },
    { ...CLM, count: 1 },
    { ...CLO2M, count: 1 },
  ]),
  stage('complex', 'adduct', [
    { formula: '[Cl₃O₄]⁻', count: 1, cl: 3, o: 4, charge: -1 },
    { ...CLM, count: 1 },
  ]),
  stage('end', 'split', [
    { formula: 'ClO₂', count: 2, cl: 1, o: 2, charge: 0 },
    { ...CLM, count: 2 },
  ]),
]

/** Побочный путь для проверки: 2ClO₂⁻ + Cl₂ + H₂O → ClO₃⁻ + 2HOCl + Cl⁻ (с водой: 54 + 8 = 62). */
export const CLO2_CHLORATE_LEDGER: readonly Clo2Species[] = [
  { formula: 'ClO₃⁻', count: 1, cl: 1, o: 3, charge: -1 },
  { formula: 'HOCl', count: 2, cl: 1, o: 1, h: 1, charge: 0 },
  { ...CLM, count: 1 },
]

export const CLO2_VALENCE_TOTAL = CLO2_LEDGER_STAGES[0]!.total

const LEDGER_FROM: readonly number[] = CLO2_LEDGER_STAGES.map((s) => (s.fromCue ? cueAt(s.fromCue) : -Infinity))

/** Индекс стадии счётчика в момент t. */
export function clo2LedgerStageAt(t: number): number {
  let idx = 0
  for (let i = 0; i < LEDGER_FROM.length; i++) {
    if (t >= LEDGER_FROM[i]!) idx = i
  }
  return idx
}

/**
 * Орбиталь 2b₁ (π*) фрагмента O–Cl–O: у хлорита 2 электрона, у ClO₂ — 1.
 * 0 — хлорит (2); 1 — мостик рвётся (между метками 'split' и 'radicals'); 2 — радикал (1).
 */
export type Clo2OrbitalPhase = 0 | 1 | 2

export const CLO2_2B1_SPLIT_AT = cueAt('split')
export const CLO2_2B1_RADICAL_AT = cueAt('radicals')

export function clo2OrbitalPhaseAt(t: number): Clo2OrbitalPhase {
  if (t < CLO2_2B1_SPLIT_AT) return 0
  if (t < CLO2_2B1_RADICAL_AT) return 1
  return 2
}

/** Занятость 2b₁ по фазе: до разрыва 2, после — 1. */
export function clo2OrbitalOccupancy(phase: Clo2OrbitalPhase): 2 | 1 {
  return phase === 0 ? 2 : 1
}
