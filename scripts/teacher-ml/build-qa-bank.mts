/**
 * «Большая база данных» ИИ-учителя: структурированные факты из ВСЕХ данных проекта →
 * src/data/teacher/qaBank.json (компактный JSON, подключается dynamic import'ом в
 * src/learn/brain/qa/qaBank.ts). Ничего не выдумываем: только поля, которые реально есть в данных.
 *
 *   npm run teacher:qa-bank
 *
 * Источники: каталог веществ (compounds.ts + compoundFacts + catalogFamilies + compoundGradeIndex),
 * таблица элементов (elements.ts + имена EN/UZ), реакции учебников (textbook/equations-g7..11.json),
 * 200 основных реакций (mainReactions200.ts), глоссарий и разделы базы знаний (kb-glossary / kb-sections),
 * определения из корпуса учебников (чанки type: 'definition', строки «Термин — это …»).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compoundById } from '../../src/data/compounds.ts'
import { ELEMENTS } from '../../src/data/elements.ts'
import { ELEMENT_NAMES_EN } from '../../src/data/elementNamesEn.ts'
import { ELEMENT_NAMES_UZ } from '../../src/data/elementNamesUz.ts'
import { familyOf } from '../../src/data/catalog/catalogFamilies.ts'
import { inorganicChapterForId, inorganicFirstPageForId, inorganicGradesForId } from '../../src/data/curriculum/compoundGradeIndex.ts'
import { MAIN_REACTIONS_200 } from '../../src/data/catalog/mainReactions200.ts'
import { molarMassOf } from '../../src/learn/brain/human/chemFacts.ts'
import type { QaBank, QaDefinition, QaElement, QaReaction, QaSection, QaSubstance, QaTerm } from '../../src/learn/brain/qa/qaBankTypes.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = resolve(ROOT, 'src/data/teacher/qaBank.json')

const SUB = '₀₁₂₃₄₅₆₇₈₉'
const plain = (f: string) => [...f].map((ch) => (SUB.includes(ch) ? String(SUB.indexOf(ch)) : ch)).join('').replace(/[·•*]/g, '·')
const round2 = (n: number) => Math.round(n * 100) / 100
const clip = (s: string | undefined, max: number): string | undefined => {
  if (!s) return undefined
  const t = s.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  // Обрезаем по границе предложения, иначе — по слову.
  const cut = t.slice(0, max)
  const dot = cut.lastIndexOf('. ')
  return (dot > max * 0.5 ? cut.slice(0, dot + 1) : cut.replace(/\s+\S*$/, '') + '…').trim()
}

/* ------------------------------------------------------------ элементы */
const massBySymbol = new Map(ELEMENTS.map((e) => [e.symbol, e.atomicMass]))

function periodOf(cfg: string): number | null {
  const shells = [...cfg.matchAll(/(\d)[spdf]/g)].map((m) => Number(m[1]))
  const nobleBase: Record<string, number> = { He: 1, Ne: 2, Ar: 3, Kr: 4, Xe: 5, Rn: 6 }
  const base = cfg.match(/\[(\w+)\]/)?.[1]
  const fromBase = base ? (nobleBase[base] ?? 0) + 1 : 0
  const max = Math.max(fromBase, ...shells)
  return max > 0 ? max : null
}

const elements: QaElement[] = ELEMENTS.map((e) => ({
  z: e.z,
  s: e.symbol,
  ru: e.nameRu,
  en: ELEMENT_NAMES_EN[e.z - 1] ?? e.symbol,
  uz: ELEMENT_NAMES_UZ[e.z - 1] ?? e.symbol,
  A: e.atomicMass,
  per: periodOf(e.electronConfiguration),
  grp: e.groupBlock === 'Lanthanide' || e.groupBlock === 'Actinide' ? null : e.gridX >= 1 && e.gridX <= 18 ? e.gridX : null,
  blk: e.groupBlock,
  ox: e.oxidationStates !== '—' ? e.oxidationStates : undefined,
  cfg: e.electronConfiguration !== '—' ? e.electronConfiguration : undefined,
  st: e.standardState !== '—' ? e.standardState : undefined,
  en_: e.electronegativity ?? undefined,
}))

/* ------------------------------------------------------------ глоссарий */
type GlossaryEntry = { ru: string; en: string[]; uz: string[]; formula: string[]; source: string }
const glossary = JSON.parse(readFileSync(resolve(ROOT, 'src/data/kb/corpus/kb-glossary.json'), 'utf8')) as { entries: GlossaryEntry[] }
const terms: QaTerm[] = glossary.entries.map((e) => ({ ru: e.ru, en: e.en, uz: e.uz, f: e.formula.length ? e.formula : undefined, src: e.source }))
const namesByFormula = new Map<string, GlossaryEntry>()
for (const e of glossary.entries) if (e.source === 'compound') for (const f of e.formula) namesByFormula.set(plain(f), e)

