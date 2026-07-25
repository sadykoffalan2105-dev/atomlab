import * as THREE from 'three'

/**
 * ATOMLAB Cinema — мутируемые состояния сцены.
 *
 * Сцена гонит анимацию через эти объекты: сэмплирует раскадровку в useFrame,
 * пишет результат сюда, а визуальные компоненты только читают. Ни один кадр
 * не проходит через React — ререндеров во время реакции нет вообще.
 *
 * Фабрики живут отдельно от компонентов сознательно: так файлы компонентов
 * экспортируют только компоненты (fast refresh), а типы состояний может
 * использовать и чистая логика без импорта React.
 */

/** Химическая связь между двумя атомами. */
export type BondState = {
  from: THREE.Vector3
  to: THREE.Vector3
  /** 0..1 — натяжение: цвет уходит в белый, поток ускоряется, оболочка трещит */
  stress: number
  /** 0..1 — общая видимость */
  opacity: number
  /** 0..1 — волна образования (0 = только возникла, 1 = установилась) */
  form: number
  /** 0..1 — истончение перед разрывом */
  thinning: number
}

export function createBondState(): BondState {
  return {
    from: new THREE.Vector3(),
    to: new THREE.Vector3(),
    stress: 0,
    opacity: 1,
    form: 1,
    thinning: 0,
  }
}

/** Облако газа или туман. */
export type PuffVolumeState = {
  center: THREE.Vector3
  /** 0..1 — плотность */
  opacity: number
  /** радиус облака, мировые единицы */
  spread: number
  /** подъём клубов вверх (газ) или оседание вниз (осадок) */
  rise: number
  /** амплитуда завихрений */
  turbulence: number
  color: THREE.Color
}

export function createPuffVolumeState(color: number, spread = 1): PuffVolumeState {
  return {
    center: new THREE.Vector3(),
    opacity: 0,
    spread,
    rise: 0,
    turbulence: 0.12,
    color: new THREE.Color(color),
  }
}

/** Расходящаяся световая волна. */
export type WaveState = {
  center: THREE.Vector3
  /** 0..1 — фаза волны (0 = родилась, 1 = растворилась) */
  amount: number
  radius: number
  color: THREE.Color
}

export function createWaveState(color: number, radius = 1.6): WaveState {
  return { center: new THREE.Vector3(), amount: 0, radius, color: new THREE.Color(color) }
}

/** Ореол вокруг молекулы / точечная вспышка. */
export type GlowState = {
  center: THREE.Vector3
  /** 0..1 — яркость */
  amount: number
}

export function createGlowState(): GlowState {
  return { center: new THREE.Vector3(), amount: 0 }
}

/** Элемент экранной графики (счётчик, метка). */
export type HudState = {
  center: THREE.Vector3
  /** 0..1 — проявленность */
  opacity: number
}

export function createHudState(): HudState {
  return { center: new THREE.Vector3(), opacity: 0 }
}

/** Виртуальная камера: наезд, пан, крен, тряска. */
export type CameraRigState = {
  /** 1 = базовый кадр, >1 = наезд */
  zoom: number
  offset: THREE.Vector3
  roll: number
  yaw: number
  /** 0..1 — тряска на ударе */
  shake: number
}

export function createCameraRigState(): CameraRigState {
  return { zoom: 1, offset: new THREE.Vector3(), roll: 0, yaw: 0, shake: 0 }
}

/** Пост-обработка кадра. */
export type PostDirector = {
  /** 0..1 — сила ореола */
  bloom: number
  /** 0..1 — затемнение краёв */
  vignette: number
}

export function createPostDirector(): PostDirector {
  return { bloom: 0.35, vignette: 0.35 }
}
