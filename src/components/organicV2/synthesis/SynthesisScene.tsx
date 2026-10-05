/**
 * Органика v2 · «Как образуется» — 3D-сцена синтеза: атомы, связи и электроны instancing'ом (3 draw call на всю
 * реакцию, хоть 800 атомов), позиции — из чистого сценария (src/chemistry/organicV2/synthesis/scenario.ts) по часам.
 * Камера сама держит в кадре всё, что движется; вращать можно пальцем/мышью (масштаб — автоматический).
 */
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import {
  atomPositionsAt,
  bondLines,
  bondLineScale,
  boundsOf,
  electronAlpha,
  stageIndexAt,
  type SynthScenario,
} from '../../../chemistry/organicV2/synthesis/scenario'
import { atomColor, atomRadius } from './cpk'
import styles from './SynthesisPlayer.module.css'

export interface SynthClock {
  t: number
  playing: boolean
}

export interface SceneLabel {
  /** индекс участника в scenario.species */
  readonly species: number
  readonly text: string
  readonly sub?: string
  readonly focus?: boolean
}

interface Props {
  readonly sc: SynthScenario
  readonly clock: MutableRefObject<SynthClock>
  readonly stage: number
  readonly labels: readonly SceneLabel[]
  /** атомы фокусной молекулы (среди продуктов) — остальные продукты приглушены в конце */
  readonly focusAtoms?: ReadonlySet<number>
  readonly endLabel: string
}

const BOND_BASE = new THREE.Color('#b8c2d8')
const BOND_CHANGE = new THREE.Color('#fbbf24')
const BOND_BREAK = new THREE.Color('#fb7185')
const BOND_FORM = new THREE.Color('#34d399')
const HILITE = new THREE.Color('#fffbe8')
const DIM = new THREE.Color('#3a4560')
const Y = new THREE.Vector3(0, 1, 0)

