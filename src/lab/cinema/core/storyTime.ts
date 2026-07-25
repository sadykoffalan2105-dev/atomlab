/**
 * ATOMLAB Cinema — описание времени сюжета.
 *
 * Здесь только данные и чистая арифметика, без GSAP и без DOM: раскадровку и
 * её хронометраж должны уметь читать и watchdog лаборатории, и тесты в Node,
 * не поднимая ни одного тикера анимации.
 *
 * Story time — время, в котором написан сценарий реакции. Wall time — сколько
 * реальных секунд занимает кусок сюжета на экране. Отношение этих двух величин
 * и даёт slow-motion: см. createStoryClock в storyClock.ts.
 */

export type StorySegment = {
  /** до какого story time доводим */
  to: number
  /** сколько это занимает реальных секунд */
  wall: number
  /** gsap ease для отображения wall → story */
  ease?: string
}

/** Длина сюжета в story time. */
export function storyDuration(segments: readonly StorySegment[]): number {
  return segments.length > 0 ? segments[segments.length - 1]!.to : 0
}

/** Суммарная длительность на экране — для watchdog'ов и таймаутов. */
export function storyWallDuration(segments: readonly StorySegment[]): number {
  let sum = 0
  for (const s of segments) sum += s.wall
  return sum
}
