/**
 * Бюретка 25 мл (цена деления 0,1 мл, ±0,05 мл) с краном и штатив для неё.
 *  • шкала «0» сверху, «25» внизу — своя текстура высокого разрешения (риски 0,1 мл читаются на крупном плане);
 *  • уровень — из геометрии: отсчёт r мл ↔ высота мениска (внутренний радиус 5,5 мм → 25 мл на 263 мм);
 *  • мениск вогнутый: поверхность — на уровне отсчёта (нижний край), у стенок — подъём ~1 мм;
 *  • кран из фторопласта: ручка поперёк трубки — закрыт, вдоль — открыт; из носика — тонкая струйка.
 * Начало координат бюретки — конец носика (самая нижняя точка), ось вверх. Шкала смотрит на ученика (+Z).
 */
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { LAB_COLORS, labLiquidMaterial } from '../../labContract'
import { useRig, type PFn, type V3 } from '../../experiments/rigCore'
import { sharedGlass, sharedGlassEdge } from '../../experiments/parts/glassware'

const RI = 0.0055
const SCALE_H = 25e-6 / (Math.PI * RI * RI)
export const BURETTE = {
  ri: RI,
  ro: RI + 0.0013,
  /** Высота центра крана над концом носика. */
  cockY: 0.042,
  /** Начало широкой трубки (над краном — переход). */
  boreY: 0.068,
  /** Риска «25 мл». */
  y25: 0.075,
  scaleH: SCALE_H,
  /** Риска «0». */
  y0: 0.075 + SCALE_H,
  /** Верхний край. */
  top: 0.075 + SCALE_H + 0.032,
  capacity: 25,
} as const

/** Высота мениска (м от конца носика) для отсчёта r мл (r < 0 — налито выше нуля). */
export function buretteLevelY(r: number): number {
  return BURETTE.y0 - (r / BURETTE.capacity) * BURETTE.scaleH
}

const PAD = 0.03
let scaleTex: THREE.CanvasTexture | null = null
/** Шкала бюретки: 0…25 мл сверху вниз, риски через 0,1 мл, цифры через 1 мл. */
function buretteScaleTexture(): THREE.CanvasTexture {
  if (scaleTex) return scaleTex
  const W = 160
  const H = 4096
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')
  if (!g) throw new Error('canvas 2d недоступен')
  g.clearRect(0, 0, W, H)
  const ink = '#1f3f8f'
  g.strokeStyle = ink
  g.fillStyle = ink
  const pad = PAD * H
  const usable = H - 2 * pad
  const font = 'system-ui, "Segoe UI", Arial, sans-serif'
  for (let i = 0; i <= 250; i++) {
    const y = pad + (i / 250) * usable
    const major = i % 10 === 0
    const half = i % 5 === 0
    g.lineWidth = major ? 4.5 : half ? 3.2 : 2.4
    g.beginPath()
    g.moveTo(4, y)
    g.lineTo(4 + (major ? 62 : half ? 44 : 26), y)
    g.stroke()
    if (major) {
      g.font = `700 58px ${font}`
      g.textAlign = 'left'
      g.textBaseline = 'middle'
      g.fillText(String(i / 10), 76, y)
    }
  }
  g.font = `600 26px ${font}`
  g.textAlign = 'left'
  g.textBaseline = 'middle'
  g.fillText('25 ml', 70, pad * 0.32)
  g.fillText('20 °C', 70, pad * 0.72)
  g.fillText('± 0,05', 70, H - pad * 0.5)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  scaleTex = t
  return t
}

/**
 * Бюретка. reading(p) — отсчёт по мениску (мл; null — пустая), open(p) 0…1 — кран (ручка поворачивается),
 * flow(p) — идёт ли струйка из носика (0…1), streamTo(p) — до какой высоты (м, ниже носика — отрицательная) падает
 * струйка, color — цвет раствора.
 */
