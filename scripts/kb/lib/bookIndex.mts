/**
 * r10: "book index" chunks (type 'index', shard 'book') generated from the verified textbook inventory
 * (lib/textbookInventory.mts). They let the local teacher answer precisely, with the formula as printed in the book
 * (never OCR text) and a grade / § / page citation:
 *
 *   • substance  book-g{N}-sub-{key}  «Серная кислота — формула H₂SO₄.» + where it is in «Химия N» (§, pages)
 *   • reaction   book-g{N}-rx-{key}   «Реакция из учебника «Химия 8»: CaO + H₂O → Ca(OH)₂.» + reagents / products
 *                                     with names, type, conditions, § and page
 *   • section    book-g{N}-sec-{kp}   § title and pages + the reactions, substances and experiments of that §
 *
 * The line prefixes are a small contract read by src/learn/brain/dualMode/bookIndexAnswer.ts — keep them in sync.
 * Every chunk carries grade / kp / pageStart and source "Kimyo N", so citationFor() prints «[Kimyo 8, §2, стр. 13]».
 */
import type { CorpusChunk } from './cards.mts'
import { INVENTORY_GRADES, asciiFormula, loadInventory, type InvReaction, type InvSection, type InvSubstance } from './textbookInventory.mts'
import { parseComposition } from '../../textbook-inventory/formula.mts'

type CompoundLike = { id: string; nameRu: string; formulaUnicode: string; category: string }

const KIND_RU: Record<string, string> = {
  simple: 'простое вещество',
  oxide: 'оксид',
  acid: 'кислота',
  base: 'основание',
  salt: 'соль',
  organic: 'органическое вещество',
}

const TYPE_RU: Record<string, string> = {
  combination: 'реакция соединения',
  decomposition: 'реакция разложения',
  substitution: 'реакция замещения',
  exchange: 'реакция обмена',
  neutralization: 'реакция нейтрализации (обмена)',
  combustion: 'реакция горения',
  redox: 'окислительно-восстановительная реакция',
  hydrolysis: 'гидролиз',
  polymerization: 'реакция полимеризации',
}

/** An organic reaction (a species with carbon–hydrogen chains): "combination" is an addition reaction there. */
const ORGANIC_SPECIES_RE = /C[₀-₉\d]*H(?![efgos])/
function typeText(r: InvReaction): string | undefined {
  if (r.type === 'combination' && r.reactants.some((x) => ORGANIC_SPECIES_RE.test(x.formula))) return 'реакция присоединения'
  return TYPE_RU[r.type]
}

const SUB_OUT = '₀₁₂₃₄₅₆₇₈₉'
/** ASCII formula / equation → subscripts ("Ca(OH)2" → "Ca(OH)₂", "2C2H5OH" → "2C₂H₅OH"); unicode input is kept. */
export function prettyFormula(s: string): string {
  // general formulas: CnH2n-2 → CₙH₂ₙ₋₂ (also when the rest of the equation is already in subscripts)
  const general = s.replace(/\b([A-Z][a-z]?)n([A-Z][a-z]?)([₀-₉\d]*)n(?:([+\-−])([₀-₉\d]))?/g, (_m, a: string, b: string, k: string, sign?: string, d?: string) => {
    const sub = (x: string) => [...x].map((c) => (/\d/.test(c) ? SUB_OUT[Number(c)] : c)).join('')
    return `${a}ₙ${b}${sub(k)}ₙ${sign ? (sign === '+' ? '₊' : '₋') + sub(d ?? '') : ''}`
  })
  if (/[⁰-⁹⁺⁻]/.test(general) || /\^/.test(general)) return general.replace(/\*/g, '·')
  // ASCII digits after an element symbol or ")" are subscripts (also when part of the equation is already unicode)
  return general.replace(/(?<=[A-Z][a-z]?|[)\]])(\d+)/g, (d) => [...d].map((c) => SUB_OUT[Number(c)]).join('')).replace(/\*/g, '·')
}

