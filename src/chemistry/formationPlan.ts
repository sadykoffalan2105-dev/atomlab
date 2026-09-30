/**
 * «Как образуется» — МОДЕЛЬ СТРОЕНИЯ вещества каталога: из каких частиц оно складывается, как сходятся заряды
 * (ионное) или валентности (ковалентное), какие связи и какая форма. Это не механизм реакции.
 *
 * Химия — по школьному курсу (Kimyo 7–11, ОГЭ/ЕГЭ):
 *  • частицы формульной единицы — разбор формулы (катион / кислотный остаток-«корень» / OH⁻ / NH₄⁺ /
 *    кристаллизационная вода); заряды ионов — справочные (F⁻, Cl⁻, O²⁻, SO₄²⁻, NH₄⁺…), заряд катиона
 *    с переменной валентностью — из электронейтральности формулы (FeCl₃ → Fe³⁺);
 *  • тип связи — школьное правило: одинаковые неметаллы — ковалентная неполярная; разные неметаллы —
 *    ковалентная полярная; металл + неметалл — ионная; соль / основание с многоатомным ионом — ионная между
 *    ионами и ковалентная внутри иона (у NH₄⁺ — в том числе донорно-акцепторная). Оксиды и кислоты металлов в
 *    высшей степени окисления (≥ +5: CrO₃, Mn₂O₇, HMnO₄, V₂O₅) — молекулярные, ковалентная полярная;
 *  • валентность атома в молекуле — число связей (общих электронных пар) в модели buildSchoolHeroModel;
 *  • форма — по геометрии модели (углы вокруг центрального атома).
 *
 * Модель (buildSchoolHeroModel) даёт только частицы на экране: атомы модели разбиваются на частицы по связности
 * (связи металл–неметалл у ионных веществ — ионные контакты, их нет) и по составу компонент; заряды атомов модели
 * учитываются, если они есть (ионные модели), но химия плана от них не зависит — план одинаков для прежних и
 * ионных моделей.
 */
import { compoundById } from '../data/compounds'
import { buildSchoolHeroModel, type SchoolHeroModel } from '../components/lab/hero/schoolHeroModel'

export type FormationBondType =
  | 'ionic'
  | 'covalent-nonpolar'
  | 'covalent-polar'
  /** ионная между ионами + ковалентная внутри многоатомного иона */
  | 'ionic-covalent'

export type FormationSpeciesKind = 'atom' | 'ion' | 'polyion' | 'molecule'

export type FormationSpecies = {
  /** формула частицы: «Na⁺», «SO₄²⁻», «H₂O», «S» */
  formula: string
  kind: FormationSpeciesKind
  charge: number
  /** число частиц в формульной единице (у молекулы — число атомов элемента) */
  count: number
  comp: Record<string, number>
  /** ключ названия (formationText): 'cation:Fe', 'anion:Cl', 'poly:SO4', 'mol:H2O', 'el:S' */
  nameKey: string
  /** ковалентное: валентности атомов элемента (обычно одна) */
  valences?: number[]
  /** многоатомный ион: внутри есть донорно-акцепторная связь (NH₄⁺, [Zn(OH)₄]²⁻) */
  donorAcceptor?: boolean
  /** многоатомный ион / молекула из одного элемента (O₂²⁻, S₂²⁻, C₂²⁻): внутри — неполярная */
  innerNonpolar?: boolean
}

export type FormationShapeKey =
  | 'linear'
  | 'angular'
  | 'trigonal-planar'
  | 'trigonal-pyramidal'
  | 'tetrahedral'
  | 'octahedral'
  | 'ring'
  | 'tetrahedron-p4'
  | 'ionic-lattice'
  | 'atomic-lattice'
  | 'formula-unit'
  /** простейшая формула полимерного вещества (CrO₃, V₂O₅, H₂SiO₃, HPO₃) — одной формы молекулы нет */
  | 'polymeric'
  /** P₂O₅ — простейшая формула, настоящие молекулы P₄O₁₀ */
  | 'p4o10'

export type FormationShape = {
  key: FormationShapeKey
  /** частица, о которой речь (формула иона / молекулы) или '' — вещество целиком */
  of: string
  /** центральный атом (символ) */
  center?: string
  /** несколько одинаковых центров: «вокруг каждого S» */
  each?: boolean
}

export type FormationUnit = {
  /** индекс в species */
  species: number
  /** индексы атомов модели */
  atoms: number[]
}

export type FormationPlan = {
  compoundId: string
  formula: string
  mode: 'ionic' | 'molecular'
  bondType: FormationBondType
  /** молекулы гидрата аммиака связаны водородной связью */
  hydrogenBond: boolean
  /** в молекуле есть и связь одинаковых атомов (H₂O₂: O–O; N₂O: N–N) */
  alsoNonpolar: boolean
  species: FormationSpecies[]
  /** ионное: «2·(+1) + (−2) = 0» (частицы с зарядом, в школьном порядке: катионы → анионы) */
  balance: string | null
  /** ковалентные связи модели по видам: «S=O» ×2 */
  bondKinds: { label: string; count: number }[]
  /** ионное: связи внутри одного многоатомного иона каждого вида (SO₄²⁻: S–O ×4), без воды и других частиц */
  innerBonds: { of: string; kinds: { label: string; count: number }[] }[]
  shapes: FormationShape[]
  crystal: boolean
  /** есть ли 3D-модель */
  hasModel: boolean
  /** частицы на экране (атомы модели) */
  units: FormationUnit[]
  /** порядок появления ковалентных связей модели (индексы model.bonds) */
  bondOrder: number[]
  /** порядок прихода частиц на место (индексы units) */
  unitOrder: number[]
  /** молекула: связи модели согласуются с формулой (связная, валентности совпадают) — можно перечислять виды связей */
  bondsReliable: boolean
  /** расхождения модели с формулой (для тестов и заметок; план всё равно строится) */
  modelIssues: string[]
}

// ─── Справочные данные ─────────────────────────────────────────────────────

export const NONMETALS = new Set(['H', 'B', 'C', 'N', 'O', 'F', 'Si', 'P', 'S', 'Cl', 'Ge', 'As', 'Se', 'Br', 'Kr', 'Te', 'I', 'Xe', 'He', 'Ne', 'Ar'])
export const isMetal = (el: string): boolean => !NONMETALS.has(el)

