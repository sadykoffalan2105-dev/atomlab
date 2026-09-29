import type * as THREE from 'three'
import type { SceneLocale } from '../kit/sceneKit'
import type { DomLabelSource } from '../../react/CinemaDomLabels'

/**
 * Общий интерфейс сцен, которые крутит R3F-адаптер SchoolCinemaScene: «образование молекулы»
 * (SchoolReactionScene) и «обмен в растворе» (solution/SolutionExchangeScene). Адаптер знает только его.
 */

export type SchoolRuntimeStatus = 'idle' | 'playing' | 'paused' | 'finishing' | 'done'

export type SchoolRuntimeLights = { ambient: THREE.AmbientLight; key: THREE.DirectionalLight; point: THREE.PointLight }

export type SchoolRuntimeOptions = {
  locale?: SceneLocale
  lowPower?: boolean
  lights?: SchoolRuntimeLights
  onStatus?: (status: SchoolRuntimeStatus, step: number) => void
  /** события сюжета; лаборатории нужны 'embryo' → 'birth' → 'complete' */
  onCue?: (id: string) => void
}

export interface SchoolRuntimeScene {
  readonly root: THREE.Group
  readonly background: THREE.Color
  readonly labels: DomLabelSource[]
  readonly model: { readonly timing: { stepIndexAt: (t: number) => number } }
  readonly stepCount: number
  readonly time: number
  goToStep(index: number, opts?: { instant?: boolean }): Promise<void>
  replay(): Promise<void>
  finish(): Promise<void>
  seek(t: number): void
  setLocale(locale: SceneLocale): void
  extentAt(t: number, out: { w: number; h: number; cx: number; cy: number }): { w: number; h: number; cx: number; cy: number }
  setHostBackground(color: THREE.Color | null): void
  setViewport(heightPx: number, fovDeg: number, pixelRatio?: number): void
  warmup(renderer: THREE.WebGLRenderer, camera: THREE.Camera, targetScene?: THREE.Scene): Promise<void>
  update(dt: number, camera: THREE.Camera): void
  dispose(): void
}

/** Фабрика сцены для адаптера (стабильная ссылка — иначе сцена пересоздаётся). */
export type SchoolSceneFactory = (opts: SchoolRuntimeOptions) => SchoolRuntimeScene
