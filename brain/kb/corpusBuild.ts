/**
 * Сборка базы «мозга» (npm run brain:corpus): всё знание репозитория → journal/kb-journal.jsonl.
 *
 * ТОЛЬКО дописывание в конец журнала. Первый запуск пишет всё; повторный — только записи с новым hash
 * (тексты, которых в журнале ещё нет). Точный повтор внутри одного запуска пропускается,
 * почти-дубликат (Жаккар стемов ≥ 0.9) пишется записью kind:"dup" со ссылкой meta.ref — ничего не теряем.
 *
 * Источники (только чтение):
 *   src/data/kb/corpus/kb-corpus-g7..g11.json  — учебники Kimyo 7–11 (текст, определения, итоги);
 *   src/data/kb/corpus/kb-corpus-book.json     — указатель учебников;
 *   src/data/kb/corpus/kb-corpus-common.json   — карточки ATOMLAB (элементы, вещества, реакции, FAQ, ошибки);
 *   src/data/kb/corpus/kb-corpus-wiki.json     — энциклопедия школьной базы (ru/en/uz);
 *   src/data/teacher/qaBank.json               — вещества, элементы, реакции, определения;
 *   src/data/teacher/scientistsIndex.json      — учёные;
 *   src/data/teacherKnowledge/megaPack.json    — 28 тыс. учебных чанков (topic / ru / keywords);
 *   public/kb/wiki/{meta.json,s/*.json}        — вступления статей Википедии, только химические теги.
 */
import fs from 'node:fs'
import path from 'node:path'
import { analyzeTerms } from '../../src/learn/kb/analyzer.ts'
import { citationOf } from '../pipeline/retrieve.ts'
import type { AppendInput, Journal, JournalRecord } from './journal.ts'
import { REPO_ROOT } from './shards.ts'
import { textHash } from './storage.ts'
import { classifyTopic, topicTags } from './topicMap.ts'

export const SOURCE_NAMES = ['textbooks', 'book-index', 'common', 'kb-wiki', 'qabank', 'scientists', 'megapack', 'wiki'] as const
export type SourceName = (typeof SOURCE_NAMES)[number]

type Item = AppendInput & { kind: 'fact' | 'qa' | 'note' }