/* ------------------------------------------------------------ вещества */
let molarMismatch = 0
const substances: QaSubstance[] = Object.values(compoundById).map((c) => {
  let M = 0
  for (const [sym, n] of Object.entries(c.composition)) M += (massBySymbol.get(sym) ?? 0) * n
  M = round2(M)
  const check = molarMassOf(plain(c.formulaUnicode))?.total
  if (check != null && Math.abs(check - M) > 0.05) molarMismatch++
  const fam = familyOf(c.id)
  const gl = namesByFormula.get(plain(c.formulaUnicode))
  const recipe = c.obtainingStepsRu.length ? c.obtainingStepsRu.map((s) => s.equation).join('; ') : c.laboratoryRecipeRu.split('\n')[0]
  const grades = c.id.startsWith('org_') ? [] : [...inorganicGradesForId(c.id)]
  const chapter = inorganicChapterForId(c.id)
  const page = inorganicFirstPageForId(c.id)
  return {
    id: c.id,
    ru: c.nameRu,
    en: gl?.en[0],
    uz: gl?.uz[0],
    f: c.formulaUnicode,
    fa: plain(c.formulaUnicode),
    cls: c.category,
    cl2: fam?.cls,
    fam: fam ? { id: fam.family.id, ru: fam.family.ru, en: fam.family.en, uz: fam.family.uz, root: fam.root?.formula } : undefined,
    M,
    comp: c.composition,
    g: grades,
    ch: chapter !== 'прочее' ? chapter : undefined,
    pg: page ?? undefined,
    d: clip(c.descriptionRu, 240),
    use: clip(c.factsRu?.usage, 200),
    src: clip(c.factsRu?.source, 200),
    rec: clip(recipe, 220),
  }
})

/* ------------------------------------------------------------ реакции */
type TbReaction = {
  id: string
  page: number | null
  equation: string
  equationAscii: string
  conditions?: string | null
  type?: string | null
  isIonic?: boolean
  isGeneralScheme?: boolean
  bankId?: string | null
  note?: string
}
type TbUnit = { unitId: string; kp: string; title: string; pageStart: number; reactions: TbReaction[] }

