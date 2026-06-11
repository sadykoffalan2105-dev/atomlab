import {
  applyRussianPronunciationLexicon,
  sanitizeRussianTtsSurface,
} from './learnRussianPronunciation'
import { naturalizeSpeechText, splitAtSpeechClauses, type NaturalizeSpeechOptions } from './learnSpeechNaturalize'
import {
  TEACHER_BROWSER_RATE,
  TEACHER_BROWSER_VOICE_HINTS,
  TEACHER_VOICE_OPENAI,
  TEACHER_VOICE_OPENAI_INSTRUCTIONS,
  TEACHER_VOICE_OPENAI_SPEED,
} from './learnTeacherVoiceProfile'

export type SpeechPrepLocale = 'ru' | 'en' | 'uz'

const SUBSCRIPT_DIGITS = '₀₁₂₃₄₅₆₇₈₉'
const SUPERSCRIPT_DIGITS = '⁰¹²³⁴⁵⁶⁷⁸⁹'

export function stripMarkdownForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/#{1,6}\s+/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[📖✦•·▪|]/g, ' ')
    .replace(/:\s*/g, ': ')
    .replace(/;\s*/g, '; ')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function subscriptToDigit(ch: string): string {
  const i = SUBSCRIPT_DIGITS.indexOf(ch)
  return i >= 0 ? String(i) : ch
}

function superscriptToDigit(ch: string): string {
  const i = SUPERSCRIPT_DIGITS.indexOf(ch)
  return i >= 0 ? String(i) : ch
}

/** H₂O, CO₂ → H2O — TTS читает цифры естественнее субскриптов. */
export function normalizeChemicalNotation(text: string): string {
  return text
    .replace(/[\u2080-\u2089]/g, subscriptToDigit)
    .replace(/[\u2070-\u2079]/g, superscriptToDigit)
    .replace(/⁺/g, '+')
    .replace(/⁻/g, '-')
}

/** Текст для живой речи — разговорный, без «роботизированных» символов. */
export function prepareTextForHumanTts(
  text: string,
  locale: SpeechPrepLocale,
  options: NaturalizeSpeechOptions = {},
): string {
  let t = stripMarkdownForSpeech(text)
  t = normalizeChemicalNotation(t)

  if (locale === 'ru') {
    t = t
      .replace(/§\s*(\d+)/g, 'параграф $1')
      .replace(/---\s*ЗАПОМНИТЬ\s*---/gi, '. Важно запомнить.')
      .replace(/ЗАПОМНИТЬ|Запомнить по учебнику/gi, 'Важно запомнить')
      .replace(/\bKimyo\b/gi, 'Кимё')
      .replace(/→|⟶|->/g, ', затем ')
      .replace(/⇌|↔/g, ', реакция обратима, ')
      .replace(/\bт\.?\s*д\.?\b/gi, 'так далее')
      .replace(/\bт\.?\s*е\.?\b/gi, 'то есть')
      .replace(/\bи\s+т\.?\s*п\.?\b/gi, 'и так далее')
      .replace(/…+/g, '.')
  } else {
    t = t
      .replace(/§\s*(\d+)/g, 'section $1')
      .replace(/---\s*REMEMBER\s*---/gi, '. Important to remember.')
      .replace(/→|⟶|->/g, ', then ')
      .replace(/⇌|↔/g, ', reversible reaction, ')
      .replace(/…+/g, '.')
  }

  t = naturalizeSpeechText(t, locale, options)

  if (locale === 'ru') {
    t = applyRussianPronunciationLexicon(t)
    t = sanitizeRussianTtsSurface(t)
  }

  return t
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(/([,;])\s*/g, '$1 ')
    .replace(/\.{2,}/g, '.')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** Одно предложение = один запрос TTS — ничего не «проглатывается». */
const CHUNK_MAX = 340

export function splitTextForTts(text: string, locale: SpeechPrepLocale = 'ru', max = CHUNK_MAX): string[] {
  const clean = prepareTextForHumanTts(text, locale)
  if (!clean) return []

  const parts: string[] = []
  for (const raw of clean.split(/(?<=[.!?])\s+/)) {
    const sentence = raw.trim()
    if (!sentence) continue
    if (sentence.length <= max) {
      parts.push(sentence)
    } else {
      parts.push(...splitAtSpeechClauses(sentence, max))
    }
  }
  return parts.length > 0 ? parts : [clean]
}

/** OpenAI fallback — onyx (мужской), как образец автоответчика. */
export const HUMAN_TTS_INSTRUCTIONS = TEACHER_VOICE_OPENAI_INSTRUCTIONS

export const HUMAN_TTS_MODEL = 'gpt-4o-mini-tts-2025-03-20'

export const HUMAN_TTS_SPEED = TEACHER_VOICE_OPENAI_SPEED

export const HUMAN_TTS_VOICE = TEACHER_VOICE_OPENAI

/** Пауза между фрагментами (мс) — короткая, как между фразами учителя. */
export const TTS_CHUNK_GAP_MS = 120

export const BROWSER_NEURAL_HINTS = TEACHER_BROWSER_VOICE_HINTS

export const BROWSER_SPEECH_RATE = TEACHER_BROWSER_RATE

export const BROWSER_SENTENCE_GAP_MS = 80
