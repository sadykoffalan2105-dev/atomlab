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
      slideBody:
        this.cfg.lang === 'en'
          ? 'LIVE VOICE DIALOGUE: answer in 100–220 words. First sentence = direct answer. Then short why + one example. Speakable sentences, no formulas.'
          : this.cfg.lang === 'uz'
            ? 'JONLI OVOZLI DIALOG: 100–220 so‘z. Birinchi gap — to‘g‘ridan-to‘g‘ri javob. Keyin qisqa sabab + bitta misol. Formulalarsiz.'
            : 'ОНЛАЙН ГОЛОСОВОЙ ДИАЛОГ: ответ 100–220 слов. Первое предложение — прямой ответ. Затем кратко почему и один пример. Короткие фразы для озвучки, без формул.',
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
   * Умное объяснение для live:
   * 1) мгновенно готовим офлайн-ответ из базы;
   * 2) параллельно быстро спрашиваем Puter (короткий таймаут, если local уже сильный);
   * 3) если облако не успело — сразу говорим по базе (без долгого молчания).
   */
  async explainAsync(
    query: string,
    topic: string,
    history: { role: string; content: string }[] = [],
  ): Promise<string> {
    const ctx = this.buildContext(topic)
    const messages = [
      ...history.slice(-6),
      { role: 'user', content: query },
    ]
    const local = this.explain(query, topic, history)
    const strongLocal =
      local.length >= 140 &&
      !/Давай разберём по шагам|Let us reason|bosqichma-bosqich fikrlaymiz/i.test(local)

    const timeoutMs = strongLocal ? 4_500 : 7_500
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
