/**
 * Озвучка преподавателя в лаборатории.
 *
 * Ключевые правила синхронизации:
 * 1. Prefetch с приоритетом intro→tension→transfer… (lab-prosody явно).
 * 2. Новый cue прерывает текущую речь — картинка важнее хвоста фразы.
 * 3. Session-кэш аудио — повторные прогоны мгновенны.
 * 4. speakIntro ждёт готовности intro (до 4 с) перед стартом.
 */

import {
  type LearnSpeechLocale,
  preloadSpeechVoices,
} from '../../learn/learnSpeech'
import {
  fetchTeacherTtsChunk,
  primeTeacherVoiceOnUserGesture,
  teacherTtsLocale,
} from '../../learn/learnTeacherTtsClient'
import {
  splitTextForTts,
  TTS_LAB_CHUNK_GAP_MS,
} from '../../learn/learnSpeechText'
import {
  playNeuralAudioBase64,
  stopNeuralPlayback,
  unlockAudioPlayback,
} from '../../learn/learnSpeechPlayback'
import {
  isBrowserSpeechSupported,
  speakWithBrowserVoice,
  stopBrowserSpeech,
} from '../../learn/learnSpeechBrowser'
import {
  CLO2_SPEECH_SILENT,
  CLO2_TEACHER_SFX,
  getClo2TeacherLine,
  type Clo2TeacherLine,
  type Clo2TeacherLineId,
  type LabTeacherLocale,
} from './clo2TeacherScript'
import { playLabReactionSfx, primeLabReactionSfx } from './labReactionSfx'
import type { Clo2CueId } from '../cinema/scenes/clo2/storyboard'

const VOICE_STORAGE_KEY = 'atomlab-lab-teacher-voice'
const PREFETCH_CONCURRENCY = 2
const INTRO_READY_TIMEOUT_MS = 4000
const CUE_READY_TIMEOUT_MS = 2200

export function readLabTeacherVoiceEnabled(): boolean {
  try {
    const v = localStorage.getItem(VOICE_STORAGE_KEY)
    if (v === '0') return false
    if (v === '1') return true
  } catch {
    /* ignore */
  }
  return true
}

