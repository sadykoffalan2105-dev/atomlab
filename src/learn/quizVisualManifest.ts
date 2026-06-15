import { G7_QUIZ_VISUAL_CATALOG } from './g7QuizVisualCatalog'

/** Фотореалистичные иллюстрации к вопросам (public/learn/quiz-visuals). */
export type QuizVisualSpec = {
  /** Путь от public, напр. /learn/quiz-visuals/c1-t03.png */
  src: string
  caption: string
  alt: string
}

export const QUIZ_VISUAL_MANIFEST: Record<string, QuizVisualSpec> = Object.fromEntries(
  Object.entries(G7_QUIZ_VISUAL_CATALOG).map(([id, entry]) => [
    id,
    {
      src: `/learn/quiz-visuals/${id}.png`,
      caption: entry.caption,
      alt: entry.alt,
    },
  ]),
)

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

  return null
}

export function hasQuizVisualAsset(visualId?: string): boolean {
  return !!visualId && !!getQuizVisualSpec(visualId)
}
