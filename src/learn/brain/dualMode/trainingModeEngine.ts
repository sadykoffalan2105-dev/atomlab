/**
 * Движок режима «Обучение». Профессор-наставник: полные объяснения из
 * химической базы + быстрый Puter, с учётом эмоции ученика с камеры.
 */
import { composeExpertLocalReply } from '../../learnExpertLocalReply'
import type { LearnLocalAssistantContext } from '../../learnLocalAssistant'
import { requestPuterChat } from '../../learnPuterChat'
import type { EmotionState } from '../brainTypes'
import { emotionPromptHint } from './cameraEmotionCoach'
import { buildLiveOnlineBrainDirective } from './liveOnlineBrain'
import { clarifyPrompt } from './personaProfiles'
import type { AssistantLang } from './dualModeTypes'

export interface TrainingEngineConfig {
  lang: AssistantLang
  gradeId: string
  chapterId: string
  sectionId?: string
  sectionTitle?: string
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

type RaceWin = { kind: 'puter' | 'local'; text: string }

export class TrainingModeEngine {
  private readonly cfg: TrainingEngineConfig

  constructor(config: TrainingEngineConfig) {
    this.cfg = config
  }

  private buildContext(topic: string, emotion: EmotionState = 'neutral'): LearnLocalAssistantContext {
    const cameraHint = emotionPromptHint(this.cfg.lang, emotion)
    const liveBrain = buildLiveOnlineBrainDirective(this.cfg.lang)
    return {
      locale: this.cfg.lang,
      gradeId: this.cfg.gradeId,
      chapterId: this.cfg.chapterId,
      sectionId: this.cfg.sectionId ?? 's01',
      sectionTitle: this.cfg.sectionTitle ?? topic,
      slideTitle: topic,
      slideBody: `${liveBrain}\nCAMERA: ${cameraHint}`,
      mode: 'teacher',
      kpNumber: 1,
    }
  }

  explain(query: string, topic: string, history: { role: string; content: string }[] = []): string {
    const reply = composeExpertLocalReply(query, this.buildContext(topic), history)
    if (reply && reply.trim()) return reply.trim()
    return this.fallback(query)
  }

  /**
   * Умное объяснение для live с учётом эмоции камеры.
   * Race: Puter побеждает, если успел быстро; иначе сильный локальный ответ —
   * чтобы ученик не ждал 4–7 с тишины.
   */
  async explainAsync(
    query: string,
    topic: string,
    history: { role: string; content: string }[] = [],
    emotion: EmotionState = 'neutral',
  ): Promise<string> {
    const ctx = this.buildContext(topic, emotion)
    const messages = [...history.slice(-6), { role: 'user', content: query }]
    const local = this.explain(query, topic, history)
    const strongLocal =
      local.length >= 120 &&
      !/Давай разберём по шагам|Let us reason|bosqichma-bosqich fikrlaymiz/i.test(local)

    const tired = emotion === 'tired' || emotion === 'bored'
    const timeoutMs = tired ? 2_800 : strongLocal ? 3_600 : 4_200
    const earlyLocalMs = tired ? 550 : strongLocal ? 900 : 2_400

    const puterP = requestPuterChat(messages, ctx, {
      fast: true,
      live: true,
      timeoutMs,
    })

    const puterWin = puterP
      .then((t): RaceWin | null => (t && t.trim().length > 40 ? { kind: 'puter', text: t.trim() } : null))
      .catch(() => null)

    const earlyLocal = sleep(earlyLocalMs).then((): RaceWin | null =>
      strongLocal || tired ? { kind: 'local', text: local } : null,
    )

    const first = await Promise.race([puterWin, earlyLocal])
    if (first?.kind === 'puter') return first.text
    if (first?.kind === 'local') {
      // Ещё чуть ждём Puter — если почти готов, берём более умный ответ.
      const late = await Promise.race([puterWin, sleep(700).then(() => null)])
      if (late?.kind === 'puter') return late.text
      return first.text
    }

    const latePuter = await puterWin
    if (latePuter?.kind === 'puter') return latePuter.text
    return local
  }

  alternativeExplanation(query: string, topic: string): string {
    const reframed =
      this.cfg.lang === 'en'
        ? `Let me explain it differently, simpler. ${query}`
        : this.cfg.lang === 'uz'
          ? `Boshqacha, soddaroq tushuntiraman. ${query}`
          : `Объясню по-другому, проще и короче. ${query}`
    const reply = composeExpertLocalReply(reframed, this.buildContext(topic, 'confused'))
    if (reply && reply.trim()) return reply.trim()
    return this.fallback(query)
  }

  clarify(): string {
    return clarifyPrompt(this.cfg.lang)
  }

  private fallback(query: string): string {
    if (this.cfg.lang === 'en') {
      return `Good question about “${query}”. Tell me what you already know — I will build on it, step by step.`
    }
    if (this.cfg.lang === 'uz') {
      return `“${query}” haqida yaxshi savol. Nimani bilasiz, ayting — men bosqichma-bosqich davom ettiraman.`
    }
    return `Хороший вопрос про «${query}». Скажи, что уже понимаешь — а я продолжу по шагам, как в живом разговоре.`
  }
}
