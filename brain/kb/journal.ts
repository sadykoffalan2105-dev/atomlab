/**
 * Главная база «мозга»: journal/kb-journal.jsonl — APPEND-ONLY.
 *
 * Одна строка = {id, at, kind, lang, title, text, tags[], source, meta, hash}.
 * Новые данные только дописываются в конец; повтор (тот же hash) тоже дописывается — записью kind:"dup"
 * со ссылкой meta.ref на первую запись (ничего не теряем), но в поиск дубликаты не попадают.
 * Поиск — BM25 (brain/kb/bm25.ts), индекс кешируется в derived/bm25-journal.json и дополняется при каждом append.
 */
import fs from 'node:fs'
import { ANALYZER_VERSION, analyzeTerms } from '../../src/learn/kb/analyzer.ts'
import { FILES } from '../config.ts'
import { Bm25, type Bm25Json, type WeightedTerm } from './bm25.ts'
import { appendLine, appendLines, readJsonl, textHash, ulid, writeDerived } from './storage.ts'

export const APPEND_KINDS = ['fact', 'qa', 'correction', 'feedback', 'dialog', 'note'] as const
export type AppendKind = (typeof APPEND_KINDS)[number]
export type JournalKind = AppendKind | 'dup'
export type JournalLang = 'ru' | 'en' | 'uz'

export type JournalRecord = {
  id: string
  at: string
  kind: JournalKind
  lang: JournalLang
  title: string
  text: string
  tags: string[]
  source: string
  meta: Record<string, unknown>
  hash: string
}

export type AppendInput = {
  kind: string
  lang?: string
  text: string
  title?: string
  tags?: string[]
  source?: string
  meta?: Record<string, unknown>
}

/** Записи, которые участвуют в поиске (диалоги, отзывы и дубликаты — нет). */
export function searchableKind(kind: JournalKind): boolean {
  return kind === 'fact' || kind === 'qa' || kind === 'correction' || kind === 'note'
}

export function validateAppend(body: unknown): AppendInput | string {
  if (!body || typeof body !== 'object') return 'тело запроса должно быть JSON-объектом'
  const b = body as Record<string, unknown>
  if (typeof b.kind !== 'string' || !(APPEND_KINDS as readonly string[]).includes(b.kind)) return `kind ∈ ${APPEND_KINDS.join('|')}`
  if (typeof b.text !== 'string' || !b.text.trim()) return 'text обязателен'
  if (b.text.length > 20000) return 'text ≤ 20000 символов'
  if (b.title !== undefined && typeof b.title !== 'string') return 'title — строка'
  if (b.tags !== undefined && (!Array.isArray(b.tags) || b.tags.some((t) => typeof t !== 'string'))) return 'tags — массив строк'
  if (b.source !== undefined && typeof b.source !== 'string') return 'source — строка'
  if (b.meta !== undefined && (typeof b.meta !== 'object' || b.meta === null || Array.isArray(b.meta))) return 'meta — объект'
  return {
    kind: b.kind,
    lang: typeof b.lang === 'string' ? b.lang : undefined,
    text: b.text,
    title: b.title as string | undefined,
    tags: b.tags as string[] | undefined,
    source: b.source as string | undefined,
    meta: b.meta as Record<string, unknown> | undefined,
  }
}

