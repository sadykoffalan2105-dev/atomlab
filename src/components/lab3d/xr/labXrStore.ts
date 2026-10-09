import { useSyncExternalStore } from 'react'
export type LabXrStand = 'desk' | 'hood' | 'board' | 'shelves'
export interface LabXrState { readonly supported: boolean; readonly presenting: boolean; readonly emulated: boolean; readonly stand: LabXrStand }
let state: LabXrState = { supported: false, presenting: false, emulated: false, stand: 'desk' }
const subs = new Set<() => void>()
export const labXr = {
  get: (): LabXrState => state,
  set(patch: Partial<LabXrState>): void { state = { ...state, ...patch }; subs.forEach((f) => f()) },
  subscribe(fn: () => void): () => void { subs.add(fn); return () => subs.delete(fn) },
}
export const useXrPresenting = (): boolean => useSyncExternalStore(labXr.subscribe, () => state.presenting, () => false)
export const useXrState = (): LabXrState => useSyncExternalStore(labXr.subscribe, labXr.get, labXr.get)
