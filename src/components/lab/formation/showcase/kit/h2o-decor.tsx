/**
 * Декорации сцены H₂O (только для showcase/scenes/h2o.tsx): маленькие молекулы в школьном стиле (матовые шары +
 * серые палочки, одна геометрия на тип, instanced) и пунктир водородных связей O···H. Всё — функции времени t:
 * раскладку возвращает layout(t) (перемотка безопасна, состояния между кадрами нет).
 *
 *  • DecorH2 — вторая молекула H₂ (честная стехиометрия 2H₂ + O₂): два шара H и палочка; pos(t) каждого атома, k(t).
 *  • DecorWaters — n молекул воды: O, H, H и две палочки на молекулу; layout(t) → массив {o, h1, h2}; k(t) — общая
 *    прозрачность; поверх — пунктир водородных связей hb(t) → пары [H, O].
 */
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { V3 } from '../../../hero/schoolHeroModel'
import { createSchoolMatteMaterial, schoolAtomColor, schoolSphereGeometry, schoolStickGeometry } from '../../../hero/schoolHeroStyle'
import { clamp01 } from '../../formationStory'
import { useClockCtx, type PFn, type TFn } from './core'

const _m = new THREE.Matrix4()
const _p = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _s = new THREE.Vector3()
const _a = new THREE.Vector3()
const _b = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)
const STICK_COLOR = '#9aa3b2'

/** Матрица палочки между a и b (цилиндр по оси Y длиной 1, радиус 1). */
function stickMatrix(a: V3, b: V3, r: number, out: THREE.Matrix4): THREE.Matrix4 {
  _a.set(a[0], a[1], a[2])
  _b.set(b[0], b[1], b[2])
  _p.copy(_a).add(_b).multiplyScalar(0.5)
  _b.sub(_a)
  const L = _b.length() || 1e-6
  _b.divideScalar(L)
  _q.setFromUnitVectors(_up, _b)
  return out.compose(_p, _q, _s.set(r, L, r))
}

/** Вторая молекула H₂ (декорация): шары H по pos(t), палочка между ними видна с яркостью stick(t) (0 — разорвана). */
export function DecorH2({ h1, h2, rH, rStick, k, stick, lowPower }: { h1: PFn; h2: PFn; rH: number; rStick: number; k: TFn; stick: TFn; lowPower: boolean }) {
  const clock = useClockCtx()
  const res = useMemo(() => {
    const mat = createSchoolMatteMaterial()
    mat.transparent = true
    mat.opacity = 0
    const balls = new THREE.InstancedMesh(schoolSphereGeometry(lowPower), mat, 2)
    balls.frustumCulled = false
    const c = schoolAtomColor('H')
    balls.setColorAt(0, c)
    balls.setColorAt(1, c)
    const smat = createSchoolMatteMaterial(STICK_COLOR)
    smat.transparent = true
    smat.opacity = 0
    const bar = new THREE.Mesh(schoolStickGeometry(), smat)
    bar.frustumCulled = false
    return { mat, balls, smat, bar }
  }, [lowPower])
  useFrame(() => {
    const t = clock()
    const kk = clamp01(k(t))
    res.balls.visible = kk > 0.01
    res.mat.opacity = kk
    if (!res.balls.visible) {
      res.bar.visible = false
      return
    }
    const A = h1(t)
    const B = h2(t)
    _m.compose(_p.set(A[0], A[1], A[2]), _q.identity(), _s.setScalar(rH))
    res.balls.setMatrixAt(0, _m)
    _m.compose(_p.set(B[0], B[1], B[2]), _q.identity(), _s.setScalar(rH))
    res.balls.setMatrixAt(1, _m)
    res.balls.instanceMatrix.needsUpdate = true
    const sk = clamp01(stick(t)) * kk
    res.bar.visible = sk > 0.01
    res.smat.opacity = sk
    if (res.bar.visible) stickMatrix(A, B, rStick, res.bar.matrix)
    res.bar.matrixAutoUpdate = false
  })
  return (
    <group>
      <primitive object={res.balls} />
      <primitive object={res.bar} />
    </group>
  )
}

export type WaterPose = { o: V3; h1: V3; h2: V3 }

/**
 * Молекулы воды-декорации: layout(t) — позы (длина массива постоянна = n), k(t) — общая яркость,
 * hb(t) — пунктир водородных связей: пары [от H, к O] (длина массива постоянна = nHb; пустые — одинаковые точки).
 */
