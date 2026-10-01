import { useMemo } from 'react'
import { buildReactionStory } from '../../../../chemistry/reactionStory'
import type { ScientificSynthesisFxProps } from '../../../scientificSynthesis/types'
import { SchoolCinemaScene } from '../school/SchoolCinemaScene'
import type { SchoolSceneFactory } from '../school/schoolRuntime'
import { ReactionStoryScene } from './ReactionStoryScene'
import { setCurrentStory } from './storyLesson'

/**
 * Анимация после синтеза для реакций без своей школьной сцены: «сюжет реакции» по уравнению
 * (chemistry/reactionStory) — Исходные → Разрыв → Перенос e⁻ (ОВР) → Образование → Итог.
 * Крутит её общий адаптер SchoolCinemaScene (панель урока, кадрирование, embryo → birth → complete).
 */
export function ReactionStoryFx(props: ScientificSynthesisFxProps & { equation: string }) {
  const { equation, ...fx } = props
  const story = useMemo(() => buildReactionStory(equation), [equation])
  const create = useMemo<SchoolSceneFactory | undefined>(
    () =>
      story
        ? (opts) => {
            // тексты урока — до подключения панели (адаптер зовёт фабрику раньше attach)
            setCurrentStory(story)
            return new ReactionStoryScene(story, opts)
          }
        : undefined,
    [story],
  )
  if (!story || !create) return null
  return <SchoolCinemaScene {...fx} create={create} lesson={story.redox ? 'story' : 'story4'} />
}
