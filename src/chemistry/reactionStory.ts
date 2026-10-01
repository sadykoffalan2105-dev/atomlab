/**
 * СЮЖЕТ РЕАКЦИИ «на уровне частиц» — чистый модуль (без React и three) для анимации после синтеза.
 *
 * По уравнению с целыми коэффициентами строит:
 *   • частицы по коэффициентам: формульные единицы → группы (ионы, молекулы, кислотные остатки) → атомы и связи;
 *     ионные вещества — из ионов (Ba²⁺, Cl⁻, SO₄²⁻), молекулы — атомы со связями (школьная структурная формула);
 *   • степени окисления каждого атома слева и справа (школьные правила: F −1; O −2, кроме пероксидов и OF₂;
 *     H +1, кроме гидридов металлов; щелочные +1, щёлочноземельные +2, Al +3, Zn +2, Ag +1; простые вещества 0;
 *     известные заряды кислотных остатков; остальное — из электронейтральности по электроотрицательности);
 *   • сопоставление атомов реагентов и продуктов: многоатомные группы, которые есть и слева, и справа
 *     (SO₄²⁻, NO₃⁻, OH⁻, CO₃²⁻ …), переходят ЦЕЛИКОМ; остальные атомы — с наибольшим числом сохранённых связей;
 *   • какие связи рвутся, какие сохраняются, какие образуются; распад и сборку ионных веществ;
 *   • перенос электронов: кто отдаёт (восстановитель), кто принимает (окислитель), сколько — Σ изменений
 *     степеней окисления по уравнению (отдано = принято);
 *   • тип реакции, что выделяется (газ ↑, осадок ↓, вода), баланс атомов и тексты шагов RU/EN/UZ.
 *
 * Проверка — scripts/test-reaction-story.mts (банк реакций, уравнения учебников 7–9, эталоны).
 */
import { formulaToUnicode, parseEquationText, type EquationSpecies } from './equationFormula'
import { schoolBondOrders } from '../components/lab/hero/schoolHeroModel'

export type StoryLocale = 'ru' | 'en' | 'uz'
export type StoryText = Readonly<Record<StoryLocale, string>>

/** Вид формульной единицы на сцене. */
export type StoryUnitKind = 'metal' | 'atomic' | 'molecule' | 'ionic' | 'ion'
/** Вид группы: атом простого вещества, молекула (или её часть), катион, анион, кислотный остаток, H кислоты. */
export type StoryGroupKind = 'atom' | 'molecule' | 'cation' | 'anion' | 'residue' | 'acidH'

export type StoryAtom = {
  readonly id: number
  readonly el: string
  readonly unit: number
  readonly group: number
  /** степень окисления (у органики — средняя по элементу, может быть дробной) */
  readonly ox: number
}

/** order — кратность по школьной графической формуле (CO₂ — O=C=O, N₂ — N≡N); у ионов и солей — 1 (равноценные связи). */
export type StoryBond = { readonly a: number; readonly b: number; readonly order: number }

export type StoryGroup = {
  readonly id: number
  readonly unit: number
  readonly kind: StoryGroupKind
  readonly atoms: readonly number[]
  /** заряд иона (у групп молекулы — 0) */
  readonly charge: number
  /** подпись: «SO₄²⁻», «Na⁺», «H₂O», «SO₄» (остаток кислоты) */
  readonly label: string
  /** ключ состава группы для сопоставления сторон */
  readonly key: string
}

export type StoryFate = 'gas' | 'precipitate' | 'deposit' | 'water' | null

export type StoryUnit = {
  readonly id: number
  readonly term: number
  readonly copy: number
  readonly kind: StoryUnitKind
  readonly formula: string
  readonly atoms: readonly number[]
  readonly groups: readonly number[]
  readonly charge: number
  /** молекула кислоты: при разрыве H уходит протоном H⁺, остаток уносит электроны связи */
  readonly acid: boolean
}

export type StorySide = {
  readonly units: StoryUnit[]
  readonly groups: StoryGroup[]
  readonly atoms: StoryAtom[]
  readonly bonds: StoryBond[]
}

export type StoryTerm = {
  readonly side: 'left' | 'right'
  readonly index: number
  readonly formula: string
  readonly coeff: number
  readonly charge: number
  readonly kind: StoryUnitKind
  readonly fate: StoryFate
  /** ионная запись вещества: «Ba²⁺ + 2Cl⁻» (null — не ионное) */
  readonly ions: string | null
}

export type StoryReactionType = 'combination' | 'decomposition' | 'substitution' | 'exchange' | 'neutralization' | 'other'

/** Изменение степени окисления одного элемента: from → to у count атомов. */
export type StoryOxChange = {
  readonly el: string
  readonly from: number
  readonly to: number
  readonly count: number
  /** e⁻ на все атомы этой строки: >0 — отдано (окисление), <0 — принято (восстановление) */
  readonly electrons: number
  /** вещество-участник слева (формула), в котором стоит этот атом */
  readonly term: string
  readonly atoms: readonly number[]
}

/** Перелёт электронов от атома-донора к атому-акцептору (id атомов левой стороны). */
export type StoryTransfer = { readonly from: number; readonly to: number; readonly n: number }

export type StoryStepId = 'reactants' | 'breaking' | 'electrons' | 'formation' | 'result'

export type StoryStepText = { readonly title: string; readonly body: string; readonly equation: string }

export type ReactionStory = {
  /** уравнение Unicode с пометками ↑ ↓ */
  readonly equation: string
  readonly terms: readonly StoryTerm[]
  readonly left: StorySide
  readonly right: StorySide
  /** id атома слева → id атома справа (биекция по элементам) */
  readonly map: readonly number[]
  /** индексы связей левой стороны */
  readonly bondsBroken: readonly number[]
  readonly bondsKept: readonly number[]
  /** индексы связей правой стороны, которых не было */
  readonly bondsFormed: readonly number[]
  /** группы, перешедшие целиком: [группа слева, группа справа] */
  readonly conserved: readonly (readonly [number, number])[]
  readonly redox: boolean
  /** сколько e⁻ перешло по уравнению (Σ отданных = Σ принятых) */
  readonly electrons: number
  readonly given: number
  readonly accepted: number
  readonly oxidations: readonly StoryOxChange[]
  readonly reductions: readonly StoryOxChange[]
  readonly transfers: readonly StoryTransfer[]
  readonly type: StoryReactionType
  readonly combustion: boolean
  readonly atomBalance: readonly { readonly el: string; readonly left: number; readonly right: number }[]
  readonly steps: readonly StoryStepId[]
  readonly text: Readonly<Record<StoryLocale, Readonly<Record<StoryStepId, StoryStepText>>>>
}

// ─────────────────────────────────────────────────────────────────────────────
// Справочник
// ─────────────────────────────────────────────────────────────────────────────

const METALS = new Set(
  (
    'Li Na K Rb Cs Fr Be Mg Ca Sr Ba Ra Al Ga In Tl Sn Pb Bi Sc Ti V Cr Mn Fe Co Ni Cu Zn Y Zr Nb Mo Tc Ru Rh Pd Ag Cd ' +
    'Hf Ta W Re Os Ir Pt Au Hg La Ce Pr Nd Sm Eu Gd U Th'
  ).split(' '),
)
const ALKALI = new Set(['Li', 'Na', 'K', 'Rb', 'Cs', 'Fr'])
const ALKALINE_EARTH = new Set(['Be', 'Mg', 'Ca', 'Sr', 'Ba', 'Ra'])
/** Постоянная степень окисления металлов в соединениях (школа). */
const FIXED_METAL_OX: Readonly<Record<string, number>> = { Al: 3, Zn: 2, Ag: 1, Cd: 2, Ga: 3, Sc: 3 }
const HALOGENS = new Set(['F', 'Cl', 'Br', 'I', 'At'])
const CHALCOGENS = new Set(['O', 'S', 'Se', 'Te'])
const PNICTOGENS = new Set(['N', 'P', 'As', 'Sb'])

/** Электроотрицательность по Полингу (школьные элементы). */
const EN: Readonly<Record<string, number>> = {
  H: 2.2, Li: 0.98, Be: 1.57, B: 2.04, C: 2.55, N: 3.04, O: 3.44, F: 3.98, Na: 0.93, Mg: 1.31, Al: 1.61, Si: 1.9,
  P: 2.19, S: 2.58, Cl: 3.16, K: 0.82, Ca: 1.0, Sc: 1.36, Ti: 1.54, V: 1.63, Cr: 1.66, Mn: 1.55, Fe: 1.83, Co: 1.88,
  Ni: 1.91, Cu: 1.9, Zn: 1.65, Ga: 1.81, Ge: 2.01, As: 2.18, Se: 2.55, Br: 2.96, Rb: 0.82, Sr: 0.95, Mo: 2.16,
  Ag: 1.93, Cd: 1.69, Sn: 1.96, Sb: 2.05, Te: 2.1, I: 2.66, Cs: 0.79, Ba: 0.89, W: 2.36, Pt: 2.28, Au: 2.54,
  Hg: 2.0, Pb: 1.87, Bi: 2.02, Xe: 2.6, Kr: 3.0,
}
const en = (el: string): number => EN[el] ?? (METALS.has(el) ? 1.5 : 2.5)

/**
 * Многоатомные ионы (ключ — состав «элемент:число» по алфавиту). charge null — заряд по катиону
 * (MnO₄⁻ / MnO₄²⁻ различаются только зарядом: KMnO₄ и K₂MnO₄).
 */