/** Металлы с постоянной степенью окисления (заряд иона). */
const FIXED_CATION: Record<string, number> = { Li: 1, Na: 1, K: 1, Rb: 1, Cs: 1, Ag: 1, Be: 2, Mg: 2, Ca: 2, Sr: 2, Ba: 2, Zn: 2, Al: 3 }
/** Металлы с переменной валентностью: в названии иона — римская цифра (железа(III)). */
export const VARIABLE_METALS = new Set(['Fe', 'Cu', 'Cr', 'Mn', 'Pb', 'Sn', 'Hg', 'Au', 'Co', 'Ni', 'V', 'Ti'])

/** Одноатомные анионы: заряд по положению в ПСХЭ (8 − номер группы). */
const MONO_ANION: Record<string, number> = { F: -1, Cl: -1, Br: -1, I: -1, O: -2, S: -2, N: -3, P: -3, H: -1, C: -4 }

/**
 * shape — справочная форма иона (теория отталкивания электронных пар, школьный курс 10–11; Greenwood & Earnshaw,
 * «Chemistry of the Elements»): форма модели сверяется с ней, при расхождении форма не называется.
 * null — у иона в веществе нет отдельной формы (метасиликаты, метаалюминаты, цинкаты — полимерные цепи / каркасы).
 */
type PolyIon = { key: string; formula: string; comp: Record<string, number>; charge: number; donorAcceptor?: boolean; shape: FormationShapeKey | null }

/** Многоатомные ионы школьного курса (кислотные остатки, OH⁻, NH₄⁺, пероксид-ион…). */
export const POLY_IONS: readonly PolyIon[] = [
  { key: 'OH', formula: 'OH⁻', comp: { O: 1, H: 1 }, charge: -1, shape: 'linear' },
  { key: 'NH4', formula: 'NH₄⁺', comp: { N: 1, H: 4 }, charge: 1, donorAcceptor: true, shape: 'tetrahedral' },
  { key: 'SO4', formula: 'SO₄²⁻', comp: { S: 1, O: 4 }, charge: -2, shape: 'tetrahedral' },
  { key: 'HSO4', formula: 'HSO₄⁻', comp: { H: 1, S: 1, O: 4 }, charge: -1, shape: 'tetrahedral' },
  { key: 'SO3', formula: 'SO₃²⁻', comp: { S: 1, O: 3 }, charge: -2, shape: 'trigonal-pyramidal' },
  { key: 'CO3', formula: 'CO₃²⁻', comp: { C: 1, O: 3 }, charge: -2, shape: 'trigonal-planar' },
  { key: 'HCO3', formula: 'HCO₃⁻', comp: { H: 1, C: 1, O: 3 }, charge: -1, shape: 'trigonal-planar' },
  { key: 'NO3', formula: 'NO₃⁻', comp: { N: 1, O: 3 }, charge: -1, shape: 'trigonal-planar' },
  { key: 'NO2', formula: 'NO₂⁻', comp: { N: 1, O: 2 }, charge: -1, shape: 'angular' },
  { key: 'PO4', formula: 'PO₄³⁻', comp: { P: 1, O: 4 }, charge: -3, shape: 'tetrahedral' },
  { key: 'HPO4', formula: 'HPO₄²⁻', comp: { H: 1, P: 1, O: 4 }, charge: -2, shape: 'tetrahedral' },
  { key: 'H2PO4', formula: 'H₂PO₄⁻', comp: { H: 2, P: 1, O: 4 }, charge: -1, shape: 'tetrahedral' },
  { key: 'SiO3', formula: 'SiO₃²⁻', comp: { Si: 1, O: 3 }, charge: -2, shape: null },
  { key: 'MnO4', formula: 'MnO₄⁻', comp: { Mn: 1, O: 4 }, charge: -1, shape: 'tetrahedral' },
  { key: 'MnO4_2', formula: 'MnO₄²⁻', comp: { Mn: 1, O: 4 }, charge: -2, shape: 'tetrahedral' },
  { key: 'CrO4', formula: 'CrO₄²⁻', comp: { Cr: 1, O: 4 }, charge: -2, shape: 'tetrahedral' },
  { key: 'Cr2O7', formula: 'Cr₂O₇²⁻', comp: { Cr: 2, O: 7 }, charge: -2, shape: 'tetrahedral' },
  { key: 'ClO3', formula: 'ClO₃⁻', comp: { Cl: 1, O: 3 }, charge: -1, shape: 'trigonal-pyramidal' },
  { key: 'ClO2', formula: 'ClO₂⁻', comp: { Cl: 1, O: 2 }, charge: -1, shape: 'angular' },
  { key: 'ClO', formula: 'ClO⁻', comp: { Cl: 1, O: 1 }, charge: -1, shape: 'linear' },
  { key: 'AlO2', formula: 'AlO₂⁻', comp: { Al: 1, O: 2 }, charge: -1, shape: null },
  { key: 'ZnO2', formula: 'ZnO₂²⁻', comp: { Zn: 1, O: 2 }, charge: -2, shape: null },
  { key: 'ZnOH4', formula: '[Zn(OH)₄]²⁻', comp: { Zn: 1, O: 4, H: 4 }, charge: -2, donorAcceptor: true, shape: 'tetrahedral' },
  { key: 'O2_2', formula: 'O₂²⁻', comp: { O: 2 }, charge: -2, shape: 'linear' },
  { key: 'O2_1', formula: 'O₂⁻', comp: { O: 2 }, charge: -1, shape: 'linear' },
  { key: 'S2', formula: 'S₂²⁻', comp: { S: 2 }, charge: -2, shape: 'linear' },
  { key: 'C2', formula: 'C₂²⁻', comp: { C: 2 }, charge: -2, shape: 'linear' },
]

const polyByKey = new Map(POLY_IONS.map((p) => [p.key, p]))

type Part = { species: FormationSpecies; total: number }

/**
 * Состав частиц по id, где формула не разбирается однозначно (смешанная валентность, пероксиды, основная соль,
 * хлорная известь): справочные ионы. Fe₃O₄ = FeO·Fe₂O₃ (Fe²⁺ и 2 Fe³⁺), Mn₃O₄ = MnO·Mn₂O₃ (гаусманит).
 */
