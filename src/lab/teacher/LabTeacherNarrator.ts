/**
 * Озвучка преподавателя в лаборатории: cue → мгновенное воспроизведение.
 *
 * Стратегия: при beginRun() **сразу** синтезируем аудио для всех реплик
 * параллельно (не ждём cue). Когда cue наступает — аудио уже готово, латентность
 * практически нулевая. Реплики не прерывают друг друга: текущая не обрывается
 * при новом cue, следующая встаёт в очередь.
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
import { setTeacherTtsProsodyMode } from '../../learn/learnTeacherVoiceProfile'
import {
  splitTextForTts,
  TTS_LAB_CHUNK_GAP_MS,
} from '../../learn/learnSpeechText'
import {
  isNeuralPlaybackActive,
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

/** Аудио для одной реплики: несколько чанков (предложений). */
type LineAudio = Array<{ audioBase64: string; mimeType: string }>

/** Состояние предзагрузки для одной реплики. */
type CacheEntry = {
  /** Promise, завершается когда ВСЕ чанки этой реплики готовы. */
  ready: Promise<LineAudio | null>
  /** Результат (null = ещё не готов или ошибка). */
  result: LineAudio | null
  abort: AbortController
}

/** Все реплики из CLO2_CUES которые имеют текст. */
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

export class LabTeacherNarrator {
  private locale: LabTeacherLocale = 'ru'
  private voiceOn = readLabTeacherVoiceEnabled()
  private runToken = 0

  private listener: LabTeacherNarratorListener | null = null
  private speakingListener: LabTeacherSpeakingListener | null = null
  private currentLine: Clo2TeacherLine | null = null
  private speaking = false
  private lastSpokenId: Clo2TeacherLineId | null = null

  /** Кэш предзагруженного аудио для текущего прогона. */
  private cache = new Map<Clo2TeacherLineId, CacheEntry>()

  /** Очередь ожидающих cue (если сейчас уже говорит). */
  private pendingQueue: Clo2TeacherLineId[] = []
  private isPlaying = false
  private playToken = 0

  setLocale(locale: LabTeacherLocale): void {
    this.locale = locale
  }