type PolyIon = { formula: string; charge: number | null; cation?: boolean }
const POLY_IONS: readonly PolyIon[] = [
  { formula: 'NH4', charge: 1, cation: true },
  { formula: 'OH', charge: -1 },
  { formula: 'SO4', charge: -2 },
  { formula: 'HSO4', charge: -1 },
  { formula: 'SO3', charge: -2 },
  { formula: 'HSO3', charge: -1 },
  { formula: 'S2O3', charge: -2 },
  { formula: 'CO3', charge: -2 },
  { formula: 'HCO3', charge: -1 },
  { formula: 'NO3', charge: -1 },
  { formula: 'NO2', charge: -1 },
  { formula: 'PO4', charge: -3 },
  { formula: 'HPO4', charge: -2 },
  { formula: 'H2PO4', charge: -1 },
  { formula: 'SiO3', charge: -2 },
  { formula: 'PO3', charge: -1 },
  { formula: 'SiO4', charge: -4 },
  { formula: 'ClO', charge: -1 },
  { formula: 'ClO2', charge: -1 },
  { formula: 'ClO3', charge: -1 },
  { formula: 'ClO4', charge: -1 },
  { formula: 'BrO3', charge: -1 },
  { formula: 'IO3', charge: -1 },
  { formula: 'MnO4', charge: null },
  { formula: 'CrO4', charge: -2 },
  { formula: 'Cr2O7', charge: -2 },
  { formula: 'AlO2', charge: -1 },
  { formula: 'ZnO2', charge: -2 },
  { formula: 'BeO2', charge: -2 },
  { formula: 'CN', charge: -1 },
  { formula: 'SCN', charge: -1 },
  { formula: 'C2O4', charge: -2 },
  { formula: 'CH3COO', charge: -1 },
  { formula: 'B4O7', charge: -2 },
  { formula: 'P2O7', charge: -4 },
]

/** Пероксиды и особые случаи: степени окисления по атомам (порядок — как в формуле). */
const SPECIAL_OX: Readonly<Record<string, Readonly<Record<string, readonly number[]>>>> = {
  Fe3O4: { Fe: [2, 3, 3], O: [-2, -2, -2, -2] },
  Pb3O4: { Pb: [2, 2, 4], O: [-2, -2, -2, -2] },
  Mn3O4: { Mn: [2, 3, 3], O: [-2, -2, -2, -2] },
  Co3O4: { Co: [2, 3, 3], O: [-2, -2, -2, -2] },
  FeS2: { Fe: [2], S: [-1, -1] },
  CaC2: { Ca: [2], C: [-1, -1] },
  OF2: { O: [2], F: [-1, -1] },
  H2O2: { H: [1, 1], O: [-1, -1] },
  N2O: { N: [1, 1], O: [-2] },
}
/** Пероксиды металлов: анион O₂²⁻. */
const PEROXIDE_METAL = /^(Li2|Na2|K2|Rb2|Cs2|Mg|Ca|Sr|Ba|Zn)O2$/
/** Высшие оксиды переходных металлов — молекулярные (кислотные) оксиды, не ионные. */
const MOLECULAR_METAL_COMPOUNDS = new Set(['Mn2O7', 'CrO3', 'OsO4', 'RuO4', 'V2O5', 'MoO3', 'WO3'])

/** Газы при обычных условиях (школьный список) — кандидаты в «газ ↑». */
const GASES = new Set(['H2', 'O2', 'N2', 'Cl2', 'F2', 'CO2', 'CO', 'SO2', 'H2S', 'NO', 'NO2', 'N2O', 'NH3', 'CH4', 'C2H2', 'C2H4', 'O3', 'HCl', 'HBr', 'HI', 'HF', 'PH3', 'SiH4', 'C2H6', 'C3H8', 'ClO2'])
/** Галогеноводороды: газ ↑ только с явной пометкой или при реакции газов (в растворе — кислота). */
const SOLUBLE_GASES = new Set(['HCl', 'HBr', 'HI', 'HF'])
/** Нерастворимые вещества (таблица растворимости) — осадок ↓ в реакциях в растворе. */
const INSOLUBLE = new Set([
  'BaSO4', 'BaCO3', 'BaSO3', 'Ba3(PO4)2', 'CaCO3', 'CaSO3', 'Ca3(PO4)2', 'CaF2', 'SrSO4', 'SrCO3', 'PbSO4', 'PbI2', 'PbCl2',
  'PbS', 'PbCO3', 'AgCl', 'AgBr', 'AgI', 'Ag3PO4', 'Ag2S', 'Ag2CO3', 'Ag2O', 'CuS', 'ZnS', 'FeS', 'MgCO3', 'Cu(OH)2', 'Fe(OH)2', 'Fe(OH)3',
  'Al(OH)3', 'Zn(OH)2', 'Mg(OH)2', 'Mn(OH)2', 'Ni(OH)2', 'Cr(OH)3', 'Pb(OH)2', 'Sn(OH)2', 'Be(OH)2', 'H2SiO3', 'FePO4', 'AlPO4',
  'Mg3(PO4)2', 'Zn3(PO4)2', 'CuCO3', 'ZnCO3', 'FeCO3', '(CuOH)2CO3', 'Cu2(OH)2CO3', 'Hg2Cl2', 'HgS',
])

// ─────────────────────────────────────────────────────────────────────────────
// Разбор формулы на токены
// ─────────────────────────────────────────────────────────────────────────────

type Tok = { el: string; n: number }
type Item = { kind: 'el'; el: string; n: number } | { kind: 'grp'; items: Item[]; n: number; bracket: boolean }

/**
 * Кратность связей молекулы для сюжета: школьная графическая формула (schoolBondOrders) и две двухатомные молекулы,
 * которые общее правило валентностей не выводит (у C в CO и у N в NO валентность «не стандартная»):
 * C≡O (две связи по обменному механизму и одна донорно-акцепторная) и N=O (с неспаренным электроном у N).
 */
function storyBondOrders(els: readonly string[], pairs: readonly (readonly [number, number])[]): number[] {
  if (els.length === 2 && pairs.length === 1) {
    const k = [...els].sort().join('')
    if (k === 'CO') return [3]
    if (k === 'NO') return [2]
  }
  return schoolBondOrders(els, pairs)
}

function parseItems(src: string): Item[] | null {
  let i = 0
  const readNum = (): number => {
    let s = ''
    while (i < src.length && /[0-9]/.test(src[i]!)) s += src[i++]
    return s ? Number(s) : 1
  }
  const seq = (close: string | null): Item[] | null => {
    const out: Item[] = []
    while (i < src.length) {
      const ch = src[i]!
      if (close && ch === close) {
        i++
        return out
      }
      if (ch === '(' || ch === '[') {
        i++
        const inner = seq(ch === '(' ? ')' : ']')
        if (!inner) return null
        out.push({ kind: 'grp', items: inner, n: readNum(), bracket: ch === '[' })
        continue
      }
      const m = /^[A-Z][a-z]?/.exec(src.slice(i))
      if (!m) return null
      i += m[0].length
      out.push({ kind: 'el', el: m[0], n: readNum() })
    }
    return close ? null : out
  }
  return seq(null)
}

function flatTokens(items: readonly Item[], k = 1, out: Tok[] = []): Tok[] {
  for (const it of items) {
    if (it.kind === 'el') out.push({ el: it.el, n: it.n * k })
    else flatTokens(it.items, it.n * k, out)
  }
  return out
}

function tokensKey(toks: readonly Tok[]): string {
  const c: Record<string, number> = {}
  for (const t of toks) c[t.el] = (c[t.el] ?? 0) + t.n
  return Object.keys(c)
    .sort()
    .map((e) => `${e}${c[e]}`)
    .join('')
}

function itemsText(items: readonly Item[]): string {
  return items.map((it) => (it.kind === 'el' ? `${it.el}${it.n > 1 ? it.n : ''}` : `(${itemsText(it.items)})${it.n > 1 ? it.n : ''}`)).join('')
}

const POLY_BY_KEY = new Map<string, PolyIon>()
for (const p of POLY_IONS) {
  const items = parseItems(p.formula)
  if (items) POLY_BY_KEY.set(tokensKey(flatTokens(items)), p)
}

// ─────────────────────────────────────────────────────────────────────────────
// Подписи
// ─────────────────────────────────────────────────────────────────────────────

const SUP_D: Readonly<Record<string, string>> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' }
const supDigits = (n: number) => String(n).split('').map((d) => SUP_D[d] ?? d).join('')

/** Заряд иона: 2 → «²⁺», −1 → «⁻». */
export function ionChargeText(q: number): string {
  if (q === 0) return ''
  const m = Math.abs(q)
  return `${m === 1 ? '' : supDigits(m)}${q > 0 ? '⁺' : '⁻'}`
}

/** Степень окисления (школьная запись знаком вперёд): 2 → «⁺²», −1 → «⁻¹», 0 → «⁰». */
export function oxText(ox: number): string {
  if (ox === 0) return '⁰'
  if (!Number.isInteger(ox)) return `${ox > 0 ? '+' : '−'}${Math.abs(ox).toFixed(2)}`
  return `${ox > 0 ? '⁺' : '⁻'}${supDigits(Math.abs(ox))}`
}

/** Степень окисления обычным текстом: «+2», «−1», «0». */
export function oxPlain(ox: number): string {
  if (ox === 0) return '0'
  const v = Number.isInteger(ox) ? String(Math.abs(ox)) : Math.abs(ox).toFixed(2)
  return `${ox > 0 ? '+' : '−'}${v}`
}

function uni(ascii: string): string {
  return formulaToUnicode(ascii)
}

// ─────────────────────────────────────────────────────────────────────────────
// Строитель стороны
// ─────────────────────────────────────────────────────────────────────────────

type MutSide = { units: StoryUnit[]; groups: StoryGroup[]; atoms: StoryAtom[]; bonds: StoryBond[] }
type MutAtom = { el: string; group: number; ox: number }
type GroupDraft = { kind: StoryGroupKind; toks: Tok[]; charge: number; label: string; atoms: number[] }

class UnitBuilder {
  atoms: MutAtom[] = []
  bonds: [number, number][] = []
  groups: GroupDraft[] = []

  addGroup(kind: StoryGroupKind, toks: Tok[], charge: number, label: string): GroupDraft {
    const g: GroupDraft = { kind, toks, charge, label, atoms: [] }
    this.groups.push(g)
    return g
  }

  addAtom(g: GroupDraft, el: string): number {
    const id = this.atoms.length
    this.atoms.push({ el, group: this.groups.indexOf(g), ox: 0 })
    g.atoms.push(id)
    return id
  }

  bond(a: number, b: number): void {
    if (a === b) return
    if (this.bonds.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) return
    this.bonds.push([a, b])
  }
}

