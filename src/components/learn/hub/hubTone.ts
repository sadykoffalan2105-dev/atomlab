import type { CSSProperties } from 'react'

/**
 * Цветовые пары для хабов «Обучения». Компоненты читают --hub-ga / --hub-gb
 * (градиент карточки, бейджа, прогресса, глифа).
 */

const GRADE_IDS = new Set(['g7', 'g8', 'g9', 'g10', 'g11'])

export function toneStyle(a: string, b: string): CSSProperties {
  return { ['--hub-ga' as string]: a, ['--hub-gb' as string]: b } as CSSProperties
}

/** Градиент класса из learnTheme.css (--lt-g7-a … --lt-g11-b). */
export function gradeTone(gradeId: string): CSSProperties {
  const id = GRADE_IDS.has(gradeId) ? gradeId : 'g7'
  return toneStyle(`var(--lt-${id}-a)`, `var(--lt-${id}-b)`)
}

export const PRIMARY_TONE: CSSProperties = toneStyle('var(--lt-primary)', 'var(--lt-accent-pink)')

/** Убирает ведущую стрелку из подписей вида «← К классам» (иконку рисуем сами). */
export function stripLeadingArrow(label: string): string {
  return label.replace(/^\s*[←‹<]\s*/, '')
}
