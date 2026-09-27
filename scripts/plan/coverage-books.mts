/**
 * Покрытие книг 7–11 классов: (1) каждая реакция каталога «Реакции учебника» открывается в реакторе;
 * (2) каждое вещество из этих реакций есть в каталоге веществ и видно ученику.
 * Запуск: npx tsx scripts/plan/coverage-books.mts [--list] → сводка; .smoke/coverage-books.json — подробно.
 */
import fs from 'node:fs'
import { compoundById } from '../../src/data/compounds'
import { isCatalogVisibleId, CATALOG_HIDDEN_IDS } from '../../src/data/textbook/catalogWhitelist'
import { organicMoleculeById } from '../../src/data/organicLab/organicMoleculeRegistry'

type Rx = { id: string; page: number | null; equation: string; equationAscii: string; isIonic: boolean; isGeneralScheme: boolean; exercise?: boolean; lab: { ok: boolean; reason?: string; altHref?: string } }
const LIST = process.argv.includes('--list')
const SUB = '₀₁₂₃₄₅₆₇₈₉'
const norm = (f: string) => f.replace(/[₀-₉]/g, (d) => String(SUB.indexOf(d))).replace(/[↑↓\s]/g, '').replace(/·/g, '*').replace(/[‐‑–—]/g, '-')

