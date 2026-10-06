/**
 * Органика v2 — 3D-сцена молекулы по точным координатам RDKit (atoms[].p; геометрия в браузере не пересчитывается,
 * только жёсткий поворот для удобного ракурса и вращение вокруг одинарной связи по просьбе ученика).
 *
 * Стили: шары-стержни (кратные связи — 2/3 стержня в плоскости σ-скелета, ароматика — пунктир к центру кольца),
 * объём (Ван-дер-Ваальс), каркас. Атомы и связи — по одному InstancedMesh (2 вызова отрисовки на всю молекулу).
 * Слои: гибридизация (тетраэдр sp³, треугольник sp², ось sp) + π-облака, функциональные группы, δ+/δ−, степень C.
 * Инструменты: линейка (2 атома — Å, 3 — угол с дугой), вращение связи C–C + проекция Ньюмена и энергия.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { Molecule3DProps } from './contracts'
import type { OV2Molecule } from '../../data/organicV2/types'
import {
  add,
  angleDeg,
  atomCaption,
  ballRadius,
  boundingRadius,
  cpkColor,
  cross,
  dist,
  dot,
  fitDistance,
  fitDistanceBox,
  fitDistancePoints,
  halfExtents,
  isRotatable,
  len,
  neighbors,
  newmanProjection,
  norm,
  orientForScreen,
  piNormal,
  rotateAround,
  scale,
  sideOf,
  sub,
  vdwRadius,
  type V3,
} from './viewer/molMath'
import { GROUP_COLOR, GROUP_SHORT, VIEWER_T } from './viewer/i18n'
import { NewmanPanel } from './viewer/NewmanPanel'
import styles from './viewer/Molecule3D.module.css'
import { safeCanvasEvents } from './safeCanvasEvents'

const FOV = 38
const UP = new THREE.Vector3(0, 1, 0)

interface Seg {
  readonly a: V3
  readonly b: V3
  readonly r: number
  readonly color: string
  readonly bond: number
}

const isPhone = () => typeof window !== 'undefined' && window.matchMedia?.('(max-width: 760px)').matches

// ───────────────────────── геометрия связей ─────────────────────────

function buildSegments(mol: OV2Molecule, pos: readonly V3[], adj: readonly (readonly number[])[], style: Molecule3DProps['style'], colorOf: (i: number) => string): Seg[] {
  if (style === 'spaceFill') return []
  const wire = style === 'wire'
  const out: Seg[] = []
  const ringCenter = (a: number, b: number): V3 | null => {
    const ring = mol.rings.find((r) => r.includes(a) && r.includes(b))
    if (!ring) return null
    const c: V3 = [0, 0, 0]
    for (const k of ring) for (let d = 0; d < 3; d++) c[d] += pos[k][d] / ring.length
    return c
  }
  mol.bonds.forEach((bd, bi) => {
    const pa = pos[bd.a]
    const pb = pos[bd.b]
    const mid = scale(add(pa, pb), 0.5)
    const half = (off: V3, r: number, shrink = 0) => {
      const u = norm(sub(pb, pa))
      const L = dist(pa, pb)
      const s0 = add(add(pa, off), scale(u, shrink * L))
      const s1 = add(add(pb, off), scale(u, -shrink * L))
      const m = add(mid, off)
      const ca = colorOf(bd.a)
      const cb = colorOf(bd.b)
      if (ca === cb) out.push({ a: s0, b: s1, r, color: ca, bond: bi })
      else {
        out.push({ a: s0, b: m, r, color: ca, bond: bi })
        out.push({ a: m, b: s1, r, color: cb, bond: bi })
      }
    }
    const base = wire ? 0.055 : 0.12
    if (bd.ar) {
      half([0, 0, 0], base)
      const c = ringCenter(bd.a, bd.b)
      if (c) {
        const toC = sub(c, mid)
        const off = scale(norm(toC), Math.min(0.32, len(toC) * 0.3))
        // пунктир делокализованной связи: 3 коротких отрезка
        const u = norm(sub(pb, pa))
        const L = dist(pa, pb)
        for (let k = 0; k < 3; k++) {
          const t0 = 0.22 + k * 0.2
          const s0 = add(add(pa, off), scale(u, t0 * L))
          const s1 = add(add(pa, off), scale(u, (t0 + 0.12) * L))
          out.push({ a: s0, b: s1, r: base * 0.5, color: '#a5b4fc', bond: bi })
        }
      }
      return
    }
    if (bd.o === 1) {
      half([0, 0, 0], base)
      return
    }
    const axis = norm(sub(pb, pa))
    const n = piNormal(pos, adj, bd.a, bd.b)
    const inPlane = norm(cross(n, axis))
    if (bd.o === 2) {
      const d = wire ? 0.09 : 0.13
      half(scale(inPlane, d), base * 0.68)
      half(scale(inPlane, -d), base * 0.68)
      return
    }
    const d = wire ? 0.1 : 0.15
    half([0, 0, 0], base * 0.58)
    half(scale(inPlane, d), base * 0.58)
    half(scale(inPlane, -d), base * 0.58)
  })
  return out
}

// ───────────────────────── инстансы ─────────────────────────

const tmpM = new THREE.Matrix4()
const tmpQ = new THREE.Quaternion()
const tmpV = new THREE.Vector3()
const tmpS = new THREE.Vector3()
const tmpC = new THREE.Color()

function AtomsMesh(props: {
  pos: readonly V3[]
  radii: readonly number[]
  colors: readonly string[]
  seg: number
  onPick?: (i: number, e: ThreeEvent<MouseEvent>) => void
  glossy: boolean
}) {
  const { pos, radii, colors, seg, onPick, glossy } = props
  const ref = useRef<THREE.InstancedMesh>(null)
  const invalidate = useThree((s) => s.invalidate)
  const geo = useMemo(() => new THREE.SphereGeometry(1, seg, Math.max(8, Math.round(seg * 0.7))), [seg])
  useEffect(() => () => geo.dispose(), [geo])
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    pos.forEach((p, i) => {
      tmpV.set(p[0], p[1], p[2])
      tmpS.setScalar(radii[i])
      tmpM.compose(tmpV, tmpQ.identity(), tmpS)
      m.setMatrixAt(i, tmpM)
      m.setColorAt(i, tmpC.set(colors[i]))
    })
    m.count = pos.length
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.computeBoundingSphere()
    invalidate()
  }, [pos, radii, colors, invalidate])
  return (
    <instancedMesh
      ref={ref}
      args={[geo, undefined, pos.length]}
      onClick={
        onPick
          ? (e) => {
              if (e.delta > 6 || e.instanceId === undefined) return
              e.stopPropagation()
              onPick(e.instanceId, e)
            }
          : undefined
      }
    >
      {glossy ? (
        <meshPhysicalMaterial roughness={0.3} metalness={0.04} clearcoat={0.55} clearcoatRoughness={0.25} />
      ) : (
        <meshStandardMaterial roughness={0.38} metalness={0.05} />
      )}
    </instancedMesh>
  )
}

function SegmentsMesh(props: { segs: readonly Seg[]; radial: number; onPick?: (bond: number) => void; opacity?: number }) {
  const { segs, radial, onPick, opacity } = props
  const ref = useRef<THREE.InstancedMesh>(null)
  const invalidate = useThree((s) => s.invalidate)
  const geo = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, radial, 1, false), [radial])
  useEffect(() => () => geo.dispose(), [geo])
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    segs.forEach((s, i) => {
      const d = sub(s.b, s.a)
      const L = len(d)
      tmpV.set((s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2, (s.a[2] + s.b[2]) / 2)
      tmpQ.setFromUnitVectors(UP, new THREE.Vector3(d[0] / (L || 1), d[1] / (L || 1), d[2] / (L || 1)))
      tmpS.set(s.r, L, s.r)
      tmpM.compose(tmpV, tmpQ, tmpS)
      m.setMatrixAt(i, tmpM)
      m.setColorAt(i, tmpC.set(s.color))
    })
    m.count = segs.length
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.computeBoundingSphere()
    invalidate()
  }, [segs, invalidate])
  if (segs.length === 0) return null
  return (
    <instancedMesh
      ref={ref}
      args={[geo, undefined, segs.length]}
      onClick={
        onPick
          ? (e) => {
              if (e.delta > 6 || e.instanceId === undefined) return
              e.stopPropagation()
              onPick(segs[e.instanceId].bond)
            }
          : undefined
      }
    >
      <meshStandardMaterial roughness={0.42} metalness={0.05} transparent={opacity !== undefined} opacity={opacity ?? 1} depthWrite={opacity === undefined} />
    </instancedMesh>
  )
}

interface Blob {
  readonly p: V3
  /** полуоси эллипсоида (или радиус) */
  readonly s: V3
  /** куда смотрит ось X эллипсоида (единичный вектор) и ось Y */
  readonly ax?: V3
  readonly ay?: V3
  readonly color: string
}

