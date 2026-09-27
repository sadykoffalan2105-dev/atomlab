/**
 * Покрытие книг 7–11 классов: (1) каждая реакция каталога «Реакции учебника» открывается в реакторе;
 * (2) каждое вещество из этих реакций есть в каталоге веществ, видно ученику и показано в каталоге своего класса.
 * Запуск: npx tsx scripts/plan/coverage-books.mts [--list] → сводка; .smoke/coverage-books.json — подробно.
 * Строгая проверка веществ — scripts/test-catalog-textbook-substances.mts.
 */
import fs from 'node:fs'
import { compoundById } from '../../src/data/compounds'
import { inorganicGradesForId, organicGradesForMolecule } from '../../src/data/curriculum/compoundGradeIndex'
import { isCatalogVisibleId } from '../../src/data/textbook/catalogWhitelist'
import { ORGANIC_MOLECULES } from '../../src/data/organicLab/organicMoleculeRegistry'
import { ATOMIC_NOTATION_ALIAS, BOOK_GRADES, collectBookSpecies, compositionKey, readBook } from './bookSpecies.mts'

const LIST = process.argv.includes('--list')

// ── индексы каталога ──
const inorgByKey = new Map<string, string[]>()
for (const c of Object.values(compoundById)) {
  const k = compositionKey(c.composition as Record<string, number>)
  inorgByKey.set(k, [...(inorgByKey.get(k) ?? []), c.id])
}
const orgByKey = new Map<string, (typeof ORGANIC_MOLECULES)[number][]>()
for (const m of ORGANIC_MOLECULES) {
  const c: Record<string, number> = {}
  for (const a of m.graph.atoms) c[a.element] = (c[a.element] ?? 0) + 1
  const k = compositionKey(c)
  orgByKey.set(k, [...(orgByKey.get(k) ?? []), m])
}

// ── реакции ──
const report: Record<string, unknown> = {}
for (const g of BOOK_GRADES) {
  const rx = readBook(g).flatMap((u) => u.reactions)
  const reasons: Record<string, number> = {}
  for (const r of rx) if (!r.lab.ok) reasons[r.lab.reason ?? '?'] = (reasons[r.lab.reason ?? '?'] ?? 0) + 1
  const organicLinked = rx.filter((r) => !r.lab.ok && r.lab.altHref).length
  report[`g${g}`] = { total: rx.length, reactor: rx.filter((r) => r.lab.ok).length, notReactor: reasons, organicLabLinked: organicLinked }
}

// ── вещества ──
type Row = { formula: string; grades: number[]; status: string; ids: string[] }
const rows: Row[] = []
for (const sp of collectBookSpecies().values()) {
  const grades = [...sp.grades].sort((a, b) => a - b)
  const key = ATOMIC_NOTATION_ALIAS[sp.key] ?? sp.key
  const inorg = inorgByKey.get(key) ?? []
  const org = orgByKey.get(key) ?? []
  const els = Object.keys(sp.counts)
  // простые вещества — в таблице Менделеева, в каталог веществ не входят (решение владельца, 27.09.2026)
  const simple = els.length === 1 && sp.counts[els[0]!] === 1 && key === sp.key ? els[0]! : undefined
  let status: string
  let ids: string[] = []
  if (inorg.length) {
    const vis = inorg.filter(isCatalogVisibleId)
    ids = inorg
    status = !vis.length
      ? 'catalog-hidden'
      : grades.every((g) => vis.some((id) => inorganicGradesForId(id).includes(g as 7)))
        ? 'catalog-visible'
        : 'catalog-wrong-grade'
  } else if (org.length) {
    const vis = org.filter((m) => isCatalogVisibleId(m.id))
    ids = org.map((m) => m.id)
    status = !vis.length
      ? 'organic-hidden'
      : grades.every((g) => vis.some((m) => organicGradesForMolecule(m).includes(g as 7)))
        ? 'organic-visible'
        : 'organic-wrong-grade'
  } else if (simple) {
    ids = [simple]
    status = 'simple-periodic-table'
  } else status = els.length === 1 ? 'simple-no-card' : 'missing'
  rows.push({ formula: sp.formula, grades, status, ids })
}
const statuses: Record<string, number> = {}
for (const r of rows) statuses[r.status] = (statuses[r.status] ?? 0) + 1
report.substances = { unique: rows.length, byStatus: statuses }
fs.mkdirSync('.smoke', { recursive: true })
fs.writeFileSync('.smoke/coverage-books.json', JSON.stringify({ ...report, list: rows }, null, 2))
for (const g of BOOK_GRADES) console.log(`g${g}:`, JSON.stringify(report[`g${g}`]))
console.log('вещества:', JSON.stringify(report.substances))
if (LIST) {
  for (const st of Object.keys(statuses).sort()) {
    if (st === 'catalog-visible' || st === 'organic-visible') continue
    const xs = rows.filter((r) => r.status === st)
    console.log(`\n${st} (${xs.length}):`, xs.map((r) => r.formula).join(' '))
  }
}
