import { BROWSER_SENTENCE_GAP_MS } from './learnSpeechText'
import {
  TEACHER_BROWSER_PITCH,
  TEACHER_BROWSER_RATE,
  TEACHER_BROWSER_RATE_LAB,
  TEACHER_BROWSER_VOICE_HINTS,
  TEACHER_VOICE_FEMALE_NAMES,
  TEACHER_VOICE_MALE_NAMES,
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

function isMaleVoice(name: string): boolean {
  const n = lower(name)
  return TEACHER_VOICE_MALE_NAMES.some((m) => n.includes(m))
}

function isFemaleVoice(name: string): boolean {
  const n = lower(name)
  return TEACHER_VOICE_FEMALE_NAMES.some((f) => n.includes(f))
}

/**
 * Балл голоса: учитель — мужчина, поэтому пол важнее «человечности».
 * Сначала жёстко предпочитаем мужские голоса, затем — естественные (Google/Neural).
 */
function voiceScore(v: SpeechSynthesisVoice): number {
  const n = lower(v.name)
  let score = 0
  if (isMaleVoice(n)) score += 100
  if (isFemaleVoice(n)) score -= 100
  if (n.includes('natural')) score += 6
  if (n.includes('neural')) score += 6
  if (n.includes('online')) score += 4
  if (n.includes('premium') || n.includes('enhanced')) score += 4
  if (n.includes('google')) score += 3
  if (!v.localService) score += 3
  return score
}

/**
 * Лучший доступный голос для локали: сначала мужские по подсказкам, затем —
 * максимум по баллу (мужской + естественный). Web Speech — последний фолбэк,
 * мужской neural-голос обеспечивает серверный/Puter путь.
 */
function pickBrowserVoice(locale: BrowserSpeechLocale): SpeechSynthesisVoice | null {
  if (!speechSupported()) return null
  const voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) return null

  const langPrefix = locale === 'en' ? 'en' : locale === 'uz' ? 'uz' : 'ru'
  const hints = TEACHER_BROWSER_VOICE_HINTS[locale]

  const matchesLang = (v: SpeechSynthesisVoice) => {
    const lang = lower(v.lang)
    return lang.startsWith(langPrefix) || lang.includes(langPrefix)
  }

  const sameLang = voices.filter(matchesLang)

  // 1) Точные подсказки в порядке приоритета (мужские — первыми).
  for (const hint of hints) {
    const hit = sameLang.find((v) => lower(v.name).includes(hint))
    if (hit) return hit
  }

  // 2) Лучший мужской голос языка — женские (Google русский и т.п.) не берём.
  if (sameLang.length > 0) {
    const ranked = [...sameLang].sort((a, b) => voiceScore(b) - voiceScore(a))
    const best = ranked.find((v) => isMaleVoice(v.name) && !isFemaleVoice(v.name))
    if (best) return best
    return null
  }

  // 3) Узбекского голоса нет — читаем русским.
  if (locale === 'uz') return pickBrowserVoice('ru')
  return null
}

export function isBrowserSpeechSupported(): boolean {
  return speechSupported()
}

/** Голоса в Chrome приходят асинхронно — ждём событие voiceschanged. */
function ensureVoicesLoaded(timeoutMs = 1500): Promise<void> {
  if (!speechSupported()) return Promise.resolve()
  if (window.speechSynthesis.getVoices().length > 0) return Promise.resolve()

  return new Promise((resolve) => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      window.speechSynthesis.onvoiceschanged = null
      clearTimeout(timer)
      resolve()
    }
    window.speechSynthesis.onvoiceschanged = () => {
      if (window.speechSynthesis.getVoices().length > 0) finish()
    }
    const timer = setTimeout(finish, timeoutMs)
    // На случай, если список уже наполнился между проверкой и подпиской.
    if (window.speechSynthesis.getVoices().length > 0) finish()
  })
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

/**
 * Системные (SAPI/Web Speech) русские голоса НЕ понимают COMBINING ACUTE
 * (U+0301) — они произносят слово по буквам или искажают его. Для нейросетевого
 * Edge-голоса ударения нужны, а для браузерного фолбэка их надо убрать, чтобы он
 * читал слова целиком со своим (обычно верным) ударением.
 */
function stripStressForBrowser(text: string): string {
  return text.replace(/\u0301/g, '')
}

function speakOneUtterance(
  sentence: string,
  locale: BrowserSpeechLocale,
  voice: SpeechSynthesisVoice | null,
  prosodyMode: 'default' | 'lab',
): Promise<void> {
  return new Promise((resolve) => {
    if (!speechSupported()) {
      resolve()
      return
    }
    const utterance = new SpeechSynthesisUtterance(stripStressForBrowser(sentence))
    utterance.lang = voice?.lang || SPEECH_LOCALE[locale]
    utterance.rate =
      prosodyMode === 'lab' ? TEACHER_BROWSER_RATE_LAB[locale] : TEACHER_BROWSER_RATE[locale]
    utterance.pitch = TEACHER_BROWSER_PITCH[locale]
    utterance.volume = 1.0
    if (voice) utterance.voice = voice

    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      resolve()
    }
    utterance.onend = done
    utterance.onerror = done

    window.speechSynthesis.speak(utterance)
  })
}

/**
 * Chrome глушит синтез после ~15 c непрерывной речи. Периодический resume()
 * не даёт движку «уснуть» на длинных репликах.
 */
function startChromeKeepAlive(): () => void {
  if (!speechSupported()) return () => {}
  const id = window.setInterval(() => {
    const synth = window.speechSynthesis
    if (synth.speaking && !synth.paused) {
      synth.pause()
      synth.resume()
    }
  }, 9000)
  return () => window.clearInterval(id)
}

export async function speakWithBrowserVoice(
  chunks: string[],
  locale: BrowserSpeechLocale,
  isAborted: () => boolean,
  prosodyMode: 'default' | 'lab' = 'default',
): Promise<boolean> {
  if (!speechSupported() || chunks.length === 0) return false

  await ensureVoicesLoaded()
  if (isAborted()) return false

  const voice = pickBrowserVoice(locale)
  if (!voice) return false

  window.speechSynthesis.cancel()
  await sleep(40)
  if (isAborted()) return false

  const stopKeepAlive = startChromeKeepAlive()
  try {
    for (let i = 0; i < chunks.length; i++) {
      if (isAborted()) return false
      await speakOneUtterance(chunks[i]!, locale, voice, prosodyMode)
      if (i + 1 < chunks.length && !isAborted()) {
        await sleep(BROWSER_SENTENCE_GAP_MS)
      }
    }
  } finally {
    stopKeepAlive()
  }

  return !isAborted()
}

export function stopBrowserSpeech(): void {
  if (speechSupported()) window.speechSynthesis.cancel()
}

export function isBrowserSpeechActive(): boolean {
  return speechSupported() && window.speechSynthesis.speaking
}
