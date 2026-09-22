import * as THREE from 'three'
import { damp, lambdaFromLerp } from './spring'
import type { CameraRigState } from './states'

/**
 * Свободная область холста: панель урока (слева или снизу) и реактор снизу
 * закрывают часть кадра. Центр действия переносится в середину свободной
 * области, а при тесной области сцена чуть отъезжает. Логика та же, что у
 * урока ClO₂ (Clo2CinemaScene.measureSafeArea), вынесена для остальных сцен.
 *
 * Границы области (left/right/top/bottom) нужны подписям: CinemaDomLabels
 * зажимает их в свободный прямоугольник, чтобы текст не уходил под панель.
 */

export type SafeArea = {
  /** центр свободной области в пикселях холста */
  cx: number
  cy: number
  /** границы свободной области в пикселях холста (0,0 — левый верхний угол канваса) */
  left: number
  right: number
  top: number
  bottom: number
  /** множитель зума (≤ 1) при тесной области */
  fit: number
  counter: number
  ready: boolean
  /** сглаженный сдвиг рига в мировых единицах */
  ox: number
  oy: number
  /** замер уже поставлен в очередь «после кадра» (measureSafeAreaAfterPaint) */
  queued?: boolean
}

export function createSafeArea(): SafeArea {
  return { cx: 0, cy: 0, left: 0, right: 0, top: 0, bottom: 0, fit: 1, counter: 0, ready: false, ox: 0, oy: 0 }
}

/** Как часто (в кадрах) перемерять DOM — getBoundingClientRect не бесплатен. */
export const SAFE_AREA_EVERY = 20

/**
 * Скорость сглаживания сдвига под свободную область, 1/с. Раньше было
 * «lerp 0.08 за кадр» — это зависело от частоты кадров; λ подобрана так, что
 * на 60 Гц поведение прежнее (lambdaFromLerp(0.08, 60) ≈ 5.0).
 */
export const SAFE_AREA_LAMBDA = lambdaFromLerp(0.08, 60)

/** Записывает прямоугольник свободной области (в координатах канваса) и производные величины. */
export function writeSafeRect(
  safe: SafeArea,
  width: number,
  height: number,
  left: number,
  right: number,
  top: number,
  bottom: number,
): void {
  safe.left = left
  safe.right = right
  safe.top = top
  safe.bottom = bottom
  safe.cx = (left + right) / 2
  safe.cy = (top + bottom) / 2
  const ratio = Math.min((right - left) / width, (bottom - top) / height)
  safe.fit = Math.max(0.88, Math.min(1, 0.55 + 0.45 * ratio))
  safe.ready = true
}

export function measureSafeArea(safe: SafeArea, canvas: HTMLCanvasElement): void {
  const r = canvas.getBoundingClientRect()
  if (r.width < 10 || r.height < 10) return
  let left = r.left
  let right = r.right
  let top = r.top + Math.min(90, r.height * 0.1)
  let bottom = r.bottom
  const reactor = document.querySelector<HTMLElement>('[data-lab-reactor]')
  if (reactor) {
    const rr = reactor.getBoundingClientRect()
    if (rr.height > 0 && rr.top > r.top + r.height * 0.35 && rr.top < bottom) bottom = rr.top
  }
  const panel = document.querySelector<HTMLElement>('[data-lab-lesson-panel]')
  if (panel) {
    const pr = panel.getBoundingClientRect()
    if (pr.width > 0 && pr.height > 0) {
      const docksBottom = pr.width > r.width * 0.8 || pr.top > r.top + r.height * 0.5
      if (docksBottom) bottom = Math.min(bottom, pr.top)
      else if (pr.left < r.left + r.width * 0.5) left = Math.max(left, pr.right)
      else right = Math.min(right, pr.left)
    }
  }
  if (bottom - top < r.height * 0.3) top = r.top
  writeSafeRect(safe, r.width, r.height, left - r.left, right - r.left, top - r.top, bottom - r.top)
}

