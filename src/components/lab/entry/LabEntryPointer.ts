/**
 * Интерактив экрана входа — чистая математика без three и React.
 *
 * Две величины:
 *   • параллакс — наклон НАШЕЙ группы (не камеры!). Камера целиком остаётся за
 *     OrbitControls, который в idle-кадре стоит с makeDefault; двигать её отсюда
 *     значит воевать с чужим демпфированием;
 *   • boost — «магнит»: пока палец удерживается у центра кадра, реакция идёт
 *     быстрее. Школьник физически запускает реакцию, а не смотрит гифку.
 *
 * boost растёт ТОЛЬКО если указатель у центра и его почти не двигают: жест
 * вращения камеры (пользователь тащит по сцене) не должен случайно считаться
 * удержанием. Сглаживание — критически задемпфированная пружина и `damp`,
 * обе кадронезависимы, поэтому на 24 Гц ощущается так же, как на 60.
 */
import { damp, springStep, type SpringState } from '../../../lab/cinema/core/spring'

/** Радиус зоны «магнита» в NDC от центра кадра. */
export const ENTRY_BOOST_RADIUS = 0.45
/** Сдвиг указателя за кадр, выше которого жест считается вращением камеры. */
const DRAG_EPS = 0.01

const TILT_Y = 0.1
const TILT_X = 0.06
const TILT_LAMBDA = 4
const BOOST_OMEGA = 6
const BOOST_ZETA = 1

export type EntryPointerState = {
  /** наклон группы вокруг X, радианы */
  tiltX: number
  /** наклон группы вокруг Y, радианы */
  tiltY: number
  /** 0..1 — ускорение сценария */
  boost: number
  spring: SpringState
  lastX: number
  lastY: number
  seen: boolean
}

export function createEntryPointerState(): EntryPointerState {
  return {
    tiltX: 0,
    tiltY: 0,
    boost: 0,
    spring: { x: 0, v: 0 },
    lastX: 0,
    lastY: 0,
    seen: false,
  }
}

export type EntryPointerInput = {
  /** NDC −1..1 (useThree(s => s.pointer) — слушателей не нужно) */
  x: number
  y: number
  down: boolean
  dt: number
  /** false на слабых устройствах: остаётся только boost по касанию */
  parallax: boolean
}

/** Шаг интерактива: мутирует состояние, ничего не аллоцирует. */
export function stepEntryPointer(state: EntryPointerState, input: EntryPointerInput): EntryPointerState {
  const { x, y, down, dt } = input

  const moved = state.seen ? Math.hypot(x - state.lastX, y - state.lastY) : 0
  state.lastX = x
  state.lastY = y
  state.seen = true

  const nearCenter = Math.hypot(x, y) < ENTRY_BOOST_RADIUS
  const holding = down && nearCenter && moved < DRAG_EPS
  springStep(state.spring, holding ? 1 : 0, BOOST_OMEGA, BOOST_ZETA, dt)
  state.boost = state.spring.x < 0 ? 0 : state.spring.x > 1 ? 1 : state.spring.x

  if (input.parallax) {
    state.tiltY = damp(state.tiltY, x * TILT_Y, TILT_LAMBDA, dt)
    state.tiltX = damp(state.tiltX, -y * TILT_X, TILT_LAMBDA, dt)
  } else if (state.tiltX !== 0 || state.tiltY !== 0) {
    state.tiltY = damp(state.tiltY, 0, TILT_LAMBDA, dt)
    state.tiltX = damp(state.tiltX, 0, TILT_LAMBDA, dt)
  }
  return state
}
