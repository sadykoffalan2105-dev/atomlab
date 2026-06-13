import { matchFaqEntry, LEARN_CHEMISTRY_FAQ } from './learnChemistryFaq'
import { CHEMISTRY_KNOWLEDGE_CHUNKS, type ChemistryKnowledgeChunk } from './learnChemistryKnowledgeBase'
import {
  findG7TextbookByQuery,
  g7TextbookKnowledgeChunks,
  getG7TextbookByTopicNumber,
  parseRequestedTopicNumber,
} from './learnG7TextbookKnowledge'

const ALL_KNOWLEDGE_CHUNKS: ChemistryKnowledgeChunk[] = [
  ...CHEMISTRY_KNOWLEDGE_CHUNKS,
  ...g7TextbookKnowledgeChunks(),
]

export type RetrievedKnowledge = {
  chunks: ChemistryKnowledgeChunk[]
  faqHit: boolean
  score: number
}

export type RetrieveOptions = {
  maxChunks?: number
  minScore?: number
  gradeId?: string
  chapterId?: string
  sectionId?: string
  sectionTitle?: string
}

const SYNONYMS: Record<string, string[]> = {
  кислот: ['acid', 'ph', 'proton', 'h+', 'кислотн'],
  щелоч: ['base', 'alkali', 'гидроксид', 'oh'],
  реакц: ['reaction', 'уравнен', 'equation'],
  молекул: ['molecule', 'структур', '3d'],
  атом: ['atom', 'электрон', 'ядро', 'proton'],
  металл: ['metal', 'металлич'],
  неметалл: ['nonmetal'],
  окислен: ['oxidation', 'овр', 'redox', 'электрон'],
  раствор: ['solution', 'solvent', 'растворим'],
  газ: ['gas', 'пар', 'vapor'],
  задач: ['problem', 'расчёт', 'вычисл', 'стехиометр'],
  орган: ['organic', 'углеводород', 'алкан', 'алкен'],
  таблиц: ['periodic', 'менделеев', 'element'],
  формул: ['formula', 'состав', 'индекс'],
  связ: ['bond', 'ionic', 'covalent', 'ионн', 'ковалент'],
}

function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[^\p{L}\p{N}+-]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2)
}

function expandTokens(tokens: string[]): string[] {
  const out = new Set(tokens)
  for (const t of tokens) {
    for (const [stem, syns] of Object.entries(SYNONYMS)) {
      if (t.includes(stem) || stem.includes(t)) {
        syns.forEach((s) => out.add(s))
      }
    }
  }
  return [...out]
}

function parseGrade(gradeId?: string): number | null {
  if (!gradeId) return null
  const m = gradeId.match(/g(\d+)/)
  return m ? Number(m[1]) : null
}

function scoreChunk(
  query: string,
  tokens: string[],
  chunk: ChemistryKnowledgeChunk,
  opts?: RetrieveOptions,
): number {
  const q = query.toLowerCase()
  let score = 0
  for (const kw of chunk.keywords) {
    const k = kw.toLowerCase()
    if (q.includes(k)) score += k.length >= 5 ? 4 : k.length >= 3 ? 2 : 1
  }
  for (const tok of tokens) {
    if (chunk.keywords.some((kw) => kw.toLowerCase().includes(tok) || tok.includes(kw.toLowerCase()))) {
      score += 1
    }
    if (chunk.topic.toLowerCase().includes(tok)) score += 2
    const body = `${chunk.ru} ${chunk.en}`.toLowerCase()
    if (tok.length >= 4 && body.includes(tok)) score += 1
  }

  const grade = parseGrade(opts?.gradeId)
  if (grade && chunk.grades?.includes(grade)) score += 3

  if (chunk.textbook && opts?.gradeId === 'g7') {
    score += 4
    if (opts.chapterId && chunk.textbook.chapterId === opts.chapterId) score += 6

    const requestedKp = parseRequestedTopicNumber(query)

    if (requestedKp !== null) {
      const hit = getG7TextbookByTopicNumber(requestedKp, opts.chapterId)
      if (
        hit &&
        chunk.textbook &&
        hit.section.chapterId === chunk.textbook.chapterId &&
        hit.section.sectionId === chunk.textbook.sectionId
      ) {
        score += 50
      }
    } else if (opts.sectionId && chunk.textbook.sectionId === opts.sectionId) {
      score += 14
    }

    if (opts.sectionTitle && requestedKp === null) {
      const st = opts.sectionTitle.toLowerCase()
      if (chunk.topic.toLowerCase().includes(st.slice(0, 20)) || st.includes(chunk.textbook.sectionId)) {
        score += 5
      }
    }
  }

  if (opts?.sectionTitle) {
    const st = opts.sectionTitle.toLowerCase()
    for (const tok of tokens) {
      if (st.includes(tok) && tok.length >= 4) score += 2
    }
  }

  const gradeMatch = q.match(/\b([7-9]|1[01])\s*класс|\bgrade\s*([7-9]|1[01])\b/)
  if (gradeMatch && chunk.grades) {
    const g = Number(gradeMatch[1] ?? gradeMatch[2])
    if (chunk.grades.includes(g)) score += 2
  }
  return score
}

