import type * as THREE from 'three'

/**
 * Передача кадра «сцена урока → герой продукта» без второй решётки в кадре.
 *
 * Сцена урока (например, scenes/nacl) заявляет передачу на свой прогон: герой этого вещества на
 * этом прогоне монтируется сразу в полный размер, без «рождения из круга» и без своего вращения
 * слота, и остаётся НЕВИДИМЫМ (слой без камеры), пока сцена не отпустит его (release) — в кадр,
 * когда её решётка встала ровно на место героя. Герой сообщает, что показан (markShown), и сцена
 * в тот же или следующий кадр выключает свою решётку. Итог: в каждый момент видна ровно одна.
 *
 * Тело героя (группа с решёткой) регистрируется здесь (setBody): его matrixWorld сцена читает
 * каждый кадр хвоста, чтобы встать на место героя с учётом его медленного облёта.
 *
 * Хранилище без React — его читают сцена (в кадре, без подписки) и слот героя (useSyncExternalStore).
 */

export type HeroHandoffSnapshot = {
  /** прогон, для которого заявлена передача; 0 — передачи нет */
  runId: number
  compoundId: string | null
  /** сцена отпустила героя: его можно показывать */
  released: boolean
  /** герой уже в кадре (полный размер, основной слой) */
  shown: boolean
}

const EMPTY: HeroHandoffSnapshot = { runId: 0, compoundId: null, released: false, shown: false }

let snapshot: HeroHandoffSnapshot = EMPTY
let body: THREE.Object3D | null = null
let bodyCompound: string | null = null
const listeners = new Set<() => void>()

function emit(next: HeroHandoffSnapshot): void {
  snapshot = next
  for (const l of listeners) l()
}

export const heroHandoff = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  getSnapshot(): HeroHandoffSnapshot {
    return snapshot
  },

  /** Сцена урока смонтировалась: герой compoundId на прогоне runId ждёт её отпускания. */
  claim(runId: number, compoundId: string): void {
    emit({ runId, compoundId, released: false, shown: false })
  },

  /** Решётка сцены на месте героя — героя можно показывать. */
  release(runId: number): void {
    if (snapshot.runId !== runId || snapshot.released) return
    emit({ ...snapshot, released: true })
  },

  /** Герой отрисован в кадре полным размером. */
  markShown(runId: number): void {
    if (snapshot.runId !== runId || snapshot.shown) return
    emit({ ...snapshot, shown: true })
  },

  /**
   * Сцена размонтирована. Если она не успела отпустить героя (урок прерван), передача снимается —
   * слот ведёт себя как обычно. Отпущенная передача остаётся до следующего прогона.
   */
  abandon(runId: number): void {
    if (snapshot.runId !== runId || snapshot.released) return
    emit(EMPTY)
  },

  /** Передача заявлена на этот прогон и это вещество. */
  isClaimed(runId: number, compoundId: string): boolean {
    return runId > 0 && snapshot.runId === runId && snapshot.compoundId === compoundId
  },

  /** Тело героя (группа, на место которой встаёт решётка сцены). */
  setBody(compoundId: string, obj: THREE.Object3D | null): void {
    if (obj) {
      body = obj
      bodyCompound = compoundId
    } else if (bodyCompound === compoundId) {
      body = null
      bodyCompound = null
    }
  },

  getBody(compoundId: string): THREE.Object3D | null {
    return bodyCompound === compoundId ? body : null
  },
}
