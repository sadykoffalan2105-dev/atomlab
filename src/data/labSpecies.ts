/**
 * Частицы реактора, которых нет в каталоге веществ, но которые встречаются в уравнениях
 * учебников 7–9 классов:
 *  • ионы (Na⁺, Cl⁻, SO₄²⁻, NO₃⁻, NH₄⁺, H₃O⁺ …) — краткие ионные уравнения, диссоциация, электролиз;
 *  • электрон e⁻ — полуреакции на электродах;
 *  • органика школьных уравнений (CH₄, C₂H₅OH, C₃H₈, C₆H₁₂O₆, HCHO, CH₃OH, C₂H₂) — в каталоге
 *    она живёт в органической лаборатории (organicMoleculeRegistry), здесь — её формульные единицы;
 *  • простое вещество в роли главного продукта (2H₂O → 2H₂ + O₂, 2HgO → 2Hg + O₂).
 *
 * Это те же CompoundDef, чтобы панель реактора, счёт атомов и сцена «шарами» работали
 * с ними без особых веток, но в compoundById (каталог, поиск, сопоставление атомов с
 * веществом) они НЕ попадают: реактор берёт их из labCompoundById.
 */
import type { CompoundDef } from '../types/chemistry'
import { formulaCompositionKey, formulaToUnicode, type FormulaCounts } from '../chemistry/equationFormula'
import { isDiatomicNativeElement } from '../chemistry/diatomicElements'
import {
  ionGeometry,
  organicGeometry,
  simpleSubstanceGeometry,
  type LabGeometry,
} from '../chemistry/labSpeciesGeometry'
import { compoundById } from './compounds'
import { getElementByZ } from './elements'

export type LabSpeciesKind = 'ion' | 'electron' | 'organic' | 'simple'

/** id электрона в реакторе. */
export const ELECTRON_SPECIES_ID = 'lab_electron'

const EMPTY_FACTS = { source: '', usage: '', importance: '' }

function chargeSuffix(q: number): string {
  if (q === 0) return ''
  const mag = Math.abs(q)
  return `^${mag === 1 ? '' : mag}${q > 0 ? '+' : '-'}`
}

function countsOf(atoms: LabGeometry['atoms']): FormulaCounts {
  const out: FormulaCounts = {}
  for (const a of atoms) out[a.symbol] = (out[a.symbol] ?? 0) + 1
  return out
}

function makeSpecies(p: {
  id: string
  nameRu: string
  formulaUnicode: string
  geometry: LabGeometry
  charge?: number
  accentColor: string
  descriptionRu: string
  composition?: FormulaCounts
}): CompoundDef {
  return {
    id: p.id,
    nameRu: p.nameRu,
    formulaUnicode: p.formulaUnicode,
    composition: p.composition ?? countsOf(p.geometry.atoms),
    atoms: p.geometry.atoms,
    bonds: p.geometry.bonds,
    accentColor: p.accentColor,
    descriptionRu: p.descriptionRu,
    laboratoryRecipeRu: '',
    obtainingStepsRu: [],
    category: 'other',
    ...(p.charge != null && p.charge !== 0 ? { charge: p.charge } : {}),
    synthesisConditionsRu: {},
    factsRu: EMPTY_FACTS,
  }
}

// ── ионы ────────────────────────────────────────────────────────────────────

type IonSpec = {
  /** ASCII-ядро формулы без заряда: «SO4», «Na», «H2PO4» */
  core: string
  charge: number
  nameRu: string
  /** ключ геометрии многоатомного иона (labSpeciesGeometry.ionGeometry) */
  geo?: string
}