/** Связи внутри многоатомного иона / остатка: центр(ы) — О, H — к O (HSO₄⁻, OH⁻), NH₄⁺ — N–H. */
function bondPolyGroup(ub: UnitBuilder, ids: readonly number[]): void {
  if (ids.length < 2) return
  const els = ids.map((i) => ub.atoms[i]!.el)
  const nonOH = ids.filter((i) => ub.atoms[i]!.el !== 'O' && ub.atoms[i]!.el !== 'H')
  const Os = ids.filter((i) => ub.atoms[i]!.el === 'O')
  const Hs = ids.filter((i) => ub.atoms[i]!.el === 'H')
  if (nonOH.length === 0) {
    // OH⁻, O₂²⁻, H₂O
    if (Os.length >= 2) for (let k = 1; k < Os.length; k++) ub.bond(Os[k - 1]!, Os[k]!)
    Hs.forEach((h, k) => ub.bond(Os[k % Math.max(1, Os.length)]!, h))
    return
  }
  // ацетат CH₃COO⁻ и прочая органика — цепочка углеродов
  if (els.filter((e) => e === 'C').length >= 2 && Hs.length > 0) {
    bondMoleculeGeneric(ub, ids)
    return
  }
  if (nonOH.length === 1) {
    const c = nonOH[0]!
    for (const o of Os) ub.bond(c, o)
    // H: к кислороду (HSO₄⁻, HCO₃⁻, H₂PO₄⁻), без кислорода — к центру (NH₄⁺)
    Hs.forEach((h, k) => ub.bond(Os.length > 0 ? Os[k % Os.length]! : c, h))
    return
  }
  // два центра: S₂O₃²⁻ (S–S), Cr₂O₇²⁻ и P₂O₇⁴⁻ (мостиковый O), C₂O₄²⁻ (C–C), SCN⁻ / CN⁻ — цепочка
  if (Os.length === 0) {
    for (let k = 1; k < nonOH.length; k++) ub.bond(nonOH[k - 1]!, nonOH[k]!)
    return
  }
  const [c1, c2] = nonOH
  const rest = Os.slice()
  if (Os.length % 2 === 1 && ub.atoms[c1!]!.el === ub.atoms[c2!]!.el) {
    const bridge = rest.shift()!
    ub.bond(c1!, bridge)
    ub.bond(bridge, c2!)
  } else {
    ub.bond(c1!, c2!)
  }
  if (ub.atoms[c1!]!.el !== ub.atoms[c2!]!.el && nonOH.length === 2 && els.includes('S') && rest.length === 3) {
    // S₂O₃: центральная S с тремя O и концевой S
    const center = ub.atoms[c1!]!.el === 'S' ? c1! : c2!
    for (const o of rest) ub.bond(center, o)
  } else {
    rest.forEach((o, k) => ub.bond(k % 2 === 0 ? c1! : c2!, o))
  }
  for (let k = 2; k < nonOH.length; k++) ub.bond(nonOH[k - 1]!, nonOH[k]!)
  Hs.forEach((h, k) => ub.bond(Os[k % Os.length]!, h))
}

/**
 * Связи молекулы по школьной структурной формуле: центр — наименее электроотрицательный атом (кроме H);
 * у кислородных кислот H связан с O; два одинаковых центра — мостиковый O (N₂O₅, P₂O₅, Cl₂O₇) или
 * прямая связь (N₂O₄, H₂O₂, N₂H₄); больше центров — цепочка (органика).
 */
function bondMoleculeGeneric(ub: UnitBuilder, ids: readonly number[], formulaKey = ''): void {
  if (ids.length < 2) return
  const el = (i: number) => ub.atoms[i]!.el
  if (formulaKey === 'N2O1' || formulaKey === 'N2O') {
    const ns = ids.filter((i) => el(i) === 'N')
    const o = ids.find((i) => el(i) === 'O')!
    ub.bond(ns[0]!, ns[1]!)
    ub.bond(ns[1]!, o)
    return
  }
  const heavy = ids.filter((i) => el(i) !== 'H')
  const Hs = ids.filter((i) => el(i) === 'H')
  if (heavy.length === 0) {
    for (let k = 1; k < Hs.length; k++) ub.bond(Hs[k - 1]!, Hs[k]!)
    return
  }
  const elements = [...new Set(heavy.map(el))]
  // центр: наименее электроотрицательный тяжёлый элемент; у органики — углерод
  let centerEl = elements.reduce((a, b) => (en(a) <= en(b) ? a : b))
  if (elements.includes('C') && Hs.length > 0 && heavy.filter((i) => el(i) === 'C').length >= 1) centerEl = 'C'
  if (elements.length === 1) centerEl = elements[0]!
  const centers = heavy.filter((i) => el(i) === centerEl)
  const others = heavy.filter((i) => el(i) !== centerEl)
  const oxoacid = centerEl !== 'O' && centerEl !== 'C' && others.some((i) => el(i) === 'O') && Hs.length > 0
  const organic = centerEl === 'C' && Hs.length > 0
  if (elements.length === 1) {
    // H₂O₂, N₂H₄, C₂H₆ — цепочка центров, H поровну
    for (let k = 1; k < centers.length; k++) ub.bond(centers[k - 1]!, centers[k]!)
    Hs.forEach((h, k) => ub.bond(centers[k % centers.length]!, h))
    return
  }
  if (centers.length === 1) {
    const c = centers[0]!
    for (const o of others) ub.bond(c, o)
  } else if (centers.length === 2 && !organic) {
    const Os = others.filter((i) => el(i) === 'O')
    const rest = others.slice()
    if (Os.length % 2 === 1 && Os.length >= 3) {
      const bridge = Os[0]!
      rest.splice(rest.indexOf(bridge), 1)
      ub.bond(centers[0]!, bridge)
      ub.bond(bridge, centers[1]!)
    } else {
      ub.bond(centers[0]!, centers[1]!)
    }
    rest.forEach((o, k) => ub.bond(centers[k % 2]!, o))
  } else {
    for (let k = 1; k < centers.length; k++) ub.bond(centers[k - 1]!, centers[k]!)
    others.forEach((o, k) => ub.bond(centers[(centers.length - 1 - (k % centers.length)) | 0]!, o))
  }
  if (oxoacid) {
    const Os = others.filter((i) => el(i) === 'O')
    Hs.forEach((h, k) => ub.bond(k < Os.length ? Os[k]! : centers[0]!, h))
  } else if (organic) {
    // H — к углеродам до валентности 4, остальные — к O (спирты, кислоты)
    const deg = (i: number) => ub.bonds.filter(([a, b]) => a === i || b === i).length
    const Os = others.filter((i) => el(i) === 'O')
    let oi = 0
    for (const h of Hs) {
      const c = centers.find((x) => deg(x) < 4)
      if (c != null) ub.bond(c, h)
      else ub.bond(Os[oi++ % Math.max(1, Os.length)] ?? centers[0]!, h)
    }
  } else {
    Hs.forEach((h, k) => ub.bond(centers[k % centers.length]!, h))
  }
}

type UnitSpec = {
  kind: StoryUnitKind
  formula: string
  builder: UnitBuilder
  charge: number
  acid: boolean
}

/** Добавить группу-ион из токенов (атомы + связи). */
function addIonGroup(ub: UnitBuilder, kind: StoryGroupKind, toks: Tok[], charge: number, labelBase: string): GroupDraft {
  const g = ub.addGroup(kind, toks, charge, `${uni(labelBase)}${ionChargeText(charge)}`)
  for (const t of toks) for (let k = 0; k < t.n; k++) ub.addAtom(g, t.el)
  bondPolyGroup(ub, g.atoms)
  return g
}

/** Число одинаковых групп в списке токенов (KMnO₄ → MnO₄ ×1). */
function matchPolySuffix(toks: readonly Tok[]): { poly: PolyIon; start: number } | null {
  // самый длинный хвост, совпадающий с известным ионом
  for (let start = 0; start < toks.length; start++) {
    const tail = toks.slice(start)
    const p = POLY_BY_KEY.get(tokensKey(tail))
    if (p && !p.cation && tail.length >= 2) return { poly: p, start }
  }
  return null
}

function buildUnitSpec(sp: EquationSpecies): UnitSpec | null {
  if (!sp.counts || sp.electron) return null
  const raw = sp.formula
  const formula = uni(raw) + ionChargeText(sp.charge)
  const parts = raw.split(/[*·]/)
  const main = parts[0]!
  const items = parseItems(main)
  if (!items || items.length === 0) return null
  const ub = new UnitBuilder()
  const toks = flatTokens(items)
  const elementsInMain = new Set(toks.map((t) => t.el))
  let kind: StoryUnitKind
  let acid = false

  // ——— ион (ионные уравнения): Na⁺, SO₄²⁻, NH₄⁺ ———
  if (sp.charge !== 0) {
    kind = 'ion'
    if (toks.length === 1 && toks[0]!.n === 1) {
      const g = ub.addGroup(sp.charge > 0 ? 'cation' : 'anion', toks, sp.charge, `${toks[0]!.el}${ionChargeText(sp.charge)}`)
      ub.addAtom(g, toks[0]!.el)
    } else {
      addIonGroup(ub, sp.charge > 0 ? 'cation' : 'anion', toks, sp.charge, main)
    }
  } else if (elementsInMain.size === 1) {
    // ——— простое вещество ———
    const el = toks[0]!.el
    const n = toks.reduce((s, t) => s + t.n, 0)
    if (METALS.has(el)) kind = 'metal'
    else kind = n === 1 ? 'atomic' : 'molecule'
    const g = ub.addGroup(n === 1 ? 'atom' : 'molecule', toks, 0, uni(main))
    for (let k = 0; k < n; k++) ub.addAtom(g, el)
    if (n === 2) ub.bond(g.atoms[0]!, g.atoms[1]!)
    else if (n === 3) {
      ub.bond(g.atoms[0]!, g.atoms[1]!)
      ub.bond(g.atoms[1]!, g.atoms[2]!)
    } else if (n > 3) for (let k = 0; k < n; k++) ub.bond(g.atoms[k]!, g.atoms[(k + 1) % n]!)
  } else {
    const hasMetal = toks.some((t) => METALS.has(t.el))
    const nh4Prefix = main.startsWith('NH4') || items.some((it) => it.kind === 'grp' && tokensKey(flatTokens(it.items)) === 'H4N1')
    const molecularMetal = MOLECULAR_METAL_COMPOUNDS.has(main)
    if ((hasMetal || nh4Prefix) && !molecularMetal) {
      kind = 'ionic'
      buildIonic(ub, items, main)
    } else {
      kind = 'molecule'
      const g = ub.addGroup('molecule', toks, 0, uni(main))
      for (const t of toks) for (let k = 0; k < t.n; k++) ub.addAtom(g, t.el)
      const key = tokensKey(toks)
      // кислота: H + кислотный остаток (HCl, H₂S, H₂SO₄, HNO₃, H₃PO₄ …), не вода и не органика
      const isOrganic = elementsInMain.has('C') && elementsInMain.has('H') && !['C1H1N1', 'C1H2O3'].includes(key)
      acid = main.startsWith('H') && elementsInMain.size >= 2 && !isOrganic && key !== 'H2O1' && key !== 'H2O2'
      bondMoleculeGeneric(ub, g.atoms, key)
      if (acid) splitAcidGroups(ub, g)
    }
  }
  // кристаллогидрат: ·5H₂O — молекулы воды в той же формульной единице
  for (const extra of parts.slice(1)) {
    const m = /^(\d*)(.+)$/.exec(extra)
    if (!m) return null
    const k = m[1] ? Number(m[1]) : 1
    const it = parseItems(m[2]!)
    if (!it) return null
    const t2 = flatTokens(it)
    for (let c = 0; c < k; c++) {
      const g = ub.addGroup('molecule', t2, 0, uni(m[2]!))
      for (const t of t2) for (let q = 0; q < t.n; q++) ub.addAtom(g, t.el)
      bondMoleculeGeneric(ub, g.atoms, tokensKey(t2))
    }
  }
  return { kind, formula, builder: ub, charge: sp.charge, acid }
}

