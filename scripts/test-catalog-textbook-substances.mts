/**
 * Каталог веществ ⊇ вещества реакций учебников 7–11.
 *
 * Для каждого вещества из реакций книг (src/data/textbook/equations-gN.json, без общих схем) проверяет:
 *  1) оно есть в каталоге: неорганика (compoundById), органика (ORGANIC_MOLECULES) или простое вещество
 *     (карточка BOOK_SIMPLE_SUBSTANCES); атомарные обозначения «[H]», «O» — это H₂ и O₂;
 *  2) оно видно ученику (не в CATALOG_HIDDEN_IDS);
 *  3) оно показано в каталоге своего класса (фильтр «N класс» его находит);
 *  4) у неорганики есть 3D-модель (атомы), у органики — граф; брутто-формула = формуле учебника;
 *  5) у простого вещества есть элемент в таблице Менделеева и модель (решётка из crystalData или атом/молекула).
 *
 * Run: npx tsx scripts/test-catalog-textbook-substances.mts [--list]
 */
import { compoundById } from '../src/data/compounds.ts'
import { inorganicGradesForId, organicGradesForMolecule } from '../src/data/curriculum/compoundGradeIndex.ts'
import { ORGANIC_MOLECULES } from '../src/data/organicLab/organicMoleculeRegistry.ts'
import { isCatalogVisibleId } from '../src/data/textbook/catalogWhitelist.ts'
import { CATALOG_TOP200 } from '../src/data/catalog/catalogTop200.ts'
import { getElementBySymbol } from '../src/data/elements.ts'
import { ATOMIC_NOTATION_ALIAS, collectBookSpecies, compositionKey, formulaCounts } from './plan/bookSpecies.mts'

const LIST = process.argv.includes('--list')
const problems: string[] = []

const inorgByKey = new Map<string, string[]>()
for (const c of Object.values(compoundById)) {
  const k = compositionKey(c.composition as Record<string, number>)
  inorgByKey.set(k, [...(inorgByKey.get(k) ?? []), c.id])
}
const orgByKey = new Map<string, string[]>()
for (const m of ORGANIC_MOLECULES) {
  const counts: Record<string, number> = {}
  for (const a of m.graph.atoms) counts[a.element] = (counts[a.element] ?? 0) + 1
  const k = compositionKey(counts)
  orgByKey.set(k, [...(orgByKey.get(k) ?? []), m.id])
  // брутто-формула карточки = составу 3D-графа
  const f = formulaCounts(m.formula)
  if (f && compositionKey(f) !== k && isCatalogVisibleId(m.id)) problems.push(`органика ${m.id}: формула ${m.formula} ≠ составу графа ${k}`)
}
const orgById = new Map(ORGANIC_MOLECULES.map((m) => [m.id, m]))

const stats = { total: 0, inorganic: 0, organic: 0, simple: 0, atomic: 0, outsideTop200: 0 }
const rows: string[] = []
for (const sp of collectBookSpecies().values()) {
  stats.total++
  const grades = [...sp.grades].sort()
  const key = ATOMIC_NOTATION_ALIAS[sp.key] ?? sp.key
  if (key !== sp.key) stats.atomic++
  const inorg = inorgByKey.get(key) ?? []
  const org = orgByKey.get(key) ?? []
  const els = Object.keys(sp.counts)
  // Простые вещества (Zn, Fe, S …) в каталог веществ не входят по решению владельца (27.09.2026): их карточки —
  // элементы таблицы Менделеева. Проверяем только, что элемент там есть.
  const simple = els.length === 1 && sp.counts[els[0]!] === 1 && key === sp.key ? els[0]! : undefined
  if (inorg.length) {
    stats.inorganic++
    const vis = inorg.filter(isCatalogVisibleId)
    // 30.09.2026: неорганика в каталоге — только 200 самых употребительных (catalogTop200.ts); остальное скрыто
    // намеренно, но остаётся в данных (реактор, уравнения учебника)
    if (!vis.length && inorg.some((id) => !CATALOG_TOP200.has(id))) {
      stats.outsideTop200++
      rows.push(`hidden ${sp.formula.padEnd(22)} ${inorg.join(',')} — вне 200`)
      continue
    }
    if (!vis.length) problems.push(`${sp.formula}: в каталоге есть (${inorg.join(', ')}), но скрыто`)
    for (const g of grades) {
      if (!vis.some((id) => inorganicGradesForId(id).includes(g as 7))) problems.push(`${sp.formula}: не показано в каталоге ${g} класса (${vis.join(', ')})`)
    }
    for (const id of vis) if (!compoundById[id]!.atoms?.length) problems.push(`${sp.formula}: у ${id} нет 3D-модели`)
    rows.push(`inorg  ${sp.formula.padEnd(22)} ${inorg.join(',')}  g${grades.join(',')}`)
  } else if (org.length) {
    stats.organic++
    const vis = org.filter(isCatalogVisibleId)
    if (!vis.length) problems.push(`${sp.formula}: в органике есть (${org.join(', ')}), но скрыто`)
    for (const g of grades) {
      if (!vis.some((id) => organicGradesForMolecule(orgById.get(id)!).includes(g as 7))) problems.push(`${sp.formula}: органика не показана в каталоге ${g} класса (${vis.join(', ')})`)
    }
    rows.push(`org    ${sp.formula.padEnd(22)} ${org.join(',')}  g${grades.join(',')}`)
  } else if (simple) {
    stats.simple++
    if (!getElementBySymbol(simple)) problems.push(`простое вещество ${simple}: нет элемента в таблице Менделеева`)
    rows.push(`simple ${sp.formula.padEnd(22)} → таблица Менделеева  g${grades.join(',')}`)
  } else {
    problems.push(`${sp.formula} (g${grades.join(',')}): нет в каталоге`)
  }
}

if (LIST) for (const r of rows) console.log(r)
console.log(
  `веществ в реакциях книг: ${stats.total} — неорганика ${stats.inorganic}, органика ${stats.organic}, простые ${stats.simple} — в таблице Менделеева, не в каталоге (атомарные обозначения ${stats.atomic}); неорганика вне 200 (скрыта, в данных есть): ${stats.outsideTop200}`,
)
if (problems.length) {
  console.error(`\n${problems.length} проблем(ы):`)
  for (const p of problems) console.error(`  ✗ ${p}`)
  process.exit(1)
}
console.log('test-catalog-textbook-substances: каждое вещество реакций книг 7–11 есть в каталоге своего класса')
