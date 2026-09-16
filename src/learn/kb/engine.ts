/**
 * In-memory BM25F search over prebuilt knowledge shards. Pure logic: no loading, no DOM,
 * so the same code runs in the browser (main thread or worker), in Node (eval scripts) and in tests.
 */
import {
  ANALYZER_VERSION,
  analyzeTokens,
  cyrillicCandidates,
  detectLocale,
  foldText,
  latinToCyrillic,
  RU_STOPWORDS,
  type AnalyzedToken,
} from './analyzer'
import { stemRussian } from './stemRu'
import { SHARD_FORMAT_VERSION, type KbLexiconFile, type KbShardFile, type ShardDoc } from './shardFormat'
import type { KbChunk, KbChunkType, KbHit, KbLang, KbSearchOptions } from './types'

export type KbTuning = {
  k1: number
  /** field boosts: title, keywords, text */
  boost: [number, number, number]
  /** weight of transliterated cognates for unknown uz/en words ("allotropiya" → "аллотроп") */
  translitWeight: number
  /** length normalisation per field */
  b: [number, number, number]
  /** text length used for normalisation is at least lenFloor × average (keeps tiny keyword lists from winning) */
  lenFloor: number
  /** weight of original Latin words in uz/en queries (their translations carry the main weight) */
  latinOriginal: number
  formulaWeight: number
  symbolWeight: number
  /** score *= coordFloor + (1 - coordFloor) * coverage^coordPow */
  coordFloor: number
  coordPow: number
  gradeSame: number
  gradeNear: number
  gradeFar: number
  chapterBoost: number
  sectionBoost: number
  kpBoost: number
  typePrior: Record<KbChunkType, number>
  definitionIntent: number
  cardIntent: number
  misconceptionIntent: number
  proximityStep: number
  proximityMax: number
  titleCoverage: number
  /** "что такое X" / "what is X": bonus for chunks that define X ("X — это …", "… называется X") */
  definesBoost: number
  rerankDepth: number
  maxPerSection: number
}

export const DEFAULT_TUNING: KbTuning = {
  k1: 1.2,
  boost: [2.6, 1.6, 1],
  b: [0.35, 0.5, 0.75],
  lenFloor: 0,
  latinOriginal: 0.3,
  translitWeight: 0.6,
  formulaWeight: 1.3,
  symbolWeight: 0.7,
  coordFloor: 0.35,
  coordPow: 1,
  gradeSame: 1.35,
  gradeNear: 0.92,
  gradeFar: 0.8,
  chapterBoost: 1.25,
  sectionBoost: 1.6,
  kpBoost: 2.2,
  typePrior: { textbook: 1, definition: 1, summary: 0.92, card: 0.9, quiz: 0.7, faq: 0.9, misconception: 0.85, index: 1 },
  definitionIntent: 1.35,
  cardIntent: 1.45,
  misconceptionIntent: 1.3,
  proximityStep: 0.12,
  proximityMax: 0.36,
  titleCoverage: 0.3,
  definesBoost: 0,
  rerankDepth: 60,
  maxPerSection: 3,
}

type Shard = {
  name: string
  docs: ShardDoc[]
  lens: Uint32Array
  terms: string[]
  termIndex: Map<string, number>
  df: number[]
  offs: number[]
  post: Uint8Array
  N: number
  avg: [number, number, number]
}

/** A query term with its weight and the "concept" (original word / phrase) it stands for. */
export type QueryTerm = { term: string; weight: number; concept: number }

export type AnalyzedQuery = {
  locale: KbLang
  terms: QueryTerm[]
  conceptWeights: number[]
  /** term sequences that should appear close together (original bigrams, translated phrases) */
  phrases: string[][]
  definition: boolean
  cardLike: boolean
  misconception: boolean
  kp: number | null
}

function checkVersion(name: string, format: number, analyzer: number) {
  if (format !== SHARD_FORMAT_VERSION || analyzer !== ANALYZER_VERSION) {
    console.warn(
      `[kb] ${name}: built with format ${format} / analyzer ${analyzer}, runtime expects ${SHARD_FORMAT_VERSION} / ${ANALYZER_VERSION} — run npm run kb:index`,
    )
  }
}

