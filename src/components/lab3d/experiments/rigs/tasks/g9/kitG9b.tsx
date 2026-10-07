/**
 * Детали установок задач-опытов Kimyo 9 (агент «b»): штатив для градуированной пипетки, бумажная этикетка-поясок
 * на стакане, цвет раствора по прогрессу, пробирка для прокаливания в лапке (наклон отверстием вниз) с пробкой и
 * газоотводной трубкой. Начало координат — центр рабочего места, верх стола y = 0, ученик смотрит в −Z.
 */
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Pose, ease, mix, mixV, useRig, type PFn, type V3 } from '../../../rigCore'
import { Match, Matchbox, SpiritLamp } from '../../../parts/fire'
import { TUBE_R } from '../../../parts/glassware'
import { jarLabelTexture } from '../../../../measure/devices/deviceTextures'
import { GRAD_PIPETTE } from '../../../../measure/devices/GradPipette'

/* ── Штатив для пипеток ── */

/** Штатив для пипетки (начало — центр основания под кончиком): основание, стойка сзади, кольцо-держатель. */
export const PIPETTE_STAND = { baseTop: 0.012, ringY: 0.2, rodBack: 0.03, rodH: 0.26 } as const

export function PipetteStand() {
  const paint = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4f5b68', roughness: 0.55, metalness: 0.2 }), [])
  const steel = useMemo(() => new THREE.MeshStandardMaterial({ color: '#b9c2cc', roughness: 0.28, metalness: 0.85 }), [])
  const pad = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2b3036', roughness: 0.9 }), [])
  const S = PIPETTE_STAND
  const ringR = GRAD_PIPETTE.ro + 0.0016
  return (
    <group>
      <mesh position={[0, S.baseTop / 2, -0.012]} material={paint} castShadow receiveShadow>
        <boxGeometry args={[0.07, S.baseTop, 0.07]} />
      </mesh>
      {/* резиновая подкладка под кончик */}
      <mesh position={[0, S.baseTop + 0.0005, 0]} material={pad}>
        <cylinderGeometry args={[0.008, 0.008, 0.001, 16]} />
      </mesh>
      <mesh position={[0, S.baseTop + S.rodH / 2, -S.rodBack]} material={steel} castShadow>
        <cylinderGeometry args={[0.004, 0.004, S.rodH, 12]} />
      </mesh>
      {/* лапка с кольцом вокруг пипетки */}
      <mesh position={[0, S.ringY, -(S.rodBack + ringR) / 2]} rotation={[Math.PI / 2, 0, 0]} material={steel}>
        <cylinderGeometry args={[0.0022, 0.0022, S.rodBack - ringR, 8]} />
      </mesh>
      <mesh position={[0, S.ringY, 0]} rotation={[Math.PI / 2, 0, 0]} material={paint}>
        <torusGeometry args={[ringR, 0.0012, 6, 20]} />
      </mesh>
    </group>
  )
}

/* ── Этикетка-поясок ── */

/** Бумажная этикетка на передней стороне сосуда радиуса r (начало — дно), центр на высоте y. */
export function BandTag({ r, y, formula, name, sub = '', h = 0.022, stripe = '#2f7cf6' }: { r: number; y: number; formula: string; name: string; sub?: string; h?: number; stripe?: string }) {
  const tex = useMemo(() => jarLabelTexture(formula, name, sub, stripe), [formula, name, sub, stripe])
  return (
    <mesh position={[0, y, 0]} renderOrder={5}>
      <cylinderGeometry args={[r, r, h, 20, 1, true, -0.8, 1.6]} />
      <meshStandardMaterial map={tex} roughness={0.75} />
    </mesh>
  )
}

/* ── Цвет по прогрессу ── */

/**
 * Цвет раствора как функция прогресса: stops — [p, цвет]; между точками — плавно (ease), до первой и после последней —
 * как в них. Возвращает строку '#rrggbb' (для MeasuringBeaker.color), без новых объектов на кадр.
 */
export function colorTrack(stops: readonly (readonly [number, string])[]): (p: number) => string {
  const cols = stops.map(([, c]) => new THREE.Color(c))
  const tmp = new THREE.Color()
  let lastP = Number.NaN
  let last = stops[0]![1]
  return (p) => {
    if (p === lastP) return last
    lastP = p
    let i = 0
    while (i < stops.length - 1 && p > stops[i + 1]![0]) i++
    if (p <= stops[0]![0]) last = stops[0]![1]
    else if (i >= stops.length - 1) last = stops[stops.length - 1]![1]
    else {
      const a = stops[i]![0]
      const b = stops[i + 1]![0]
      const x = Math.min(1, Math.max(0, (p - a) / (b - a)))
      tmp.copy(cols[i]!).lerp(cols[i + 1]!, x * x * (3 - 2 * x))
      last = `#${tmp.getHexString()}`
    }
    return last
  }
}

