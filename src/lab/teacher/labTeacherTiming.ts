/**
 * Оценка длительности реплики лабораторного учителя.
 *
 * Хронометраж сцены ClO₂ от речи больше не строится: пошаговый режим сам ждёт
 * конца реплики. Оценка нужна как запасной ориентир (например, без голоса).
 */

/** Символов/с при lab prosody ~+2%. */
const LAB_CHARS_PER_SEC = 15.5
/** Короткие lab-break в SSML. */
const SSML_FUDGE = 1.08
const CUE_PAD_MS = 200

export function estimateLabSpeechMs(speak: string): number {
  const chars = speak.replace(/\s+/g, ' ').trim().length
  if (chars === 0) return 0
  return Math.ceil((chars / LAB_CHARS_PER_SEC) * 1000 * SSML_FUDGE) + CUE_PAD_MS
}
