/**
 * Kit CO₂ — декорация финала «Как образуется»: соседние молекулы CO₂ вокруг модели карточки.
 *  • газ — молекулы хаотично летают и крутятся (разные ориентации);
 *  • «сухой лёд» — молекулы занимают узлы молекулярной кристаллической решётки: гранецентрированная кубическая
 *    ячейка (a = 5,62 Å), модель карточки — узел в центре передней грани, остальные 13 узлов (8 углов + 5 центров
 *    граней) — декорация; рёбра ячейки — линии.
 * Один InstancedMesh шаров (3N), один — палочек (4N), один LineSegments рёбер: 3 draw calls. Всё — функции t сценария
 * (перемотка без «застрявшего» состояния). Модель карточки остаётся на месте — к концу показа видна одна.
 */
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { SCHOOL_STICK_HEX, createSchoolMatteMaterial, schoolAtomColor, schoolSphereGeometry, schoolStickGeometry } from '../../../hero/schoolHeroStyle'
import { clamp01, easeInOut } from '../../formationStory'
import { useClockCtx } from './core'

/** Узлы ГЦК-ячейки в единицах a/2 (целые тройки с чётной суммой); (0,0,0) — модель карточки, ячейка — за ней (z ≤ 0). */
const NODES: [number, number, number][] = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 1, -2], [-1, 1, -2], [1, -1, -2], [-1, -1, -2],
  [0, 0, -2], [1, 0, -1], [-1, 0, -1], [0, 1, -1], [0, -1, -1],
]
const N = NODES.length

/** Детерминированный «шум» 0…1. */
const hash = (i: number, s: number) => {
  const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453
  return x - Math.floor(x)
}

export type CO2GasProps = {
  /** радиусы шаров и d(C=O) — как у модели карточки (единицы модели) */
  rC: number
  rO: number
  dCO: number
  /** параметр ячейки a (единицы модели) */
  a: number
  /** палочки: радиус и шаг двойной связи (единицы модели) */
  stickR: number
  stickStep: number
  /** появление/исчезновение 0…1 */
  k: (t: number) => number
  /** 0 — газ (хаос), 1 — узлы решётки */
  lattice: (t: number) => number
  /** яркость рёбер ячейки 0…1 */
  edges: (t: number) => number
  lowPower: boolean
}

