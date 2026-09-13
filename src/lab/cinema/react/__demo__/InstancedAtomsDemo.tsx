import { useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CPK } from '../../core/atoms'
import { ATOM_NEIGHBOR_STRIDE, computeAtomContacts, type AtomRenderMode } from '../../core/atomImpostorShader'
import { createAtomPool, writeHexLinear, writeVec3, type AtomPool } from '../../core/pools'
import { CinemaLightRig } from '../CinemaLightRig'
import { InstancedAtoms } from '../InstancedAtoms'

/**
 * DEV-ONLY стенд InstancedAtoms. Нигде не импортируется и в сборку не попадает.
 *
 * Что проверяет глазами:
 *   • ClO₂ в центре: пересечение сфер (gl_FragDepth), контактное затенение,
 *     оттенок кромки по заряду (O −, Cl +);
 *   • стандартный цилиндр-«связь» проходит сквозь атомы — глубина общая;
 *   • справа — «горячий» атом (emissive 1.8) и полупрозрачный (opacity 0.5, screen-door);
 *   • кольцо из ~190 малых атомов — всё в одном draw call, туман гасит дальние.
 *
 * Просмотр при запущенном `npm run dev`: открыть любой URL дев-сервера,
 * в консоли выполнить
 *   (await import('/src/lab/cinema/react/__demo__/mountInstancedAtomsDemo.tsx')).mountInstancedAtomsDemo(document.body, 'impostor')
 * (или 'mesh'). Скриншоты: node scripts/smoke-instanced-atoms.mjs
 */

const CAPACITY = 256
const RING = 190

type DemoInfo = { calls: number; triangles: number; programs: number; frame: number }

declare global {
  interface Window {
    __instancedAtomsDemo?: DemoInfo
  }
}

function writeAtom(
  pool: AtomPool,
  i: number,
  x: number,
  y: number,
  z: number,
  radius: number,
  hex: number,
  charge = 0,
  emissive = 0,
  opacity = 1,
): void {
  writeVec3(pool.position, i, x, y, z)
  pool.radius[i] = radius
  writeHexLinear(pool.color, i, hex)
  pool.charge[i] = charge
  pool.emissive[i] = emissive
  pool.opacity[i] = opacity
}

/** Масштаб стенда: 1 Å = 0.8 ед.; радиусы — доля ковалентных (ball-and-stick). */
const S = 0.8
const CLO2_HALF_ANGLE = (117.5 / 2) * (Math.PI / 180)
const CLO2_D = 1.47 * S
const DEMO_O_LEFT: [number, number, number] = [-Math.sin(CLO2_HALF_ANGLE) * CLO2_D, 0.25 - Math.cos(CLO2_HALF_ANGLE) * CLO2_D, 0]

function seedDemoPool(pool: AtomPool): void {
  // ClO₂: Cl–O 1.47 Å, угол 117.5°.
  writeAtom(pool, 0, 0, 0.25, 0, 1.02 * S * 0.62, CPK.Cl, 0.7)
  writeAtom(pool, 1, DEMO_O_LEFT[0], DEMO_O_LEFT[1], 0, 0.66 * S * 0.72, CPK.O, -0.35)
  writeAtom(pool, 2, -DEMO_O_LEFT[0], DEMO_O_LEFT[1], 0, 0.66 * S * 0.72, CPK.O, -0.35)
  // «горячий» и полупрозрачный атомы
  writeAtom(pool, 3, 1.65, 0.75, 0.2, 0.2, 0xffffff, 0, 1.8)
  writeAtom(pool, 4, 1.65, -0.25, 0.2, 0.3, 0x3050f8, 0, 0, 0.5)
  // вода слева: O–H 0.96 Å, 104.5°
  const hh = (104.5 / 2) * (Math.PI / 180)
  const oh = 0.96 * S
  writeAtom(pool, 5, -1.7, 0.55, 0, 0.66 * S * 0.72, CPK.O, -0.6)
  writeAtom(pool, 6, -1.7 - Math.sin(hh) * oh, 0.55 - Math.cos(hh) * oh, 0, 0.31 * S * 0.9, CPK.H, 0.3)
  writeAtom(pool, 7, -1.7 + Math.sin(hh) * oh, 0.55 - Math.cos(hh) * oh, 0, 0.31 * S * 0.9, CPK.H, 0.3)
  pool.count = 8 + RING
  pool.version++
}

