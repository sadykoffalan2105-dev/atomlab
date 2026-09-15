/**
 * Knowledge-base retrieval evaluation.
 *
 *   npx tsx scripts/kb/eval.mts                 new index: all questions, with/without grade, Q and Q+A variants
 *   npx tsx scripts/kb/eval.mts --compare       + compare with the old retriever on the sample produced by
 *                                               `npx tsx scripts/kb/eval-old.mts` (slow, run it first)
 *   options: --tuning '{"k1":1.4}'  --misses 20  --json <file>
 *
 * A question counts as a hit at k when any of the top-k results belongs to one of its gold sections.
 * Only questions whose gold section has chunks in the index are scored ("answerable"); the number of
 * unanswerable questions is printed. Latency is measured per search() call after a warm-up pass.
 */
import fs from 'node:fs'
import path from 'node:path'
import { buildEvalSet } from './lib/evalSet.mts'
import { formatTable, indexedSections, loadEngine, metrics, runItems, summarize, type ItemResult } from './lib/evalRun.mts'

const args = process.argv.slice(2)
const arg = (name: string) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}
const tuning = arg('tuning') ? (JSON.parse(arg('tuning')!) as Record<string, unknown>) : {}
const showMisses = Number(arg('misses') ?? 0)

const { engine, loadMs } = loadEngine(tuning)
const { items: all, stats } = buildEvalSet()
const sections = indexedSections(engine)
const items = all.filter((i) => i.gold.some((g) => sections.has(g)))
console.log(`[eval] questions: ${all.length} (${JSON.stringify(stats)}), answerable: ${items.length}, unanswerable: ${all.length - items.length}`)
console.log(
  `[eval] index load (JSON.parse + addShard, ms): ${Object.entries(loadMs)
    .map(([k, v]) => `${k} ${v.toFixed(0)}`)
    .join(', ')}`,
)

// warm-up (JIT, analyzer caches)
runItems(engine, items.slice(0, 80), { useGrade: true, variant: 'q' })

const report: Record<string, unknown> = { loadMs, questions: all.length, answerable: items.length }
let main: ItemResult[] = []
for (const [label, useGrade, variant] of [
  ['question, grade given', true, 'q'],
  ['question, no grade', false, 'q'],
  ['question + answer, grade given', true, 'qa'],
] as const) {
  const res = runItems(engine, items, { useGrade, variant })
  if (label === 'question, grade given') main = res
  const rows = summarize(res)
  console.log('\n' + formatTable(`== NEW index: ${label}`, rows))
  report[label] = Object.fromEntries(rows)
}

if (showMisses) {
  console.log(`\n[eval] sample misses (question, grade given):`)
  for (const r of main.filter((x) => x.rank === 0).slice(0, showMisses)) {
    console.log(`  ${r.item.id} [${r.item.lang}] gold=${r.item.gold.join(',')} top=${r.top.join(',')} | ${r.item.query}`)
  }
}

if (args.includes('--compare')) {
  const oldFile = path.join(import.meta.dirname, '.cache', 'eval-old-results.json')
  if (!fs.existsSync(oldFile)) {
    console.log(`\n[eval] --compare: ${oldFile} missing — run: npx tsx scripts/kb/eval-old.mts`)
  } else {
    const old = JSON.parse(fs.readFileSync(oldFile, 'utf8')) as { results: { id: string; lang: string; rank: number; ans?: number; ms: number }[] }
    const byId = new Map(main.map((r) => [`${r.item.id}|${r.item.lang}`, r]))
    const pairs = old.results.map((o) => ({ o, n: byId.get(`${o.id}|${o.lang}`) })).filter((p) => p.n)
    const groups: [string, (p: (typeof pairs)[number]) => boolean][] = [
      ['g7 ru', (p) => p.n!.item.grade === 7 && p.n!.item.lang === 'ru'],
      ['g8 ru', (p) => p.n!.item.grade === 8 && p.n!.item.lang === 'ru'],
      ['g9 ru', (p) => p.n!.item.grade === 9 && p.n!.item.lang === 'ru'],
      ['g10-11 ru', (p) => p.n!.item.grade >= 10 && p.n!.item.lang === 'ru'],
      ['cards', (p) => p.n!.item.id.startsWith('card-')],
      ['en', (p) => p.n!.item.lang === 'en'],
      ['uz', (p) => p.n!.item.lang === 'uz'],
      ['ALL', () => true],
    ]
    const oldRows: [string, ReturnType<typeof metrics>][] = []
    const newRows: [string, ReturnType<typeof metrics>][] = []
    for (const [name, pred] of groups) {
      const sub = pairs.filter(pred)
      if (!sub.length) continue
      oldRows.push([name, metrics(sub.map((p) => ({ rank: p.o.rank, ans: p.o.ans ?? -1, ms: p.o.ms })))])
      newRows.push([name, metrics(sub.map((p) => ({ rank: p.n!.rank, ans: p.n!.ans, ms: p.n!.ms })))])
    }
    console.log(`\n` + formatTable(`== OLD retriever (retrieveChemistryKnowledge) on ${pairs.length}-question sample`, oldRows))
    console.log(`\n` + formatTable(`== NEW index on the same sample`, newRows))
    report.compare = { sample: pairs.length, old: Object.fromEntries(oldRows), new: Object.fromEntries(newRows) }
  }
}

const jsonOut = arg('json')
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(report, null, 2))
