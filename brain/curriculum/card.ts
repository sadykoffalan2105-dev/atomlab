/**
 * «§-карточка» печатной единицы — короткая выжимка карты для подсказки модели (первое знание школьного ответа):
 * «Kimyo 8, §12 «…» (стр. 50–51). Понятия: … Определения: … Формулы: … Реакции: … Как в учебнике: …».
 * Язык служебных слов — язык вопроса; определения по-русски, если перевода нет (учебники русские);
 * термины uz/en — из глоссария (их кладёт в карту генератор).
 */
import { analyzeTerms } from '../../src/learn/kb/analyzer.ts'
import type { Lang } from '../pipeline/normalize.ts'
import type { Unit } from './types.ts'

const W = {
  // «стр.50–51» без пробела: точка с пробелом рвёт первое предложение карточки у разбивщиков на предложения
  ru: { pages: (a: number, b: number) => (a === b || !b ? `стр.${a}` : `стр.${a}–${b}`), concepts: 'Понятия', defs: 'Определения', formulas: 'Формулы', rx: 'Реакции', how: (c: string) => `Как в учебнике: объяснять через ${c}, не выходить за уровень класса.`, q: ['«', '»'] },
  uz: { pages: (a: number, b: number) => (a === b || !b ? `${a}-bet` : `${a}–${b}-betlar`), concepts: 'Tushunchalar', defs: 'Taʼriflar', formulas: 'Formulalar', rx: 'Reaksiyalar', how: (c: string) => `Darslikdagidek: ${c} orqali tushuntiring, sinf darajasidan chiqmang.`, q: ['«', '»'] },
  en: { pages: (a: number, b: number) => (a === b || !b ? `p.${a}` : `pp.${a}–${b}`), concepts: 'Concepts', defs: 'Definitions', formulas: 'Formulas', rx: 'Reactions', how: (c: string) => `As in the textbook: explain through ${c}; stay within the grade level.`, q: ['“', '”'] },
} as const

const clip = (s: string, n: number) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/u, '') + '…')

/**
 * Текст §-карточки на языке вопроса, не длиннее maxChars. queryTerms (стемы вопроса) — понятия и определения по теме
 * вопроса идут первыми (короткая модель и обрезка по длине не теряют «алмаз» в §8 о группе углерода).
 */
export function unitCard(unit: Unit, lang: Lang, maxChars = 600, queryTerms?: Set<string>): string {
  const hits = (s: string) => (queryTerms?.size ? analyzeTerms(s).filter((t) => queryTerms.has(t)).length : 0)
  const byQuery = <T,>(xs: T[], text: (x: T) => string): T[] =>
    queryTerms?.size ? xs.map((x, i) => ({ x, i, h: hits(text(x)) })).sort((a, b) => b.h - a.h || a.i - b.i).map((y) => y.x) : xs
  const w = W[lang] ?? W.ru
  const L = lang === 'uz' || lang === 'en' ? lang : 'ru'
  const title = L === 'ru' ? unit.title.ru : L === 'uz' ? (unit.title.uzSource === 'ru' ? unit.title.ru : unit.title.uz) : unit.title.en
  const pages = unit.pages.start ? ` (${w.pages(unit.pages.start, unit.pages.end)})` : ''
  const concepts = byQuery(unit.concepts, (c) => c.ru).slice(0, 8).map((c) => (L === 'ru' ? c.ru : (c[L] ?? c.ru)))
  // заголовок и понятия — одним предложением: первое предложение карточки уже о содержании, а не только «§12, стр.»
  const head = `${unit.label[L]} ${w.q[0]}${title}${w.q[1]}${pages}${concepts.length ? ` — ${w.concepts.toLowerCase()}: ${concepts.join(', ')}` : ''}.`
  const parts: string[] = [head]
  const defs = byQuery(unit.definitions, (d) => `${d.term.ru} ${d.text.ru}`)
    .filter((d, i, a) => a.findIndex((x) => x.term.ru === d.term.ru) === i)
    .slice(0, 2)
    .map((d) => clip(d.text.ru.replace(/\.$/, ''), 160))
  if (defs.length) parts.push(`${w.defs}: ${defs.join('; ')}.`)
  if (unit.formulas.length) parts.push(`${w.formulas}: ${unit.formulas.slice(0, 4).join('; ')}.`)
  const rx = unit.reactions.filter((r) => !r.isGeneral).slice(0, 3).map((r) => r.eq)
  if (rx.length) parts.push(`${w.rx}: ${rx.join('; ')}.`)
  if (concepts.length) parts.push(w.how(concepts.slice(0, 3).join(', ')))
  let out = ''
  for (const p of parts) {
    const next = out ? `${out} ${p}` : p
    if (next.length > maxChars) {
      // заголовок с понятиями — всегда (по ним карточка проходит проверку темы); остальное — пока влезает
      if (!out) return clip(p, maxChars)
      continue
    }
    out = next
  }
  return out
}
