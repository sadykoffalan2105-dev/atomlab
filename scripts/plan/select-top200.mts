/**
 * 200 неорганических веществ каталога — самые употребительные в школьной химии и её реакциях (решение владельца 30.09.2026).
 *
 * Отбор воспроизводимый: берётся рейтинг школьной значимости src/data/textbook/catalogRank.json
 * (scripts/textbook-inventory/rank-substances.mts — параграфы учебников 7–11, выверенные уравнения, банк школьных
 * реакций, класс вещества, ручной «обязательный» список) и из него — первые 200 НЕОРГАНИЧЕСКИХ веществ. Соли
 * органических кислот, феноляты и галогенпроизводные углеводородов (CH₃COONa, C₆H₅ONa, CCl₄ …) — органика, их
 * пропускаем. Остальные вещества НЕ удаляются: они скрыты из каталога, но остаются в данных (реактор, уравнения книг).
 *
 * Run: npx tsx scripts/plan/select-top200.mts [--write]
 */
import fs from 'node:fs'
import rank from '../../src/data/textbook/catalogRank.json' with { type: 'json' }
import { compoundById } from '../../src/data/compounds.ts'

/** Органические по природе вещества, попавшие в неорганический рейтинг (есть связь C–H или C–Cl в углеводородном скелете). */
const ORGANIC_NATURE = new Set(['CH₃COONa', 'C₆H₅ONa', 'CCl₄'])
const isOrganicNature = (formula: string) =>
  ORGANIC_NATURE.has(formula) || /C\d*H|COO|C₆H|CH₃|C₂H|C₁/.test(formula.replace(/[₀-₉]/g, (d) => String('₀₁₂₃₄₅₆₇₈₉'.indexOf(d))).replace(/(\d)/g, '$1'))

const picked: string[] = []
for (const id of rank.rankedInorganic as string[]) {
  const c = compoundById[id] as { formulaUnicode?: string } | undefined
  if (!c) continue
  const f = c.formulaUnicode ?? id
  if (isOrganicNature(f)) continue
  picked.push(id)
  if (picked.length === 200) break
}
if (picked.length !== 200) throw new Error(`отобрано ${picked.length}, нужно 200`)
console.log(picked.map((id) => (compoundById[id] as { formulaUnicode?: string }).formulaUnicode).join(' '))
if (process.argv.includes('--write')) {
  const body = `/**
 * 200 неорганических веществ каталога (порядок — школьная значимость). Сгенерировано: npx tsx scripts/plan/select-top200.mts --write
 * Остальные неорганические вещества скрыты из каталога, но остаются в данных приложения (реактор, уравнения учебников).
 */
export const CATALOG_TOP200_IDS: readonly string[] = ${JSON.stringify(picked, null, 2)}

export const CATALOG_TOP200: ReadonlySet<string> = new Set(CATALOG_TOP200_IDS)
`
  fs.writeFileSync('src/data/catalog/catalogTop200.ts', body)
  console.log('записано src/data/catalog/catalogTop200.ts')
}
