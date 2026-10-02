/**
 * Быстрое обновление карточек «ATOMLAB: учёные» в корпусе common без полной пересборки корпуса
 * (build-corpus.mts требует кеш извлечения PDF, которого на машине может не быть).
 *
 * Берёт SCIENTISTS_KNOWLEDGE из src/learn/knowledge/learnScientistsKnowledge.ts, заменяет в
 * src/data/kb/corpus/kb-corpus-common.json все чанки с source 'ATOMLAB: учёные' (формат — как в
 * scripts/kb/lib/cards.mts → packCards) и обновляет count/generatedAt. Затем: npx tsx scripts/kb/build-index.mts
 *
 *   npx tsx scripts/kb/refresh-pack-cards.mts
 */
import fs from 'node:fs'
import path from 'node:path'
import { SCIENTISTS_KNOWLEDGE } from '../../src/learn/knowledge/learnScientistsKnowledge.ts'

const ROOT = path.resolve(import.meta.dirname, '..', '..')
const FILE = path.join(ROOT, 'src', 'data', 'kb', 'corpus', 'kb-corpus-common.json')
const SOURCE = 'ATOMLAB: учёные'

type Chunk = {
  id: string
  grade: number | null
  title: string
  type: string
  lang: string
  text: string
  source: string
  keywords?: string[]
}
type Corpus = { version: number; shard: string; generatedAt: string; count: number; chunks: Chunk[] }

const stripMd = (s: string) => s.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1').replace(/__([^_]+)__/g, '$1').trim()

const corpus = JSON.parse(fs.readFileSync(FILE, 'utf8')) as Corpus
const before = corpus.chunks.filter((c) => c.source === SOURCE).length
const kept = corpus.chunks.filter((c) => c.source !== SOURCE)
const ids = new Set(kept.map((c) => c.id))
const fresh: Chunk[] = []
for (const c of SCIENTISTS_KNOWLEDGE) {
  if (!c.ru?.trim()) continue
  let id = c.id
  for (let n = 2; ids.has(id); n += 1) id = `${c.id}-${n}`
  ids.add(id)
  fresh.push({ id, grade: null, title: stripMd(c.topic), type: 'card', lang: 'ru', text: stripMd(c.ru), source: SOURCE, keywords: c.keywords })
}
corpus.chunks = [...kept, ...fresh]
corpus.count = corpus.chunks.length
corpus.generatedAt = new Date().toISOString()
fs.writeFileSync(FILE, JSON.stringify(corpus))
const chars = fresh.reduce((s, c) => s + c.text.length, 0)
console.log(`${SOURCE}: было ${before}, стало ${fresh.length} карточек (${chars} символов); всего в common: ${corpus.count}`)
