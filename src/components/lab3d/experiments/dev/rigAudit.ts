/**
 * Аудит физики установки опыта (только для отладки: …#/vr-lab?debugLab=1 → window.__labRig.audit()).
 * Координаты — локальные координаты установки (верх стола y = 0). Проверяет по мешам сцены:
 *  • wall  — шланг / стеклянная трубка / палочка (тонкий цилиндр) проходит сквозь стенку стоящего сосуда ниже края;
 *  • table — осевая линия шланга или трубки ниже столешницы;
 *  • float — подвижный предмет (группа Pose) в покое висит в воздухе: под его низом нет ни стола, ни опоры
 *    (другого меша, чей вертикальный размах доходит до низа предмета и который перекрывает его по X и Z).
 * Грубо (по Box3 и осевым линиям), зато находит настоящие «висит» и «сквозь стекло».
 */
import * as THREE from 'three'
import { sharedGlass } from '../parts/glassware'

export interface RigAuditIssue {
  kind: 'wall' | 'table' | 'float'
  what: string
  detail: string
}

interface Vessel {
  x: number
  z: number
  r: number
  y0: number
  y1: number
  mesh: THREE.Mesh
}

interface Path {
  what: string
  r: number
  pts: THREE.Vector3[]
  mesh: THREE.Mesh
}

const f3 = (v: number) => v.toFixed(3)

function isGlass(m: THREE.Material | THREE.Material[]): boolean {
  const mat = Array.isArray(m) ? m[0] : m
  return mat === sharedGlass('high') || mat === sharedGlass('low')
}

function isHelper(m: THREE.Material | THREE.Material[]): boolean {
  const mat = Array.isArray(m) ? m[0] : m
  if (!mat) return true
  if (mat instanceof THREE.ShaderMaterial) return true
  if (mat instanceof THREE.MeshBasicMaterial) return true
  if (mat.transparent && mat.opacity < 0.05) return true
  return false
}

function targetName(o: THREE.Object3D): string | null {
  let found: string | null = null
  o.traverse((c) => {
    if (found) return
    const t = (c.userData as { labTarget?: string }).labTarget
    if (t) found = t
    else if (c.name.startsWith('target:')) found = c.name.slice(7)
  })
  return found
}

function label(o: THREE.Object3D): string {
  let a: THREE.Object3D | null = o
  while (a) {
    const t = targetName(a)
    if (t && (a.userData as { labPose?: boolean }).labPose) return t
    if ((a.userData as { labPose?: boolean }).labPose) {
      const t2 = targetName(a)
      return t2 ?? `pose(${(a.userData as { labPoseIdx?: number }).labPoseIdx ?? '?'})`
    }
    a = a.parent
  }
  return 'static'
}

function isDescendant(o: THREE.Object3D, anc: THREE.Object3D): boolean {
  let a: THREE.Object3D | null = o
  while (a) {
    if (a === anc) return true
    a = a.parent
  }
  return false
}