const OVERRIDES: Record<string, readonly (readonly [string, number, number])[]> = {
  // [ключ частицы ('M:Fe' — катион, 'A:O' — одноатомный анион, иначе — многоатомный ион), заряд, число]
  fe3o4: [['M:Fe', 2, 1], ['M:Fe', 3, 2], ['A:O', -2, 4]],
  tb_mn3o4: [['M:Mn', 2, 1], ['M:Mn', 3, 2], ['A:O', -2, 4]],
  fes2: [['M:Fe', 2, 1], ['S2', -2, 1]],
  na2o2: [['M:Na', 1, 2], ['O2_2', -2, 1]],
  tb_k2o2: [['M:K', 1, 2], ['O2_2', -2, 1]],
  tb_bao2: [['M:Ba', 2, 1], ['O2_2', -2, 1]],
  tb_ko2: [['M:K', 1, 1], ['O2_1', -1, 1]],
  tb_cac2: [['M:Ca', 2, 1], ['C2', -2, 1]],
  tb_caocl2: [['M:Ca', 2, 1], ['ClO', -1, 1], ['A:Cl', -1, 1]],
  tb_cuoh2co3: [['M:Cu', 2, 2], ['OH', -1, 2], ['CO3', -2, 1]],
}

// ─── Разбор формулы ────────────────────────────────────────────────────────

type Tok = { el: string; n: number } | { group: Tok[]; n: number; bracket: '(' | '[' }

const SUB: Record<string, string> = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' }

function plainFormula(s: string): string {
  return [...s].map((ch) => SUB[ch] ?? ch).join('')
}

function parseTokens(s: string, i0: number, close?: string): { toks: Tok[]; i: number } {
  const toks: Tok[] = []
  let i = i0
  const num = (): number => {
    let d = ''
    while (i < s.length && /\d/.test(s[i]!)) d += s[i++]!
    return d ? Number(d) : 1
  }
  while (i < s.length) {
    const ch = s[i]!
    if (close && ch === close) return { toks, i: i + 1 }
    if (ch === '(' || ch === '[') {
      const inner = parseTokens(s, i + 1, ch === '(' ? ')' : ']')
      i = inner.i
      toks.push({ group: inner.toks, n: num(), bracket: ch })
    } else if (/[A-Z]/.test(ch)) {
      let el = ch
      i++
      if (i < s.length && /[a-z]/.test(s[i]!)) el += s[i++]!
      toks.push({ el, n: num() })
    } else i++
  }
  return { toks, i }
}

function compOf(toks: readonly Tok[], k = 1, out: Record<string, number> = {}): Record<string, number> {
  for (const t of toks) {
    if ('el' in t) out[t.el] = (out[t.el] ?? 0) + t.n * k
    else compOf(t.group, t.n * k, out)
  }
  return out
}

const sameComp = (a: Record<string, number>, b: Record<string, number>): boolean => {
  const ka = Object.keys(a).filter((k) => (a[k] ?? 0) > 0)
  const kb = Object.keys(b).filter((k) => (b[k] ?? 0) > 0)
  return ka.length === kb.length && ka.every((k) => a[k] === b[k])
}

const SUP_DIGIT: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' }
const SUB_DIGIT: Record<string, string> = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' }

/** «Fe³⁺», «Cl⁻», «O²⁻». */
export function ionLabel(el: string, charge: number): string {
  if (charge === 0) return el
  const n = Math.abs(charge)
  const mag = n === 1 ? '' : [...String(n)].map((d) => SUP_DIGIT[d]).join('')
  return `${el}${mag}${charge > 0 ? '⁺' : '⁻'}`
}

/** «H₂O» по составу в заданном порядке элементов. */
function molFormula(order: readonly string[], comp: Record<string, number>): string {
  return order
    .filter((e) => (comp[e] ?? 0) > 0)
    .map((e) => `${e}${comp[e]! > 1 ? [...String(comp[e])].map((d) => SUB_DIGIT[d]).join('') : ''}`)
    .join('')
}

function cationSpecies(el: string, charge: number, count: number): FormationSpecies {
  return { formula: ionLabel(el, charge), kind: 'ion', charge, count, comp: { [el]: 1 }, nameKey: `cation:${el}` }
}
function anionSpecies(el: string, charge: number, count: number): FormationSpecies {
  return { formula: ionLabel(el, charge), kind: 'ion', charge, count, comp: { [el]: 1 }, nameKey: `anion:${el}` }
}
function polySpecies(p: PolyIon, count: number): FormationSpecies {
  const els = Object.keys(p.comp)
  return {
    formula: p.formula,
    kind: 'polyion',
    charge: p.charge,
    count,
    comp: { ...p.comp },
    nameKey: `poly:${p.key}`,
    donorAcceptor: p.donorAcceptor,
    innerNonpolar: els.length === 1,
  }
}

