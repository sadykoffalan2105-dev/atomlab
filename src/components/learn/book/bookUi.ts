/**
 * Интерактивный учебник — вспомогательные функции интерфейса (без React-компонентов).
 * Данные и типы — src/data/textbook/bookReader.ts.
 */
import { useSyncExternalStore } from 'react'
import { learnChapterById } from '../../../data/learnCurriculumUz'
import type { MessageKey } from '../../../i18n/messagesRu'
import type { LearnSection } from '../../../types/learn'
import type { ReaderGrade, ReaderReaction, ReaderUnit } from '../../../data/textbook/bookReader'

/** Коды отказа resolveReactorEquation → короткое объяснение в карточке реакции. */
const REASON_KEYS: Record<string, MessageKey> = {
  ionic: 'learn.book.rx.unsupported.ionic',
  scheme: 'learn.book.rx.unsupported.scheme',
  generalFormula: 'learn.book.rx.unsupported.generalFormula',
  unknownSubstance: 'learn.book.rx.unsupported.unknownSubstance',
  organic: 'learn.book.rx.unsupported.organic',
  noCompoundProduct: 'learn.book.rx.unsupported.noCompoundProduct',
  tooManyTerms: 'learn.book.rx.unsupported.tooManyTerms',
  unbalanced: 'learn.book.rx.unsupported.unbalanced',
}

export function reasonKey(code: string): MessageKey {
  return REASON_KEYS[code] ?? 'learn.book.rx.unsupported.other'
}

const TYPE_KEYS: Record<string, MessageKey> = {
  combination: 'learn.book.rx.type.combination',
  decomposition: 'learn.book.rx.type.decomposition',
  substitution: 'learn.book.rx.type.substitution',
  exchange: 'learn.book.rx.type.exchange',
  redox: 'learn.book.rx.type.redox',
  neutralization: 'learn.book.rx.type.neutralization',
  combustion: 'learn.book.rx.type.combustion',
  hydrolysis: 'learn.book.rx.type.hydrolysis',
  polymerization: 'learn.book.rx.type.polymerization',
  // органические типы § 1.6 учебника 10 класса
  addition: 'learn.book.rx.type.addition',
  elimination: 'learn.book.rx.type.elimination',
  isomerization: 'learn.book.rx.type.isomerization',
  condensation: 'learn.book.rx.type.condensation',
  polycondensation: 'learn.book.rx.type.polycondensation',
  radical: 'learn.book.rx.type.radical',
}

export function reactionTypeKey(type: string): MessageKey {
  return TYPE_KEYS[type] ?? 'learn.book.rx.type.other'
}

/**
 * Подпись реакции в тексте и в списке «В параграфе». У задания это текст из учебника («KOH + CO₂ → ...»):
 * уравнение — ответ, его показывает только карточка после «Показать ответ».
 */
export function reactionLabel(rx: ReaderReaction, t: (key: MessageKey) => string): string {
  if (!rx.exercise) return rx.equation
  return rx.asInBook || t('learn.book.rx.exerciseChip')
}

/**
 * Ссылка «одним кликом» с чипа: реактор, если реакция поддерживается, иначе запасная (органическая лаборатория).
 * У задания колбы нет — лаборатория показала бы ответ.
 */
export function reactionQuickHref(rx: ReaderReaction): string | null {
  if (rx.exercise) return null
  if (rx.lab.ok) return rx.lab.href
  return rx.lab.altHref ?? null
}

/** Запасная ссылка ведёт в органическую лабораторию. */
export const isOrganicLabHref = (href: string | null | undefined) => !!href && href.startsWith('/organic')

/** «Уравнять самому»: та же ссылка + balance=1. */
export function reactionBalanceHref(rx: ReaderReaction): string | null {
  if (!rx.lab.ok) return null
  return `${rx.lab.href}${rx.lab.href.includes('?') ? '&' : '?'}balance=1`
}

/** Каталог «Реакции», вкладка реакций учебника с подсветкой этой реакции (grade/unit/rx). */
export function catalogReactionHref(gradeId: string, unitId: string, rxId: string): string {
  const q = new URLSearchParams({ view: 'reactions', grade: gradeId, unit: unitId, rx: rxId })
  return `/catalog?${q.toString()}`
}

/** «c4-s04» → { chapterId: 'c4', sectionId: 's04' }. */
export function splitAppSection(key: string | undefined | null): { chapterId: string; sectionId: string } | null {
  if (!key) return null
  const m = /^(c\d+)-(s\d+)$/.exec(key)
  return m ? { chapterId: m[1]!, sectionId: m[2]! } : null
}

