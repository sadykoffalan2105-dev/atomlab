/**
 * Ранжирование неорганических веществ каталога по «школьной важности».
 *
 * Только доказательства, которые уже есть в репозитории:
 *  1) инвентарь учебников  src/data/textbook/substances-g7..g11.json — сколько параграфов,
 *     сколько классов, в какой роли (studied / obtained / reagent / lab / mentioned);
 *  2) выверенные уравнения src/data/textbook/equations-g7..g11.json — реагент или продукт;
 *  3) банк школьных реакций SCHOOL_REACTION_BANK — продукт или участник;
 *  4) класс вещества (оксид / кислота / основание / соль) из элементов программы 7–11;
 *  5) короткий ручной список «без этого школьного курса не бывает».
 *
 * Печатает рейтинг и пишет src/data/textbook/catalogTop200.json
 * (список видимых id и список понижённых id) при флаге --write.
 *
 * Run: npx tsx scripts/textbook-inventory/rank-substances.mts [--write] [--top=200] [--all]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { compoundById } from '../../src/data/compounds.ts'
import { CATALOG_HIDDEN_IDS } from '../../src/data/textbook/catalogWhitelist.ts'
import { SCHOOL_REACTION_BANK } from '../../src/chemistry/schoolReactionBank.ts'
import { SCIENTIFIC_REACTOR_RECIPES } from '../../src/chemistry/scientificReactorRecipes.ts'
import type { CompoundCategory } from '../../src/types/chemistry.ts'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const TB = path.join(ROOT, 'src', 'data', 'textbook')
const GRADES = [7, 8, 9, 10, 11] as const

const TARGET = Number(process.argv.find((a) => a.startsWith('--top='))?.slice(6) ?? 200)
const WRITE = process.argv.includes('--write')
const SHOW_ALL = process.argv.includes('--all')

// ── нормализация формул ──────────────────────────────────────────────────────
const SUB = '₀₁₂₃₄₅₆₇₈₉'

export function normFormula(raw: string): string {
  let s = raw.trim()
  s = s.replace(/[₀-₉]/g, (ch) => String(SUB.indexOf(ch)))
  s = s.replace(/[↓↑]/g, '')
  s = s.replace(/\s*\((?:г|ж|тв|т|р-р|конц|разб|крист)\.?\)\s*/gi, '')
  s = s.replace(/[·•*]/g, '*')
  s = s.replace(/\s+/g, '')
  return s
}

