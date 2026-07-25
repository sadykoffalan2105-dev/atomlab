import { gsap } from 'gsap'
import { storyDuration, type StorySegment } from './storyTime'

/**
 * ATOMLAB Cinema — story clock.
 *
 * Разделяем «время сюжета» (story time, в котором написана раскадровка)
 * и «время экрана» (wall clock). Один сегмент = сколько реальных секунд
 * мы тратим на кусок сюжета. Отсюда бесплатно получается slow-motion:
 * сегмент со story-длиной 1.5 с, растянутый на 2.6 с экрана, замедляет
 * всю сцену целиком — включая шейдеры и частицы, потому что они читают story time.
 *
 * Крутит время GSAP (одна timeline на прогон), а не setState — React не
 * ререндерится на каждом кадре.
 */

export type StoryClock = {
  /** текущее story time, сек */
  t: number
  /** 0..1 — прогресс всей сцены */
  progress: number
  /** реальная скорость сюжета (story сек / экранная сек); < 1 = slow-motion */
  rate: number
  /** true после последнего кадра раскадровки */
  finished: boolean
}

export type StoryClockHandle = {
  state: StoryClock
  timeline: gsap.core.Timeline
  kill: () => void
}

export function createStoryClock(segments: readonly StorySegment[]): StoryClockHandle {
  const total = storyDuration(segments)
  const state: StoryClock = { t: 0, progress: 0, rate: 1, finished: false }

  let prevT = 0
  let prevWall = 0

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    onUpdate: () => {
      state.progress = total > 0 ? state.t / total : 0
      const wall = tl.time()
      const dw = wall - prevWall
      if (dw > 1e-4) {
        state.rate = (state.t - prevT) / dw
        prevT = state.t
        prevWall = wall
      }
    },
    onComplete: () => {
      state.finished = true
    },
  })

  for (const seg of segments) {
    tl.to(state, { t: seg.to, duration: seg.wall, ease: seg.ease ?? 'none' })
  }

  return {
    state,
    timeline: tl,
    kill: () => {
      tl.kill()
    },
  }
}
