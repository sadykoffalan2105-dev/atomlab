import { BROWSER_SENTENCE_GAP_MS } from './learnSpeechText'
import {
  TEACHER_BROWSER_PITCH,
  TEACHER_BROWSER_RATE,
  TEACHER_BROWSER_VOICE_HINTS,
} from './learnTeacherVoiceProfile'

export type BrowserSpeechLocale = 'ru' | 'en' | 'uz'

const SPEECH_LOCALE: Record<BrowserSpeechLocale, string> = {
  ru: 'ru-RU',
  en: 'en-US',
  uz: 'uz-UZ',
}

function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

function lower(s: string): string {
  return s.toLowerCase()
}

function isNeuralVoiceName(name: string): boolean {
  const n = lower(name)
  return (
    n.includes('neural') ||
    n.includes('online (natural)') ||
    n.includes('natural') ||
    n.includes('premium')
  )
}

/** Классический «роботский» системный голос — без Microsoft Neural / Dmitry. */
function pickBrowserVoice(locale: BrowserSpeechLocale): SpeechSynthesisVoice | null {
  if (!speechSupported()) return null
  const voices = window.speechSynthesis.getVoices()
  const langPrefix = locale === 'en' ? 'en' : locale === 'uz' ? 'uz' : 'ru'
  const hints = TEACHER_BROWSER_VOICE_HINTS[locale === 'uz' ? 'ru' : locale]

  const matchesLang = (v: SpeechSynthesisVoice) => {
    const lang = lower(v.lang)
    return lang.startsWith(langPrefix) || lang.includes(langPrefix)
  }

  for (const hint of hints) {
    const hit = voices.find((v) => {
      if (!matchesLang(v)) return false
      if (isNeuralVoiceName(v.name)) return false
      return lower(v.name).includes(hint)
    })
    if (hit) return hit
  }

  const localRobotic = voices.find(
    (v) => matchesLang(v) && v.localService && !isNeuralVoiceName(v.name),
  )
  if (localRobotic) return localRobotic

  const anyRobotic = voices.find((v) => matchesLang(v) && !isNeuralVoiceName(v.name))
  if (anyRobotic) return anyRobotic

  const anyLang = voices.find((v) => matchesLang(v))
  if (anyLang) return anyLang

  if (locale === 'uz') return pickBrowserVoice('ru')
  return null
}

export function isBrowserSpeechSupported(): boolean {
  return speechSupported()
}

export function preloadBrowserSpeechVoices(): void {
  if (!speechSupported()) return
  window.speechSynthesis.getVoices()
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices()
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function speakOneUtterance(
  sentence: string,
  locale: BrowserSpeechLocale,
  voice: SpeechSynthesisVoice | null,
): Promise<void> {
  return new Promise((resolve) => {
    if (!speechSupported()) {
      resolve()
      return
    }
    const utterance = new SpeechSynthesisUtterance(sentence)
    utterance.lang = SPEECH_LOCALE[locale]
    utterance.rate = TEACHER_BROWSER_RATE[locale === 'uz' ? 'ru' : locale]
    utterance.pitch = TEACHER_BROWSER_PITCH[locale === 'uz' ? 'ru' : locale]
    utterance.volume = 1.0
    if (voice) utterance.voice = voice
    utterance.onend = () => resolve()
    utterance.onerror = () => resolve()
    window.speechSynthesis.speak(utterance)
  })
}

export async function speakWithBrowserVoice(
  chunks: string[],
  locale: BrowserSpeechLocale,
  isAborted: () => boolean,
): Promise<boolean> {
  if (!speechSupported() || chunks.length === 0) return false

  const voice = pickBrowserVoice(locale)

  window.speechSynthesis.cancel()
  await sleep(24)

  for (let i = 0; i < chunks.length; i++) {
    if (isAborted()) return false
    await speakOneUtterance(chunks[i]!, locale, voice)
    if (i + 1 < chunks.length && !isAborted()) {
      await sleep(BROWSER_SENTENCE_GAP_MS)
    }
  }

  return !isAborted()
}

export function stopBrowserSpeech(): void {
  if (speechSupported()) window.speechSynthesis.cancel()
}

export function isBrowserSpeechActive(): boolean {
  return speechSupported() && window.speechSynthesis.speaking
}