/** Полупрозрачные шары/эллипсоиды (ореолы групп, π-облака, подсветка). */
function BlobsMesh({ blobs, opacity, seg }: { blobs: readonly Blob[]; opacity: number; seg: number }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const invalidate = useThree((s) => s.invalidate)
  const geo = useMemo(() => new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7)), [seg])
  useEffect(() => () => geo.dispose(), [geo])
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const rot = new THREE.Matrix4()
    blobs.forEach((b, i) => {
      if (b.ax && b.ay) {
        const az = cross(b.ax, b.ay)
        rot.makeBasis(new THREE.Vector3(...b.ax), new THREE.Vector3(...b.ay), new THREE.Vector3(...az))
        tmpQ.setFromRotationMatrix(rot)
      } else tmpQ.identity()
      tmpV.set(b.p[0], b.p[1], b.p[2])
      tmpS.set(b.s[0], b.s[1], b.s[2])
      tmpM.compose(tmpV, tmpQ, tmpS)
      m.setMatrixAt(i, tmpM)
      m.setColorAt(i, tmpC.set(b.color))
    })
    m.count = blobs.length
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    invalidate()
  }, [blobs, invalidate])
  if (blobs.length === 0) return null
  return (
    <instancedMesh ref={ref} args={[geo, undefined, blobs.length]} renderOrder={2}>
      <meshStandardMaterial transparent opacity={opacity} depthWrite={false} roughness={0.6} emissive="#223" side={THREE.FrontSide} />
    </instancedMesh>
  )
}