/**
 * Замер «после кадра». Внутри кадра (useFrame/rAF) DOM грязный: подписи сцены
 * и панель урока только что записали стили, и getBoundingClientRect заставляет
 * браузер пересчитать стили посреди кадра (трасса приёмки NaCl: 7–9 таких
 * пересчётов за 2,5 с после «Далее»). Сообщение, отправленное из rAF, исполняется
 * задачей уже после отрисовки кадра, когда стили и раскладка посчитаны, — чтение
 * бесплатное. Результат нужен только следующим кадрам (сдвиг рига сглажен).
 */
const queueSafe: SafeArea[] = []
const queueCanvas: HTMLCanvasElement[] = []
let afterPaintPort: MessagePort | null | undefined

function drainAfterPaint(): void {
  for (let i = 0; i < queueSafe.length; i++) {
    const safe = queueSafe[i]!
    const canvas = queueCanvas[i]!
    safe.queued = false
    if (canvas.isConnected) measureSafeArea(safe, canvas)
  }
  queueSafe.length = 0
  queueCanvas.length = 0
}

export function measureSafeAreaAfterPaint(safe: SafeArea, canvas: HTMLCanvasElement): void {
  if (safe.queued) return
  if (afterPaintPort === undefined) {
    if (typeof MessageChannel === 'function') {
      const ch = new MessageChannel()
      ch.port1.onmessage = drainAfterPaint
      afterPaintPort = ch.port2
    } else afterPaintPort = null
  }
  if (!afterPaintPort) {
    measureSafeArea(safe, canvas)
    return
  }
  safe.queued = true
  queueSafe.push(safe)
  queueCanvas.push(canvas)
  if (queueSafe.length === 1) afterPaintPort.postMessage(0)
}

const _o = new THREE.Vector3()
const _ox = new THREE.Vector3()

/**
 * Применяет камеру раскадровки к ригу с учётом свободной области:
 * зум умножается на fit, центр действия сдвигается в середину области.
 * `view.dt` — длительность кадра, с (по умолчанию 1/60): сглаживание сдвига
 * не зависит от частоты кадров.
 */
export function applyCameraToRig(
  rig: CameraRigState,
  safe: SafeArea,
  cam: { zoom: number; offset: THREE.Vector3; yaw: number; roll: number; shake: number; pitch?: number },
  view: { canvas: HTMLCanvasElement; camera: THREE.Camera; width: number; height: number; dt?: number },
): void {
  // Первый замер — синхронно (иначе в первом кадре зум без fit и скачок); дальше —
  // после кадра, без принудительного пересчёта стилей в горячем пути.
  if (safe.counter++ % SAFE_AREA_EVERY === 0) {
    if (safe.ready) measureSafeAreaAfterPaint(safe, view.canvas)
    else measureSafeArea(safe, view.canvas)
  }
  const fit = safe.ready ? safe.fit : 1
  rig.zoom = cam.zoom * fit
  rig.offset.copy(cam.offset).multiplyScalar(fit)
  if (safe.ready) {
    // Сдвиг в плоскости z = 0: сколько пикселей в мировой единице и где сейчас центр.
    _o.set(0, 0, 0).project(view.camera)
    _ox.set(1, 0, 0).project(view.camera)
    const pxPerUnit = Math.abs(_ox.x - _o.x) * 0.5 * view.width
    if (pxPerUnit > 1e-3) {
      const ox = (safe.cx - (_o.x * 0.5 + 0.5) * view.width) / pxPerUnit
      const oy = -(safe.cy - (-_o.y * 0.5 + 0.5) * view.height) / pxPerUnit
      // Длинный кадр (вкладка в фоне) не должен «телепортировать» сцену: dt ≤ 0.1 с.
      const dt = Math.min(0.1, Math.max(0, view.dt ?? 1 / 60))
      safe.ox = damp(safe.ox, ox, SAFE_AREA_LAMBDA, dt)
      safe.oy = damp(safe.oy, oy, SAFE_AREA_LAMBDA, dt)
      rig.offset.x += safe.ox
      rig.offset.y += safe.oy
    }
  }
  rig.yaw = cam.yaw
  rig.pitch = cam.pitch ?? 0
  rig.roll = cam.roll
  rig.shake = cam.shake
}
