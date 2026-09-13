/**
 * Озвучка преподавателя в лаборатории.
 *
 * 1. Prefetch lab-prosody (intro → reagents → … → balance).
 * 2. Речь идёт по шагам урока: новый шаг прерывает текущую реплику.
 *    Cue сцены дают только SFX.
 * 3. Session-кэш аудио.
 * 4. Эксклюзивный канал: системный speechSynthesis глушится, только neural.
 * 5. Поздний intro не перебивает уже начавшийся шаг.
 */

import {
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
  claimSpeechChannel,
  isSpeechChannelCurrent,
  silenceForeignSpeech,
  stopAllAppSpeech,
} from '../../learn/learnSpeechExclusive'
import {
  CLO2_TEACHER_LINE_IDS,
  CLO2_TEACHER_SFX,
  getClo2TeacherLine,
  type Clo2TeacherLine,
  type Clo2TeacherLineId,
  type LabTeacherLocale,
} from './clo2TeacherScript'
import { playLabReactionSfx, primeLabReactionSfx } from './labReactionSfx'
import type { Clo2CueId, Clo2StepId } from '../cinema/scenes/clo2/clo2Steps'

const VOICE_STORAGE_KEY = 'atomlab-lab-teacher-voice'
const PREFETCH_CONCURRENCY = 3
/** Короткий wait — сцена уже идёт; долгий intro опаздывал и молчал. */
const INTRO_READY_TIMEOUT_MS = 700
/**
 * Пошаговый режим ждёт конца речи, поэтому холодный TTS можно подождать дольше,
 * чем в старом непрерывном ролике; не успел — HUD без голоса.
 */
const LINE_READY_TIMEOUT_MS = 2400