export function auditRig(root: THREE.Object3D): RigAuditIssue[] {
  root.updateWorldMatrix(true, true)
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert()
  const toRig = (m: THREE.Mesh) => new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)
  const meshes: THREE.Mesh[] = []
  const poses: THREE.Object3D[] = []
  let poseIdx = 0
  root.traverseVisible((o) => {
    if ((o.userData as { labPose?: boolean }).labPose) {
      o.userData.labPoseIdx = poseIdx++
      poses.push(o)
    }
    const m = o as THREE.Mesh
    if (!m.isMesh || !m.geometry || (m.userData as { labTarget?: string }).labTarget) return
    if (isHelper(m.material)) return
    meshes.push(m)
  })

  // сосуды: стоящие токарные (Lathe) детали из общего стекла
  const vessels: Vessel[] = []
  const paths: Path[] = []
  for (const m of meshes) {
    const g = m.geometry
    const M = toRig(m)
    const up = new THREE.Vector3().setFromMatrixColumn(M, 1)
    const sy = up.length()
    if (g instanceof THREE.LatheGeometry && isGlass(m.material)) {
      if (up.y / sy < 0.985) continue
      g.computeBoundingBox()
      const bb = g.boundingBox!
      // радиус корпуса — наибольший у вершин ниже отогнутого края (у токарной детали вершины только в точках профиля)
      let r = 0
      const pos = g.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < pos.count; i++) {
        if (pos.getY(i) < bb.max.y - 0.004) r = Math.max(r, Math.hypot(pos.getX(i), pos.getZ(i)))
      }
      const sx = new THREE.Vector3().setFromMatrixColumn(M, 0).length()
      const c = new THREE.Vector3(0, 0, 0).applyMatrix4(M)
      const lo = new THREE.Vector3(0, bb.min.y, 0).applyMatrix4(M)
      const hi = new THREE.Vector3(0, bb.max.y, 0).applyMatrix4(M)
      if (r * sx > 0.004 && hi.y - lo.y > 0.02) vessels.push({ x: c.x, z: c.z, r: r * sx, y0: lo.y, y1: hi.y, mesh: m })
      continue
    }
    if (g instanceof THREE.TubeGeometry) {
      const prm = g.parameters as { path: THREE.Curve<THREE.Vector3>; radius: number }
      const what = (m.userData as { labHose?: boolean }).labHose ? 'шланг' : isGlass(m.material) ? `стеклянная трубка [${label(m)}]` : ''
      if (!what || prm.radius < 0.0015) continue
      const pts = prm.path.getSpacedPoints(80).map((v) => v.clone().applyMatrix4(M))
      paths.push({ what, r: prm.radius * Math.cbrt(Math.abs(M.determinant())), pts, mesh: m })
      continue
    }
    if (g instanceof THREE.CylinderGeometry) {
      const prm = g.parameters
      const rr = Math.max(prm.radiusTop, prm.radiusBottom)
      // тонкие длинные цилиндры: палочки, пипетки, лучины, спички, термометры, стержни лапок
      if (rr > 0.0045 || prm.height < 0.04) continue
      const a = new THREE.Vector3(0, -prm.height / 2, 0).applyMatrix4(M)
      const b = new THREE.Vector3(0, prm.height / 2, 0).applyMatrix4(M)
      const pts = Array.from({ length: 41 }, (_, i) => a.clone().lerp(b, i / 40))
      paths.push({ what: `стержень [${label(m)}]`, r: rr * Math.cbrt(Math.abs(M.determinant())), pts, mesh: m })
    }
  }

  const issues: RigAuditIssue[] = []
  const seen = new Set<string>()
  const push = (i: RigAuditIssue) => {
    const k = `${i.kind}|${i.what}|${i.detail.slice(0, 30)}`
    if (seen.has(k)) return
    seen.add(k)
    issues.push(i)
  }

  for (const pth of paths) {
    for (const v of vessels) {
      if (v.mesh === pth.mesh) continue
      for (let i = 0; i < pth.pts.length; i++) {
        const a = pth.pts[i]!
        const ra = Math.hypot(a.x - v.x, a.z - v.z)
        // касание / заход в стенку ниже края
        if (a.y > v.y0 + 0.002 && a.y < v.y1 - 0.004 && Math.abs(ra - v.r) < pth.r * 0.8) {
          push({ kind: 'wall', what: pth.what, detail: `касается стенки сосуда (${f3(v.x)}, ${f3(v.z)}) на y=${f3(a.y)}` })
          break
        }
        const b = pth.pts[i + 1]
        if (!b) continue
        const rb = Math.hypot(b.x - v.x, b.z - v.z)
        if ((ra - v.r) * (rb - v.r) < 0) {
          const t = (v.r - ra) / (rb - ra)
          const y = a.y + (b.y - a.y) * t
          if (y > v.y0 + 0.002 && y < v.y1 - 0.004) {
            push({ kind: 'wall', what: pth.what, detail: `проходит сквозь стенку сосуда (${f3(v.x)}, ${f3(v.z)}) на y=${f3(y)}` })
            break
          }
        }
      }
    }
    const low = pth.pts.reduce((m, v) => Math.min(m, v.y), Infinity)
    if (low < pth.r - 0.0015) push({ kind: 'table', what: pth.what, detail: `ось ниже столешницы: y=${f3(low)}` })
  }

  // висит ли подвижный предмет: опора под его низом
  const boxes = meshes.map((m) => ({ m, b: new THREE.Box3().setFromObject(m).applyMatrix4(inv) }))
  for (const pose of poses) {
    const own = boxes.filter((x) => isDescendant(x.m, pose))
    if (!own.length) continue
    const bb = new THREE.Box3()
    for (const x of own) bb.union(x.b)
    const bottom = bb.min.y
    if (bottom <= 0.003) continue
    // предмет в руке ученика (видна кисть GripHand) — опора есть
    let held = false
    pose.traverseVisible((o) => {
      if ((o.userData as { labHand?: boolean }).labHand) held = true
    })
    if (held) continue
    const ok = boxes.some(({ m, b }) => {
      if (isDescendant(m, pose)) return false
      if (b.max.x < bb.min.x - 0.003 || b.min.x > bb.max.x + 0.003) return false
      if (b.max.z < bb.min.z - 0.003 || b.min.z > bb.max.z + 0.003) return false
      return b.min.y - 0.003 <= bottom && b.max.y + 0.003 >= bottom
    })
    if (!ok) {
      const c = bb.getCenter(new THREE.Vector3())
      push({ kind: 'float', what: label(own[0]!.m), detail: `висит: низ y=${f3(bottom)}, центр (${f3(c.x)}, ${f3(c.y)}, ${f3(c.z)})` })
    }
  }
  return issues
}

