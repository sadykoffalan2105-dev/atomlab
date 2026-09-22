import * as THREE from 'three'

/**
 * ATOMLAB Cinema — геометрический кернел молекул (VSEPR).
 *
 * Молекула описана в локальных координатах (центральный атом в нуле),
 * а на сцену ставится жёстко: origin + кватернион. Один и тот же атом
 * живёт от первого до последнего кадра — «клонов» на смене фазы не бывает,
 * потому что позиция всегда пересчитывается из origin/угла, а не подменяется.
 */

const DEG = Math.PI / 180

const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _v = new THREE.Vector3()
const _v2 = new THREE.Vector3()

/** Уголковая AX₂E-геометрия: два лиганда симметрично вокруг +Z. */
export type BentFrame = {
  center: THREE.Vector3
  l0: THREE.Vector3
  l1: THREE.Vector3
}

export function createBentFrame(): BentFrame {
  return { center: new THREE.Vector3(), l0: new THREE.Vector3(), l1: new THREE.Vector3() }
}

/**
 * Ставит уголковую молекулу в мир.
 * @param angleDeg валентный угол L–X–L (117.4° для ClO₂, 104.5° для H₂O)
 * @param bond длина связи X–L в мировых единицах
 * @param yaw поворот вокруг мирового Y
 * @param pitch наклон вокруг локального X (даёт объём, «не плоская схема»)
 * @param roll крен вокруг локального Z
 */
export function writeBent(
  out: BentFrame,
  origin: THREE.Vector3,
  angleDeg: number,
  bond: number,
  yaw = 0,
  pitch = 0,
  roll = 0,
): BentFrame {
  const half = angleDeg * 0.5 * DEG
  const sx = Math.sin(half) * bond
  const cz = Math.cos(half) * bond

  _e.set(pitch, yaw, roll, 'YXZ')
  _q.setFromEuler(_e)

  out.center.copy(origin)
  out.l0.set(sx, 0, cz).applyQuaternion(_q).add(origin)
  out.l1.set(-sx, 0, cz).applyQuaternion(_q).add(origin)
  return out
}

/** Линейная AX₂-геометрия (CO₂): лиганды на 180°. */
export function writeLinear(
  out: BentFrame,
  origin: THREE.Vector3,
  bond: number,
  yaw = 0,
  pitch = 0,
): BentFrame {
  _e.set(pitch, yaw, 0, 'YXZ')
  _q.setFromEuler(_e)
  out.center.copy(origin)
  out.l0.set(bond, 0, 0).applyQuaternion(_q).add(origin)
  out.l1.set(-bond, 0, 0).applyQuaternion(_q).add(origin)
  return out
}

/** Единичные направления идеального тетраэдра — угол между любыми двумя 109.47°. */
export const TETRAHEDRAL_DIRS: ReadonlyArray<readonly [number, number, number]> = [
  [0.5773502692, 0.5773502692, 0.5773502692],
  [0.5773502692, -0.5773502692, -0.5773502692],
  [-0.5773502692, 0.5773502692, -0.5773502692],
  [-0.5773502692, -0.5773502692, 0.5773502692],
]

export function writeTetrahedral(
  out: THREE.Vector3[],
  origin: THREE.Vector3,
  bond: number,
  yaw = 0,
  pitch = 0,
): void {
  _e.set(pitch, yaw, 0, 'YXZ')
  _q.setFromEuler(_e)
  for (let i = 0; i < 4 && i < out.length; i++) {
    const d = TETRAHEDRAL_DIRS[i]!
    out[i]!.set(d[0] * bond, d[1] * bond, d[2] * bond).applyQuaternion(_q).add(origin)
  }
}

/**
 * Ставит два атома на общей оси на заданном расстоянии — двухатомная молекула
 * (Cl₂) или ионная пара (Na⁺Cl⁻). `axis` не обязан быть нормирован.
 */
export function writeDiatomic(
  a: THREE.Vector3,
  b: THREE.Vector3,
  center: THREE.Vector3,
  bond: number,
  axis: THREE.Vector3,
): void {
  _v.copy(axis)
  if (_v.lengthSq() < 1e-10) _v.set(0, 1, 0)
  else _v.normalize()
  a.copy(center).addScaledVector(_v, bond * 0.5)
  b.copy(center).addScaledVector(_v, -bond * 0.5)
}

