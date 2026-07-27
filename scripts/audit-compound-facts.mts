/**
 * Аудит покрытия фактов (добыча, применение, важность) для каталога.
 * Запуск: npx tsx scripts/audit-compound-facts.mts
 */
import { compoundById } from '../src/data/compounds.ts'

const all = Object.values(compoundById)
const missing: string[] = []
const short: string[] = []

for (const c of all) {
  const f = c.factsRu
  if (!f?.source?.trim() || !f?.usage?.trim() || !f?.importance?.trim()) {
    missing.push(c.id)
    continue
  }
  const minLen = Math.min(f.source.length, f.usage.length, f.importance.length)
  if (minLen < 30) short.push(`${c.id} (min ${minLen})`)
}

console.log(`Total compounds: ${all.length}`)
console.log(`Missing facts: ${missing.length}`)
console.log(`Short facts (<30 chars): ${short.length}`)
if (missing.length) {
  console.log('\nMissing:', missing.slice(0, 20).join(', '), missing.length > 20 ? '...' : '')
}
if (short.length) {
  console.log('\nShort:', short.slice(0, 15).join(', '), short.length > 15 ? '...' : '')
}
process.exit(missing.length > 0 ? 1 : 0)