// ───────────────────────── слой «гибридизация» ─────────────────────────

const HYB_COLOR = { sp3: '#2dd4bf', sp2: '#fbbf24', sp: '#f472b6' } as const

function HybridLayer({ mol, pos, adj, seg }: { mol: OV2Molecule; pos: readonly V3[]; adj: readonly (readonly number[])[]; seg: number }) {
  const { geometry, edges, axes, clouds, rings } = useMemo(() => {
    const verts: number[] = []
    const cols: number[] = []
    const edgeV: number[] = []
    const axisSegs: Seg[] = []
    const c = new THREE.Color()
    const tri = (p: V3, q: V3, r: V3, col: string) => {
      c.set(col)
      for (const v of [p, q, r]) {
        verts.push(v[0], v[1], v[2])
        cols.push(c.r, c.g, c.b)
      }
    }
    mol.atoms.forEach((a, i) => {
      if (a.el !== 'C') return
      const nb = adj[i]
      const vtx = nb.map((j) => add(pos[i], scale(sub(pos[j], pos[i]), 0.66)))
      if (a.hyb === 'sp3' && nb.length === 4) {
        const [p, q, r, s] = vtx
        tri(p, q, r, HYB_COLOR.sp3)
        tri(p, q, s, HYB_COLOR.sp3)
        tri(p, r, s, HYB_COLOR.sp3)
        tri(q, r, s, HYB_COLOR.sp3)
        for (const [x, y] of [
          [p, q],
          [p, r],
          [p, s],
          [q, r],
          [q, s],
          [r, s],
        ])
          edgeV.push(...x, ...y)
      } else if (a.hyb === 'sp2' && nb.length === 3) {
        const [p, q, r] = vtx
        tri(p, q, r, HYB_COLOR.sp2)
        edgeV.push(...p, ...q, ...q, ...r, ...r, ...p)
      } else if (a.hyb === 'sp' && nb.length === 2) {
        const u = norm(sub(pos[nb[1]], pos[nb[0]]))
        axisSegs.push({ a: add(pos[i], scale(u, -1.05)), b: add(pos[i], scale(u, 1.05)), r: 0.045, color: HYB_COLOR.sp, bond: -1 })
      }
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3))
    g.computeVertexNormals()
    const eg = new THREE.BufferGeometry()
    eg.setAttribute('position', new THREE.Float32BufferAttribute(edgeV, 3))
    // π-облака: над и под кратной связью (вдоль нормали к σ-плоскости); у тройной — две пары
    const cl: Blob[] = []
    for (const bd of mol.bonds) {
      if (bd.ar || bd.o < 2) continue
      const pa = pos[bd.a]
      const pb = pos[bd.b]
      const mid = scale(add(pa, pb), 0.5)
      const axis = norm(sub(pb, pa))
      const L = dist(pa, pb)
      const n1 = piNormal(pos, adj, bd.a, bd.b)
      const normals = bd.o === 3 ? [n1, norm(cross(axis, n1))] : [n1]
      for (const n of normals) {
        for (const sgn of [1, -1]) {
          const ny = scale(n, sgn)
          cl.push({ p: add(mid, scale(ny, 0.52)), s: [L * 0.62, 0.36, 0.3], ax: axis, ay: ny, color: '#818cf8' })
        }
      }
    }
    // ароматические кольца: «бублики» π-облака над и под кольцом
    const rg: { c: V3; n: V3; r: number }[] = []
    for (const ring of mol.rings) {
      if (!ring.every((k) => mol.atoms[k].ar)) continue
      const cc: V3 = [0, 0, 0]
      for (const k of ring) for (let d = 0; d < 3; d++) cc[d] += pos[k][d] / ring.length
      const nrm = norm(cross(sub(pos[ring[0]], cc), sub(pos[ring[1]], cc)))
      const r = ring.reduce((s, k) => s + dist(pos[k], cc), 0) / ring.length
      rg.push({ c: cc, n: nrm, r })
    }
    return { geometry: g, edges: eg, axes: axisSegs, clouds: cl, rings: rg }
  }, [mol, pos, adj])
  useEffect(() => () => {
    geometry.dispose()
    edges.dispose()
  }, [geometry, edges])
  return (
    <group>
      <mesh geometry={geometry} renderOrder={1}>
        <meshStandardMaterial vertexColors transparent opacity={0.3} side={THREE.DoubleSide} depthWrite={false} roughness={0.7} />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color="#e2e8f0" transparent opacity={0.55} />
      </lineSegments>
      <SegmentsMesh segs={axes} radial={8} />
      <BlobsMesh blobs={clouds} opacity={0.3} seg={seg} />
      {rings.map((r, k) =>
        [1, -1].map((sg) => (
          <mesh
            key={`${k}${sg}`}
            position={add(r.c, scale(r.n, 0.55 * sg)) as unknown as THREE.Vector3Tuple}
            quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...r.n))}
            renderOrder={2}
          >
            <torusGeometry args={[r.r * 0.92, 0.3, 10, 40]} />
            <meshStandardMaterial color="#818cf8" transparent opacity={0.28} depthWrite={false} />
          </mesh>
        )),
      )}
    </group>
  )
}

