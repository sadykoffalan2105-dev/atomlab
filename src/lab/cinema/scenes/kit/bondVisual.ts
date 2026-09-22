/**
 * ATOMLAB Cinema kit — ВИД СВЯЗИ ПО ЕЁ ПРИРОДЕ.
 *
 * Язык документа OPUS-3D-FORMATION-11:
 *   • sigma    — σ-связь: цилиндр (трубка пула связей), дробная кратность — пунктир;
 *   • double   — σ-трубка + ОДНА π-связь: пара p-лепестков над и под осью у каждого
 *                атома (LobeKind.p в world.lobes, ось лепестка = нормаль π);
 *   • triple   — σ-трубка + ДВЕ взаимно перпендикулярные π-связи (4 лепестка на атом);
 *   • ionic    — НИКАКОЙ «палочки»: 3–5 дуг линий поля точками от «+» к «−»
 *                (закон Кулона), трубка в слоте связи невидима;
 *   • hbond    — водородная связь: нейтральный пунктир (без окраски CPK) с
 *                неподвижным штрихом — это притяжение, а не поток электронов;
 *   • metallic — делокализованная связь в металле: тонкая бледная нить между
 *                соседями решётки (схема «электронного газа», назвать в note).
 *
 * Слот связи i остаётся за этой парой атомов при любом виде — индексы раскадровки
 * стабильны, ионная связь просто невидима в пуле связей.
 *
 * π-лепестки ДОПИСЫВАЮТСЯ в world.lobes: в начале кадра сцена зовёт
 * resetBondVisuals(world), потом writeBondVisual для каждой связи. Лепестки
 * рисует OrbitalLobes, смонтированный в SceneShell (фазы + / − разными цветами —
 * это знак волновой функции p-орбитали, а не заряд).
 */
import * as THREE from 'three'
import { LobeKind, writeVec3, type LobePool } from '../../core/pools'
import type { GlowPointsHandle } from '../../react/CinemaGlowPoints'
import { writeBond } from './cpkAtoms'
import { FX_COLOR } from './electronFx'
import type { SceneWorld } from './sceneKit'

export type BondKind = 'sigma' | 'double' | 'triple' | 'ionic' | 'hbond' | 'metallic'

/** Нейтральный цвет водородной связи (не CPK: это не атомы, а притяжение), sRGB. */
export const HBOND_COLOR = 0xb9c6d8
/** Бледная нить металлической связи, sRGB. */
export const METALLIC_BOND_COLOR = 0xc9d3e0
/** Доля штриха в периоде пунктира водородной связи. */
export const HBOND_DUTY = 0.5

export type BondVisualOpts = {
  /** цвета половин σ-трубки (обычно cpkHex атомов); по умолчанию нейтральный серый */
  colorA?: number
  colorB?: number
  /** радиус трубки σ-связи, мировые единицы (по умолчанию 0.05) */
  radius?: number
  /** длина π-лепестка, мировые единицы (по умолчанию 0.42 длины связи, не больше 0.55) */
  lobeSize?: number
  /** −1…+1 — полярность σ-связи (смещение плотности к B при > 0) */
  polarity?: number
  /** ionic: пул точек кадра — линии поля рисуются только если он передан */
  gp?: GlowPointsHandle | null
  /** ionic: визуальное время кадра (бег точек по линиям) */
  elapsed?: number
  /** ionic: число дуг 3…5 (по умолчанию 4) */
  fieldLines?: number
}

const _axis = new THREE.Vector3()
const _n1 = new THREE.Vector3()
const _n2 = new THREE.Vector3()
const _tmp = new THREE.Vector3()

/** Нормаль π: переданная (ортогонализованная к оси) или любая перпендикулярная оси. */
function writePiNormal(out: THREE.Vector3, axis: THREE.Vector3, plane?: THREE.Vector3): void {
  if (plane) {
    out.copy(plane).addScaledVector(axis, -plane.dot(axis))
    if (out.lengthSq() > 1e-10) {
      out.normalize()
      return
    }
  }
  // Ось, наименее сонаправленная со связью, → перпендикуляр.
  const ax = Math.abs(axis.x)
  const ay = Math.abs(axis.y)
  const az = Math.abs(axis.z)
  if (ay <= ax && ay <= az) _tmp.set(0, 1, 0)
  else if (az <= ax) _tmp.set(0, 0, 1)
  else _tmp.set(1, 0, 0)
  out.copy(_tmp).addScaledVector(axis, -_tmp.dot(axis)).normalize()
}

/** Дописать p-лепесток (два лепестка ±axis) в пул; false — пул полон. */
function pushPLobe(pool: LobePool, center: THREE.Vector3, axis: THREE.Vector3, size: number, opacity: number): boolean {
  const i = pool.count
  if (i >= pool.capacity) return false
  writeVec3(pool.center, i, center.x, center.y, center.z)
  writeVec3(pool.axis, i, axis.x, axis.y, axis.z)
  pool.size[i] = size
  // Связывающая π: у обоих атомов одинаковая фаза сверху — лепестки «сливаются» над осью.
  pool.coef[i] = 1
  pool.opacity[i] = opacity
  pool.kind[i] = LobeKind.p
  // π-пара электронов на связь: орбиталь заселена.
  pool.occupancy[i] = 1
  pool.count = i + 1
  return true
}

/**
 * Сколько записей p-лепестков дописывает связь вида kind (для расчёта ёмкости
 * world.lobes в buildSceneWorld): double — 2 (по одной на атом), triple — 4.
 */
export function bondVisualLobeCount(kind: BondKind): number {
  return kind === 'double' ? 2 : kind === 'triple' ? 4 : 0
}

