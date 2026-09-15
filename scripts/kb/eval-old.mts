/**
 * Baseline: the OLD retriever (src/learn/learnKnowledgeRetrieval.ts → retrieveChemistryKnowledge, which
 * loads the ~155 MB mega pack) on a stratified sample of the evaluation questions.
 * It takes ~15 s to load and 2–40 s per query, so the sample is split across worker processes.
 *
 *   npx tsx scripts/kb/eval-old.mts [--sample 128] [--workers 2]
 *   → scripts/kb/.cache/eval-old-results.json, then: npx tsx scripts/kb/eval.mts --compare
 * Resumable: finished questions are kept in .cache/eval-old-done.json (merged from the per-worker part files
 * on every start), so an interrupted run continues where it stopped. Delete that file to re-measure.
 * Each worker needs ~0.8–1 GB of RAM; on a loaded machine fewer workers finish sooner.
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { buildEvalSet, type EvalItem } from './lib/evalSet.mts'
import { answerRank, indexedSections, loadEngine } from './lib/evalRun.mts'
import { fnv1a } from './lib/holdout.mts'

const CACHE = path.join(import.meta.dirname, '.cache')
fs.mkdirSync(CACHE, { recursive: true })
const args = process.argv.slice(2)
const arg = (name: string, def: string) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : def
}

type OldResult = { id: string; lang: string; grade: number; rank: number; ans: number; ms: number; top: string[] }

function oldSectionKey(chunk: { id: string; textbook?: { gradeId: string; chapterId: string; sectionId: string } }): string | null {
  if (chunk.textbook) return `${chunk.textbook.gradeId}-${chunk.textbook.chapterId}-${chunk.textbook.sectionId}`
  const direct = /^(g(?:7|8|9|10|11))-(c\d+)-(s\d+)/.exec(chunk.id)
  if (direct) return `${direct[1]}-${direct[2]}-${direct[3]}`
  const mega = /(g(?:7|8|9|10|11))-c\d+-.*?-(c\d+)-(s\d+)/.exec(chunk.id)
  if (mega) return `${mega[1]}-${mega[2]}-${mega[3]}`
  return null
}

const DONE_FILE = path.join(CACHE, 'eval-old-done.json')
type DoneFile = { loadMs: number[]; results: Record<string, OldResult> }

/** Merge per-worker part files into the done file and delete them. */
function collectDone(): DoneFile {
  const done: DoneFile = fs.existsSync(DONE_FILE) ? (JSON.parse(fs.readFileSync(DONE_FILE, 'utf8')) as DoneFile) : { loadMs: [], results: {} }
  for (const name of fs.readdirSync(CACHE).filter((n) => /^eval-old-part\d+\.json$/.test(n))) {
    const file = path.join(CACHE, name)
    try {
      const body = JSON.parse(fs.readFileSync(file, 'utf8')) as { loadMs: number; results: OldResult[] }
      done.loadMs.push(body.loadMs)
      for (const r of body.results) done.results[`${r.id}|${r.lang}`] = r
    } catch {
      // a worker killed mid-write leaves a truncated file: its results are re-measured
    }
    fs.unlinkSync(file)
  }
  fs.writeFileSync(DONE_FILE, JSON.stringify(done))
  return done
}

