/**
 * ATOMLAB Cinema kit — ЭЛЕКТРОНЫ И ПОЛЯ.
 *
 * Электрон в школьной сцене — не точка на орбите Бора, а светящийся сгусток
 * со следом: он обходит атом внутри мягкой электронной оболочки, затем уходит
 * по дуге к акцептору и растворяется в его оболочке. Оболочка нарисована
 * кольцом точек — это ЧЕСТНО СХЕМАТИЧНО, и текст урока обязан так и сказать.
 *
 * Всё рисуется точками одного пула CinemaGlowPoints — один draw call на сцену:
 * электрон + след + оболочка + линии поля.
 */
import * as THREE from 'three'
import { norm, smoothstep } from '../../core/easing'
import type { GlowPointsHandle } from '../../react/CinemaGlowPoints'

/** Палитра эффектов: холодный голубой — электрон, тёплый — положительный заряд. */
export const FX_COLOR = {
  /** летящий электрон */
  electron: [0.6, 0.92, 1.0] as const,
  /** электронная оболочка / орбиталь */
  shell: [0.42, 0.7, 1.0] as const,
  /** поле у катиона (+) */
  fieldPlus: [1.0, 0.72, 0.5] as const,
  /** поле у аниона (−) */
  fieldMinus: [0.55, 0.85, 1.0] as const,
}

export type ElectronJump = {
  id: string
  /** где электрон сейчас */
  pos: THREE.Vector3
  /** начало и конец прыжка (поверхность донора → оболочка акцептора) */
  from: THREE.Vector3
  to: THREE.Vector3
  /** нормаль, вдоль которой выгибается дуга */
  perp: THREE.Vector3
  arc: number
  /** 0 — ещё у донора, 1 — уже у акцептора */
  progress: number
  opacity: number
  /** яркость: разгорается на оболочке, максимум в полёте */
  glow: number
}

export function createElectronJump(id: string): ElectronJump {
  return {
    id,
    pos: new THREE.Vector3(),
    from: new THREE.Vector3(),
    to: new THREE.Vector3(),
    perp: new THREE.Vector3(),
    arc: 0.28,
    progress: 0,
    opacity: 0,
    glow: 0,
  }
}

const _dir = new THREE.Vector3()
const _z = new THREE.Vector3(0, 0, 1)
const _p = new THREE.Vector3()

/** Точка на дуге прыжка при параметре p ∈ [0, 1] — без аллокаций. */
export function electronPoint(el: ElectronJump, p: number, out: THREE.Vector3): THREE.Vector3 {
  out.copy(el.from).lerp(el.to, p)
  return out.addScaledVector(el.perp, el.arc * Math.sin(Math.PI * p))
}

export type ElectronJumpSpec = {
  /** атом-донор (отдаёт электрон) */
  donor: THREE.Vector3
  /** атом-акцептор (принимает) */
  acceptor: THREE.Vector3
  /** радиус электронной оболочки донора — по ней электрон ходит до прыжка */
  shellRadius: number
  /** текущий радиус акцептора — электрон входит внутрь его оболочки */
  acceptorRadius: number
  /** момент старта прыжка */
  leave: number
  /** момент прихода (здесь у акцептора завершается октет, радиус растёт) */
  arrive: number
  /** знак дуги: +1 выпуклость «вверх», −1 «вниз» */
  arcSign?: number
  /** высота дуги, мировые единицы */
  arcHeight?: number
  /** за сколько секунд до старта электрон проявляется на оболочке */
  lead?: number
}

/**
 * Считает состояние электрона в момент t. До `leave` он на оболочке донора,
 * между `leave` и `arrive` летит по дуге, после — гаснет внутри акцептора.
 */