const ROMAN = /^(?:I{1,3}|IV|V|VI{1,3}|IX|X)(?:\s*,\s*(?:I{1,3}|IV|V|VI{1,3}))?$/
const NOTE_WORD_RE =
  /(разбавл|концентр|раствор|порош|стружк|гранул|пластин|опил|гвозд|проволок|катализатор|газообразн|раскал|структурн|формул|вероятно|в книге|молекул|л[её]д(?![а-яё])|пар(?![а-яё])|пары|дистиллир|загрязн|ложк|задани|минерал|жидк|тв[её]рд|сух|чист|графическ|электронн|кусоч|слой|частиц|образец|стружк|\S+н(ая|ой|ую) вод|расплав|цвета(?![а-яё])|запах\S*)/iu
const STATE_PREFIX_RE = /^(металлическ\S*|газообразн\S*|жидк\S*|тв[её]рд\S*|сух\S*|чист\S*|порошкообразн\S*|расплавленн\S*|кристаллическ\S*)\s+/iu
const isFormulaText = (s: string) => /^[A-Z(\[][A-Za-z0-9()[\]·*₀-₉–=≡-]*$/.test(s.trim()) && /[A-Z]/.test(s)
const cleanWordName = (s: string) =>
  s
    .replace(/\s+/g, ' ')
    .replace(/\s*\(\s*((?:I{1,3}|IV|V|VI{1,3}|IX|X)(?:\s*,\s*(?:I{1,3}|IV|V|VI{1,3}))?)\s*\)/g, '($1)')
    .replace(STATE_PREFIX_RE, '')
    .trim()
const usableName = (s: string) => !!s && /^[А-ЯЁа-яё]/.test(s) && !/[A-Za-z0-9:]/.test(s.replace(/\((?:I{1,3}|IV|V|VI{1,3}|IX|X)(?:,(?:I{1,3}|IV|V|VI{1,3}))?\)/g, '')) && s.length <= 60

/** Generic class words and descriptions are not names of the substance ("щелочь", "осадок", "соединение хлора с …"). */
const GENERIC_SYNONYM_RE =
  /^(щ[её]лоч(ь|и)|осад(ок|ки)|газы?|галоген(ы)?|металл(ы)?|неметалл(ы)?|кислот(а|ы)|сол(ь|и)|оксид(ы)?|основани(е|я)|веществ(о|а)|смес(ь|и)|минерал(ы)?|удобрени(е|я)|электролит(ы)?|реактив(ы)?|индикатор(ы)?|продукт(ы)?|окислитель|восстановитель|катализатор|воздух[а-яё]*|атмосфер[а-яё]*|спирт(ы)?)$|соединени|конц|разб|[а-яё]+(ая|яя|ой|ую) вод[аыуе]?$/iu
/** "другой спирт", "бесцветный газ": adjectives + a class word are a description, not a name */
const nameOk = (n: string) => {
  const words = n.split(/\s+/)
  // only descriptive adjectives: «соляная кислота», «углекислый газ» are names, «другой спирт», «белый осадок» are not
  const lastOnly =
    words.length > 1 &&
    words.slice(0, -1).every((w) => /^(друг|ин|так|эт|данн|один|кажд|люб|бесцветн|ядовит|бел|ч[её]рн|бур|зел[её]н|ж[её]лт|красн|голуб|тяж[её]л|л[её]гк|тв[её]рд|жидк|газообразн|летуч|горюч|пахуч)[а-яё]*$/iu.test(w)) &&
    GENERIC_SYNONYM_RE.test(words[words.length - 1]!)
  return !GENERIC_SYNONYM_RE.test(n) && !NOTE_WORD_RE.test(n) && !lastOnly
}
const ADJECTIVE_ONLY_RE = /^[а-яё-]+(ый|ий|ой|ая|яя|ое|ее|ые|ие)$/iu
function goodSynonym(s: string): boolean {
  // «(жесткая, мягкая)» — перечень признаков, не название
  return usableName(s) && !/[.,;]/.test(s) && s.split(/\s+/).length <= 3 && !NOTE_WORD_RE.test(s) && !GENERIC_SYNONYM_RE.test(s) && !s.split(/\s+/).every((w) => ADJECTIVE_ONLY_RE.test(w))
}

/** Inventory name → { name, synonyms } ("гидроксокарбонат меди (II) (малахит)" → "гидроксокарбонат меди(II)" + "малахит"). */
export function splitInventoryName(raw: string): { name: string | null; synonyms: string[] } {
  let s = cleanWordName(raw)
  const synonyms: string[] = []
  // trailing notes in parentheses, right to left
  for (let guard = 0; guard < 3; guard += 1) {
    const m = /^(.*\S)\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)$/.exec(s)
    if (!m) break
    const inner = m[2].trim()
    if (ROMAN.test(inner)) break
    s = m[1].trim()
    const innerClean = cleanWordName(inner)
    if (goodSynonym(innerClean)) synonyms.push(innerClean)
  }
  if (isFormulaText(s)) return { name: synonyms[0] ?? null, synonyms: synonyms.slice(1) }
  return { name: usableName(s) && !/[.]/.test(s) ? s : null, synonyms }
}

const lowerName = (s: string) => (/^[А-ЯЁ][а-яё]/.test(s) && !/^[А-ЯЁ][а-яё]+\s+[А-ЯЁ]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s)
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const charged = (f: string) => /[⁺⁻]|\^|[+-]$/.test(f)

function compositionKey(formula: string): string | null {
  const counts = parseComposition(asciiFormula(formula).replace(/[–=≡-]/g, ''))
  if (!counts) return null
  return Object.entries(counts)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([el, n]) => `${el}${n}`)
    .join('')
}

