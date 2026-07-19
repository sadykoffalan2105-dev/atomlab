/**
 * Движок режима «Обучение». Профессор-наставник: полные объяснения из
 * химической базы (composeExpertLocalReply — определения, примеры, аналогии,
 * исторические факты), проактивный вопрос «понятно?» при замешательстве.
 */
import { composeExpertLocalReply } from '../../learnExpertLocalReply'
import type { LearnLocalAssistantContext } from '../../learnLocalAssistant'
import { requestPuterChat } from '../../learnPuterChat'
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

  private buildContext(topic: string): LearnLocalAssistantContext {
    return {
      locale: this.cfg.lang,
      gradeId: this.cfg.gradeId,
      chapterId: this.cfg.chapterId,
      sectionId: this.cfg.sectionId ?? 's01',
      sectionTitle: this.cfg.sectionTitle ?? topic,
      slideTitle: topic,
      slideBody: '',
      mode: 'teacher',
      kpNumber: 1,
    }
  }

  /** Полное экспертное объяснение вопроса ученика (офлайн-база). */
  explain(query: string, topic: string, history: { role: string; content: string }[] = []): string {
    const reply = composeExpertLocalReply(query, this.buildContext(topic), history)
    if (reply && reply.trim()) return reply.trim()
    return this.fallback(query)
  }

  /**
   * Умное объяснение для live: быстрый Puter (9 с, одна модель) параллельно
   * с мгновенной офлайн-базой. Если облако не успело — сразу качественный local.
   */
  async explainAsync(
    query: string,
    topic: string,
    history: { role: string; content: string }[] = [],
  ): Promise<string> {
    const ctx = this.buildContext(topic)
    const messages = [...history, { role: 'user', content: query }]
    const local = this.explain(query, topic, history)
    try {
      const smart = await requestPuterChat(messages, ctx, { fast: true, timeoutMs: 9_000 })
      if (smart && smart.trim()) return smart.trim()
    } catch {
      /* фолбэк на офлайн-базу */
    }
    return local
  }

  /** Переобъяснение «с другой стороны», когда ученик не понял. */
  alternativeExplanation(query: string, topic: string): string {
    const reframed =
      this.cfg.lang === 'en'
        ? `Let me explain it differently. ${query}`
        : this.cfg.lang === 'uz'
          ? `Boshqacha tushuntiraman. ${query}`
          : `Объясню по-другому, проще. ${query}`
    const reply = composeExpertLocalReply(reframed, this.buildContext(topic))
    if (reply && reply.trim()) return reply.trim()
    return this.fallback(query)
  }

  clarify(): string {
    return clarifyPrompt(this.cfg.lang)
  }

  private fallback(query: string): string {
    if (this.cfg.lang === 'en') {
      return `Good question about “${query}”. Let us reason it out step by step — tell me what you already know, and I will build on it.`
    }
    if (this.cfg.lang === 'uz') {
      return `“${query}” haqida yaxshi savol. Keling, bosqichma-bosqich fikrlaymiz — nimani bilasiz, ayting, men davom ettiraman.`
    }
    return `Хороший вопрос про «${query}». Давай разберём по шагам — скажи, что ты уже знаешь, и я продолжу.`
  }
}
