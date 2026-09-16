/**
 * r10: the verified textbook inventory (src/data/textbook/inventory-g{7..11}.json — substances, reactions and lab works of
 * every printed §, checked against the rendered PDF pages) as a data source for the knowledge base:
 *
 *   • inventoryFormulas / inventoryPageFormulas — formulas actually printed in the books (and on which page), used by the
 *     OCR / layout formula repair as known formulas and as a same-page prior (lib/textRepair.mts);
 *   • loadInventory — normalised sections / substances / reactions for the "book index" chunks (lib/bookIndex.mts).
 *
 * The four inventories were produced by different agents: section ids ("c1-s01", "s03", "g9-p01"), kp (string or number),
 * substance fields (pages / page, nameInBook) and reaction fields (equationUnicode may be ASCII in grade 10) differ —
 * everything is normalised here, nothing else reads the raw files.
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..')
export const INVENTORY_GRADES = [7, 8, 9, 10, 11] as const

type RawSpecies = { formula?: string | null; name?: string; coeff?: number }
type RawSubstance = {
  formula?: string | null
  formulaUnicode?: string | null
  formulaInBook?: boolean
  nameRu?: string
  nameInBook?: boolean
  kind?: string
  role?: string
  page?: number
  pages?: number[]
  catalogId?: string | null
  molecularFormula?: string | null
}
type RawReaction = {
  equation?: string
  equationUnicode?: string
  equationAscii?: string
  equationAsInBook?: string | null
  reactants?: RawSpecies[]
  products?: RawSpecies[]
  conditions?: string | string[] | null
  type?: string
  subtype?: string | null
  isGeneralScheme?: boolean
  isIonic?: boolean
  balanced?: boolean | null
  balance?: { balanced?: boolean }
  balanceMode?: string
  page?: number
  pages?: number[]
  writtenInBook?: boolean
  printedInBook?: boolean
  fromExercise?: boolean
}
type RawLab = { title?: string; page?: number; pages?: number[]; kind?: string }
type RawSection = {
  sectionId?: string | null
  chapterId?: string | null
  appSections?: string[]
  kp: string | number
  title: string
  pageStart: number
  pageEnd: number
  substances?: RawSubstance[]
  reactions?: RawReaction[]
  labWorks?: RawLab[]
}

export type InvSubstance = {
  formula: string | null
  formulaUnicode: string | null
  name: string
  kind: string
  role: string
  pages: number[]
  catalogId: string | null
}

export type InvReaction = {
  equation: string
  reactants: { formula: string; coeff: number }[]
  products: { formula: string; coeff: number }[]
  conditions: string
  type: string
  pages: number[]
  printed: boolean
  exercise: boolean
  ionic: boolean
  general: boolean
  nuclear: boolean
  balanced: boolean | null
}

export type InvSection = {
  grade: number
  kp: string
  title: string
  pageStart: number
  pageEnd: number
  /** App lesson ids ("c1", "s03") the section belongs to (first app section for grades 8/9). */
  chapterId?: string
  sectionId?: string
  substances: InvSubstance[]
  reactions: InvReaction[]
  labs: { title: string; page: number | null }[]
}

const readInventory = (grade: number): { sections: RawSection[] } =>
  JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'data', 'textbook', `inventory-g${grade}.json`), 'utf8'))

const SUB: Record<string, string> = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' }
export const asciiFormula = (s: string) => s.replace(/[₀-₉]/g, (c) => SUB[c] ?? c)

const pagesOf = (x: { page?: number; pages?: number[] }): number[] =>
  [...new Set([...(x.pages ?? []), ...(x.page != null ? [x.page] : [])])].filter((p) => Number.isFinite(p)).sort((a, b) => a - b)

/** "c1-s01" / appSections ["c6-s01"] → { chapterId, sectionId } of the app lesson. */
function appIds(s: RawSection): { chapterId?: string; sectionId?: string } {
  const id = s.appSections?.[0] ?? (s.sectionId && /^c\d+-s\d+$/.test(s.sectionId) ? s.sectionId : null)
  const m = id ? /^(c\d+)-(s\d+)$/.exec(id) : null
  return m ? { chapterId: m[1], sectionId: m[2] } : {}
}

