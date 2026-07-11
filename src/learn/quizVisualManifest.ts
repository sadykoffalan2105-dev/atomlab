import { G7_C1_S01_SECTION_ENRICHMENTS } from './g7C1S01SectionQuizEnrichments'
import { G7_QUIZ_VISUAL_CATALOG } from './g7QuizVisualCatalog'
import bankEnrichments from '../data/g7SectionQuizEnrichments.json'

/** Фотореалистичные иллюстрации к вопросам (public/learn/quiz-visuals). */
export type QuizVisualSpec = {
  /** Путь от public, напр. /learn/quiz-visuals/c1-t03.png */
  src: string
  caption: string
  alt: string
}

type EnrichmentLike = {
  caption: string
  alt: string
  visualId?: string
}

function specsFromEnrichments(map: Record<string, EnrichmentLike>): Record<string, QuizVisualSpec> {
  return Object.fromEntries(
    Object.entries(map).map(([id, e]) => [
      e.visualId ?? id,
      {
        src: `/learn/quiz-visuals/${e.visualId ?? id}.png`,
        caption: e.caption,
        alt: e.alt,
      },
    ]),
  )
}

const SECTION_QUIZ_MANIFEST: Record<string, QuizVisualSpec> = {
  ...specsFromEnrichments(bankEnrichments as Record<string, EnrichmentLike>),
  ...specsFromEnrichments(G7_C1_S01_SECTION_ENRICHMENTS),
}

export const QUIZ_VISUAL_MANIFEST: Record<string, QuizVisualSpec> = {
  ...Object.fromEntries(
    Object.entries(G7_QUIZ_VISUAL_CATALOG).map(([id, entry]) => [
      id,
      {
        src: `/learn/quiz-visuals/${id}.png`,
        caption: entry.caption,
        alt: entry.alt,
      },
    ]),
  ),
  ...SECTION_QUIZ_MANIFEST,
}

export function getQuizVisualSpec(visualId?: string): QuizVisualSpec | null {
  if (!visualId) return null
  const direct = QUIZ_VISUAL_MANIFEST[visualId]
  if (direct) return direct

  const sectionPoster = visualId.match(/^g7-c(\d+)-s(\d+)$/i)
  if (sectionPoster) {
    const [, ch, sec] = sectionPoster
    return {
      src: `/learn/posters/topic_g7_c${ch}_s${sec}.png`,
      caption: 'Иллюстрация по теме учебника',
      alt: `Тема g7 c${ch} s${sec}`,
    }
  }

  // Per-question id even before catalog rebuild
  if (/^g7-c\d+-s\d+-q\d+$/i.test(visualId)) {
    return {
      src: `/learn/quiz-visuals/${visualId}.png`,
      caption: 'Иллюстрация к вопросу',
      alt: `Вопрос ${visualId}`,
    }
  }

  return null
}

export function hasQuizVisualAsset(visualId?: string): boolean {
  return !!visualId && !!getQuizVisualSpec(visualId)
}
