/**
 * Duplex Voice Session — движок непрерывного голосового диалога.
 *
 * Half-duplex по умолчанию против эха колонок:
 *  • пока ИИ говорит — STT остановлен, VAD не принимает «речь» как ученика;
 *  • после TTS — короткая пауза, сброс буфера, затем снова слушаем (STT стартует рано);
 *  • реплики, похожие на только что сказанный текст учителя, отбрасываются.
 *
 * Барджин (перебивание) включается только если `bargeInEnabled: true` и STT активен.
 */
import type { LearnSpeechController, LearnSpeechLocale } from '../../learnSpeech'
import type { AssistantLang } from '../brainTypes'
import { AudioActivityDetector } from './audioActivityDetector'
import { InterruptionController, type DialogTurn } from './interruptionController'

export interface DuplexSessionConfig {
  lang: AssistantLang
  controller: LearnSpeechController
  /** Разрешить перебивать ИИ голосом. По умолчанию false (анти-эхо). */
  bargeInEnabled?: boolean
  /** Пауза после TTS перед возобновлением STT (мс). */
  postSpeakDelayMs?: number
  onPartial?: (text: string) => void
  onUserUtterance: (finalText: string) => void
  onTurnChange?: (turn: DialogTurn) => void
  onAiSpeakingChange?: (speaking: boolean) => void
  onLevel?: (rms: number) => void
}

