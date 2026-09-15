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

/** Минимальный срез SpeechSynthesisVoice — чтобы ранжирование тестировалось без DOM. */
export type VoiceLike = Pick<SpeechSynthesisVoice, 'name' | 'lang' | 'localService'>

/**
 * Балл «человечности» голоса. Сначала естественность (задержка и качество речи
 * важнее пола): «Online (Natural)» / «… Natural» → Google → остальные; внутри
 * уровня — мужской голос учителя и подсказки из профиля.
 */
export function browserVoiceScore(v: VoiceLike, locale: BrowserSpeechLocale): number {
  const n = lower(v.name)
  let score = 0
  if (n.includes('natural')) score += 60
  if (n.includes('online')) score += 25
  if (n.includes('neural')) score += 40
  if (n.includes('google')) score += 35
  if (n.includes('premium') || n.includes('enhanced')) score += 30
  if (n.includes('microsoft') && n.includes('natural')) score += 10
  if (isMaleVoice(n)) score += 12
  if (isFemaleVoice(n)) score -= 4
  if (v.localService === false) score += 2
  const hints = TEACHER_BROWSER_VOICE_HINTS[locale]
  const hintIdx = hints.findIndex((h) => n.includes(h))
  if (hintIdx >= 0) score += Math.max(1, 8 - hintIdx)
  return score
}

function voiceMatchesLocale(v: VoiceLike, locale: BrowserSpeechLocale): boolean {
  const lang = lower(v.lang).replace('_', '-')
  const prefix = locale === 'en' ? 'en' : locale === 'uz' ? 'uz' : 'ru'
  return lang === prefix || lang.startsWith(`${prefix}-`)
}

/** Отсортировать голоса локали от лучшего к худшему (для uz без голосов — русские). */
export function rankBrowserVoices<T extends VoiceLike>(voices: readonly T[], locale: BrowserSpeechLocale): T[] {
  const same = voices.filter((v) => voiceMatchesLocale(v, locale))
  if (same.length === 0 && locale === 'uz') return rankBrowserVoices(voices, 'ru')
  return [...same].sort((a, b) => browserVoiceScore(b, locale) - browserVoiceScore(a, locale))
}

const voiceChoiceCache = new Map<BrowserSpeechLocale, SpeechSynthesisVoice | null>()
let voiceCacheWired = false

function wireVoiceCacheInvalidation(): void {
  if (voiceCacheWired || !speechSupported()) return
  voiceCacheWired = true
  try {
    window.speechSynthesis.addEventListener('voiceschanged', () => voiceChoiceCache.clear())
  } catch {
    /* старые движки без addEventListener */
  }
}

/**
 * Лучший доступный голос для локали (кешируется до события voiceschanged).
 * Женский голос лучше, чем тишина: если мужского нет — берём лучший из доступных.
 */
export function getBestBrowserVoice(locale: BrowserSpeechLocale): SpeechSynthesisVoice | null {
  if (!speechSupported()) return null
  wireVoiceCacheInvalidation()
  if (voiceChoiceCache.has(locale)) return voiceChoiceCache.get(locale) ?? null
  const voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) return null
  const best = rankBrowserVoices(voices, locale)[0] ?? null
  voiceChoiceCache.set(locale, best)
  return best
}

function pickBrowserVoice(locale: BrowserSpeechLocale): SpeechSynthesisVoice | null {
  return getBestBrowserVoice(locale)
}

export function isBrowserSpeechSupported(): boolean {
  return speechSupported()
}

/** Голоса в Chrome приходят асинхронно — ждём событие voiceschanged. */
export function ensureVoicesLoaded(timeoutMs = 1500): Promise<void> {
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
  wireVoiceCacheInvalidation()
  window.speechSynthesis.getVoices()
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
  onStart?: () => void,
): Promise<'end' | 'error'> {
  return new Promise((resolve) => {
    if (!speechSupported()) {
      resolve('error')
      return
    }
    const utterance = new SpeechSynthesisUtterance(stripStressForBrowser(sentence))
    utterance.lang = voice?.lang || SPEECH_LOCALE[locale]
    utterance.rate =
      prosodyMode === 'lab' ? TEACHER_BROWSER_RATE_LAB[locale] : TEACHER_BROWSER_RATE[locale]
    utterance.pitch = TEACHER_BROWSER_PITCH[locale]
    utterance.volume = 1.0
    if (voice) {
      try {
        utterance.voice = voice
      } catch {
        /* голос из устаревшего списка / не SpeechSynthesisVoice — говорим голосом по lang */
      }
    }

    let settled = false
    const done = (how: 'end' | 'error') => {
      if (settled) return
      settled = true
      resolve(how)
    }
    utterance.onstart = () => onStart?.()
    utterance.onend = () => done('end')
    utterance.onerror = () => done('error')
    // Chrome иногда «теряет» onend после cancel() — страхуемся оценкой длительности.
    const words = sentence.split(/\s+/).length
    const guardMs = 4_000 + words * 900
    setTimeout(() => done('end'), guardMs)

    window.speechSynthesis.speak(utterance)
  })
}

/**
 * Одна фраза системным голосом с мгновенной отменой — для живого диалога.
 * `cancel()` глушит синтез синхронно (speechSynthesis.cancel), промис завершается сразу.
 */
export function speakBrowserSentence(
  sentence: string,
  locale: BrowserSpeechLocale,
  opts: { onStart?: () => void; voice?: SpeechSynthesisVoice | null } = {},
): { done: Promise<'end' | 'error' | 'cancelled'>; cancel: () => void } {
  let cancelled = false
  let resolveCancel: ((v: 'cancelled') => void) | null = null
  const cancelP = new Promise<'cancelled'>((resolve) => {
    resolveCancel = resolve
  })
  const voice = opts.voice === undefined ? pickBrowserVoice(locale) : opts.voice
  const speakP = speakOneUtterance(sentence, locale, voice, 'default', opts.onStart)
  return {
    done: Promise.race([speakP, cancelP]),
    cancel: () => {
      if (cancelled) return
      cancelled = true
      stopBrowserSpeech()
      resolveCancel?.('cancelled')
    },
  }
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