function decodeBase64(b64: string): Uint8Array {
  if (typeof atob === 'function') {
    const bin = atob(b64)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i)
    return out
  }
  throw new Error('base64 decoder unavailable')
}

const DEF_RE = {
  ru: /(что\s+так(ое|ая|ой|ие)|что\s+называ|что\s+означа|что\s+значит|определени|дай\s+определ|это\s+что|кто\s+так|[—–-]\s*это(?![а-я]))/i,
  en: /\b(what\s+(is|are|does)|define|definition|meaning\s+of|what's)\b/i,
  uz: /(nima\b|nimalar|deb\s+ataladi|deyiladi|ta'?rif|degani)/i,
}
const MISC_RE = /(ошиб|путают|путать|заблужд|mistake|misconception|confus|xato|adashish)/i
const KP_RE = /(?:§\s*(\d{1,2})|параграф\w*\s*(\d{1,2})|(\d{1,2})\s*-?\s*(?:тема|mavzu)|тем[аеуы]\s*(\d{1,2})|mavzu\s*(\d{1,2})|paragraph\s*(\d{1,2})|topic\s*(\d{1,2}))/i

export class KbEngine {
  readonly shards = new Map<string, Shard>()
  private lexicon: KbLexiconFile | null = null
  tuning: KbTuning
  private textCache = new Map<string, string>()
  private titleCache = new Map<string, Set<string>>()

  constructor(tuning: Partial<KbTuning> = {}) {
    this.tuning = { ...DEFAULT_TUNING, ...tuning }
  }

  hasShard(name: string): boolean {
    return this.shards.has(name)
  }

  get hasLexicon(): boolean {
    return this.lexicon !== null
  }

  setLexicon(lex: KbLexiconFile) {
    checkVersion('lexicon', lex.v, lex.analyzer)
    this.lexicon = lex
  }

  addShard(file: KbShardFile) {
    checkVersion(file.shard, file.v, file.analyzer)
    const terms = file.terms ? file.terms.split('\n') : []
    const termIndex = new Map<string, number>()
    terms.forEach((t, i) => termIndex.set(t, i))
    this.shards.set(file.shard, {
      name: file.shard,
      docs: file.docs,
      lens: Uint32Array.from(file.lens),
      terms,
      termIndex,
      df: file.df,
      offs: file.offs,
      post: decodeBase64(file.post),
      N: file.N,
      avg: file.avg,
    })
  }

  get docCount(): number {
    let n = 0
    for (const s of this.shards.values()) n += s.docs.length
    return n
  }

  // ------------------------------------------------------------------ query analysis

  /** Document frequency of an index term over all shards (0 when unknown). */
  termDf(term: string): number {
    for (const sh of this.shards.values()) {
      const ti = sh.termIndex.get(term)
      if (ti !== undefined) return sh.df[ti]
    }
    return 0
  }

  /**
   * Join words broken by stray spaces ("Ал юмосиликаты", "Ko ррозия", "нат рий") when the joined word is an
   * index term and at least one piece is not a real word. Short Latin look-alike pieces count as Cyrillic.
   */
  repairQuery(query: string): string {
    if (!this.shards.size) return query
    const text = foldText(query)
    const pieces = [...text.matchAll(/[A-Za-zА-Яа-я]+/g)]
    if (pieces.length < 2) return query
    const known = (w: string) => w.length >= 4 && this.termDf(stemRussian(w)) >= 2
    const fragment = (w: string) => !RU_STOPWORDS.has(w) && (w.length <= 2 || this.termDf(stemRussian(w)) === 0)
    const cyr = pieces.map((m) => {
      const w = m[0]
      if (/^[а-яА-Я]+$/.test(w)) return w.toLowerCase()
      if (w.length <= 2) return latinToCyrillic(w)?.toLowerCase() ?? null
      return null
    })
    let out = ''
    let last = 0
    let i = 0
    while (i < pieces.length) {
      let joined = 0
      for (let k = Math.min(4, pieces.length - i); k >= 2 && !joined; k -= 1) {
        const seg = cyr.slice(i, i + k)
        if (seg.some((w) => w === null)) continue
        // pieces must be separated by exactly one space
        let adjacent = true
        for (let j = i; j < i + k - 1; j += 1) {
          const gap = text.slice(pieces[j].index! + pieces[j][0].length, pieces[j + 1].index!)
          if (gap !== ' ') adjacent = false
        }
        if (!adjacent) continue
        const word = (seg as string[]).join('')
        if (known(word) && (seg as string[]).some(fragment)) joined = k
      }
      if (joined) {
        const start = pieces[i].index!
        const end = pieces[i + joined - 1].index! + pieces[i + joined - 1][0].length
        out += text.slice(last, start) + (cyr.slice(i, i + joined) as string[]).join('')
        last = end
        i += joined
      } else i += 1
    }
    return last ? out + text.slice(last) : query
  }

  analyzeQuery(query: string, locale?: KbLang): AnalyzedQuery {
    const T = this.tuning
    const loc = locale ?? detectLocale(query)
    const tokens = analyzeTokens(this.repairQuery(query), { query: true })
    const weights = new Map<string, QueryTerm>()
    const conceptWeights: number[] = []
    const phrases: string[][] = []
    let cardLike = false

    const add = (term: string, weight: number, concept: number) => {
      const cur = weights.get(term)
      if (!cur || cur.weight < weight) weights.set(term, { term, weight, concept })
    }

    const lex = this.lexicon?.phrases ?? {}
    const maxPhrase = this.lexicon?.maxPhrase ?? 1
    const nsFor = (t: AnalyzedToken): string[] => {
      if (t.kind === 'ru') return ['ru']
      if (t.kind === 'formula' || t.kind === 'symbol') return ['f']
      return loc === 'en' ? ['en', 'uz'] : ['uz', 'en']
    }

    let i = 0
    while (i < tokens.length) {
      const tok = tokens[i]
      const concept = conceptWeights.length
      let base = 1
      if (tok.kind === 'formula') base = T.formulaWeight
      else if (tok.kind === 'symbol') base = T.symbolWeight
      else if (tok.kind === 'lat' && loc !== 'ru') base = T.latinOriginal
      if (tok.kind === 'formula' || tok.kind === 'symbol') cardLike = true

      // longest glossary phrase starting here (same token family)
      let matched = 0
      let targets: [string, number][] | undefined
      for (let n = Math.min(maxPhrase, tokens.length - i); n >= 1 && !matched; n -= 1) {
        const slice = tokens.slice(i, i + n)
        const family = slice.every((s) => s.kind === 'ru') ? 'ru' : slice.every((s) => s.kind === 'lat') ? 'lat' : n === 1 ? tok.kind : ''
        if (!family) continue
        for (const ns of nsFor(slice[0])) {
          const hit = lex[`${ns}:${slice.map((s) => s.term).join(' ')}`]
          if (hit) {
            matched = n
            targets = hit
            break
          }
        }
      }

      if (matched > 0 && targets) {
        const slice = tokens.slice(i, i + matched)
        const translated = slice[0].kind === 'lat' && loc !== 'ru'
        // originals: each word of the phrase keeps its own (lower) weight, same concept
        for (const s of slice) {
          const w = s.kind === 'formula' ? T.formulaWeight : s.kind === 'symbol' ? T.symbolWeight : translated ? T.latinOriginal : 1
          add(s.term, w, concept)
        }
        if (slice.length > 1 && !translated) phrases.push(slice.map((s) => s.term))
        for (const [target, tw] of targets) {
          const parts = target.split(' ')
          const w = (translated ? 1 : 0.75) * tw
          for (const p of parts) add(p, w, concept)
          if (parts.length > 1) phrases.push(parts)
          if (/\d/.test(target) || tok.kind === 'formula' || tok.kind === 'symbol') cardLike = true
        }
        conceptWeights.push(translated ? 1 : base)
        i += matched
        continue
      }
      add(tok.term, base, concept)
      let conceptWeight = base
      if (tok.kind === 'lat' && loc !== 'ru') {
        const cyr = this.vocabularyMatches(cyrillicCandidates(tok.surface, loc))
        for (const [term, share] of cyr) add(term, T.translitWeight * share, concept)
        if (cyr.length) conceptWeight = 1
      }
      conceptWeights.push(conceptWeight)
      i += 1
    }

    // adjacent original Russian words → proximity phrases
    for (let k = 0; k + 1 < tokens.length; k += 1) {
      if (tokens[k].kind === 'ru' && tokens[k + 1].kind === 'ru') phrases.push([tokens[k].term, tokens[k + 1].term])
    }

    const kpMatch = KP_RE.exec(query)
    const kp = kpMatch ? Number(kpMatch.slice(1).find((x) => x)) : null
    return {
      locale: loc,
      terms: [...weights.values()],
      conceptWeights,
      phrases,
      definition: DEF_RE[loc].test(query) || DEF_RE.ru.test(query),
      cardLike: cardLike && tokens.length <= 6,
      misconception: MISC_RE.test(query),
      kp: kp && Number.isFinite(kp) ? kp : null,
    }
  }

  /** Index terms for candidate stems: exact term, else the most frequent terms sharing a 5+ letter prefix. */
  vocabularyMatches(stems: string[]): [string, number][] {
    const out = new Map<string, number>()
    for (const stem of stems) {
      let exact = false
      for (const sh of this.shards.values()) if (sh.termIndex.has(stem)) exact = true
      if (exact) {
        out.set(stem, 1)
        continue
      }
      if (stem.length < 6) continue
      const prefix = stem.slice(0, Math.max(5, stem.length - 2))
      const found = new Map<string, number>()
      for (const sh of this.shards.values()) {
        let lo = 0
        let hi = sh.terms.length
        while (lo < hi) {
          const mid = (lo + hi) >> 1
          if (sh.terms[mid] < prefix) lo = mid + 1
          else hi = mid
        }
        for (let k = lo; k < sh.terms.length && sh.terms[k].startsWith(prefix) && k < lo + 12; k += 1) {
          found.set(sh.terms[k], (found.get(sh.terms[k]) ?? 0) + sh.df[k])
        }
      }
      ;[...found.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .forEach(([t]) => out.set(t, Math.max(out.get(t) ?? 0, 0.75)))
    }
    return [...out.entries()]
  }

  // ------------------------------------------------------------------ direct lookup

  /** Chunks by id (unknown ids are skipped), in the order of `ids`. */
  chunksById(ids: readonly string[]): KbHit[] {
    const want = new Set(ids)
    const found = new Map<string, ShardDoc>()
    if (want.size === 0) return []
    for (const sh of this.shards.values()) {
      for (const row of sh.docs) if (want.has(row[0])) found.set(row[0], row)
      if (found.size === want.size) break
    }
    return ids.flatMap((id) => {
      const row = found.get(id)
      return row ? [toHit(row, 0)] : []
    })
  }

  /** All chunks of one printed paragraph (grade + kp), optionally of some types, in book order. */
  paragraphChunks(grade: number, kp: string, types?: readonly KbChunkType[]): KbHit[] {
    const typeFilter = types?.length ? new Set(types) : null
    const rows: ShardDoc[] = []
    for (const sh of this.shards.values()) {
      for (const row of sh.docs) {
        if (row[1] !== grade || row[4] !== kp || (typeFilter ? !typeFilter.has(row[8]) : row[8] === 'index')) continue
        rows.push(row)
      }
    }
    rows.sort((a, b) => (a[6] ?? 0) - (b[6] ?? 0) || (a[0] < b[0] ? -1 : 1))
    return rows.map((row) => toHit(row, 0))
  }

  // ------------------------------------------------------------------ search

  search(query: string, opts: KbSearchOptions = {}): KbHit[] {
    const T = this.tuning
    const limit = Math.max(1, Math.min(50, opts.limit ?? 8))
    const q = this.analyzeQuery(query, opts.locale)
    if (!q.terms.length) return q.kp != null ? this.listParagraph(q.kp, opts, limit) : []
    const totalConcept = q.conceptWeights.reduce((s, w) => s + w, 0) || 1
    const typeFilter = opts.types?.length ? new Set(opts.types) : null

    type Cand = { shard: Shard; doc: number; score: number; concepts: Set<number> }
    const cands: Cand[] = []

    for (const shard of this.shards.values()) {
      const n = shard.docs.length
      if (!n) continue
      const lenFloorX = T.lenFloor * shard.avg[2]
      const acc = new Float64Array(n)
      const conceptSets: (Set<number> | undefined)[] = new Array(n)
      const touched: number[] = []
      for (const qt of q.terms) {
        const ti = shard.termIndex.get(qt.term)
        if (ti === undefined) continue
        const df = shard.df[ti]
        const idf = Math.log(1 + (shard.N - df + 0.5) / (df + 0.5))
        const bytes = shard.post
        let p = shard.offs[ti]
        const end = shard.offs[ti + 1]
        let doc = 0
        const read = () => {
          let v = 0
          let shift = 0
          for (;;) {
            const byte = bytes[p++]
            v |= (byte & 0x7f) << shift
            if (!(byte & 0x80)) break
            shift += 7
          }
          return v >>> 0
        }
        while (p < end) {
          doc += read()
          const tfT = read()
          const tfK = read()
          const tfX = read()
          const base = doc * 3
          const lt = shard.lens[base]
          const lk = shard.lens[base + 1]
          const lx = Math.max(shard.lens[base + 2], lenFloorX)
          const norm =
            (T.boost[0] * tfT) / (1 - T.b[0] + (T.b[0] * lt) / (shard.avg[0] || 1)) +
            (T.boost[1] * tfK) / (1 - T.b[1] + (T.b[1] * lk) / (shard.avg[1] || 1)) +
            (T.boost[2] * tfX) / (1 - T.b[2] + (T.b[2] * lx) / (shard.avg[2] || 1))
          if (norm <= 0) continue
          if (acc[doc] === 0) touched.push(doc)
          acc[doc] += qt.weight * idf * ((norm * (T.k1 + 1)) / (T.k1 + norm))
          let cs = conceptSets[doc]
          if (!cs) conceptSets[doc] = cs = new Set()
          cs.add(qt.concept)
        }
      }
      for (const d of touched) {
        const row = shard.docs[d]
        if (typeFilter ? !typeFilter.has(row[8]) : row[8] === 'index') continue // r10: book index only on request
        cands.push({ shard, doc: d, score: acc[d], concepts: conceptSets[d] ?? new Set() })
      }
    }
    if (!cands.length) return []

    // coordination + priors
    for (const c of cands) {
      const row = c.shard.docs[c.doc]
      let covered = 0
      for (const k of c.concepts) covered += q.conceptWeights[k] ?? 0
      const coverage = Math.min(1, covered / totalConcept)
      let s = c.score * (T.coordFloor + (1 - T.coordFloor) * Math.pow(coverage, T.coordPow))
      const type = row[8]
      s *= T.typePrior[type] ?? 1
      if (q.definition && (type === 'definition' || type === 'summary')) s *= T.definitionIntent
      if (q.cardLike && type === 'card') s *= T.cardIntent
      if (q.misconception && type === 'misconception') s *= T.misconceptionIntent
      const grade = row[1]
      if (opts.grade != null && grade != null) {
        const diff = Math.abs(grade - opts.grade)
        s *= diff === 0 ? T.gradeSame : diff === 1 ? T.gradeNear : T.gradeFar
        if (diff === 0 && opts.chapterId && row[2] === opts.chapterId) {
          s *= T.chapterBoost
          if (opts.sectionId && row[3] === opts.sectionId) s *= T.sectionBoost
        }
      }
      if (q.kp != null && row[4] != null && grade != null && (opts.grade == null || grade === opts.grade)) {
        const kp = row[4]
        const sameKp = kp === String(q.kp) || (kp.endsWith(`.${q.kp}`) && (!opts.chapterId || row[2] === opts.chapterId))
        if (sameKp) s *= T.kpBoost
      }
      c.score = s
    }
    cands.sort((a, b) => b.score - a.score)

    // rerank head: proximity of phrases + title coverage
    const depth = Math.min(cands.length, T.rerankDepth)
    const defTerms = q.definition && T.definesBoost > 0 ? definitionTargets(q) : []
    if (q.phrases.length || q.conceptWeights.length > 1 || defTerms.length) {
      const conceptTerms = new Map<number, string[]>()
      for (const t of q.terms) conceptTerms.set(t.concept, [...(conceptTerms.get(t.concept) ?? []), t.term])
      const phraseList = uniquePhrases(q.phrases)
      for (let k = 0; k < depth; k += 1) {
        const c = cands[k]
        const row = c.shard.docs[c.doc]
        let bonus = 0
        if (phraseList.length) {
          const text = this.foldedText(row)
          for (const ph of phraseList) if (phraseInText(text, ph)) bonus += T.proximityStep
        }
        const titleTerms = this.titleTerms(row)
        let titleCovered = 0
        for (const [concept, terms] of conceptTerms) {
          if (terms.some((t) => titleTerms.has(t))) titleCovered += q.conceptWeights[concept] ?? 0
        }
        c.score *= (1 + Math.min(T.proximityMax, bonus)) * (1 + T.titleCoverage * Math.min(1, titleCovered / totalConcept))
        if (defTerms.length && definesTerm(this.foldedText(row), defTerms)) c.score *= 1 + T.definesBoost
      }
      const head = cands.slice(0, depth).sort((x, y) => y.score - x.score)
      cands.splice(0, depth, ...head)
    }

    // diversity: cap hits per section (or per chunk group without a section)
    const out: KbHit[] = []
    const perSection = new Map<string, number>()
    for (const c of cands) {
      const row = c.shard.docs[c.doc]
      const key = row[3] ? `${row[1]}:${row[2]}:${row[3]}` : row[4] ? `${row[1]}:kp${row[4]}` : row[0]
      const used = perSection.get(key) ?? 0
      if (used >= T.maxPerSection) continue
      perSection.set(key, used + 1)
      out.push(toHit(row, c.score))
      if (out.length >= limit) break
    }
    return out
  }

  /** "§12" / "параграф 12" without other words: that paragraph's chunks in book order (student's grade first). */
  private listParagraph(kp: number, opts: KbSearchOptions, limit: number): KbHit[] {
    const typeFilter = opts.types?.length ? new Set(opts.types) : null
    const rows: ShardDoc[] = []
    for (const sh of this.shards.values()) {
      for (const row of sh.docs) {
        if (row[1] == null || row[4] == null) continue
        if (opts.grade != null && row[1] !== opts.grade) continue
        const k = row[4]
        const same = k === String(kp) || (k.endsWith(`.${kp}`) && (!opts.chapterId || row[2] === opts.chapterId))
        if (!same || (typeFilter ? !typeFilter.has(row[8]) : row[8] === 'index')) continue
        rows.push(row)
      }
    }
    const typeOrder: Record<string, number> = { summary: 0, definition: 1, textbook: 2 }
    rows.sort(
      (a, b) =>
        (a[1] ?? 0) - (b[1] ?? 0) ||
        (a[6] ?? 0) - (b[6] ?? 0) ||
        (typeOrder[a[8]] ?? 3) - (typeOrder[b[8]] ?? 3) ||
        (a[0] < b[0] ? -1 : 1),
    )
    return rows.slice(0, limit).map((row, i) => toHit(row, 1 / (i + 1)))
  }

  private foldedText(row: ShardDoc): string {
    const id = row[0]
    let text = this.textCache.get(id)
    if (text === undefined) {
      text = `${row[5]} . ${row[11]}`.toLowerCase().replace(/ё/g, 'е')
      if (this.textCache.size > 600) this.textCache.clear()
      this.textCache.set(id, text)
    }
    return text
  }

  private titleTerms(row: ShardDoc): Set<string> {
    const id = row[0]
    let terms = this.titleCache.get(id)
    if (!terms) {
      terms = new Set(analyzeTokens(row[5]).map((t) => t.term))
      if (this.titleCache.size > 3000) this.titleCache.clear()
      this.titleCache.set(id, terms)
    }
    return terms
  }
}

/** Russian stems a definition question asks about (the main concept words). */
function definitionTargets(q: AnalyzedQuery): string[] {
  return [...new Set(q.terms.filter((t) => t.weight >= 0.7 && /^[а-я]{3,}$/.test(t.term)).map((t) => t.term))].slice(0, 4)
}

const DEFINES_BEFORE = /(называ\S*|понима\S*|определя\S*)\s+(?:\S+\s+){0,2}$/
const DEFINES_AFTER = /^\S*\s*(?:\([^)]{0,40}\)\s*)?(?:—|–|-|:)\s*/

/** "X — это …", "X – вещества …", "… называются X", "под X понимают …" */
function definesTerm(text: string, stems: string[]): boolean {
  for (const stem of stems) {
    let from = 0
    for (let guard = 0; guard < 40; guard += 1) {
      const at = text.indexOf(stem, from)
      if (at < 0) break
      from = at + 1
      if (at > 0 && isWordChar(text.charCodeAt(at - 1))) continue
      if (DEFINES_BEFORE.test(text.slice(Math.max(0, at - 40), at))) return true
      const sentenceStart = at === 0 || /[.!?\n:]\s*$/.test(text.slice(Math.max(0, at - 3), at))
      if (sentenceStart && DEFINES_AFTER.test(text.slice(at + stem.length, at + stem.length + 60))) return true
    }
  }
  return false
}

function uniquePhrases(phrases: string[][]): string[][] {
  const seen = new Set<string>()
  const out: string[][] = []
  for (const ph of phrases) {
    if (ph.length < 2 || !ph.every((t) => /^[а-я]+$/.test(t))) continue
    const key = ph.join(' ')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(ph)
    if (out.length >= 8) break
  }
  return out
}

function isWordChar(code: number): boolean {
  return (
    (code >= 0x61 && code <= 0x7a) || // a-z
    (code >= 0x30 && code <= 0x39) || // 0-9
    (code >= 0x430 && code <= 0x44f) || // а-я
    code === 0x451 ||
    code === 0x27
  )
}

/**
 * Russian Snowball stems are prefixes of the lower-cased surface words, so "stem1 … stem2 with at most
 * two words in between" can be checked by scanning the chunk text directly (no re-tokenisation).
 */
function phraseInText(text: string, ph: string[]): boolean {
  let from = 0
  for (;;) {
    const start = text.indexOf(ph[0], from)
    if (start < 0) return false
    from = start + 1
    if (start > 0 && isWordChar(text.charCodeAt(start - 1))) continue
    let pos = start + ph[0].length
    let ok = true
    for (let k = 1; k < ph.length && ok; k += 1) {
      ok = false
      for (let skipped = 0; skipped <= 2; skipped += 1) {
        while (pos < text.length && isWordChar(text.charCodeAt(pos))) pos += 1 // rest of the current word
        while (pos < text.length && !isWordChar(text.charCodeAt(pos))) pos += 1 // separators
        if (pos >= text.length) break
        if (text.startsWith(ph[k], pos)) {
          pos += ph[k].length
          ok = true
          break
        }
      }
    }
    if (ok) return true
  }
}

export function toHit(row: ShardDoc, score: number): KbHit {
  const hit: KbChunk & { score: number } = {
    id: row[0],
    grade: row[1],
    title: row[5],
    type: row[8],
    lang: row[9],
    text: row[11],
    source: row[10],
    score: Number(score.toFixed(4)),
  }
  if (row[2] != null) hit.chapterId = row[2]
  if (row[3] != null) hit.sectionId = row[3]
  if (row[4] != null) hit.kp = row[4]
  if (row[6] != null) hit.pageStart = row[6]
  if (row[7] != null) hit.pageEnd = row[7]
  return hit
}