// ───────────────────────── камера ─────────────────────────

function FitCamera(props: {
  radius: number
  ext: V3
  pts: readonly V3[]
  radii: readonly number[]
  /** compact с постоянным вращением: длинная ось уходит в глубину — запас по сфере/рамке */
  spinning: boolean
  fitKey: string
  controls: React.RefObject<OrbitControlsImpl | null>
}) {
  const { radius, ext, pts, radii, spinning, fitKey, controls } = props
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const invalidate = useThree((s) => s.invalidate)
  const aspect = Math.round((size.width / Math.max(1, size.height)) * 20) / 20
  useLayoutEffect(() => {
    // по проекции каждого атома на экран: крупные молекулы занимают почти весь кадр (не «половину»)
    const d = spinning
      ? Math.min(fitDistance(radius, FOV, aspect, 1.04), fitDistanceBox(ext, FOV, aspect, 1.12))
      : fitDistancePoints(pts, radii, FOV, aspect, aspect < 1 ? 1.06 : 1.05, aspect < 1 ? 1.08 : 1.12)
    camera.position.set(0, 0, d)
    camera.near = Math.max(0.05, d / 40)
    camera.far = d * 12
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
    const c = controls.current
    if (c) {
      c.target.set(0, 0, 0)
      c.update()
      c.saveState()
    }
    invalidate()
  }, [radius, ext, pts, radii, spinning, fitKey, aspect, camera, controls, invalidate])
  return null
}

/** Свет «привязан» к камере: модель освещена с любой стороны, куда её ни поверни. */
function CameraLights() {
  const key = useRef<THREE.DirectionalLight>(null)
  const rim = useRef<THREE.DirectionalLight>(null)
  useFrame(({ camera }) => {
    const off = new THREE.Vector3(4, 6, 2).applyQuaternion(camera.quaternion)
    key.current?.position.copy(camera.position).add(off)
    const off2 = new THREE.Vector3(-6, -2, -6).applyQuaternion(camera.quaternion)
    rim.current?.position.copy(camera.position).add(off2)
  })
  return (
    <>
      <ambientLight intensity={0.5} />
      <hemisphereLight args={['#e6edff', '#2a2f40', 0.75]} />
      <directionalLight ref={key} intensity={1.7} />
      <directionalLight ref={rim} intensity={0.55} color="#a9bcff" />
    </>
  )
}

