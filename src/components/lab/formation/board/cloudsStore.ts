import { useSyncExternalStore } from 'react'

/**
 * Переключатель «Электронные облака» (по умолчанию выкл): кнопка — на доске (FormationPanel), облака — в 3D
 * (FormationCanvas → FormationClouds). Общее состояние без изменения useFormation.
 */
let on = false
const subs = new Set<() => void>()

export function setCloudsOn(v: boolean): void {
  if (on === v) return
  on = v
  subs.forEach((f) => f())
}

function subscribe(f: () => void): () => void {
  subs.add(f)
  return () => {
    subs.delete(f)
  }
}

export function useCloudsOn(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => on,
    () => false,
  )
}
