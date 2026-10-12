import type { KeyboardEvent } from 'react'

const STEP: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }

/**
 * Клавиатура радиогруппы по ARIA (кнопки role="radio" внутри role="radiogroup"): стрелки переводят фокус
 * на соседний вариант и выбирают его (выбор следует за фокусом), Home/End — первый/последний.
 * Вместе с «бегущим» tabIndex (0 у выбранной, −1 у остальных) Tab попадает в группу один раз.
 */
export function onRadioGroupKeyDown(e: KeyboardEvent<HTMLElement>): void {
  const step = STEP[e.key]
  if (step === undefined && e.key !== 'Home' && e.key !== 'End') return
  const radios = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]:not([disabled])')]
  if (radios.length < 2) return
  const active = document.activeElement as HTMLElement | null
  let i = active ? radios.indexOf(active) : -1
  if (i < 0) i = Math.max(0, radios.findIndex((r) => r.getAttribute('aria-checked') === 'true'))
  const next =
    e.key === 'Home' ? radios[0] : e.key === 'End' ? radios[radios.length - 1] : radios[(i + (step ?? 0) + radios.length) % radios.length]
  if (!next) return
  e.preventDefault()
  next.focus()
  if (next.getAttribute('aria-checked') !== 'true') next.click()
}
