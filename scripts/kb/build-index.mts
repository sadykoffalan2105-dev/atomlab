/**
 * Knowledge-base search index build: corpus → prebuilt BM25F shards + query lexicon.
 *
 * Input:  src/data/kb/corpus/kb-corpus-*.json  (chunks in the KbChunk contract, optional `keywords`)
 *         src/data/kb/corpus/kb-glossary.json
 * Output: src/data/kb/index/kb-index-{common,g7..g11}.json   (see src/learn/kb/shardFormat.ts)
 *         src/data/kb/index/kb-lexicon.json                  (uz/en/ru/formula query expansions)
 *         src/data/kb/index/kb-manifest.json                 (counts, sizes, build info — not loaded at runtime)
 *
 * Usage: npm run kb:index   (= npx tsx scripts/kb/build-index.mts; run `npm run kb:corpus` first when the corpus changed)
 * Any change to src/learn/kb/analyzer.ts (ANALYZER_VERSION) requires a rebuild; the engine warns about shards built with another analyzer version.
 */
import fs from 'node:fs'
import path from 'node:path'
import { ANALYZER_VERSION, analyzeTerms, analyzeTokens } from '../../src/learn/kb/analyzer.ts'
import {
  SHARD_FORMAT_VERSION,
  SHARD_NAMES,
  type KbLexiconFile,
  type KbShardFile,
  type ShardDoc,
  type ShardName,
} from '../../src/learn/kb/shardFormat.ts'
import type { KbChunk } from '../../src/learn/kb/types.ts'
import type { GlossaryEntry } from './lib/glossary.mts'
import { buildAlignment } from './lib/align.mts'

type CorpusChunk = KbChunk & { keywords?: string[] }

const ROOT = path.resolve(import.meta.dirname, '..', '..')
const CORPUS = path.join(ROOT, 'src', 'data', 'kb', 'corpus')
const OUT = path.join(ROOT, 'src', 'data', 'kb', 'index')
fs.mkdirSync(OUT, { recursive: true })

const t0 = Date.now()

// ------------------------------------------------------------------ load corpus
const chunks: CorpusChunk[] = []
for (const f of fs.readdirSync(CORPUS).filter((n) => /^kb-corpus-.+\.json$/.test(n)).sort()) {
  const body = JSON.parse(fs.readFileSync(path.join(CORPUS, f), 'utf8')) as { chunks: CorpusChunk[] }
  chunks.push(...body.chunks)
}
const seenIds = new Set<string>()
for (const c of chunks) {
  if (seenIds.has(c.id)) throw new Error(`duplicate chunk id ${c.id}`)
  seenIds.add(c.id)
}

function shardOf(c: CorpusChunk): ShardName {
  if (c.grade == null) return 'common'
  const name = `g${c.grade}` as ShardName
  return SHARD_NAMES.includes(name) ? name : 'common'
}

// ------------------------------------------------------------------ analyze
type Analyzed = { chunk: CorpusChunk; shard: ShardName; tf: Map<string, [number, number, number]>; lens: [number, number, number] }

const analyzed: Analyzed[] = chunks.map((chunk) => {
  const tf = new Map<string, [number, number, number]>()
  const fields = [chunk.title, (chunk.keywords ?? []).join(' ; '), chunk.text]
  const lens: [number, number, number] = [0, 0, 0]
  fields.forEach((text, fi) => {
    const terms = analyzeTerms(text)
    lens[fi] = terms.length
    for (const t of terms) {
      let e = tf.get(t)
      if (!e) tf.set(t, (e = [0, 0, 0]))
      e[fi] += 1
    }
  })
  return { chunk, shard: shardOf(chunk), tf, lens }
})

const N = analyzed.length
const df = new Map<string, number>()
const sumLens = [0, 0, 0]
for (const a of analyzed) {
  for (const t of a.tf.keys()) df.set(t, (df.get(t) ?? 0) + 1)
  a.lens.forEach((l, i) => (sumLens[i] += l))
}
const avg = sumLens.map((s) => Number((s / N).toFixed(3))) as [number, number, number]

// ------------------------------------------------------------------ write shards
function varint(out: number[], n: number) {
  let v = n >>> 0
  while (v >= 0x80) {
    out.push((v & 0x7f) | 0x80)
    v >>>= 7
  }
  out.push(v)
}

const manifest: Record<string, unknown> = {
  generatedAt: new Date().toISOString(),
  analyzer: ANALYZER_VERSION,
  format: SHARD_FORMAT_VERSION,
  N,
  avg,
  shards: {} as Record<string, unknown>,
}