async function child(part: number, parts: number, sampleFile: string) {
  const items = (JSON.parse(fs.readFileSync(sampleFile, 'utf8')) as EvalItem[]).filter((_, i) => i % parts === part)
  const t0 = performance.now()
  const { retrieveChemistryKnowledge } = await import('../../src/learn/learnKnowledgeRetrieval.ts')
  const loadMs = performance.now() - t0
  const results: OldResult[] = []
  for (const item of items) {
    const t = performance.now()
    const r = retrieveChemistryKnowledge(item.query, { maxChunks: 10, gradeId: `g${item.grade}` })
    const ms = performance.now() - t
    const keys = r.chunks.map((c) => oldSectionKey(c) ?? `-${c.id}`)
    const gold = new Set(item.gold)
    const idx = keys.findIndex((k) => gold.has(k))
    // answer-bearing check on what the old retriever would put into the prompt (topic + Russian text)
    const ans = answerRank(item, r.chunks.map((c) => ({ id: `old:${c.id}`, text: `${c.topic}
${c.ru}` })))
    results.push({ id: item.id, lang: item.lang, grade: item.grade, rank: idx < 0 ? 0 : idx + 1, ans, ms, top: keys.slice(0, 3) })
    fs.writeFileSync(path.join(CACHE, `eval-old-part${part}.json`), JSON.stringify({ loadMs, results }))
    console.log(`[old#${part}] ${results.length}/${items.length} ${item.id} rank=${idx + 1} ${(ms / 1000).toFixed(1)}s`)
  }
}

async function parent() {
  const sampleSize = Number(arg('sample', '128'))
  const workers = Number(arg('workers', '2'))
  const { engine } = loadEngine()
  const sections = indexedSections(engine)
  const items = buildEvalSet().items.filter((i) => i.gold.some((g) => sections.has(g)))
  // stratified deterministic sample
  const quota: [string, (i: EvalItem) => boolean, number][] = [
    ['g7 ru', (i) => i.grade === 7 && i.lang === 'ru', 0.22],
    ['g8 ru', (i) => i.grade === 8 && i.lang === 'ru', 0.16],
    ['g9 ru', (i) => i.grade === 9 && i.lang === 'ru', 0.16],
    ['g10-11 ru', (i) => i.grade >= 10 && i.lang === 'ru', 0.18],
    ['en', (i) => i.lang === 'en', 0.14],
    ['uz', (i) => i.lang === 'uz', 0.14],
  ]
  const sample: EvalItem[] = []
  for (const [, pred, share] of quota) {
    const pool = items.filter(pred).sort((a, b) => fnv1a(a.id + a.lang) - fnv1a(b.id + b.lang))
    sample.push(...pool.slice(0, Math.round(sampleSize * share)))
  }
  const done = collectDone()
  const todo = sample.filter((i) => !done.results[`${i.id}|${i.lang}`])
  const sampleFile = path.join(CACHE, 'eval-old-sample.json')
  fs.writeFileSync(sampleFile, JSON.stringify(todo))
  console.log(`[old] sample ${sample.length} questions (${sample.length - todo.length} already measured), ${workers} workers`)
  const tsxCli = path.resolve(import.meta.dirname, '..', '..', 'node_modules', 'tsx', 'dist', 'cli.mjs')
  await Promise.all(
    Array.from({ length: todo.length ? Math.min(workers, todo.length) : 0 }, (_, part) => {
      return new Promise<void>((resolve, reject) => {
        const p = spawn(
          process.execPath,
          ['--max-old-space-size=4096', tsxCli, path.join(import.meta.dirname, 'eval-old.mts'), '--child', String(part), String(Math.min(workers, todo.length)), sampleFile],
          { stdio: 'inherit' },
        )
        p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`worker ${part} exited ${code}`))))
      })
    }),
  )
  const final = collectDone()
  const results = sample.map((i) => final.results[`${i.id}|${i.lang}`]).filter((r): r is OldResult => !!r)
  const loads = final.loadMs
  fs.writeFileSync(path.join(CACHE, 'eval-old-results.json'), JSON.stringify({ generatedAt: new Date().toISOString(), loadMs: loads, results }, null, 1))
  const ms = results.map((r) => r.ms).sort((a, b) => a - b)
  console.log(
    `[old] done: ${results.length} results, load ${loads.map((l) => (l / 1000).toFixed(1)).join('/')} s, p50 ${(ms[Math.floor(ms.length / 2)] / 1000).toFixed(1)} s`,
  )
}

if (args[0] === '--child') await child(Number(args[1]), Number(args[2]), args[3])
else await parent()
