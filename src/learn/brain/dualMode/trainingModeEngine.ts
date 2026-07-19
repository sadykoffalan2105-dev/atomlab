/**
 * Движок режима «Обучение». Профессор-наставник: полные объяснения из
 * химической базы + быстрый Puter, с учётом эмоции ученика с камеры.
 */
import { composeExpertLocalReply } from '../../learnExpertLocalReply'
import type { LearnLocalAssistantContext } from '../../learnLocalAssistant'
import { requestPuterChat } from '../../learnPuterChat'
import type { EmotionState } from '../brainTypes'
import { emotionPromptHint } from './cameraEmotionCoach'
import { clarifyPrompt } from './personaProfiles'
import type { AssistantLang } from './dualModeTypes'

export interface TrainingEngineConfig {
  lang: AssistantLang
  gradeId: string
  chapterId: string
  sectionId?: string
  sectionTitle?: string
}

export class TrainingModeEngine {
  private readonly cfg: TrainingEngineConfig

  constructor(config: TrainingEngineConfig) {
    this.cfg = config
  }

  private buildContext(topic: string, emotion: EmotionState = 'neutral'): LearnLocalAssistantContext {
    const cameraHint = emotionPromptHint(this.cfg.lang, emotion)
    const liveBase =
      this.cfg.lang === 'en'
        ? 'LIVE VOICE DIALOGUE: answer like a warm human teacher, 90–200 words. First sentence = direct answer. Natural connectors. No formulas.'
        : this.cfg.lang === 'uz'
          ? 'JONLI OVOZLI DIALOG: iliq o‘qituvchi kabi, 90–200 so‘z. Birinchi gap — to‘g‘ridan-to‘g‘ri javob. Formulalarsiz.'
          : 'ОНЛАЙН ГОЛОСОВОЙ ДИАЛОГ: говори как живой тёплый учитель, 90–200 слов. Первое предложение — прямой ответ. Живые связки («смотрите», «то есть»). Без формул.'
    return {
      locale: this.cfg.lang,
      gradeId: this.cfg.gradeId,
      chapterId: this.cfg.chapterId,
      sectionId: this.cfg.sectionId ?? 's01',
      sectionTitle: this.cfg.sectionTitle ?? topic,
      slideTitle: topic,
      slideBody: `${liveBase}\nCAMERA: ${cameraHint}`,
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
      local.length >= 140 &&
      !/Давай разберём по шагам|Let us reason|bosqichma-bosqich fikrlaymiz/i.test(local)

    // Усталость/скука — быстрее отдаём короткий локальный ответ.
    const timeoutMs =
      emotion === 'tired' || emotion === 'bored' ? 3_500 : strongLocal ? 4_500 : 7_500
    try {
      const smart = await requestPuterChat(messages, ctx, {
        fast: true,
        timeoutMs,
      })
      if (smart && smart.trim().length > 40) return smart.trim()
    } catch {
      /* офлайн */
    }
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
