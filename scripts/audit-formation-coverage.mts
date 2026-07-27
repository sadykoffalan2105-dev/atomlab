/**
 * Аудит покрытия маршрутов получения для всех 434 веществ каталога.
 * Запуск: npx tsx scripts/audit-formation-coverage.mts
 */
import { compoundById } from '../src/data/compounds.ts'
import { listCuratedObtainingIds } from '../src/chemistry/substanceObtaining.ts'
import { fromElementsPolicy } from '../src/chemistry/substanceSynthesisRoute.ts'

const curated = new Set(listCuratedObtainingIds())
const all = Object.values(compoundById)

type Tier = 'curated' | 'multi_step' | 'single_step' | 'missing'

const tiers: Record<Tier, number> = {
  curated: 0,
  multi_step: 0,
  single_step: 0,
  missing: 0,
}

const issues: string[] = []
const byCategory: Record<string, { total: number; multi: number }> = {}

for (const c of all) {
  const steps = c.obtainingStepsRu?.length ?? 0
  const cat = c.category
  byCategory[cat] = byCategory[cat] ?? { total: 0, multi: 0 }
  byCategory[cat].total++
  if (steps > 1) byCategory[cat].multi++

  if (!c.laboratoryRecipeRu?.trim()) {
    issues.push(`${c.id}: пустой laboratoryRecipeRu`)
    tiers.missing++
    continue
  }
  if (!c.obtainingStepsRu?.length) {
    issues.push(`${c.id}: нет obtainingStepsRu`)
    tiers.missing++
    continue
  }

  if (curated.has(c.id)) {
    tiers.curated++
  } else if (steps > 1) {
    tiers.multi_step++
  } else {
    tiers.single_step++
    // Для forbidden — одностадийный маршрут подозрителен
    if (fromElementsPolicy(c.id) === 'forbidden' && !c.laboratoryRecipeRu.includes('Маршрут')) {
      issues.push(`${c.id}: forbidden, но только 1 этап и нет «Маршрут»`)
    }
  }

  if (!c.synthesisConditionsRu?.temperature) {
    issues.push(`${c.id}: нет условий температуры`)
  }
}

console.log('=== Formation coverage audit ===\n')
console.log(`Всего веществ: ${all.length}`)
console.log(`Кураторские (CURATED): ${tiers.curated}`)
console.log(`Многоэтапные шаблоны: ${tiers.multi_step}`)
console.log(`Одноэтапные (из элементов): ${tiers.single_step}`)
console.log(`Проблемы: ${tiers.missing}`)
console.log('\nПо категориям (всего / многоэтапных):')
for (const [cat, v] of Object.entries(byCategory).sort()) {
  console.log(`  ${cat}: ${v.total} / ${v.multi}`)
}

if (issues.length) {
  console.log(`\nПредупреждения (${issues.length}):`)
  for (const i of issues.slice(0, 30)) console.warn('  ', i)
  if (issues.length > 30) console.warn(`  ... и ещё ${issues.length - 30}`)
}

const coverage = ((tiers.curated + tiers.multi_step) / all.length) * 100
console.log(`\nПокрытие многоэтапными маршрутами: ${coverage.toFixed(1)}%`)

if (tiers.missing > 0) process.exit(1)
console.log('OK')