const slug = (s: string) =>
  asciiFormula(s)
    .toLowerCase()
    .replace(/[а-яё]/g, (c) => 'abvgdeejziiklmnoprstufhccss_y_eua'['абвгдеёжзийклмнопрстуфхцчшщъыьэюя'.indexOf(c)] ?? '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 60)

function hash(s: string): string {
  let h = 2166136261
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36)
}

const pagesText = (pages: readonly number[]): string => {
  const ps = [...new Set(pages)].sort((a, b) => a - b)
  if (!ps.length) return ''
  if (ps.length > 2 && ps[ps.length - 1] - ps[0] === ps.length - 1) return `стр. ${ps[0]}–${ps[ps.length - 1]}`
  return `стр. ${ps.slice(0, 4).join(', ')}${ps.length > 4 ? ' и др.' : ''}`
}
const kpLabel = (sec: InvSection) => (sec.kp === 'lab' ? 'практические и лабораторные работы' : `§ ${sec.kp}`)
const bookName = (g: number) => `«Химия ${g}» (Kimyo ${g})`

/* ------------------------------------------------------------------ names */

type NameBook = {
  /** composition key (inorganic) → names (count) */
  byComposition: Map<string, Map<string, number>>
  /** ascii formula → names (count) */
  byFormula: Map<string, Map<string, number>>
  catalogByComposition: Map<string, CompoundLike>
  elementName: Map<string, string>
}

function addName(map: Map<string, Map<string, number>>, key: string, name: string, weight = 1) {
  let m = map.get(key)
  if (!m) map.set(key, (m = new Map()))
  m.set(name, (m.get(name) ?? 0) + weight)
}