/**
 * Ключ раздела в данных учебника («c4-s04», как в kb-sections.json) — это ПОРЯДКОВЫЙ номер раздела в главе
 * приложения. В 7/9/10/11 классах id разделов идут подряд (s01, s02…) и совпадают с номером, а в 8 классе —
 * нет: в главе c4 разделы s21…s31, поэтому «c4-s04» = s24.
 */
export function appSectionFromKey(
  gradeId: string,
  key: string | undefined | null,
): { chapterId: string; sectionId: string; section: LearnSection } | null {
  const parts = splitAppSection(key)
  if (!parts) return null
  const chapter = learnChapterById(gradeId, parts.chapterId)
  if (!chapter) return null
  const n = Number(parts.sectionId.slice(1))
  const section = chapter.sections[n - 1] ?? chapter.sections.find((s) => s.id === parts.sectionId)
  return section ? { chapterId: chapter.id, sectionId: section.id, section } : null
}

/** Обратное преобразование: раздел приложения (c4, s24) → ключ данных учебника «s04». */
export function bookSectionKey(gradeId: string, chapterId: string, sectionId: string): string {
  const idx = learnChapterById(gradeId, chapterId)?.sections.findIndex((s) => s.id === sectionId) ?? -1
  return idx >= 0 ? `s${String(idx + 1).padStart(2, '0')}` : sectionId
}

/**
 * Раздел приложения для контекста урока / ИИ-учителя. У практикумов и вводных § своего раздела нет —
 * берём ближайший параграф с разделом (сначала назад по книге, потом вперёд).
 */
export function unitContextSection(grade: ReaderGrade, unit: ReaderUnit): string | null {
  if (unit.appSections[0]) return unit.appSections[0]
  const i = grade.units.findIndex((u) => u.unitId === unit.unitId)
  for (let d = 1; d < grade.units.length; d++) {
    const back = grade.units[i - d]
    if (back?.appSections[0]) return back.appSections[0]
    const fwd = grade.units[i + d]
    if (fwd?.appSections[0]) return fwd.appSections[0]
  }
  return null
}

/** Номер параграфа для бейджа: «§ 24», «§ 1.1», «Практикум». */
export function unitKpLabel(unit: ReaderUnit, t: (key: MessageKey) => string): string | null {
  if (!unit.kp) return null
  if (unit.kp === 'lab' || unit.unitId === 'lab') return t('learn.book.labKp')
  return `§ ${unit.kp}`
}

export function unitPagesLabel(
  unit: ReaderUnit,
  t: (key: MessageKey, params?: Readonly<Record<string, string | number>>) => string,
): string | null {
  const { pageStart: a, pageEnd: b } = unit
  if (a == null) return null
  if (b == null || b === a) return t('learn.book.page', { n: a })
  return t('learn.book.pages', { from: a, to: b })
}

export function capitalizeFirst(s: string): string {
  return s ? s.charAt(0).toLocaleUpperCase('ru-RU') + s.slice(1) : s
}

const LAST_UNIT_PREFIX = 'atomlab-book-last-'

export function readLastUnit(gradeId: string): string | null {
  try {
    return localStorage.getItem(LAST_UNIT_PREFIX + gradeId)
  } catch {
    return null
  }
}

export function rememberLastUnit(gradeId: string, unitId: string): void {
  try {
    localStorage.setItem(LAST_UNIT_PREFIX + gradeId, unitId)
  } catch {
    /* приватный режим / квота — просто не запоминаем */
  }
}

/** DOM-id якорей: чипа реакции и разделителя страницы (для ?rx= и ?page=). */
export const rxAnchorId = (rxId: string) => `book-rx-${rxId}`
export const pageAnchorId = (page: number) => `book-page-${page}`

function subscribeMedia(query: string) {
  return (cb: () => void) => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
    const mq = window.matchMedia(query)
    mq.addEventListener('change', cb)
    return () => mq.removeEventListener('change', cb)
  }
}

const mediaSubscribers = new Map<string, (cb: () => void) => () => void>()

/** Подписка на media query (узкий экран → нижний лист вместо поповера, свёрнутые блоки). */
export function useMediaQuery(query: string): boolean {
  let subscribe = mediaSubscribers.get(query)
  if (!subscribe) {
    subscribe = subscribeMedia(query)
    mediaSubscribers.set(query, subscribe)
  }
  return useSyncExternalStore(
    subscribe,
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches,
    () => false,
  )
}

export const NARROW_QUERY = '(max-width: 720px)'
export const WIDE_QUERY = '(min-width: 1200px)'
