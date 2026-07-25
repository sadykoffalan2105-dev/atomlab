/**
 * ATOMLAB Cinema — одноразовые события раскадровки.
 *
 * Cue выстреливает ровно один раз за прогон, когда story time проходит метку:
 * искра зажигания, разрыв связи, щелчок ионной пары, конец сцены.
 * Логика «уже стреляло» живёт здесь, а не в двадцати рефах внутри сцены.
 */

export type Cue<Id extends string = string> = {
  at: number
  id: Id
}

export type CueRunner<Id extends string = string> = {
  update: (t: number, fire: (id: Id) => void) => void
  reset: () => void
}

export function createCueRunner<Id extends string>(cues: readonly Cue<Id>[]): CueRunner<Id> {
  const sorted = [...cues].sort((a, b) => a.at - b.at)
  let next = 0

  return {
    update(t, fire) {
      while (next < sorted.length && t >= sorted[next]!.at) {
        fire(sorted[next]!.id)
        next += 1
      }
    },
    reset() {
      next = 0
    },
  }
}

/**
 * Импульс, затухающий после метки: 1 в момент cue, 0 через `decay` секунд.
 * Тем же значением можно гнать и вспышку света, и радиус ударной волны.
 */
export function pulseAt(t: number, at: number, decay: number, attack = 0.06): number {
  if (t < at) return 0
  const dt = t - at
  if (dt < attack) return dt / attack
  const k = 1 - (dt - attack) / decay
  return k > 0 ? k * k : 0
}
