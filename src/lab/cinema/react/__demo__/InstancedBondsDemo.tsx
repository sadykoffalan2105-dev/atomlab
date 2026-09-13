import { useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import { createBondPool, writeHexLinear, writeVec3, type BondPool } from '../../core/pools'
import { InstancedBonds } from '../InstancedBonds'

/**
 * Витрина InstancedBonds — нигде не импортируется.
 *
 * Открыть при запущенном `npm run dev`:
 *   http://localhost:5173/src/lab/cinema/react/__demo__/instancedBondsDemo.html
 *
 * Ряды: кратность 1 / 1.5 / 2 / 3 (+ вертикальная двойная с явной piNormal);
 * полярность; разрыв — гомолиз против гетеролиза к A и к B, волна образования
 * и screen-door прозрачность. Всё — один draw call.
 */

type Exhibit = {
  label: string
  /** центр экспоната */
  x: number
  y: number
  vertical?: boolean
  colorA: number
  colorB: number
  order: number
  polarity?: number
  /** явное направление полос; без него — к камере */
  piNormal?: readonly [number, number, number]
  /** 'break' — цикл натяжение → перешеек → разрыв; 'form' — цикл образования */
  anim?: 'break' | 'form'
  split?: number
  opacity?: number
}

const CPK = { H: 0xffffff, C: 0x909090, O: 0xff2a1a, Cl: 0x2fe03a }
const HALF = 0.8
const ATOM_R = 0.26
const BOND_R = 0.05

const EXHIBITS: readonly Exhibit[] = [
  { label: 'порядок 1 (C–C)', x: -4.8, y: 2.6, colorA: CPK.C, colorB: CPK.C, order: 1 },
  { label: 'порядок 1.5 (Cl–O в ClO₂)', x: -1.6, y: 2.6, colorA: CPK.Cl, colorB: CPK.O, order: 1.5, piNormal: [0, 1, 0] },
  { label: 'порядок 2 (C=O)', x: 1.6, y: 2.6, colorA: CPK.C, colorB: CPK.O, order: 2, piNormal: [0, 1, 0] },
  { label: 'порядок 3 (C≡C)', x: 4.8, y: 2.6, colorA: CPK.C, colorB: CPK.C, order: 3 },
  { label: 'H–H, полярность 0', x: -4.8, y: 0.5, colorA: CPK.H, colorB: CPK.H, order: 1, polarity: 0 },
  { label: 'C–O, +0.6 (к O)', x: -1.6, y: 0.5, colorA: CPK.C, colorB: CPK.O, order: 1, polarity: 0.6 },
  { label: 'O–H, −0.8 (к O)', x: 1.6, y: 0.5, colorA: CPK.O, colorB: CPK.H, order: 1, polarity: -0.8 },
  { label: 'верт. C=C, piNormal x', x: 4.8, y: 0.5, vertical: true, colorA: CPK.C, colorB: CPK.C, order: 2, piNormal: [1, 0, 0] },
  { label: 'гомолиз, split 0', x: -4.8, y: -1.6, colorA: CPK.Cl, colorB: CPK.Cl, order: 1, anim: 'break', split: 0 },
  { label: 'гетеролиз к A, split −1', x: -1.6, y: -1.6, colorA: CPK.Cl, colorB: CPK.Cl, order: 1, anim: 'break', split: -1 },
  { label: 'гетеролиз к B, split +1', x: 1.6, y: -1.6, colorA: CPK.Cl, colorB: CPK.Cl, order: 1, anim: 'break', split: 1 },
  { label: 'образование (form)', x: 4.8, y: -1.6, colorA: CPK.O, colorB: CPK.Cl, order: 1.5, anim: 'form', polarity: 0.3 },
  { label: 'opacity 0.5 (дизеринг)', x: 0, y: -3.4, colorA: CPK.O, colorB: CPK.C, order: 2, opacity: 0.5 },
]

function atomA(e: Exhibit): [number, number, number] {
  return e.vertical ? [e.x, e.y - HALF, 0] : [e.x - HALF, e.y, 0]
}

function atomB(e: Exhibit): [number, number, number] {
  return e.vertical ? [e.x, e.y + HALF, 0] : [e.x + HALF, e.y, 0]
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}

/** Цикл разрыва 7 с: натяжение → перешеек → пауза разорванной → сброс. */
function breakPhase(t: number): { stress: number; thinning: number; opacity: number } {
  const p = (t % 7) / 7
  const stress = clamp01(p / 0.3) * (p < 0.85 ? 1 : 0)
  const thinning = clamp01((p - 0.25) / 0.45)
  const opacity = p < 0.9 ? 1 : clamp01((1 - p) / 0.1)
  return { stress: stress * (1 - 0.35 * thinning), thinning, opacity }
}

function writeDemoPool(pool: BondPool, t: number, manualThinning: number | null): void {
  let i = 0
  for (const e of EXHIBITS) {
    const a = atomA(e)
    const b = atomB(e)
    writeVec3(pool.a, i, a[0], a[1], a[2])
    writeVec3(pool.b, i, b[0], b[1], b[2])
    writeHexLinear(pool.colorA, i, e.colorA)
    writeHexLinear(pool.colorB, i, e.colorB)
    const n = e.piNormal ?? [0, 0, 0]
    writeVec3(pool.piNormal, i, n[0], n[1], n[2])
    pool.radius[i] = BOND_R
    pool.order[i] = e.order
    pool.polarity[i] = e.polarity ?? 0
    pool.split[i] = e.split ?? 0
    pool.opacity[i] = e.opacity ?? 1
    pool.form[i] = 1
    pool.stress[i] = 0
    pool.thinning[i] = 0
    if (e.anim === 'break') {
      if (manualThinning !== null) {
        pool.thinning[i] = manualThinning
        pool.stress[i] = 0.6 * (1 - manualThinning)
      } else {
        const ph = breakPhase(t)
        pool.thinning[i] = ph.thinning
        pool.stress[i] = ph.stress
        pool.opacity[i] = ph.opacity
      }
    } else if (e.anim === 'form') {
      pool.form[i] = clamp01(((t % 4) / 4) * 1.4)
    }
    i++
  }
  pool.count = i
  pool.version++
}

function DemoScene({ lite, animate, thinning }: { lite: boolean; animate: boolean; thinning: number }) {
  const pool = useMemo(() => createBondPool(EXHIBITS.length), [])
  const time = useRef(0)

  useFrame((_, delta) => {
    if (animate) time.current += Math.min(delta, 0.1)
    writeDemoPool(pool, time.current, animate ? null : thinning)
  })

  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight position={[-3, 5, 6]} intensity={1.6} />
      {EXHIBITS.map((e) => (
        <group key={e.label}>
          <mesh position={atomA(e)}>
            <sphereGeometry args={[ATOM_R, 24, 16]} />
            <meshStandardMaterial color={e.colorA} roughness={0.35} />
          </mesh>
          <mesh position={atomB(e)}>
            <sphereGeometry args={[ATOM_R, 24, 16]} />
            <meshStandardMaterial color={e.colorB} roughness={0.35} />
          </mesh>
          <Html position={[e.x, e.y - (e.vertical ? 1.25 : 0.55), 0]} center style={LABEL_STYLE}>
            {e.label}
          </Html>
        </group>
      ))}
      <InstancedBonds pool={pool} time={time} lite={lite} />
      <OrbitControls makeDefault />
    </>
  )
}