/** Кислота: каждый H связи H–остаток — отдельная группа «H кислоты», остальное — остаток (SO₄, Cl). */
function splitAcidGroups(ub: UnitBuilder, g: GroupDraft): void {
  const gi = ub.groups.indexOf(g)
  const Hs = g.atoms.filter((i) => ub.atoms[i]!.el === 'H')
  const rest = g.atoms.filter((i) => ub.atoms[i]!.el !== 'H')
  if (Hs.length === 0 || rest.length === 0) return
  const restToks: Tok[] = []
  for (const i of rest) {
    const t = restToks.find((x) => x.el === ub.atoms[i]!.el)
    if (t) t.n++
    else restToks.push({ el: ub.atoms[i]!.el, n: 1 })
  }
  g.kind = 'residue'
  g.atoms = rest
  g.toks = restToks
  g.label = uni(restToks.map((t) => `${t.el}${t.n > 1 ? t.n : ''}`).join(''))
  for (const h of Hs) {
    const hg = ub.addGroup('acidH', [{ el: 'H', n: 1 }], 0, 'H')
    ub.atoms[h]!.group = ub.groups.indexOf(hg)
    hg.atoms.push(h)
  }
  void gi
}

type IonDraft = { kind: 'cation' | 'anion'; toks: Tok[]; charge: number | null; label: string }

/** Префикс формулы из катионов: металлы и NH₄; null — в префиксе есть что-то иное. */
function cationPrefix(toks: readonly Tok[]): IonDraft[] | null {
  const out: IonDraft[] = []
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]!
    if (t.el === 'N' && t.n === 1 && toks[i + 1]?.el === 'H' && toks[i + 1]!.n === 4) {
      out.push({ kind: 'cation', toks: [{ el: 'N', n: 1 }, { el: 'H', n: 4 }], charge: 1, label: 'NH4' })
      i++
      continue
    }
    if (!METALS.has(t.el)) return null
    for (let k = 0; k < t.n; k++) out.push({ kind: 'cation', toks: [{ el: t.el, n: 1 }], charge: null, label: t.el })
  }
  return out
}

