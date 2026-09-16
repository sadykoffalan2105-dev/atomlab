/**
 * Merge inventory-g11-part1.json + inventory-g11-part2.json -> src/data/textbook/inventory-g11.json,
 * apply verified fixes (g11merge-fixes.mjs), re-run balance check, uniform catalog / bank mapping,
 * and build substances-g11.json + reactions-g11.json.
 * Usage: node scripts/textbook-inventory/g11merge-build.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  toUnicode, parseFormula, compKey, splitEquation, parseSide, balanceCheck, equationUnicode, equationAscii,
  fromUni, speciesSlug, reactionSig, speciesSig, isNuclear,
} from './g11merge-lib.mjs'
import { FIXES } from './g11merge-fixes.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..', '..')
const outDir = path.join(root, 'src/data/textbook')
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'))
const part1 = read('src/data/textbook/inventory-g11-part1.json')
const part2 = read('src/data/textbook/inventory-g11-part2.json')
const kb = read('src/data/kb/corpus/kb-sections.json').g11
const catalog = read('.smoke/textbook-inventory/g11p1-catalog.json')

const problems = []
const log = []

// ───────── 1. merge sections in book order ─────────
const normId = (id) => id.replace(/^g11-/, '')
const byId = new Map()
for (const [partNo, part] of [[1, part1], [2, part2]]) {
  for (const s of part.sections) {
    const id = normId(s.sectionId)
    if (byId.has(id)) problems.push(`duplicate section ${id} in part ${partNo}`)
    byId.set(id, { ...s, sectionId: id, _part: partNo })
  }
}
const kbIds = [...new Set(kb.map((s) => s.id))]
for (const id of byId.keys()) if (!kbIds.includes(id)) problems.push(`section ${id} not in kb-sections`)
const missingSections = kbIds.filter((id) => !byId.has(id))
if (missingSections.length) problems.push(`MISSING sections: ${missingSections.join(', ')}`)

const KIND_ORDER = ['studied', 'reagent', 'obtained', 'mentioned']

function makeSubstance(s) {
  const p = s.formula ? parseFormula(s.formula) : null
  const o = {
    formula: s.formula ?? null,
    formulaUnicode: s.formula ? toUnicode(s.formula) : null,
    nameRu: s.nameRu,
    nameInBook: s.nameInBook ?? null,
    formulaInBook: s.formulaInBook ?? null,
    kind: s.kind,
    role: s.role,
    page: (s.pages && s.pages.length ? Math.min(...s.pages) : s.page),
    pages: [...new Set(s.pages ?? [s.page])].sort((a, b) => a - b),
    quote: s.quote ?? null,
    catalogId: null,
  }
  if (s.formula && !p) problems.push(`unparseable substance formula ${s.formula}`)
  if (p && p.charge) o.isIon = true
  if (p && !p.charge && Object.keys(p.counts).length === 1) o.elementSymbol = Object.keys(p.counts)[0]
  if (s.formulaAsInBook) o.formulaAsInBook = s.formulaAsInBook
  if (s.note) o.note = s.note
  return o
}

function makeReaction(r) {
  // r: either an existing record (equation/reactants/products) or a fix spec {eq, book, ...}
  const eqText = r.eq ?? fromUni(r.equationAscii ? r.equationAscii.replace(/<=>/g, '⇌').replace(/->/g, '→') : r.equation)
  let reactants = r.reactants, products = r.products
  if (r.eq) {
    const sp = splitEquation(r.eq)
    if (!sp) { problems.push(`cannot split ${r.eq}`); return null }
    reactants = parseSide(sp.left); products = parseSide(sp.right)
  }
  const pages = [...new Set([].concat(r.pages ?? r.page))].sort((a, b) => a - b)
  const o = {
    equationAsInBook: r.book ?? r.equationAsInBook ?? null,
    equation: r.eq ? equationUnicode(r.eq) : r.equation,
    equationAscii: r.eq ? equationAscii(r.eq) : (r.equationAscii ?? equationAscii(eqText)),
    reactants: reactants.map(({ formula, coeff }) => ({ formula, coeff })),
    products: products.map(({ formula, coeff }) => ({ formula, coeff })),
    conditions: r.cond ?? r.conditions ?? null,
    type: r.type,
    subtype: r.subtype ?? null,
    isGeneralScheme: !!(r.scheme ?? r.isGeneralScheme),
    isIonic: !!(r.ionic ?? r.isIonic),
    balanced: null,
    page: pages[0],
    pages,
    quote: r.quote ?? null,
    bankId: null,
    note: r.note ?? null,
  }
  for (const k of ['describedInWords', 'variantsAsInBook', 'unbalanceable', 'bankMatchManual']) if (r[k] !== undefined) o[k] = r[k]
  if (r.words) o.describedInWords = true
  if (r.bankMatch === 'equivalent') o.bankMatchManual = { bankId: r.bankId, match: 'equivalent' }
  return o
}

const sections = kbIds.filter((id) => byId.has(id)).map((id) => {
  const s = byId.get(id)
  const meta = kb.find((x) => x.id === id)
  return {
    sectionId: id,
    chapterId: id.split('-')[0],
    kp: Number(meta.kp),
    title: meta.title,
    pageStart: s.pageStart,
    pageEnd: s.pageEnd,
    sourcePart: s._part,
    elementsMentioned: s.elementsMentioned ?? [],
    substances: s.substances.map(makeSubstance),
    reactions: s.reactions.map(makeReaction).filter(Boolean),
    labWorks: s.labWorks ?? [],
  }
})

// ───────── 2. fixes from verification ─────────
const secById = (id) => { const s = sections.find((x) => x.sectionId === id); if (!s) throw new Error('fix: unknown section ' + id); return s }
const findSub = (sec, key) => sec.substances.find((x) => (x.formula ?? x.nameRu) === key)
const api = {
  addSubstance(id, spec) {
    const sec = secById(id)
    const key = spec.formula ?? spec.nameRu
    const ex = findSub(sec, key)
    if (ex) { // merge pages
      ex.pages = [...new Set([...ex.pages, ...(spec.pages ?? [])])].sort((a, b) => a - b)
      ex.page = ex.pages[0]
      if (KIND_ORDER.indexOf(spec.role) < KIND_ORDER.indexOf(ex.role)) ex.role = spec.role
      log.push(`[${id}] addSubstance ${key}: already present, pages merged`)
      return
    }
    sec.substances.push(makeSubstance({ ...spec, page: spec.pages[0] }))
    log.push(`[${id}] + substance ${key}`)
  },
  editSubstance(id, key, patch) {
    const sec = secById(id)
    const ex = findSub(sec, key)
    if (!ex) { problems.push(`fix editSubstance: ${id} ${key} not found`); return }
    const next = makeSubstance({ ...ex, ...patch })
    Object.keys(ex).forEach((k) => delete ex[k])
    Object.assign(ex, next)
    log.push(`[${id}] ~ substance ${key} -> ${JSON.stringify(patch)}`)
  },
  removeSubstance(id, key, why) {
    const sec = secById(id)
    const i = sec.substances.findIndex((x) => (x.formula ?? x.nameRu) === key)
    if (i < 0) { problems.push(`fix removeSubstance: ${id} ${key} not found`); return }
    sec.substances.splice(i, 1)
    log.push(`[${id}] - substance ${key} (${why})`)
  },
  addReaction(id, spec) {
    const sec = secById(id)
    const r = makeReaction(spec)
    if (sec.reactions.some((x) => x.equationAscii === r.equationAscii)) { log.push(`[${id}] addReaction ${r.equationAscii}: already present`); return }
    sec.reactions.push(r)
    sec.reactions.sort((a, b) => a.page - b.page)
    log.push(`[${id}] + reaction ${r.equationAscii}`)
  },
  editReaction(id, ascii, patch) {
    const sec = secById(id)
    const i = sec.reactions.findIndex((x) => x.equationAscii === ascii)
    if (i < 0) { problems.push(`fix editReaction: ${id} ${ascii} not found`); return }
    const old = sec.reactions[i]
    const spec = { ...old, ...patch }
    if (!patch.eq) delete spec.eq
    sec.reactions[i] = makeReaction(spec)
    log.push(`[${id}] ~ reaction ${ascii} -> ${JSON.stringify(patch)}`)
  },
  removeReaction(id, ascii, why) {
    const sec = secById(id)
    const i = sec.reactions.findIndex((x) => x.equationAscii === ascii)
    if (i < 0) { problems.push(`fix removeReaction: ${id} ${ascii} not found`); return }
    sec.reactions.splice(i, 1)
    log.push(`[${id}] - reaction ${ascii} (${why})`)
  },
  editLabWork(id, idx, patch) { Object.assign(secById(id).labWorks[idx], patch); log.push(`[${id}] ~ labWork ${idx}`) },
  addLabWork(id, lw) { secById(id).labWorks.push(lw); log.push(`[${id}] + labWork ${lw.title}`) },
}
FIXES(api)

// ───────── 3. catalog mapping ─────────
const compoundsByKey = new Map()
for (const c of catalog.compounds) {
  if (!c.composition) continue
  const key = compKey({ counts: c.composition, charge: 0 })
  if (!compoundsByKey.has(key)) compoundsByKey.set(key, [])
  compoundsByKey.get(key).push(c)
}
const organicByKey = new Map()
for (const m of catalog.organic) {
  const key = compKey(parseFormula(fromUni(m.formula).replace(/\s/g, '')))
  if (!key) continue
  if (!organicByKey.has(key)) organicByKey.set(key, [])
  organicByKey.get(key).push(m)
}
const norm = (s) => (s || '').toLowerCase().replace(/ё/g, 'е').replace(/[()«»\s,-]/g, '')
// formula-specific disambiguation where one composition has several catalog entries
const PREFERRED = { C2H5OH: 'ethanol', CH3OH: 'methanol', C12H22O11: 'sucrose', CH3COOH: 'acetic-acid', HCOOH: 'formic-acid', C6H12O6: 'glucose-open', CH3COOCH3: null }
function mapSubstance(sub) {
  if (!sub.formula) return { id: null }
  if (Object.prototype.hasOwnProperty.call(PREFERRED, sub.formula)) {
    const id = PREFERRED[sub.formula]
    return id ? { id, source: catalog.organic.some((m) => m.id === id) ? 'organic' : 'compounds' } : { id: null }
  }
  const p = parseFormula(sub.formula)
  if (!p || p.charge) return { id: null }
  const key = compKey(p)
  // exact formulaUnicode match first
  const uni = toUnicode(sub.formula)
  const exact = catalog.compounds.find((c) => c.formulaUnicode === uni)
  if (exact) return { id: exact.id, source: 'compounds' }
  const list = compoundsByKey.get(key)
  if (list) {
    const n = norm(sub.nameRu)
    const hit = list.length === 1 ? list[0] : (list.find((x) => n.includes(norm(x.nameRu)) || norm(x.nameRu).includes(n)) || null)
    if (hit) return { id: hit.id, source: 'compounds', viaComposition: true, ambiguous: list.length > 1 ? list.map((x) => x.id) : undefined }
    return { id: null, ambiguous: list.map((x) => x.id) }
  }
  const ol = organicByKey.get(key)
  if (ol) {
    const n = norm(sub.nameRu)
    const hit = ol.length === 1 ? ol[0] : ol.find((x) => n.includes(norm(x.nameRu)) || norm(x.nameRu).includes(n))
    if (hit) return { id: hit.id, source: 'organic' }
  }
  return { id: null }
}
const mapCache = new Map()
for (const sec of sections) for (const sub of sec.substances) {
  const m = mapSubstance(sub)
  sub.catalogId = m.id
  if (m.id) sub.catalogSource = m.source
  else delete sub.catalogSource
  if (m.ambiguous && !m.id) problems.push(`catalog ambiguous for ${sub.formula} (${sub.nameRu}): ${m.ambiguous.join(',')}`)
  mapCache.set(sub.formula ?? sub.nameRu, m)
}
// compare with the part files' own mapping
const partMap = new Map()
for (const part of [part1, part2]) for (const s of part.sections) for (const sub of s.substances) if (sub.formula) {
  const k = sub.formula
  if (!partMap.has(k)) partMap.set(k, new Set())
  partMap.get(k).add(sub.catalogId ?? null)
}
const mappingDiffs = []
for (const [f, ids] of partMap) {
  const mine = mapCache.get(f)?.id ?? null
  for (const id of ids) if (id !== mine) mappingDiffs.push(`${f}: part=${id} merged=${mine}`)
}

// ───────── 4. bank mapping + balance ─────────
const bank = []
for (const b of catalog.reactions) {
  if (!b.equationRu || b.equationRu.includes(';')) continue
  const eq = fromUni(b.equationRu).replace(/(→|⇄|⇌|=)\s*\([^)]*\)/g, '$1').replace(/[↑↓]/g, '')
  const sp = eq.match(/\s*(→|⇄|⇌|=)\s*/)
  if (!sp) continue
  const idx = eq.indexOf(sp[0])
  const L = parseSide(eq.slice(0, idx).replace(/\s*\+\s*/g, ' + '))
  const R = parseSide(eq.slice(idx + sp[0].length).replace(/\s*\+\s*/g, ' + '))
  if ([...L, ...R].some((x) => !parseFormula(x.formula))) continue
  bank.push({ id: b.id, sig: reactionSig(L, R), ssig: speciesSig(L, R), rev: reactionSig(R, L), equationRu: b.equationRu })
}
const unbalanced = []
for (const sec of sections) for (const r of sec.reactions) {
  if (r.isGeneralScheme) { r.balanced = null; continue }
  const bc = balanceCheck(r.reactants, r.products)
  r.balanced = bc.balanced
  if (bc.detail) r.balanceDetail = bc.detail; else delete r.balanceDetail
  if (bc.mode === 'nuclear') r.balanceMode = 'nuclear'
  if (bc.balanced !== true) unbalanced.push({ section: sec.sectionId, page: r.page, equation: r.equationAscii, detail: bc.detail, note: r.note, unbalanceable: !!r.unbalanceable })
  // bank
  const sig = reactionSig(r.reactants, r.products)
  const exact = bank.find((b) => b.sig === sig)
  if (exact) { r.bankId = exact.id; r.bankMatch = 'exact' }
  else if (r.bankMatchManual) { r.bankId = r.bankMatchManual.bankId; r.bankMatch = r.bankMatchManual.match }
  else {
    const ss = speciesSig(r.reactants, r.products)
    const same = bank.find((b) => b.ssig === ss)
    if (same) { r.bankId = same.id; r.bankMatch = 'same-species-other-coefficients' }
    else { r.bankId = null; delete r.bankMatch }
  }
  delete r.bankMatchManual
}