export function writeLabTeacherVoiceEnabled(on: boolean): void {
  try {
    localStorage.setItem(VOICE_STORAGE_KEY, on ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export type LabTeacherNarratorListener = (line: Clo2TeacherLine | null) => void
export type LabTeacherSpeakingListener = (speaking: boolean) => void

type LineAudio = Array<{ audioBase64: string; mimeType: string }>

type CacheEntry = {
  ready: Promise<LineAudio | null>
  result: LineAudio | null
  abort: AbortController
  key: string
}

/** Порядок prefetch = порядок появления на таймлайне. */
const CLO2_VOICED_CUES: readonly Clo2TeacherLineId[] = [
  'intro',
  'tension',
  'transfer',
  'break',
  'pairA',
  'radicalA',
  'precipitate',
  'birth',
  'complete',
]

/** Критический путь — грузим первыми, до нажатия «Синтез». */
const PRIORITY_PREFETCH: readonly Clo2TeacherLineId[] = [
  'intro',
  'tension',
  'transfer',
  'break',
  'pairA',
  'radicalA',
]

/** Session-level: переживает beginRun — повторный синтез мгновенный. */
const sessionAudioCache = new Map<string, LineAudio>()

function cacheKey(locale: LabTeacherLocale, speak: string): string {
  return `lab|v3|${locale}|${speak}`
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function nextCueAfter(id: Clo2TeacherLineId): Clo2TeacherLineId | null {
  const i = CLO2_VOICED_CUES.indexOf(id)
  if (i < 0 || i >= CLO2_VOICED_CUES.length - 1) return null
  return CLO2_VOICED_CUES[i + 1] ?? null
}

export class LabTeacherNarrator {
  private locale: LabTeacherLocale = 'ru'
  private voiceOn = readLabTeacherVoiceEnabled()
  private runToken = 0

  private listener: LabTeacherNarratorListener | null = null
  private speakingListener: LabTeacherSpeakingListener | null = null
  private currentLine: Clo2TeacherLine | null = null
  private speaking = false
  private lastSpokenId: Clo2TeacherLineId | null = null

  private cache = new Map<Clo2TeacherLineId, CacheEntry>()
  private prefetchAbort: AbortController | null = null
  private prefetchPromise: Promise<void> | null = null

  private playToken = 0

  setLocale(locale: LabTeacherLocale): void {
    if (this.locale === locale) return
    this.locale = locale
    this.abortPrefetch()
  }

  setVoiceEnabled(on: boolean): void {
    this.voiceOn = on
    writeLabTeacherVoiceEnabled(on)
    if (!on) this.haltPlayback()
  }

  isVoiceEnabled(): boolean {
    return this.voiceOn
  }

  isSpeaking(): boolean {
    return this.speaking
  }

  getCurrentLine(): Clo2TeacherLine | null {
    return this.currentLine
  }

  getLastSpokenId(): Clo2TeacherLineId | null {
    return this.lastSpokenId
  }

  subscribe(listener: LabTeacherNarratorListener): () => void {
    this.listener = listener
    listener(this.currentLine)
    return () => {
      if (this.listener === listener) this.listener = null
    }
  }

  subscribeSpeaking(listener: LabTeacherSpeakingListener): () => void {
    this.speakingListener = listener
    listener(this.speaking)
    return () => {
      if (this.speakingListener === listener) this.speakingListener = null
    }
  }

  private publish(line: Clo2TeacherLine | null): void {
    this.currentLine = line
    this.listener?.(line)
  }

  private setSpeaking(on: boolean): void {
    if (this.speaking === on) return
    this.speaking = on
    this.speakingListener?.(on)
  }

  prime(): void {
    primeTeacherVoiceOnUserGesture()
    primeLabReactionSfx()
    preloadSpeechVoices()
  }

  warmPrefetch(): void {
    if (!this.voiceOn) return
    void this.ensurePrefetch()
  }

  beginRun(): void {
    this.runToken += 1
    this.haltPlayback()
    this.publish(null)
    this.lastSpokenId = null
    if (this.voiceOn) void this.ensurePrefetch()
  }

  stop(): void {
    this.runToken += 1
    this.haltPlayback()
    this.publish(null)
    this.abortPrefetch()
  }

  private haltPlayback(): void {
    this.playToken += 1
    stopNeuralPlayback()
    stopBrowserSpeech()
    this.setSpeaking(false)
  }

  private abortPrefetch(): void {
    this.prefetchAbort?.abort()
    this.prefetchAbort = null
    this.prefetchPromise = null
    for (const entry of this.cache.values()) entry.abort.abort()
    this.cache.clear()
  }

  private synthLine(
    id: Clo2TeacherLineId,
    locale: LabTeacherLocale,
    signal: AbortSignal,
  ): Promise<LineAudio | null> {
    const line = getClo2TeacherLine(locale, id)
    if (!line.speak.trim()) return Promise.resolve(null)

    const key = cacheKey(locale, line.speak)
    const cached = sessionAudioCache.get(key)
    if (cached) return Promise.resolve(cached)

    const ttsLocale = teacherTtsLocale(locale)
    return (async (): Promise<LineAudio | null> => {
      try {
        const preparedChunks = splitTextForTts(line.speak, locale, 'lab')
        const audio: LineAudio = []
        for (const chunk of preparedChunks) {
          if (signal.aborted) return null
          const r = await fetchTeacherTtsChunk(chunk, ttsLocale, signal, 'lab')
          if (r) audio.push({ audioBase64: r.audioBase64, mimeType: r.mimeType })
        }
        if (audio.length === 0) return null
        sessionAudioCache.set(key, audio)
        return audio
      } catch {
        return null
      }
    })()
  }

  private attachCacheEntry(id: Clo2TeacherLineId, locale: LabTeacherLocale, parentAbort: AbortController): void {
    const line = getClo2TeacherLine(locale, id)
    if (!line.speak.trim()) return

    const key = cacheKey(locale, line.speak)
    const sessionHit = sessionAudioCache.get(key)
    if (sessionHit) {
      this.cache.set(id, {
        key,
        result: sessionHit,
        abort: new AbortController(),
        ready: Promise.resolve(sessionHit),
      })
      return
    }

    if (this.cache.has(id)) return

    const entryAbort = new AbortController()
    parentAbort.signal.addEventListener('abort', () => entryAbort.abort(), { once: true })

    const entry: CacheEntry = {
      key,
      result: null,
      abort: entryAbort,
      ready: Promise.resolve(null),
    }

    entry.ready = this.synthLine(id, locale, entryAbort.signal).then((audio) => {
      if (audio) entry.result = audio
      return audio
    })

    this.cache.set(id, entry)
  }

  private async ensurePrefetch(): Promise<void> {
    if (this.prefetchPromise) return this.prefetchPromise

    this.prefetchAbort?.abort()
    const abort = new AbortController()
    this.prefetchAbort = abort
    const locale = this.locale

    this.prefetchPromise = (async () => {
      try {
        for (const id of PRIORITY_PREFETCH) {
          if (abort.signal.aborted) return
          this.attachCacheEntry(id, locale, abort)
          const entry = this.cache.get(id)
          if (entry) await entry.ready
        }

        const rest = CLO2_VOICED_CUES.filter((id) => !PRIORITY_PREFETCH.includes(id))
        for (const id of rest) this.attachCacheEntry(id, locale, abort)

        let i = 0
        const jobs = rest.map((id) => async () => {
          const entry = this.cache.get(id)
          if (entry) await entry.ready
        })

        const workers = Array.from({ length: PREFETCH_CONCURRENCY }, async () => {
          while (i < jobs.length) {
            if (abort.signal.aborted) return
            const job = jobs[i++]!
            await job()
          }
        })
        await Promise.all(workers)
      } finally {
        if (this.prefetchAbort === abort) this.prefetchPromise = null
      }
    })()

    return this.prefetchPromise
  }

  private async ensureLineReady(id: Clo2TeacherLineId, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs
    void this.ensurePrefetch()
    this.attachCacheEntry(id, this.locale, this.prefetchAbort ?? new AbortController())

    while (Date.now() < deadline) {
      const entry = this.cache.get(id)
      if (entry?.result?.length) return
      if (entry) {
        const audio = await Promise.race([entry.ready, delay(120).then(() => null)])
        if (audio && audio.length > 0) return
      } else {
        await delay(60)
      }
    }
  }

  private async playFromCache(id: Clo2TeacherLineId, token: number): Promise<void> {
    if (!this.voiceOn) return
    const line = getClo2TeacherLine(this.locale, id)
    if (!line.speak.trim()) return

    this.lastSpokenId = id
    this.setSpeaking(true)

    const next = nextCueAfter(id)
    if (next) void this.ensureLineReady(next, CUE_READY_TIMEOUT_MS)

    try {
      await this.ensureLineReady(id, CUE_READY_TIMEOUT_MS)
      if (token !== this.playToken) return

      let audio: LineAudio | null = null
      const entry = this.cache.get(id)
      if (entry) {
        audio = entry.result ?? (await entry.ready)
      } else {
        const ctrl = new AbortController()
        audio = await this.synthLine(id, this.locale, ctrl.signal)
        if (audio?.length) {
          sessionAudioCache.set(cacheKey(this.locale, line.speak), audio)
        }
      }

      if (token !== this.playToken) return

      if (audio && audio.length > 0) {
        await unlockAudioPlayback()
        if (token !== this.playToken) return
        for (let i = 0; i < audio.length; i++) {
          if (token !== this.playToken) return
          if (i > 0) await delay(TTS_LAB_CHUNK_GAP_MS)
          if (token !== this.playToken) return
          try {
            await playNeuralAudioBase64(audio[i]!.audioBase64, audio[i]!.mimeType)
          } catch {
            if (i === 0) await this.playFallback(line.speak, token)
            return
          }
        }
      } else {
        await this.playFallback(line.speak, token)
      }
    } finally {
      if (token === this.playToken) this.setSpeaking(false)
    }
  }

  private async playFallback(text: string, token: number): Promise<void> {
    if (!isBrowserSpeechSupported()) return
    const locale = this.locale as LearnSpeechLocale
    const chunks = splitTextForTts(text, locale, 'lab')
    await speakWithBrowserVoice(chunks, locale, () => token !== this.playToken, 'lab')
  }

  async speakLine(id: Clo2TeacherLineId, opts?: { force?: boolean }): Promise<void> {
    const line = getClo2TeacherLine(this.locale, id)
    const isCue = id !== 'intro'
    const silent = isCue && CLO2_SPEECH_SILENT.has(id as Clo2CueId)

    if (silent && !opts?.force) {
      const sfx = CLO2_TEACHER_SFX[id as Clo2CueId]
      if (sfx && this.voiceOn) playLabReactionSfx(sfx)
      return
    }

    if (!line.speak.trim()) return

    this.publish(line)
    if (isCue) {
      const sfx = CLO2_TEACHER_SFX[id as Clo2CueId]
      if (sfx && this.voiceOn) playLabReactionSfx(sfx)
    }

    if (!this.voiceOn) return

    this.haltPlayback()
    const token = this.playToken

    void this.playFromCache(id, token).catch(() => {
      if (token === this.playToken) this.setSpeaking(false)
    })
  }

  speakCue(id: Clo2CueId): void {
    void this.speakLine(id)
  }

  speakIntro(): void {
    void (async () => {
      if (this.voiceOn) await this.ensureLineReady('intro', INTRO_READY_TIMEOUT_MS)
      void this.speakLine('intro')
    })()
  }

  replay(): void {
    const id = this.lastSpokenId ?? 'intro'
    void this.speakLine(id, { force: true })
  }

  toggleVoice(): boolean {
    const next = !this.voiceOn
    this.setVoiceEnabled(next)
    if (next) void this.ensurePrefetch()
    return next
  }
}

let shared: LabTeacherNarrator | null = null

export function getLabTeacherNarrator(): LabTeacherNarrator {
  if (!shared) shared = new LabTeacherNarrator()
  return shared
}