/** Начало кадра: очистить π-лепестки связей (world.lobes). */
export function resetBondVisuals(world: SceneWorld): void {
  world.lobes.count = 0
  world.lobes.version++
}

/**
 * Записать связь i между точками a и b в виде kind.
 *   order     — кратность σ-трубки для 'sigma' (1, 1.5 — пунктир делокализации);
 *               для остальных видов не используется;
 *   amount    — 0…1 появление связи (прозрачность трубки, лепестков и линий поля);
 *   planeNormal — нормаль π для 'double' (ось p-орбиталей: ⟂ плоскости σ-каркаса
 *               молекулы); для 'triple' вторая π берётся ⟂ первой и оси.
 * Возвращает, сколько записей p-лепестков дописано в world.lobes (каждая — пара
 * лепестков «над и под» осью): double → 2 (по одной на атом), triple → 4.
 * Без аллокаций.
 */
export function writeBondVisual(
  world: SceneWorld,
  i: number,
  a: THREE.Vector3,
  b: THREE.Vector3,
  kind: BondKind,
  order: number,
  amount: number,
  planeNormal?: THREE.Vector3,
  opts?: BondVisualOpts,
): number {
  const amt = Math.max(0, Math.min(1, amount))
  const radius = opts?.radius ?? 0.05
  const colorA = opts?.colorA ?? METALLIC_BOND_COLOR
  const colorB = opts?.colorB ?? METALLIC_BOND_COLOR

  if (kind === 'ionic') {
    // Слот остаётся за парой, но трубки нет.
    writeBond(world.bonds, i, { a, b, radius: 0, colorA, colorB, order: 1, opacity: 0 })
    if (opts?.gp) drawFieldLines(opts.gp, a, b, amt, opts.elapsed ?? 0, { lines: opts.fieldLines })
    return 0
  }
  if (kind === 'hbond') {
    writeBond(world.bonds, i, {
      a,
      b,
      radius: radius * 0.6,
      colorA: HBOND_COLOR,
      colorB: HBOND_COLOR,
      order: HBOND_DUTY,
      opacity: amt,
      dashStatic: true,
    })
    return 0
  }
  if (kind === 'metallic') {
    writeBond(world.bonds, i, { a, b, radius: radius * 0.45, colorA: METALLIC_BOND_COLOR, colorB: METALLIC_BOND_COLOR, order: 1, opacity: amt * 0.6 })
    return 0
  }

  const sigmaOrder = kind === 'sigma' ? order : 1
  writeBond(world.bonds, i, { a, b, radius, colorA, colorB, order: sigmaOrder, opacity: amt, polarity: opts?.polarity ?? 0 })
  if (kind === 'sigma') return 0

  _axis.copy(b).sub(a)
  const len = _axis.length()
  if (len < 1e-6 || amt <= 0.002) return 0
  _axis.multiplyScalar(1 / len)
  const size = opts?.lobeSize ?? Math.min(0.55, 0.42 * len)
  writePiNormal(_n1, _axis, planeNormal)
  let written = 0
  if (pushPLobe(world.lobes, a, _n1, size, amt)) written++
  if (pushPLobe(world.lobes, b, _n1, size, amt)) written++
  if (kind === 'triple') {
    _n2.copy(_axis).cross(_n1).normalize()
    if (pushPLobe(world.lobes, a, _n2, size, amt)) written++
    if (pushPLobe(world.lobes, b, _n2, size, amt)) written++
  }
  world.lobes.version++
  return written
}

const _p = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _u = new THREE.Vector3()
const _w = new THREE.Vector3()
const _off = new THREE.Vector3()

/**
 * Линии электростатического поля между разноимёнными ионами — 3…5 ДУГ точками
 * (внутри gp.begin() … gp.end()). Дуги разнесены вокруг оси «+ → −» равномерно,
 * выгиб — bend·d·sin(πu); точки бегут от «+» к «−», цвет меняется посередине.
 * Это схема закона Кулона, а не «палочка» связи. Без аллокаций.
 */
export function drawFieldLines(
  gp: GlowPointsHandle,
  plus: THREE.Vector3,
  minus: THREE.Vector3,
  amount: number,
  elapsed: number,
  opts?: { lines?: number; bend?: number; dots?: number; phase?: number },
): void {
  if (amount <= 0.01) return
  const lines = Math.max(3, Math.min(5, Math.round(opts?.lines ?? 4)))
  const bend = opts?.bend ?? 0.28
  const dots = Math.max(4, opts?.dots ?? 10)
  const phase = opts?.phase ?? 0.4
  _dir.copy(minus).sub(plus)
  const d = _dir.length()
  if (d < 1e-6) return
  _dir.multiplyScalar(1 / d)
  writePiNormal(_u, _dir)
  _w.copy(_dir).cross(_u)
  for (let l = 0; l < lines; l++) {
    const az = phase + (l * 2 * Math.PI) / lines
    _off.copy(_u).multiplyScalar(Math.cos(az)).addScaledVector(_w, Math.sin(az))
    for (let k = 1; k < dots; k++) {
      const u = k / dots
      _p.copy(plus).lerp(minus, u).addScaledVector(_off, bend * d * Math.sin(Math.PI * u))
      const c = u < 0.5 ? FX_COLOR.fieldPlus : FX_COLOR.fieldMinus
      const flow = 0.5 + 0.5 * Math.sin(u * 18 - elapsed * 5 + l * 1.3)
      gp.push(_p.x, _p.y, _p.z, 0.05 + 0.04 * flow, c[0], c[1], c[2], amount * (0.35 + 0.45 * flow), 0.3)
    }
  }
}
