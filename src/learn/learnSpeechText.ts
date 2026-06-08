/** Подготовка текста ответа учителя для озвучивания. */

export type SpeechPrepLocale = 'ru' | 'en'

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

/** Текст для живой речи — без лишних пауз (они делают голос «роботом»). */
export function prepareTextForHumanTts(text: string, locale: SpeechPrepLocale): string {
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

  return t
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(/([,;])\s*/g, '$1 ')
    .replace(/\.{2,}/g, '.')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

const CHUNK_MAX = 900

export function splitTextForTts(text: string, locale: SpeechPrepLocale = 'ru', max = CHUNK_MAX): string[] {
  const clean = prepareTextForHumanTts(text, locale)
  if (!clean) return []
  if (clean.length <= max) return [clean]

  const parts: string[] = []
  let buf = ''
  for (const sentence of clean.split(/(?<=[.!?])\s+/)) {
    const next = buf ? `${buf} ${sentence}` : sentence
    if (next.length > max) {
      if (buf) parts.push(buf)
      if (sentence.length > max) {
        for (let i = 0; i < sentence.length; i += max) {
          parts.push(sentence.slice(i, i + max))
        }
        buf = ''
      } else {
        buf = sentence
      }
    } else {
      buf = next
    }
  }
  if (buf) parts.push(buf)
  return parts
}

/** OpenAI fallback — marin/cedar, снимок без «роботизированных» пауз. */
export const HUMAN_TTS_INSTRUCTIONS = {
  ru: `Language: Russian only. You are a real school chemistry teacher speaking to students in class.

Sound completely human: warm, calm, confident. Natural conversational rhythm — never monotone, never like GPS or a news anchor reading a teleprompter. Smooth flow between sentences without awkward gaps. Gentle emphasis on key terms. Questions sound inviting. Medium pace, unhurried.`,
  en: `You are a real high-school chemistry teacher in a live class. Warm, natural, never robotic. Smooth sentence flow, conversational rhythm, clear emphasis on science terms. Medium pace.`,
} as const

export const HUMAN_TTS_MODEL = 'gpt-4o-mini-tts-2025-03-20'

export const HUMAN_TTS_SPEED: Record<SpeechPrepLocale, number> = {
  ru: 1.0,
  en: 1.0,
}

export const HUMAN_TTS_VOICE: Record<SpeechPrepLocale, string> = {
  ru: 'marin',
  en: 'cedar',
}

/** Пауза между фрагментами (мс) — короткая, как между фразами учителя. */
export const TTS_CHUNK_GAP_MS = 140

export const BROWSER_NEURAL_HINTS: Record<SpeechPrepLocale, string[]> = {
  ru: [
    'dmitryneural',
    'dmitry online',
    'svetlananeural',
    'svetlana online',
    'microsoft dmitry',
    'microsoft svetlana',
    'irina',
    'pavel',
    'yandex',
    'google русский',
  ],
  en: ['jennyneural', 'jenny online', 'guyneural', 'aria online', 'microsoft aria', 'microsoft jenny'],
}

export const BROWSER_SPEECH_RATE: Record<SpeechPrepLocale, number> = {
  ru: 0.94,
  en: 0.96,
}

export const BROWSER_SENTENCE_GAP_MS = 180