async function nameBook(): Promise<NameBook> {
  const { compoundById } = await import('../../../src/data/compounds.ts')
  const { ELEMENT_NAMES_RU } = await import('../../../src/data/elementNamesRu.ts')
  const raw = (await import('../../../src/data/periodicTableRaw.json', { with: { type: 'json' } })).default as { symbol: string }[]
  const book: NameBook = { byComposition: new Map(), byFormula: new Map(), catalogByComposition: new Map(), elementName: new Map() }
  raw.forEach((e, i) => book.elementName.set(e.symbol, ELEMENT_NAMES_RU[i]!.toLowerCase()))
  for (const c of Object.values(compoundById) as CompoundLike[]) {
    const key = compositionKey(c.formulaUnicode)
    if (key && !book.catalogByComposition.has(key)) book.catalogByComposition.set(key, c)
  }
  for (const g of INVENTORY_GRADES) {
    for (const sec of loadInventory(g)) {
      for (const s of sec.substances) {
        if (!s.formula || charged(s.formula)) continue
        const { name, synonyms } = splitInventoryName(s.name)
        const key = compositionKey(s.formula)
        for (const n of [name, ...synonyms].filter((x) => x && nameOk(x))) {
          if (!n) continue
          addName(book.byFormula, asciiFormula(s.formula), lowerName(n))
          if (key && s.kind !== 'organic') addName(book.byComposition, key, lowerName(n))
        }
      }
    }
  }
  return book
}

/** Names of a formula, most used first (catalog name first for inorganic substances, element name for simple ones). */
function namesFor(book: NameBook, formula: string, organic: boolean): string[] {
  const ascii = asciiFormula(formula)
  const key = compositionKey(formula)
  const counts = new Map<string, number>()
  const merge = (m?: Map<string, number>, w = 1) => m?.forEach((n, k) => counts.set(k, (counts.get(k) ?? 0) + n * w))
  merge(book.byFormula.get(ascii), 2)
  if (!organic && key) merge(book.byComposition.get(key))
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length).map(([n]) => n)
  const out: string[] = []
  const catalog = !organic && key ? book.catalogByComposition.get(key) : undefined
  if (catalog) {
    // catalog names carry synonyms in parentheses too: «Гидроксокарбонат меди(II) (малахит)»
    const { name: cn, synonyms: cs } = splitInventoryName(catalog.nameRu)
    for (const n of [cn, ...cs]) if (n && nameOk(n)) out.push(lowerName(n))
  }
  const single = /^([A-Z][a-z]?)\d*$/.exec(ascii)
  if (single && book.elementName.has(single[1]!) && !out.length && !sorted.length) out.push(book.elementName.get(single[1]!)!)
  for (const n of sorted) if (!out.some((o) => o.toLowerCase() === n.toLowerCase())) out.push(n)
  return dropDescriptiveNames(out).slice(0, 4)
}

/**
 * Names that only describe a state or a use of another name of the same substance are not names:
 * "горячая вода" next to "вода", "ржавление железных изделий" (a process) next to "железо".
 */
function dropDescriptiveNames(names: string[]): string[] {
  const low = names.map((n) => n.toLowerCase())
  return names.filter((n, i) => {
    const words = low[i]!.split(/\s+/)
    if (words.some((w) => /(ение|ание|ения|ания)$/.test(w)) && words.length > 1) return false
    const rest = words.slice(1).join(' ')
    const adjectiveLead = words.length > 1 && ADJECTIVE_ONLY_RE.test(words[0]!)
    return !(adjectiveLead && low.some((m, j) => j !== i && m === rest))
  })
}

const speciesText = (book: NameBook, formula: string) => {
  const pretty = prettyFormula(formula)
  const names = namesFor(book, formula, /–|=|≡|C\d*H\d/.test(formula))
  return names.length ? `${names.slice(0, 2).join(', ')} (${pretty})` : pretty
}

/* ------------------------------------------------------------ substances */

type SubGroup = {
  key: string
  names: Map<string, number>
  formulas: Map<string, number>
  kind: Map<string, number>
  catalogIds: Set<string>
  /** kp → { section, pages, roles } */
  places: Map<string, { sec: InvSection; pages: Set<number>; roles: Set<string> }>
}