/** Ионы школьных уравнений 7–9 классов (краткие ионные, диссоциация, электролиз). */
const ION_SPECS: readonly IonSpec[] = [
  { core: 'H', charge: 1, nameRu: 'Катион водорода (протон)' },
  { core: 'Li', charge: 1, nameRu: 'Катион лития' },
  { core: 'Na', charge: 1, nameRu: 'Катион натрия' },
  { core: 'K', charge: 1, nameRu: 'Катион калия' },
  { core: 'Ag', charge: 1, nameRu: 'Катион серебра' },
  { core: 'Mg', charge: 2, nameRu: 'Катион магния' },
  { core: 'Ca', charge: 2, nameRu: 'Катион кальция' },
  { core: 'Ba', charge: 2, nameRu: 'Катион бария' },
  { core: 'Zn', charge: 2, nameRu: 'Катион цинка' },
  { core: 'Cu', charge: 2, nameRu: 'Катион меди(II)' },
  { core: 'Fe', charge: 2, nameRu: 'Катион железа(II)' },
  { core: 'Fe', charge: 3, nameRu: 'Катион железа(III)' },
  { core: 'Al', charge: 3, nameRu: 'Катион алюминия' },
  { core: 'F', charge: -1, nameRu: 'Фторид-ион' },
  { core: 'Cl', charge: -1, nameRu: 'Хлорид-ион' },
  { core: 'Br', charge: -1, nameRu: 'Бромид-ион' },
  { core: 'I', charge: -1, nameRu: 'Иодид-ион' },
  { core: 'O', charge: -2, nameRu: 'Оксид-ион' },
  { core: 'S', charge: -2, nameRu: 'Сульфид-ион' },
  { core: 'OH', charge: -1, nameRu: 'Гидроксид-ион', geo: 'OH' },
  { core: 'H3O', charge: 1, nameRu: 'Ион гидроксония', geo: 'H3O' },
  { core: 'NH4', charge: 1, nameRu: 'Ион аммония', geo: 'NH4' },
  { core: 'SO4', charge: -2, nameRu: 'Сульфат-ион', geo: 'SO4' },
  { core: 'HSO4', charge: -1, nameRu: 'Гидросульфат-ион', geo: 'HSO4' },
  { core: 'NO3', charge: -1, nameRu: 'Нитрат-ион', geo: 'NO3' },
  { core: 'PO4', charge: -3, nameRu: 'Фосфат-ион', geo: 'PO4' },
  { core: 'HPO4', charge: -2, nameRu: 'Гидрофосфат-ион', geo: 'HPO4' },
  { core: 'H2PO4', charge: -1, nameRu: 'Дигидрофосфат-ион', geo: 'H2PO4' },
  { core: 'CO3', charge: -2, nameRu: 'Карбонат-ион', geo: 'CO3' },
  { core: 'HCO3', charge: -1, nameRu: 'Гидрокарбонат-ион', geo: 'HCO3' },
  { core: 'SiO3', charge: -2, nameRu: 'Силикат-ион', geo: 'SiO3' },
  { core: 'ClO3', charge: -1, nameRu: 'Хлорат-ион', geo: 'ClO3' },
  { core: 'IO3', charge: -1, nameRu: 'Иодат-ион', geo: 'IO3' },
  { core: 'CrO4', charge: -2, nameRu: 'Хромат-ион', geo: 'CrO4' },
  { core: 'AlOH', charge: 2, nameRu: 'Гидроксокатион алюминия', geo: 'AlOH' },
]

function ionId(core: string, charge: number): string {
  return `ion_${core.toLowerCase()}_${Math.abs(charge)}${charge > 0 ? 'p' : 'm'}`
}

function ionSpecies(spec: IonSpec): CompoundDef | null {
  const geometry = spec.geo ? ionGeometry(spec.geo) : { atoms: [{ symbol: spec.core, pos: [0, 0, 0] as const }], bonds: [] }
  if (!geometry) return null
  const formula = formulaToUnicode(`${spec.core}${chargeSuffix(spec.charge)}`)
  return makeSpecies({
    id: ionId(spec.core, spec.charge),
    nameRu: spec.nameRu,
    formulaUnicode: formula,
    geometry: { atoms: geometry.atoms.map((a) => ({ symbol: a.symbol, pos: a.pos })), bonds: geometry.bonds },
    charge: spec.charge,
    accentColor: spec.charge > 0 ? '#ffd9a0' : '#9be8ff',
    descriptionRu: `${spec.nameRu} (${formula}) — частица раствора или расплава.`,
  })
}

// ── электрон ────────────────────────────────────────────────────────────────

const ELECTRON: CompoundDef = makeSpecies({
  id: ELECTRON_SPECIES_ID,
  nameRu: 'Электрон',
  formulaUnicode: 'e⁻',
  // У электрона нет атомов: сцена рисует его отдельной маленькой частицей.
  geometry: { atoms: [], bonds: [] },
  composition: {},
  charge: -1,
  accentColor: '#7fd4ff',
  descriptionRu: 'Электрон (e⁻) — в полуреакциях на электродах: восстановление (+e⁻) и окисление (−e⁻).',
})

// ── органика ────────────────────────────────────────────────────────────────

type OrganicSpec = { id: string; geo: string; formulaUnicode: string; nameRu: string; organicId: string }

/** Органические вещества уравнений 7–9 классов; organicId — id в каталоге органики. */
const ORGANIC_SPECS: readonly OrganicSpec[] = [
  { id: 'org_methane', geo: 'CH4', formulaUnicode: 'CH₄', nameRu: 'Метан', organicId: 'methane' },
  { id: 'org_methanol', geo: 'CH3OH', formulaUnicode: 'CH₃OH', nameRu: 'Метанол', organicId: 'methanol' },
  { id: 'org_ethanol', geo: 'C2H5OH', formulaUnicode: 'C₂H₅OH', nameRu: 'Этанол', organicId: 'ethanol' },
  { id: 'org_propane', geo: 'C3H8', formulaUnicode: 'C₃H₈', nameRu: 'Пропан', organicId: 'propane' },
  { id: 'org_formaldehyde', geo: 'HCHO', formulaUnicode: 'HCHO', nameRu: 'Формальдегид (метаналь)', organicId: 'formaldehyde' },
  { id: 'org_acetylene', geo: 'C2H2', formulaUnicode: 'C₂H₂', nameRu: 'Ацетилен (этин)', organicId: 'acetylene' },
  { id: 'org_glucose', geo: 'C6H12O6', formulaUnicode: 'C₆H₁₂O₆', nameRu: 'Глюкоза', organicId: 'glucose-pyranose' },
]

