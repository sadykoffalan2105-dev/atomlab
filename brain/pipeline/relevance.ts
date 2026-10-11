/**
 * Тематическая релевантность найденного (после BM25/векторов, до MMR): фрагмент должен быть О ВОПРОСЕ,
 * а не просто делить с ним корень слова.
 *
 *   понятия вопроса — группы термов из KbEngine.analyzeQuery (рус. основа + перевод uz/en + формула), вес понятия;
 *   «сильные» понятия — вес ≥ 0.5 (незнакомые слова uz/en с весом 0.3 не решают);
 *   cov   — доля веса сильных понятий, встреченных во фрагменте (заголовок + текст);
 *   титул — термин понятия есть в заголовке.
 *
 * Правила (порог):
 *   • совпадение только по имени собственному (вопрос «голубое» ↔ во фрагменте лишь «Голубев», «Голубева») не считается;
 *   • карточки учёных и статьи-персоналии — только для вопросов «кто/история» (allowPeople);
 *   • 1–2 понятия: школьный фрагмент (Kimyo, ATOMLAB) — при cov = 1 или cov ≥ 0.5 и понятии в заголовке;
 *     энциклопедия, указатель и прочее — только при cov = 1;
 *   • 3 понятия: cov ≥ 2/3 и (школьный или понятие в заголовке); ≥ 4: cov ≥ 0.5 или cov ≥ 0.35 и (школьный или заголовок);
 *   • для школьных вопросов (не «кто/история/промышленность») — Kimyo ×1.2, ATOMLAB ×1.1, Википедия ×0.8, указатель ×0.9;
 *     итоговый балл ×(0.6 + 0.4·cov).
 * Ничего не прошло — пусто: модель отвечает из своих знаний с честной уверенностью (без мусорной «справки»).
 */
import { analyzeTerms } from '../../src/learn/kb/analyzer.ts'
import type { Candidate } from './hybrid.ts'

export type QueryConcepts = { terms: { term: string; concept: number; weight: number }[]; conceptWeights: number[] }

export type RelevanceVerdict = { keep: boolean; cov: number; titleHit: boolean; why?: string }

const SCHOOL_TYPES = new Set(['textbook', 'definition', 'summary', 'card', 'faq', 'misconception', 'megapack', 'qa', 'correction', 'fact', 'note'])