  setVoiceEnabled(on: boolean): void {
    this.voiceOn = on
    writeLabTeacherVoiceEnabled(on)
    if (!on) {
      this.haltPlayback()
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

  /** User gesture — разблокировать AudioContext и прогреть голоса. */
  prime(): void {
    primeTeacherVoiceOnUserGesture()
    primeLabReactionSfx()
    preloadSpeechVoices()
  }

  /**
   * Начало нового прогона реакции:
   * — обрываем текущую речь
   * — запускаем предзагрузку ВСЕХ реплик параллельно (fire-and-forget)
   * — speakIntro вызывается отдельно сразу после beginRun
   */
  beginRun(): void {
    this.runToken += 1
    this.haltPlayback()
    this.publish(null)
    this.lastSpokenId = null

    if (this.voiceOn) {
      this.prefetchAll()
    }
  }

  stop(): void {
    this.runToken += 1
    this.haltPlayback()
    setTeacherTtsProsodyMode('default')
    this.publish(null)
    // Отменяем все prefetch-запросы.
    for (const entry of this.cache.values()) {
      entry.abort.abort()
    }
    this.cache.clear()
  }

  private haltPlayback(): void {
    this.playToken += 1
    this.pendingQueue = []
    this.isPlaying = false
    stopNeuralPlayback()
    stopBrowserSpeech()
    this.setSpeaking(false)
  }

  /**
   * Предзагрузка: для каждой озвученной реплики сразу отправляем TTS-запросы.
   * Результаты сохраняем в кэш — при cue они уже будут готовы.
   */
  private prefetchAll(): void {
    // Отменяем предыдущий кэш, если он ещё качается.
    for (const entry of this.cache.values()) {
      entry.abort.abort()
    }
    this.cache.clear()

    const locale = teacherTtsLocale(this.locale as 'ru' | 'en' | 'uz')
    setTeacherTtsProsodyMode('lab')

    for (const id of CLO2_VOICED_CUES) {
      const line = getClo2TeacherLine(this.locale, id)
      if (!line.speak.trim()) continue

      const abort = new AbortController()
      const chunks = splitTextForTts(line.speak, this.locale as 'ru' | 'en' | 'uz', 'lab')

      const entry: CacheEntry = {
        ready: Promise.resolve(null),
        result: null,
        abort,
      }

      entry.ready = (async (): Promise<LineAudio | null> => {
        try {
          const results = await Promise.all(
            chunks.map((chunk) => fetchTeacherTtsChunk(chunk, locale, abort.signal)),
          )
          if (abort.signal.aborted) return null
          // Если хоть один чанк не загрузился — попробуем говорить по тем, что есть.
          const audio: LineAudio = results
            .map((r, i) => (r ? { audioBase64: r.audioBase64, mimeType: r.mimeType } : null))
            .filter((r): r is { audioBase64: string; mimeType: string } => r !== null)
          if (audio.length === 0) return null
          entry.result = audio
          return audio
        } catch {
          return null
        }
      })()

      this.cache.set(id, entry)
    }

    setTeacherTtsProsodyMode('default')
  }

  /**
   * Воспроизвести реплику немедленно из кэша.
   * Если кэш ещё не готов — ждём Promise (обычно уже готово к моменту cue).
   */
  private async playFromCache(id: Clo2TeacherLineId, token: number): Promise<void> {
    if (!this.voiceOn) return

    const line = getClo2TeacherLine(this.locale, id)
    if (!line.speak.trim()) return

    this.lastSpokenId = id
    this.setSpeaking(true)
    setTeacherTtsProsodyMode('lab')

    try {
      let audio: LineAudio | null = null
      const entry = this.cache.get(id)

      if (entry) {
        // Ждём prefetch — обычно уже завершён.
        audio = entry.result ?? await entry.ready
      }

      if (token !== this.playToken) return

      if (audio && audio.length > 0) {
        // === Нейронный голос из кэша (мгновенно) ===
        await unlockAudioPlayback()
        if (token !== this.playToken) return

        for (let i = 0; i < audio.length; i++) {
          if (token !== this.playToken) return
          const chunk = audio[i]!
          if (i > 0) await this.delay(TTS_LAB_CHUNK_GAP_MS)
          if (token !== this.playToken) return
          try {
            await playNeuralAudioBase64(chunk.audioBase64, chunk.mimeType)
          } catch {
            // Первый чанк не проиграл — падаем на браузер.
            if (i === 0) {
              await this.playFallback(line.speak, token)
            }
            return
          }
        }
      } else {
        // === Кэш пуст или не загрузился — браузерный голос ===
        await this.playFallback(line.speak, token)
      }
    } finally {
      setTeacherTtsProsodyMode('default')
      if (token === this.playToken) this.setSpeaking(false)
    }
  }

  private async playFallback(text: string, token: number): Promise<void> {
    if (!isBrowserSpeechSupported()) return
    const locale = this.locale as LearnSpeechLocale
    const chunks = splitTextForTts(text, locale, 'lab')
    await speakWithBrowserVoice(chunks, locale, () => token !== this.playToken)
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Основной метод — cue запускает эту функцию.
   * Если сейчас уже говорим — встаём в очередь.
   * Если свободны — немедленно играем.
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

    // HUD обновляем сразу — не ждём пока аудио начнёт играть.
    this.publish(line)

    // SFX — сразу при cue.
    if (isCue) {
      const sfx = CLO2_TEACHER_SFX[id as Clo2CueId]
      if (sfx && this.voiceOn) playLabReactionSfx(sfx)
    }

    if (opts?.force) {
      // Replay: прерываем текущую речь и очередь.
      this.haltPlayback()
    }

    if (!this.voiceOn) return

    if (this.isPlaying && !opts?.force) {
      // Добавляем в очередь без дубликатов.
      if (!this.pendingQueue.includes(id)) {
        this.pendingQueue.push(id)
      }
      return
    }

    // Запускаем воспроизведение.
    const token = this.playToken
    this.isPlaying = true

    ;(async () => {
      try {
        if (token !== this.playToken) return
        await this.playFromCache(id, token)

        // Проигрываем очередь.
        while (this.pendingQueue.length > 0) {
          if (token !== this.playToken) return
          const next = this.pendingQueue.shift()!
          const nextLine = getClo2TeacherLine(this.locale, next)
          if (!nextLine.speak.trim()) continue
          this.publish(nextLine)
          await this.playFromCache(next, token)
        }
      } finally {
        if (token === this.playToken) {
          this.isPlaying = false
          this.setSpeaking(false)
        }
      }
    })().catch(() => {
      // Ошибки не должны ломать анимацию.
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

/** Singleton на сессию страницы лаборатории. */
let shared: LabTeacherNarrator | null = null

export function getLabTeacherNarrator(): LabTeacherNarrator {
  if (!shared) shared = new LabTeacherNarrator()
  return shared
}
