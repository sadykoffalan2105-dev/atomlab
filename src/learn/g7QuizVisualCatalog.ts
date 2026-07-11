import { G7_C1_S01_QUIZ_ENRICHMENTS } from './g7C1S01QuizEnrichments'
import {
  G7_C1_S01_SECTION_ENRICHMENTS,
  type SectionQuizEnrichment,
} from './g7C1S01SectionQuizEnrichments'
import { G7_CHAPTER_TEMPLATES } from './g7TopicQuizTemplates'
import bankEnrichments from '../data/g7SectionQuizEnrichments.json'

const PHOTO_STYLE =
  'Photorealistic educational photograph for Russian school chemistry textbook Kimyo grade 7, 16:9 landscape, bright modern laboratory or classroom demonstration, sharp focus, natural soft lighting, no text overlay, no watermark, no human faces, scientifically accurate props'

export type G7QuizVisualEntry = {
  caption: string
  alt: string
  prompt: string
  description: string
  explanation: string
}

function topicFromQuestion(question: string): string {
  return question.replace(/…$/, '').replace(/\s+/g, ' ').trim()
}

function buildPrompt(chapter: number, question: string, correct: string): string {
  const topic = topicFromQuestion(question)
  return `${PHOTO_STYLE}. Topic: ${topic}. Visualize the correct answer: ${correct}. Chapter ${chapter} of middle school chemistry course.`
}

function buildDescription(question: string, correct: string, explanation?: string): string {
  const topic = topicFromQuestion(question)
  const lead = `Вопрос по теме «${topic}». Правильный ответ: **${correct}**.`
  const body = explanation
    ? `${explanation}\n\nЭто соответствует учебнику Kimyo, 7 класс.`
    : `Запомните: ${correct}. Материал соответствует учебнику Kimyo, 7 класс.`
  return `${lead}\n\n${body}`
}

function buildEntry(
  chapter: number,
  question: string,
  correct: string,
  explanation?: string,
): G7QuizVisualEntry {
  const topic = topicFromQuestion(question)
  return {
    caption: `${topic} — ${correct}`,
    alt: `Иллюстрация к вопросу: ${topic}`,
    prompt: buildPrompt(chapter, question, correct),
    description: buildDescription(question, correct, explanation),
    explanation: explanation ?? correct,
  }
}

function fromSectionEnrichment(e: SectionQuizEnrichment): G7QuizVisualEntry {
  return {
    caption: e.caption,
    alt: e.alt,
    prompt: e.imagePrompt,
    description: e.description,
    explanation: e.explanation,
  }
}

function buildCatalog(): Record<string, G7QuizVisualEntry> {
  const out: Record<string, G7QuizVisualEntry> = {}

  for (const [chStr, templates] of Object.entries(G7_CHAPTER_TEMPLATES)) {
    const chapter = Number(chStr)
    for (const t of templates) {
      const c1 = G7_C1_S01_QUIZ_ENRICHMENTS[t.templateKey]
      if (c1) {
        out[t.templateKey] = {
          caption: topicFromQuestion(t.question) + ' — ' + t.choices[t.correctIndex],
          alt: `Иллюстрация: ${topicFromQuestion(t.question)}`,
          prompt: buildPrompt(chapter, t.question, t.choices[t.correctIndex]!),
          description: c1.description,
          explanation: c1.explanation,
        }
      } else {
        out[t.templateKey] = buildEntry(
          chapter,
          t.question,
          t.choices[t.correctIndex]!,
          t.explanation,
        )
      }
    }
  }

  for (const [id, e] of Object.entries(bankEnrichments as Record<string, SectionQuizEnrichment>)) {
    out[id] = fromSectionEnrichment(e)
  }

  for (const [id, e] of Object.entries(G7_C1_S01_SECTION_ENRICHMENTS)) {
    out[id] = fromSectionEnrichment(e)
  }

  return out
}

/** Каталог иллюстраций: шаблоны глав + per-question enrichments. */
export const G7_QUIZ_VISUAL_CATALOG: Record<string, G7QuizVisualEntry> = buildCatalog()

export function getG7QuizVisualEntry(templateKey: string): G7QuizVisualEntry | null {
  return G7_QUIZ_VISUAL_CATALOG[templateKey] ?? null
}

export function allG7QuizVisualIds(): string[] {
  return Object.keys(G7_QUIZ_VISUAL_CATALOG)
}