export function Burette({ reading, open, flow, streamTo, color = '#b9d3f1' }: { reading: (p: number) => number | null; open: PFn; flow: PFn; streamTo: PFn; color?: string }) {
  const { quality, p } = useRig()
  const seg = quality === 'high' ? 28 : 16
  const glass = useMemo(() => {
    const { ri, ro, boreY, top } = BURETTE
    const pts = [
      new THREE.Vector2(0.0009, 0),
      new THREE.Vector2(0.0017, 0),
      new THREE.Vector2(0.0027, 0.03),
      new THREE.Vector2(0.003, 0.054),
      new THREE.Vector2(ro, boreY),
      new THREE.Vector2(ro, top - 0.002),
      new THREE.Vector2(ro + 0.0012, top),
      new THREE.Vector2(ri, top),
      new THREE.Vector2(ri, boreY + 0.002),
      new THREE.Vector2(0.0018, 0.054),
      new THREE.Vector2(0.0014, 0.03),
      new THREE.Vector2(0.0009, 0.001),
    ]
    return new THREE.LatheGeometry(pts, seg)
  }, [seg])
  const ptfe = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f4f6f8', roughness: 0.55 }), [])
  const blue = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2f6fd1', roughness: 0.5 }), [])
  const liq = useMemo(() => labLiquidMaterial(color, 0.72), [color])
  // мениск чуть темнее раствора: так его нижний край виден на фоне белой шкалы
  const menMat = useMemo(() => labLiquidMaterial(new THREE.Color(color).multiplyScalar(0.72).getStyle(), 0.9), [color])
  const tex = useMemo(buretteScaleTexture, [])
  const col = useRef<THREE.Mesh>(null)
  const men = useRef<THREE.Mesh>(null)
  const narrow = useRef<THREE.Mesh>(null)
  const handle = useRef<THREE.Group>(null)
  const stream = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const pv = p.current ?? 0
    const r = reading(pv)
    const filled = r != null && r < BURETTE.capacity + 0.5
    const y = filled ? buretteLevelY(r) : 0
    const h = Math.max(0, y - BURETTE.boreY)
    if (col.current) {
      col.current.visible = filled && h > 0.0005
      col.current.scale.set(1, Math.max(1e-4, h), 1)
      col.current.position.y = BURETTE.boreY + h / 2
    }
    if (men.current) {
      men.current.visible = filled && h > 0.002
      men.current.position.y = y + 0.0007
    }
    if (narrow.current) narrow.current.visible = filled
    if (handle.current) handle.current.rotation.z = (Math.PI / 2) * Math.max(0, Math.min(1, open(pv)))
    const s = stream.current
    if (s) {
      const k = flow(pv)
      const to = streamTo(pv)
      s.visible = k > 0.02 && to < -0.004
      if (s.visible) {
        const len = -to
        s.scale.set(0.35 + 0.65 * k, len, 0.35 + 0.65 * k)
        s.position.y = -len / 2
      }
    }
  })
  const bandH = BURETTE.scaleH / (1 - 2 * PAD)
  return (
    <group>
      <mesh geometry={glass} material={sharedGlass(quality)} renderOrder={3} />
      <mesh geometry={glass} material={sharedGlassEdge()} renderOrder={4} />
      {/* шкала на передней дуге: v = 1 текстуры — «0» сверху */}
      <mesh position={[0, BURETTE.y25 + BURETTE.scaleH / 2, 0]} renderOrder={5}>
        <cylinderGeometry args={[BURETTE.ro + 0.0004, BURETTE.ro + 0.0004, bandH, 24, 1, true, -0.8, 1.6]} />
        <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      {/* раствор: широкая часть, мениск, узкая часть над краном и в носике */}
      <mesh ref={col} material={liq} renderOrder={2}>
        <cylinderGeometry args={[BURETTE.ri - 0.0003, BURETTE.ri - 0.0003, 1, 24]} />
      </mesh>
      <mesh ref={men} rotation={[Math.PI / 2, 0, 0]} material={menMat} renderOrder={2}>
        <torusGeometry args={[BURETTE.ri - 0.0011, 0.0011, 6, 24]} />
      </mesh>
      <mesh ref={narrow} position={[0, (BURETTE.boreY + 0.002) / 2, 0]} material={liq} renderOrder={2}>
        <cylinderGeometry args={[0.0012, 0.0008, BURETTE.boreY - 0.002, 10]} />
      </mesh>
      {/* кран: стеклянная муфта поперёк (к ученику), фторопластовый ключ, ручка */}
      <mesh position={[0, BURETTE.cockY, 0]} rotation={[Math.PI / 2, 0, 0]} material={sharedGlass(quality)} renderOrder={3}>
        <cylinderGeometry args={[0.0046, 0.004, 0.02, 16]} />
      </mesh>
      <mesh position={[0, BURETTE.cockY, 0]} rotation={[Math.PI / 2, 0, 0]} material={ptfe}>
        <cylinderGeometry args={[0.0036, 0.0031, 0.026, 14]} />
      </mesh>
      <mesh position={[0, BURETTE.cockY, -0.0145]} rotation={[Math.PI / 2, 0, 0]} material={blue}>
        <cylinderGeometry args={[0.0034, 0.0034, 0.004, 12]} />
      </mesh>
      <group ref={handle} position={[0, BURETTE.cockY, 0.0145]}>
        <mesh material={ptfe} castShadow>
          <boxGeometry args={[0.019, 0.0046, 0.0035]} />
        </mesh>
      </group>
      {/* струйка из носика */}
      <mesh ref={stream} material={liq} renderOrder={2}>
        <cylinderGeometry args={[0.0007, 0.0005, 1, 8]} />
      </mesh>
    </group>
  )
}