export function sampleElectronJump(el: ElectronJump, t: number, s: ElectronJumpSpec): void {
  const lead = s.lead ?? 1.4
  _dir.copy(s.acceptor).sub(s.donor)
  if (_dir.lengthSq() < 1e-8) _dir.set(1, 0, 0)
  _dir.normalize()
  el.from.copy(s.donor).addScaledVector(_dir, s.shellRadius)
  el.to.copy(s.acceptor).addScaledVector(_dir, -s.acceptorRadius * 0.55)
  el.perp.copy(_dir).cross(_z)
  if (el.perp.lengthSq() < 1e-8) el.perp.set(0, 1, 0)
  el.perp.normalize()
  el.arc = (s.arcHeight ?? 0.28) * (s.arcSign ?? 1)

  const show = s.leave - lead
  if (t < show) {
    el.opacity = 0
    el.progress = 0
    el.glow = 0
    el.pos.copy(el.from)
    return
  }
  if (t < s.leave) {
    // На оболочке: обходит атом и приходит ровно в точку старта прыжка.
    const u = norm(show, s.leave, t)
    const start = Math.atan2(_dir.y, _dir.x)
    const a = start + (1 - u) * Math.PI * 1.6 * (s.arcSign ?? 1)
    el.pos.set(
      s.donor.x + Math.cos(a) * s.shellRadius,
      s.donor.y + Math.sin(a) * s.shellRadius,
      s.donor.z + 0.02,
    )
    el.opacity = smoothstep(0, 0.25, u)
    el.progress = 0
    el.glow = 0.35 + 0.65 * smoothstep(0.55, 1, u)
    return
  }
  const p = smoothstep(0, 1, norm(s.leave, s.arrive, t))
  el.progress = p * p * (3 - 2 * p)
  electronPoint(el, el.progress, el.pos)
  el.glow = 1
  el.opacity = t <= s.arrive ? 1 : 1 - smoothstep(0, 0.5, t - s.arrive)
}

// ─────────────────────────────────────────────────────────────────────────────
// Рисование (внутри gp.begin() … gp.end())
// ─────────────────────────────────────────────────────────────────────────────

/** Электрон со следом по собственной дуге. */
export function drawElectron(
  gp: GlowPointsHandle,
  el: ElectronJump,
  elapsed: number,
  opts?: { size?: number; trail?: number; color?: readonly [number, number, number] },
): void {
  if (el.opacity <= 0.01) return
  const size = opts?.size ?? 0.32
  const trail = opts?.trail ?? 16
  const [r, g, b] = opts?.color ?? FX_COLOR.electron
  if (el.progress > 0.001 && el.progress < 0.999) {
    for (let k = 1; k <= trail; k++) {
      const p = el.progress - k * 0.04
      if (p <= 0) break
      electronPoint(el, p, _p)
      const a = el.opacity * (1 - k / (trail + 1)) * 0.8
      gp.push(_p.x, _p.y, _p.z, size * (0.8 - 0.035 * k), r, g, b, a, 0.55)
    }
  }
  const pulse = 0.5 + 0.5 * Math.sin(elapsed * 5.2)
  gp.push(el.pos.x, el.pos.y, el.pos.z, size * (1 + el.glow * (0.45 + 0.15 * pulse)), r, g, b, el.opacity, 0.9)
}

/**
 * Электронная оболочка (валентная орбиталь) — пунктирное кольцо точек с бегущей
 * яркостью. Схематично: это НЕ форма орбитали, а знак «здесь внешний электрон».
 */
export function drawElectronShell(
  gp: GlowPointsHandle,
  center: THREE.Vector3,
  radius: number,
  amount: number,
  elapsed: number,
  opts?: { dots?: number; phase?: number; color?: readonly [number, number, number] },
): void {
  if (amount <= 0.01) return
  const dots = opts?.dots ?? 28
  const phase = opts?.phase ?? 0
  const [r, g, b] = opts?.color ?? FX_COLOR.shell
  for (let k = 0; k < dots; k++) {
    const a = (k / dots) * Math.PI * 2 + phase
    const flow = 0.6 + 0.4 * Math.sin(a * 3 - elapsed * 2.4)
    gp.push(center.x + Math.cos(a) * radius, center.y + Math.sin(a) * radius, center.z + 0.01, 0.075, r, g, b, amount * flow * 0.8, 0.3)
  }
}

/**
 * Линии электростатического поля между разноимёнными ионами: точки бегут
 * от «+» к «−», цвет меняется по пути. Именно это иллюстрирует закон Кулона.
 */
export function drawFieldLine(
  gp: GlowPointsHandle,
  plus: THREE.Vector3,
  minus: THREE.Vector3,
  amount: number,
  elapsed: number,
  opts?: { dots?: number },
): void {
  if (amount <= 0.01) return
  const dots = opts?.dots ?? 12
  for (let k = 1; k < dots; k++) {
    const u = k / dots
    _p.copy(plus).lerp(minus, u)
    const c = u < 0.5 ? FX_COLOR.fieldPlus : FX_COLOR.fieldMinus
    const flow = 0.5 + 0.5 * Math.sin((u < 0.5 ? u : 1 - u) * 26 - elapsed * 6)
    gp.push(_p.x, _p.y, _p.z, 0.06 + 0.05 * flow, c[0], c[1], c[2], amount * flow * 0.7, 0.35)
  }
}
