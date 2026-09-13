import { gsap } from 'gsap'
import type { StoryClock } from './storyClock'
import { storyDuration, type StorySegment } from './storyTime'

/**
 * Story clock с остановками — для урока «по шагам».
 *
 * Та же идея, что у createStoryClock (story time крутит одна GSAP-таймлайн),
 * но таймлайн стоит на паузе, а играет отрезками: до конца шага, с перемоткой
 * на начало шага для повтора или до самого конца при автопроигрывании.
 * Останавливаться можно только на границах сегментов — там story time известно
 * точно, без обратного пересчёта через кривые ease.
 */

export type SteppedStoryClock = {
  state: StoryClock
  /** Экранное время (сек), на котором сюжет доходит до границы storyT. */
  wallAt: (storyT: number) => number
  /** Играть от текущего места до границы storyT; onReached — когда дошли. */
  playTo: (storyT: number, onReached?: () => void) => void
  /** Мгновенно встать на границу storyT (без анимации). */
  seekTo: (storyT: number) => void
  pause: () => void
  kill: () => void
}

export function createSteppedStoryClock(segments: readonly StorySegment[]): SteppedStoryClock {
  const total = storyDuration(segments)
  const state: StoryClock = { t: 0, progress: 0, rate: 1, finished: false }

  const bounds: Array<{ story: number; wall: number }> = [{ story: 0, wall: 0 }]
  let acc = 0
  for (const seg of segments) {
    acc += seg.wall
    bounds.push({ story: seg.to, wall: acc })
  }

  let prevT = 0
  let prevWall = 0

  const tl = gsap.timeline({
    paused: true,
    defaults: { ease: 'none' },
    onUpdate: () => {
      state.progress = total > 0 ? state.t / total : 0
      const wall = tl.time()
      const dw = wall - prevWall
      if (Math.abs(dw) > 1e-4) {
        state.rate = (state.t - prevT) / dw
        prevT = state.t
        prevWall = wall
      }
      state.finished = state.t >= total - 1e-6
    },
  })

  for (const seg of segments) {
    tl.to(state, { t: seg.to, duration: seg.wall, ease: seg.ease ?? 'none' })
  }

  let active: gsap.core.Tween | null = null

  const wallAt = (storyT: number): number => {
    let best = bounds[0]!
    for (const b of bounds) {
      if (Math.abs(b.story - storyT) < Math.abs(best.story - storyT)) best = b
    }
    return best.wall
  }

  return {
    state,
    wallAt,
    playTo(storyT, onReached) {
      active?.kill()
      const target = wallAt(storyT)
      if (Math.abs(tl.time() - target) < 1e-4) {
        onReached?.()
        return
      }
      active = tl.tweenTo(target, {
        onComplete: () => {
          active = null
          onReached?.()
        },
      })
    },
    seekTo(storyT) {
      active?.kill()
      active = null
      const target = wallAt(storyT)
      tl.seek(target, false)
      prevT = state.t
      prevWall = target
    },
    pause() {
      active?.kill()
      active = null
    },
    kill() {
      active?.kill()
      active = null
      tl.kill()
    },
  }
}
