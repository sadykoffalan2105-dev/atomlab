/**
 * Озвучка преподавателя в лаборатории: cue → TTS.
 * Микро-cue без текста не рвут речь; профиль lab — цельные фразы.
 */

import {
  LearnSpeechController,
  type LearnSpeechLocale,
  preloadSpeechVoices,
} from '../../learn/learnSpeech'
import { primeTeacherVoiceOnUserGesture } from '../../learn/learnTeacherTtsClient'
import { setTeacherTtsProsodyMode } from '../../learn/learnTeacherVoiceProfile'
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

export class LabTeacherNarrator {
  private speech = new LearnSpeechController()
  private locale: LabTeacherLocale = 'ru'
  private voiceOn = readLabTeacherVoiceEnabled()
  private runToken = 0
  private listener: LabTeacherNarratorListener | null = null
  private speakingListener: LabTeacherSpeakingListener | null = null
  private currentLine: Clo2TeacherLine | null = null
  private speaking = false
  private lastSpokenId: Clo2TeacherLineId | null = null

  setLocale(locale: LabTeacherLocale): void {
    this.locale = locale
  }

  setVoiceEnabled(on: boolean): void {
    this.voiceOn = on
    writeLabTeacherVoiceEnabled(on)
    if (!on) {
      this.speech.stop()
      this.setSpeaking(false)
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

  /** User gesture: разблокировать TTS + AudioContext. */
  prime(): void {
    primeTeacherVoiceOnUserGesture()
    primeLabReactionSfx()
    preloadSpeechVoices()
  }

  /** Новый прогон синтеза — обрываем предыдущую речь. */
  beginRun(): void {
    this.runToken += 1
    this.speech.stop()
    this.setSpeaking(false)
    this.publish(null)
    this.lastSpokenId = null
  }

  stop(): void {
    this.runToken += 1
    this.speech.stop()
    setTeacherTtsProsodyMode('default')
    this.setSpeaking(false)
    this.publish(null)
  }

  async speakLine(id: Clo2TeacherLineId, opts?: { force?: boolean }): Promise<void> {
    const line = getClo2TeacherLine(this.locale, id)
    const isCue = id !== 'intro'
    const silent = isCue && CLO2_SPEECH_SILENT.has(id as Clo2CueId)

    if (silent && !opts?.force) {
      if (isCue) {
        const sfx = CLO2_TEACHER_SFX[id as Clo2CueId]
        if (sfx && this.voiceOn) playLabReactionSfx(sfx)
      }
      return
    }

    if (!line.speak.trim()) return

    this.publish(line)
    this.lastSpokenId = id

    if (isCue) {
      const sfx = CLO2_TEACHER_SFX[id as Clo2CueId]
      if (sfx && this.voiceOn) playLabReactionSfx(sfx)
    }

    if (!this.voiceOn) return

    const token = this.runToken
    const locale = this.locale as LearnSpeechLocale
    this.setSpeaking(true)
    setTeacherTtsProsodyMode('lab')
    try {
      await this.speech.speak(line.speak, locale, { profile: 'lab' })
    } finally {
      setTeacherTtsProsodyMode('default')
      if (token === this.runToken) this.setSpeaking(false)
    }
  }

  speakCue(id: Clo2CueId): void {
    void this.speakLine(id)
  }

  speakIntro(): void {
    void this.speakLine('intro')
  }

  /** Повторить последнюю реплику или intro. */
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
