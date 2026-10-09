import { useSyncExternalStore } from 'react'

/**
 * Переключатель «Электронные облака» (по умолчанию ВКЛ): кнопка — на доске (FormationPanel), облака — в 3D
 * (FormationCanvas → FormationClouds). Выбор пользователя запоминается в localStorage (если доступен).
 */
const KEY = 'atomlab.formation.clouds'

function readSaved(): boolean {
  try {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null
    return v === null ? true : v !== '0'
  } catch {
    return true
  }
}

let on = readSaved()
const subs = new Set<() => void>()

export function setCloudsOn(v: boolean): void {
  if (on === v) return
  on = v
  try {
    localStorage.setItem(KEY, v ? '1' : '0')
  } catch {
    /* приватный режим / запрет хранилища — только в памяти */
  }
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
    () => true,
  )
}