/**
 * Проверка самого детектора: временный «шланг» сквозь боковую стенку первой стоящей пробирки и временный
 * предмет в воздухе — аудит обязан найти оба (иначе «0 проблем» ничего не значит).
 */
export function auditSelfTest(root: THREE.Object3D): { wall: boolean; float: boolean } {
  let tube: THREE.Mesh | null = null
  root.traverseVisible((o) => {
    const m = o as THREE.Mesh
    if (!tube && m.isMesh && m.geometry instanceof THREE.LatheGeometry && isGlass(m.material)) tube = m
  })
  if (!tube) return { wall: false, float: false }
  const t = tube as THREE.Mesh
  root.updateWorldMatrix(true, true)
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert()
  const c = new THREE.Vector3(0, 0.06, 0).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, t.matrixWorld))
  const path = new THREE.LineCurve3(new THREE.Vector3(c.x - 0.06, c.y, c.z), new THREE.Vector3(c.x, c.y, c.z))
  const hose = new THREE.Mesh(new THREE.TubeGeometry(path, 8, 0.004, 6, false), new THREE.MeshStandardMaterial())
  hose.userData.labHose = true
  const floater = new THREE.Group()
  floater.userData.labPose = true
  floater.position.set(c.x + 0.3, 0.3, c.z + 0.3)
  floater.add(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.02), new THREE.MeshStandardMaterial()))
  root.add(hose, floater)
  const found = auditRig(root)
  root.remove(hose, floater)
  return { wall: found.some((f) => f.kind === 'wall' && f.what === 'шланг'), float: found.some((f) => f.kind === 'float') }
}

export interface RigOrientationIssue {
  kind: 'orientation'
  what: string
  detail: string
}

/**
 * Ориентация пробирок: группа с userData.labOrientation ('mouthUp' | 'mouthDown') и диапазоном прогресса
 * labOrientationRange — локальная ось +Y группы (от дна к отверстию) в мире должна смотреть вверх или вниз.
 * Приёмник газа легче воздуха (H₂, NH₃) — дном вверх; пробирка со смесью NH₄Cl + Ca(OH)₂ — отверстием чуть вниз.
 */
export function auditOrientation(root: THREE.Object3D, p: number): RigOrientationIssue[] {
  const out: RigOrientationIssue[] = []
  root.updateWorldMatrix(true, true)
  const axis = new THREE.Vector3()
  const q = new THREE.Quaternion()
  root.traverse((o) => {
    const u = o.userData as { labOrientation?: 'mouthUp' | 'mouthDown'; labOrientationRange?: readonly [number, number] }
    if (!u.labOrientation) return
    const r = u.labOrientationRange
    if (r && (p < r[0] || p > r[1])) return
    o.getWorldQuaternion(q)
    axis.set(0, 1, 0).applyQuaternion(q)
    const ok = u.labOrientation === 'mouthDown' ? axis.y < -0.05 : axis.y > 0.05
    if (!ok) out.push({ kind: 'orientation', what: o.parent?.name || o.name || 'пробирка', detail: `ждём ${u.labOrientation}, ось Y = ${axis.y.toFixed(2)} при p = ${p.toFixed(2)}` })
  })
  return out
}