/* ── Капли на стенке (конденсат) ── */

/**
 * Капельки воды на внутренней стенке трубки или пробирки вдоль оси (локальная ось −Y → Y): появляются, когда
 * show(p) > 0. r — радиус, где лежат капли (у стенки), y0…y1 — участок оси.
 */
export function WallDroplets({ r, y0, y1, show, n = 22, seed = 1, side = Math.PI / 2 }: { r: number; y0: number; y1: number; show: (p: number) => number; n?: number; seed?: number; /** Угол стороны с каплями (0 — локальная +X). */ side?: number }) {
  const { p } = useRig()
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#dcefff', roughness: 0.04, metalness: 0, transparent: true, opacity: 0.5 }), [])
  const pts = useMemo(() => {
    const out: { x: number; y: number; z: number; s: number; at: number }[] = []
    for (let i = 0; i < n; i++) {
      const u = Math.sin((i + seed * 31) * 127.1) * 43758.5453
      const f = u - Math.floor(u)
      const w = Math.sin((i + seed * 17) * 311.7) * 24634.6345
      const g = w - Math.floor(w)
      // капли — полосой вокруг стороны side (у наклонной пробирки — нижняя, более холодная стенка)
      const a = side + Math.PI * (g - 0.5) * 0.9
      out.push({ x: Math.cos(a) * r, y: y0 + (y1 - y0) * f, z: Math.sin(a) * r, s: 0.0007 + 0.0009 * ((f * 7.3) % 1), at: (g * 3.7) % 1 })
    }
    return out
  }, [n, r, y0, y1, seed])
  const ref = useRef<THREE.InstancedMesh>(null)
  const tmp = useMemo(() => new THREE.Object3D(), [])
  const lastK = useRef(-1)
  useFrame(() => {
    const m = ref.current
    if (!m) return
    const k = show(p.current ?? 0)
    if (Math.abs(k - lastK.current) < 0.01) return
    lastK.current = k
    m.visible = k > 0.01
    pts.forEach((d, i) => {
      tmp.position.set(d.x, d.y, d.z)
      tmp.scale.setScalar(d.at < k ? d.s : 1e-6)
      tmp.updateMatrix()
      m.setMatrixAt(i, tmp.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, n]} material={mat} renderOrder={2} frustumCulled={false}>
      <sphereGeometry args={[1, 8, 6]} />
    </instancedMesh>
  )
}

/* ── Пробирка на весах и в лапке ── */

/**
 * Проволочная подставка для пробирки на весах (начало — центр низа): пластинка-основание, две стойки и кольцо;
 * дно пробирки стоит на пластинке (y = seat), порошок в пробирке виден.
 */
export const TUBE_BLOCK = { w: 0.046, seat: 0.004, ringY: 0.07 } as const
export function TubeBlock() {
  const body = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e7ecef', roughness: 0.55 }), [])
  const wire = useMemo(() => new THREE.MeshStandardMaterial({ color: '#b9c2cc', roughness: 0.3, metalness: 0.85 }), [])
  const ringR = TUBE_R + 0.0018
  return (
    <group>
      <mesh position={[0, TUBE_BLOCK.seat / 2, 0]} material={body} castShadow receiveShadow>
        <cylinderGeometry args={[TUBE_BLOCK.w / 2, TUBE_BLOCK.w / 2, TUBE_BLOCK.seat, 24]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (ringR + 0.0016), TUBE_BLOCK.seat + (TUBE_BLOCK.ringY - TUBE_BLOCK.seat) / 2, 0]} material={wire}>
          <cylinderGeometry args={[0.0013, 0.0013, TUBE_BLOCK.ringY - TUBE_BLOCK.seat, 6]} />
        </mesh>
      ))}
      <mesh position={[0, TUBE_BLOCK.ringY, 0]} rotation={[Math.PI / 2, 0, 0]} material={wire}>
        <torusGeometry args={[ringR, 0.0013, 6, 22]} />
      </mesh>
    </group>
  )
}

/**
 * Штатив с лапкой для почти горизонтальной пробирки (начало — центр зажатого участка пробирки): стержень сзади
 * (−Z на rodBack), муфта, лапка вдоль Z и две губки с пробковыми накладками сверху и снизу пробирки.
 */