/** Ионная часть формулы (без кристаллизационной воды): катионы + анионы с зарядами. null — не разобрано. */
function ionicParts(toks: Tok[], fullComp: Record<string, number>): Part[] | null {
  const cations: { el?: string; poly?: PolyIon; n: number }[] = []
  let i = 0
  // Катионы: ведущие металлы, (NH₄) / NH₄.
  while (i < toks.length) {
    const t = toks[i]!
    // Металл внутри кислотного остатка (KMnO₄, K₂Cr₂O₇, NaAlO₂, Na₂ZnO₂): остаток формулы — известный анион.
    if (cations.length > 0 && 'el' in t && isMetal(t.el)) {
      const restComp = compOf(toks.slice(i))
      if (POLY_IONS.some((p) => p.charge < 0 && sameComp(p.comp, restComp))) break
    }
    if ('el' in t && isMetal(t.el)) {
      cations.push({ el: t.el, n: t.n })
      i++
      continue
    }
    if ('group' in t && t.bracket === '(' && sameComp(compOf(t.group), { N: 1, H: 4 })) {
      cations.push({ poly: polyByKey.get('NH4')!, n: t.n })
      i++
      continue
    }
    const t2 = toks[i + 1]
    if ('el' in t && t.el === 'N' && t.n === 1 && t2 && 'el' in t2 && t2.el === 'H' && t2.n === 4) {
      cations.push({ poly: polyByKey.get('NH4')!, n: 1 })
      i += 2
      continue
    }
    break
  }
  if (cations.length === 0) return null
  const rest = toks.slice(i)
  if (rest.length === 0) return null
  // Анион(ы).
  const anions: { el?: string; poly?: PolyIon; comp?: Record<string, number>; n: number }[] = []
  if (rest.every((t) => 'group' in t)) {
    for (const t of rest as Extract<Tok, { group: Tok[] }>[]) anions.push({ comp: compOf(t.group), n: t.n })
  } else if (rest.length === 1 && 'el' in rest[0]!) {
    anions.push({ el: rest[0].el, n: rest[0].n })
  } else {
    anions.push({ comp: compOf(rest), n: 1 })
  }
  // Заряды анионов: одноатомные — справочные; многоатомные — по составу (MnO₄ — два варианта: по балансу).
  const parts: Part[] = []
  let anionCharge = 0
  let unknownPoly: { comp: Record<string, number>; n: number } | null = null
  for (const a of anions) {
    if (a.el) {
      const q = MONO_ANION[a.el]
      if (q == null) return null
      parts.push({ species: anionSpecies(a.el, q, a.n), total: a.n })
      anionCharge += q * a.n
      continue
    }
    const cands = POLY_IONS.filter((p) => sameComp(p.comp, a.comp!))
    if (cands.length === 1) {
      parts.push({ species: polySpecies(cands[0]!, a.n), total: a.n })
      anionCharge += cands[0]!.charge * a.n
    } else if (cands.length > 1 && !unknownPoly) unknownPoly = { comp: a.comp!, n: a.n }
    else return null
  }
  // Катионы: постоянный заряд или из баланса (одна неизвестная).
  let cationCharge = 0
  const unknownCations = cations.filter((c) => c.el && FIXED_CATION[c.el] == null)
  for (const c of cations) {
    if (c.poly) cationCharge += c.poly.charge * c.n
    else if (c.el && FIXED_CATION[c.el] != null) cationCharge += FIXED_CATION[c.el]! * c.n
  }
  if (unknownPoly && unknownCations.length === 0) {
    const q = -cationCharge / unknownPoly.n
    const p = POLY_IONS.find((x) => sameComp(x.comp, unknownPoly!.comp) && x.charge === q)
    if (!p) return null
    parts.push({ species: polySpecies(p, unknownPoly.n), total: unknownPoly.n })
    anionCharge += q * unknownPoly.n
  } else if (unknownPoly) return null
  if (unknownCations.length > 1) return null
  const catParts: Part[] = []
  for (const c of cations) {
    if (c.poly) catParts.push({ species: polySpecies(c.poly, c.n), total: c.n })
    else if (c.el && FIXED_CATION[c.el] != null) catParts.push({ species: cationSpecies(c.el, FIXED_CATION[c.el]!, c.n), total: c.n })
    else if (c.el) {
      const q = -(anionCharge + cationCharge) / c.n
      if (!Number.isInteger(q) || q < 1 || q > 4) return null
      catParts.push({ species: cationSpecies(c.el, q, c.n), total: c.n })
    }
  }
  const out = [...catParts, ...parts]
  // Сверка состава: частицы × число = формула.
  const sum: Record<string, number> = {}
  for (const p of out) for (const [e, n] of Object.entries(p.species.comp)) sum[e] = (sum[e] ?? 0) + n * p.total
  if (!sameComp(sum, fullComp)) return null
  return out
}

/** Высшая степень окисления металла в оксиде / кислоте (O −2, H +1; прочих элементов нет). */
function metalOxState(comp: Record<string, number>): number | null {
  const metals = Object.keys(comp).filter(isMetal)
  if (metals.length !== 1) return null
  const others = Object.keys(comp).filter((e) => !isMetal(e))
  if (!others.every((e) => e === 'O' || e === 'H')) return null
  const m = metals[0]!
  return (2 * (comp.O ?? 0) - (comp.H ?? 0)) / comp[m]!
}

// ─── Геометрия модели ──────────────────────────────────────────────────────

