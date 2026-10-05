/**
 * Органика v2 — «где в учебнике» для карточки молекулы: страницы и параграфы Kimyo 10/11.
 * Источники: реакции учебника (reactions.json: source.page/section — маршруты получения и свойства молекулы)
 * и прямые ссылки реестра («Учебник, с. 44», «10 класс — «…» (с. 68)»).
 * Запуск: npx tsx scripts/organic-v2/gen-book-refs.mts → src/data/organicV2/bookRefs.json
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { organicMoleculeById } from '../../src/data/organicLab/organicMoleculeRegistry'
import { organicBuildChallengeById } from '../../src/data/researchLab/organicBuildCatalog'

interface Src { grade: 10 | 11; page?: number; section?: string }
const mols = JSON.parse(readFileSync('src/data/organicV2/molecules.json', 'utf8')) as Record<string, unknown>
const rx = JSON.parse(readFileSync('src/data/organicV2/reactions.json', 'utf8')) as {
  reactions: { id: string; source: Src; generic?: boolean }[]
  routes: Record<string, string[]>
  uses: Record<string, string[]>
}
const byId = new Map(rx.reactions.map((r) => [r.id, r]))

type Ref = { p: number[]; s: string[] }
const out: Record<string, { 10?: Ref; 11?: Ref }> = {}
const add = (id: string, g: 10 | 11, page?: number, sec?: string) => {
  const o = (out[id] ??= {})
  const r = (o[g] ??= { p: [], s: [] })
  if (page && !r.p.includes(page)) r.p.push(page)
  if (sec && !r.s.includes(String(sec))) r.s.push(String(sec))
}

for (const id of Object.keys(mols)) {
  // прямые ссылки реестра — первыми
  const d = organicMoleculeById[id]
  const c = organicBuildChallengeById(id)
  const text = `${c?.hintRu ?? ''} ${d?.descriptionRu ?? ''}`
  for (const m of text.matchAll(/(\d+) класс — «[^»]+» \(с\. (\d+)/g)) {
    const g = Number(m[1])
    if (g === 10 || g === 11) add(id, g, Number(m[2]))
  }
  for (const m of text.matchAll(/Учебник,? с\. (\d+)/g)) add(id, (d?.grade === 'g11' ? 11 : 10) as 10 | 11, Number(m[1]))
  for (const rid of [...(rx.routes[id] ?? []), ...(rx.uses[id] ?? [])]) {
    const r = byId.get(rid)
    if (!r || r.generic) continue
    add(id, r.source.grade, r.source.page, r.source.section)
  }
  const o = out[id]
  if (o) for (const g of [10, 11] as const) {
    const r = o[g]
    if (!r) continue
    const first = r.p[0]
    r.p = [...new Set(r.p)].sort((a, b) => a - b)
    // первая (прямая) ссылка остаётся в списке, даже если страниц много
    if (r.p.length > 6) r.p = [...new Set([first!, ...r.p])].slice(0, 6).sort((a, b) => a - b)
    r.s = r.s.map(String).sort((a, b) => a.localeCompare(b, 'en', { numeric: true })).slice(0, 4)
  }
}
writeFileSync('src/data/organicV2/bookRefs.json', JSON.stringify(out) + '\n')
const n = Object.keys(out).length
console.log(`bookRefs: ${n} из ${Object.keys(mols).length} молекул со ссылкой на учебник`)
for (const id of Object.keys(mols)) if (!out[id]) console.log('  без ссылки:', id)
