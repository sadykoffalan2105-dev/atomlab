import { matchFaqEntry } from './learnChemistryFaq'
import { CHEMISTRY_KNOWLEDGE_CHUNKS, type ChemistryKnowledgeChunk } from './learnChemistryKnowledgeBase'

export type RetrievedKnowledge = {
  chunks: ChemistryKnowledgeChunk[]
  faqHit: boolean
  score: number
}

function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[^\p{L}\p{N}+-]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2)
}

function scoreChunk(query: string, tokens: string[], chunk: ChemistryKnowledgeChunk): number {
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
    if (chunk.topic.toLowerCase().includes(tok)) score += 1
  }
  if (chunk.grades) {
    const gradeMatch = q.match(/\b([7-9]|1[01])\s*класс|\bgrade\s*([7-9]|1[01])\b/)
    if (gradeMatch) {
      const g = Number(gradeMatch[1] ?? gradeMatch[2])
      if (chunk.grades.includes(g)) score += 2
    }
  }
  return score
}

export function retrieveChemistryKnowledge(
  query: string,
  opts?: { maxChunks?: number; minScore?: number },
): RetrievedKnowledge {
  const maxChunks = opts?.maxChunks ?? 3
  const minScore = opts?.minScore ?? 3
  const tokens = tokenize(query)
  const faqHit = !!matchFaqEntry(query)

  const ranked = CHEMISTRY_KNOWLEDGE_CHUNKS.map((chunk) => ({
    chunk,
    score: scoreChunk(query, tokens, chunk),
  }))
    .filter((r) => r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxChunks)

  const totalScore = ranked.reduce((s, r) => s + r.score, 0) + (faqHit ? 5 : 0)

  return {
    chunks: ranked.map((r) => r.chunk),
    faqHit,
    score: totalScore,
  }
}

export function buildRetrievedKnowledgeBlock(
  query: string,
  locale: 'ru' | 'en',
  maxChars = 3200,
): string {
  const { chunks } = retrieveChemistryKnowledge(query, { maxChunks: 4, minScore: 2 })
  if (chunks.length === 0) return ''

  const parts: string[] = []
  let len = 0
  for (const c of chunks) {
    const text = locale === 'en' ? c.en : c.ru
    const header = `[${c.topic}${c.grades ? ` · ${c.grades.join('–')} кл.` : ''}]`
    const block = `${header}\n${text}`
    if (len + block.length > maxChars) break
    parts.push(block)
    len += block.length
  }
  return parts.join('\n\n---\n\n')
}