export function readLabTeacherVoiceEnabled(): boolean {
  try {
    const v = localStorage.getItem(VOICE_STORAGE_KEY)
    if (v === '0') return false
    if (v === '1') return true
  } catch {
    /* ignore */
  }
  /** По умолчанию молчим — учитель говорит только после «Объяснение». */
  return false
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

const CLO2_VOICED_LINES: readonly Clo2TeacherLineId[] = CLO2_TEACHER_LINE_IDS

/** Греем по порядку урока: к следующему шагу реплика обычно уже в кэше. */
const PRIORITY_PREFETCH: readonly Clo2TeacherLineId[] = CLO2_TEACHER_LINE_IDS

const sessionAudioCache = new Map<string, LineAudio>()

function cacheKey(locale: LabTeacherLocale, speak: string): string {
  return `lab|v6|${locale}|${speak}`
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function nextLineAfter(id: Clo2TeacherLineId): Clo2TeacherLineId | null {
  const i = CLO2_VOICED_LINES.indexOf(id)
  if (i < 0 || i >= CLO2_VOICED_LINES.length - 1) return null
  return CLO2_VOICED_LINES[i + 1] ?? null
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
  private channelEpoch = 0
  /** После первого шага поздний intro больше не стартует. */
  private suppressIntro = false

  setLocale(locale: LabTeacherLocale): void {
    if (this.locale === locale) return
    this.locale = locale
    this.abortPrefetch()
  }

  setVoiceEnabled(on: boolean): void {
    this.voiceOn = on
    writeLabTeacherVoiceEnabled(on)
    if (!on) {
      this.haltPlayback()
      this.publish(null)
    }
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
    void unlockAudioPlayback()
  }

  warmPrefetch(): void {
    if (!this.voiceOn) return
    void this.ensurePrefetch()
  }

  beginRun(): void {
    this.runToken += 1
    this.suppressIntro = false
    this.channelEpoch = claimSpeechChannel('lab')
    this.haltPlayback()
    this.publish(null)
    this.lastSpokenId = null
    if (this.voiceOn) void this.ensurePrefetch()
  }

  stop(): void {
    this.runToken += 1
    this.suppressIntro = true
    this.haltPlayback()
    this.publish(null)
    this.abortPrefetch()
    stopAllAppSpeech()
  }

  private haltPlayback(): void {
    this.playToken += 1
    silenceForeignSpeech('lab')
    this.setSpeaking(false)
  }

  /**
   * Смена реплики: глушим старое аудио сразу (иначе оно звучит, пока грузится новое),
   * но флаг speaking не роняем — ожидающий конца речи шаг не должен увидеть ложный «false».
   */
  private interruptPlayback(): void {
    this.playToken += 1
    silenceForeignSpeech('lab')
    if (this.speaking) stopNeuralPlayback()
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
      // Неудача не кэшируется навсегда: следующий шаг попробует синтез заново.
      else if (this.cache.get(id) === entry) this.cache.delete(id)
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

        const rest = CLO2_VOICED_LINES.filter((id) => !PRIORITY_PREFETCH.includes(id))
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
        // Ждём один раз, пока запись не решится (звук или null) или не выйдет время.
        // Крутить цикл на уже решённом промисе нельзя: это микрозадачи без выхода
        // в event loop — страница и 3D-сцена замирают до дедлайна.
        await Promise.race([entry.ready, delay(Math.max(0, deadline - Date.now()))])
        return
      }
      await delay(40)
    }
  }

  private async playFromCache(id: Clo2TeacherLineId, token: number, channelEpoch: number): Promise<void> {
    const line = getClo2TeacherLine(this.locale, id)
    if (!this.voiceOn || !isSpeechChannelCurrent(channelEpoch, 'lab') || !line.speak.trim()) {
      if (token === this.playToken) this.setSpeaking(false)
      return
    }

    this.lastSpokenId = id
    this.setSpeaking(true)

    const next = nextLineAfter(id)
    if (next) void this.ensureLineReady(next, LINE_READY_TIMEOUT_MS)

    try {
      await this.ensureLineReady(id, LINE_READY_TIMEOUT_MS)
      if (token !== this.playToken) return
      if (!isSpeechChannelCurrent(channelEpoch, 'lab')) return

      let audio: LineAudio | null = null
      const entry = this.cache.get(id)
      if (entry?.result?.length) {
        audio = entry.result
      } else if (entry) {
        // Мягкий таймаут уже прошёл в ensureLineReady — не ждём холодный TTS вечно.
        audio = entry.result
        if (!audio?.length) {
          const raced = await Promise.race([
            entry.ready,
            delay(120).then(() => null as LineAudio | null),
          ])
          audio = raced
        }
      } else {
        // Слишком поздно стартовать synth — пропускаем голос, HUD уже есть.
        return
      }

      if (token !== this.playToken) return
      if (!isSpeechChannelCurrent(channelEpoch, 'lab')) return

      if (!audio || audio.length === 0) {
        // Без системного фолбэка: HUD уже показывает текст, робот не мешает neural.
        return
      }

      silenceForeignSpeech('lab')
      await unlockAudioPlayback()
      if (token !== this.playToken) return
      if (!isSpeechChannelCurrent(channelEpoch, 'lab')) return

      for (let i = 0; i < audio.length; i++) {
        if (token !== this.playToken) return
        if (!isSpeechChannelCurrent(channelEpoch, 'lab')) return
        if (i > 0) await delay(TTS_LAB_CHUNK_GAP_MS)
        if (token !== this.playToken) return
        silenceForeignSpeech('lab')
        try {
          await playNeuralAudioBase64(audio[i]!.audioBase64, audio[i]!.mimeType)
        } catch {
          // Не включаем speechSynthesis — он и есть «системный голос».
          return
        }
      }
    } finally {
      if (token === this.playToken) this.setSpeaking(false)
    }
  }

  async speakLine(id: Clo2TeacherLineId, opts?: { force?: boolean }): Promise<void> {
    const line = getClo2TeacherLine(this.locale, id)

    /** Без включённого «Объяснения» — ни текст, ни голос. */
    if (!this.voiceOn && !opts?.force) return

    if (!line.speak.trim()) return

    if (id !== 'intro') this.suppressIntro = true

    this.publish(line)
    this.lastSpokenId = id

    if (!isSpeechChannelCurrent(this.channelEpoch, 'lab')) {
      this.channelEpoch = claimSpeechChannel('lab')
    } else {
      silenceForeignSpeech('lab')
    }

    this.interruptPlayback()
    const token = this.playToken
    const channelEpoch = this.channelEpoch

    void this.playFromCache(id, token, channelEpoch).catch(() => {
      if (token === this.playToken) this.setSpeaking(false)
    })
  }

  /**
   * Реплика шага: прерывает текущую речь и публикует титр.
   * isSpeaking() становится true синхронно (при включённом голосе) и гаснет,
   * когда реплика договорена или голос пропущен.
   */
  speakStep(id: Clo2StepId): void {
    this.suppressIntro = true
    void this.speakLine(id)
  }

  /** Событие сцены: только SFX, речь не трогаем. */
  speakCue(id: Clo2CueId): void {
    if (!this.voiceOn) return
    const sfx = CLO2_TEACHER_SFX[id]
    if (sfx) playLabReactionSfx(sfx)
  }

  speakIntro(): void {
    const run = this.runToken
    void (async () => {
      if (this.voiceOn) await this.ensureLineReady('intro', INTRO_READY_TIMEOUT_MS)
      if (run !== this.runToken) return
      if (this.suppressIntro) return
      void this.speakLine('intro')
    })()
  }

  replay(): void {
    const id = this.lastSpokenId ?? 'intro'
    this.channelEpoch = claimSpeechChannel('lab')
    void this.speakLine(id, { force: true })
  }

  toggleVoice(): boolean {
    const next = !this.voiceOn
    this.setVoiceEnabled(next)
    if (next) {
      this.channelEpoch = claimSpeechChannel('lab')
      void this.ensurePrefetch()
    } else {
      stopAllAppSpeech()
    }
    return next
  }
}

let shared: LabTeacherNarrator | null = null

export function getLabTeacherNarrator(): LabTeacherNarrator {
  if (!shared) shared = new LabTeacherNarrator()
  return shared
}