/** Фактический угол L–X–L (градусы) — для тестов и отладочного HUD. */
export function measureAngle(l0: THREE.Vector3, center: THREE.Vector3, l1: THREE.Vector3): number {
  const ax = _v.copy(l0).sub(center)
  const bx = _v2.copy(l1).sub(center)
  const denom = ax.length() * bx.length()
  if (denom < 1e-10) return 0
  return Math.acos(THREE.MathUtils.clamp(ax.dot(bx) / denom, -1, 1)) / DEG
}

// ─────────────────────────────────────────────────────────────────────────────
// Плоский треугольник, двугранный угол, мостик X–O–X. Все числа (длины, углы) —
// АРГУМЕНТЫ: сцена берёт их из src/chemistry/data/bondData.ts, здесь только геометрия.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Плоская треугольная AX₃-геометрия (SO₃, D₃h): три лиганда в локальной
 * плоскости XZ через 120°, первый — вдоль +Z. out — минимум три вектора.
 */
export function writeTrigonalPlanar(
  out: THREE.Vector3[],
  origin: THREE.Vector3,
  bond: number,
  yaw = 0,
  pitch = 0,
  roll = 0,
): void {
  _e.set(pitch, yaw, roll, 'YXZ')
  _q.setFromEuler(_e)
  for (let i = 0; i < 3 && i < out.length; i++) {
    const a = (i * 2 * Math.PI) / 3
    out[i]!.set(Math.sin(a) * bond, 0, Math.cos(a) * bond).applyQuaternion(_q).add(origin)
  }
}

const _bc = new THREE.Vector3()
const _ab = new THREE.Vector3()
const _n = new THREE.Vector3()
const _m = new THREE.Vector3()

/**
 * Четвёртый атом цепочки a–b–c–d по внутренним координатам (метод NeRF):
 * |cd| = lenCD, ∠b–c–d = angleBCD (градусы), двугранный угол a–b–c–d = dihedralDeg
 * (IUPAC: положительный — по часовой при взгляде вдоль b→c). Для H₂O₂:
 * a = H, b = O, c = O, d = H. Пишет в d; a, b, c не трогает. Без аллокаций.
 */
export function writeDihedral(
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
  d: THREE.Vector3,
  lenCD: number,
  angleBCD: number,
  dihedralDeg: number,
): THREE.Vector3 {
  _bc.copy(c).sub(b)
  if (_bc.lengthSq() < 1e-12) _bc.set(1, 0, 0)
  _bc.normalize()
  _ab.copy(b).sub(a)
  _n.copy(_ab).cross(_bc)
  if (_n.lengthSq() < 1e-12) {
    // a, b, c на одной прямой — плоскость отсчёта любая, перпендикулярная оси.
    _n.set(0, 1, 0).cross(_bc)
    if (_n.lengthSq() < 1e-12) _n.set(0, 0, 1).cross(_bc)
  }
  _n.normalize()
  _m.copy(_n).cross(_bc)
  const th = angleBCD * DEG
  const ph = dihedralDeg * DEG
  const x = -Math.cos(th)
  const y = Math.sin(th) * Math.cos(ph)
  const z = Math.sin(th) * Math.sin(ph)
  return d
    .copy(c)
    .addScaledVector(_bc, x * lenCD)
    .addScaledVector(_m, y * lenCD)
    .addScaledVector(_n, z * lenCD)
}

/** Двугранный угол a–b–c–d, градусы (−180…180) — для тестов и проверки раскадровки. */
export function measureDihedral(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3): number {
  const b1x = b.x - a.x, b1y = b.y - a.y, b1z = b.z - a.z
  const b2x = c.x - b.x, b2y = c.y - b.y, b2z = c.z - b.z
  const b3x = d.x - c.x, b3y = d.y - c.y, b3z = d.z - c.z
  // n1 = b1 × b2, n2 = b2 × b3
  const n1x = b1y * b2z - b1z * b2y, n1y = b1z * b2x - b1x * b2z, n1z = b1x * b2y - b1y * b2x
  const n2x = b2y * b3z - b2z * b3y, n2y = b2z * b3x - b2x * b3z, n2z = b2x * b3y - b2y * b3x
  const l2 = Math.hypot(b2x, b2y, b2z) || 1
  // m1 = n1 × b2/|b2|
  const m1x = (n1y * b2z - n1z * b2y) / l2, m1y = (n1z * b2x - n1x * b2z) / l2, m1z = (n1x * b2y - n1y * b2x) / l2
  const x = n1x * n2x + n1y * n2y + n1z * n2z
  const y = m1x * n2x + m1y * n2y + m1z * n2z
  return -Math.atan2(y, x) / DEG
}