const readJson = <T>(rel: string): T => JSON.parse(fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8')) as T

type CorpusChunk = {
  id: string
  grade: number | null
  chapterId?: string
  sectionId?: string
  kp?: string
  lang: string
  source: string
  title: string
  pageStart?: number
  type: string
  text: string
}

function tagged(title: string, keywords: string, text: string, grade: number | null, extra: string[] = []): string[] {
  return [...topicTags(classifyTopic(title, keywords, text, grade)), ...extra]
}

function fromChunk(c: CorpusChunk): Item {
  const kind: Item['kind'] = c.type === 'faq' ? 'qa' : c.type === 'encyclopedia' ? 'note' : 'fact'
  return {
    kind,
    lang: c.lang,
    title: c.title,
    text: c.text,
    tags: tagged(c.title, '', c.text, c.grade, [`type:${c.type}`]),
    source: c.source,
    meta: {
      srcId: c.id,
      type: c.type,
      cite: citationOf(c.source, c.title, c.kp, c.pageStart, c.type),
      ...(c.chapterId ? { chapterId: c.chapterId } : {}),
      ...(c.sectionId ? { sectionId: c.sectionId } : {}),
    },
  }
}

function* textbooks(): Generator<Item> {
  for (const g of [7, 8, 9, 10, 11]) for (const c of readJson<{ chunks: CorpusChunk[] }>(`src/data/kb/corpus/kb-corpus-g${g}.json`).chunks) yield fromChunk(c)
}
function* bookIndex(): Generator<Item> {
  for (const c of readJson<{ chunks: CorpusChunk[] }>('src/data/kb/corpus/kb-corpus-book.json').chunks) yield fromChunk(c)
}
function* common(): Generator<Item> {
  for (const c of readJson<{ chunks: CorpusChunk[] }>('src/data/kb/corpus/kb-corpus-common.json').chunks) yield fromChunk(c)
}
function* kbWiki(): Generator<Item> {
  for (const c of readJson<{ chunks: CorpusChunk[] }>('src/data/kb/corpus/kb-corpus-wiki.json').chunks) yield fromChunk(c)
}

type QaBankRaw = {
  substances: { id: string; ru: string; en: string; uz: string; f: string; fa: string; cls: string; fam?: { ru: string }; M: number; g: number[]; d?: string; use?: string; pg?: number }[]
  elements: { z: number; s: string; ru: string; en: string; uz: string; A: number; per: number; grp: number; blk: string; ox: string; cfg: string; st: string; en_?: number }[]
  reactions: { id: string; eq: string; t: string; c?: string; g: number[]; kp?: string; pg?: number; ttl?: string }[]
  definitions: { term: string; def: string; g: number; kp?: string; pg?: number }[]
}

const REACTION_TYPE: Record<string, string> = { combination: 'соединения', decomposition: 'разложения', substitution: 'замещения', exchange: 'обмена', redox: 'окислительно-восстановительная' }

function* qaBank(): Generator<Item> {
  const q = readJson<QaBankRaw>('src/data/teacher/qaBank.json')
  for (const s of q.substances) {
    const text = `${s.ru} (${s.f}; англ. ${s.en}; узб. ${s.uz}) — ${s.fam?.ru ?? s.cls}; молярная масса M = ${String(s.M).replace('.', ',')} г/моль.${s.d ? ' ' + s.d : ''}${s.use ? ' Применение: ' + s.use : ''}`
    const g = s.g[0] ?? null
    yield { kind: 'fact', lang: 'ru', title: `${s.ru} ${s.f}`, text, tags: tagged(s.ru, s.cls, text, g, ['type:substance']), source: 'ATOMLAB: вещества', meta: { srcId: `qa-sub-${s.id}`, type: 'card', cite: '[ATOMLAB: справочник веществ]', formula: s.fa } }
  }
  for (const e of q.elements) {
    const text = `${e.ru} (${e.s}; англ. ${e.en}; узб. ${e.uz}) — химический элемент № ${e.z}: ${e.per}-й период, ${e.grp}-я группа; относительная атомная масса Ar = ${String(e.A).replace('.', ',')}; электронная конфигурация ${e.cfg}; степени окисления: ${e.ox}${e.en_ ? `; электроотрицательность по Полингу ${String(e.en_).replace('.', ',')}` : ''}; при обычных условиях: ${e.st === 'Gas' ? 'газ' : e.st === 'Liquid' ? 'жидкость' : 'твёрдое вещество'}.`
    yield { kind: 'fact', lang: 'ru', title: `${e.ru} (${e.s})`, text, tags: tagged(e.ru, 'химический элемент', text, 8, ['type:element']), source: 'ATOMLAB: элементы', meta: { srcId: `qa-el-${e.z}`, type: 'card', cite: '[ATOMLAB: таблица элементов]' } }
  }
  for (const r of q.reactions) {
    const text = `${r.eq} — реакция ${REACTION_TYPE[r.t] ?? r.t}${r.c ? ` (${r.c})` : ''}.${r.ttl ? ` Тема: ${r.ttl}.` : ''}`
    const g = r.g[0] ?? null
    yield {
      kind: 'fact',
      lang: 'ru',
      title: r.ttl ? `Реакция: ${r.ttl}` : 'Реакция',
      text,
      tags: tagged(r.ttl ?? '', 'уравнение реакции', text, g, ['type:reaction']),
      source: g ? `Kimyo ${g}` : 'ATOMLAB: реакции',
      meta: { srcId: `qa-rx-${r.id}`, type: 'card', cite: g ? citationOf(`Kimyo ${g}`, '', r.kp, r.pg) : '[ATOMLAB: реакции]' },
    }
  }
  for (const d of q.definitions) {
    const text = `${d.term} — ${d.def}`
    yield { kind: 'fact', lang: 'ru', title: d.term, text, tags: tagged(d.term, '', text, d.g, ['type:definition']), source: `Kimyo ${d.g}`, meta: { srcId: `qa-def-${d.g}-${d.term}`, type: 'definition', cite: citationOf(`Kimyo ${d.g}`, d.term, d.kp, d.pg) } }
  }
}

function* scientists(): Generator<Item> {
  const s = readJson<{ scientists: { id: string; title: string; years?: string; where?: string; known?: string }[] }>('src/data/teacher/scientistsIndex.json').scientists
  for (const x of s) {
    if (!x.known) continue
    const text = `${x.title}${x.years ? ` (${x.years})` : ''} — ${x.known}`
    yield { kind: 'note', lang: 'ru', title: x.title, text, tags: tagged(x.title, 'учёный', text, null, ['type:scientist']), source: 'Википедия (CC BY-SA 4.0)', meta: { srcId: `sci-${x.id}`, type: 'encyclopedia', cite: `[Википедия: ${x.title} — CC BY-SA]` } }
  }
}

function* megaPack(): Generator<Item> {
  const m = readJson<{ chunks: { id: string; topic: string; grades?: number[]; keywords?: string[]; ru?: string }[] }>('src/data/teacherKnowledge/megaPack.json').chunks
  for (const c of m) {
    const text = (c.ru ?? '').replace(/\*\*/g, '').replace(/(\p{L})- (\p{Ll})/gu, '$1$2').trim()
    if (text.length < 40) continue
    const g = c.grades?.[0] ?? null
    const kind: Item['kind'] = /-ask$|-check$/.test(c.id) ? 'qa' : 'fact'
    yield {
      kind,
      lang: 'ru',
      title: c.topic,
      text,
      tags: tagged(c.topic, (c.keywords ?? []).slice(0, 8).join(' '), text, g, ['type:megapack']),
      source: g ? `Kimyo ${g}` : 'ATOMLAB: учебный пакет',
      meta: { srcId: `mp-${c.id}`, type: 'megapack', cite: g ? `[Kimyo ${g}]` : '[ATOMLAB: учебный пакет]' },
    }
  }
}

const CHEM_DENSITY = /(химич|вещест|реакци|соединени|молекул|атом|кислот|оксид|раствор|элемент|кристалл|ион[аыо]?\b|катализ|синтез)/giu
/** Теги Википедии (scripts/teacher-ml/wiki-big-build.mts): k — ключевые, c — химия, p — учёные, h — история науки, s — безопасность. */
const WIKI_CHEM_TAGS = new Set(['k', 'c', 'p', 'h', 's'])

function* wiki(): Generator<Item> {
  const dir = path.join(REPO_ROOT, 'public', 'kb', 'wiki')
  if (!fs.existsSync(path.join(dir, 'meta.json'))) return
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8')) as { n: number; shards: number; titles: string[]; tags: string }
  for (let s = 0; s < meta.shards; s++) {
    const arr = JSON.parse(fs.readFileSync(path.join(dir, 's', `${s}.json`), 'utf8')) as string[]
    for (let j = 0; j < arr.length; j++) {
      const d = j * meta.shards + s
      const tag = meta.tags[d] ?? ''
      const text = arr[j] ?? ''
      if (!text) continue
      // химические теги — все; остальные (биология, физика, медицина…) — только с плотной химией в тексте
      if (!WIKI_CHEM_TAGS.has(tag) && (text.match(CHEM_DENSITY) ?? []).length < 4) continue
      const title = meta.titles[d] ?? ''
      yield {
        kind: 'note',
        lang: 'ru',
        title,
        text,
        tags: tagged(title, '', text, null, ['type:encyclopedia', `wiki:${tag}`]),
        source: 'Википедия (CC BY-SA 4.0)',
        meta: { srcId: `wb-${d}`, type: 'encyclopedia', cite: `[Википедия: ${title} — CC BY-SA]` },
      }
    }
  }
}

const READERS: Record<SourceName, () => Generator<Item>> = {
  textbooks,
  'book-index': bookIndex,
  common,
  'kb-wiki': kbWiki,
  qabank: qaBank,
  scientists,
  megapack: megaPack,
  wiki,
}

/** Почти-дубликаты: MinHash (8 хешей, 4 полосы по 2) → кандидаты → точный Жаккар стемов. */
class NearDup {
  private buckets = new Map<string, number[]>()
  private sets: Set<string>[] = []
  private ids: string[] = []

  private static h(s: string, seed: number): number {
    let h = 2166136261 ^ seed
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
    return h >>> 0
  }

  private keys(terms: Set<string>): string[] {
    const mins = new Array<number>(8).fill(0xffffffff)
    for (const t of terms) for (let k = 0; k < 8; k++) mins[k] = Math.min(mins[k]!, NearDup.h(t, k * 0x9e3779b1))
    return [0, 1, 2, 3].map((b) => `${b}:${mins[2 * b]}:${mins[2 * b + 1]}`)
  }

  /** id первой почти такой же записи (Жаккар ≥ thr) или null; запись запоминается. */
  check(id: string, terms: Set<string>, thr = 0.9): { ref: string; j: number } | null {
    if (terms.size < 8) return null
    const keys = this.keys(terms)
    let best: { ref: string; j: number } | null = null
    const seen = new Set<number>()
    for (const k of keys) {
      const b = this.buckets.get(k)
      if (!b) continue
      for (let i = Math.max(0, b.length - 60); i < b.length; i++) {
        const idx = b[i]!
        if (seen.has(idx)) continue
        seen.add(idx)
        const other = this.sets[idx]!
        const lo = Math.min(other.size, terms.size)
        const hi = Math.max(other.size, terms.size)
        if (lo / hi < thr) continue
        let inter = 0
        for (const t of terms) if (other.has(t)) inter++
        const j = inter / (other.size + terms.size - inter)
        if (j >= thr && (!best || j > best.j)) best = { ref: this.ids[idx]!, j }
      }
    }
    if (best) return best
    const idx = this.sets.length
    this.sets.push(terms)
    this.ids.push(id)
    for (const k of keys) {
      const b = this.buckets.get(k)
      if (b) b.push(idx)
      else this.buckets.set(k, [idx])
    }
    return null
  }
}

export type CorpusStats = { source: string; read: number; appended: number; nearDup: number; skippedKnown: number; skippedRepeat: number; ms: number }

/**
 * Дописать источники в журнал. dryRun — только посчитать. Возвращает статистику по источникам.
 * Повторный запуск: hash уже в журнале (включая записи dup) → пропуск, журнал не растёт.
 */
export function buildCorpus(
  journal: Journal,
  opts: { sources?: readonly SourceName[]; dryRun?: boolean; batch?: number; log?: (s: string) => void } = {},
): CorpusStats[] {
  const log = opts.log ?? (() => {})
  const known = new Set<string>()
  for (const r of journal.records) known.add(r.hash)
  const near = new NearDup()
  // уже записанные (не dup) тексты тоже участвуют в поиске почти-дубликатов
  for (const r of journal.records) if (r.kind !== 'dup') near.check(r.id, new Set(analyzeTerms(`${r.title} ${r.text.slice(0, 3000)}`)), 2)
  const runSeen = new Set<string>()
  const out: CorpusStats[] = []
  for (const name of opts.sources ?? SOURCE_NAMES) {
    const t0 = performance.now()
    const st: CorpusStats = { source: name, read: 0, appended: 0, nearDup: 0, skippedKnown: 0, skippedRepeat: 0, ms: 0 }
    let pending: JournalRecord[] = []
    const flush = () => {
      if (!opts.dryRun && pending.length) journal.appendPrepared(pending)
      pending = []
    }
    for (const item of READERS[name]()) {
      st.read++
      const text = item.text.normalize('NFC').trim()
      if (!text) continue
      const hash = textHash(text)
      if (known.has(hash)) {
        st.skippedKnown++
        continue
      }
      if (runSeen.has(hash)) {
        st.skippedRepeat++
        continue
      }
      runSeen.add(hash)
      const rec = journal.prepare({ ...item, text })
      const nd = near.check(rec.id, new Set(analyzeTerms(`${rec.title} ${text.slice(0, 3000)}`)))
      if (nd) {
        rec.meta = { ...rec.meta, ref: nd.ref, origKind: rec.kind, near: Math.round(nd.j * 1000) / 1000 }
        rec.kind = 'dup'
        st.nearDup++
      } else st.appended++
      pending.push(rec)
      if (pending.length >= (opts.batch ?? 2000)) flush()
    }
    flush()
    st.ms = Math.round(performance.now() - t0)
    log(`  ${name.padEnd(11)} прочитано ${String(st.read).padStart(6)} · новых ${String(st.appended).padStart(6)} · почти-дубликатов ${String(st.nearDup).padStart(5)} · уже в базе ${String(st.skippedKnown).padStart(6)} · повторов ${String(st.skippedRepeat).padStart(5)} · ${(st.ms / 1000).toFixed(1)} с`)
    out.push(st)
  }
  return out
}