type V3 = readonly [number, number, number]
const sub = (a: V3, b: V3): [number, number, number] => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const angle = (a: V3, c: V3, b: V3): number => {
  const u = sub(a, c)
  const v = sub(b, c)
  const d = (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (Math.hypot(...u) * Math.hypot(...v) || 1)
  return (Math.acos(Math.max(-1, Math.min(1, d))) * 180) / Math.PI
}

/** Форма вокруг атома c с соседями nb (по углам модели). */
function shapeAround(model: SchoolHeroModel, c: number, nb: readonly number[]): FormationShapeKey | null {
  const P = (i: number) => model.atoms[i]!.pos
  if (nb.length === 1) return 'linear'
  const angs: number[] = []
  for (let i = 0; i < nb.length; i++) for (let j = i + 1; j < nb.length; j++) angs.push(angle(P(nb[i]!), P(c), P(nb[j]!)))
  if (nb.length === 2) return angs[0]! > 170 ? 'linear' : 'angular'
  if (nb.length === 3) return angs.reduce((s, a) => s + a, 0) > 355 ? 'trigonal-planar' : 'trigonal-pyramidal'
  if (nb.length === 4) return Math.max(...angs) < 150 ? 'tetrahedral' : null
  if (nb.length === 6) return 'octahedral'
  return null
}

/**
 * Простейшие (школьные) формулы веществ, у которых в твёрдом состоянии нет отдельных молекул такого состава
 * (Greenwood & Earnshaw, «Chemistry of the Elements»): CrO₃ — цепи тетраэдров CrO₄; V₂O₅ — слои; H₂SiO₃ — полимер
 * (xSiO₂·yH₂O); HPO₃ — полимер (HPO₃)ₙ; P₂O₅ — молекулы P₄O₁₀. Форму «молекулы» по модели не называем.
 */
const POLYMERIC_FORMULA: Record<string, 'polymeric' | 'p4o10'> = { CrO3: 'polymeric', V2O5: 'polymeric', H2SiO3: 'polymeric', HPO3: 'polymeric', P2O5: 'p4o10' }

/**
 * Валентные электроны p-элементов (номер группы) — для проверки формы нейтральной молекулы. Азота нет: в школьной
 * графической формуле донорно-акцепторная N→O рисуется одной палочкой (HNO₃, N₂O₄), и счёт пар по палочкам неверен.
 */
const VALENCE_E: Record<string, number> = { B: 3, C: 4, Si: 4, P: 5, As: 5, O: 6, S: 6, Se: 6, Te: 6, F: 7, Cl: 7, Br: 7, I: 7 }
/** Форма по числу соседей n и неподелённых пар e (теория отталкивания электронных пар). */
const VSEPR: Record<string, FormationShapeKey> = {
  '2,0': 'linear', '2,1': 'angular', '2,2': 'angular', '2,3': 'linear',
  '3,0': 'trigonal-planar', '3,1': 'trigonal-pyramidal', '4,0': 'tetrahedral', '6,0': 'octahedral',
}
/**
 * Форма вокруг атома нейтральной молекулы по электронным парам: e = (валентные электроны − сумма кратностей связей) / 2.
 * null — не определяется однозначно (дробное e: радикал NO₂, формальные заряды N в HNO₃, O₃; d-элементы).
 */
function vseprAround(model: SchoolHeroModel, c: number, bondIdx: readonly number[]): FormationShapeKey | null {
  const el = model.atoms[c]!.el
  const V = VALENCE_E[el]
  if (V == null) return null
  let n = 0
  let sum = 0
  for (const k of bondIdx) {
    const b = model.bonds[k]!
    if (b.a !== c && b.b !== c) continue
    n++
    sum += b.order
  }
  const e2 = V - sum
  if (e2 < 0 || e2 % 2 !== 0) return null
  return VSEPR[`${n},${e2 / 2}`] ?? null
}

/** Форма связной группы атомов модели (молекула или многоатомный ион). */
function shapeOfGroup(model: SchoolHeroModel, atoms: readonly number[], bondIdx: readonly number[], of: string): FormationShape | null {
  const set = new Set(atoms)
  const nb = new Map<number, number[]>()
  for (const a of atoms) nb.set(a, [])
  for (const k of bondIdx) {
    const b = model.bonds[k]!
    if (!set.has(b.a) || !set.has(b.b)) continue
    nb.get(b.a)!.push(b.b)
    nb.get(b.b)!.push(b.a)
  }
  if (atoms.length < 2) return null
  const els = atoms.map((a) => model.atoms[a]!.el)
  const single = els.every((e) => e === els[0])
  // Простые вещества из многих атомов: P₄ — тетраэдр, S₈ — кольцо («корона»).
  if (single && atoms.length === 4 && bondIdx.length === 6) return { key: 'tetrahedron-p4', of }
  if (single && atoms.length >= 5 && atoms.every((a) => nb.get(a)!.length === 2)) return { key: 'ring', of }
  const maxDeg = Math.max(...atoms.map((a) => nb.get(a)!.length))
  if (maxDeg === 0) return null
  const centers = atoms.filter((a) => nb.get(a)!.length === maxDeg)
  // Центр — атом наибольшей степени; одинаковые центры одного элемента — «вокруг каждого».
  const c = centers[0]!
  const key = shapeAround(model, c, nb.get(c)!)
  if (!key) return null
  if (maxDeg === 1) return { key: 'linear', of }
  const cEl = model.atoms[c]!.el
  const sameEl = centers.filter((a) => model.atoms[a]!.el === cEl)
  const each = sameEl.length > 1 && sameEl.every((a) => shapeAround(model, a, nb.get(a)!) === key)
  return { key, of, center: cEl, each: each || undefined }
}

// ─── Частицы модели ────────────────────────────────────────────────────────

function components(n: number, edges: readonly [number, number][]): number[][] {
  const par = Array.from({ length: n }, (_, i) => i)
  const f = (x: number): number => (par[x] === x ? x : (par[x] = f(par[x]!)))
  for (const [a, b] of edges) par[f(a)] = f(b)
  const m = new Map<number, number[]>()
  for (let i = 0; i < n; i++) {
    const r = f(i)
    if (!m.has(r)) m.set(r, [])
    m.get(r)!.push(i)
  }
  return [...m.values()]
}

function compOfAtoms(model: SchoolHeroModel, atoms: readonly number[]): Record<string, number> {
  const c: Record<string, number> = {}
  for (const a of atoms) c[model.atoms[a]!.el] = (c[model.atoms[a]!.el] ?? 0) + 1
  return c
}

/** Ионное: разбить атомы модели на ионы / многоатомные ионы / молекулы воды. */
function ionicUnits(model: SchoolHeroModel, species: readonly FormationSpecies[], issues: string[]): { units: FormationUnit[]; covalent: number[] } {
  const ionicContact = (a: number, b: number): boolean => {
    const A = model.atoms[a]!
    const B = model.atoms[b]!
    if (A.charge * B.charge < 0) return true
    // металл–неметалл: ионный контакт (кроме металла внутри многоатомного иона: MnO₄⁻, Cr₂O₇²⁻, AlO₂⁻…)
    return isMetal(A.el) !== isMetal(B.el) && !metalInPolyion(species, isMetal(A.el) ? A.el : B.el)
  }
  const keep: number[] = []
  model.bonds.forEach((b, k) => {
    if (!ionicContact(b.a, b.b) && !(isMetal(model.atoms[b.a]!.el) && isMetal(model.atoms[b.b]!.el))) keep.push(k)
  })
  const comps = components(model.atoms.length, keep.map((k) => [model.bonds[k]!.a, model.bonds[k]!.b] as [number, number]))
  const units: FormationUnit[] = []
  const multi = species.map((s, i) => ({ s, i })).filter(({ s }) => s.kind === 'polyion' || s.kind === 'molecule')
  // Одноатомные частицы одного элемента с разными зарядами (Fe²⁺ / Fe³⁺): распределение по долям формулы.
  const monoSeen = new Map<string, number>()
  const monoFor = (el: string, q: number): number => {
    const cands = species.map((s, i) => ({ s, i })).filter(({ s }) => (s.kind === 'ion' || s.kind === 'atom') && s.comp[el] === 1 && Object.keys(s.comp).length === 1)
    if (cands.length === 0) return -1
    if (cands.length === 1) return cands[0]!.i
    const byCharge = cands.find(({ s }) => s.charge === q && q !== 0)
    if (byCharge) return byCharge.i
    const k = monoSeen.get(el) ?? 0
    monoSeen.set(el, k + 1)
    const total = cands.reduce((s, c) => s + c.s.count, 0)
    let acc = 0
    const pos = (k % total) + 0.5
    for (const c of cands) {
      acc += c.s.count
      if (pos < acc) return c.i
    }
    return cands[cands.length - 1]!.i
  }
  for (const comp of comps) {
    const c = compOfAtoms(model, comp)
    const hit = comp.length > 1 ? multi.find(({ s }) => sameComp(s.comp, c)) : undefined
    if (hit) {
      units.push({ species: hit.i, atoms: comp })
      continue
    }
    if (comp.length > 1) issues.push(`частица модели ${JSON.stringify(c)} не совпадает с ионами формулы — разбита на атомы`)
    for (const a of comp) {
      const s = monoFor(model.atoms[a]!.el, model.atoms[a]!.charge)
      if (s < 0) issues.push(`атом ${model.atoms[a]!.el} модели не входит в частицы формулы`)
      units.push({ species: Math.max(0, s), atoms: [a] })
    }
  }
  // Связи внутри частиц — ковалентные (рисуются с самого начала).
  const unitOf = new Map<number, number>()
  units.forEach((u, i) => u.atoms.forEach((a) => unitOf.set(a, i)))
  const covalent = keep.filter((k) => unitOf.get(model.bonds[k]!.a) === unitOf.get(model.bonds[k]!.b))
  return { units, covalent }
}

function metalInPolyion(species: readonly FormationSpecies[], metal: string): boolean {
  return species.some((s) => s.kind === 'polyion' && s.charge < 0 && (s.comp[metal] ?? 0) > 0)
}

/** Порядок связей: обход в ширину от центра (атом наибольшей степени) по каждой связной части. */
function bondSequence(model: SchoolHeroModel, allowed: readonly number[]): number[] {
  const set = new Set(allowed)
  const nb = model.atoms.map(() => [] as { k: number; o: number }[])
  for (const k of allowed) {
    const b = model.bonds[k]!
    nb[b.a]!.push({ k, o: b.b })
    nb[b.b]!.push({ k, o: b.a })
  }
  const seenA = new Set<number>()
  const seenB = new Set<number>()
  const out: number[] = []
  const starts = model.atoms.map((_, i) => i).sort((p, q) => nb[q]!.length - nb[p]!.length)
  for (const s of starts) {
    if (seenA.has(s) || nb[s]!.length === 0) continue
    const queue = [s]
    seenA.add(s)
    while (queue.length) {
      const v = queue.shift()!
      for (const { k, o } of nb[v]!) {
        if (seenB.has(k) || !set.has(k)) continue
        seenB.add(k)
        out.push(k)
        if (!seenA.has(o)) {
          seenA.add(o)
          queue.push(o)
        }
      }
    }
  }
  return out
}

const SCHOOL_EL_ORDER = ['Li', 'Na', 'K', 'Be', 'Mg', 'Ca', 'Ba', 'Al', 'Zn', 'Fe', 'Cu', 'Ag', 'Mn', 'Cr', 'Pb', 'Hg', 'Au', 'V', 'Si', 'C', 'P', 'N', 'S', 'Se', 'H', 'Cl', 'Br', 'I', 'O', 'F']

function bondKinds(model: SchoolHeroModel, bondIdx: readonly number[]): { label: string; count: number }[] {
  const m = new Map<string, number>()
  for (const k of bondIdx) {
    const b = model.bonds[k]!
    const sym = b.order >= 3 ? '≡' : b.order === 2 ? '=' : '–'
    // Порядок символов — по паре элементов (не по атому): центр раньше (S=O, P–O, Si–O), H — после O, N, S…
    // (O–H, N–H), но перед галогеном (H–Cl).
    let [ex, ey] = [model.atoms[b.a]!.el, model.atoms[b.b]!.el]
    const halogen = (e: string) => e === 'F' || e === 'Cl' || e === 'Br' || e === 'I'
    const idx = (e: string) => SCHOOL_EL_ORDER.indexOf(e)
    const hFirstOk = (h: string, o: string) => h === 'H' && halogen(o)
    if (ex === 'H' && !hFirstOk(ex, ey)) [ex, ey] = [ey, ex]
    else if (ey === 'H' && hFirstOk(ey, ex)) [ex, ey] = [ey, ex]
    else if (ex !== 'H' && ey !== 'H' && idx(ey) < idx(ex)) [ex, ey] = [ey, ex]
    const label = `${ex}${sym}${ey}`
    m.set(label, (m.get(label) ?? 0) + 1)
  }
  return [...m.entries()].map(([label, count]) => ({ label, count }))
}

/** Школьные валентности для сверки модели. */
const ALLOWED_VALENCE: Record<string, readonly number[]> = {
  H: [1], O: [2, 3], F: [1], Cl: [1, 3, 5, 7], Br: [1, 3, 5, 7], I: [1, 3, 5, 7], S: [2, 4, 6], Se: [2, 4, 6],
  N: [1, 2, 3, 4], P: [3, 5], C: [2, 3, 4], Si: [4], B: [3], Cr: [2, 3, 6], Mn: [2, 4, 6, 7], V: [5],
}
/**
 * Валентность азота в оксидах — по школьной структурной формуле (азот не бывает больше чем четырёхвалентным):
 * NO₂ и N₂O₄ — IV (оксид азота(IV)), N₂O₃ — III, N₂O₅ — IV (степень окисления +5, одна связь N→O —
 * донорно-акцепторная). N₂O — по модели N≡N→O (III и IV).
 */
const VALENCE_OVERRIDE: Record<string, Record<string, number>> = { no2: { N: 4 }, tb_n2o4: { N: 4 }, tb_n2o3: { N: 3 }, n2o5: { N: 4 } }
/** Постоянная валентность партнёра в бинарном соединении (для валентности второго элемента по формуле). */
const FIXED_VALENCE: Record<string, number> = { O: 2, H: 1, F: 1 }

/**
 * Валентность элемента el по формуле: бинарное соединение с O, H или F (SO₂ → IV, CrO₃ → VI, PH₃ → III),
 * иначе — модуль степени окисления единственного элемента кроме H и O (H₄P₂O₇ → V). Азот и углерод — нет
 * (N — таблица VALENCE_OVERRIDE, C в CO — III по тройной связи).
 */
function formulaValence(el: string, comp: Record<string, number>): number | null {
  if (el === 'N' || el === 'C' || el in FIXED_VALENCE) return null
  const els = Object.keys(comp)
  if (els.length === 2) {
    const other = els.find((e) => e !== el)!
    const v = FIXED_VALENCE[other]
    if (v == null) return null
    const x = (comp[other]! * v) / comp[el]!
    return Number.isInteger(x) ? x : null
  }
  if (els.every((e) => e === el || e === 'H' || e === 'O')) {
    const x = (2 * (comp.O ?? 0) - (comp.H ?? 0)) / comp[el]!
    return Number.isInteger(x) && x > 0 ? x : null
  }
  return null
}

// ─── План ──────────────────────────────────────────────────────────────────

const planCache = new Map<string, FormationPlan | null>()

export function formationPlan(compoundId: string): FormationPlan | null {
  const hit = planCache.get(compoundId)
  if (hit !== undefined) return hit
  const plan = buildPlan(compoundId)
  planCache.set(compoundId, plan)
  return plan
}

function buildPlan(compoundId: string): FormationPlan | null {
  const c = compoundById[compoundId]
  if (!c) return null
  const model = buildSchoolHeroModel(c)
  const issues: string[] = []
  const comp = { ...c.composition }
  const plain = plainFormula(c.formulaUnicode).replace(/\s+/g, '')
  const partsRaw = plain.split(/[·*]/)
  const hasMetal = Object.keys(comp).some(isMetal)
  const hasNH4 = /NH4/.test(plain) && (c.category === 'salt' || c.category === 'base') && !/NH3/.test(plain)
  const ox = metalOxState(comp)
  const covalentMetal = hasMetal && ox != null && (ox >= 5 || c.category === 'acid')
  const ionic = (hasMetal || hasNH4) && !covalentMetal

  let species: FormationSpecies[] = []
  let mode: FormationPlan['mode'] = ionic ? 'ionic' : 'molecular'
  if (ionic) {
    const ov = OVERRIDES[compoundId]
    if (ov) {
      species = ov.map(([key, q, n]) => {
        if (key.startsWith('M:')) return cationSpecies(key.slice(2), q, n)
        if (key.startsWith('A:')) return anionSpecies(key.slice(2), q, n)
        return polySpecies(POLY_IONS.find((p) => p.key === key && p.charge === q)!, n)
      })
    } else {
      // Части через «·»: ионные части и кристаллизационная вода (5H₂O).
      const merged = new Map<string, FormationSpecies>()
      for (const raw of partsRaw) {
        const m = /^(\d+)(.*)$/.exec(raw)
        const coef = m ? Number(m[1]) : 1
        const body = m ? m[2]! : raw
        const toks = parseTokens(body, 0).toks
        const pc = compOf(toks)
        if (sameComp(pc, { H: 2, O: 1 })) {
          const w: FormationSpecies = { formula: 'H₂O', kind: 'molecule', charge: 0, count: coef, comp: { H: 2, O: 1 }, nameKey: 'mol:H2O' }
          merged.set('H₂O', { ...w, count: (merged.get('H₂O')?.count ?? 0) + coef })
          continue
        }
        const parts = ionicParts(toks, pc)
        if (!parts) {
          issues.push(`формула не разобрана на ионы: ${raw}`)
          continue
        }
        for (const p of parts) {
          const prev = merged.get(p.species.formula)
          merged.set(p.species.formula, prev ? { ...prev, count: prev.count + p.species.count * coef } : { ...p.species, count: p.species.count * coef })
        }
      }
      species = [...merged.values()]
      // Школьный порядок: катионы → анионы → вода.
      species.sort((a, b) => rank(a) - rank(b))
    }
    if (species.length === 0) mode = 'molecular'
  }
  if (mode === 'molecular') {
    // Порядок — как в формуле (H₂SO₄: H, S, O); не найденные в записи — по школьному ряду.
    const seen = [...plain.matchAll(/[A-Z][a-z]?/g)].map((m) => m[0])
    const pos = (el: string) => {
      const i = seen.indexOf(el)
      return i >= 0 ? i : 100 + SCHOOL_EL_ORDER.indexOf(el)
    }
    const order = Object.keys(comp).sort((a, b) => pos(a) - pos(b))
    species = order.map((el) => ({ formula: el, kind: 'atom' as const, charge: 0, count: comp[el]!, comp: { [el]: 1 }, nameKey: `el:${el}` }))
  }

  // Сверка состава.
  const sum: Record<string, number> = {}
  for (const s of species) for (const [e, n] of Object.entries(s.comp)) sum[e] = (sum[e] ?? 0) + n * s.count
  if (!sameComp(sum, comp)) issues.push(`частицы ${JSON.stringify(sum)} ≠ формула ${JSON.stringify(comp)}`)

  // Баланс зарядов.
  let balance: string | null = null
  if (mode === 'ionic') {
    const charged = species.filter((s) => s.charge !== 0)
    const q = (x: number) => (x > 0 ? `(+${x})` : `(−${-x})`)
    balance = `${charged.map((s) => (s.count > 1 ? `${s.count}·${q(s.charge)}` : q(s.charge))).join(' + ')} = 0`
    const total = charged.reduce((s, x) => s + x.count * x.charge, 0)
    if (total !== 0) issues.push(`сумма зарядов ${total} ≠ 0`)
  }

  // Тип связи.
  const nonmetalKinds = Object.keys(comp)
  let bondType: FormationBondType
  let hydrogenBond = false
  if (mode === 'ionic') {
    bondType = species.some((s) => s.kind === 'polyion' || s.kind === 'molecule') ? 'ionic-covalent' : 'ionic'
  } else if (nonmetalKinds.length === 1) bondType = 'covalent-nonpolar'
  else {
    bondType = 'covalent-polar'
    hydrogenBond = partsRaw.length > 1
  }

  // Частицы на экране и порядок сборки.
  let units: FormationUnit[] = []
  let covalentBonds: number[] = []
  if (model) {
    if (mode === 'ionic') {
      const r = ionicUnits(model, species, issues)
      units = r.units
      covalentBonds = r.covalent
    } else {
      units = model.atoms.map((a, i) => ({ species: Math.max(0, species.findIndex((s) => s.comp[a.el] === 1 && s.kind === 'atom')), atoms: [i] }))
      covalentBonds = model.bonds.map((_, k) => k)
    }
    const mc: Record<string, number> = {}
    for (const a of model.atoms) mc[a.el] = (mc[a.el] ?? 0) + 1
    const els = Object.keys(comp)
    if (!sameComp(Object.fromEntries(Object.keys(mc).map((e) => [e, 1])), Object.fromEntries(els.map((e) => [e, 1])))) {
      issues.push(`элементы модели ${Object.keys(mc).join(',')} ≠ формула ${els.join(',')}`)
    }
  }
  const bondOrder = model ? bondSequence(model, covalentBonds) : []

  // Связи внутри многоатомных ионов — по одному иону каждого вида (в том же порядке, что и частицы).
  const innerBonds: FormationPlan['innerBonds'] = []
  if (model && mode === 'ionic') {
    species.forEach((sp, si) => {
      if (sp.kind !== 'polyion') return
      const u = units.find((x) => x.species === si)
      if (!u) return
      const own = new Set(u.atoms)
      const idx = covalentBonds.filter((k) => own.has(model.bonds[k]!.a) && own.has(model.bonds[k]!.b))
      if (idx.length) innerBonds.push({ of: sp.formula, kinds: bondKinds(model, idx) })
    })
  }

  // Валентности (ковалентное).
  const issuesBeforeValence = issues.length
  let alsoNonpolar = false
  if (mode === 'molecular' && model) {
    const sums = model.atoms.map(() => 0)
    for (const b of model.bonds) {
      sums[b.a]! += b.order
      sums[b.b]! += b.order
      if (model.atoms[b.a]!.el === model.atoms[b.b]!.el && nonmetalKinds.length > 1) alsoNonpolar = true
    }
    for (const s of species) {
      const el = Object.keys(s.comp)[0]!
      const ov = VALENCE_OVERRIDE[compoundId]?.[el]
      let vals = [...new Set(model.atoms.map((a, i) => (a.el === el ? sums[i]! : -1)).filter((v) => v >= 0))].sort((a, b) => a - b)
      // Кислород в школьном курсе двухвалентен (у концевого O донорно-акцепторной N→O одна палочка);
      // в CO — тройная связь (валентность III).
      if (el === 'O') vals = [...new Set(vals.map((v) => (v === 3 ? 3 : 2)))]
      if (el === 'H') vals = [1]
      const fv = formulaValence(el, comp)
      if (ov) vals = [ov]
      else if (fv != null) {
        if (model.kind !== 'crystal' && (vals.length !== 1 || vals[0] !== fv)) issues.push(`валентность ${el} по связям модели ${vals.join('/')} ≠ по формуле ${fv}`)
        vals = [fv]
      }
      const allowed = ALLOWED_VALENCE[el]
      if (allowed && vals.some((v) => !allowed.includes(v))) {
        issues.push(`валентность ${el} по модели ${vals.join('/')} вне школьных ${allowed.join('/')}`)
        vals = vals.filter((v) => allowed.includes(v))
      }
      if (vals.length > 0) s.valences = vals
    }
  }

  // Форма.
  const shapes: FormationShape[] = []
  const crystal = model?.kind === 'crystal'
  let bondsReliable = mode === 'molecular' && !!model && issues.length === issuesBeforeValence
  if (crystal) shapes.push({ key: mode === 'ionic' ? 'ionic-lattice' : 'atomic-lattice', of: '' })
  const polymeric = POLYMERIC_FORMULA[plain]
  if (polymeric) shapes.push({ key: polymeric, of: '' })
  if (model && mode === 'molecular' && !crystal && !polymeric) {
    const comps = components(model.atoms.length, model.bonds.map((b) => [b.a, b.b] as [number, number]))
    if (comps.length === 1) {
      const all = model.bonds.map((_, k) => k)
      const sh = shapeOfGroup(model, comps[0]!, all, '')
      // Сверка с теорией электронных пар: модель с другой формой — форму не называем (ведёт schoolHeroModel).
      const deg = (a: number) => model.bonds.reduce((d, b) => d + (b.a === a || b.b === a ? 1 : 0), 0)
      const maxDeg = Math.max(...comps[0]!.map(deg))
      const centerIdx = sh?.center ? comps[0]!.find((a) => model.atoms[a]!.el === sh.center && deg(a) === maxDeg) : undefined
      const ref = sh && sh.key !== 'ring' && sh.key !== 'tetrahedron-p4' && centerIdx != null ? vseprAround(model, centerIdx, all) : null
      if (sh && ref && ref !== sh.key) issues.push(`форма модели ${sh.key} ≠ по электронным парам ${ref} (вокруг ${sh.center}) — форма не называется`)
      else if (sh) shapes.push(sh)
    } else if (partsRaw.length === 1) {
      bondsReliable = false
      // Одна молекула по формуле, а модель из нескольких несвязанных частей — форму не называем.
      issues.push(`молекулярная модель распалась на ${comps.length} части`)
    } else {
      // Несколько молекул (NH₃·H₂O): форма каждой.
      for (const cc of comps) {
        const f = molFormula(SCHOOL_EL_ORDER, compOfAtoms(model, cc))
        const sh = shapeOfGroup(model, cc, model.bonds.map((_, k) => k), f)
        if (sh && !shapes.some((x) => x.of === f)) shapes.push(sh)
      }
    }
  }
  if (model && mode === 'ionic') {
    // По одной частице каждого вида, в порядке частиц формулы (SO₄²⁻, затем H₂O).
    species.forEach((s, si) => {
      const u = units.find((x) => x.species === si && x.atoms.length >= 2)
      if (!u) return
      const sh = shapeOfGroup(model, u.atoms, covalentBonds, s.formula)
      // Справочная форма иона (POLY_IONS.shape; H₂O — угловая): модель с другой формой — форму не называем.
      const ref = s.kind === 'molecule' ? 'angular' : s.nameKey.startsWith('poly:') ? polyByKey.get(s.nameKey.slice(5))?.shape : undefined
      if (ref === null) return
      if (sh && ref && sh.key !== ref) {
        issues.push(`форма ${s.formula} в модели ${sh.key} ≠ справочной ${ref} — форма не называется`)
        return
      }
      if (sh) shapes.push(sh)
    })
    if (!crystal) shapes.push({ key: 'formula-unit', of: '' })
  }
  if (!model && mode === 'ionic') shapes.push({ key: 'formula-unit', of: '' })

  // Порядок прихода частиц: ближние к центру — первыми (молекулы: по порядку связей).
  const unitOrder = units
    .map((u, i) => ({ i, d: model ? Math.min(...u.atoms.map((a) => Math.hypot(...model.atoms[a]!.pos))) : 0 }))
    .sort((a, b) => a.d - b.d)
    .map((x) => x.i)

  return {
    compoundId,
    formula: c.formulaUnicode,
    mode,
    bondType,
    hydrogenBond,
    // Связь одинаковых атомов называем, только если связи модели согласуются с формулой (у V₂O₅ модели O–O нет в веществе).
    alsoNonpolar: alsoNonpolar && bondsReliable,
    species,
    balance,
    bondKinds: model ? bondKinds(model, covalentBonds) : [],
    innerBonds,
    bondsReliable,
    shapes,
    crystal: !!crystal,
    hasModel: !!model,
    units,
    bondOrder,
    unitOrder,
    modelIssues: issues,
  }
}

function rank(s: FormationSpecies): number {
  if (s.kind === 'molecule') return 3
  return s.charge > 0 ? 0 : 1
}