// species in reactions must be listed in the section's substances
for (const sec of sections) {
  const have = new Set(sec.substances.map((s) => s.formula).filter(Boolean))
  for (const r of sec.reactions) {
    if (r.isGeneralScheme) continue
    for (const x of [...r.reactants, ...r.products]) {
      if (isNuclear(x.formula) || x.formula === 'e^-' || !parseFormula(x.formula)) continue
      if (/^[A-Z][a-z]?$/.test(x.formula) && r.subtype === 'bond-formation-scheme') continue
      if (!have.has(x.formula)) problems.push(`[${sec.sectionId}] reaction species not in substances: ${x.formula} (p.${r.page} ${r.equationAscii})`)
    }
  }
  // duplicates
  const seen = new Set()
  for (const s of sec.substances) { const k = s.formula ?? s.nameRu; if (seen.has(k)) problems.push(`[${sec.sectionId}] duplicate substance ${k}`); seen.add(k) }
  const seenR = new Set()
  for (const r of sec.reactions) { if (seenR.has(r.equationAscii)) problems.push(`[${sec.sectionId}] duplicate reaction ${r.equationAscii}`); seenR.add(r.equationAscii) }
  sec.substances.sort((a, b) => a.page - b.page)
  sec.reactions.sort((a, b) => a.page - b.page)
}
// page continuity
for (let i = 1; i < sections.length; i++) {
  const a = sections[i - 1], b = sections[i]
  if (b.pageStart > a.pageEnd + 1) problems.push(`page gap between ${a.sectionId} (..${a.pageEnd}) and ${b.sectionId} (${b.pageStart}..)`)
}