for (const name of SHARD_NAMES) {
  const docsA = analyzed.filter((a) => a.shard === name)
  const docs: ShardDoc[] = docsA.map(({ chunk: c }) => [
    c.id,
    c.grade ?? null,
    c.chapterId ?? null,
    c.sectionId ?? null,
    c.kp ?? null,
    c.title,
    c.pageStart ?? null,
    c.pageEnd ?? null,
    c.type,
    c.lang,
    c.source,
    c.text,
  ])
  const postings = new Map<string, [number, number, number, number][]>()
  docsA.forEach((a, di) => {
    for (const [t, f] of a.tf) {
      let list = postings.get(t)
      if (!list) postings.set(t, (list = []))
      list.push([di, f[0], f[1], f[2]])
    }
  })
  const terms = [...postings.keys()].sort()
  const bytes: number[] = []
  const offs: number[] = []
  for (const t of terms) {
    offs.push(bytes.length)
    let prev = 0
    for (const [d, a, b, c] of postings.get(t)!) {
      varint(bytes, d - prev)
      prev = d
      varint(bytes, a)
      varint(bytes, b)
      varint(bytes, c)
    }
  }
  offs.push(bytes.length)
  const file: KbShardFile = {
    v: SHARD_FORMAT_VERSION,
    analyzer: ANALYZER_VERSION,
    shard: name,
    N,
    avg,
    docs,
    lens: docsA.flatMap((a) => a.lens),
    terms: terms.join('\n'),
    df: terms.map((t) => df.get(t) ?? 1),
    offs,
    post: Buffer.from(Uint8Array.from(bytes)).toString('base64'),
  }
  const outFile = path.join(OUT, `kb-index-${name}.json`)
  const json = JSON.stringify(file)
  fs.writeFileSync(outFile, json)
  ;(manifest.shards as Record<string, unknown>)[name] = {
    docs: docs.length,
    terms: terms.length,
    postingsBytes: bytes.length,
    fileBytes: Buffer.byteLength(json),
  }
  console.log(
    `[index] ${name}: ${docs.length} docs, ${terms.length} terms, postings ${(bytes.length / 1024).toFixed(0)} KB, file ${(Buffer.byteLength(json) / 1024).toFixed(0)} KB`,
  )
}

// ------------------------------------------------------------------ lexicon
const glossary = (JSON.parse(fs.readFileSync(path.join(CORPUS, 'kb-glossary.json'), 'utf8')) as { entries: GlossaryEntry[] }).entries
const phrases = new Map<string, Map<string, number>>()
let maxPhrase = 1

function keyOf(ns: string, text: string, kinds: ('ru' | 'lat' | 'formula' | 'symbol')[]): string | null {
  const toks = analyzeTokens(text).filter((t) => kinds.includes(t.kind))
  if (!toks.length || toks.length > 5) return null
  maxPhrase = Math.max(maxPhrase, toks.length)
  return `${ns}:${toks.map((t) => t.term).join(' ')}`
}

function addPhrase(key: string | null, target: string, weight: number) {
  if (!key || !target) return
  if (key.slice(key.indexOf(':') + 1) === target) return
  let m = phrases.get(key)
  if (!m) phrases.set(key, (m = new Map()))
  m.set(target, Math.max(m.get(target) ?? 0, weight))
}

for (const e of glossary) {
  const ruTerms = analyzeTerms(e.ru).join(' ')
  const formulaTerms = e.formula.map((f) => analyzeTokens(f).filter((t) => t.kind === 'formula' || t.kind === 'symbol').map((t) => t.term).join(' ')).filter(Boolean)
  const isElement = e.source === 'element'
  for (const en of e.en) {
    const k = keyOf('en', en, ['lat'])
    addPhrase(k, ruTerms, 1)
    for (const f of formulaTerms) addPhrase(k, f, isElement ? 0.5 : 0.8)
  }
  for (const uz of e.uz) {
    const k = keyOf('uz', uz, ['lat'])
    addPhrase(k, ruTerms, 1)
    for (const f of formulaTerms) addPhrase(k, f, isElement ? 0.5 : 0.8)
  }
  for (const f of formulaTerms) {
    addPhrase(`f:${f}`, ruTerms, isElement ? 0.55 : 0.7)
  }
  const rk = keyOf('ru', e.ru, ['ru'])
  for (const f of formulaTerms) addPhrase(rk, f, isElement ? 0.45 : 0.7)
}
const glossaryKeys = phrases.size
const alignment = await buildAlignment((t) => (df.get(t) ?? 0) >= 2)
let alignedAdded = 0
for (const [key, targets] of Object.entries(alignment)) {
  if (phrases.has(key)) continue // curated glossary wins
  for (const [r, w] of targets) addPhrase(key, r, w * 0.85)
  alignedAdded += 1
}

const lexicon: KbLexiconFile = {
  v: SHARD_FORMAT_VERSION,
  analyzer: ANALYZER_VERSION,
  maxPhrase,
  phrases: Object.fromEntries(
    [...phrases.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, m]) => [
        k,
        [...m.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .map(([t, w]) => [t, Number(w.toFixed(2))] as [string, number]),
      ]),
  ),
}
const lexJson = JSON.stringify(lexicon)
fs.writeFileSync(path.join(OUT, 'kb-lexicon.json'), lexJson)
manifest.lexicon = { keys: phrases.size, glossaryKeys, alignedKeys: alignedAdded, fileBytes: Buffer.byteLength(lexJson) }
console.log(`[index] lexicon: ${phrases.size} keys (${glossaryKeys} glossary, ${alignedAdded} aligned), ${(Buffer.byteLength(lexJson) / 1024).toFixed(0)} KB`)

fs.writeFileSync(path.join(OUT, 'kb-manifest.json'), JSON.stringify(manifest, null, 2))
console.log(`[index] ${N} docs total, done in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