/** Кольцо малых атомов вращается — писатель пула каждый кадр увеличивает version. */
function animateDemoRing(pool: AtomPool, contacts: Float32Array, t: number): void {
  for (let k = 0; k < RING; k++) {
    const i = 8 + k
    const a = (k / RING) * Math.PI * 2 + t * 0.25
    const r = 3.2 + Math.sin(k * 1.7) * 0.35
    const y = Math.sin(a * 3 + t) * 0.25 - 0.9
    if (pool.radius[i] === 0) {
      const hexes = [CPK.O, CPK.H, CPK.N, CPK.Cl, 0x909090] as const
      writeHexLinear(pool.color, i, hexes[k % hexes.length]!)
      pool.radius[i] = 0.06 + ((k * 7) % 5) * 0.012
      pool.opacity[i] = 1
      pool.charge[i] = ((k % 3) - 1) * 0.8
    }
    writeVec3(pool.position, i, Math.cos(a) * r, y, Math.sin(a) * r - 3.6)
  }
  computeAtomContacts(pool, contacts)
  pool.version++
}

function publishInfo(gl: THREE.WebGLRenderer, info: DemoInfo): void {
  info.calls = gl.info.render.calls
  info.triangles = gl.info.render.triangles
  info.programs = gl.info.programs?.length ?? 0
  info.frame++
  window.__instancedAtomsDemo = info
}

function DemoScene({ mode, time }: { mode: AtomRenderMode; time?: number }) {
  const pool = useMemo(() => {
    const p = createAtomPool(CAPACITY)
    seedDemoPool(p)
    return p
  }, [])
  const contact = useMemo(() => ({ neighbors: new Float32Array(CAPACITY * ATOM_NEIGHBOR_STRIDE) }), [])
  const info = useRef<DemoInfo>({ calls: 0, triangles: 0, programs: 0, frame: 0 })

  useFrame((state) => {
    animateDemoRing(pool, contact.neighbors, time ?? state.clock.elapsedTime)
  })
  // Счётчики прошлого кадра (info сбрасывается в начале рендера).
  useFrame((state) => {
    publishInfo(state.gl, info.current)
  }, -1)

  return (
    <>
      <color attach="background" args={['#02030a']} />
      <fog attach="fog" args={['#02030a', 5, 11]} />
      <CinemaLightRig directionalLight directionalIntensity={0} />
      <InstancedAtoms pool={pool} mode={mode} contact={contact} renderOrder={1} />
      {/* связь-палочка Cl–O: общая глубина со стандартной геометрией */}
      <mesh position={[DEMO_O_LEFT[0] / 2, (DEMO_O_LEFT[1] + 0.25) / 2, 0]} rotation={[0, 0, -CLO2_HALF_ANGLE]}>
        <cylinderGeometry args={[0.07, 0.07, CLO2_D, 16]} />
        <meshStandardMaterial color="#c8d0e0" roughness={0.25} metalness={0.1} />
      </mesh>
      <mesh position={[0, -1.35, -0.6]}>
        <torusKnotGeometry args={[0.28, 0.08, 96, 12]} />
        <meshStandardMaterial color="#8090a8" roughness={0.15} metalness={0.9} />
      </mesh>
    </>
  )
}

export function InstancedAtomsDemo({ mode: initialMode = 'impostor', time }: { mode?: AtomRenderMode; time?: number }) {
  const [mode, setMode] = useState<AtomRenderMode>(initialMode)
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#02030a' }}>
      <Canvas
        camera={{ position: [0, 0.35, 4.2], fov: 40, near: 0.1, far: 60 }}
        dpr={[1, 1.5]}
        gl={{ antialias: false, toneMapping: THREE.AgXToneMapping }}
      >
        <DemoScene mode={mode} time={time} />
      </Canvas>
      <button
        type="button"
        data-testid="toggle-mode"
        onClick={() => setMode((m) => (m === 'impostor' ? 'mesh' : 'impostor'))}
        style={{ position: 'absolute', left: 12, top: 12, font: '13px system-ui', padding: '6px 10px' }}
      >
        mode: {mode}
      </button>
    </div>
  )
}