// ───────── 5. unique substances ─────────
const secOrder = (id) => kbIds.indexOf(id)
const subMap = new Map()
for (const sec of sections) for (const s of sec.substances) {
  const key = s.formula ?? `name:${norm(s.nameRu)}`
  if (!subMap.has(key)) {
    subMap.set(key, {
      formula: s.formula, formulaUnicode: s.formulaUnicode, nameRu: s.nameRu, kind: s.kind,
      catalogId: s.catalogId, catalogSource: s.catalogSource ?? null,
      sections: [], roles: [], firstPage: s.page, pages: [], namesInBook: [], kinds: [],
      isIon: !!s.isIon, elementSymbol: s.elementSymbol ?? null, formulaInBook: false,
    })
  }
  const u = subMap.get(key)
  if (!u.sections.includes(sec.sectionId)) u.sections.push(sec.sectionId)
  if (!u.roles.includes(s.role)) u.roles.push(s.role)
  u.firstPage = Math.min(u.firstPage, s.page)
  u.pages.push(...s.pages)
  if (!u.namesInBook.includes(s.nameRu)) u.namesInBook.push(s.nameRu)
  if (!u.kinds.includes(s.kind)) u.kinds.push(s.kind)
  if (s.formulaInBook !== false) u.formulaInBook = true
}
const substancesAll = [...subMap.values()].map((u) => {
  u.pages = [...new Set(u.pages)].sort((a, b) => a - b)
  u.sections.sort((a, b) => secOrder(a) - secOrder(b))
  u.roles.sort((a, b) => KIND_ORDER.indexOf(a) - KIND_ORDER.indexOf(b))
  if (u.kinds.length > 1) problems.push(`kind conflict ${u.formula ?? u.nameRu}: ${u.kinds.join('/')}`)
  const aliases = u.namesInBook.filter((n) => n !== u.nameRu)
  const o = {
    formula: u.formula, formulaUnicode: u.formulaUnicode, nameRu: u.nameRu, kind: u.kind,
    catalogId: u.catalogId, sections: u.sections, roles: u.roles, firstPage: u.firstPage, pages: u.pages,
  }
  if (u.catalogSource) o.catalogSource = u.catalogSource
  if (aliases.length) o.aliases = aliases
  if (u.elementSymbol) o.elementSymbol = u.elementSymbol
  if (u.formula && !u.formulaInBook) o.formulaInBook = false
  if (u.isIon) o.isIon = true
  return o
}).sort((a, b) => a.firstPage - b.firstPage || String(a.formula ?? a.nameRu).localeCompare(String(b.formula ?? b.nameRu)))
const substancesOut = substancesAll.filter((s) => !s.isIon)
const ionsOut = substancesAll.filter((s) => s.isIon)

