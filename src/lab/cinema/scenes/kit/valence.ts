/**
 * ATOMLAB Cinema kit — ВАЛЕНТНЫЕ ЭЛЕКТРОНЫ ТОЧКАМИ.
 *
 * Электроны внешнего слоя — не кольцо и не планетки на орбите, а N отдельных
 * точек вокруг атома, разложенных по правилу структур Льюиса, поднятому в 3D:
 *   • первые четыре электрона — по одному на четыре направления тетраэдра
 *     (неспаренные, как у C: 4 точки);
 *   • пятый…восьмой — в пару к первому…четвёртому (N: 1 пара + 3 одиночных,
 *     O: 2 пары + 2 одиночных — два неспаренных электрона O(³P), Cl: 3 пары + 1).
 * Сверх октета (расширенная оболочка, d-элементы) — следующие четыре направления
 * противоположного тетраэдра (вершины куба), тоже сначала поодиночке, потом парами.
 *
 * Число электронов сцена передаёт САМА: из atomicData (valenceElectrons) и
 * заряда частицы (Na → Na⁺: 1 → 0 внешних; Cl → Cl⁻: 7 → 8). Здесь чисел химии нет.
 *
 * Схематично (назвать в note шага): точки — не положения электронов, а счёт
 * валентных электронов и их спаривание; «облако» реального атома размыто.
 */
import * as THREE from 'three'
import { sampleScalar, type ScalarTrack } from '../../core/tracks'
import type { GlowPointsHandle } from '../../react/CinemaGlowPoints'
import { FX_COLOR } from './electronFx'

/** Сколько точек максимум умеет разложить valenceDots. */
export const VALENCE_MAX_DOTS = 16

const K = 0.5773502692
/** Вершины куба: первые четыре — тетраэдр, следующие четыре — противоположный. */
const DIRS: ReadonlyArray<readonly [number, number, number]> = [
  [K, K, K],
  [K, -K, -K],
  [-K, K, -K],
  [-K, -K, K],
  [-K, -K, -K],
  [-K, K, K],
  [K, -K, K],
  [K, K, -K],
]

/** Угловой полуразнос двух электронов пары вокруг общего направления, рад. */
export const VALENCE_PAIR_SPLIT = 0.3

const _d = new THREE.Vector3()
const _side = new THREE.Vector3()
const _pt = new THREE.Vector3()

/**
 * Раскладка count валентных электронов на сфере радиуса radius (центр в нуле).
 * Пишет смещения xyz в out (3 float на точку), возвращает число записанных точек
 * (min(count, VALENCE_MAX_DOTS, out.length / 3)). Каждая точка лежит РОВНО на
 * радиусе. rotation — поворот всей раскладки (например, медленное «дыхание»).
 * Без аллокаций.
 */
export function valenceDots(count: number, radius: number, out: Float32Array, rotation?: THREE.Quaternion): number {
  const n = Math.max(0, Math.min(Math.floor(count), VALENCE_MAX_DOTS, Math.floor(out.length / 3)))
  // Сколько электронов приходится на каждое из восьми направлений: 0, 1 или 2.
  for (let k = 0; k < n; k++) {
    // k: 0..3 — одиночные тетраэдра, 4..7 — пары к ним, 8..11 — одиночные второго тетраэдра, 12..15 — пары.
    const block = k >> 2
    const slot = k & 3
    const dirIndex = (block >> 1) * 4 + slot
    const paired = (block & 1) === 1
    const d = DIRS[dirIndex]!
    _d.set(d[0], d[1], d[2])
    if (paired) {
      // Пара: второй электрон ставится рядом с первым, оба сдвигаются симметрично
      // вокруг направления — это делает вызов для обоих (см. ниже).
      writePairPoint(_pt, _d, dirIndex, +1)
    } else if (k + 4 < n && (block & 1) === 0) {
      // У направления будет пара — первый электрон уже смещён на своё место в паре.
      writePairPoint(_pt, _d, dirIndex, -1)
    } else {
      _pt.copy(_d)
    }
    if (rotation) _pt.applyQuaternion(rotation)
    _pt.multiplyScalar(radius)
    out[k * 3] = _pt.x
    out[k * 3 + 1] = _pt.y
    out[k * 3 + 2] = _pt.z
  }
  return n
}

