import { useSyncExternalStore } from 'react'
export type LabXrStand = 'desk' | 'hood' | 'board' | 'shelves'
export interface LabXrState { readonly supported: boolean; readonly presenting: boolean; readonly emulated: boolean; readonly stand: LabXrStand
  /** Текущий опыт и шаг — публикует ExperimentRig; читают VR-доска и наручный HUD (только файлы B). */
  readonly run?: { readonly experimentId: string; readonly step: number; readonly lang?: 'ru' | 'en' | 'uz'; readonly quality?: 'low' | 'high' }
  /** Упрощённые декорации в VR на мобильном шлеме (rigs/measure: LatheGeometry 16 сегментов вместо 32). */
  readonly lowDetail?: boolean
}
let state: LabXrState = { supported: false, presenting: false, emulated: false, stand: 'desk' }
const subs = new Set<() => void>()
export const labXr = {
  get: (): LabXrState => state,
  set(patch: Partial<LabXrState>): void { state = { ...state, ...patch }; subs.forEach((f) => f()) },
  subscribe(fn: () => void): () => void { subs.add(fn); return () => subs.delete(fn) },
}
export const useXrPresenting = (): boolean => useSyncExternalStore(labXr.subscribe, () => state.presenting, () => false)
export const useXrState = (): LabXrState => useSyncExternalStore(labXr.subscribe, labXr.get, labXr.get)