// ───────── 6. unique reactions ─────────
const rxMap = new Map()
for (const sec of sections) for (const r of sec.reactions) {
  const key = r.isGeneralScheme ? `scheme:${r.equationAscii}` : reactionSig(r.reactants, r.products)
  if (!rxMap.has(key)) rxMap.set(key, { r, sections: [], pages: [] })
  const u = rxMap.get(key)
  if (!u.sections.includes(sec.sectionId)) u.sections.push(sec.sectionId)
  u.pages.push(...r.pages)
}
const usedIds = new Map()
const reactionsOut = [...rxMap.values()].map(({ r, sections: secs, pages }) => {
  let base
  if (r.isGeneralScheme) base = 'g11-scheme-' + r.equationAscii.replace(/<=>|->|=/g, ' to ').replace(/[^A-Za-z0-9]+/g, '-').toLowerCase().replace(/^-|-$/g, '')
  else base = 'g11-' + r.reactants.map((x) => speciesSlug(x.formula)).join('-') + '--' + r.products.map((x) => speciesSlug(x.formula)).join('-')
  base = base.slice(0, 90).replace(/-+$/, '')
  const n = (usedIds.get(base) ?? 0) + 1
  usedIds.set(base, n)
  const id = n === 1 ? base : `${base}-v${n}`
  pages = [...new Set(pages)].sort((a, b) => a - b)
  const o = {
    id,
    equation: r.equation,
    equationAscii: r.equationAscii,
    equationAsInBook: r.equationAsInBook,
    reactants: r.reactants,
    products: r.products,
    conditions: r.conditions,
    type: r.type,
    subtype: r.subtype,
    sections: secs.sort((a, b) => secOrder(a) - secOrder(b)),
    page: pages[0],
    pages,
    bankId: r.bankId,
    isGeneralScheme: r.isGeneralScheme,
    isIonic: r.isIonic,
    balanced: r.balanced,
  }
  if (r.bankMatch) o.bankMatch = r.bankMatch
  if (r.balanceMode) o.balanceMode = r.balanceMode
  if (r.balanceDetail) o.balanceDetail = r.balanceDetail
  if (r.describedInWords) o.describedInWords = true
  if (r.note) o.note = r.note
  return o
}).sort((a, b) => a.page - b.page)