function groupKey(s: InvSubstance, name: string | null): string | null {
  if (s.kind === 'ion' || (s.formula && charged(s.formula))) return null
  if ((s.kind === 'organic' || s.kind === 'simple' || !s.formula) && name) return `n:${name.toLowerCase().replace(/ё/g, 'е')}`
  const key = s.formula ? compositionKey(s.formula) : null
  return key ? `c:${key}` : name ? `n:${name.toLowerCase()}` : null
}

const top = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length).map(([k]) => k)
const stemsOf = (s: string) =>
  s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .split(/[^а-яa-z0-9]+/)
    .filter((w) => w.length >= 3)
    .map((w) => w.slice(0, Math.max(3, w.length - 2)))

function substanceChunks(grade: number, sections: InvSection[], book: NameBook): CorpusChunk[] {
  const groups = new Map<string, SubGroup>()
  for (const sec of sections) {
    for (const s of sec.substances) {
      const { name, synonyms } = splitInventoryName(s.name)
      const key = groupKey(s, name)
      if (!key) continue
      let g = groups.get(key)
      if (!g) groups.set(key, (g = { key, names: new Map(), formulas: new Map(), kind: new Map(), catalogIds: new Set(), places: new Map() }))
      for (const n of [name, ...synonyms]) if (n) g.names.set(lowerName(n), (g.names.get(lowerName(n)) ?? 0) + (n === name ? 2 : 1))
      if (s.formulaUnicode || s.formula) {
        const f = prettyFormula(s.formulaUnicode ?? s.formula!)
        g.formulas.set(f, (g.formulas.get(f) ?? 0) + 1)
      }
      g.kind.set(s.kind, (g.kind.get(s.kind) ?? 0) + 1)
      if (s.catalogId) g.catalogIds.add(s.catalogId)
      let p = g.places.get(sec.kp)
      if (!p) g.places.set(sec.kp, (p = { sec, pages: new Set(), roles: new Set() }))
      s.pages.forEach((x) => p!.pages.add(x))
      p.roles.add(s.role)
    }
  }
  // one substance, several groups: a mention without a printed formula ("серная кислота" in words) and the same name +
  // formula recorded with another kind ("озон" as a simple substance and as an oxide) belong together
  const nameSet = (g: SubGroup) => new Set([...g.names.keys()].map((n) => n.toLowerCase()))
  const formulaSet = (g: SubGroup) => new Set([...g.formulas.keys()].map((f) => asciiFormula(f)))
  for (const g of [...groups.values()]) {
    const names = nameSet(g)
    const formulas = formulaSet(g)
    const target = [...groups.values()].find(
      (w) =>
        w !== g &&
        w.formulas.size > 0 &&
        [...nameSet(w)].some((n) => names.has(n)) &&
        (formulas.size === 0 || [...formulaSet(w)].some((f) => formulas.has(f))),
    )
    if (!target) continue
    g.names.forEach((n, k) => target.names.set(k, (target.names.get(k) ?? 0) + n))
    g.formulas.forEach((n, k) => target.formulas.set(k, (target.formulas.get(k) ?? 0) + n))
    g.catalogIds.forEach((id) => target.catalogIds.add(id))
    g.kind.forEach((n, k) => target.kind.set(k, (target.kind.get(k) ?? 0) + n))
    for (const [kp, p] of g.places) {
      const t = target.places.get(kp)
      if (!t) target.places.set(kp, p)
      else {
        p.pages.forEach((x) => t.pages.add(x))
        p.roles.forEach((x) => t.roles.add(x))
      }
    }
    groups.delete(g.key)
  }
  const out: CorpusChunk[] = []
  for (const g of groups.values()) {
    const kind = top(g.kind)[0] ?? 'other'
    const organic = kind === 'organic'
    const formulas = top(g.formulas)
    // molecular formula first, structural second ("C₂H₅OH (структурная: CH₃–CH₂–OH)")
    const molecular = formulas.filter((f) => !/[–=≡]/.test(f))
    const structural = formulas.filter((f) => /[–=≡]/.test(f))
    const primary = molecular[0] ?? structural[0] ?? null
    let names = dropDescriptiveNames(top(g.names).filter(nameOk))
    if (!names.length) names = top(g.names)
    if (primary && !organic) {
      const catalogFirst = namesFor(book, primary, false)[0]
      if (catalogFirst && names.some((n) => n.toLowerCase() === catalogFirst.toLowerCase())) names = [catalogFirst, ...names.filter((n) => n.toLowerCase() !== catalogFirst.toLowerCase())]
    }
    if (!names.length && primary) names = namesFor(book, primary, organic)
    if (!names.length) continue
    const name = names[0]!
    const alt = names.slice(1, 3)
    const nameText = alt.length ? `${name} (${alt.join(', ')})` : name
    const places = [...g.places.values()].sort((a, b) => sectionOrder(a.sec) - sectionOrder(b.sec))
    const nameStems = stemsOf(name)
    const titleHit = (sec: InvSection) => nameStems.length > 0 && nameStems.every((st) => stemsOf(sec.title).includes(st))
    const main = [...places].sort(
      (a, b) =>
        Number(titleHit(b.sec)) - Number(titleHit(a.sec)) ||
        Number(b.roles.has('studied')) - Number(a.roles.has('studied')) ||
        b.pages.size - a.pages.size ||
        sectionOrder(a.sec) - sectionOrder(b.sec),
    )[0]!
    const mainIsTopic = titleHit(main.sec) || (main.roles.has('studied') && main.pages.size >= 2)
    const placeText = (p: (typeof places)[number], withTitle: boolean) =>
      `${kpLabel(p.sec)}${withTitle ? ` «${p.sec.title}»` : ''}${p.pages.size ? ` (${pagesText([...p.pages])})` : ''}`
    const others = places.filter((p) => p !== main)
    const shown = others.slice(0, 6)
    const lines: string[] = []
    if (primary) {
      const extra = [...molecular.slice(1, 2), ...structural.slice(0, primary === structural[0] ? 0 : 1)]
      lines.push(`${capitalize(nameText)} — формула ${primary}${extra.length ? ` (также записывают ${extra.join(', ')})` : ''}.`)
      lines.push(`${primary} — это ${name}${KIND_RU[kind] && !name.includes(KIND_RU[kind]!) ? ` (${KIND_RU[kind]})` : ''}.`)
    } else {
      lines.push(`${capitalize(nameText)}${KIND_RU[kind] ? ` — ${KIND_RU[kind]}` : ''}; химическая формула в учебнике «Химия ${grade}» не приводится.`)
    }
    const subject = `вещество «${name}»${primary ? ` (${primary})` : ''}`
    lines.push(
      mainIsTopic
        ? `Подробнее всего ${subject} разобрано в учебнике ${bookName(grade)}: ${placeText(main, true)}.`
        : `В учебнике ${bookName(grade)} ${subject} встречается в ${placeText(main, true)}.`,
    )
    if (shown.length) {
      lines.push(
        `Ещё ${subject} есть в учебнике «Химия ${grade}»: ${shown.map((p) => placeText(p, false)).join('; ')}${others.length > shown.length ? `; и ещё в ${others.length - shown.length} ${plural(others.length - shown.length, 'параграфе', 'параграфах', 'параграфах')}` : ''}.`,
      )
    }
    const firstPage = main.pages.size ? Math.min(...main.pages) : main.sec.pageStart
    out.push({
      id: `book-g${grade}-sub-${slug(primary ?? name)}-${hash(g.key)}`,
      grade,
      chapterId: main.sec.chapterId,
      sectionId: main.sec.sectionId,
      kp: main.sec.kp === 'lab' ? undefined : main.sec.kp,
      title: `${capitalize(name)}${primary ? ` (${primary})` : ''} — где в учебнике Kimyo ${grade}`,
      pageStart: Number.isFinite(firstPage) ? firstPage : main.sec.pageStart,
      pageEnd: Number.isFinite(firstPage) ? firstPage : main.sec.pageEnd,
      type: 'index',
      lang: 'ru',
      text: lines.join('\n'),
      source: `Kimyo ${grade}`,
      keywords: [...names, ...formulas, ...formulas.map(asciiFormula), `${kpLabel(main.sec)}`],
    })
  }
  return out
}