/** Брутто-состав формулы (скобки, гидраты); null — не формула. */
function counts(f0: string): Record<string, number> | null {
  const f = norm(f0).replace(/[-=≡]/g, '').replace(/\((тв|г|ж|р-р|aq|s|g|l|конц|разб)\.?\)$/i, '')
  if (!/^[A-Z(\[]/.test(f)) return null
  const out: Record<string, number> = {}
  for (const part0 of f.split('*')) {
    const m0 = /^(\d+)(.*)$/.exec(part0)
    const k0 = m0 ? Number(m0[1]) : 1
    const part = m0 ? m0[2]! : part0
    const stack: Record<string, number>[] = [{}]
    const re = /([A-Z][a-z]?|\(|\)|\[|\])(\d*)/g
    let m: RegExpExecArray | null
    let consumed = 0
    while ((m = re.exec(part))) {
      if (m.index !== consumed) return null
      consumed = m.index + m[0].length
      const [, tok, num] = m
      if (tok === '(' || tok === '[') stack.push({})
      else if (tok === ')' || tok === ']') {
        const top = stack.pop()
        if (!top || !stack.length) return null
        for (const [e, c] of Object.entries(top)) stack[stack.length - 1]![e] = (stack[stack.length - 1]![e] ?? 0) + c * (num ? Number(num) : 1)
      } else stack[stack.length - 1]![tok!] = (stack[stack.length - 1]![tok!] ?? 0) + (num ? Number(num) : 1)
    }
    if (consumed !== part.length || stack.length !== 1) return null
    for (const [e, c] of Object.entries(stack[0]!)) out[e] = (out[e] ?? 0) + c * k0
  }
  return Object.keys(out).length ? out : null
}
const key = (c: Record<string, number>) => Object.keys(c).sort().map((e) => e + c[e]).join('')

/** Вещества уравнения (без ионов, e⁻, радикалов, общих схем). */
function species(eq: string): string[] {
  const s = eq.replace(/\s*\(([^)]*)\)\s*$/, '')
  // «=» — стрелка только там, где нет настоящей стрелки: иначе это двойная связь (CH₂=CH₂)
  const hasArrow = /→|->|⇄|⇌|<=>|<->/.test(s)
  const parts = s.split(hasArrow ? /\s*(?:→|->|⇄|⇌|<=>|<->)\s*/ : /\s*=\s*/)
  if (parts.length < 2) return []
  const out: string[] = []
  for (const side of parts) for (const t of side.split(/\s\+\s/)) {
    const x = t.trim().replace(/^\d+\s*/, '').replace(/^n(?=[A-Z(])/, '')
    if (!x || /\^|[⁺⁻•·]$|e\^?-|^e[⁻-]$|\bR\b|Me|Hal|\bn\b|ₙ|\)n$/.test(x) || /[⁰¹²³⁴⁵⁶⁷⁸⁹]/.test(x)) continue
    out.push(x)
  }
  return out
}

// ── индексы каталога ──
type Cat = { id: string; formula: string; visible: boolean; hidden: boolean }
const byKey = new Map<string, Cat[]>()
for (const c of Object.values(compoundById) as { id: string; formulaUnicode: string }[]) {
  const k = counts(c.formulaUnicode ?? '')
  if (!k) continue
  const e = { id: c.id, formula: c.formulaUnicode, visible: isCatalogVisibleId(c.id), hidden: CATALOG_HIDDEN_IDS.has(c.id) }
  byKey.set(key(k), [...(byKey.get(key(k)) ?? []), e])
}
const orgByKey = new Map<string, string[]>()
for (const [id, m] of Object.entries(organicMoleculeById as unknown as Record<string, { formula?: string; formulaUnicode?: string; graph?: { atoms: { element: string }[] } }>)) {
  let k: string | null = null
  const f = m.formula ?? m.formulaUnicode
  if (f) { const c = counts(f); if (c) k = key(c) }
  if (!k && m.graph) { const c: Record<string, number> = {}; for (const a of m.graph.atoms) c[a.element] = (c[a.element] ?? 0) + 1; k = key(c) }
  if (k) orgByKey.set(k, [...(orgByKey.get(k) ?? []), id])
}

// ── обход книг ──
const report: Record<string, unknown> = {}
const allSpecies = new Map<string, { formula: string; grades: Set<number>; status: string }>()
for (const g of [7, 8, 9, 10, 11]) {
  const book = JSON.parse(fs.readFileSync(`src/data/textbook/equations-g${g}.json`, 'utf8')) as { units: { unitId: string; kp: string; reactions: Rx[] }[] }
  const rx = book.units.flatMap((u) => u.reactions.map((r) => ({ ...r, unit: u.unitId, kp: u.kp })))
  const reasons: Record<string, number> = {}
  for (const r of rx) if (!r.lab.ok) reasons[r.lab.reason ?? '?'] = (reasons[r.lab.reason ?? '?'] ?? 0) + 1
  const organicLinked = rx.filter((r) => !r.lab.ok && r.lab.altHref).length
  report[`g${g}`] = { total: rx.length, reactor: rx.filter((r) => r.lab.ok).length, notReactor: reasons, organicLabLinked: organicLinked }
  for (const r of rx) {
    if (r.isGeneralScheme) continue
    for (const sp of species(r.equationAscii || r.equation)) {
      const c = counts(sp)
      if (!c) continue
      const k = key(c)
      const cur = allSpecies.get(k) ?? { formula: sp, grades: new Set<number>(), status: '' }
      cur.grades.add(g)
      const cat = byKey.get(k)
      const org = orgByKey.get(k)
      const isSimple = Object.keys(c).length === 1
      cur.status = cat?.some((x) => x.visible) ? 'catalog-visible' : org ? 'organic-registry' : cat?.length ? (cat.every((x) => x.hidden) ? 'catalog-hidden' : 'catalog-demoted') : isSimple ? 'simple-substance' : 'missing'
      allSpecies.set(k, cur)
    }
  }
}
const statuses: Record<string, number> = {}
for (const s of allSpecies.values()) statuses[s.status] = (statuses[s.status] ?? 0) + 1
report.substances = { unique: allSpecies.size, byStatus: statuses }
fs.mkdirSync('.smoke', { recursive: true })
fs.writeFileSync('.smoke/coverage-books.json', JSON.stringify({ ...report, list: [...allSpecies.values()].map((s) => ({ ...s, grades: [...s.grades] })) }, null, 2))
for (const g of [7, 8, 9, 10, 11]) console.log(`g${g}:`, JSON.stringify(report[`g${g}`]))
console.log('вещества:', JSON.stringify(report.substances))
if (LIST) for (const st of ['missing', 'catalog-demoted', 'catalog-hidden', 'simple-substance']) {
  const xs = [...allSpecies.values()].filter((s) => s.status === st)
  console.log(`\n${st} (${xs.length}):`, xs.map((s) => s.formula).join(' '))
}