export function CO2Gas({ rC, rO, dCO, a, stickR, stickStep, k, lattice, edges, lowPower }: CO2GasProps) {
  const clock = useClockCtx()
  const res = useMemo(() => {
    const atomMat = createSchoolMatteMaterial()
    const stickMat = createSchoolMatteMaterial(SCHOOL_STICK_HEX.dark)
    const atoms = new THREE.InstancedMesh(schoolSphereGeometry(lowPower), atomMat, 3 * N)
    const sticks = new THREE.InstancedMesh(schoolStickGeometry(), stickMat, 4 * N)
    atoms.frustumCulled = false
    sticks.frustumCulled = false
    const cC = schoolAtomColor('C')
    const cO = schoolAtomColor('O')
    for (let i = 0; i < N; i++) {
      atoms.setColorAt(3 * i, cC)
      atoms.setColorAt(3 * i + 1, cO)
      atoms.setColorAt(3 * i + 2, cO)
    }
    if (atoms.instanceColor) atoms.instanceColor.needsUpdate = true
    // рёбра ячейки: куб [−a/2, a/2]² × [−a, 0]
    const h = a / 2
    const c = [
      [-h, -h, 0], [h, -h, 0], [h, h, 0], [-h, h, 0],
      [-h, -h, -a], [h, -h, -a], [h, h, -a], [-h, h, -a],
    ]
    const E = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]
    const pts: number[] = []
    for (const [p, q] of E) pts.push(...c[p!]!, ...c[q!]!)
    const edgeGeo = new THREE.BufferGeometry()
    edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    const edgeMat = new THREE.LineBasicMaterial({ color: '#9fd3ff', transparent: true, opacity: 0 })
    const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat)
    // газ: базовые точки на сфере (спираль золотого угла), радиус 0,85…1,05 от центра
    const base: THREE.Vector3[] = []
    for (let i = 0; i < N; i++) {
      const y = 1 - (2 * (i + 0.5)) / N
      const rr = Math.sqrt(Math.max(0, 1 - y * y))
      const ph = i * 2.399963
      base.push(new THREE.Vector3(Math.cos(ph) * rr, y, Math.sin(ph) * rr).multiplyScalar(0.85 + 0.2 * hash(i, 1)))
    }
    return { atomMat, stickMat, atoms, sticks, edgeGeo, edgeMat, edgeLines, base }
  }, [a, lowPower])
  useEffect(() => () => {
    res.atomMat.dispose()
    res.stickMat.dispose()
    res.edgeGeo.dispose()
    res.edgeMat.dispose()
  }, [res])

  const tmp = useRef({
    M: new THREE.Matrix4(), L: new THREE.Matrix4(), q: new THREE.Quaternion(), qI: new THREE.Quaternion(), qS: new THREE.Quaternion(),
    e: new THREE.Euler(), p: new THREE.Vector3(), s: new THREE.Vector3(), o: new THREE.Vector3(), node: new THREE.Vector3(),
  })
  useFrame(() => {
    const t = clock()
    const K = clamp01(k(t))
    const vis = K > 0.003
    res.atoms.visible = vis
    res.sticks.visible = vis
    const eK = clamp01(edges(t)) * K
    res.edgeMat.opacity = 0.55 * eK
    res.edgeLines.visible = eK > 0.005
    if (!vis) return
    const U = easeInOut(lattice(t))
    const { M, L, q, qI, qS, e, p, s, o, node } = tmp.current
    qI.identity()
    qS.setFromAxisAngle(o.set(0, 0, 1), -Math.PI / 2) // цилиндр (ось Y) → вдоль X
    let ai = 0
    let si = 0
    for (let i = 0; i < N; i++) {
      // появление с разбросом по молекулам
      const sc = easeInOut((K - (0.45 * i) / N) / 0.55)
      // газ: дрейф вокруг базовой точки + вращение; решётка: узел, ориентация как у модели (вдоль x)
      const b = res.base[i]!
      const w = 0.35 + 0.25 * hash(i, 2)
      p.set(
        b.x + 0.09 * Math.sin(w * t + hash(i, 3) * 6.28),
        b.y + 0.09 * Math.sin(w * 0.8 * t + hash(i, 4) * 6.28),
        b.z + 0.09 * Math.sin(w * 1.1 * t + hash(i, 5) * 6.28),
      )
      const n = NODES[i]!
      node.set((n[0] * a) / 2, (n[1] * a) / 2, (n[2] * a) / 2)
      p.lerp(node, U)
      e.set(hash(i, 6) * 6.28 + 0.5 * t * (0.6 + hash(i, 7)), hash(i, 8) * 6.28 + 0.35 * t, hash(i, 9) * 6.28, 'XYZ')
      q.setFromEuler(e)
      q.slerp(qI, U)
      s.setScalar(Math.max(1e-4, sc))
      M.compose(p, q, s)
      // шары: C в центре, O по ±x
      for (let j = 0; j < 3; j++) {
        const x = j === 0 ? 0 : j === 1 ? dCO : -dCO
        const r = j === 0 ? rC : rO
        L.compose(o.set(x, 0, 0), qI, s.setScalar(r))
        res.atoms.setMatrixAt(ai++, L.premultiply(M))
      }
      // палочки: две связи × два штриха (двойная связь — поперёк по y)
      for (let side = -1; side <= 1; side += 2) {
        for (let slot = -1; slot <= 1; slot += 2) {
          L.compose(o.set((side * dCO) / 2, (slot * stickStep) / 2, 0), qS, s.set(stickR, dCO, stickR))
          res.sticks.setMatrixAt(si++, L.premultiply(M))
        }
      }
    }
    res.atoms.instanceMatrix.needsUpdate = true
    res.sticks.instanceMatrix.needsUpdate = true
  })
  return (
    <group>
      <primitive object={res.atoms} />
      <primitive object={res.sticks} />
      <primitive object={res.edgeLines} />
    </group>
  )
}