const LABEL_STYLE = {
  color: '#cfe3ff',
  font: '12px system-ui, sans-serif',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
} as const

const PANEL_STYLE = {
  position: 'absolute',
  top: 12,
  left: 12,
  padding: '8px 12px',
  background: 'rgba(8, 20, 40, 0.8)',
  color: '#e6f0ff',
  font: '13px system-ui, sans-serif',
  borderRadius: 8,
  display: 'flex',
  gap: 14,
  alignItems: 'center',
  zIndex: 1,
} as const

export function InstancedBondsDemo() {
  const [lite, setLite] = useState(false)
  const [animate, setAnimate] = useState(true)
  const [thinning, setThinning] = useState(0.9)

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#020a18' }}>
      <div style={PANEL_STYLE}>
        <label>
          <input type="checkbox" checked={lite} onChange={(ev) => setLite(ev.target.checked)} /> lite
        </label>
        <label>
          <input type="checkbox" checked={animate} onChange={(ev) => setAnimate(ev.target.checked)} /> анимация
        </label>
        <label style={{ opacity: animate ? 0.45 : 1 }}>
          thinning{' '}
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={thinning}
            disabled={animate}
            onChange={(ev) => setThinning(Number(ev.target.value))}
          />{' '}
          {thinning.toFixed(2)}
        </label>
      </div>
      <Canvas camera={{ position: [0, 0, 10.5], fov: 45 }} gl={{ antialias: true }} dpr={[1, 2]}>
        <color attach="background" args={['#020a18']} />
        <fog attach="fog" args={['#020a18', 14, 30]} />
        <DemoScene lite={lite} animate={animate} thinning={thinning} />
      </Canvas>
    </div>
  )
}
