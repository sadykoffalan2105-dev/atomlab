/**
 * Duplex Voice Session — движок непрерывного голосового диалога.
 *
 * Одновременно:
 *  • слушает микрофон (VAD + потоковый STT),
 *  • озвучивает реплики ИИ (нейро-TTS учителя),
 *  • обрабатывает барджин: если ученик заговорил поверх ИИ — мгновенно глушит
 *    озвучку, фиксирует входящий поток и отдаёт финальную реплику наверх для
 *    пересчёта ответа.
 *
 * Класс отвечает только за реальный ввод-вывод; «что сказать» решает мозг/оркестратор.
 */
import type { LearnSpeechController, LearnSpeechLocale } from '../../learnSpeech'
import type { AssistantLang } from '../brainTypes'
import { AudioActivityDetector } from './audioActivityDetector'
import { InterruptionController, type DialogTurn } from './interruptionController'

export interface DuplexSessionConfig {
  lang: AssistantLang
  controller: LearnSpeechController
  bargeInEnabled?: boolean
  onPartial?: (text: string) => void
  onUserUtterance: (finalText: string) => void
  onTurnChange?: (turn: DialogTurn) => void
  onAiSpeakingChange?: (speaking: boolean) => void
  onLevel?: (rms: number) => void
}

function toSpeechLocale(lang: AssistantLang): LearnSpeechLocale {
  return lang
}

export class DuplexVoiceSession {
  private readonly cfg: DuplexSessionConfig
  private readonly vad: AudioActivityDetector
  private readonly interruption: InterruptionController
  private readonly sttSession = { committed: '' }
  private consumedLen = 0
  private aiSpeaking = false
  private active = false
  private pendingBargeText = ''

  constructor(config: DuplexSessionConfig) {
    this.cfg = config
    this.interruption = new InterruptionController({
      bargeInConfirmMs: 260,
      onStopAiSpeech: () => this.hardStopSpeech(),
      onBargeIn: () => this.handleBargeIn(),
      onTurnChange: (turn) => this.cfg.onTurnChange?.(turn),
    })
    this.vad = new AudioActivityDetector({
      onSpeechStart: () => this.interruption.userSpeechStarted(),
      onSpeechEnd: (d) => this.onVadSpeechEnd(d),
      onLevel: (rms, speaking) => {
        this.cfg.onLevel?.(rms)
        if (speaking) this.interruption.userSpeechTick()
      },
    })
  }

  /** Запустить сессию на потоке микрофона. */
  async begin(micStream: MediaStream): Promise<boolean> {
    this.active = true
    this.consumedLen = 0
    this.sttSession.committed = ''
    const vadOk = await this.vad.attach(micStream)

    this.cfg.controller.startOralListening(
      toSpeechLocale(this.cfg.lang),
      this.sttSession,
      (full, interim) => {
        this.cfg.onPartial?.(interim || full.slice(this.consumedLen))
      },
    )
    return vadOk
  }

  getTurn(): DialogTurn {
    return this.interruption.getTurn()
  }

  private setAiSpeaking(v: boolean): void {
    if (this.aiSpeaking === v) return
    this.aiSpeaking = v
    this.cfg.onAiSpeakingChange?.(v)
  }

  private hardStopSpeech(): void {
    this.cfg.controller.stop()
    this.setAiSpeaking(false)
  }

  private handleBargeIn(): void {
    // ИИ заглушён; помечаем, что ждём финальную реплику ученика для пересчёта.
    this.pendingBargeText = ''
    this.interruption.thinkingStarted()
  }

  private onVadSpeechEnd(_durationMs: number): void {
    if (!this.active) return
    this.interruption.userSpeechEnded()
    // Берём прирост распознанного текста с момента прошлой реплики.
    const full = this.sttSession.committed.trim()
    const fresh = full.slice(this.consumedLen).trim()
    if (fresh.length >= 2) {
      this.consumedLen = full.length
      this.cfg.onUserUtterance(fresh)
    } else if (this.pendingBargeText) {
      this.cfg.onUserUtterance(this.pendingBargeText.trim())
      this.pendingBargeText = ''
    }
  }

  /** Озвучить реплику ИИ. Возвращает true, если дочитал без перебивания. */
  async speak(text: string): Promise<boolean> {
    if (!text.trim()) return false
    this.interruption.aiSpeechStarted()
    this.setAiSpeaking(true)
    const finished = await this.cfg.controller.speak(text, toSpeechLocale(this.cfg.lang))
    this.setAiSpeaking(false)
    this.interruption.aiSpeechEnded()
    return finished
  }

  /** Явно сообщить мозгу «я думаю» (пока идёт оценка/генерация). */
  markThinking(): void {
    this.interruption.thinkingStarted()
  }

  isAiSpeaking(): boolean {
    return this.aiSpeaking
  }

  end(): void {
    this.active = false
    this.hardStopSpeech()
    this.cfg.controller.stopOralListening()
    this.vad.detach()
    this.interruption.reset()
  }
}