function normLang(lang: string | undefined, text: string): JournalLang {
  if (lang === 'ru' || lang === 'en' || lang === 'uz') return lang
  if (/[а-яё]/i.test(text)) return 'ru'
  return /[og][ʻʼ‘’']|\b(va|bilan|uchun|nima)\b/i.test(text) ? 'uz' : 'en'
}

export function docTerms(rec: Pick<JournalRecord, 'title' | 'text' | 'tags'>): string[] {
  const topic = rec.tags.filter((t) => t.startsWith('topic:')).map((t) => t.slice(6).replace(/-/g, ' '))
  return analyzeTerms(`${rec.title}\n${rec.title}\n${rec.text.slice(0, 6000)}\n${topic.join(' ')}`)
}

export class Journal {
  readonly file: string
  records: JournalRecord[] = []
  lines = 0
  bytes = 0
  lastAt: string | null = null
  readonly byHash = new Map<string, string>()
  readonly byId = new Map<string, number>()
  /** meta.srcId → id записи: чанк учебника из индекса находит свою запись журнала (и её вектор). */
  readonly bySrcId = new Map<string, string>()
  bm25 = new Bm25()
  indexReady = false
  private saveTimer: NodeJS.Timeout | null = null

  constructor(file = FILES.kbJournal) {
    this.file = file
  }

  load(): this {
    const { rows, lines, bytes } = readJsonl<JournalRecord>(this.file)
    this.lines = lines
    this.bytes = bytes
    for (const r of rows) this.remember(r)
    return this
  }

  /** Чтение журнала порциями с отдачей управления (сервер отвечает на /health, пока база грузится). */
  async loadAsync(every = 3000): Promise<this> {
    if (!fs.existsSync(this.file)) return this
    const raw = fs.readFileSync(this.file, 'utf8')
    let start = 0
    let n = 0
    while (start < raw.length) {
      let end = raw.indexOf('\n', start)
      if (end < 0) end = raw.length
      const s = raw.slice(start, end).trim()
      start = end + 1
      if (!s) continue
      this.lines++
      try {
        this.remember(JSON.parse(s) as JournalRecord)
      } catch {
        /* битая строка: пропускаем, журнал не трогаем */
      }
      if (++n % every === 0) await new Promise((res) => setImmediate(res))
    }
    this.bytes = Buffer.byteLength(raw, 'utf8')
    return this
  }

  private remember(r: JournalRecord): void {
    if (!r || typeof r.id !== 'string') return
    if (!Array.isArray(r.tags)) r.tags = []
    if (!r.meta || typeof r.meta !== 'object') r.meta = {}
    this.byId.set(r.id, this.records.length)
    this.records.push(r)
    if (r.kind !== 'dup' && r.hash && !this.byHash.has(r.hash)) this.byHash.set(r.hash, r.id)
    const src = r.meta.srcId
    if (typeof src === 'string' && r.kind !== 'dup' && !this.bySrcId.has(src)) this.bySrcId.set(src, r.id)
    if (r.at) this.lastAt = r.at
  }

  get(id: string): JournalRecord | undefined {
    const i = this.byId.get(id)
    return i === undefined ? undefined : this.records[i]
  }

  /** Подготовить запись (без записи на диск): id, hash, dup-проверка. */
  prepare(input: AppendInput, extraSeen?: Map<string, string>): JournalRecord {
    const text = input.text.normalize('NFC').trim()
    const hash = textHash(text)
    const firstId = this.byHash.get(hash) ?? extraSeen?.get(hash)
    const meta: Record<string, unknown> = { ...(input.meta ?? {}) }
    let kind = input.kind as JournalKind
    if (firstId) {
      meta.ref = firstId
      meta.origKind = input.kind
      kind = 'dup'
    }
    return {
      id: `j-${ulid()}`,
      at: new Date().toISOString(),
      kind,
      lang: normLang(input.lang, text),
      title: (input.title ?? '').normalize('NFC').trim().slice(0, 300),
      text,
      tags: (input.tags ?? []).map((t) => String(t).slice(0, 80)).slice(0, 32),
      source: (input.source ?? 'user').slice(0, 200),
      meta,
      hash,
    }
  }

  /** Дописать одну запись в конец журнала и сразу проиндексировать её. */
  append(input: AppendInput): { record: JournalRecord; line: number } {
    const rec = this.prepare(input)
    const line = appendLine(this.file, rec)
    this.lines += 1
    this.bytes += Buffer.byteLength(line, 'utf8') + 1
    this.remember(rec)
    if (this.indexReady && searchableKind(rec.kind)) {
      this.bm25.add(rec.id, docTerms(rec))
      this.scheduleSave()
    }
    return { record: rec, line: this.lines }
  }

  /** Пачка готовых записей (сборка корпуса) — одним дописыванием в конец. */
  appendPrepared(recs: readonly JournalRecord[]): void {
    if (!recs.length) return
    appendLines(this.file, recs)
    for (const r of recs) {
      this.lines += 1
      this.bytes += Buffer.byteLength(JSON.stringify(r), 'utf8') + 1
      this.remember(r)
    }
  }

  /**
   * Индекс BM25: берём кеш из derived/ (если он от того же анализатора), дописываем недостающие записи.
   * Работает порциями с отдачей управления — сервер отвечает, пока индекс строится.
   */
  async buildIndex(opts: { useCache?: boolean; yieldEvery?: number } = {}): Promise<{ cached: number; added: number; ms: number }> {
    const t0 = performance.now()
    let cached = 0
    if (opts.useCache !== false && fs.existsSync(FILES.bm25)) {
      try {
        const j = JSON.parse(fs.readFileSync(FILES.bm25, 'utf8')) as Bm25Json
        if (j.v === 1 && j.analyzer === ANALYZER_VERSION && j.ids.every((id) => this.byId.has(id))) {
          this.bm25 = Bm25.fromJSON(j)
          cached = j.ids.length
        }
      } catch {
        /* кеш битый — пересоберём */
      }
    }
    let added = 0
    const every = opts.yieldEvery ?? 400
    for (const r of this.records) {
      if (!searchableKind(r.kind) || this.bm25.has(r.id)) continue
      this.bm25.add(r.id, docTerms(r))
      added++
      if (added % every === 0) await new Promise((res) => setImmediate(res))
    }
    this.indexReady = true
    if (added) this.saveIndexNow()
    return { cached, added, ms: Math.round(performance.now() - t0) }
  }

  private scheduleSave(): void {
    if (this.saveTimer) return
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null
      this.saveIndexNow()
    }, 5000)
    this.saveTimer.unref?.()
  }

  saveIndexNow(): void {
    try {
      writeDerived(FILES.bm25, JSON.stringify(this.bm25.toJSON(this.lines, ANALYZER_VERSION)))
    } catch (err) {
      console.warn('[brain] не удалось сохранить derived/bm25-journal.json:', (err as Error).message)
    }
  }

  search(query: readonly WeightedTerm[], limit = 30): { rec: JournalRecord; score: number }[] {
    if (!this.indexReady) return []
    return this.bm25.search(query, limit).map(({ doc, score }) => ({ rec: this.get(this.bm25.ids[doc]!)!, score })).filter((x) => x.rec)
  }

  stats(): { journalLines: number; bytes: number; byKind: Record<string, number>; lastAt: string | null } {
    const byKind: Record<string, number> = {}
    for (const r of this.records) byKind[r.kind] = (byKind[r.kind] ?? 0) + 1
    return { journalLines: this.lines, bytes: this.bytes, byKind, lastAt: this.lastAt }
  }

  searchableCount(): number {
    let n = 0
    for (const r of this.records) if (searchableKind(r.kind)) n++
    return n
  }
}