const ARROW = /\s*(?:<->|<=>|⇄|⇌|->|→|=>|=)\s*/
function splitSide(side: string): string[] {
  return side
    .split(/\s+\+\s+|\s\+\s|(?<=\S)\s*\+\s+(?=[A-Z\d(])/)
    .map((p) =>
      p
        .replace(/[↑↓]/g, '')
        .replace(/\((г|ж|тв|р-р|р|aq|g|l|s|k)\)/g, '')
        .replace(/^\s*\d+(?:[.,/]\d+)?\s*/, '')
        .replace(/\s+/g, '')
        .trim(),
    )
    .filter(Boolean)
}
function parseEquation(ascii: string): { r: string[]; p: string[] } | null {
  const parts = ascii.split(ARROW)
  if (parts.length < 2 || !parts[0] || !parts[1]) return null
  const r = splitSide(parts[0]!)
  const p = splitSide(parts[1]!)
  if (!r.length || !p.length) return null
  return { r, p }
}
const rxKey = (r: string[], p: string[]) => `${[...r].map((s) => s.toLowerCase()).sort().join('+')}>${[...p].map((s) => s.toLowerCase()).sort().join('+')}`

const reactions: QaReaction[] = []
const seenRx = new Map<string, QaReaction>()
let skippedIonic = 0
for (const g of [7, 8, 9, 10, 11]) {
  const data = JSON.parse(readFileSync(resolve(ROOT, `src/data/textbook/equations-g${g}.json`), 'utf8')) as { units: TbUnit[] }
  for (const u of data.units) {
    for (const rx of u.reactions) {
      if (rx.isIonic || rx.isGeneralScheme) {
        skippedIonic++
        continue
      }
      const parsed = parseEquation(rx.equationAscii || plain(rx.equation))
      if (!parsed) continue
      const key = rxKey(parsed.r, parsed.p)
      const prev = seenRx.get(key)
      if (prev) {
        if (!prev.g.includes(g)) prev.g.push(g)
        continue
      }
      const entry: QaReaction = {
        id: `g${g}-${u.unitId}-${rx.id}`,
        eq: rx.equation.replace(/\s+/g, ' ').trim(),
        t: rx.type ?? undefined,
        c: rx.conditions?.trim() || undefined,
        g: [g],
        kp: u.kp,
        u: u.unitId,
        pg: rx.page ?? u.pageStart ?? undefined,
        ttl: clip(u.title, 90),
        r: parsed.r,
        p: parsed.p,
        n: rx.note ? clip(rx.note, 80) : undefined,
        bg: g,
        org: g === 10 || (g === 11 && /C\d*H/.test(rx.equationAscii)) ? true : undefined,
      }
      seenRx.set(key, entry)
      reactions.push(entry)
    }
  }
}
let mergedMain = 0
for (const mr of MAIN_REACTIONS_200) {
  const parsed = parseEquation(plain(mr.equation))
  if (!parsed) continue
  const key = rxKey(parsed.r, parsed.p)
  const prev = seenRx.get(key)
  const lab = Object.keys(mr.lab).length ? { ...mr.lab } : undefined
  if (prev) {
    mergedMain++
    prev.rx = mr.redox
    prev.mr = mr.id
    if (mr.titleRu && !prev.n) prev.n = mr.titleRu
    if (lab) prev.lab = lab
    if (mr.conditions && !prev.c) prev.c = mr.conditions
    for (const gg of mr.grades) if (!prev.g.includes(gg)) prev.g.push(gg)
    continue
  }
  const entry: QaReaction = {
    id: mr.id,
    eq: mr.equation,
    t: mr.type,
    c: mr.conditions,
    g: [...mr.grades],
    kp: undefined,
    u: mr.book?.unitId,
    pg: mr.book?.page ?? undefined,
    r: parsed.r,
    p: parsed.p,
    rx: mr.redox,
    mr: mr.id,
    n: mr.titleRu,
    lab,
    bg: mr.book?.grade,
  }
  seenRx.set(key, entry)
  reactions.push(entry)
}
for (const r of reactions) r.g.sort((a, b) => a - b)

/* ------------------------------------------------------------ разделы */
type SecLegacy = { id: string; kp: string; title: string; page: number }
type SecBook = { kp: string; title: string; page: number; appSections?: string[] }
const secRaw = JSON.parse(readFileSync(resolve(ROOT, 'src/data/kb/corpus/kb-sections.json'), 'utf8')) as Record<string, SecLegacy[] | { book: SecBook[] }>
const sections: QaSection[] = []
for (const g of [7, 8, 9, 10, 11]) {
  const v = secRaw[`g${g}`]
  if (!v) continue
  const list: (SecLegacy | SecBook)[] = Array.isArray(v) ? v : v.book
  for (const s of list) sections.push({ g, id: 'id' in s ? s.id : (s as SecBook).appSections?.[0], kp: s.kp, title: s.title, pg: s.page })
}
const unitKp = new Map(sections.filter((s) => s.id).map((s) => [`${s.g}:${s.id}`, s.kp]))
for (const r of reactions) if (!r.kp && r.u && r.bg) r.kp = unitKp.get(`${r.bg}:${r.u}`)

/* ------------------------------------------------------------ определения */
type Chunk = { grade: number; kp: string; type: string; text: string; pageStart: number; title: string }
const definitions: QaDefinition[] = []
const seenDef = new Set<string>()
for (const g of [7, 8, 9, 10, 11]) {
  const corpus = JSON.parse(readFileSync(resolve(ROOT, `src/data/kb/corpus/kb-corpus-g${g}.json`), 'utf8')) as { chunks: Chunk[] }
  for (const ch of corpus.chunks) {
    if (ch.type !== 'definition') continue
    for (const raw of ch.text.split('\n')) {
      const line = raw.replace(/\s+/g, ' ').trim()
      let term: string | undefined
      let def: string | undefined
      const dash = line.match(/^(?:Основные понятия\s+)?([^—–]{3,60}?)\s+[—–]\s+(?:это\s+)?(.{15,})$/u)
      if (dash) {
        term = dash[1]
        def = dash[2]
      } else {
        const called = line.match(/^(.{15,}?)\s+называ(?:ется|ют|ются)\s+([^.;,]{3,60})\.?$/u)
        if (called) {
          term = called[2]
          def = line
        }
      }
      if (!term || !def) continue
      term = term.replace(/^[«"]|[»"]$/g, '').trim()
      if (!/^\p{L}/u.test(term) || term.split(' ').length > 5) continue
      const k = `${term.toLowerCase()}|${g}`
      if (seenDef.has(k)) continue
      seenDef.add(k)
      definitions.push({ term, def: clip(def, 320)!, g, kp: ch.kp, pg: ch.pageStart })
    }
  }
}

/* ------------------------------------------------------------ запись */
const bank: QaBank = {
  v: 1,
  builtAt: new Date().toISOString().slice(0, 10),
  substances,
  elements,
  reactions,
  terms,
  definitions,
  sections,
}
mkdirSync(dirname(OUT), { recursive: true })
const json = JSON.stringify(bank)
writeFileSync(OUT, json, 'utf8')

const factCount =
  substances.reduce((n, s) => n + Object.values(s).filter((v) => v !== undefined).length - 2, 0) +
  elements.reduce((n, e) => n + Object.values(e).filter((v) => v != null).length - 2, 0) +
  reactions.reduce((n, r) => n + Object.values(r).filter((v) => v !== undefined).length - 1, 0) +
  terms.length * 3 +
  definitions.length +
  sections.length
console.log('qaBank →', OUT)
console.table({
  substances: substances.length,
  'substances with EN/UZ names': substances.filter((s) => s.en).length,
  elements: elements.length,
  reactions: reactions.length,
  'reactions merged with main-200': mergedMain,
  'ionic/general schemes skipped': skippedIonic,
  terms: terms.length,
  definitions: definitions.length,
  sections: sections.length,
  'facts total (non-empty fields)': factCount,
  'molar mass mismatches vs chemFacts': molarMismatch,
  'size, KB': Math.round(json.length / 1024),
})
