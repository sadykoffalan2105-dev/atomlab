/**
 * Бюджет времени лабораторного учителя ClO₂.
 *
 * Wall = max(визуальный минимум, оценка речи × множитель фазы).
 * После реакции почти не говорим → release/finale делим.
 * В фазе разрыва несколько cue → слегка умножаем, но с потолком.
 *
 * Story-метки — зеркало CLO2_PHASE (без циклического импорта storyboard).
 */

import type { StorySegment } from '../cinema/core/storyTime'
import { getClo2TeacherLine, type LabTeacherLocale } from './clo2TeacherScript'

const PHASE = {
  entryEnd: 2.0,
  approachEnd: 3.5,
  transferEnd: 5.0,
  releaseEnd: 6.5,
  finaleEnd: 8.5,
} as const

/** Символов/с при lab prosody ~+2%. */
const LAB_CHARS_PER_SEC = 15.5
/** Короткие lab-break в SSML. */
const SSML_FUDGE = 1.08
const CUE_PAD_MS = 200

const MIN_WALL = {
  entry: 3.0,
  approach: 2.8,
  transfer: 7.0,
  release: 1.8,
  finale: 2.2,
} as const

/** Потолок: не раздувать всю сцену «на всякий случай». */
const MAX_WALL = {
  entry: 4.6,
  approach: 4.8,
  transfer: 9.5,
  release: 2.4,
  finale: 3.2,
} as const

export function estimateLabSpeechMs(speak: string): number {
  const chars = speak.replace(/\s+/g, ' ').trim().length
  if (chars === 0) return 0
  return Math.ceil((chars / LAB_CHARS_PER_SEC) * 1000 * SSML_FUDGE) + CUE_PAD_MS
}

function speechSec(locale: LabTeacherLocale, id: Parameters<typeof getClo2TeacherLine>[1]): number {
  return estimateLabSpeechMs(getClo2TeacherLine(locale, id).speak) / 1000
}

function clampWall(min: number, max: number, speech: number, multiply: number): number {
  const raw = speech * multiply
  return +Math.min(max, Math.max(min, raw)).toFixed(2)
}

/**
 * CLO2_SEGMENTS_TEACHER из оценок речи.
 * Interrupt режет хвост предыдущей реплики — поэтому суммы cue в фазе < 1.0.
 */
export function buildClo2TeacherSegments(locale: LabTeacherLocale = 'ru'): readonly StorySegment[] {
  const entrySpeech = speechSec(locale, 'intro')
  // tension полностью + кусок transfer до break
  const approachSpeech = speechSec(locale, 'tension') * 0.9 + speechSec(locale, 'transfer') * 0.35
  // break/pairA часто обрезаются следующим cue; radicalA — главный
  const transferSpeech =
    speechSec(locale, 'break') * 0.45 +
    speechSec(locale, 'pairA') * 0.55 +
    speechSec(locale, 'radicalA') * 0.85
  const finaleSpeech = speechSec(locale, 'complete')

  return [
    {
      to: PHASE.entryEnd,
      wall: clampWall(MIN_WALL.entry, MAX_WALL.entry, entrySpeech, 1.0),
      ease: 'power2.out',
    },
    {
      to: PHASE.approachEnd,
      wall: clampWall(MIN_WALL.approach, MAX_WALL.approach, approachSpeech, 1.0),
      ease: 'power1.inOut',
    },
    {
      to: PHASE.transferEnd,
      /** Умножаем плотную фазу разрыва (slow-mo + несколько cue). */
      wall: clampWall(MIN_WALL.transfer, MAX_WALL.transfer, transferSpeech, 1.25),
      ease: 'power1.inOut',
    },
    {
      to: PHASE.releaseEnd,
      /** Делим: precipitate/birth без речи. */
      wall: MIN_WALL.release,
      ease: 'power2.out',
    },
    {
      to: PHASE.finaleEnd,
      /** Делим бывший ~7s хвост под одну короткую фразу. */
      wall: clampWall(MIN_WALL.finale, MAX_WALL.finale, finaleSpeech, 1.05),
      ease: 'sine.inOut',
    },
  ]
}