/** Ионное вещество: катионы (металлы, NH₄⁺) + анионы (простые или многоатомные). */
function buildIonic(ub: UnitBuilder, items: readonly Item[], main: string): void {
  const groupsTop = items.filter((it): it is Extract<Item, { kind: 'grp' }> => it.kind === 'grp')
  const plain = items.filter((it): it is Extract<Item, { kind: 'el' }> => it.kind === 'el').map((it) => ({ el: it.el, n: it.n }))
  const ions: IonDraft[] = []
  const pushPoly = (toks: Tok[], label: string, times: number) => {
    const p = POLY_BY_KEY.get(tokensKey(toks))
    for (let k = 0; k < times; k++) ions.push({ kind: p?.cation ? 'cation' : 'anion', toks, charge: p ? p.charge : null, label })
  }
  for (const g of groupsTop) {
    const toks = flatTokens(g.items)
    const label = itemsText(g.items)
    // [Cu(NH3)4]: комплексный катион — одна группа
    if (g.bracket) {
      for (let k = 0; k < g.n; k++) ions.push({ kind: 'cation', toks, charge: null, label })
      continue
    }
    if (toks.length === 1 && g.n >= 1 && !POLY_BY_KEY.has(tokensKey(toks))) {
      for (let k = 0; k < g.n; k++) ions.push({ kind: METALS.has(toks[0]!.el) ? 'cation' : 'anion', toks: [{ el: toks[0]!.el, n: 1 }], charge: null, label: toks[0]!.el })
      continue
    }
    pushPoly(toks, label, g.n)
  }
  // плоская часть: NH4 в начале, катионы-металлы, хвост — анион
  let rest = plain.slice()
  if (groupsTop.length === 0 && main.startsWith('NH4')) {
    rest = rest.slice(2)
    ions.unshift({ kind: 'cation', toks: [{ el: 'N', n: 1 }, { el: 'H', n: 4 }], charge: 1, label: 'NH4' })
  }
  if (PEROXIDE_METAL.test(main)) {
    const m = rest[0]!
    for (let k = 0; k < m.n; k++) ions.push({ kind: 'cation', toks: [{ el: m.el, n: 1 }], charge: null, label: m.el })
    ions.push({ kind: 'anion', toks: [{ el: 'O', n: 2 }], charge: -2, label: 'O2' })
    rest = []
  } else if (/^(Li|Na|K|Rb|Cs)O[23]$/.test(main)) {
    // надпероксид KO₂ (O₂⁻) и озонид KO₃ (O₃⁻)
    const m = rest[0]!
    const nO = rest[1]!.n
    ions.push({ kind: 'cation', toks: [{ el: m.el, n: 1 }], charge: 1, label: m.el })
    ions.push({ kind: 'anion', toks: [{ el: 'O', n: nO }], charge: -1, label: `O${nO}` })
    rest = []
  } else if (main === 'CaC2') {
    ions.push({ kind: 'cation', toks: [{ el: 'Ca', n: 1 }], charge: 2, label: 'Ca' })
    ions.push({ kind: 'anion', toks: [{ el: 'C', n: 2 }], charge: -2, label: 'C2' })
    rest = []
  } else if (main === 'FeS2') {
    ions.push({ kind: 'cation', toks: [{ el: 'Fe', n: 1 }], charge: 2, label: 'Fe' })
    ions.push({ kind: 'anion', toks: [{ el: 'S', n: 2 }], charge: -2, label: 'S2' })
    rest = []
  }
  if (rest.length > 0) {
    const suffix = matchPolySuffix(rest)
    // в хвосте многоатомный анион: префикс — катионы-металлы и NH₄⁺ (NaNH₄HPO₄)
    const prefix = suffix ? cationPrefix(rest.slice(0, suffix.start)) : null
    if (suffix && prefix) {
      ions.push(...prefix)
      const tail = rest.slice(suffix.start)
      ions.push({ kind: 'anion', toks: tail, charge: suffix.poly.charge, label: tail.map((t) => `${t.el}${t.n > 1 ? t.n : ''}`).join('') })
    } else {
      // металлы — катионы, остальное — простые анионы (Cl⁻, O²⁻, S²⁻, N³⁻, H⁻ гидридов)
      for (const t of rest) {
        const cat = METALS.has(t.el)
        for (let k = 0; k < t.n; k++) ions.push({ kind: cat ? 'cation' : 'anion', toks: [{ el: t.el, n: 1 }], charge: null, label: t.el })
      }
    }
  }
  // заряды: известные — из таблицы; простые анионы — по группе (галоген −1, халькоген −2, азот/фосфор −3, H −1, C −4)
  for (const ion of ions) {
    if (ion.charge != null) continue
    if (ion.kind === 'anion' && ion.toks.length === 1 && ion.toks[0]!.n === 1) {
      const e = ion.toks[0]!.el
      ion.charge = HALOGENS.has(e) || e === 'H' ? -1 : CHALCOGENS.has(e) ? -2 : PNICTOGENS.has(e) ? -3 : e === 'C' || e === 'Si' ? -4 : null
    }
    if (ion.kind === 'cation' && ion.toks.length === 1) {
      const e = ion.toks[0]!.el
      ion.charge = ALKALI.has(e) ? 1 : ALKALINE_EARTH.has(e) ? 2 : (FIXED_METAL_OX[e] ?? null)
    }
  }
  // неизвестные: катион по анионам или анион по катионам (MnO₄⁻ / MnO₄²⁻, Fe²⁺ / Fe³⁺)
  const unknownCat = ions.filter((x) => x.kind === 'cation' && x.charge == null)
  const unknownAn = ions.filter((x) => x.kind === 'anion' && x.charge == null)
  const sumKnown = ions.reduce((s, x) => s + (x.charge ?? 0), 0)
  const special = SPECIAL_OX[main]
  if (special && unknownCat.length > 0) {
    // Fe₃O₄: Fe²⁺ + 2Fe³⁺
    const el = unknownCat[0]!.toks[0]!.el
    const list = special[el] ?? []
    unknownCat.forEach((x, k) => (x.charge = list[k] ?? null))
  } else if (unknownCat.length > 0 && unknownAn.length === 0) {
    const q = -sumKnown / unknownCat.length
    for (const x of unknownCat) x.charge = q
  } else if (unknownAn.length > 0 && unknownCat.length === 0) {
    const q = -sumKnown / unknownAn.length
    for (const x of unknownAn) x.charge = q
  }
  for (const ion of ions) {
    const q = ion.charge ?? 0
    // [Al(OH)₄]⁻ записан в скобках как «комплекс» — вид иона по знаку заряда
    const kind: 'cation' | 'anion' = q > 0 ? 'cation' : q < 0 ? 'anion' : ion.kind
    if (ion.toks.length === 1 && ion.toks[0]!.n === 1) {
      const g = ub.addGroup(kind, ion.toks, q, `${ion.toks[0]!.el}${ionChargeText(q)}`)
      ub.addAtom(g, ion.toks[0]!.el)
    } else {
      addIonGroup(ub, kind, ion.toks, q, ion.label)
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Степени окисления
// ─────────────────────────────────────────────────────────────────────────────

/** Степени окисления атомов группы с суммой target. Правила по порядку; null — не удалось. */
function solveOx(els: readonly string[], target: number, ctx: { metalsOnly: boolean; special?: Readonly<Record<string, readonly number[]>> }): number[] | null {
  const n = els.length
  const ox: (number | null)[] = new Array(n).fill(null)
  if (ctx.special) {
    const used: Record<string, number> = {}
    let all = true
    for (let i = 0; i < n; i++) {
      const list = ctx.special[els[i]!]
      const k = used[els[i]!] ?? 0
      if (list && list[k] != null) {
        ox[i] = list[k]!
        used[els[i]!] = k + 1
      } else all = false
    }
    if (all) return ox as number[]
  }
  const uniq = new Set(els)
  if (uniq.size === 1) {
    const v = target / n
    return new Array(n).fill(v)
  }
  for (let i = 0; i < n; i++) {
    if (ox[i] != null) continue
    const e = els[i]!
    if (e === 'F') ox[i] = -1
    else if (ALKALI.has(e)) ox[i] = 1
    else if (ALKALINE_EARTH.has(e)) ox[i] = 2
    else if (FIXED_METAL_OX[e] != null) ox[i] = FIXED_METAL_OX[e]!
    else if (e === 'O') ox[i] = -2
    else if (e === 'H') ox[i] = ctx.metalsOnly ? -1 : 1
  }
  // оставшиеся элементы: по одному решаем из суммы; если неизвестных несколько — самый электроотрицательный
  // получает свою низшую степень (галоген −1, халькоген −2, азот/фосфор −3, C/Si −4)
  for (let guard = 0; guard < 6; guard++) {
    const unknown = [...new Set(els.filter((_, i) => ox[i] == null))]
    if (unknown.length === 0) break
    const known = ox.reduce<number>((s, v) => s + (v ?? 0), 0)
    if (unknown.length === 1) {
      const e = unknown[0]!
      const cnt = els.filter((x) => x === e).length
      const v = (target - known) / cnt
      for (let i = 0; i < n; i++) if (els[i] === e && ox[i] == null) ox[i] = v
      break
    }
    const most = unknown.reduce((a, b) => (en(a) >= en(b) ? a : b))
    const low = HALOGENS.has(most) ? -1 : CHALCOGENS.has(most) ? -2 : PNICTOGENS.has(most) ? -3 : most === 'C' || most === 'Si' ? -4 : most === 'H' ? -1 : null
    if (low == null) return null
    for (let i = 0; i < n; i++) if (els[i] === most && ox[i] == null) ox[i] = low
  }
  if (ox.some((v) => v == null)) return null
  return ox as number[]
}

function round6(v: number): number {
  return Math.round(v * 1e6) / 1e6
}

/** Степени окисления атомов формульной единицы. */
function assignOx(spec: UnitSpec): boolean {
  const ub = spec.builder
  const els = ub.atoms.map((a) => a.el)
  const mainFormula = spec.formula
  void mainFormula
  if (spec.kind === 'metal' || spec.kind === 'atomic' || (spec.kind === 'molecule' && new Set(els).size === 1)) {
    for (const a of ub.atoms) a.ox = 0
    return true
  }
  // по группам с зарядом: ионы ионного вещества, ион ионного уравнения
  if (spec.kind === 'ionic' || spec.kind === 'ion') {
    for (const g of ub.groups) {
      const gEls = g.atoms.map((i) => ub.atoms[i]!.el)
      if (g.kind === 'molecule') {
        const r = solveOx(gEls, 0, { metalsOnly: false })
        if (!r) return false
        g.atoms.forEach((i, k) => (ub.atoms[i]!.ox = r[k]!))
        continue
      }
      if (g.atoms.length === 1) {
        ub.atoms[g.atoms[0]!]!.ox = g.charge
        continue
      }
      // пероксид-ион O₂²⁻: O⁻¹; надпероксид O₂⁻ и озонид O₃⁻ — поровну (−½, −⅓)
      const special = g.charge === -2 && g.toks.length === 1 && g.toks[0]!.el === 'O' && g.toks[0]!.n === 2 ? { O: [-1, -1] } : undefined
      const r = solveOx(gEls, g.charge, { metalsOnly: false, special })
      if (!r) return false
      g.atoms.forEach((i, k) => (ub.atoms[i]!.ox = r[k]!))
    }
    return true
  }
  // молекула: правила + особые случаи (H₂O₂, OF₂, N₂O)
  const key = spec.formula.replace(/[₀-₉]/g, (d) => String('₀₁₂₃₄₅₆₇₈₉'.indexOf(d)))
  const special = SPECIAL_OX[key]
  const metalsOnly = els.every((e) => e === 'H' || METALS.has(e))
  // кристаллогидраты молекулярных веществ: каждая группа отдельно
  for (const g of groupsOfMolecule(ub)) {
    const gEls = g.map((i) => ub.atoms[i]!.el)
    const r = solveOx(gEls, 0, { metalsOnly, special: g.length === ub.atoms.length ? special : undefined })
    if (!r) return false
    g.forEach((i, k) => (ub.atoms[i]!.ox = r[k]!))
  }
  return true
}

/** Связные компоненты молекулярной единицы (кристаллогидрат: вещество + молекулы воды). */
function groupsOfMolecule(ub: UnitBuilder): number[][] {
  const n = ub.atoms.length
  const parent = Array.from({ length: n }, (_, i) => i)
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)))
  for (const [a, b] of ub.bonds) parent[find(a)] = find(b)
  const map = new Map<number, number[]>()
  for (let i = 0; i < n; i++) {
    const r = find(i)
    const g = map.get(r)
    if (g) g.push(i)
    else map.set(r, [i])
  }
  return [...map.values()]
}

// ─────────────────────────────────────────────────────────────────────────────
// Сторона уравнения
// ─────────────────────────────────────────────────────────────────────────────

function buildSide(species: readonly EquationSpecies[], termOffset: number): { side: MutSide; specs: UnitSpec[] } | null {
  const side: MutSide = { units: [], groups: [], atoms: [], bonds: [] }
  const specs: UnitSpec[] = []
  species.forEach((sp, ti) => {
    const coeff = sp.coeff
    for (let copy = 0; copy < coeff; copy++) {
      const spec = buildUnitSpec(sp)
      if (!spec || !assignOx(spec)) {
        side.units.length = 0
        throw new Error(`unit:${sp.formula}`)
      }
      specs.push(spec)
      const unitId = side.units.length
      const atomBase = side.atoms.length
      const groupBase = side.groups.length
      const ub = spec.builder
      ub.groups.forEach((g, gi) => {
        side.groups.push({
          id: groupBase + gi,
          unit: unitId,
          kind: g.kind,
          atoms: g.atoms.map((a) => atomBase + a),
          charge: g.charge,
          label: g.label,
          key: tokensKey(g.atoms.map((a) => ({ el: ub.atoms[a]!.el, n: 1 }))),
        })
      })
      ub.atoms.forEach((a, ai) => {
        side.atoms.push({ id: atomBase + ai, el: a.el, unit: unitId, group: groupBase + a.group, ox: a.ox })
      })
      // Кратность — только у нейтральных молекул; schoolBondOrders сам отказывается (одинарные), если есть металл
      // или валентности и степени окисления не сходятся — ложных двойных связей не будет.
      const orders = spec.charge === 0 ? storyBondOrders(ub.atoms.map((x) => x.el), ub.bonds) : ub.bonds.map(() => 1)
      ub.bonds.forEach(([a, b], k) => side.bonds.push({ a: atomBase + a, b: atomBase + b, order: orders[k] ?? 1 }))
      side.units.push({
        id: unitId,
        term: termOffset + ti,
        copy,
        kind: spec.kind,
        formula: spec.formula,
        atoms: ub.atoms.map((_, ai) => atomBase + ai),
        groups: ub.groups.map((_, gi) => groupBase + gi),
        charge: spec.charge,
        acid: spec.acid,
      })
    }
  })
  return { side, specs }
}

// ─────────────────────────────────────────────────────────────────────────────
// Сопоставление атомов
// ─────────────────────────────────────────────────────────────────────────────

function neighbors(side: StorySide): number[][] {
  const nb: number[][] = side.atoms.map(() => [])
  for (const b of side.bonds) {
    nb[b.a]!.push(b.b)
    nb[b.b]!.push(b.a)
  }
  return nb
}

function groupOxSig(side: StorySide, g: StoryGroup): string {
  return g.atoms
    .map((i) => `${side.atoms[i]!.el}${side.atoms[i]!.ox}`)
    .sort()
    .join(',')
}