export function DecorWaters({ n, nHb, layout, hb, k, kLines, rO, rH, rStick, lowPower, hbColor = '#a5f3fc' }: { n: number; nHb: number; layout: (t: number) => readonly WaterPose[]; hb?: (t: number) => readonly (readonly [V3, V3])[]; k: TFn; /** яркость пунктира (по умолчанию = k) */ kLines?: TFn; rO: number; rH: number; rStick: number; lowPower: boolean; hbColor?: string }) {
  const clock = useClockCtx()
  const res = useMemo(() => {
    const mat = createSchoolMatteMaterial()
    mat.transparent = true
    mat.opacity = 0
    const balls = new THREE.InstancedMesh(schoolSphereGeometry(lowPower), mat, n * 3)
    balls.frustumCulled = false
    const cO = schoolAtomColor('O')
    const cH = schoolAtomColor('H')
    for (let i = 0; i < n; i++) {
      balls.setColorAt(i * 3, cO)
      balls.setColorAt(i * 3 + 1, cH)
      balls.setColorAt(i * 3 + 2, cH)
    }
    const smat = createSchoolMatteMaterial(STICK_COLOR)
    smat.transparent = true
    smat.opacity = 0
    const sticks = new THREE.InstancedMesh(schoolStickGeometry(), smat, n * 2)
    sticks.frustumCulled = false
    const lgeo = new THREE.BufferGeometry()
    lgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(Math.max(1, nHb) * 6), 3))
    const lmat = new THREE.LineDashedMaterial({ color: hbColor, dashSize: 0.028, gapSize: 0.02, transparent: true, opacity: 0, depthWrite: false })
    const lines = new THREE.LineSegments(lgeo, lmat)
    lines.frustumCulled = false
    return { mat, balls, smat, sticks, lgeo, lmat, lines }
  }, [n, nHb, lowPower, hbColor])
  const last = useRef(-1)
  useFrame(() => {
    const t = clock()
    const kk = clamp01(k(t))
    const on = kk > 0.01
    res.balls.visible = on
    res.sticks.visible = on
    const kl = kLines ? clamp01(kLines(t)) : kk
    res.lines.visible = on && !!hb && kl > 0.01
    res.mat.opacity = kk
    res.smat.opacity = kk
    res.lmat.opacity = 0.85 * kl
    if (!on) return
    if (Math.abs(t - last.current) < 1e-4) return
    last.current = t
    const poses = layout(t)
    for (let i = 0; i < n; i++) {
      const w = poses[i]!
      _m.compose(_p.set(w.o[0], w.o[1], w.o[2]), _q.identity(), _s.setScalar(rO))
      res.balls.setMatrixAt(i * 3, _m)
      _m.compose(_p.set(w.h1[0], w.h1[1], w.h1[2]), _q.identity(), _s.setScalar(rH))
      res.balls.setMatrixAt(i * 3 + 1, _m)
      _m.compose(_p.set(w.h2[0], w.h2[1], w.h2[2]), _q.identity(), _s.setScalar(rH))
      res.balls.setMatrixAt(i * 3 + 2, _m)
      res.sticks.setMatrixAt(i * 2, stickMatrix(w.o, w.h1, rStick, _m))
      res.sticks.setMatrixAt(i * 2 + 1, stickMatrix(w.o, w.h2, rStick, _m))
    }
    res.balls.instanceMatrix.needsUpdate = true
    res.sticks.instanceMatrix.needsUpdate = true
    if (hb) {
      const pairs = hb(t)
      const arr = (res.lgeo.getAttribute('position') as THREE.BufferAttribute).array as Float32Array
      for (let i = 0; i < nHb; i++) {
        const pr = pairs[i]
        const A = pr ? pr[0] : ([0, 0, 0] as V3)
        const B = pr ? pr[1] : A
        arr[i * 6] = A[0]
        arr[i * 6 + 1] = A[1]
        arr[i * 6 + 2] = A[2]
        arr[i * 6 + 3] = B[0]
        arr[i * 6 + 4] = B[1]
        arr[i * 6 + 5] = B[2]
      }
      ;(res.lgeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
      res.lines.computeLineDistances()
    }
  })
  return (
    <group>
      <primitive object={res.balls} />
      <primitive object={res.sticks} />
      <primitive object={res.lines} />
    </group>
  )
}