const INTRO_S = 2.6

/**
 * compact + autoRotate — постоянное вращение (карточки); иначе — короткий «показ» при первом открытии:
 * плавный поворот туда-обратно (~2,6 с) и возврат в исходный ракурс; касание сразу останавливает.
 */
function AutoSpin({ on, intro, introKey, stopRef, children }: { on: boolean; intro: boolean; introKey: string; stopRef: React.RefObject<(() => void) | null>; children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null)
  const t0 = useRef<number | null>(null)
  const active = useRef(false)
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    active.current = intro
    t0.current = null
    if (g.current) g.current.rotation.y = 0
    stopRef.current = () => {
      active.current = false
    }
    if (intro) invalidate()
    return () => {
      stopRef.current = null
    }
  }, [intro, introKey, invalidate, stopRef])
  useFrame(({ clock }, dt) => {
    const grp = g.current
    if (!grp) return
    if (on) {
      grp.rotation.y += dt * 0.45
      return
    }
    if (!active.current) return
    const now = clock.getElapsedTime()
    if (t0.current === null) t0.current = now
    const k = (now - t0.current) / INTRO_S
    if (k >= 1) {
      grp.rotation.y = 0
      active.current = false
    } else grp.rotation.y = 0.62 * Math.sin(Math.PI * 2 * k) * Math.sin(Math.PI * k)
    invalidate()
  })
  return <group ref={g}>{children}</group>
}

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// ───────────────────────── компонент ─────────────────────────

const ROMAN = ['0', 'I', 'II', 'III', 'IV']

/** Контрактный компонент (props — ./contracts.ts). */
export function Molecule3D(props: Molecule3DProps) {
  return <Molecule3DCore {...props} />
}

/** Внутренние стартовые состояния инструментов (витрина, кадры, будущие уроки «покрути связь»). */
export interface Molecule3DCoreProps extends Molecule3DProps {
  /** индекс связи для инструмента rotate — сразу открыть Ньюмена */
  readonly initialRotateBond?: number
  /** стартовый двугранный угол φ, градусы */
  readonly initialPhi?: number
  /** стартовые атомы линейки (2 — расстояние, 3 — угол) */
  readonly initialPicks?: readonly number[]
}