// ───────── 7. stats + write ─────────
const allSubs = sections.flatMap((s) => s.substances)
const allRx = sections.flatMap((s) => s.reactions)
const compoundsNotInCatalog = substancesOut.filter((s) => s.formula && !s.catalogId && !s.elementSymbol)
const stats = {
  sections: sections.length,
  sectionsExpected: kbIds.length,
  substanceEntries: allSubs.length,
  reactionEntries: allRx.length,
  labWorks: sections.reduce((n, s) => n + s.labWorks.length, 0),
  formalLabWorks: sections.reduce((n, s) => n + s.labWorks.filter((l) => l.isFormalLabWork).length, 0),
  uniqueSubstances: substancesOut.length,
  uniqueSubstancesWithFormula: substancesOut.filter((s) => s.formula).length,
  uniqueNameOnly: substancesOut.filter((s) => !s.formula).map((s) => s.nameRu),
  uniqueIons: ionsOut.length,
  uniqueMappedToCatalog: substancesOut.filter((s) => s.catalogId).length,
  uniqueSimpleSubstances: substancesOut.filter((s) => s.elementSymbol).length,
  uniqueCompoundsNotInCatalog: compoundsNotInCatalog.map((s) => s.formula),
  uniqueReactions: reactionsOut.length,
  uniqueReactionsReal: reactionsOut.filter((r) => !r.isGeneralScheme).length,
  uniqueGeneralSchemes: reactionsOut.filter((r) => r.isGeneralScheme).length,
  uniqueIonic: reactionsOut.filter((r) => r.isIonic).length,
  uniqueNuclear: reactionsOut.filter((r) => r.balanceMode === 'nuclear').length,
  uniqueMappedToBankExact: reactionsOut.filter((r) => r.bankMatch === 'exact').length,
  uniqueMappedToBankLoose: reactionsOut.filter((r) => r.bankId && r.bankMatch !== 'exact').length,
  unbalanced: unbalanced.length,
}
const generatedAt = new Date().toISOString()
const source = 'public/textbooks/kimyo-11-ru.pdf (Kimyo 11, рус. изд.; нет текстового слоя — OCR + визуальная проверка страниц)'
const inventory = {
  grade: 11,
  source,
  generatedAt,
  mergedFrom: ['src/data/textbook/inventory-g11-part1.json', 'src/data/textbook/inventory-g11-part2.json'],
  notes: [
    'sectionId = id из src/data/kb/corpus/kb-sections.json (g11). Все 33 раздела в порядке книги, с. 4–154; с. 155–160 — ответы, содержание, выходные данные.',
    'Вещество в разделе записано один раз; pages — все страницы раздела, где оно встречается; role — наиболее сильная роль (studied > reagent > obtained > mentioned).',
    'nameInBook / formulaInBook: true — напечатано в книге; false — добавлено при извлечении; null — не отмечено в исходной части.',
    'Ионы — формула вида Cu^2+ (isIon). Электрон — e^-. Ядерные частицы — "A/Z/Symbol", баланс по массовому числу и заряду (balanceMode: nuclear).',
    'Атомы/элементы только в контексте строения атома, изотопов, периодической системы — в elementsMentioned (заполнено для разделов части 1); в части 2 простые вещества (металлы ряда активности и др.) записаны как substances.',
    'catalogId пересчитан единообразно для обеих частей (снимок каталога .smoke/textbook-inventory/g11p1-catalog.json). bankId: bankMatch exact — те же вещества и коэффициенты; same-species-other-coefficients / equivalent — близкое совпадение.',
    'В учебнике 11 класса нет оформленных лабораторных/практических работ: labWorks — опыты, описанные в тексте (isFormalLabWork: false).',
    'Исправления после выборочной проверки по изображениям страниц — scripts/textbook-inventory/g11merge-fixes.mjs (журнал в verification.fixLog).',
  ],
  stats,
  verification: null,
  sections,
}
// verification block filled from fixes module metadata
import('./g11merge-fixes.mjs').then(({ VERIFICATION }) => {
  inventory.verification = { ...VERIFICATION, fixLog: log, unbalanced }
  fs.writeFileSync(path.join(outDir, 'inventory-g11.json'), JSON.stringify(inventory, null, 1))
  fs.writeFileSync(path.join(outDir, 'substances-g11.json'), JSON.stringify({
    grade: 11, source, generatedAt,
    notes: [
      'Уникальные вещества учебника 11 класса (ключ — формула; вещества без формулы — по названию). Ионы вынесены в ions.',
      'sections — id разделов (kb-sections.json) в порядке книги; roles — роли по всем разделам; firstPage — первая страница упоминания.',
      'catalogId — id в compoundById (compounds.ts / inorganicCompounds.data.ts) или в organicMoleculeRegistry; простые вещества в каталоге отсутствуют (catalogId: null, elementSymbol).',
    ],
    stats: {
      substances: substancesOut.length, withFormula: stats.uniqueSubstancesWithFormula, nameOnly: stats.uniqueNameOnly.length,
      simple: stats.uniqueSimpleSubstances, mappedToCatalog: stats.uniqueMappedToCatalog,
      compoundsNotInCatalog: compoundsNotInCatalog.length, ions: ionsOut.length,
    },
    substances: substancesOut,
    ions: ionsOut,
  }, null, 1))
  fs.writeFileSync(path.join(outDir, 'reactions-g11.json'), JSON.stringify({
    grade: 11, source, generatedAt,
    notes: [
      'Уникальные реакции (ключ — состав и коэффициенты реагентов/продуктов; общие схемы — по тексту). id — стабильный slug из формул.',
      'isGeneralScheme — буквенные/общие схемы (A + B ⇌ C, MeSO4 …); isIonic — ионные уравнения, диссоциация, полуреакции; balanceMode nuclear — ядерные уравнения.',
      'bankId — SCHOOL_REACTION_BANK; bankMatch: exact | same-species-other-coefficients | equivalent.',
    ],
    stats: {
      reactions: reactionsOut.length, real: stats.uniqueReactionsReal, generalSchemes: stats.uniqueGeneralSchemes,
      ionic: stats.uniqueIonic, nuclear: stats.uniqueNuclear, bankExact: stats.uniqueMappedToBankExact, bankLoose: stats.uniqueMappedToBankLoose,
      unbalanced: unbalanced.length,
    },
    reactions: reactionsOut,
  }, null, 1))
  console.log(JSON.stringify(stats, null, 1))
  console.log('PROBLEMS:', problems.length ? '\n  ' + problems.join('\n  ') : 'none')
  console.log('UNBALANCED:', unbalanced.length ? '\n  ' + unbalanced.map((u) => `${u.section} p${u.page} ${u.equation} :: ${u.detail}${u.unbalanceable ? ' [unbalanceable in book]' : ''}`).join('\n  ') : 'none')
  console.log('MAPPING DIFFS vs parts:', mappingDiffs.length ? '\n  ' + mappingDiffs.join('\n  ') : 'none')
  console.log('FIX LOG:', log.length)
})
