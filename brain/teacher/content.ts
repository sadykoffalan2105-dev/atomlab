/**
 * Общие куски для плана и теста: язык единицы карты (название, понятия, термины — только на языке запроса,
 * иначе в «кавычках»), уравнения реакций (только уравненные — проверка balanceEquation), ссылки ATOMLAB.
 */
import type { CurriculumMap } from '../curriculum/map.ts'
import { sharedCurriculum } from '../curriculum/map.ts'
import type { Unit, UnitReaction, UnitTest } from '../curriculum/types.ts'
import type { Lang } from '../pipeline/normalize.ts'
import { balanceEquation } from '../pipeline/tools.ts'

export type TeacherLang = Lang

export function curriculum(): CurriculumMap | null {
  return sharedCurriculum()
}

export const L3 = <T,>(lang: Lang, ru: T, uz: T, en: T): T => (lang === 'ru' ? ru : lang === 'uz' ? uz : en)

/** Название единицы на языке запроса; перевода нет (uzSource 'ru') — русское в кавычках. */
export function unitTitle(u: Unit, lang: Lang): string {
  if (lang === 'ru') return u.title.ru
  if (lang === 'uz') return u.title.uzSource === 'ru' || !u.title.uz ? `«${u.title.ru}»` : u.title.uz
  return u.title.en && !/[а-яё]/i.test(u.title.en) ? u.title.en : `“${u.title.ru}”`
}

const BAD_TERM_HEAD = /^(у|в|на|при|из|по|для|от|с|к|и|а|но|если|когда|это|так|как|что|он|она|они)\s/iu
/** Термин годится для вопроса «Что такое …?»: короткий, без служебного начала и цифр-обрывков. */
function goodTerm(t: string | undefined, lang: Lang): t is string {
  if (!t) return false
  const s = t.trim()
  if (s.length < 3 || s.length > 48 || s.split(/\s+/).length > 4 || /[.;:!?]/.test(s)) return false
  if (lang === 'ru' && (!/^[а-яё]/iu.test(s) || BAD_TERM_HEAD.test(s))) return false
  if (lang !== 'ru' && /[а-яё]/iu.test(s)) return false
  return true
}

/** Понятия единицы на языке запроса (без повторов). */
export function unitConcepts(u: Unit, lang: Lang, max = 6): string[] {
  const out: string[] = []
  const push = (s: string | undefined) => {
    if (goodTerm(s, lang) && !out.some((x) => x.toLowerCase() === s.toLowerCase())) out.push(s)
  }
  for (const c of u.concepts) push(lang === 'ru' ? c.ru : c[lang])
  for (const d of u.definitions) push(lang === 'ru' ? d.term.ru : d.term[lang])
  return out.slice(0, max)
}

/** Определения учебника (только ru: учебники русские) с годным термином. */
export function unitDefinitions(u: Unit, max = 3): { term: string; text: string; page?: number }[] {
  const out: { term: string; text: string; page?: number }[] = []
  for (const d of u.definitions) {
    if (!goodTerm(d.term.ru, 'ru') || out.some((x) => x.term === d.term.ru)) continue
    const text = d.text.ru.trim()
    if (text.length < 15) continue
    out.push({ term: d.term.ru, text: text.length > 260 ? text.slice(0, 259).replace(/\s+\S*$/u, '') + '…' : text, ...(d.page ? { page: d.page } : {}) })
    if (out.length >= max) break
  }
  return out
}

/** Уравнение уравнено? (balanceEquation: коэффициенты есть — проверка; нет — все минимальные равны 1). */
export function isBalanced(eq: string): boolean {
  const b = balanceEquation(eq)
  if (!b || typeof b !== 'object') return false
  if (b.studentBalanced === true) return true
  if (b.studentBalanced === false) return false
  return [...b.reactants, ...b.products].every((s) => s.coeff === 1)
}

export type EqItem = { eq: string; ascii: string; type: string; labHref?: string; page?: number }

