import { BROWSER_NEURAL_HINTS } from './learnSpeechText'
import {
  TEACHER_BROWSER_PITCH,
  TEACHER_BROWSER_RATE,
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
  return n.includes('neural') || n.includes('online (natural)') || n.includes('natural')
}

function isMaleVoiceName(name: string): boolean {
  const n = lower(name)
  if (
    n.includes('svetlana') ||
    n.includes('irina') ||
    n.includes('jenny') ||
    n.includes('aria') ||
    n.includes('nova') ||
    n.includes('shimmer') ||
    n.includes('coral') ||
    n.includes('madina')
  ) {
    return false
  }
  return (
    n.includes('dmitry') ||
    n.includes('guy') ||
    n.includes('pavel') ||
    n.includes('david') ||
    n.includes('male') ||
    n.includes('мужск')
  )
}

function pickBrowserVoice(locale: BrowserSpeechLocale, neuralOnly = false): SpeechSynthesisVoice | null {
  if (!speechSupported()) return null
  const voices = window.speechSynthesis.getVoices()
  const langPrefix = locale === 'en' ? 'en' : locale === 'uz' ? 'uz' : 'ru'
  const hints = BROWSER_NEURAL_HINTS[locale === 'uz' ? 'ru' : locale]

  for (const hint of hints) {
    const hit = voices.find((v) => {
      const name = lower(v.name)
      const lang = lower(v.lang)
      if (!lang.startsWith(langPrefix) && !lang.includes(langPrefix)) return false
      return name.includes(hint)
    })
    if (hit && (!neuralOnly || isNeuralVoiceName(hit.name)) && isMaleVoiceName(hit.name)) return hit
  }

  const neural = voices.find(
    (v) =>
      lower(v.lang).startsWith(langPrefix) &&
      isNeuralVoiceName(v.name) &&
      isMaleVoiceName(v.name) &&
      (v.localService || lower(v.name).includes('microsoft')),
  )
  if (neural) return neural
  if (neuralOnly) return null

  const local = voices.find((v) => lower(v.lang).startsWith(langPrefix) && v.localService)
  if (local) return local
  const any = voices.find((v) => lower(v.lang).startsWith(langPrefix))
  if (any) return any
  if (locale === 'uz') return pickBrowserVoice('ru', neuralOnly)
  return null
}

export function isBrowserSpeechSupported(): boolean {
  return speechSupported()
}

export function hasNativeBrowserNeuralVoice(locale: BrowserSpeechLocale): boolean {
  return pickBrowserVoice(locale, true) !== null
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
    utterance.pitch = TEACHER_BROWSER_PITCH
    utterance.volume = 1.0
    if (voice) utterance.voice = voice
    utterance.onend = () => resolve()
    utterance.onerror = () => resolve()
    window.speechSynthesis.speak(utterance)
  })
}

/** Запасной путь: системный Dmitry/Guy — те же фразы, что у neural. */
export async function speakWithBrowserVoice(
  chunks: string[],
  locale: BrowserSpeechLocale,
  isAborted: () => boolean,
): Promise<boolean> {
  if (!speechSupported() || chunks.length === 0) return false

  const voice = pickBrowserVoice(locale, true) ?? pickBrowserVoice(locale, false)
  // Даже без Dmitry — дефолтный системный голос лучше, чем тишина

  window.speechSynthesis.cancel()
  await sleep(40)

  for (let i = 0; i < chunks.length; i++) {
    if (isAborted()) return false
    await speakOneUtterance(chunks[i]!, locale, voice)
    if (i + 1 < chunks.length) await sleep(120)
  }

  return true
}

export function stopBrowserSpeech(): void {
  if (speechSupported()) window.speechSynthesis.cancel()
}

export function isBrowserSpeechActive(): boolean {
  return speechSupported() && window.speechSynthesis.speaking
}
