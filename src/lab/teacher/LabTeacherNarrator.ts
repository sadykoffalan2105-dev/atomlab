/**
 * Озвучка преподавателя в лаборатории.
 *
 * Ключевые правила синхронизации:
 * 1. Prefetch всех реплик с lab-prosody (явный параметр, без гонки глобального режима).
 * 2. Новый cue ВСЕГДА прерывает текущую речь — картинка важнее хвоста фразы.
 * 3. Session-кэш аудио по hash(locale+text) — повторные прогоны мгновенны.
 * 4. Приоритет: intro → tension → transfer… (не все WebSocket сразу).
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
  'embryo',
  'precipitate',
  'birth',
  'complete',
]

/** Session-level: переживает beginRun — повторный синтез мгновенный. */
const sessionAudioCache = new Map<string, LineAudio>()

function cacheKey(locale: LabTeacherLocale, speak: string): string {
  // Текст уже после lab-prep+stress в момент synth; ключ по сырому speak+locale+lab.
  return `lab|v2|${locale}|${speak}`
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
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

  /** In-flight prefetch для текущего locale. */
  private cache = new Map<Clo2TeacherLineId, CacheEntry>()
  private prefetchAbort: AbortController | null = null

  private playToken = 0
  private isPlaying = false

  setLocale(locale: LabTeacherLocale): void {
    if (this.locale === locale) return
    this.locale = locale
    // Locale сменился — сбрасываем in-flight prefetch (session cache остаётся).
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

  /**
   * Прогрев до нажатия «Синтез» — когда выбран ClO₂.
   * Не обрывает текущую речь.
   */
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
    this.isPlaying = false
    stopNeuralPlayback()
    stopBrowserSpeech()
    this.setSpeaking(false)
  }

  private abortPrefetch(): void {
    this.prefetchAbort?.abort()
    this.prefetchAbort = null
    for (const entry of this.cache.values()) entry.abort.abort()
    this.cache.clear()
  }

  /** Prefetch с лимитом параллелизма; использует session-кэш. */
  private async ensurePrefetch(): Promise<void> {
    // Если уже качаем для этого locale — не дублируем.
    if (this.prefetchAbort && this.cache.size > 0) return

    this.abortPrefetch()
    const abort = new AbortController()
    this.prefetchAbort = abort
    const locale = this.locale
    const ttsLocale = teacherTtsLocale(locale)

    const jobs: Array<() => Promise<void>> = []

    for (const id of CLO2_VOICED_CUES) {
      const line = getClo2TeacherLine(locale, id)
      if (!line.speak.trim()) continue

      const key = cacheKey(locale, line.speak)
      const cached = sessionAudioCache.get(key)
      if (cached) {
        const entry: CacheEntry = {
          key,
          result: cached,
          abort: new AbortController(),
          ready: Promise.resolve(cached),
        }
        this.cache.set(id, entry)
        continue
      }

      const entryAbort = new AbortController()
      abort.signal.addEventListener('abort', () => entryAbort.abort(), { once: true })

      const entry: CacheEntry = {
        key,
        result: null,
        abort: entryAbort,
        ready: Promise.resolve(null),
      }

      entry.ready = (async (): Promise<LineAudio | null> => {
        try {
          const preparedChunks = splitTextForTts(line.speak, locale, 'lab')

          const audio: LineAudio = []
          for (const chunk of preparedChunks) {
            if (entryAbort.signal.aborted) return null
            const r = await fetchTeacherTtsChunk(chunk, ttsLocale, entryAbort.signal, 'lab')
            if (r) audio.push({ audioBase64: r.audioBase64, mimeType: r.mimeType })
          }
          if (audio.length === 0) return null
          entry.result = audio
          sessionAudioCache.set(key, audio)
          return audio
        } catch {
          return null
        }
      })()

      this.cache.set(id, entry)
      jobs.push(async () => {
        await entry.ready
      })
    }

    // intro первым, остальное с concurrency.
    const runPool = async () => {
      let i = 0
      const workers = Array.from({ length: PREFETCH_CONCURRENCY }, async () => {
        while (i < jobs.length) {
          if (abort.signal.aborted) return
          const job = jobs[i++]!
          await job()
        }
      })
      await Promise.all(workers)
    }

    // Intro (index 0 в cache) уже стартовал через jobs[0] в pool — ок.
    void runPool()
  }

  private async playFromCache(id: Clo2TeacherLineId, token: number): Promise<void> {
    if (!this.voiceOn) return
    const line = getClo2TeacherLine(this.locale, id)
    if (!line.speak.trim()) return

    this.lastSpokenId = id
    this.setSpeaking(true)

    try {
      // Убедимся, что prefetch идёт.
      void this.ensurePrefetch()

      let audio: LineAudio | null = null
      const entry = this.cache.get(id)
      if (entry) {
        audio = entry.result ?? (await entry.ready)
      } else {
        // Холодный путь: синтез одной реплики с lab-prosody.
        const ttsLocale = teacherTtsLocale(this.locale)
        const chunks = splitTextForTts(line.speak, this.locale, 'lab')
        const ctrl = new AbortController()
        const results = await Promise.all(
          chunks.map((c) => fetchTeacherTtsChunk(c, ttsLocale, ctrl.signal, 'lab')),
        )
        audio = results
          .filter((r): r is NonNullable<typeof r> => r != null)
          .map((r) => ({ audioBase64: r.audioBase64, mimeType: r.mimeType }))
        if (audio.length > 0) {
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
    await speakWithBrowserVoice(chunks, locale, () => token !== this.playToken)
  }

  /**
   * Cue → мгновенная речь.
   * force / новый cue: прерываем текущую реплику (картинка = источник истины).
   */
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

    // HUD + SFX сразу — синхронно с кадром.
    this.publish(line)
    if (isCue) {
      const sfx = CLO2_TEACHER_SFX[id as Clo2CueId]
      if (sfx && this.voiceOn) playLabReactionSfx(sfx)
    }

    if (!this.voiceOn) return

    // Прерываем предыдущую речь — не копим очередь отставания.
    this.haltPlayback()
    this.isPlaying = true
    const token = this.playToken

    ;(async () => {
      try {
        if (token !== this.playToken) return
        await this.playFromCache(id, token)
      } finally {
        if (token === this.playToken) {
          this.isPlaying = false
          this.setSpeaking(false)
        }
      }
    })().catch(() => {
      if (token === this.playToken) {
        this.isPlaying = false
        this.setSpeaking(false)
      }
    })
  }

  speakCue(id: Clo2CueId): void {
    void this.speakLine(id)
  }

  speakIntro(): void {
    void this.speakLine('intro')
  }

  replay(): void {
    const id = this.lastSpokenId ?? 'intro'
    void this.speakLine(id, { force: true })
  }

  toggleVoice(): boolean {
    const next = !this.voiceOn
    this.setVoiceEnabled(next)
    return next
  }
}

let shared: LabTeacherNarrator | null = null

export function getLabTeacherNarrator(): LabTeacherNarrator {
  if (!shared) shared = new LabTeacherNarrator()
  return shared
}
