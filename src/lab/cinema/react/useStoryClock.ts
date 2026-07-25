import { useEffect, useRef, type RefObject } from 'react'
import { createStoryClock, type StoryClock } from '../core/storyClock'
import type { StorySegment } from '../core/storyTime'
import { createCueRunner, type Cue, type CueRunner } from '../core/cues'

/**
 * Пускает раскадровку: story time крутит GSAP, события выстреливают через CueRunner.
 * Перезапуск строго по runId — каждое «Проверить и запустить синтез» начинает
 * сцену с нуля, включая уже отработавшие события.
 *
 * Возвращаются именно рефы: их значения читает только useFrame, поэтому рендер
 * не зависит от текущего кадра анимации и не перезапускается на каждом тике.
 */
export function useStoryClock<Id extends string>(
  runId: number,
  segments: readonly StorySegment[],
  cues: readonly Cue<Id>[] = [],
): { clock: RefObject<StoryClock>; cues: RefObject<CueRunner<Id>> } {
  const clockRef = useRef<StoryClock>({ t: 0, progress: 0, rate: 1, finished: false })
  const cueRunnerRef = useRef<CueRunner<Id>>(createCueRunner(cues))

  useEffect(() => {
    const handle = createStoryClock(segments)
    clockRef.current = handle.state
    cueRunnerRef.current = createCueRunner(cues)
    return () => {
      handle.kill()
    }
    // Сцена перезапускается только по runId: пересоздавать таймлайн из-за новой
    // ссылки на массив раскадровки нельзя — анимация дёрнется на середине.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId])

  return { clock: clockRef, cues: cueRunnerRef }
}