/** id вещества реактора → id молекулы в каталоге органики. */
export const LAB_ORGANIC_CATALOG_ID: Readonly<Record<string, string>> = Object.fromEntries(
  ORGANIC_SPECS.map((s) => [s.id, s.organicId]),
)

function organicSpecies(spec: OrganicSpec): CompoundDef | null {
  const geometry = organicGeometry(spec.geo)
  if (!geometry) return null
  return makeSpecies({
    id: spec.id,
    nameRu: spec.nameRu,
    formulaUnicode: spec.formulaUnicode,
    geometry,
    accentColor: '#9be38a',
    descriptionRu: `${spec.nameRu} (${spec.formulaUnicode}) — органическое вещество.`,
  })
}

// ── простые вещества ────────────────────────────────────────────────────────

/** id простого вещества: «simple_Na», «simple_H2». */
export function simpleSubstanceId(symbol: string, atomsPerUnit: number): string {
  return `simple_${symbol}${atomsPerUnit > 1 ? atomsPerUnit : ''}`
}

function simpleSpecies(z: number, n: number): CompoundDef | null {
  const el = getElementByZ(z)
  if (!el) return null
  const formula = formulaToUnicode(`${el.symbol}${n > 1 ? n : ''}`)
  return makeSpecies({
    id: simpleSubstanceId(el.symbol, n),
    nameRu: el.nameRu,
    formulaUnicode: formula,
    geometry: simpleSubstanceGeometry(el.symbol, n),
    accentColor: `#${el.cpkHex || '99aabb'}`,
    descriptionRu: `${el.nameRu} (${formula}) — простое вещество.`,
  })
}

// ── реестр ──────────────────────────────────────────────────────────────────

const kindById = new Map<string, LabSpeciesKind>()
const extra: Record<string, CompoundDef> = {}
const ionByKey = new Map<string, CompoundDef>()
const organicByKey = new Map<string, CompoundDef>()

function register(c: CompoundDef | null, kind: LabSpeciesKind) {
  if (!c || compoundById[c.id]) return
  extra[c.id] = c
  kindById.set(c.id, kind)
}

for (const spec of ION_SPECS) {
  const c = ionSpecies(spec)
  register(c, 'ion')
  if (c) ionByKey.set(`${formulaCompositionKey(c.composition)}#${spec.charge}`, c)
}
register(ELECTRON, 'electron')
for (const spec of ORGANIC_SPECS) {
  const c = organicSpecies(spec)
  register(c, 'organic')
  if (c) organicByKey.set(formulaCompositionKey(c.composition), c)
}
for (let z = 1; z <= 118; z++) {
  register(simpleSpecies(z, 1), 'simple')
  if (isDiatomicNativeElement(z)) register(simpleSpecies(z, 2), 'simple')
}

/** Частицы реактора вне каталога (ионы, электрон, органика, простые вещества). */
export const LAB_EXTRA_SPECIES: Readonly<Record<string, CompoundDef>> = extra

/**
 * Всё, что может стоять в уравнении реактора: каталог + частицы вне каталога.
 * Каталог приоритетнее (одинаковых id нет, но так надёжнее).
 */
export const labCompoundById: Readonly<Record<string, CompoundDef>> = { ...extra, ...compoundById }

/** Вид частицы вне каталога; null — обычное вещество каталога. */
export function labSpeciesKind(id: string | null | undefined): LabSpeciesKind | null {
  return id ? (kindById.get(id) ?? null) : null
}

/** Ион по составу и заряду (Na⁺ → {Na:1}, +1). */
export function ionSpeciesFor(counts: Readonly<FormulaCounts>, charge: number): CompoundDef | null {
  return ionByKey.get(`${formulaCompositionKey(counts)}#${charge}`) ?? null
}

/** Органическое вещество школьных уравнений по составу. */
export function organicSpeciesFor(counts: Readonly<FormulaCounts>): CompoundDef | null {
  return organicByKey.get(formulaCompositionKey(counts)) ?? null
}

/** Простое вещество по номеру элемента и числу атомов в молекуле. */
export function simpleSpeciesFor(z: number, atomsPerUnit: number): CompoundDef | null {
  const el = getElementByZ(z)
  if (!el) return null
  return extra[simpleSubstanceId(el.symbol, atomsPerUnit)] ?? null
}

export function electronSpecies(): CompoundDef {
  return ELECTRON
}

/** Все ионы реестра — для тестов. */
export function allLabIons(): CompoundDef[] {
  return [...ionByKey.values()]
}

/** Все органические частицы реестра — для тестов. */
export function allLabOrganics(): CompoundDef[] {
  return [...organicByKey.values()]
}