/** Точка пары: направление d, повёрнутое на ±VALENCE_PAIR_SPLIT в детерминированной плоскости. */
function writePairPoint(out: THREE.Vector3, d: THREE.Vector3, dirIndex: number, sign: number): void {
  // Сторона разноса ⟂ d; своя для каждого направления, чтобы пары не смотрели в одну сторону.
  const ref = dirIndex % 2 === 0 ? 1 : -1
  _side.set(ref * d.y, -ref * d.x, 0)
  if (_side.lengthSq() < 1e-8) _side.set(0, d.z, -d.y)
  _side.normalize()
  const c = Math.cos(VALENCE_PAIR_SPLIT)
  const s = Math.sin(VALENCE_PAIR_SPLIT) * sign
  out.copy(d).multiplyScalar(c).addScaledVector(_side, s).normalize()
}

export type ValenceCloudOpts = {
  /** диаметр точки, мировые единицы */
  size?: number
  color?: readonly [number, number, number]
  /** скорость медленного вращения раскладки, рад/с (0 — неподвижно) */
  spin?: number
  /** дополнительный поворот раскладки */
  rotation?: THREE.Quaternion
  /** индекс электрона, который выделить (уходящий/пришедший), −1 — никого */
  highlight?: number
  /** сколько первых точек НЕ рисовать (электрон уже улетел по дуге и рисуется drawElectron) */
  skip?: number
  /**
   * Направление на зрителя (единичный вектор): точки раскладываются кольцом Льюиса В ПЛОСКОСТИ
   * ЭКРАНА вокруг силуэта сферы (стороны право/верх/низ/лево, пары — рядом), чуть ближе к камере.
   * Так видны ВСЕ точки — у 3D-тетраэдра половина пряталась за сферой (приёмка NaCl: у Cl⁻ было
   * видно 4–5 из 8). Без него — прежняя объёмная раскладка.
   */
  facing?: THREE.Vector3
}

/**
 * Стороны кольца Льюиса в плоскости экрана: право, верх, низ, лево. Первый электрон — справа
 * (у Na, стоящего слева от Cl, единственная точка смотрит на партнёра и не прячется под подписью
 * над или под атомом); у Cl (7) одиночный — слева, и пришедший электрон достраивает там пару.
 */
const LEWIS_SIDES = [0, Math.PI / 2, -Math.PI / 2, Math.PI] as const
const _u = new THREE.Vector3()
const _w = new THREE.Vector3()
const _worldUp = new THREE.Vector3(0, 1, 0)

/**
 * Раскладка Льюиса в плоскости экрана: первые четыре электрона — по одному на сторону, пятый…
 * восьмой — в пару к первому…четвёртому (Cl: 3 пары + 1 одиночный). Пишет xyz в out. Без аллокаций.
 */
export function lewisRingDots(count: number, radius: number, facing: THREE.Vector3, out: Float32Array): number {
  const n = Math.max(0, Math.min(Math.floor(count), 8, Math.floor(out.length / 3)))
  _u.crossVectors(_worldUp, facing)
  if (_u.lengthSq() < 1e-8) _u.set(1, 0, 0)
  _u.normalize()
  _w.crossVectors(facing, _u).normalize()
  for (let k = 0; k < n; k++) {
    const side = k & 3
    // Сторона k получает пару, если есть электрон k + 4 (или это он сам).
    const paired = k >= 4 || k + 4 < n
    const a = LEWIS_SIDES[side]! + (paired ? (k >= 4 ? 1 : -1) * VALENCE_PAIR_SPLIT * 0.8 : 0)
    const c = Math.cos(a) * radius
    const d = Math.sin(a) * radius
    out[k * 3] = _u.x * c + _w.x * d + facing.x * radius * 0.15
    out[k * 3 + 1] = _u.y * c + _w.y * d + facing.y * radius * 0.15
    out[k * 3 + 2] = _u.z * c + _w.z * d + facing.z * radius * 0.15
  }
  return n
}

