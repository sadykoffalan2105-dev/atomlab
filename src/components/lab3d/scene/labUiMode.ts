import { useSyncExternalStore } from 'react'
export type LabUiMode = 'normal' | 'board'
export interface LabUiModeState { readonly mode: LabUiMode; /** 1 — обычный, 1.6 — электронная доска */ readonly scale: number }
let state: LabUiModeState = { mode: 'normal', scale: 1 }
const subs = new Set<() => void>()
export const labUiMode = {
  get: (): LabUiModeState => state,
  set(mode: LabUiMode): void { state = { mode, scale: mode === 'board' ? 1.6 : 1 }; subs.forEach((f) => f()) },
  subscribe(fn: () => void): () => void { subs.add(fn); return () => subs.delete(fn) },
}
export const useLabUiMode = (): LabUiModeState => useSyncExternalStore(labUiMode.subscribe, labUiMode.get, labUiMode.get)