function toSpeechLocale(lang: AssistantLang): LearnSpeechLocale {
  return lang
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Нормализация для сравнения «эхо учителя» vs реплика ученика. */
function normalizeEcho(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenSet(text: string): Set<string> {
  return new Set(normalizeEcho(text).split(' ').filter((t) => t.length >= 3))
}

/** Высокое пересечение токенов / подстрока → это эхо озвучки учителя. */
export function looksLikeTeacherEcho(userText: string, teacherText: string): boolean {
  const u = normalizeEcho(userText)
  const t = normalizeEcho(teacherText)
  if (!u || u.length < 4) return false
  if (!t) return false
  // Короткая самостоятельная реплика («да», «понял», «оксид») — не эхо.
  if (u.split(' ').length <= 3 && u.length <= 24 && !t.startsWith(u)) return false
  if (t.includes(u) || u.includes(t.slice(0, Math.min(t.length, 80)))) return true
  const ut = tokenSet(u)
  const tt = tokenSet(t)
  if (ut.size === 0) return false
  let hit = 0
  for (const tok of ut) if (tt.has(tok)) hit++
  const overlap = hit / ut.size
  // Строже: меньше ложных «эхо» на нормальные ответы ученика.
  return ut.size <= 4 ? overlap >= 0.85 : overlap >= 0.7
}

export class DuplexVoiceSession {
  private readonly cfg: DuplexSessionConfig
  private readonly vad: AudioActivityDetector
  private readonly interruption: InterruptionController
  private readonly sttSession = { committed: '' }
  private consumedLen = 0
  private aiSpeaking = false
  private active = false
  private listening = false
  private pendingBargeText = ''
  private lastAiText = ''
  private lastAiTexts: string[] = []
  private listenResumeAt = 0
  private readonly bargeInEnabled: boolean
  private readonly postSpeakDelayMs: number
  private lastEmitMs = 0
  private sttFinalTimer: ReturnType<typeof setTimeout> | null = null

  constructor(config: DuplexSessionConfig) {
    this.cfg = config
    this.bargeInEnabled = config.bargeInEnabled === true
    // Быстрый возврат к слушанию после TTS (раньше было ~550 мс).
    this.postSpeakDelayMs = config.postSpeakDelayMs ?? 200
    this.interruption = new InterruptionController({
      bargeInConfirmMs: 220,
      bargeInEnabled: this.bargeInEnabled,
      onStopAiSpeech: () => this.hardStopSpeech(),
      onBargeIn: () => this.handleBargeIn(),
      onTurnChange: (turn) => this.cfg.onTurnChange?.(turn),
    })
    this.vad = new AudioActivityDetector({
      startThreshold: 0.03,
      endThreshold: 0.016,
      silenceHangoverMs: 380,
      minSpeechMs: 110,
      onSpeechStart: () => {
        if (this.shouldIgnoreMicAsUser()) return
        this.interruption.userSpeechStarted()
      },
      onSpeechEnd: (d) => this.onVadSpeechEnd(d),
      onLevel: (rms, speaking) => {
        this.cfg.onLevel?.(rms)
        if (speaking && !this.shouldIgnoreMicAsUser()) this.interruption.userSpeechTick()
      },
    })
  }

  /** Пока говорит ИИ / идёт пауза после TTS — микрофон не считаем учеником. */
  private shouldIgnoreMicAsUser(): boolean {
    if (!this.active) return true
    if (this.aiSpeaking) return true
    if (Date.now() < this.listenResumeAt) return true
    return false
  }

  private startStt(): void {
    if (!this.active || this.listening) return
    this.cfg.controller.startOralListening(
      toSpeechLocale(this.cfg.lang),
      this.sttSession,
      (full, interim) => {
        if (this.shouldIgnoreMicAsUser()) return
        this.cfg.onPartial?.(interim || full.slice(this.consumedLen))
        // Не ждём только VAD: финальные куски STT принимаем быстрее.
        if (!interim && full.trim().length > this.consumedLen) {
          this.scheduleSttFinalCommit()
        }
      },
    )
    this.listening = true
  }

  private stopStt(): void {
    if (this.sttFinalTimer) {
      clearTimeout(this.sttFinalTimer)
      this.sttFinalTimer = null
    }
    if (!this.listening) return
    this.cfg.controller.stopOralListening()
    this.listening = false
  }

  /** Сбросить всё, что STT мог накопить (эхо / мусор), и считать с чистого листа. */
  private discardSttBuffer(): void {
    this.consumedLen = this.sttSession.committed.length
    this.cfg.onPartial?.('')
  }

  private scheduleSttFinalCommit(): void {
    if (this.sttFinalTimer) clearTimeout(this.sttFinalTimer)
    this.sttFinalTimer = setTimeout(() => {
      this.sttFinalTimer = null
      if (this.shouldIgnoreMicAsUser()) return
      this.commitFreshUtterance()
    }, 280)
  }

  private commitFreshUtterance(): void {
    if (!this.active || this.shouldIgnoreMicAsUser()) return
    const full = this.sttSession.committed.trim()
    const fresh = full.slice(this.consumedLen).trim()
    if (fresh.length < 2) return
    // Анти-дребезг: не слать ту же реплику дважды подряд.
    if (Date.now() - this.lastEmitMs < 350) return
    this.consumedLen = full.length
    this.lastEmitMs = Date.now()
    this.interruption.userSpeechEnded()
    this.emitUserUtterance(fresh)
  }

  /** Запустить сессию на потоке микрофона. */
  async begin(micStream: MediaStream): Promise<boolean> {
    this.active = true
    this.consumedLen = 0
    this.sttSession.committed = ''
    this.lastAiText = ''
    this.listenResumeAt = 0
    const vadOk = await this.vad.attach(micStream)
    this.startStt()
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
    this.pendingBargeText = ''
    this.interruption.thinkingStarted()
  }

  private emitUserUtterance(fresh: string): void {
    const text = fresh.trim()
    if (text.length < 2) return
    const against = [this.lastAiText, ...this.lastAiTexts]
    if (against.some((t) => looksLikeTeacherEcho(text, t))) {
      return
    }
    this.cfg.onUserUtterance(text)
  }

  private onVadSpeechEnd(_durationMs: number): void {
    if (!this.active) return
    if (this.shouldIgnoreMicAsUser()) {
      this.discardSttBuffer()
      return
    }
    this.interruption.userSpeechEnded()
    if (this.sttFinalTimer) {
      clearTimeout(this.sttFinalTimer)
      this.sttFinalTimer = null
    }
    const full = this.sttSession.committed.trim()
    const fresh = full.slice(this.consumedLen).trim()
    if (fresh.length >= 2) {
      if (Date.now() - this.lastEmitMs < 350) return
      this.consumedLen = full.length
      this.lastEmitMs = Date.now()
      this.emitUserUtterance(fresh)
    } else if (this.pendingBargeText) {
      this.emitUserUtterance(this.pendingBargeText)
      this.pendingBargeText = ''
    }
  }

  /**
   * Озвучить реплику ИИ.
   * На время речи полностью глушим STT, чтобы учитель не «записывал сам себя».
   */
  async speak(text: string): Promise<boolean> {
    if (!text.trim()) return false
    this.lastAiText = text
    this.lastAiTexts = [text, ...this.lastAiTexts].slice(0, 3)
    this.stopStt()
    this.discardSttBuffer()
    this.interruption.aiSpeechStarted()
    this.setAiSpeaking(true)

    let finished = false
    try {
      finished = await this.cfg.controller.speak(text, toSpeechLocale(this.cfg.lang))
    } finally {
      this.setAiSpeaking(false)
      this.interruption.aiSpeechEnded()
      const delay = this.postSpeakDelayMs
      this.listenResumeAt = Date.now() + delay
      // Ранний старт STT: прогреваем распознавание, пока ещё игнорируем VAD.
      if (this.active) this.startStt()
      await sleep(delay)
      this.discardSttBuffer()
      this.listenResumeAt = 0
    }
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
    this.stopStt()
    this.vad.detach()
    this.interruption.reset()
  }
}