export function TubeClampH({ rodBack, tilt = 0 }: { rodBack: number; tilt?: number }) {
  const paint = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4f5b68', roughness: 0.55, metalness: 0.2 }), [])
  const steel = useMemo(() => new THREE.MeshStandardMaterial({ color: '#b9c2cc', roughness: 0.28, metalness: 0.85 }), [])
  const cork = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c49a6c', roughness: 0.9 }), [])
  return (
    <group>
      {/* губки: над и под пробиркой, повёрнуты вместе с её наклоном */}
      <group rotation={[0, 0, tilt]}>
        {[-1, 1].map((s) => (
          <group key={s} position={[0, s * (TUBE_R + 0.004), 0]}>
            <mesh material={paint}>
              <boxGeometry args={[0.03, 0.004, 0.03]} />
            </mesh>
            <mesh position={[0, -s * 0.0028, 0]} material={cork}>
              <boxGeometry args={[0.024, 0.002, 0.024]} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 0, -0.017]} material={paint}>
          <boxGeometry args={[0.03, 2 * (TUBE_R + 0.006), 0.006]} />
        </mesh>
      </group>
      {/* лапка к стержню, муфта, стержень, основание (сзади, под стержнем) */}
      <mesh position={[0, 0, -(rodBack + 0.02) / 2]} rotation={[Math.PI / 2, 0, 0]} material={steel} castShadow>
        <cylinderGeometry args={[0.0035, 0.0035, rodBack - 0.02, 10]} />
      </mesh>
      <mesh position={[0, 0, -rodBack]} material={paint} castShadow>
        <boxGeometry args={[0.024, 0.026, 0.022]} />
      </mesh>
    </group>
  )
}

/** Стержень штатива и основание (начало — низ стержня на столе), основание уходит назад (−Z). */
export function StandRod({ h }: { h: number }) {
  const paint = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4f5b68', roughness: 0.55, metalness: 0.2 }), [])
  const steel = useMemo(() => new THREE.MeshStandardMaterial({ color: '#b9c2cc', roughness: 0.28, metalness: 0.85 }), [])
  return (
    <group>
      <mesh position={[0.02, 0.007, -0.04]} material={paint} castShadow receiveShadow>
        <boxGeometry args={[0.2, 0.014, 0.12]} />
      </mesh>
      <mesh position={[0, 0.014 + h / 2, 0]} material={steel} castShadow>
        <cylinderGeometry args={[0.0055, 0.0055, h, 14]} />
      </mesh>
    </group>
  )
}

/* ── Спиртовка со спичками (зажечь и погасить колпачком) ── */

/**
 * Спиртовка в lamp, коробок в matchbox, спичка: подносят к фитилю на [lightAt, lightAt + 0.3]. capOff(p) 0…1 —
 * колпачок снят (обратно к 0 — колпачком гасят). Пламя flame(p).
 */
export function LampSet({ lamp, matchbox, flame, capOff, lightAt }: { lamp: V3; matchbox: V3; flame: PFn; capOff: PFn; lightAt: number }) {
  const l = lightAt
  return (
    <>
      <group position={lamp as unknown as THREE.Vector3Tuple}>
        <SpiritLamp flame={flame} capOff={capOff} />
      </group>
      <group position={matchbox as unknown as THREE.Vector3Tuple}>
        <Matchbox />
      </group>
      <Pose
        pose={(p) => {
          const rest: V3 = [matchbox[0] - 0.025, 0.018, matchbox[2]]
          const raised: V3 = [matchbox[0] - 0.03, 0.06, matchbox[2] + 0.02]
          const atWick: V3 = [lamp[0] + 0.05, 0.086, lamp[2] + 0.02]
          const dropped: V3 = [matchbox[0] - 0.02, 0.002, matchbox[2] + 0.035]
          let pos = mixV(rest, raised, ease(p, l, l + 0.08))
          pos = mixV(pos, atWick, ease(p, l + 0.08, l + 0.2))
          pos = mixV(pos, dropped, ease(p, l + 0.3, l + 0.42))
          return { pos, rot: [0, mix(Math.PI, Math.PI + 0.4, ease(p, l + 0.3, l + 0.42)), 0] }
        }}
      >
        <Match lit={(p) => ease(p, l + 0.05, l + 0.1) * (1 - ease(p, l + 0.3, l + 0.38))} />
      </Pose>
    </>
  )
}

export type { V3 }