const _dots = new Float32Array(VALENCE_MAX_DOTS * 3)
const _spin = new THREE.Quaternion()
const _yAxis = new THREE.Vector3(0, 1, 0)

/**
 * N отдельных валентных электронов вокруг атома (внутри gp.begin() … gp.end()).
 * amount 0…1 — видимость облака: донор гаснет после ухода электрона, акцептор
 * загорается с октетом В ТОТ ЖЕ кадр, в который electron.arrived стало true.
 */
export function drawValenceCloud(
  gp: GlowPointsHandle,
  center: THREE.Vector3,
  radius: number,
  count: number,
  amount: number,
  elapsed: number,
  opts?: ValenceCloudOpts,
): void {
  if (amount <= 0.01 || count <= 0) return
  let n: number
  if (opts?.facing) {
    n = lewisRingDots(count, radius, opts.facing, _dots)
  } else {
    const spin = opts?.spin ?? 0.25
    _spin.setFromAxisAngle(_yAxis, elapsed * spin)
    if (opts?.rotation) _spin.multiply(opts.rotation)
    n = valenceDots(count, radius, _dots, _spin)
  }
  const size = opts?.size ?? 0.085
  const [r, g, b] = opts?.color ?? FX_COLOR.shell
  const hi = opts?.highlight ?? -1
  const skip = Math.max(0, opts?.skip ?? 0)
  for (let k = skip; k < n; k++) {
    const flick = 0.88 + 0.12 * Math.sin(elapsed * 3.1 + k * 1.7)
    const isHi = k === hi
    gp.push(
      center.x + _dots[k * 3]!,
      center.y + _dots[k * 3 + 1]!,
      center.z + _dots[k * 3 + 2]!,
      isHi ? size * 1.5 : size,
      r,
      g,
      b,
      amount * flick * (isHi ? 1 : 0.85),
      isHi ? 0.8 : 0.45,
    )
  }
}

/** Смещение ступеньки octetSnap до момента прихода, с — много меньше кадра (1/240 с). */
export const OCTET_SNAP_EPS = 1e-4

/**
 * Дорожка радиуса, меняющегося РОВНО в кадр прихода электрона: до tArrive —
 * rBefore, начиная с tArrive — rAfter (ступень 'step', без промежуточных
 * значений в кадрах). Тем же tArrive сцена кормит sampleElectronJump.arrive.
 */
export function octetSnap(tArrive: number, rBefore: number, rAfter: number): ScalarTrack {
  return [
    { t: tArrive - OCTET_SNAP_EPS, v: rBefore },
    { t: tArrive, v: rAfter, ease: 'step' },
  ]
}

/**
 * Проверка для теста сцены: радиус переключился в один кадр в tArrive.
 * dt — шаг кадра (1/60 по умолчанию): кадр до прихода даёт rBefore, кадр прихода — rAfter.
 */
export function assertSnapAt(track: ScalarTrack, tArrive: number, rBefore: number, rAfter: number, dt = 1 / 60): void {
  const before = sampleScalar(track, tArrive - dt)
  const justBefore = sampleScalar(track, tArrive - OCTET_SNAP_EPS * 0.5)
  const at = sampleScalar(track, tArrive)
  const after = sampleScalar(track, tArrive + dt)
  const eq = (a: number, b: number) => Math.abs(a - b) < 1e-9
  if (!eq(before, rBefore) || !eq(justBefore, rBefore)) {
    throw new Error(`[valence] до прихода (${tArrive}) радиус ${before}, ожидался ${rBefore}`)
  }
  if (!eq(at, rAfter) || !eq(after, rAfter)) {
    throw new Error(`[valence] в кадр прихода (${tArrive}) радиус ${at}, ожидался ${rAfter}`)
  }
}
