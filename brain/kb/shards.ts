/**
 * Знания, которые уже лежат в репозитории (только чтение):
 *   src/data/kb/index/*.json        — шарды BM25F учебников Kimyo 7–11, карточек ATOMLAB и энциклопедии (KbEngine);
 *   src/data/teacher/qaBank.json    — точные факты: 494 вещества, 118 элементов, 813 реакций, определения;
 *   src/data/teacher/scientistsIndex.json — 865 учёных;
 *   src/data/kb/corpus/kb-glossary.json  — словарь терминов ru ↔ uz/en (для подписей тем на языке вопроса).
 */
import fs from 'node:fs'
import path from 'node:path'
import { KbEngine } from '../../src/learn/kb/engine.ts'
import { SHARD_NAMES, type KbLexiconFile, type KbShardFile } from '../../src/learn/kb/shardFormat.ts'
import { semanticHooks, setSemanticVectors, type KbVectorsFile } from '../../src/learn/kb/semantic.ts'

export const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..')
const INDEX_DIR = path.join(REPO_ROOT, 'src', 'data', 'kb', 'index')

export type QaSubstance = {
  id: string
  ru: string
  en: string
  uz: string
  f: string
  fa: string
  cls: string
  fam?: { ru: string; en: string; uz: string }
  M: number
  comp: Record<string, number>
  g: number[]
  ch?: string
  pg?: number
  d?: string
  use?: string
  src?: string
  rec?: string
}
export type QaElement = { z: number; s: string; ru: string; en: string; uz: string; A: number; per: number; grp: number; blk: string; ox: string; cfg: string; st: string; en_?: number }
export type QaReaction = { id: string; eq: string; t: string; c?: string; g: number[]; kp?: string; pg?: number; ttl?: string; r: string[]; p: string[]; bg?: number }
export type QaDefinition = { term: string; def: string; g: number; kp?: string; pg?: number }
export type QaSection = { g: number; id: string; kp: string; title: string; pg?: number }
export type QaBank = { substances: QaSubstance[]; elements: QaElement[]; reactions: QaReaction[]; definitions: QaDefinition[]; sections: QaSection[] }
export type Scientist = { id: string; title: string; surname: string; variants: string[]; years?: string; known?: string }
export type GlossaryEntry = { ru: string; en: string[]; uz: string[] }

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T
}

export class Knowledge {
  engine = new KbEngine()
  qa: QaBank = { substances: [], elements: [], reactions: [], definitions: [], sections: [] }
  scientists: Scientist[] = []
  glossary: GlossaryEntry[] = []
  readonly elementBySymbol = new Map<string, QaElement>()
  readonly elementByZ = new Map<number, QaElement>()
  /** ASCII-формула («H2SO4») → вещество */
  readonly substanceByFormula = new Map<string, QaSubstance>()
  readonly glossaryRu = new Map<string, GlossaryEntry>()
  loadMs = 0

  load(): this {
    const t0 = performance.now()
    this.engine.setLexicon(readJson<KbLexiconFile>(path.join(INDEX_DIR, 'kb-lexicon.json')))
    for (const name of SHARD_NAMES) this.engine.addShard(readJson<KbShardFile>(path.join(INDEX_DIR, `kb-index-${name}.json`)))
    this.loadRest(t0)
    return this
  }

  /** То же, что load(), но с отдачей управления между шардами: сервер уже отвечает на /health, пока знания грузятся. */
  async loadAsync(): Promise<this> {
    const t0 = performance.now()
    const tick = () => new Promise<void>((res) => setImmediate(res))
    this.engine.setLexicon(readJson<KbLexiconFile>(path.join(INDEX_DIR, 'kb-lexicon.json')))
    for (const name of SHARD_NAMES) {
      await tick()
      this.engine.addShard(readJson<KbShardFile>(path.join(INDEX_DIR, `kb-index-${name}.json`)))
    }
    await tick()
    this.loadRest(t0)
    return this
  }

  private loadRest(t0: number): void {
    const vectors = path.join(INDEX_DIR, 'kb-vectors.json')
    if (fs.existsSync(vectors)) {
      try {
        setSemanticVectors(readJson<KbVectorsFile>(vectors))
        this.engine.semantic = semanticHooks
      } catch (err) {
        console.warn('[brain] kb-vectors.json не загружен:', (err as Error).message)
      }
    }
    this.qa = readJson<QaBank>(path.join(REPO_ROOT, 'src', 'data', 'teacher', 'qaBank.json'))
    this.scientists = readJson<{ scientists: Scientist[] }>(path.join(REPO_ROOT, 'src', 'data', 'teacher', 'scientistsIndex.json')).scientists
    this.glossary = readJson<{ entries: GlossaryEntry[] }>(path.join(REPO_ROOT, 'src', 'data', 'kb', 'corpus', 'kb-glossary.json')).entries
    for (const e of this.qa.elements) {
      this.elementBySymbol.set(e.s, e)
      this.elementByZ.set(e.z, e)
    }
    for (const s of this.qa.substances) if (!this.substanceByFormula.has(s.fa)) this.substanceByFormula.set(s.fa, s)
    for (const g of this.glossary) this.glossaryRu.set(g.ru.toLowerCase(), g)
    this.loadMs = Math.round(performance.now() - t0)
  }

  get docCount(): number {
    return this.engine.docCount
  }
}