export function retrieveChemistryKnowledge(
  query: string,
  opts?: RetrieveOptions,
): RetrievedKnowledge {
  const maxChunks = opts?.maxChunks ?? 6
  const minScore = opts?.minScore ?? 1
  const tokens = expandTokens(tokenize(query))
  const faqHit = !!matchFaqEntry(query)

  const ranked = ALL_KNOWLEDGE_CHUNKS.map((chunk) => ({
    chunk,
    score: scoreChunk(query, tokens, chunk, opts),
  }))
    .filter((r) => r.score >= minScore)
    .sort((a, b) => b.score - a.score)

  const directTextbook = findG7TextbookByQuery(query, { chapterId: opts?.chapterId })
  if (directTextbook) {
    const directChunk = ranked.find(
      (r) =>
        r.chunk.id === directTextbook.id || r.chunk.id.startsWith(`${directTextbook.id}-p`),
    )
    if (directChunk) directChunk.score += 25
    else {
      const hit = ALL_KNOWLEDGE_CHUNKS.find(
        (c) => c.id === directTextbook.id || c.id.startsWith(`${directTextbook.id}-p`),
      )
      if (hit) ranked.push({ chunk: hit, score: 30 })
    }
  }

  const top = ranked.sort((a, b) => b.score - a.score).slice(0, maxChunks)

  const totalScore = top.reduce((s, r) => s + r.score, 0) + (faqHit ? 8 : 0)

  return {
    chunks: top.map((r) => r.chunk),
    faqHit,
    score: totalScore,
  }
}

export type BuildBlockOptions = {
  maxChars?: number
  gradeId?: string
  chapterId?: string
  sectionId?: string
  sectionTitle?: string
  preloaded?: RetrievedKnowledge
}

export function buildRetrievedKnowledgeBlock(
  query: string,
  locale: 'ru' | 'en',
  maxCharsOrOpts: number | BuildBlockOptions = 5500,
): string {
  const opts: BuildBlockOptions =
    typeof maxCharsOrOpts === 'number' ? { maxChars: maxCharsOrOpts } : maxCharsOrOpts
  const maxChars = opts.maxChars ?? 5500

  const faq = matchFaqEntry(query)
  const { chunks } =
    opts.preloaded ??
    retrieveChemistryKnowledge(query, {
      maxChunks: 10,
      minScore: 1,
      gradeId: opts.gradeId,
      chapterId: opts.chapterId,
      sectionId: opts.sectionId,
      sectionTitle: opts.sectionTitle,
    })

  const parts: string[] = []
  let len = 0

  if (faq) {
    const faqText = locale === 'en' ? faq.en : faq.ru
    const block = `[Reference · ${locale === 'en' ? 'FAQ' : 'типовой вопрос'}]\n${faqText}`
    parts.push(block)
    len += block.length
  }

  for (const c of chunks) {
    const text = locale === 'en' ? c.en : c.ru
    const bookTag = c.textbook ? (locale === 'en' ? ' · textbook' : ' · учебник') : ''
    const header = `[${c.topic}${c.grades ? ` · grades ${c.grades.join('-')}` : ''}${bookTag}]`
    const block = `${header}\n${text}`
    if (len + block.length > maxChars) break
    parts.push(block)
    len += block.length
  }

  if (parts.length === 0 && tokensFallback(query)) {
    for (const entry of LEARN_CHEMISTRY_FAQ) {
      let s = 0
      for (const kw of entry.keywords) {
        if (query.toLowerCase().includes(kw.toLowerCase())) s++
      }
      if (s >= 1) {
        parts.push(locale === 'en' ? entry.en : entry.ru)
        break
      }
    }
  }

  return parts.join('\n\n---\n\n')
}

function tokensFallback(query: string): boolean {
  return query.trim().length >= 3
}
