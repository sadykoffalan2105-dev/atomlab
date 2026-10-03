/**
 * Раскладка комнаты новой лаборатории (м). Ученик стоит у стола и смотрит в −Z, на доску.
 * Координаты рабочего места и доски — из контракта (labContract.ts), здесь — только мебель сцены.
 */
import * as THREE from 'three'
import { BENCH_TOP_Y, BOARD_CENTER, BOARD_SIZE } from '../labContract'

/** Комната: x ∈ [−W/2, W/2], z ∈ [FRONT_Z, BACK_Z], пол y = 0, потолок y = H. */
export const ROOM = { w: 6.6, frontZ: -1.25, backZ: 5.2, h: 3.0 } as const

/** Лабораторный остров (рабочий стол ученика). */
export const BENCH = { w: 2.6, d: 0.95, centerZ: -0.02, topY: BENCH_TOP_Y, topT: 0.04 } as const

/** Вытяжной шкаф у передней стены, слева от доски. */
export const HOOD = { x: -2.05, w: 1.2, d: 0.72, h: 2.3 } as const

/** Столешница с раковиной и полками у передней стены, справа от доски. */
export const COUNTER = { x0: 1.32, x1: ROOM.w / 2, d: 0.62 } as const
export const SINK_X = 2.78

/** Точки камеры (поза: где стоит камера и куда смотрит). */
export type LabViewId = 'desk' | 'board' | 'shelves' | 'hood' | 'cabinets'

export interface CameraPose {
  readonly position: THREE.Vector3
  readonly target: THREE.Vector3
}

const tmp = new THREE.Vector3()

/** Поза для вида с учётом пропорций экрана (телефон — портрет, доска во всю высоту). */
export function cameraPoseFor(view: LabViewId, aspect: number, fovDeg: number): CameraPose {
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2)
  switch (view) {
    case 'board': {
      const dH = (BOARD_SIZE.h * 0.56) / tanHalf
      const dW = (BOARD_SIZE.w * 0.57) / (tanHalf * aspect)
      // На телефоне доска влезает по высоте — по ширине её листают (кнопки ◀ ▶ или перетаскивание)
      const d = aspect < 1 ? dH * 1.02 : Math.max(dH, dW)
      return {
        position: new THREE.Vector3(BOARD_CENTER.x, BOARD_CENTER.y, BOARD_CENTER.z + d),
        target: BOARD_CENTER.clone(),
      }
    }
    case 'shelves':
      return aspect < 1
        ? { position: new THREE.Vector3(1.55, 1.55, 1.6), target: new THREE.Vector3(2.25, 1.35, -0.95) }
        : { position: new THREE.Vector3(1.0, 1.7, 1.25), target: new THREE.Vector3(2.25, 1.5, -0.95) }
    case 'cabinets':
      // Тумба под столом: камера ниже, смотрит на дверцы (на телефоне — левые секции со спиртовкой)
      return aspect < 1
        ? { position: new THREE.Vector3(-0.55, 1.12, 1.55), target: new THREE.Vector3(-0.62, 0.48, 0.3) }
        : { position: new THREE.Vector3(0, 1.2, 2.05), target: new THREE.Vector3(0, 0.55, 0.3) }
    case 'hood':
      return aspect < 1
        ? { position: new THREE.Vector3(-1.45, 1.6, 1.55), target: new THREE.Vector3(-2.05, 1.3, -0.9) }
        : { position: new THREE.Vector3(-1.2, 1.62, 1.05), target: new THREE.Vector3(-2.05, 1.32, -0.85) }
    case 'desk':
    default: {
      // Рабочее место (1,3 м) и доска должны поместиться по ширине
      // На телефоне (портрет) смотрим круче сверху: рабочее место крупно внизу, доска целиком вверху
      const phone = aspect < 1
      // опыт — главное: на телефоне рабочее место крупно (доска читается через «Доска»), на компьютере — опыт и доска целиком
      const target = phone ? new THREE.Vector3(0, 1.0, -0.12) : new THREE.Vector3(0, 1.16, -0.4)
      const needHalfW = phone ? 0.7 : 1.05
      const dist = phone
        ? THREE.MathUtils.clamp(needHalfW / (tanHalf * aspect), 1.7, 2.4)
        : Math.max(2.3, needHalfW / (tanHalf * Math.min(aspect, 1.9)) + 0.45)
      const elev = THREE.MathUtils.degToRad(phone ? 36 : 18)
      tmp.set(0, Math.sin(elev), Math.cos(elev)).multiplyScalar(dist)
      return { position: target.clone().add(tmp), target }
    }
  }
}

/** Камера не выходит за стены, не опускается под столешницу. */
export const CAMERA_BOUNDS = {
  min: new THREE.Vector3(-ROOM.w / 2 + 0.25, BENCH_TOP_Y + 0.12, ROOM.frontZ + 0.3),
  max: new THREE.Vector3(ROOM.w / 2 - 0.25, ROOM.h - 0.2, ROOM.backZ - 0.4),
} as const
export const TARGET_BOUNDS = {
  min: new THREE.Vector3(-ROOM.w / 2 + 0.5, 0.6, ROOM.frontZ + 0.08),
  max: new THREE.Vector3(ROOM.w / 2 - 0.5, 2.3, 2.0),
} as const