export function Molecule3DCore(props: Molecule3DCoreProps) {
  const { mol, style, compact = false, lang, initialRotateBond, initialPhi, initialPicks } = props
  const overlay = compact ? 'none' : (props.overlay ?? 'none')
  const tool = compact ? 'none' : (props.tool ?? 'none')
  const t = VIEWER_T[lang]
  const phone = useMemo(isPhone, [])
  const seg = compact ? 12 : phone ? 18 : 30
  const radial = compact ? 7 : phone ? 10 : 16

  const adj = useMemo(() => neighbors(mol), [mol])
  // окно выше, чем шире (телефон в портрете) — вытянутые молекулы ставим длинной осью по вертикали
  const rootRef = useRef<HTMLDivElement>(null)
  const [tall, setTall] = useState(false)
  useEffect(() => {
    const el = rootRef.current
    if (!el || compact) return
    const check = () => setTall(el.clientHeight > el.clientWidth * 1.2)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [compact])
  const basePos = useMemo(() => orientForScreen(mol.atoms.map((a) => a.p), tall), [mol, tall])

  // ── вращение вокруг одинарной связи ──
  const [rotBond, setRotBond] = useState<number | null>(null)
  const [phiTarget, setPhiTarget] = useState<number | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [picks, setPicks] = useState<number[]>([])
  useEffect(() => {
    const rb = tool === 'rotate' && initialRotateBond !== undefined && isRotatable(mol, adj, initialRotateBond) ? initialRotateBond : null
    setRotBond(rb)
    if (rb !== null) {
      const bd = mol.bonds[rb]
      setPhiTarget(initialPhi ?? Math.round(newmanProjection(mol, basePos, adj, bd.a, bd.b).phi))
    } else setPhiTarget(null)
    setPicks(tool === 'measure' && initialPicks ? initialPicks.slice(0, 3) : [])
    setNote(null)
  }, [mol, tool, adj, basePos, initialRotateBond, initialPhi, initialPicks])

  const rot = useMemo(() => {
    if (rotBond === null) return null
    const bd = mol.bonds[rotBond]
    const side = sideOf(adj, bd.a, bd.b)
    if (!side) return null
    const nm0 = newmanProjection(mol, basePos, adj, bd.a, bd.b)
    return { a: bd.a, b: bd.b, side, phi0: nm0.phi }
  }, [rotBond, mol, adj, basePos])

  const pos = useMemo<V3[]>(() => {
    if (!rot || phiTarget === null) return basePos
    const delta = ((phiTarget - rot.phi0) * Math.PI) / 180
    const axis = norm(sub(basePos[rot.b], basePos[rot.a]))
    const moving = new Set(rot.side)
    return basePos.map((p, i) => (moving.has(i) ? rotateAround(p, basePos[rot.a], axis, delta) : p))
  }, [basePos, rot, phiTarget])

  const newman = useMemo(() => (rot ? newmanProjection(mol, pos, adj, rot.a, rot.b) : null), [rot, mol, pos, adj])

  // ── цвета/радиусы ──
  const atomColors = useMemo(() => {
    if (overlay !== 'charges') return mol.atoms.map((a) => cpkColor(a.el))
    const neg = new THREE.Color('#ff4d4d')
    const posC = new THREE.Color('#3b82f6')
    const neu = new THREE.Color('#c9cfdb')
    return mol.atoms.map((a) => {
      const k = Math.min(1, Math.abs(a.q) / 0.32)
      return '#' + neu.clone().lerp(a.q < 0 ? neg : posC, k).getHexString()
    })
  }, [mol, overlay])
  const radii = useMemo(
    () =>
      mol.atoms.map((a) => (style === 'spaceFill' ? vdwRadius(a.el) : style === 'wire' ? (a.el === 'H' ? 0.05 : 0.075) : ballRadius(a.el))),
    [mol, style],
  )
  const segs = useMemo(() => buildSegments(mol, pos, adj, style, (i) => atomColors[i]), [mol, pos, adj, style, atomColors])
  const radius = useMemo(() => boundingRadius(basePos, radii), [basePos, radii])
  const ext = useMemo(() => halfExtents(basePos, radii), [basePos, radii])

  // ── инструменты ──
  const onAtom = useCallback(
    (i: number) => {
      if (tool !== 'measure') return
      setPicks((p) => (p.length >= 3 || p.includes(i) ? [i] : [...p, i]))
    },
    [tool],
  )
  const onBond = useCallback(
    (bi: number) => {
      if (tool !== 'rotate') return
      if (!isRotatable(mol, adj, bi)) {
        setNote(t.notRotatable)
        return
      }
      setNote(null)
      setRotBond(bi)
      const bd = mol.bonds[bi]
      setPhiTarget(Math.round(newmanProjection(mol, basePos, adj, bd.a, bd.b).phi))
    },
    [tool, mol, adj, basePos, t.notRotatable],
  )

  // ── ореолы: подсветка, выбранные атомы, группы ──
  const halos = useMemo<Blob[]>(() => {
    const out: Blob[] = []
    const k = style === 'spaceFill' ? 1.12 : style === 'wire' ? 4 : 1.9
    const r = (i: number) => (style === 'wire' ? 0.32 : radii[i] * k)
    for (const i of props.highlightAtoms ?? []) if (pos[i]) out.push({ p: pos[i], s: [r(i), r(i), r(i)], color: '#facc15' })
    for (const i of picks) out.push({ p: pos[i], s: [r(i) * 1.05, r(i) * 1.05, r(i) * 1.05], color: '#22d3ee' })
    if (rot) for (const i of [rot.a, rot.b]) out.push({ p: pos[i], s: [r(i) * 0.72, r(i) * 0.72, r(i) * 0.72], color: '#fb923c' })
    if (overlay === 'groups')
      for (const g of mol.groups) for (const i of g.atoms) out.push({ p: pos[i], s: [r(i) * 1.1, r(i) * 1.1, r(i) * 1.1], color: GROUP_COLOR[g.key] })
    return out
  }, [props.highlightAtoms, picks, rot, overlay, mol, pos, radii, style])

  // ── подписи ──
  const labels = useMemo(() => {
    if (compact) return []
    const out: { key: string; p: V3; text: string; cls: string; color?: string }[] = []
    const up = (p: V3, d: number): V3 => add(p, [0, d, 0])
    if (overlay === 'groups') {
      const seen = new Set<string>()
      for (const g of mol.groups) {
        const heavy = g.atoms.filter((i) => mol.atoms[i].el !== 'H')
        const ids = heavy.length ? heavy : g.atoms
        const c: V3 = [0, 0, 0]
        for (const i of ids) for (let d = 0; d < 3; d++) c[d] += pos[i][d] / ids.length
        const outward = len(c) > 0.3 ? norm(c) : ([0, 1, 0] as V3)
        const key = `${g.key}:${ids.join(',')}`
        if (seen.has(key)) continue
        seen.add(key)
        out.push({ key, p: add(c, scale(outward, 1.1)), text: GROUP_SHORT[g.key], cls: styles.lblGroup, color: GROUP_COLOR[g.key] })
      }
    }
    if (overlay === 'charges') {
      mol.atoms.forEach((a, i) => {
        if (Math.abs(a.q) < (a.el === 'H' ? 0.15 : 0.12)) return
        out.push({ key: `q${i}`, p: up(pos[i], radii[i] + 0.25), text: a.q < 0 ? 'δ−' : 'δ+', cls: a.q < 0 ? styles.lblNeg : styles.lblPos })
      })
    }
    if (overlay === 'carbonDegree') {
      mol.atoms.forEach((a, i) => {
        if (a.el !== 'C') return
        const deg = adj[i].filter((j) => mol.atoms[j].el === 'C').length
        out.push({ key: `d${i}`, p: up(pos[i], radii[i] + 0.3), text: ROMAN[deg] ?? String(deg), cls: `${styles.lblDeg} ${styles[`deg${deg}`] ?? ''}` })
      })
    }
    if (overlay === 'hybrid' && mol.atoms.filter((a) => a.el === 'C').length <= 30) {
      mol.atoms.forEach((a, i) => {
        if (a.el !== 'C' || !a.hyb) return
        out.push({ key: `h${i}`, p: up(pos[i], radii[i] + 0.28), text: a.hyb.replace('3', '³').replace('2', '²'), cls: `${styles.lblHyb} ${styles[a.hyb]}` })
      })
    }
    return out.slice(0, 90)
  }, [compact, overlay, mol, pos, radii, adj])

  // ── линейка ──
  const measure = useMemo(() => {
    if (picks.length < 2) return null
    const P = picks.map((i) => pos[i])
    const name = picks.map((i) => atomCaption(mol, i)).join('–')
    const lines: Seg[] = []
    for (let k = 0; k + 1 < P.length; k++) lines.push({ a: P[k], b: P[k + 1], r: 0.03, color: '#22d3ee', bond: -1 })
    if (picks.length === 2) {
      return { lines, arc: null as V3[] | null, text: `${name}: ${dist(P[0], P[1]).toFixed(2)} Å`, at: scale(add(P[0], P[1]), 0.5) }
    }
    const ang = angleDeg(P[0], P[1], P[2])
    const u = norm(sub(P[0], P[1]))
    const w0 = sub(P[2], P[1])
    const w = norm(sub(w0, scale(u, dot(w0, u))))
    const R = 0.55
    const arc: V3[] = []
    const A = (ang * Math.PI) / 180
    for (let k = 0; k <= 24; k++) {
      const s = (A * k) / 24
      arc.push(add(P[1], add(scale(u, R * Math.cos(s)), scale(w, R * Math.sin(s)))))
    }
    return { lines, arc, text: `∠ ${name}: ${ang.toFixed(1)}°`, at: arc[12] }
  }, [picks, pos, mol])

  const arcGeo = useMemo(() => {
    if (!measure?.arc) return null
    return new THREE.BufferGeometry().setFromPoints(measure.arc.map((p) => new THREE.Vector3(...p)))
  }, [measure])
  useEffect(() => () => arcGeo?.dispose(), [arcGeo])

  const controls = useRef<OrbitControlsImpl | null>(null)
  const stopIntro = useRef<(() => void) | null>(null)
  const intro = !compact && !props.autoRotate && !reducedMotion() && (typeof navigator === 'undefined' || !navigator.webdriver)
  const fitKey = `${mol.id}|${style}`
  const resetView = useCallback(() => {
    controls.current?.reset()
    setPicks([])
  }, [])

  const rotCaption = rot ? `${atomCaption(mol, rot.a)}–${atomCaption(mol, rot.b)}` : ''
  const hint = tool === 'measure' && picks.length === 0 ? t.measureHint : tool === 'rotate' && rot === null ? (note ?? t.rotateHint) : null

  return (
    <div
      ref={rootRef}
      className={[styles.root, compact ? styles.compact : '', props.className].filter(Boolean).join(' ')}
      data-app-night=""
      data-ov2-mol3d={mol.id}
      onDoubleClick={compact ? undefined : resetView}
      onPointerDown={compact ? undefined : () => stopIntro.current?.()}
      onWheel={compact ? undefined : () => stopIntro.current?.()}
      title={compact ? undefined : t.reset}
    >
      <div className={styles.floor} aria-hidden />
      <Canvas
        events={safeCanvasEvents}
        className={styles.canvas}
        frameloop={props.autoRotate ? 'always' : 'demand'}
        dpr={compact ? [1, 1.5] : [1, 2]}
        gl={{ antialias: !compact || !phone, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: false }}
        camera={{ fov: FOV, position: [0, 0, 12], near: 0.1, far: 200 }}
      >
        <CameraLights />
        <FitCamera radius={radius} ext={ext} pts={basePos} radii={radii} spinning={!!props.autoRotate} fitKey={fitKey} controls={controls} />
        <AutoSpin on={!!props.autoRotate && compact} intro={intro} introKey="mount" stopRef={stopIntro}>
          <AtomsMesh
            key={`a${mol.id}`}
            pos={pos}
            radii={radii}
            colors={atomColors}
            seg={seg}
            glossy={!compact && !phone}
            onPick={tool === 'measure' ? onAtom : undefined}
          />
          <SegmentsMesh key={`b${mol.id}${style}`} segs={segs} radial={radial} onPick={tool === 'rotate' ? onBond : undefined} />
          {halos.length > 0 && <BlobsMesh key={`h${halos.length}`} blobs={halos} opacity={0.26} seg={compact ? 10 : 20} />}
          {overlay === 'hybrid' && style !== 'spaceFill' && <HybridLayer mol={mol} pos={pos} adj={adj} seg={seg} />}
          {measure && <SegmentsMesh key={`m${picks.join()}`} segs={measure.lines} radial={8} />}
          {arcGeo && (
            <line>
              <primitive object={arcGeo} attach="geometry" />
              <lineBasicMaterial color="#22d3ee" />
            </line>
          )}
          {measure && (
            <Html position={measure.at as unknown as THREE.Vector3Tuple} center zIndexRange={[20, 0]}>
              <div className={styles.lblMeasure}>{measure.text}</div>
            </Html>
          )}
          {labels.map((l) => (
            <Html key={l.key} position={l.p as unknown as THREE.Vector3Tuple} center zIndexRange={[10, 0]}>
              <div className={l.cls} style={l.color ? { background: l.color } : undefined}>
                {l.text}
              </div>
            </Html>
          ))}
        </AutoSpin>
        {!compact && (
          <OrbitControls
            ref={controls}
            makeDefault
            enableDamping
            dampingFactor={0.12}
            rotateSpeed={0.85}
            zoomSpeed={0.9}
            minDistance={Math.max(1.5, radius * 0.5)}
            maxDistance={radius * 9}
            autoRotate={!!props.autoRotate}
            autoRotateSpeed={1.2}
          />
        )}
      </Canvas>
      {!compact && overlay === 'hybrid' && (
        <div className={styles.legend}>
          <span className={styles.sp3}>sp³ · {lang === 'ru' ? 'тетраэдр 109,5°' : lang === 'uz' ? 'tetraedr 109,5°' : 'tetrahedron 109.5°'}</span>
          <span className={styles.sp2}>sp² · {lang === 'ru' ? 'плоскость 120°' : lang === 'uz' ? 'tekislik 120°' : 'trigonal 120°'}</span>
          <span className={styles.sp}>sp · {lang === 'ru' ? 'линия 180°' : lang === 'uz' ? 'chiziq 180°' : 'linear 180°'}</span>
          <span className={styles.pi}>π · {lang === 'ru' ? 'облако над и под связью' : lang === 'uz' ? 'bog‘ ustida va ostida bulut' : 'cloud above and below'}</span>
        </div>
      )}
      {!compact && hint && <div className={styles.hint}>{hint}</div>}
      {!compact && measure && (
        <div className={styles.readout}>
          {measure.text}
          <button type="button" onClick={() => setPicks([])}>
            {t.clear}
          </button>
        </div>
      )}
      {!compact && newman && phiTarget !== null && (
        <NewmanPanel data={newman} phi={phiTarget} onPhi={setPhiTarget} lang={lang} caption={rotCaption} />
      )}
    </div>
  )
}

