import { compoundsSortedForMatch } from '../data/compounds'
import { ELEMENTS, getElementBySymbol } from '../data/elements'
import type { LearnLocalAssistantContext } from './learnLocalAssistant'
import { topicSceneVisualId } from './learnTopicScenes'
import type { LearnGradeId } from '../types/learn'

const ELEMENT_SYMBOLS = new Set(ELEMENTS.map((e) => e.symbol.toLowerCase()))

function normalizeQuery(q: string): string {
  return q
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/₂/g, '2')
    .replace(/₃/g, '3')
    .replace(/₄/g, '4')
    .replace(/₅/g, '5')
    .replace(/₆/g, '6')
    .replace(/₇/g, '7')
    .replace(/₈/g, '8')
    .replace(/₉/g, '9')
    .replace(/₀/g, '0')
    .replace(/[^\p{L}\p{N}\s+\-()]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(q: string): string[] {
  return normalizeQuery(q)
    .split(' ')
    .filter((t) => t.length >= 2)
}

function scoreCompound(
  nameRu: string,
  formula: string,
  desc: string,
  tokens: string[],
  raw: string,
): number {
  const hay = normalizeQuery(`${nameRu} ${formula} ${desc}`)
  let score = 0
  for (const t of tokens) {
    if (hay.includes(t)) score += 2
  }
  if (raw.includes(nameRu.toLowerCase())) score += 5
  if (formula && raw.includes(formula.toLowerCase())) score += 4
  return score
}

function findElementsInQuery(q: string): (typeof ELEMENTS)[number][] {
  const found: (typeof ELEMENTS)[number][] = []
  const raw = normalizeQuery(q)

  for (const el of ELEMENTS) {
    const sym = el.symbol.toLowerCase()
    const name = el.nameRu.toLowerCase()
    if (raw.includes(sym) || raw.includes(name)) {
      found.push(el)
    }
  }

  const symMatches = q.match(/\b[A-Z][a-z]?[a-z]?\b/g) ?? []
  for (const m of symMatches) {
    if (m.length <= 3 && ELEMENT_SYMBOLS.has(m.toLowerCase())) {
      const el = getElementBySymbol(m)
      if (el && !found.some((f) => f.z === el.z)) found.push(el)
    }
  }

  return found.slice(0, 4)
}

export function buildAssistantKnowledgeBlock(
  userQuery: string,
  ctx: LearnLocalAssistantContext,
): { block: string; topicSceneId: string } {
  const tokens = tokenize(userQuery)
  const raw = normalizeQuery(userQuery)
  const lines: string[] = []

  const topicSceneId = topicSceneVisualId({
    gradeId: ctx.gradeId as LearnGradeId,
    chapterId: ctx.chapterId,
    id: ctx.sectionId,
  })

  const compounds = compoundsSortedForMatch()
    .map((c) => ({
      c,
      score: scoreCompound(c.nameRu, c.formulaUnicode, c.descriptionRu, tokens, raw),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  if (compounds.length > 0) {
    lines.push('Matching compounds in ATOMLAB catalog:')
    for (const { c } of compounds) {
      lines.push(
        `- ${c.nameRu} (${c.formulaUnicode}), id=${c.id}, category=${c.category}: ${c.descriptionRu.slice(0, 120)}`,
      )
    }
  }

  const elements = findElementsInQuery(userQuery)
  if (elements.length > 0) {
    lines.push('Relevant elements:')
    for (const el of elements) {
      lines.push(
        `- ${el.symbol} Z=${el.z} ${el.nameRu}, mass≈${el.atomicMass}, state: ${el.standardState}, ox: ${el.oxidationStates}`,
      )
    }
  }

  if (lines.length === 0 && tokens.length > 0) {
    lines.push('(No direct catalog match — use general chemistry knowledge.)')
  }

  return {
    block: lines.join('\n').slice(0, 3500),
    topicSceneId,
  }
}
