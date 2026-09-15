/**
 * Ссылки на источники в ответах учителя → компактные «чипы» ([Kimyo 8, §12]).
 *
 * Ответ может содержать ссылки в разных видах:
 *   [Kimyo 8, §12]  ·  [Химия 8, параграф 12]  ·  [Источник: Учебник 7, стр. 34]
 *   строку «Источник: …» / «Источники: A; B» / «Source: …» / «Manba: …» в конце.
 * Функция вырезает их из текста (чтобы не дублировать) и возвращает список
 * коротких подписей. Чистый модуль, без DOM.
 */

export interface ExtractedCitations {
  /** Текст без распознанных ссылок. */
  text: string
  /** Уникальные подписи источников в порядке появления (≤ 6). */
  citations: string[]
}

const MAX_CITATIONS = 6
const MAX_LABEL = 48

/** Внутри квадратных скобок: § / параграф / стр. / p. / bet + номер. */
const BRACKET_REF_RE =
  /\s?\[((?:[^[\]\n]{0,60}?)(?:§\s?\d+|параграф\s?\d+|paragraph\s?\d+|paragraf\s?\d+|стр\.\s?\d+|p\.\s?\d+|bet\s?\d+)(?:[^[\]\n]{0,40}))\](?!\()/giu

/** [Источник: …] / [Source: …] / [Manba: …] */
const BRACKET_SOURCE_RE = /\s?\[(?:источник|источники|source|sources|manba|manbalar)\s*[:：]\s*([^[\]\n]{2,120})\](?!\()/giu

/** Отдельная строка «Источник(и): …» (обычно в конце ответа). */
const LINE_SOURCE_RE = /^[ \t>*_-]*(?:источник|источники|source|sources|manba|manbalar)\s*[:：]\s*(.+)$/gimu

function tidyLabel(raw: string): string {
  const label = raw
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,.;:—-]+|[\s,.;:—-]+$/g, '')
    .trim()
  return label.length > MAX_LABEL ? `${label.slice(0, MAX_LABEL - 1).trimEnd()}…` : label
}

export function extractCitations(input: string): ExtractedCitations {
  if (!input) return { text: '', citations: [] }
  const found: string[] = []
  const push = (raw: string) => {
    for (const part of raw.split(/\s*;\s*/)) {
      const label = tidyLabel(part)
      if (label.length < 2) continue
      if (found.some((f) => f.toLowerCase() === label.toLowerCase())) continue
      found.push(label)
    }
  }

  let text = input.replace(BRACKET_SOURCE_RE, (_m, inner: string) => {
    push(inner)
    return ''
  })
  text = text.replace(BRACKET_REF_RE, (_m, inner: string) => {
    push(inner)
    return ''
  })
  text = text.replace(LINE_SOURCE_RE, (_m, inner: string) => {
    push(inner)
    return ''
  })

  return {
    text: text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim(),
    citations: found.slice(0, MAX_CITATIONS),
  }
}
