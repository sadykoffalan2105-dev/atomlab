/**
 * Простые вещества из реакций учебников 7–11 (Zn, Fe, Cu, C, S, P …): классы и первая страница.
 * Пишет src/data/catalog/simpleSubstances.generated.ts — карточки «Простые вещества» каталога.
 * Молекулы-простые вещества (H₂, O₂, O₃, N₂, галогены, P₄, S₈) уже есть в каталоге неорганики и сюда не входят;
 * «[H]» и «O» — атомарные обозначения (водород-восстановитель, кислород при электролизе), это не отдельные вещества.
 *
 * Запуск: npx tsx scripts/textbook-inventory/gen-simple-substances.mts
 */
import fs from 'node:fs'
import { getElementBySymbol } from '../../src/data/elements.ts'
import { ATOMIC_NOTATION_ALIAS, collectBookSpecies } from '../plan/bookSpecies.mts'

type Row = { symbol: string; z: number; grades: number[]; firstPage: Record<number, number> }
const rows: Row[] = []
for (const sp of collectBookSpecies().values()) {
  const els = Object.keys(sp.counts)
  if (els.length !== 1 || sp.counts[els[0]!] !== 1 || ATOMIC_NOTATION_ALIAS[sp.key]) continue
  const el = getElementBySymbol(els[0]!)
  if (!el) throw new Error(`нет элемента ${els[0]} (${sp.formula})`)
  rows.push({
    symbol: el.symbol,
    z: el.z,
    grades: [...sp.grades].sort((a, b) => a - b),
    firstPage: Object.fromEntries([...sp.firstPage.entries()].sort((a, b) => a[0] - b[0])),
  })
}
rows.sort((a, b) => a.z - b.z)

const body = rows.map((r) => `  ${JSON.stringify(r)},`).join('\n')
fs.mkdirSync('src/data/catalog', { recursive: true })
fs.writeFileSync(
  'src/data/catalog/simpleSubstances.generated.ts',
  `// Сгенерировано scripts/textbook-inventory/gen-simple-substances.mts — не редактировать вручную.
// Простые вещества (одноатомная запись в уравнении: Zn, Fe, C, S, P …) из реакций учебников «Химия» 7–11.

export type BookSimpleSubstanceRow = {
  symbol: string
  z: number
  /** Классы, в реакциях которых стоит вещество. */
  grades: readonly (7 | 8 | 9 | 10 | 11)[]
  /** Первая страница учебника по классам. */
  firstPage: Readonly<Partial<Record<7 | 8 | 9 | 10 | 11, number>>>
}

export const BOOK_SIMPLE_SUBSTANCE_ROWS: readonly BookSimpleSubstanceRow[] = [
${body}
]
`,
)
console.log(`simple substances: ${rows.length} — ${rows.map((r) => `${r.symbol}(${r.grades.join(',')})`).join(' ')}`)