function normReaction(r: RawReaction): InvReaction | null {
  const equation = (r.equationUnicode ?? r.equation ?? '').trim()
  if (!equation) return null
  const sp = (xs: RawSpecies[] | undefined) =>
    (xs ?? []).filter((x): x is RawSpecies & { formula: string } => !!x.formula).map((x) => ({ formula: x.formula, coeff: x.coeff ?? 1 }))
  const conditions = Array.isArray(r.conditions) ? r.conditions.join(', ') : (r.conditions ?? '')
  return {
    equation,
    reactants: sp(r.reactants),
    products: sp(r.products),
    conditions: conditions.trim(),
    type: r.type ?? 'other',
    pages: pagesOf(r),
    printed: r.writtenInBook ?? r.printedInBook ?? true,
    exercise: !!r.fromExercise,
    ionic: !!r.isIonic,
    general: !!r.isGeneralScheme,
    nuclear: r.balanceMode === 'nuclear' || /nuclear/.test(r.subtype ?? '') || /[¹²³⁰⁴-⁹]\S*[₀-₉]/.test(equation) && /[βαγ]|\bn\b|\bp\b/.test(equation),
    balanced: r.balanced ?? r.balance?.balanced ?? null,
  }
}

const CACHE = new Map<number, InvSection[]>()

export function loadInventory(grade: number): InvSection[] {
  const hit = CACHE.get(grade)
  if (hit) return hit
  const out: InvSection[] = readInventory(grade).sections.map((s) => ({
    grade,
    kp: String(s.kp),
    title: s.title,
    pageStart: s.pageStart,
    pageEnd: s.pageEnd,
    ...appIds(s),
    substances: (s.substances ?? [])
      .filter((x) => x.nameRu || x.formula)
      .map((x) => ({
        formula: x.formula ?? null,
        formulaUnicode: x.formulaUnicode ?? null,
        name: (x.nameRu ?? '').trim(),
        kind: x.kind ?? 'other',
        role: x.role ?? 'mentioned',
        pages: pagesOf(x),
        catalogId: x.catalogId ?? null,
      })),
    reactions: (s.reactions ?? []).map(normReaction).filter((r): r is InvReaction => !!r),
    labs: (s.labWorks ?? []).filter((l) => l.title).map((l) => ({ title: l.title!.trim(), page: l.page ?? l.pages?.[0] ?? null })),
  }))
  CACHE.set(grade, out)
  return out
}

/** ASCII formulas of every substance and reaction species printed in the books (coefficients and charges stripped). */
function formulasOf(sec: InvSection): { formula: string; pages: number[] }[] {
  const out: { formula: string; pages: number[] }[] = []
  for (const s of sec.substances) if (s.formula) out.push({ formula: asciiFormula(s.formula), pages: s.pages })
  for (const r of sec.reactions) {
    if (r.general || r.nuclear) continue
    for (const x of [...r.reactants, ...r.products]) out.push({ formula: asciiFormula(x.formula), pages: r.pages })
  }
  return out.filter((x) => /^[A-Z([]/.test(x.formula) && !/[–=≡-]/.test(x.formula))
}

export function inventoryFormulas(): string[] {
  const out = new Set<string>()
  for (const g of INVENTORY_GRADES) for (const sec of loadInventory(g)) for (const f of formulasOf(sec)) out.add(f.formula)
  return [...out]
}

/** grade → page → formulas printed on that page. */
export function inventoryPageFormulas(grade: number): Map<number, string[]> {
  const out = new Map<number, Set<string>>()
  for (const sec of loadInventory(grade)) {
    for (const f of formulasOf(sec)) {
      for (const p of f.pages) {
        let set = out.get(p)
        if (!set) out.set(p, (set = new Set()))
        set.add(f.formula)
      }
    }
  }
  return new Map([...out].map(([p, s]) => [p, [...s]]))
}