function SceneContent({ sc, clock, stage, labels, focusAtoms, endLabel }: Props) {
  const n = sc.atoms.length
  const atomMesh = useRef<THREE.InstancedMesh>(null)
  const bondMesh = useRef<THREE.InstancedMesh>(null)
  const eMesh = useRef<THREE.InstancedMesh>(null)
  const controls = useRef<OrbitControlsImpl>(null)
  const labelRefs = useRef<(THREE.Group | null)[]>([])
  const endRefs = useRef<(THREE.Group | null)[]>([])
  const { camera, size } = useThree()

  const pos = useMemo(() => new Float32Array(n * 3), [n])
  const lineCount = useMemo(() => sc.bonds.reduce((s, b) => s + bondLines(b), 0), [sc])
  const eCount = useMemo(() => sc.electrons.reduce((s, e) => s + e.count, 0), [sc])
  const baseColors = useMemo(() => sc.atoms.map((a) => new THREE.Color(atomColor(a.el))), [sc])
  const radii = useMemo(() => sc.atoms.map((a) => atomRadius(a.el)), [sc])
  const ends = useMemo(
    () => sc.species.flatMap((s) => s.ends.map((e) => ({ ...e, side: s.side }))),
    [sc],
  )
  const fit = useRef({ c: new THREE.Vector3(), d: 0, init: false })

  // временные объекты кадра (без аллокаций в useFrame)
  const tmp = useMemo(
    () => ({
      m: new THREE.Matrix4(),
      q: new THREE.Quaternion(),
      p: new THREE.Vector3(),
      a: new THREE.Vector3(),
      b: new THREE.Vector3(),
      d: new THREE.Vector3(),
      perp: new THREE.Vector3(),
      view: new THREE.Vector3(),
      s: new THREE.Vector3(),
      col: new THREE.Color(),
    }),
    [],
  )

  useEffect(() => {
    fit.current.init = false
  }, [sc])

  useFrame((state, dt) => {
    const t = clock.current.t
    atomPositionsAt(sc, t, pos)
    const st = stageIndexAt(sc, t)
    const { m, q, p, a, b, d, perp, view, s, col } = tmp
    const pulse = 0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 5)

    // атомы
    const am = atomMesh.current
    if (am) {
      for (let i = 0; i < n; i++) {
        const atom = sc.atoms[i]
        let r = radii[i]
        col.copy(baseColors[i])
        if (atom.center && st >= 1 && st <= 3) {
          col.lerp(HILITE, 0.12 + 0.2 * pulse)
          r *= 1.05 + 0.04 * pulse
        }
        if (focusAtoms && focusAtoms.size && st >= 4 && !focusAtoms.has(i)) col.lerp(DIM, 0.35)
        p.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2])
        s.setScalar(r)
        m.compose(p, q.identity(), s)
        am.setMatrixAt(i, m)
        am.setColorAt(i, col)
      }
      am.instanceMatrix.needsUpdate = true
      if (am.instanceColor) am.instanceColor.needsUpdate = true
    }

    // связи: линии кратных связей разводятся перпендикулярно взгляду
    const bm = bondMesh.current
    if (bm) {
      let k = 0
      for (const bond of sc.bonds) {
        a.set(pos[bond.i * 3], pos[bond.i * 3 + 1], pos[bond.i * 3 + 2])
        b.set(pos[bond.j * 3], pos[bond.j * 3 + 1], pos[bond.j * 3 + 2])
        d.subVectors(b, a)
        const length = d.length()
        d.normalize()
        p.addVectors(a, b).multiplyScalar(0.5)
        view.subVectors(camera.position, p)
        perp.crossVectors(d, view).normalize()
        q.setFromUnitVectors(Y, d)
        const lines = bondLines(bond)
        let eff = 0
        const sc3 = [0, 0, 0]
        for (let l = 0; l < lines; l++) {
          sc3[l] = bondLineScale(bond, l, t)
          eff += sc3[l]
        }
        const multi = Math.max(1, eff) > 1.05
        const spacing = 0.19
        // цвет связи по этапу
        col.copy(BOND_BASE)
        if (bond.kind !== 'keep') {
          if (st === 1 || (st === 2 && (bond.kind === 'break' || bond.kind === 'down') && t <= bond.t)) {
            col.copy(bond.kind === 'form' || bond.kind === 'up' ? BOND_BASE : BOND_CHANGE)
            if (st === 2 && t > bond.t - bond.fade * 1.6) col.copy(BOND_BREAK)
          } else if ((bond.kind === 'form' || bond.kind === 'up') && t >= bond.t) {
            const fade = st >= 5 ? 1 : 0
            col.copy(BOND_FORM).lerp(BOND_BASE, fade * 0.6)
          } else if (bond.kind === 'down' && st >= 2) {
            col.copy(BOND_BASE)
          }
        }
        for (let l = 0; l < lines; l++) {
          const w = sc3[l]
          const off = multi ? (l - (eff - 1) / 2) * spacing : 0
          const radius = (multi ? 0.062 : 0.085) * w
          s.set(radius < 1e-4 ? 0 : radius, radius < 1e-4 ? 0 : length, radius < 1e-4 ? 0 : radius)
          m.compose(view.copy(p).addScaledVector(perp, off), q, s)
          bm.setMatrixAt(k, m)
          bm.setColorAt(k, col)
          k++
        }
      }
      bm.instanceMatrix.needsUpdate = true
      if (bm.instanceColor) bm.instanceColor.needsUpdate = true
    }

    // электроны разрыва (• радикал, : пара)
    const em = eMesh.current
    if (em) em.count = eCount
    if (em && eCount) {
      let k = 0
      for (const e of sc.electrons) {
        const alpha = electronAlpha(e, t)
        a.set(pos[e.atom * 3], pos[e.atom * 3 + 1], pos[e.atom * 3 + 2])
        b.set(pos[e.partner * 3], pos[e.partner * 3 + 1], pos[e.partner * 3 + 2])
        d.subVectors(b, a).normalize()
        view.subVectors(camera.position, a)
        perp.crossVectors(d, view).normalize()
        const r0 = radii[e.atom] + 0.2
        for (let c = 0; c < e.count; c++) {
          const off = e.count === 2 ? (c === 0 ? -0.13 : 0.13) : 0
          p.copy(a).addScaledVector(d, r0).addScaledVector(perp, off)
          s.setScalar(alpha * (0.85 + 0.15 * pulse))
          m.compose(p, q.identity(), s)
          em.setMatrixAt(k++, m)
        }
      }
      em.instanceMatrix.needsUpdate = true
    }

    // подписи веществ: под молекулой
    labels.forEach((lb, li) => {
      const g = labelRefs.current[li]
      if (!g) return
      const ids = sc.species[lb.species].atoms
      let x = 0, y = Infinity, z = 0
      for (const id of ids) {
        x += pos[id * 3]
        z += pos[id * 3 + 2]
        y = Math.min(y, pos[id * 3 + 1])
      }
      g.position.set(x / ids.length, y - 0.9, z / ids.length)
    })
    ends.forEach((e, ei) => {
      const g = endRefs.current[ei]
      if (!g) return
      g.position.set(pos[e.atom * 3] + e.dir[0] * 1.1, pos[e.atom * 3 + 1] + e.dir[1] * 1.1, pos[e.atom * 3 + 2] + e.dir[2] * 1.1)
    })

    // камера: держим в кадре всё облако атомов
    const bb = boundsOf(pos, n)
    const cam = camera as THREE.PerspectiveCamera
    const vfov = (cam.fov * Math.PI) / 180
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * (size.width / Math.max(1, size.height)))
    const need = (bb.r + 1.2) / Math.sin(Math.min(vfov, hfov) / 2)
    const f = fit.current
    const target = controls.current?.target
    if (!f.init) {
      f.c.set(bb.c[0], bb.c[1], bb.c[2])
      f.d = need
      f.init = true
      cam.position.set(bb.c[0], bb.c[1], bb.c[2]).add(view.set(0.18, 0.22, 1).normalize().multiplyScalar(need))
    } else {
      const k = 1 - Math.exp(-Math.min(0.1, dt) * 2.2)
      f.c.lerp(p.set(bb.c[0], bb.c[1], bb.c[2]), k)
      f.d += (need - f.d) * k
    }
    if (target) {
      view.subVectors(cam.position, target).normalize()
      target.copy(f.c)
      cam.position.copy(f.c).addScaledVector(view, f.d)
      controls.current?.update()
    } else {
      cam.lookAt(f.c)
    }
  })

  const showLabel = (lb: SceneLabel) => {
    const side = sc.species[lb.species].side
    return side === 'L' ? stage <= 1 : stage >= 4
  }
  const showEnds = (side: 'L' | 'R') => (side === 'L' ? stage <= 2 : stage >= 3)

  return (
    <>
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#dbe7ff', '#1b2236', 0.65]} />
      <directionalLight position={[6, 9, 10]} intensity={1.55} />
      <directionalLight position={[-8, -4, -6]} intensity={0.35} color="#9db7ff" />
      <instancedMesh ref={atomMesh} args={[undefined, undefined, n]} frustumCulled={false}>
        <sphereGeometry args={[1, 22, 16]} />
        <meshStandardMaterial roughness={0.32} metalness={0.06} />
      </instancedMesh>
      <instancedMesh ref={bondMesh} args={[undefined, undefined, Math.max(1, lineCount)]} frustumCulled={false}>
        <cylinderGeometry args={[1, 1, 1, 10, 1]} />
        <meshStandardMaterial roughness={0.45} metalness={0.05} />
      </instancedMesh>
      <instancedMesh ref={eMesh} args={[undefined, undefined, Math.max(1, eCount)]} frustumCulled={false}>
        <sphereGeometry args={[0.11, 10, 8]} />
        <meshBasicMaterial color="#fde047" toneMapped={false} />
      </instancedMesh>
      {labels.map((lb, li) => (
        <group key={`l${lb.species}`} ref={(g) => { labelRefs.current[li] = g }}>
          {showLabel(lb) ? (
            <Html center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
              <div className={lb.focus ? styles.label3dFocus : styles.label3d}>
                <span className={styles.label3dMain}>{lb.text}</span>
                {lb.sub ? <span className={styles.label3dSub}>{lb.sub}</span> : null}
              </div>
            </Html>
          ) : null}
        </group>
      ))}
      {ends.map((e, ei) => (
        <group key={`e${ei}`} ref={(g) => { endRefs.current[ei] = g }}>
          {showEnds(e.side) ? (
            <Html center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
              <span className={styles.chainEnd} title={endLabel}>…</span>
            </Html>
          ) : null}
        </group>
      ))}
      <OrbitControls ref={controls} enablePan={false} enableZoom={false} rotateSpeed={0.7} enableDamping dampingFactor={0.12} />
    </>
  )
}

export default function SynthesisScene(props: Props) {
  return (
    <Canvas
      className={styles.canvas}
      dpr={[1, 1.75]}
      camera={{ fov: 38, near: 0.1, far: 500, position: [0, 0, 30] }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
    >
      <SceneContent {...props} />
    </Canvas>
  )
}
