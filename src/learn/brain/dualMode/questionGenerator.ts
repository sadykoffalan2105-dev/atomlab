/**
 * Генератор вопросов из химической базы + сократовские наводящие вопросы.
 *
 * Источник вопросов — реальный устный пул экзамена (getOralExamPool), поэтому у
 * каждого вопроса есть рубрика для оценки. generateNextQuestion учитывает
 * «проблемные зоны» ученика (заваленные вопросы) и адаптивную сложность.
 * socraticFollowUp НИКОГДА не раскрывает ответ — только сужает/перефразирует.
 */
import type { AppLocale } from '../../../i18n/types'
import { getOralExamPool } from '../../g7ExamPools'
import { localizeOralExam } from '../../topicQuizLocale'
import type { OralExamItem } from '../../topicQuizTypes'
import type { AssistantLang, QuestionCard } from './dualModeTypes'

function itemToCard(item: OralExamItem, topic: string, difficulty: number): QuestionCard {
  return {
    id: item.id,
    topic,
    speak: item.questionSpeak,
    display: item.questionDisplay ?? item.questionSpeak,
    rubric: [...item.rubric],
    sampleAnswer: item.sampleAnswer,
    difficulty,
  }
}

export interface QuestionGeneratorConfig {
  gradeId: string
  chapterId: string
  lang: AssistantLang
}

export class QuestionGenerator {
  private readonly pool: OralExamItem[]
  private readonly lang: AssistantLang

  constructor(config: QuestionGeneratorConfig) {
    this.lang = config.lang
    const raw = getOralExamPool(config.gradeId, config.chapterId)
    this.pool = raw.map((item) => localizeOralExam(item, this.lang as AppLocale))
  }

  hasQuestions(): boolean {
    return this.pool.length > 0
  }

  byId(id: string): OralExamItem | undefined {
    return this.pool.find((q) => q.id === id)
  }

  /**
   * Следующий вопрос по теме с учётом проблемных зон.
   * @param askedIds уже заданные (чтобы не повторяться зря)
   * @param previousMistakeIds заваленные вопросы — иногда возвращаемся к ним
   */
  generateNextQuestion(
    topic: string,
    previousMistakeIds: string[],
    difficulty: number,
    askedIds: string[] = [],
  ): QuestionCard | null {
    if (this.pool.length === 0) return null

    // 30% — вернуться к проблемной зоне и переспросить (закрепление).
    const mistakes = this.pool.filter((q) => previousMistakeIds.includes(q.id))
    if (mistakes.length > 0 && Math.random() < 0.3) {
      const pick = mistakes[Math.floor(Math.random() * mistakes.length)]!
      return itemToCard(pick, topic, difficulty)
    }

    const fresh = this.pool.filter((q) => !askedIds.includes(q.id))
    const source = fresh.length > 0 ? fresh : this.pool
    const pick = source[Math.floor(Math.random() * source.length)]!
    return itemToCard(pick, topic, difficulty)
  }

  /**
   * Сократовский наводящий вопрос. Не даёт ответа — сужает фокус и подталкивает
   * ученика к самостоятельному рассуждению. attempt растёт с каждой ошибкой.
   */
  socraticFollowUp(card: QuestionCard, attempt: number): string {
    const pools = SOCRATIC[this.lang]
    const tier = attempt <= 1 ? pools.narrow : attempt === 2 ? pools.reframe : pools.decompose
    const base = tier[Math.floor(Math.random() * tier.length)]!
    // Указываем на аспект темы, НЕ называя ответ.
    return base.replace('{topic}', card.topic)
  }
}

type SocraticBank = { narrow: string[]; reframe: string[]; decompose: string[] }

const SOCRATIC: Record<AssistantLang, SocraticBank> = {
  ru: {
    narrow: [
      'Давай сузим. С чего начинается этот процесс?',
      'Какое ключевое понятие здесь главное — назови его своими словами.',
      'Подумай: что здесь причина, а что следствие?',
    ],
    reframe: [
      'Переформулирую. Представь это на простом бытовом примере — что напоминает?',
      'Зайдём с другой стороны: что изменится, если убрать один из участников?',
      'А если сравнить с тем, что мы уже разбирали, — в чём сходство?',
    ],
    decompose: [
      'Разобьём на шаги. Какой самый первый шаг ты бы сделал?',
      'Не спеши. Назови хотя бы одно слово, которое точно связано с ответом.',
      'Что мы вообще знаем про «{topic}»? Начни с определения.',
    ],
  },
  en: {
    narrow: [
      'Let us narrow it down. Where does this process begin?',
      'What is the key concept here — say it in your own words.',
      'Think: what is the cause and what is the effect?',
    ],
    reframe: [
      'Let me rephrase. Imagine an everyday example — what does it remind you of?',
      'From another angle: what changes if we remove one participant?',
      'Compared to what we studied before — what is similar?',
    ],
    decompose: [
      'Break it into steps. What is the very first step you would take?',
      'Take your time. Name at least one word surely linked to the answer.',
      'What do we know about “{topic}” at all? Start with a definition.',
    ],
  },
  uz: {
    narrow: [
      'Keling, toraytiramiz. Bu jarayon nimadan boshlanadi?',
      'Bu yerdagi asosiy tushuncha nima — o‘z so‘zingiz bilan ayting.',
      'O‘ylab ko‘ring: bu yerda sabab nima, oqibat nima?',
    ],
    reframe: [
      'Boshqacha aytaman. Oddiy hayotiy misolni tasavvur qiling — nimani eslatadi?',
      'Boshqa tomondan: ishtirokchilardan birini olib tashlasak, nima o‘zgaradi?',
      'Avval o‘rgangandan farqi — o‘xshashligi nimada?',
    ],
    decompose: [
      'Bosqichlarga ajratamiz. Eng birinchi qadam nima bo‘lardi?',
      'Shoshilmang. Javobga bog‘liq bitta so‘zni ayting.',
      '“{topic}” haqida umuman nimani bilamiz? Ta’rifdan boshlang.',
    ],
  },
}
