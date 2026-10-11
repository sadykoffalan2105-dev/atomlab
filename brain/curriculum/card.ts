/**
 * «§-карточка» печатной единицы — короткая выжимка карты для подсказки модели (первое знание школьного ответа):
 * «Kimyo 8, §12 «…» (стр. 50–51). Понятия: … Определения: … Формулы: … Реакции: … Как в учебнике: …».
 * Язык служебных слов — язык вопроса; определения по-русски, если перевода нет (учебники русские);
 * термины uz/en — из глоссария (их кладёт в карту генератор).
 */
import type { Lang } from '../pipeline/normalize.ts'
import type { Unit } from './types.ts'

const W = {
  ru: { pages: (a: number, b: number) => (a === b || !b ? `стр. ${a}` : `стр. ${a}–${b}`), concepts: 'Понятия', defs: 'Определения', formulas: 'Формулы', rx: 'Реакции', how: (c: string) => `Как в учебнике: объяснять через ${c}, не выходить за уровень класса.`, q: ['«', '»'] },
  uz: { pages: (a: number, b: number) => (a === b || !b ? `${a}-bet` : `${a}–${b}-betlar`), concepts: 'Tushunchalar', defs: 'Taʼriflar', formulas: 'Formulalar', rx: 'Reaksiyalar', how: (c: string) => `Darslikdagidek: ${c} orqali tushuntiring, sinf darajasidan chiqmang.`, q: ['«', '»'] },
  en: { pages: (a: number, b: number) => (a === b || !b ? `p. ${a}` : `pp. ${a}–${b}`), concepts: 'Concepts', defs: 'Definitions', formulas: 'Formulas', rx: 'Reactions', how: (c: string) => `As in the textbook: explain through ${c}; stay within the grade level.`, q: ['“', '”'] },
} as const

const clip = (s: string, n: number) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/u, '') + '…')

/** Текст §-карточки на языке вопроса, не длиннее maxChars. */
export function unitCard(unit: Unit, lang: Lang, maxChars = 600): string {
  const w = W[lang] ?? W.ru
  const L = lang === 'uz' || lang === 'en' ? lang : 'ru'
  const title = L === 'ru' ? unit.title.ru : L === 'uz' ? (unit.title.uzSource === 'ru' ? unit.title.ru : unit.title.uz) : unit.title.en
  const pages = unit.pages.start ? ` (${w.pages(unit.pages.start, unit.pages.end)})` : ''
  const head = `${unit.label[L]} ${w.q[0]}${title}${w.q[1]}${pages}.`
  const concepts = unit.concepts.slice(0, 8).map((c) => (L === 'ru' ? c.ru : (c[L] ?? c.ru)))
  const parts: string[] = [head]
  if (concepts.length) parts.push(`${w.concepts}: ${concepts.join(', ')}.`)
  const defs = unit.definitions
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
      // заголовок и понятия — всегда (по ним карточка проходит проверку темы); остальное — пока влезает
      if (!out) return clip(p, maxChars)
      if (parts.indexOf(p) === 1) return clip(next, maxChars)
      continue
    }
    out = next
  }
  return out
}