function sectionOrder(sec: InvSection): number {
  if (sec.kp === 'lab') return 10_000
  const [a, b] = sec.kp.split('.').map(Number)
  return b == null ? a! : a! * 100 + b
}

/* ------------------------------------------------------------- reactions */

const eqKey = (r: InvReaction) => asciiFormula(r.equation).replace(/[\s↑↓]/g, '').replace(/⇄|⇌|=|->|—>/g, '→')

function reactionChunks(grade: number, sections: InvSection[], book: NameBook): CorpusChunk[] {
  const byKey = new Map<string, { r: InvReaction; places: { sec: InvSection; pages: number[] }[] }>()
  for (const sec of sections) {
    for (const r of sec.reactions) {
      if (r.general || r.balanced === false || !r.reactants.length || !r.products.length) continue
      const key = eqKey(r)
      let e = byKey.get(key)
      if (!e) byKey.set(key, (e = { r, places: [] }))
      const same = e.places.find((p) => p.sec.kp === sec.kp)
      if (same) same.pages = [...new Set([...same.pages, ...r.pages])].sort((a, b) => a - b)
      else e.places.push({ sec, pages: r.pages })
    }
  }
  const out: CorpusChunk[] = []
  for (const [key, { r, places }] of byKey) {
    const equation = prettyFormula(r.equation)
    const main = places[0]!
    const lines = [
      `Реакция из учебника «Химия ${grade}»: ${equation}.`,
      `Реагенты: ${r.reactants.map((x) => speciesText(book, x.formula)).join('; ')}.`,
      `Продукты: ${r.products.map((x) => speciesText(book, x.formula)).join('; ')}.`,
      r.conditions ? `Условия: ${r.conditions}.` : '',
      typeText(r) ? `Тип: ${typeText(r)}.` : '',
      `Где в учебнике ${bookName(grade)}: ${places
        .slice(0, 8)
        .map((p) => `${kpLabel(p.sec)} «${p.sec.title}»${p.pages.length ? ` (${pagesText(p.pages)})` : ''}`)
        .join('; ')}.`,
    ].filter(Boolean)
    const names = [...r.reactants, ...r.products].flatMap((x) => namesFor(book, x.formula, /–|=|≡/.test(x.formula)).slice(0, 2))
    out.push({
      id: `book-g${grade}-rx-${hash(key)}`,
      grade,
      chapterId: main.sec.chapterId,
      sectionId: main.sec.sectionId,
      kp: main.sec.kp === 'lab' ? undefined : main.sec.kp,
      title: `Реакция ${equation} — Kimyo ${grade}`,
      pageStart: main.pages[0] ?? main.sec.pageStart,
      pageEnd: main.pages[main.pages.length - 1] ?? main.pages[0] ?? main.sec.pageStart,
      type: 'index',
      lang: 'ru',
      text: lines.join('\n'),
      source: `Kimyo ${grade}`,
      keywords: [...new Set([...names, ...[...r.reactants, ...r.products].map((x) => asciiFormula(x.formula))])],
    })
  }
  return out
}

