// dump: definitions without uz term (first 4 per non-review unit) — deduped by stems
import fs from 'node:fs'
import { analyzeTerms } from '../src/learn/kb/analyzer.ts'
const m = JSON.parse(fs.readFileSync(process.argv[2]!, 'utf8'))
const seen = new Map<string, { term: string; units: string[]; text: string }>()
let n = 0
for (const g of Object.keys(m.grades))
  for (const u of m.grades[g].units) {
    if (u.kind === 'review') continue
    for (const d of (u.definitions ?? []).slice(0, 4)) {
      if (d.term.uz) continue
      n++
      const k = analyzeTerms(d.term.ru).join(' ')
      const e = seen.get(k) ?? { term: d.term.ru, units: [], text: d.text.ru.slice(0, 110).replace(/\s+/g, ' ') }
      e.units.push(u.id)
      seen.set(k, e)
    }
  }
console.log('missing', n, 'unique', seen.size)
for (const [k, e] of seen) console.log(`${e.term} ‖ ${k} ‖ ${e.units.join(',')} ‖ ${e.text}`)
