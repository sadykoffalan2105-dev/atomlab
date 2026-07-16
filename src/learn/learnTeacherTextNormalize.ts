import type { AssistantLocale } from './learnAssistantLocale'

/** § / стр. / p. / -bet → полные слова на языке UI (и в чате, и для озвучки). */
export function normalizeTeacherReplyText(text: string, locale: AssistantLocale): string {
  let t = text

  if (locale === 'ru') {
    t = t
      .replace(/§\s*(\d+)/g, 'параграф $1')
      .replace(/\bстр\.?\s*(\d+)/gi, 'страница $1')
      .replace(/\bp\.?\s*(\d+)\b/gi, 'страница $1')
      .replace(/(\d+)\s*-?\s*bet\b/gi, 'страница $1')
      .replace(/\bsahifa\s+(\d+)/gi, 'страница $1')
  } else if (locale === 'uz') {
    t = t
      .replace(/§\s*(\d+)/g, 'paragraf $1')
      .replace(/\bстр\.?\s*(\d+)/gi, 'sahifa $1')
      .replace(/\bp\.?\s*(\d+)\b/gi, 'sahifa $1')
      .replace(/(\d+)\s*-?\s*bet\b/gi, 'sahifa $1')
      .replace(/\bpage\s+(\d+)/gi, 'sahifa $1')
      .replace(/\bparagraph\s+(\d+)/gi, 'paragraf $1')
      .replace(/\bsection\s+(\d+)/gi, 'paragraf $1')
  } else {
    t = t
      .replace(/§\s*(\d+)/g, 'paragraph $1')
      .replace(/\bстр\.?\s*(\d+)/gi, 'page $1')
      .replace(/\bp\.?\s*(\d+)\b/gi, 'page $1')
      .replace(/(\d+)\s*-?\s*bet\b/gi, 'page $1')
      .replace(/\bsahifa\s+(\d+)/gi, 'page $1')
      .replace(/\bparagraf\s+(\d+)/gi, 'paragraph $1')
  }

  return t
}

/** Доля кириллицы — чтобы не вставлять русский текст в EN/UZ ответ. */
export function isMostlyCyrillic(text: string): boolean {
  const cyr = (text.match(/[\u0400-\u04FF]/g) ?? []).length
  const lat = (text.match(/[A-Za-z]/g) ?? []).length
  if (cyr + lat < 24) return cyr > lat
  return cyr >= lat * 0.45 && cyr >= 20
}

/** Текст можно безопасно вставить в ответ на данном языке. */
export function isSafeBodyForLocale(text: string, locale: AssistantLocale): boolean {
  const t = text.trim()
  if (t.length < 12) return false
  if (locale === 'ru') return true
  if (isMostlyCyrillic(t)) return false
  if (locale === 'en') return true
  // uz: только текст с узбекскими маркерами — не английский FAQ/учебник
  return /[ʻʼ''']|[oO][''ʻ’]|[gG][''ʻ’]|\b(va|bu|uchun|kerak|mavzu|paragraf|sahifa|kimyo|modda|aralashma|reaksiya|tushuntir)\b/i.test(
    t,
  )
}

export function paragraphLabel(locale: AssistantLocale, n: number): string {
  if (locale === 'uz') return `paragraf ${n}`
  if (locale === 'en') return `paragraph ${n}`
  return `параграф ${n}`
}

export function pageLabel(locale: AssistantLocale, n: number): string {
  if (locale === 'uz') return `sahifa ${n}`
  if (locale === 'en') return `page ${n}`
  return `страница ${n}`
}
