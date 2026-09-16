import { useSyncExternalStore } from 'react'

/**
 * Флаг «идёт урок-кино» (научный микромир ClO₂, NaCl…).
 * Пока он поднят, любые Bohr-модели атомов (декоративный атом свободной сцены, превью реагентов,
 * частицы) не рисуются: у урока свои атомы, а чужой атом посреди кадра ученику только мешает.
 */
let active = false
const listeners = new Set<() => void>()

export function setCinemaActive(next: boolean): void {
  if (active === next) return
  active = next
  for (const l of listeners) l()
}

function subscribe(l: () => void): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}

const get = () => active

export function useCinemaActive(): boolean {
  return useSyncExternalStore(subscribe, get, get)
}