/**
 * Штатив для бюретки (координаты установки): плита и стержень позади, муфта, лапка-«бабочка» с резиновыми
 * накладками обхватывает бюретку. rod — [x, z] стержня, at — [x, z] оси бюретки, clampY — высота лапки, rodH — стержень.
 */
export function BuretteStand({ rod, at, clampY, rodH = 0.62 }: { rod: readonly [number, number]; at: readonly [number, number]; clampY: number; rodH?: number }) {
  const paint = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4f5b68', roughness: 0.55, metalness: 0.2 }), [])
  const steel = useMemo(() => new THREE.MeshStandardMaterial({ color: LAB_COLORS.metal, roughness: 0.28, metalness: 0.85 }), [])
  const rubber = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3a3f46', roughness: 0.9 }), [])
  const dx = at[0] - rod[0]
  const dz = at[1] - rod[1]
  const len = Math.hypot(dx, dz)
  const yaw = Math.atan2(dx, dz)
  const jaw = BURETTE.ro + 0.0018
  // плита — позади стержня (от бюретки), чтобы не заходить под соседние приборы
  const ux = len > 0 ? dx / len : 0
  const uz = len > 0 ? dz / len : 1
  return (
    <group>
      <mesh position={[rod[0] - ux * 0.055, 0.007, rod[1] - uz * 0.055]} rotation={[0, yaw, 0]} material={paint} castShadow receiveShadow>
        <boxGeometry args={[0.12, 0.014, 0.19]} />
      </mesh>
      <mesh position={[rod[0], 0.014 + rodH / 2, rod[1]]} material={steel} castShadow>
        <cylinderGeometry args={[0.0055, 0.0055, rodH, 14]} />
      </mesh>
      <mesh position={[rod[0], clampY, rod[1]]} rotation={[0, yaw, 0]} material={paint} castShadow>
        <boxGeometry args={[0.022, 0.026, 0.022]} />
      </mesh>
      {/* стержень лапки от муфты к зажиму */}
      <group position={[rod[0], clampY, rod[1]]} rotation={[0, yaw, 0]}>
        <mesh position={[0, 0, (len - jaw - 0.006) / 2]} rotation={[Math.PI / 2, 0, 0]} material={steel} castShadow>
          <cylinderGeometry args={[0.0032, 0.0032, len - jaw - 0.006, 10]} />
        </mesh>
        {/* зажим: задняя планка и две губки по бокам бюретки */}
        <mesh position={[0, 0, len - jaw - 0.004]} material={paint}>
          <boxGeometry args={[2 * jaw + 0.008, 0.016, 0.004]} />
        </mesh>
        {[-1, 1].map((s) => (
          <group key={s} position={[s * (jaw + 0.002), 0, len]}>
            <mesh material={paint}>
              <boxGeometry args={[0.004, 0.016, 2 * jaw + 0.006]} />
            </mesh>
            <mesh position={[-s * 0.0025, 0, 0]} material={rubber}>
              <boxGeometry args={[0.0012, 0.014, 0.012]} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  )
}

/** Точка на бюретке (координаты бюретки) — для подписи/крупного плана у мениска при отсчёте r. */
export const buretteReadAt = (r: number): V3 => [0, buretteLevelY(r), 0]