/* -------------------------------------------------------------- sections */

function sectionChunks(grade: number, sections: InvSection[], book: NameBook): CorpusChunk[] {
  return sections.map((sec) => {
    const label = kpLabel(sec)
    const reactions: string[] = []
    const seen = new Set<string>()
    for (const r of [...sec.reactions].sort((a, b) => Number(b.printed) - Number(a.printed) || (a.pages[0] ?? 0) - (b.pages[0] ?? 0))) {
      const key = eqKey(r)
      if (seen.has(key) || r.balanced === false) continue
      seen.add(key)
      reactions.push(prettyFormula(r.equation))
    }
    const roleRank: Record<string, number> = { studied: 0, obtained: 1, reagent: 2, lab: 3, mentioned: 4 }
    const subs = new Map<string, { text: string; rank: number }>()
    for (const s of sec.substances) {
      if (s.kind === 'ion' || (s.formula && charged(s.formula))) continue
      const { name } = splitInventoryName(s.name)
      const f = s.formulaUnicode ?? (s.formula ? prettyFormula(s.formula) : null)
      const n = name ?? (f ? namesFor(book, f, s.kind === 'organic')[0] : null)
      if (!n && !f) continue
      const key = (f ?? n)!.toLowerCase()
      const text = n && f ? `${n} (${f})` : (n ?? f)!
      const rank = roleRank[s.role] ?? 4
      const cur = subs.get(key)
      if (!cur || rank < cur.rank) subs.set(key, { text, rank })
    }
    const subList = [...subs.values()].sort((a, b) => a.rank - b.rank).map((x) => x.text)
    const lines = [`${label === '§ lab' ? 'Практические и лабораторные работы' : label} «${sec.title}» — учебник ${bookName(grade)}, ${pagesText([sec.pageStart, sec.pageEnd]).replace(/, /, '–')}.`]
    if (reactions.length) {
      lines.push(`В ${label} учебника «Химия ${grade}» ${reactions.length} ${plural(reactions.length, 'реакция', 'реакции', 'реакций')}.`)
      for (let i = 0; i < reactions.length && i < 36; i += 6) {
        lines.push(`${i === 0 ? `Реакции ${label}` : `Реакции ${label} (продолжение)`}: ${reactions.slice(i, i + 6).join('; ')}.`)
      }
    } else {
      lines.push(`Уравнений реакций в ${label} учебника «Химия ${grade}» нет.`)
    }
    if (subList.length) lines.push(`Вещества ${label}: ${subList.slice(0, 18).join(', ')}${subList.length > 18 ? ` и ещё ${subList.length - 18}` : ''}.`)
    if (sec.labs.length) lines.push(`Опыты и практические работы ${label}: ${sec.labs.map((l) => `${l.title}${l.page ? ` (стр. ${l.page})` : ''}`).join('; ')}.`)
    return {
      id: `book-g${grade}-sec-${slug(sec.kp)}`,
      grade,
      chapterId: sec.chapterId,
      sectionId: sec.sectionId,
      kp: sec.kp === 'lab' ? undefined : sec.kp,
      title: `${label === '§ lab' ? 'Практические работы' : label} «${sec.title}» — реакции и вещества (Kimyo ${grade})`,
      pageStart: sec.pageStart,
      pageEnd: sec.pageEnd,
      type: 'index' as const,
      lang: 'ru' as const,
      text: lines.join('\n'),
      source: `Kimyo ${grade}`,
      keywords: [label, `параграф ${sec.kp}`, sec.title],
    }
  })
}

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}

export async function buildBookIndex(): Promise<CorpusChunk[]> {
  const book = await nameBook()
  const out: CorpusChunk[] = []
  for (const g of INVENTORY_GRADES) {
    const sections = loadInventory(g)
    out.push(...sectionChunks(g, sections, book), ...substanceChunks(g, sections, book), ...reactionChunks(g, sections, book))
  }
  const ids = new Set<string>()
  for (const c of out) {
    let id = c.id
    for (let n = 2; ids.has(id); n += 1) id = `${c.id}-${n}`
    ids.add(id)
    c.id = id
  }
  return out
}