function mapAtoms(L: StorySide, R: StorySide): { map: number[]; conserved: [number, number][] } {
  const map = new Array<number>(L.atoms.length).fill(-1)
  const used = new Array<boolean>(R.atoms.length).fill(false)
  const conserved: [number, number][] = []
  const nbL = neighbors(L)
  const nbR = neighbors(R)

  // 1) многоатомные группы, которые есть с обеих сторон (тот же состав и те же степени окисления), — целиком
  const polyL = L.groups.filter((g) => g.atoms.length >= 2).sort((a, b) => b.atoms.length - a.atoms.length)
  const groupUsedR = new Set<number>()
  for (const gl of polyL) {
    const sig = groupOxSig(L, gl)
    const gr = R.groups.find((g) => !groupUsedR.has(g.id) && g.key === gl.key && g.atoms.length === gl.atoms.length && groupOxSig(R, g) === sig && g.atoms.every((a) => !used[a]))
    if (!gr) continue
    groupUsedR.add(gr.id)
    conserved.push([gl.id, gr.id])
    // внутри группы — по элементам, центр к центру, затем соседи
    const freeR = gr.atoms.slice()
    const order = gl.atoms.slice().sort((a, b) => (L.atoms[a]!.el === 'O' || L.atoms[a]!.el === 'H' ? 1 : 0) - (L.atoms[b]!.el === 'O' || L.atoms[b]!.el === 'H' ? 1 : 0))
    for (const a of order) {
      const el = L.atoms[a]!.el
      const preferred = freeR.find((r) => R.atoms[r]!.el === el && nbL[a]!.some((n) => map[n] >= 0 && nbR[r]!.includes(map[n]!)))
      const pick = preferred ?? freeR.find((r) => R.atoms[r]!.el === el)
      if (pick == null) continue
      map[a] = pick
      used[pick] = true
      freeR.splice(freeR.indexOf(pick), 1)
    }
  }

  // 2) остальные: распространение по связям (сохранить связь), затем «затравка» — тот же элемент,
  //    ближайшая степень окисления, та же формульная единица справа, что у соседей по единице слева
  const unitTargets = new Map<number, Map<number, number>>()
  const noteTarget = (la: number, ra: number) => {
    const lu = L.atoms[la]!.unit
    const ru = R.atoms[ra]!.unit
    let m = unitTargets.get(lu)
    if (!m) unitTargets.set(lu, (m = new Map()))
    m.set(ru, (m.get(ru) ?? 0) + 1)
  }
  map.forEach((r, l) => r >= 0 && noteTarget(l, r))
  const assign = (l: number, r: number) => {
    map[l] = r
    used[r] = true
    noteTarget(l, r)
  }
  const propagate = () => {
    let changed = true
    while (changed) {
      changed = false
      for (let l = 0; l < L.atoms.length; l++) {
        if (map[l]! >= 0) continue
        const el = L.atoms[l]!.el
        for (const n of nbL[l]!) {
          const rn = map[n]!
          if (rn < 0) continue
          const cands = nbR[rn]!.filter((r) => !used[r] && R.atoms[r]!.el === el)
          if (cands.length === 0) continue
          cands.sort((x, y) => Math.abs(R.atoms[x]!.ox - L.atoms[l]!.ox) - Math.abs(R.atoms[y]!.ox - L.atoms[l]!.ox))
          assign(l, cands[0]!)
          changed = true
          break
        }
      }
    }
  }
  propagate()
  // тяжёлые атомы раньше водорода и кислорода — они задают «скелет»
  const rank = (el: string) => (el === 'H' ? 2 : el === 'O' ? 1 : 0)
  const orderL = L.atoms.map((a) => a.id).sort((a, b) => rank(L.atoms[a]!.el) - rank(L.atoms[b]!.el) || a - b)
  for (const l of orderL) {
    if (map[l]! >= 0) continue
    const la = L.atoms[l]!
    let best = -1
    let bestScore = Infinity
    const targets = unitTargets.get(la.unit)
    for (let r = 0; r < R.atoms.length; r++) {
      if (used[r] || R.atoms[r]!.el !== la.el) continue
      const ra = R.atoms[r]!
      const dOx = Math.abs(ra.ox - la.ox)
      const sameUnit = targets?.get(ra.unit) ? 0 : 1
      // свободный центр продукта, к которому уже пришли соседи, — лучше
      const keeps = nbL[l]!.some((n) => map[n]! >= 0 && nbR[r]!.includes(map[n]!)) ? 0 : 1
      const score = dOx * 100 + keeps * 10 + sameUnit
      if (score < bestScore) {
        bestScore = score
        best = r
      }
    }
    if (best < 0) continue
    assign(l, best)
    propagate()
  }
  return { map, conserved }
}

// ─────────────────────────────────────────────────────────────────────────────
// Электроны
// ─────────────────────────────────────────────────────────────────────────────

function oxChanges(L: StorySide, R: StorySide, map: readonly number[], termFormula: (u: number) => string): { up: StoryOxChange[]; down: StoryOxChange[] } {
  const rows = new Map<string, { el: string; from: number; to: number; atoms: number[]; term: string }>()
  for (const a of L.atoms) {
    const to = R.atoms[map[a.id]!]!.ox
    if (Math.abs(to - a.ox) < 1e-9) continue
    const term = termFormula(a.unit)
    const k = `${a.el}|${a.ox}|${to}|${term}`
    const row = rows.get(k)
    if (row) row.atoms.push(a.id)
    else rows.set(k, { el: a.el, from: a.ox, to, atoms: [a.id], term })
  }
  const up: StoryOxChange[] = []
  const down: StoryOxChange[] = []
  for (const r of rows.values()) {
    const e = round6((r.to - r.from) * r.atoms.length)
    const ch: StoryOxChange = { el: r.el, from: r.from, to: r.to, count: r.atoms.length, electrons: e, term: r.term, atoms: r.atoms }
    if (e > 0) up.push(ch)
    else down.push(ch)
  }
  return { up, down }
}

