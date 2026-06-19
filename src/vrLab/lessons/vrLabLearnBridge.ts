import { markLessonCompleted } from '../../learn/learnProgressStorage'

/** ID урока в общем прогрессе Learn (не путать с vrLab lesson id). */
export function vrLabLearnLessonId(vrLessonId: string): string {
  return `vr-lab:${vrLessonId}`
}

/** После успешной VR-практики отметить урок в Learn. */
export function syncVrPracticeToLearn(vrLessonId: string): void {
  markLessonCompleted(vrLabLearnLessonId(vrLessonId))
}

export function buildVrLabUrl(lessonId: string, reactionId?: string, fromLearn = false): string {
  const params = new URLSearchParams()
  params.set('lesson', lessonId)
  if (reactionId) params.set('reaction', reactionId)
  if (fromLearn) params.set('from', 'learn')
  return `/#/vr-lab?${params.toString()}`
}
