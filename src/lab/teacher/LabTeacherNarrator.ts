/**
 * Озвучка преподавателя в лаборатории: cue → TTS, прерывание на новом run.
 */

import {
  LearnSpeechController,
  type LearnSpeechLocale,
  preloadSpeechVoices,
} from '../../learn/learnSpeech'
import { primeTeacherVoiceOnUserGesture } from '../../learn/learnTeacherTtsClient'
import {
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

export class LabTeacherNarrator {
  private speech = new LearnSpeechController()
  private locale: LabTeacherLocale = 'ru'
  private voiceOn = readLabTeacherVoiceEnabled()
  private runToken = 0
  private listener: LabTeacherNarratorListener | null = null
  private currentLine: Clo2TeacherLine | null = null

  setLocale(locale: LabTeacherLocale): void {
    this.locale = locale
  }

  setVoiceEnabled(on: boolean): void {
    this.voiceOn = on
    writeLabTeacherVoiceEnabled(on)
    if (!on) this.speech.stop()
  }

  isVoiceEnabled(): boolean {
    return this.voiceOn
  }

  getCurrentLine(): Clo2TeacherLine | null {
    return this.currentLine
  }

  subscribe(listener: LabTeacherNarratorListener): () => void {
    this.listener = listener
    listener(this.currentLine)
    return () => {
      if (this.listener === listener) this.listener = null
    }
  }

  private publish(line: Clo2TeacherLine | null): void {
    this.currentLine = line
    this.listener?.(line)
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
    this.publish(null)
  }

  stop(): void {
    this.runToken += 1
    this.speech.stop()
    this.publish(null)
  }

  async speakLine(id: Clo2TeacherLineId): Promise<void> {
    const line = getClo2TeacherLine(this.locale, id)
    this.publish(line)

    if (id !== 'intro') {
      const sfx = CLO2_TEACHER_SFX[id as Clo2CueId]
      if (sfx && this.voiceOn) playLabReactionSfx(sfx)
    }

    if (!this.voiceOn) return

    const token = this.runToken
    const locale = this.locale as LearnSpeechLocale
    await this.speech.speak(line.speak, locale)
    if (token !== this.runToken) return
  }

  speakCue(id: Clo2CueId): void {
    void this.speakLine(id)
  }

  speakIntro(): void {
    void this.speakLine('intro')
  }
}

/** Singleton на сессию страницы лаборатории. */
let shared: LabTeacherNarrator | null = null

export function getLabTeacherNarrator(): LabTeacherNarrator {
  if (!shared) shared = new LabTeacherNarrator()
  return shared
}