/** Реакции единицы, которые уравниваются (общие схемы, ионные и не уравниваемые — не берём). */
export function unitEquations(u: Unit, max = 4): EqItem[] {
  const out: EqItem[] = []
  for (const r of u.reactions) {
    if (out.length >= max) break
    if (r.isGeneral || r.isIonic || /[RX]\b|\be-|ē/.test(r.ascii)) continue
    const eq = fixedEquation(r)
    if (!eq || out.some((x) => x.eq === eq)) continue
    out.push({ eq, ascii: r.ascii, type: r.type, ...(r.labHref ? { labHref: r.labHref } : {}), ...(r.page ? { page: r.page } : {}) })
  }
  return out
}

/** Уравнение карты как есть, если уравнено; иначе — переуравненное balanceEquation; не уравнивается — null. */
function fixedEquation(r: UnitReaction): string | null {
  try {
    const b = balanceEquation(r.ascii)
    if (!b || typeof b !== 'object') return null
    if (b.studentBalanced === true && isBalanced(r.eq)) return r.eq
    return isBalanced(b.eq) ? b.eq : null
  } catch {
    return null
  }
}

export type LinkItem = { kind: 'book' | 'lesson' | 'reactor' | 'organic'; title: string; href: string }

const APP_SECTION_RE = /^(c\d{1,2})-(s\d{1,3})$/

/** Интерактивный урок ATOMLAB по разделу приложения карты («c2-s10» → /learn/g/g8/c/c2/s/s10); кривой id — null. */
export function lessonHref(u: Unit): string | null {
  const m = u.appSections[0]?.match(APP_SECTION_RE)
  return m ? `/learn/g/g${u.grade}/c/${m[1]}/s/${m[2]}` : null
}

/** Ссылки ATOMLAB: учебник на странице §, интерактивный урок раздела, 3D-реактор по реакциям карты, органика для органических тем. */
export function unitLinks(u: Unit, eqs: EqItem[], lang: Lang, max = 5): LinkItem[] {
  const out: LinkItem[] = []
  const g = `g${u.grade}`
  // ссылка в учебник — из src реакции карты (там номер страницы и id единицы читалки), иначе по странице §
  let book = `/learn/g/${g}/book${u.pages.start ? `?page=${u.pages.start}` : ''}`
  for (const r of u.reactions) {
    const src = r.labHref?.match(/[?&]src=([^&]+)/)?.[1]
    if (!src) continue
    try {
      const dec = decodeURIComponent(src)
      if (dec.startsWith(`/learn/g/${g}/book`)) book = dec.replace(/[?&]rx=[^&]*/g, '')
    } catch {
      /* битая ссылка — по странице */
    }
    break
  }
  out.push({ kind: 'book', title: L3(lang, `Учебник: ${u.label.ru}`, `Darslik: ${u.label.uz}`, `Textbook: ${u.label.en}`), href: book })
  const lesson = lessonHref(u)
  if (lesson) out.push({ kind: 'lesson', title: L3(lang, `Интерактивный урок ATOMLAB: ${u.label.ru}`, `ATOMLAB interaktiv darsi: ${u.label.uz}`, `ATOMLAB interactive lesson: ${u.label.en}`), href: lesson })
  for (const e of eqs) {
    if (out.length >= max) break
    if (e.labHref) out.push({ kind: 'reactor', title: L3(lang, `3D-реактор: ${e.eq}`, `3D-reaktor: ${e.eq}`, `3D reactor: ${e.eq}`), href: e.labHref })
  }
  if (u.domain === 'organic' && out.length < max) out.push({ kind: 'organic', title: L3(lang, 'Органика в 3D: модели молекул', 'Organika 3D: molekula modellari', 'Organic 3D: molecule models'), href: '/organic' })
  return out
}

/** Вопрос теста карты на языке запроса (нет перевода вопроса или вариантов — null). */
export function testOf(t: UnitTest, lang: Lang): { q: string; choices: string[]; correct: number; answer: string } | null {
  const q = lang === 'ru' ? t.q.ru : t.q[lang]
  const choices = lang === 'ru' ? t.choices?.ru : t.choices?.[lang]
  if (!q || !choices || choices.length < 2 || t.correct == null || t.correct < 0 || t.correct >= choices.length) return null
  if (lang !== 'ru' && /[а-яё]/iu.test(q + choices.join(' '))) return null
  return { q: q.trim(), choices, correct: t.correct, answer: choices[t.correct]! }
}
