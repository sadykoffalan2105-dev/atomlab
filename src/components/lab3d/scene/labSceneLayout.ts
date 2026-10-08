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
        : { position: new THREE.Vector3(0, 1.3, 2.75), target: new THREE.Vector3(0, 0.5, 0.35) }
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

/**
 * Мебель, сквозь которую камера не проходит (вытяжка с воздуховодом, столешница у мойки, полки и навесной шкаф).
 * Без этого при сильном повороте/приближении камера оказывалась внутри коробки вытяжки — изнутри грани не рисуются,
 * и сквозь шкаф была видна доска. Коробки — с запасом на ближнюю плоскость камеры (см. keepCameraOutOfFurniture).
 */
export const CAMERA_SOLIDS: ReadonlyArray<{ readonly min: THREE.Vector3; readonly max: THREE.Vector3 }> = [
  // Вытяжной шкаф целиком (корпус, козырёк, воздуховод до потолка)
  { min: new THREE.Vector3(HOOD.x - HOOD.w / 2, 0, ROOM.frontZ), max: new THREE.Vector3(HOOD.x + HOOD.w / 2, ROOM.h, ROOM.frontZ + HOOD.d) },
  // Столешница с мойкой и тумбой
  { min: new THREE.Vector3(COUNTER.x0, 0, ROOM.frontZ), max: new THREE.Vector3(COUNTER.x1, BENCH_TOP_Y + 0.02, ROOM.frontZ + COUNTER.d) },
  // Полки с реактивами и навесной шкаф над столешницей
  { min: new THREE.Vector3(COUNTER.x0, BENCH_TOP_Y + 0.02, ROOM.frontZ), max: new THREE.Vector3(COUNTER.x1, 2.52, ROOM.frontZ + 0.34) },
  // Электронная доска с рамкой и полочкой для маркеров
  {
    min: new THREE.Vector3(BOARD_CENTER.x - BOARD_SIZE.w / 2 - 0.05, BOARD_CENTER.y - BOARD_SIZE.h / 2 - 0.08, ROOM.frontZ),
    max: new THREE.Vector3(BOARD_CENTER.x + BOARD_SIZE.w / 2 + 0.05, BOARD_CENTER.y + BOARD_SIZE.h / 2 + 0.05, BOARD_CENTER.z + 0.06),
  },
]

/** Запас от мебели до камеры (м): ближняя плоскость 0,03 м + поле зрения — ничего не обрезается. */
const SOLID_MARGIN = 0.1

/**
 * Створка вытяжного шкафа (общие размеры для LabHood и камеры): низ стекла при подъёме 0, высота козырька, ход створки.
 * Планка с ручкой свисает ниже низа стекла на HANDLE_DROP.
 */
export const HOOD_SASH = { bottom: 1.26, canopyH: 0.42, maxLift: 0.4, handleDrop: 0.05 } as const
/** Плоскость створки (z): камера «внутри вытяжки», если она за ней. */
export const HOOD_SASH_Z = ROOM.frontZ + HOOD.d - 0.03
/** Толщина боковин и задней стенки шкафа (LabRoom/FumeHood). */
const HOOD_WALL = 0.07
const HOOD_BACK = 0.022
/** Запас камеры внутри рабочей зоны (до боковин, планки створки, задней стенки): ближняя плоскость 0,03 м. */
const HOOD_INNER_MARGIN = 0.045

/**
 * Проём под поднятой створкой: где камера крупного плана может стоять внутри рабочей зоны вытяжки (между боковинами,
 * над столом, ниже планки с ручкой, перед задней стенкой). lift — подъём створки (м); null — проём слишком низкий.
 */
export function hoodOpening(lift: number): { readonly min: THREE.Vector3; readonly max: THREE.Vector3 } | null {
  const top = HOOD_SASH.bottom + lift - HOOD_SASH.handleDrop - HOOD_INNER_MARGIN
  const bottom = CAMERA_BOUNDS.min.y
  if (top - bottom < 0.06) return null
  return {
    min: new THREE.Vector3(HOOD.x - HOOD.w / 2 + HOOD_WALL + HOOD_INNER_MARGIN, bottom, ROOM.frontZ + HOOD_BACK + HOOD_INNER_MARGIN),
    max: new THREE.Vector3(HOOD.x + HOOD.w / 2 - HOOD_WALL - HOOD_INNER_MARGIN, top, ROOM.frontZ + HOOD.d + SOLID_MARGIN),
  }
}

/** Точка за створкой, в рабочей зоне вытяжки (для перелёта камеры через проём, а не сквозь стекло). */
export function insideHood(p: THREE.Vector3): boolean {
  return p.z < HOOD_SASH_Z && p.x > HOOD.x - HOOD.w / 2 && p.x < HOOD.x + HOOD.w / 2 && p.y < HOOD.h
}

/**
 * Выталкивает точку камеры из мебели к ближайшей свободной грани (в пределах CAMERA_BOUNDS). Возвращает true, если сдвинула.
 * hoodLift — подъём створки вытяжки: тогда камера может заехать под створку в рабочую зону (крупный план шкалы прибора);
 * если точка за створкой, но выше проёма — её опускает в проём (когда это ближе, чем вытолкнуть наружу).
 */
export function keepCameraOutOfFurniture(p: THREE.Vector3, hoodLift?: number): boolean {
  let moved = false
  const opening = hoodLift == null ? null : hoodOpening(hoodLift)
  for (let i = 0; i < CAMERA_SOLIDS.length; i++) {
    const s = CAMERA_SOLIDS[i]!
    const x0 = s.min.x - SOLID_MARGIN
    const x1 = s.max.x + SOLID_MARGIN
    const y0 = s.min.y - SOLID_MARGIN
    const y1 = s.max.y + SOLID_MARGIN
    const z1 = s.max.z + SOLID_MARGIN
    if (p.x <= x0 || p.x >= x1 || p.y <= y0 || p.y >= y1 || p.z >= z1) continue
    const hoodBox = i === 0 && opening
    if (hoodBox && p.x >= opening.min.x && p.x <= opening.max.x && p.y >= opening.min.y && p.y <= opening.max.y && p.z >= opening.min.z) continue
    // Выход к ближайшей грани: влево, вправо, вперёд (к ученику), вверх или вниз — только если там не стена/потолок/стол
    let best = z1 - p.z
    let axis: 'x0' | 'x1' | 'y0' | 'y1' | 'z1' | 'in' = 'z1'
    if (x0 >= CAMERA_BOUNDS.min.x && p.x - x0 < best) [best, axis] = [p.x - x0, 'x0']
    if (x1 <= CAMERA_BOUNDS.max.x && x1 - p.x < best) [best, axis] = [x1 - p.x, 'x1']
    if (y1 <= CAMERA_BOUNDS.max.y && y1 - p.y < best) [best, axis] = [y1 - p.y, 'y1']
    if (y0 >= CAMERA_BOUNDS.min.y && p.y - y0 < best) [best, axis] = [p.y - y0, 'y0']
    // …или внутрь проёма вытяжки (под створку), если это ближе
    if (hoodBox) {
      const dIn = tmp.copy(p).clamp(opening.min, opening.max).distanceTo(p)
      if (dIn < best) [best, axis] = [dIn, 'in']
    }
    if (axis === 'x0') p.x = x0
    else if (axis === 'x1') p.x = x1
    else if (axis === 'y0') p.y = y0
    else if (axis === 'y1') p.y = y1
    else if (axis === 'in' && hoodBox) p.clamp(opening.min, opening.max)
    else p.z = z1
    moved = true
  }
  return moved
}
