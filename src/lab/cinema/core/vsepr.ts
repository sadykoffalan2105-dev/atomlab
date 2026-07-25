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