export function isPersonCandidate(c: Pick<Candidate, 'source' | 'title' | 'type' | 'text'>): boolean {
  if (/учён|scientist|olim/iu.test(c.source)) return true
  // статья-персоналия: «Фамилия, Имя Отчество» или «Имя Фамилия» и годы жизни в начале текста
  if (c.type === 'encyclopedia') {
    if (/^\p{Lu}\p{Ll}+,\s+\p{Lu}\p{Ll}+/u.test(c.title)) return true
    if (/^\p{Lu}\p{Ll}+(\s+\p{Lu}\.?\p{Ll}*){1,2}$/u.test(c.title.trim()) && /\(\s*\d{1,2}?\s*\p{L}*\s*\d{3,4}\s*[,—–-]/u.test(c.text.slice(0, 200))) return true
  }
  return false
}

export function isSchoolCandidate(c: Pick<Candidate, 'source' | 'type'>): boolean {
  if (c.type === 'encyclopedia' || c.type === 'index') return false
  if (/^Kimyo/i.test(c.source) || /^ATOMLAB/i.test(c.source)) return true
  return SCHOOL_TYPES.has(c.type)
}

// ——— «совпало только по имени собственному»
const stemCache = new Map<string, string[]>()
function stemsOf(word: string): string[] {
  const k = word.toLowerCase()
  let v = stemCache.get(k)
  if (!v) {
    v = analyzeTerms(word)
    if (stemCache.size > 50_000) stemCache.clear()
    stemCache.set(k, v)
  }
  return v
}

/** Термы, которые в вопросе написаны со строчной (не имена собственные) — их «фамильные» совпадения не считаем. */
export function lowercaseTerms(question: string): Set<string> {
  const out = new Set<string>()
  for (const m of question.matchAll(/\p{L}[\p{L}-]*/gu)) {
    if (/^\p{Lu}/u.test(m[0]) && (m.index ?? 0) > 0) continue
    for (const t of stemsOf(m[0])) out.add(t)
  }
  return out
}

/** Терм встречается во фрагменте хотя бы раз НЕ как имя собственное (заглавная буква в середине предложения). */
function genericOccurrence(term: string, title: string, text: string): boolean {
  for (const part of [title, text.slice(0, 2500)]) {
    for (const m of part.matchAll(/\p{L}[\p{L}-]*/gu)) {
      const w = m[0]
      if (!stemsOf(w).includes(term)) continue
      const i = m.index ?? 0
      const before = part.slice(Math.max(0, i - 3), i)
      const sentenceStart = i === 0 || /[.!?…\n«"(:]\s*$/u.test(before)
      if (!/^\p{Lu}/u.test(w) || sentenceStart) return true
    }
  }
  return false
}

export function judge(c: Candidate, q: QueryConcepts, lower: Set<string>, allowPeople: boolean): RelevanceVerdict {
  if (c.kind === 'correction') return { keep: true, cov: 1, titleHit: true }
  if (!allowPeople && isPersonCandidate(c)) return { keep: false, cov: 0, titleHit: false, why: 'person' }
  const strong = q.conceptWeights.map((w, i) => ({ w, i })).filter((x) => x.w >= 0.5)
  const concepts = strong.length ? strong : q.conceptWeights.map((w, i) => ({ w, i }))
  if (!concepts.length) return { keep: true, cov: 1, titleHit: false }
  let total = 0
  let covered = 0
  let titleHit = false
  for (const { w, i } of concepts) {
    total += w
    const terms = q.terms.filter((t) => t.concept === i && t.weight >= 0.3).map((t) => t.term)
    const hit = terms.filter((t) => c.terms.has(t))
    if (!hit.length) continue
    // все совпадения — по имени собственному («Голубева» на вопрос «голубое»)? тогда не в счёт
    const real = hit.some((t) => !lower.has(t) || /\d/.test(t) || t.length <= 2 || genericOccurrence(t, c.title, c.text))
    if (!real) continue
    covered += w
    if (hit.some((t) => c.titleTerms.has(t))) titleHit = true
  }
  const cov = total ? covered / total : 0
  const n = concepts.length
  const school = isSchoolCandidate(c)
  let keep: boolean
  if (cov >= 0.999) keep = true
  else if (n >= 4) keep = cov >= 0.5 || (cov >= 0.35 && (school || titleHit)) // длинный вопрос: часть слов — связки и уточнения
  else if (n === 3) keep = cov >= 0.66 && (school || titleHit)
  else keep = school && cov >= 0.5 && titleHit
  return { keep, cov, titleHit, why: keep ? undefined : `cov ${cov.toFixed(2)}${titleHit ? '' : ', не в заголовке'}` }
}

/** Отфильтровать и перевзвесить кандидатов (после hybridScore). schoolQuestion — не «кто/история/промышленность». */
export function applyRelevance(cands: Candidate[], q: QueryConcepts, question: string, opts: { allowPeople: boolean; schoolQuestion: boolean; pool?: number }): { kept: Candidate[]; dropped: { c: Candidate; why: string }[] } {
  const lower = lowercaseTerms(question)
  const pool = [...cands].sort((a, b) => b.score - a.score).slice(0, opts.pool ?? 60)
  const kept: Candidate[] = []
  const dropped: { c: Candidate; why: string }[] = []
  for (const c of pool) {
    const v = judge(c, q, lower, opts.allowPeople)
    if (!v.keep) {
      dropped.push({ c, why: v.why ?? '' })
      continue
    }
    let boost = 0.6 + 0.4 * v.cov
    if (opts.schoolQuestion) {
      if (/^Kimyo/i.test(c.source)) boost *= 1.2
      else if (/^ATOMLAB/i.test(c.source)) boost *= 1.1
      if (c.type === 'encyclopedia') boost *= 0.8
      else if (c.type === 'index') boost *= 0.9
    }
    c.score *= boost
    kept.push(c)
  }
  return { kept, dropped }
}