/** Мостиковая молекула O₃X–O–XO₃ (Mn₂O₇, Cl₂O₇) или два тетраэдра SiO₄ по вершине. */
export type BridgedFrame = {
  /** мостиковый атом (O) */
  bridge: THREE.Vector3
  /** два центральных атома (Mn, Cl, Si) */
  x0: THREE.Vector3
  x1: THREE.Vector3
  /** концевые атомы у x0 и у x1 */
  t0: THREE.Vector3[]
  t1: THREE.Vector3[]
}

export function createBridgedFrame(termCount = 3): BridgedFrame {
  const mk = () => Array.from({ length: termCount }, () => new THREE.Vector3())
  return { bridge: new THREE.Vector3(), x0: new THREE.Vector3(), x1: new THREE.Vector3(), t0: mk(), t1: mk() }
}

/** Идеальный тетраэдрический угол, ° — умолчание для угла между концевыми связями. */
export const TETRAHEDRAL_ANGLE_DEG = 109.4712206

const _u = new THREE.Vector3()
const _p1 = new THREE.Vector3()
const _p2 = new THREE.Vector3()

/**
 * Ставит мостиковую молекулу: мостик в `center`, ∠X–O–X = angleXOXDeg (в локальной
 * плоскости XY, симметрично вокруг −Y), |X–O| = lenBridge, концевые атомы на
 * расстоянии termLen симметрично вокруг оси O→X с углом между концевыми связями
 * termTermAngleDeg (Cl₂O₇: ∠O–Cl–O). twistDeg поворачивает тройку у x1
 * относительно x0 (конформация); у x0 одна концевая связь лежит в плоскости
 * мостика (заслонённая к мостику при twist 0 — выбирает сцена по данным).
 */
export function writeBridged(
  out: BridgedFrame,
  center: THREE.Vector3,
  lenBridge: number,
  angleXOXDeg: number,
  termLen: number,
  termTermAngleDeg = TETRAHEDRAL_ANGLE_DEG,
  twistDeg = 0,
  yaw = 0,
  pitch = 0,
  roll = 0,
): BridgedFrame {
  _e.set(pitch, yaw, roll, 'YXZ')
  _q.setFromEuler(_e)
  const half = angleXOXDeg * 0.5 * DEG
  out.bridge.copy(center)
  out.x0.set(Math.sin(half) * lenBridge, -Math.cos(half) * lenBridge, 0).applyQuaternion(_q).add(center)
  out.x1.set(-Math.sin(half) * lenBridge, -Math.cos(half) * lenBridge, 0).applyQuaternion(_q).add(center)
  // Полярный угол концевых связей от оси u = (X − O): cos α = cos²β − ½ sin²β (три связи через 120°).
  const cosA = Math.cos(termTermAngleDeg * DEG)
  const cos2b = (cosA + 0.5) / 1.5
  const beta = Math.acos(Math.sqrt(THREE.MathUtils.clamp(cos2b, 0, 1)))
  writeBridgeTerminals(out.t0, out.x0, out.bridge, termLen, beta, 0)
  writeBridgeTerminals(out.t1, out.x1, out.bridge, termLen, beta, twistDeg * DEG + Math.PI)
  return out
}

function writeBridgeTerminals(
  out: THREE.Vector3[],
  x: THREE.Vector3,
  bridge: THREE.Vector3,
  len: number,
  beta: number,
  phase: number,
): void {
  _u.copy(x).sub(bridge).normalize()
  // Базис ⟂ u: p1 — в плоскости мостика (через нормаль плоскости рига), p2 = u × p1.
  _p2.set(0, 0, 1).applyQuaternion(_q)
  _p1.copy(_p2).cross(_u)
  if (_p1.lengthSq() < 1e-10) _p1.set(1, 0, 0)
  _p1.normalize()
  _p2.copy(_u).cross(_p1)
  const n = out.length
  for (let k = 0; k < n; k++) {
    const az = phase + (k * 2 * Math.PI) / Math.max(1, n)
    const cb = Math.cos(beta)
    const sb = Math.sin(beta)
    out[k]!
      .copy(x)
      .addScaledVector(_u, cb * len)
      .addScaledVector(_p1, sb * Math.cos(az) * len)
      .addScaledVector(_p2, sb * Math.sin(az) * len)
  }
}