function buildTransfers(L: StorySide, R: StorySide, map: readonly number[]): StoryTransfer[] {
  const give: { id: number; n: number }[] = []
  const take: { id: number; n: number }[] = []
  for (const a of L.atoms) {
    const d = R.atoms[map[a.id]!]!.ox - a.ox
    if (d > 1e-9) give.push({ id: a.id, n: d })
    else if (d < -1e-9) take.push({ id: a.id, n: -d })
  }
  const out: StoryTransfer[] = []
  let ti = 0
  for (const g of give) {
    let left = g.n
    while (left > 1e-9 && ti < take.length) {
      const t = take[ti]!
      const k = Math.min(left, t.n)
      out.push({ from: g.id, to: t.id, n: k })
      left -= k
      t.n -= k
      if (t.n <= 1e-9) ti++
    }
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// Тексты
// ─────────────────────────────────────────────────────────────────────────────

const STEP_TITLE: Readonly<Record<StoryStepId, StoryText>> = {
  reactants: { ru: 'Исходные вещества', en: 'Starting substances', uz: 'Boshlangʻich moddalar' },
  breaking: { ru: 'Разрыв связей', en: 'Bonds break', uz: 'Bogʻlar uziladi' },
  electrons: { ru: 'Переход электронов', en: 'Electron transfer', uz: 'Elektronlar oʻtishi' },
  formation: { ru: 'Образование продуктов', en: 'Products form', uz: 'Mahsulotlar hosil boʻladi' },
  result: { ru: 'Итог', en: 'Result', uz: 'Natija' },
}

const TYPE_TEXT: Readonly<Record<StoryReactionType, StoryText>> = {
  combination: { ru: 'соединение', en: 'combination', uz: 'birikish' },
  decomposition: { ru: 'разложение', en: 'decomposition', uz: 'parchalanish' },
  substitution: { ru: 'замещение', en: 'substitution', uz: 'oʻrin olish' },
  exchange: { ru: 'обмен', en: 'exchange', uz: 'almashinish' },
  neutralization: { ru: 'нейтрализация (обмен)', en: 'neutralization (exchange)', uz: 'neytrallanish (almashinish)' },
  other: { ru: 'превращение веществ', en: 'transformation', uz: 'moddalar oʻzgarishi' },
}

const REDOX_TEXT: StoryText = { ru: 'окислительно-восстановительная', en: 'redox', uz: 'oksidlanish-qaytarilish' }
const COMBUSTION_TEXT: StoryText = { ru: 'горение', en: 'combustion', uz: 'yonish' }

function countList(items: readonly { text: string; n: number }[]): string {
  return items.map((x) => (x.n > 1 ? `${x.text} (${x.n})` : x.text)).join(', ')
}

function aggregate(keys: readonly string[]): { text: string; n: number }[] {
  const m = new Map<string, number>()
  for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1)
  return [...m.entries()].map(([text, n]) => ({ text, n }))
}

function bondKey(side: StorySide, b: StoryBond): string {
  const x = side.atoms[b.a]!.el
  const y = side.atoms[b.b]!.el
  // школьная запись: менее электроотрицательный слева (H–Cl, S–O), но O–H, N–H, C–H — водород справа
  if (x === 'H' && (y === 'O' || y === 'N' || y === 'C')) return `${y}–H`
  if (y === 'H' && (x === 'O' || x === 'N' || x === 'C')) return `${x}–H`
  return en(x) <= en(y) ? `${x}–${y}` : `${y}–${x}`
}

function coeffFormula(t: StoryTerm): string {
  return `${t.coeff > 1 ? t.coeff : ''}${t.formula}`
}

export function halfLine(c: StoryOxChange, lossFirst: boolean): string {
  const n = c.count > 1 ? String(c.count) : ''
  const e = Math.abs(c.electrons)
  const eText = `${Number.isInteger(e) ? e : e.toFixed(2)}e⁻`
  return lossFirst
    ? `${n}${c.el}${oxText(c.from)} − ${eText} → ${n}${c.el}${oxText(c.to)}`
    : `${n}${c.el}${oxText(c.from)} + ${eText} → ${n}${c.el}${oxText(c.to)}`
}

function fmtE(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

// ─────────────────────────────────────────────────────────────────────────────
// Главная функция
// ─────────────────────────────────────────────────────────────────────────────

export type ReactionStoryInput = {
  /** уравнение с коэффициентами (Unicode или ASCII), пометки ↑ ↓ учитываются */
  readonly equation: string
}

/** Пометки ↑ / ↓ у продуктов из текста уравнения (по порядку членов правой части). */
function productMarks(text: string): ('up' | 'down' | null)[] {
  const arrow = /→|->|=>|⟶|⇌|⇄|<=>|↔|=/.exec(text)
  if (!arrow) return []
  const right = text.slice(arrow.index + arrow[0].length)
  return right.split(/\s\+\s/).map((p) => (/↑/.test(p) ? 'up' : /↓/.test(p) ? 'down' : null))
}

/**
 * Сюжет по уравнению. null — уравнение не разобрано, не уравнено, есть электроны (полуреакция)
 * или формула, которую школьные правила не раскладывают.
 */
export function buildReactionStory(input: ReactionStoryInput | string): ReactionStory | null {
  const text = typeof input === 'string' ? input : input.equation
  const eq = parseEquationText(text)
  if (!eq || eq.isScheme) return null
  const all = [...eq.reactants, ...eq.products]
  if (all.some((s) => s.electron || !s.counts || s.perUnit || s.polymer || s.radical)) return null
  if (all.some((s) => !Number.isInteger(s.coeff) || s.coeff < 1 || s.coeff > 40)) return null
  let Lb: { side: MutSide; specs: UnitSpec[] } | null
  let Rb: { side: MutSide; specs: UnitSpec[] } | null
  try {
    Lb = buildSide(eq.reactants, 0)
    Rb = buildSide(eq.products, eq.reactants.length)
  } catch {
    return null
  }
  if (!Lb || !Rb) return null
  const L = Lb.side
  const R = Rb.side
  // атомы сохраняются
  const countEl = (s: StorySide) => {
    const c: Record<string, number> = {}
    for (const a of s.atoms) c[a.el] = (c[a.el] ?? 0) + 1
    return c
  }
  const cl = countEl(L)
  const cr = countEl(R)
  const els = [...new Set([...Object.keys(cl), ...Object.keys(cr)])]
  if (els.some((e) => cl[e] !== cr[e])) return null

  const { map, conserved } = mapAtoms(L, R)
  if (map.some((r) => r < 0)) return null

  // связи
  const rBondSet = new Set(R.bonds.map((b) => (b.a < b.b ? `${b.a}-${b.b}` : `${b.b}-${b.a}`)))
  const bondsKept: number[] = []
  const bondsBroken: number[] = []
  const keptR = new Set<string>()
  L.bonds.forEach((b, i) => {
    const x = map[b.a]!
    const y = map[b.b]!
    const k = x < y ? `${x}-${y}` : `${y}-${x}`
    if (rBondSet.has(k)) {
      bondsKept.push(i)
      keptR.add(k)
    } else bondsBroken.push(i)
  })
  const bondsFormed: number[] = []
  R.bonds.forEach((b, i) => {
    const k = b.a < b.b ? `${b.a}-${b.b}` : `${b.b}-${b.a}`
    if (!keptR.has(k)) bondsFormed.push(i)
  })

  // члены уравнения
  const marks = productMarks(text)
  const terms: StoryTerm[] = []
  const termOfUnitL = (u: number) => L.units[u]!.term
  const ionsOf = (side: StorySide, termIdx: number): string | null => {
    const u = side.units.find((x) => x.term === termIdx)
    if (!u || u.kind !== 'ionic') return null
    // катионы первыми: «Cu²⁺ + 2OH⁻», как в записи формулы
    const labels = u.groups
      .map((g) => side.groups[g]!)
      .sort((a, b) => Number(b.charge > 0) - Number(a.charge > 0))
      .map((g) => g.label)
    return aggregate(labels)
      .map((x) => `${x.n > 1 ? x.n : ''}${x.text}`)
      .join(' + ')
  }
  eq.reactants.forEach((sp, i) => {
    const u = L.units.find((x) => x.term === i)!
    terms.push({ side: 'left', index: i, formula: u.formula, coeff: sp.coeff, charge: sp.charge, kind: u.kind, fate: null, ions: ionsOf(L, i) })
  })

  // перенос электронов
  const termFormula = (u: number) => terms[termOfUnitL(u)]!.formula
  const { up, down } = oxChanges(L, R, map, termFormula)
  const given = round6(up.reduce((s, c) => s + c.electrons, 0))
  const accepted = round6(-down.reduce((s, c) => s + c.electrons, 0))
  const redox = given > 1e-9
  const transfers = redox ? buildTransfers(L, R, map) : []

  // тип реакции
  const nL = eq.reactants.length
  const nR = eq.products.length
  const isSimple = (u: StoryUnit | undefined): boolean => {
    if (!u) return false
    if (u.kind === 'metal' || u.kind === 'atomic') return true
    const side = u.term < nL ? L : R
    return u.kind === 'molecule' && new Set(u.atoms.map((a) => side.atoms[a]!.el)).size === 1
  }
  const leftUnits = eq.reactants.map((_, i) => L.units.find((u) => u.term === i))
  const rightUnits = eq.products.map((_, i) => R.units.find((u) => u.term === nL + i))
  let type: StoryReactionType = 'other'
  if (nL >= 2 && nR === 1) type = 'combination'
  else if (nL === 1 && nR >= 2) type = 'decomposition'
  else if (nL === 2 && nR === 2) {
    const ls = leftUnits.filter(isSimple).length
    const rs = rightUnits.filter(isSimple).length
    if (ls === 1 && rs === 1) type = 'substitution'
    else if (ls === 0 && rs === 0 && !redox) {
      const hasAcid = leftUnits.some((u) => u?.acid)
      const hasBase = leftUnits.some((u) => u != null && u.kind === 'ionic' && u.groups.some((g) => L.groups[g]!.label === 'OH⁻'))
      const water = rightUnits.some((u) => u?.formula === 'H₂O')
      type = hasAcid && hasBase && water ? 'neutralization' : 'exchange'
    }
  }
  const o2Left = leftUnits.some((u) => u?.formula === 'O₂')
  const combustion = o2Left && redox && type !== 'decomposition' && rightUnits.every((u) => u != null && R.atoms.filter((a) => a.unit === u.id).some((a) => a.el === 'O'))

  // судьба продуктов: газ ↑, осадок ↓, металл оседает, вода
  const leftAllGas = leftUnits.every((u) => u != null && GASES.has(asciiOf(u.formula)))
  eq.products.forEach((sp, i) => {
    const u = rightUnits[i]!
    const f = sp.formula
    const mark = marks[i] ?? null
    let fate: StoryFate = null
    if (mark === 'up') fate = 'gas'
    else if (mark === 'down') fate = 'precipitate'
    else if (f === 'H2O') fate = 'water'
    else if (GASES.has(f) && !leftAllGas && type !== 'combination' && !SOLUBLE_GASES.has(f)) fate = 'gas'
    else if (INSOLUBLE.has(f) && (type === 'exchange' || type === 'neutralization' || type === 'substitution' || type === 'other') && leftUnits.some((x) => x?.kind === 'ionic' || x?.acid)) fate = 'precipitate'
    else if (u.kind === 'metal' && type === 'substitution' && leftUnits.some((x) => x?.kind === 'ionic')) fate = 'deposit'
    terms.push({ side: 'right', index: nL + i, formula: u.formula, coeff: sp.coeff, charge: sp.charge, kind: u.kind, fate, ions: ionsOf(R, nL + i) })
  })

  const atomBalance = els.map((e) => ({ el: e, left: cl[e]!, right: cr[e]! }))
  const steps: StoryStepId[] = redox ? ['reactants', 'breaking', 'electrons', 'formation', 'result'] : ['reactants', 'breaking', 'formation', 'result']

  const markOf = (t: StoryTerm) => (t.fate === 'gas' ? '↑' : t.fate === 'precipitate' ? '↓' : '')
  const leftText = terms.filter((t) => t.side === 'left').map(coeffFormula).join(' + ')
  const rightText = terms
    .filter((t) => t.side === 'right')
    .map((t) => `${coeffFormula(t)}${markOf(t)}`)
    .join(' + ')
  const equation = `${leftText} ${eq.arrow === '⇌' ? '⇄' : '→'} ${rightText}`

  const story: Omit<ReactionStory, 'text'> = {
    equation,
    terms,
    left: L,
    right: R,
    map,
    bondsBroken,
    bondsKept,
    bondsFormed,
    conserved,
    redox,
    electrons: redox ? given : 0,
    given,
    accepted,
    oxidations: up,
    reductions: down,
    transfers,
    type,
    combustion,
    atomBalance,
    steps,
  }
  return { ...story, text: buildTexts(story) }
}

function asciiOf(unicodeFormula: string): string {
  return unicodeFormula.replace(/[₀-₉]/g, (d) => String('₀₁₂₃₄₅₆₇₈₉'.indexOf(d))).replace(/[⁰-⁹⁺⁻¹²³]/g, '')
}

type Draft = Omit<ReactionStory, 'text'>

function buildTexts(s: Draft): Record<StoryLocale, Record<StoryStepId, StoryStepText>> {
  const L = s.left
  const R = s.right
  const lefts = s.terms.filter((t) => t.side === 'left')
  const rights = s.terms.filter((t) => t.side === 'right')
  const leftEq = lefts.map(coeffFormula).join(' + ')
  const rightEq = rights.map(coeffFormula).join(' + ')

  // ——— разрыв ———
  const broken = aggregate(s.bondsBroken.map((i) => bondKey(L, L.bonds[i]!)))
  const ionicLeft = lefts.filter((t) => t.ions)
  const conservedLabels = aggregate(
    s.conserved.map(([, gr]) => {
      const g = R.groups[gr]!
      // подпись иона берём с ионной стороны (SO₄²⁻), у остатка кислоты заряда нет
      const gl = L.groups[s.conserved.find((c) => c[1] === gr)![0]]!
      const lab = g.charge !== 0 ? g.label : gl.charge !== 0 ? gl.label : g.label
      return lab
    }),
  )
  // ——— образование ———
  const formed = aggregate(s.bondsFormed.map((i) => bondKey(R, R.bonds[i]!)))
  const ionicRight = rights.filter((t) => t.ions)
  const gases = rights.filter((t) => t.fate === 'gas').map((t) => t.formula)
  const precip = rights.filter((t) => t.fate === 'precipitate').map((t) => t.formula)
  const deposits = rights.filter((t) => t.fate === 'deposit').map((t) => t.formula)
  const water = rights.some((t) => t.fate === 'water')

  const balance = s.atomBalance.map((b) => `${b.el} ${b.left} = ${b.right}`).join(', ')
  const halfs = [...s.oxidations.map((c) => halfLine(c, true)), ...s.reductions.map((c) => halfLine(c, false))].join('; ')
  const reducers = aggregate(s.oxidations.map((c) => `${c.term} (${c.el}${oxText(c.from)} → ${c.el}${oxText(c.to)})`)).map((x) => x.text)
  const oxidizers = aggregate(s.reductions.map((c) => `${c.term} (${c.el}${oxText(c.from)} → ${c.el}${oxText(c.to)})`)).map((x) => x.text)
  const eN = fmtE(s.given)
  const typeOf = (loc: StoryLocale) => {
    const parts: string[] = []
    if (s.type !== 'other' || !s.redox) parts.push(TYPE_TEXT[s.type][loc])
    if (s.combustion) parts.push(COMBUSTION_TEXT[loc])
    if (s.redox) parts.push(REDOX_TEXT[loc])
    return parts.join(', ')
  }
  const particleList = lefts.map((t) => `${t.formula} — ${t.coeff}`).join(', ')
  const out = {} as Record<StoryLocale, Record<StoryStepId, StoryStepText>>
  for (const loc of ['ru', 'en', 'uz'] as const) {
    const W = WORDS[loc]
    const ionsPart = ionicLeft.length ? ' ' + ionicLeft.map((t) => W.madeOfIons(t.formula, t.ions!)).join(' ') : ''
    const reactants: StoryStepText = {
      title: STEP_TITLE.reactants[loc],
      body: `${W.particles}: ${particleList}.${ionsPart}`,
      equation: `${leftEq} → …`,
    }
    const bParts: string[] = []
    if (broken.length) bParts.push(`${W.bondsBreak}: ${countList(broken)}.`)
    if (ionicLeft.length) bParts.push(`${W.ionsSeparate}: ${ionicLeft.map((t) => `${t.formula} → ${t.ions}`).join('; ')}.`)
    if (lefts.some((t) => t.kind === 'metal')) bParts.push(`${W.metalAtoms(lefts.filter((t) => t.kind === 'metal').map((t) => t.formula).join(', '))}`)
    if (conservedLabels.length) bParts.push(`${W.staysWhole}: ${countList(conservedLabels)}.`)
    if (bParts.length === 0) bParts.push(W.nothingBreaks)
    const breaking: StoryStepText = { title: STEP_TITLE.breaking[loc], body: bParts.join(' '), equation: `${leftEq} → …` }
    const electrons: StoryStepText = {
      title: STEP_TITLE.electrons[loc],
      body: s.redox
        ? `${W.reducer} — ${reducers.join(', ')}: ${W.gives} ${eN}e⁻. ${W.oxidizer} — ${oxidizers.join(', ')}: ${W.takes} ${eN}e⁻. ${W.givenEqTaken(eN, fmtE(s.accepted))}`
        : W.noRedox,
      equation: halfs || leftEq,
    }
    const fParts: string[] = []
    if (formed.length) fParts.push(`${W.bondsForm}: ${countList(formed)}.`)
    if (ionicRight.length) fParts.push(`${W.ionsPack}: ${ionicRight.map((t) => `${t.formula} (${t.ions})`).join('; ')}.`)
    for (const g of gases) fParts.push(W.gas(g))
    for (const p of precip) fParts.push(W.precipitate(p))
    for (const d of deposits) fParts.push(W.deposit(d))
    if (s.type === 'neutralization') fParts.push('H⁺ + OH⁻ → H₂O.')
    if (water) fParts.push(W.water)
    if (fParts.length === 0) fParts.push(W.productsReady(rightEq))
    const formation: StoryStepText = { title: STEP_TITLE.formation[loc], body: fParts.join(' '), equation: `… → ${rightEq}` }
    const result: StoryStepText = {
      title: STEP_TITLE.result[loc],
      body: `${W.atomsKept}: ${balance}.${s.redox ? ` ${W.electronsLine(eN, fmtE(s.accepted))}` : ''} ${W.typeIs}: ${typeOf(loc)}.`,
      equation: s.equation,
    }
    out[loc] = { reactants, breaking, electrons, formation, result }
  }
  return out
}

type Words = {
  particles: string
  madeOfIons: (f: string, ions: string) => string
  bondsBreak: string
  ionsSeparate: string
  metalAtoms: (f: string) => string
  staysWhole: string
  nothingBreaks: string
  reducer: string
  oxidizer: string
  gives: string
  takes: string
  givenEqTaken: (a: string, b: string) => string
  noRedox: string
  bondsForm: string
  ionsPack: string
  gas: (f: string) => string
  precipitate: (f: string) => string
  deposit: (f: string) => string
  water: string
  productsReady: (eq: string) => string
  atomsKept: string
  electronsLine: (a: string, b: string) => string
  typeIs: string
}

const WORDS: Readonly<Record<StoryLocale, Words>> = {
  ru: {
    particles: 'Частицы по коэффициентам уравнения',
    madeOfIons: (f, ions) => `${f} состоит из ионов: ${ions}.`,
    bondsBreak: 'Рвутся связи',
    ionsSeparate: 'Ионы расходятся',
    metalAtoms: (f) => `Атомы металла (${f}) выходят из кристалла.`,
    staysWhole: 'Переходит целиком',
    nothingBreaks: 'Частицы сближаются и перестраиваются.',
    reducer: 'Восстановитель',
    oxidizer: 'Окислитель',
    gives: 'отдаёт',
    takes: 'принимает',
    givenEqTaken: (a, b) => `Отдано ${a}e⁻ = принято ${b}e⁻.`,
    noRedox: 'Степени окисления не меняются — электроны не переходят.',
    bondsForm: 'Образуются связи',
    ionsPack: 'Ионы собираются в кристалл',
    gas: (f) => `${f} — газ, улетает ↑.`,
    precipitate: (f) => `${f} — осадок ↓, оседает.`,
    deposit: (f) => `${f} выделяется в виде металла и оседает.`,
    water: 'H₂O — вода.',
    productsReady: (eq) => `Продукты: ${eq}.`,
    atomsKept: 'Атомы сохраняются',
    electronsLine: (a, b) => `Электроны: отдано ${a} = принято ${b}.`,
    typeIs: 'Тип реакции',
  },
  en: {
    particles: 'Particles by the equation coefficients',
    madeOfIons: (f, ions) => `${f} is made of ions: ${ions}.`,
    bondsBreak: 'Bonds break',
    ionsSeparate: 'Ions separate',
    metalAtoms: (f) => `Metal atoms (${f}) leave the crystal.`,
    staysWhole: 'Passes over whole',
    nothingBreaks: 'The particles come together and rearrange.',
    reducer: 'Reducing agent',
    oxidizer: 'Oxidizing agent',
    gives: 'gives',
    takes: 'accepts',
    givenEqTaken: (a, b) => `Given ${a}e⁻ = accepted ${b}e⁻.`,
    noRedox: 'Oxidation states do not change — no electrons are transferred.',
    bondsForm: 'New bonds form',
    ionsPack: 'Ions pack into a crystal',
    gas: (f) => `${f} is a gas and escapes ↑.`,
    precipitate: (f) => `${f} is a precipitate ↓ and settles.`,
    deposit: (f) => `${f} comes out as a metal and settles.`,
    water: 'H₂O is water.',
    productsReady: (eq) => `Products: ${eq}.`,
    atomsKept: 'Atoms are conserved',
    electronsLine: (a, b) => `Electrons: given ${a} = accepted ${b}.`,
    typeIs: 'Reaction type',
  },
  uz: {
    particles: 'Tenglama koeffitsiyentlari boʻyicha zarrachalar',
    madeOfIons: (f, ions) => `${f} ionlardan iborat: ${ions}.`,
    bondsBreak: 'Bogʻlar uziladi',
    ionsSeparate: 'Ionlar ajraladi',
    metalAtoms: (f) => `Metall atomlari (${f}) kristalldan chiqadi.`,
    staysWhole: 'Butunligicha oʻtadi',
    nothingBreaks: 'Zarrachalar yaqinlashib, qayta joylashadi.',
    reducer: 'Qaytaruvchi',
    oxidizer: 'Oksidlovchi',
    gives: 'beradi',
    takes: 'qabul qiladi',
    givenEqTaken: (a, b) => `Berilgan ${a}e⁻ = qabul qilingan ${b}e⁻.`,
    noRedox: 'Oksidlanish darajalari oʻzgarmaydi — elektronlar oʻtmaydi.',
    bondsForm: 'Yangi bogʻlar hosil boʻladi',
    ionsPack: 'Ionlar kristallga yigʻiladi',
    gas: (f) => `${f} — gaz, uchib chiqadi ↑.`,
    precipitate: (f) => `${f} — choʻkma ↓, choʻkadi.`,
    deposit: (f) => `${f} metall holida ajralib, choʻkadi.`,
    water: 'H₂O — suv.',
    productsReady: (eq) => `Mahsulotlar: ${eq}.`,
    atomsKept: 'Atomlar saqlanadi',
    electronsLine: (a, b) => `Elektronlar: berilgan ${a} = qabul qilingan ${b}.`,
    typeIs: 'Reaksiya turi',
  },
}

/** Σ степеней окисления формульной единицы (для проверки: = заряду частицы). */
export function unitOxSum(side: StorySide, unit: number): number {
  return round6(side.units[unit]!.atoms.reduce((s, a) => s + side.atoms[a]!.ox, 0))
}

/** Группы, распавшиеся на фрагменты при разрыве: связные компоненты левой стороны без разорванных связей. */
export function breakFragments(story: ReactionStory): number[][] {
  const L = story.left
  const broken = new Set(story.bondsBroken)
  const n = L.atoms.length
  const parent = Array.from({ length: n }, (_, i) => i)
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)))
  L.bonds.forEach((b, i) => {
    if (!broken.has(i)) parent[find(b.a)] = find(b.b)
  })
  const m = new Map<number, number[]>()
  for (let i = 0; i < n; i++) {
    const r = find(i)
    const g = m.get(r)
    if (g) g.push(i)
    else m.set(r, [i])
  }
  return [...m.values()]
}