/** Снять стехиометрический коэффициент слева: «3NaOH» → «NaOH», «2H2O» → «H2O». */
function stripCoeff(s: string): string {
  const m = /^(\d+)(?=[A-Z(])/.exec(s)
  return m ? s.slice(m[1].length) : s
}

// ── кандидаты: всё, что сегодня видно в каталоге ─────────────────────────────
const CANDIDATES = Object.values(compoundById).filter((c) => !CATALOG_HIDDEN_IDS.has(c.id))

const idByFormula = new Map<string, string>()
for (const c of CANDIDATES) {
  const k = normFormula(c.formulaUnicode)
  if (!idByFormula.has(k)) idByFormula.set(k, c.id)
}

/**
 * Учебник пишет простое вещество «S», «P», каталог хранит реальную форму при 25 °C:
 * сера — S₈, фосфор — P₄. Сопоставляем их явно.
 */
const ALLOTROPE_ALIAS: Record<string, string> = {
  S: 'S8',
  P: 'P4',
  O: 'O2',
  H: 'H2',
  N: 'N2',
  Cl: 'Cl2',
  F: 'F2',
  Br: 'Br2',
  I: 'I2',
}

function idForFormula(raw: string): string | null {
  const key = normFormula(stripCoeff(raw))
  const direct = idByFormula.get(key)
  if (direct) return direct
  const alias = ALLOTROPE_ALIAS[key]
  return (alias && idByFormula.get(alias)) ?? null
}

// ── элементы школьной программы Kimyo 7–11 ───────────────────────────────────
const SYLLABUS_ELEMENTS = new Set([
  'H', 'He', 'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne',
  'Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar',
  'K', 'Ca', 'Cr', 'Mn', 'Fe', 'Cu', 'Zn', 'Br',
  // V — катализатор контактного способа (V₂O₅), Au — §«медь, серебро и золото» 9 класса
  'Ag', 'Ba', 'I', 'Hg', 'Pb', 'Sn', 'Ni', 'Sr', 'V', 'Au',
])

function elementsOf(id: string): string[] {
  const c = compoundById[id]
  const comp = (c as unknown as { composition?: Record<string, number> }).composition
  if (comp && Object.keys(comp).length > 0) return Object.keys(comp).filter((k) => (comp[k] ?? 0) > 0)
  return [...normFormula(c.formulaUnicode).matchAll(/[A-Z][a-z]?/g)].map((m) => m[0])
}

// ── 1. инвентарь учебников ───────────────────────────────────────────────────
type InvRow = {
  catalogId?: string | null
  formula?: string
  formulaUnicode?: string
  sections?: string[]
  roles?: string[]
  nameInBook?: boolean
  formulaInBook?: boolean
  isIon?: boolean
}
type BookEvidence = {
  sections: number
  grades: Set<number>
  roles: Set<string>
  nameInBook: boolean
  formulaInBook: boolean
}

const book = new Map<string, BookEvidence>()
for (const g of GRADES) {
  const parsed = JSON.parse(readFileSync(path.join(TB, `substances-g${g}.json`), 'utf8')) as {
    substances?: InvRow[]
  }
  for (const r of parsed.substances ?? []) {
    if (r.isIon) continue
    // Простые вещества и «лишние» формулы записаны с catalogId: null —
    // доводим их до каталога по самой формуле (O₂, Cl₂, F₂, S → S₈, P → P₄, SiC …).
    const id =
      r.catalogId && compoundById[r.catalogId]
        ? r.catalogId
        : idForFormula(r.formulaUnicode ?? r.formula ?? '')
    if (!id || !compoundById[id] || CATALOG_HIDDEN_IDS.has(id)) continue
    const b =
      book.get(id) ??
      { sections: 0, grades: new Set<number>(), roles: new Set<string>(), nameInBook: false, formulaInBook: false }
    b.sections += new Set(r.sections ?? []).size
    b.grades.add(g)
    for (const role of r.roles ?? []) b.roles.add(role)
    b.nameInBook = b.nameInBook || Boolean(r.nameInBook)
    b.formulaInBook = b.formulaInBook || Boolean(r.formulaInBook)
    book.set(id, b)
  }
}

// ── 2. выверенные уравнения учебника ─────────────────────────────────────────
type EqRx = {
  equationAscii?: string
  equation?: string
  conditions?: string | null
  isGeneralScheme?: boolean
}
type EqUnit = { reactions?: EqRx[] }

const asProduct = new Map<string, number>()
const asReactant = new Map<string, number>()
/** Катализаторы и условия над стрелкой: V₂O₅, MnO₂, Fe … — их тоже надо оставить в каталоге. */
const asCondition = new Map<string, number>()
let eqTotal = 0
for (const g of GRADES) {
  const parsed = JSON.parse(readFileSync(path.join(TB, `equations-g${g}.json`), 'utf8')) as { units?: EqUnit[] }
  for (const u of parsed.units ?? []) {
    for (const rx of u.reactions ?? []) {
      if (rx.isGeneralScheme) continue
      const eq = rx.equationAscii ?? rx.equation ?? ''
      const sides = eq.split(/->|→|=(?!=)/)
      if (sides.length < 2) continue
      eqTotal++
      const bump = (side: string, m: Map<string, number>) => {
        for (const term of side.split('+')) {
          const id = idForFormula(term)
          if (id) m.set(id, (m.get(id) ?? 0) + 1)
        }
      }
      bump(sides[0], asReactant)
      bump(sides[sides.length - 1], asProduct)
      for (const token of (rx.conditions ?? '').match(/[A-Z][A-Za-z₀-₉0-9()]*/g) ?? []) {
        const id = idForFormula(token)
        if (id) asCondition.set(id, (asCondition.get(id) ?? 0) + 1)
      }
    }
  }
}

// ── 3. банк школьных реакций ─────────────────────────────────────────────────
const bankProduct = new Map<string, number>()
const bankUse = new Map<string, number>()
const bankCatalyst = new Map<string, number>()
for (const rx of SCHOOL_REACTION_BANK) {
  if (rx.productId) bankProduct.set(rx.productId, (bankProduct.get(rx.productId) ?? 0) + 1)
  for (const id of rx.compoundIds ?? []) bankUse.set(id, (bankUse.get(id) ?? 0) + 1)
  if (rx.catalystId) bankCatalyst.set(rx.catalystId, (bankCatalyst.get(rx.catalystId) ?? 0) + 1)
}

// ── 5. ручной буст: без этих веществ школьного курса не существует ───────────
const MANUAL_FORMULAS = [
  'H₂O', 'O₂', 'H₂', 'N₂', 'Cl₂', 'HCl', 'H₂SO₄', 'HNO₃', 'NaOH', 'KOH', 'Ca(OH)₂',
  'NaCl', 'CaCO₃', 'CaO', 'CO₂', 'CO', 'SO₂', 'SO₃', 'NH₃', 'MgO', 'Fe₂O₃', 'Fe₃O₄',
  'CuO', 'CuSO₄', 'ZnO', 'Al₂O₃', 'KMnO₄', 'K₂Cr₂O₇', 'NaHCO₃', 'Na₂CO₃', 'H₃PO₄',
  'H₂S', 'P₂O₅', 'SiO₂', 'KCl', 'AgNO₃', 'BaCl₂', 'BaSO₄', 'AgCl', 'ZnCl₂', 'FeS',
  'FeCl₃', 'CaCl₂', 'MgCl₂', 'Na₂SO₄', 'KNO₃', 'NH₄Cl', '(NH₄)₂SO₄', 'H₂CO₃', 'H₂SiO₃',
  // то же ядро дальше: гидроксиды, кислоты и соли обязательной части 8–9 класса
  'Mg(OH)₂', 'Al(OH)₃', 'Fe(OH)₂', 'Fe(OH)₃', 'Cu(OH)₂', 'Zn(OH)₂', 'Ba(OH)₂',
  'HBr', 'HI', 'HF', 'H₂SO₃', 'HNO₂', 'H₂O₂', 'NO', 'NO₂', 'N₂O₅', 'MnO₂', 'Cu₂O',
  'K₂CO₃', 'K₂SO₄', 'Na₂SiO₃', 'Na₂SO₃', 'Na₃PO₄', 'Ca₃(PO₄)₂', 'CaSO₄', 'Ca(NO₃)₂',
  'FeSO₄', 'FeCl₂', 'Fe₂(SO₄)₃', 'Al₂(SO₄)₃', 'AlCl₃', 'ZnSO₄', 'CuCl₂', 'MgSO₄',
  'KClO₃', 'NH₄NO₃', 'CaC₂', 'Ca(HCO₃)₂', 'NaNO₃', 'KI', 'KBr', 'NaBr', 'CaH₂', 'NaH',
  // простые вещества в реальном состоянии при 25 °C / 1 атм — научный стандарт проекта
  'F₂', 'Br₂', 'I₂', 'S₈', 'P₄', 'O₃',
]
const manualIds = new Set<string>()
const manualMissing: string[] = []
for (const f of MANUAL_FORMULAS) {
  const id = idForFormula(f)
  if (id) manualIds.add(id)
  else manualMissing.push(f)
}

// ── обязательные: сцены анимации и инфраструктура лаборатории ────────────────
const SCENE_FORMULAS = ['NaCl', 'H₂O', 'HCl', 'CO₂', 'NH₃', 'MgO', 'FeS', 'SO₂', 'CaO', 'ZnCl₂']
const sceneIds = new Set<string>()
const sceneMissing: string[] = []
for (const f of SCENE_FORMULAS) {
  const id = idForFormula(f)
  if (id) sceneIds.add(id)
  else sceneMissing.push(f)
}

/** Вещества, на которые прямо ссылаются научные рецепты реактора. */
const recipeIds = new Set<string>()
for (const recipe of Object.values(SCIENTIFIC_REACTOR_RECIPES)) {
  const r = recipe as unknown as {
    productId: string
    left?: { compoundId?: string }[]
    coProducts?: { compoundId?: string }[]
  }
  const ids = [r.productId, ...(r.left ?? []).map((s) => s.compoundId), ...(r.coProducts ?? []).map((s) => s.compoundId)]
  for (const id of ids) {
    if (id && compoundById[id] && !CATALOG_HIDDEN_IDS.has(id)) recipeIds.add(id)
  }
}

// ── счёт ─────────────────────────────────────────────────────────────────────
const CORE_CATEGORIES: CompoundCategory[] = ['oxide', 'acid', 'base', 'salt']
const ROLE_POINTS: Record<string, number> = { studied: 8, obtained: 6, reagent: 6, lab: 4, mentioned: 1 }
const MANUAL_BOOST = 1000

export type ScoredSubstance = {
  id: string
  formula: string
  name: string
  category: CompoundCategory
  sections: number
  grades: number
  score: number
  parts: Record<string, number>
  forced: string | null
}

function scoreOne(id: string): ScoredSubstance {
  const c = compoundById[id]
  const b = book.get(id)
  const parts: Record<string, number> = {}

  const sections = b?.sections ?? 0
  parts.sections = Math.min(sections, 45) * 3
  parts.grades = (b?.grades.size ?? 0) * 5
  parts.roles = [...(b?.roles ?? [])].reduce((s, r) => s + (ROLE_POINTS[r] ?? 0), 0)
  parts.inBook = (b?.nameInBook ? 3 : 0) + (b?.formulaInBook ? 2 : 0)

  parts.eqProduct = Math.min((asProduct.get(id) ?? 0) * 4, 48)
  parts.eqReactant = Math.min((asReactant.get(id) ?? 0) * 3, 36)

  parts.bankProduct = Math.min((bankProduct.get(id) ?? 0) * 6, 36)
  parts.bankUse = Math.min((bankUse.get(id) ?? 0) * 3, 30)
  parts.catalyst = Math.min(((asCondition.get(id) ?? 0) + (bankCatalyst.get(id) ?? 0) * 3) * 6, 36)

  const els = elementsOf(id)
  const inSyllabus = els.every((e) => SYLLABUS_ELEMENTS.has(e))
  parts.klass = inSyllabus ? (CORE_CATEGORIES.includes(c.category) ? 6 : 2) : -25

  parts.manual = manualIds.has(id) ? MANUAL_BOOST : 0

  const score = Object.values(parts).reduce((a, x) => a + x, 0)
  const forced = manualIds.has(id)
    ? 'manual'
    : sceneIds.has(id)
      ? 'scene'
      : recipeIds.has(id)
        ? 'recipe'
        : sections > 8
          ? 'sections>8'
          : null
  return {
    id,
    formula: c.formulaUnicode,
    name: c.nameRu ?? c.id,
    category: c.category,
    sections,
    grades: b?.grades.size ?? 0,
    score,
    parts,
    forced,
  }
}

const scored = CANDIDATES.map((c) => scoreOne(c.id)).sort(
  (a, b) => b.score - a.score || a.id.localeCompare(b.id),
)

// ── отбор ────────────────────────────────────────────────────────────────────
const forced = scored.filter((s) => s.forced != null)
if (forced.length > TARGET) {
  console.error(`обязательных ${forced.length} > ${TARGET} — правило forced слишком широкое`)
  process.exit(1)
}
const keep = new Set(forced.map((s) => s.id))
for (const s of scored) {
  if (keep.size >= TARGET) break
  keep.add(s.id)
}
const visible = scored.filter((s) => keep.has(s.id))
const demoted = scored.filter((s) => !keep.has(s.id))

// ── отчёт ────────────────────────────────────────────────────────────────────
const fmt = (s: ScoredSubstance) =>
  `${String(Math.round(s.score)).padStart(5)}  ${s.id.padEnd(26)} ${s.formula.padEnd(16)} ${s.category.padEnd(6)} §${String(s.sections).padStart(2)} g${s.grades}${s.forced ? ` [${s.forced}]` : ''}`

console.log(
  `кандидатов ${CANDIDATES.length}; уравнений учебника разобрано ${eqTotal}; банк ${SCHOOL_REACTION_BANK.length}`,
)
if (manualMissing.length) console.log(`ручной список — нет в каталоге: ${manualMissing.join(', ')}`)
if (sceneMissing.length) console.log(`СЦЕНЫ — нет в каталоге: ${sceneMissing.join(', ')}`)
const countForced = (kind: string) => forced.filter((s) => s.forced === kind).length
console.log(
  `обязательных ${forced.length} (manual ${countForced('manual')}, scene ${countForced('scene')}, recipe ${countForced('recipe')}, §>8 ${countForced('sections>8')})`,
)

const byCat = (list: ScoredSubstance[]) => {
  const m = new Map<string, number>()
  for (const s of list) m.set(s.category, (m.get(s.category) ?? 0) + 1)
  return [...m.entries()].sort().map(([k, v]) => `${k} ${v}`).join(', ')
}
console.log(`\nОСТАЁТСЯ ${visible.length}: ${byCat(visible)}`)
console.log(`СКРЫВАЕТСЯ ${demoted.length}: ${byCat(demoted)}`)

console.log('\n── топ-12 ──')
for (const s of visible.slice(0, 12)) console.log(fmt(s))
console.log('\n── последние 12, которые прошли ──')
for (const s of visible.slice(-12)) console.log(fmt(s))
console.log('\n── первые 12, которые не прошли ──')
for (const s of demoted.slice(0, 12)) console.log(fmt(s))
if (SHOW_ALL) {
  console.log('\n── весь рейтинг ──')
  for (const s of scored) console.log(`${keep.has(s.id) ? '+' : '-'} ${fmt(s)}`)
}

if (WRITE) {
  const out = {
    generatedAt: new Date().toISOString(),
    generator: 'scripts/textbook-inventory/rank-substances.mts',
    target: TARGET,
    note: 'Видимые в каталоге неорганические вещества (топ по школьной значимости). Данные остальных сохранены, они просто не показываются.',
    visibleInorganic: visible.map((s) => s.id).sort(),
    demotedInorganic: demoted.map((s) => s.id).sort(),
  }
  const file = path.join(TB, 'catalogTop200.json')
  writeFileSync(file, `${JSON.stringify(out, null, 1)}\n`, 'utf8')
  console.log(`\n→ ${path.relative(ROOT, file)}: visible ${out.visibleInorganic.length}, demoted ${out.demotedInorganic.length}`)
}
