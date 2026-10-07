/**
 * Градуированная пипетка 2 мл (Мора, «на вылив»): цена деления 0,02 мл, цифры через 0,2 мл, «0» — вверху,
 * «2» — внизу (отсчёт показывает, сколько вылито). Сверху — резиновая груша. Начало — кончик (низ), ось — вверх.
 * level(p) — высота мениска над кончиком (м): helper gradPipetteLevel(мл по шкале) переводит отсчёт в высоту.
 * Внутренний радиус шкальной части выведен из геометрии: 2 мл на 180 мм шкалы → ri ≈ 1,88 мм.
 */
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { labLiquidMaterial } from '../../labContract'
import { useRig, type PFn } from '../../experiments/rigCore'
import { sharedGlass, sharedGlassEdge } from '../../experiments/parts/glassware'

/** Размеры пипетки (м). zero — риска «0», span — длина шкалы 0…2 мл, top — верхний конец стекла. */
export const GRAD_PIPETTE = {
  capacity: 2,
  ri: 0.00188,
  ro: 0.0034,
  tipLen: 0.032,
  zero: 0.262,
  span: 0.18,
  top: 0.3,
  bulbR: 0.0105,
  bulbLen: 0.034,
} as const

/** Высота мениска над кончиком для отсчёта по шкале (мл; отрицательное — выше нуля при наборе). */
export function gradPipetteLevel(readingMl: number): number {
  return GRAD_PIPETTE.zero - (readingMl / GRAD_PIPETTE.capacity) * GRAD_PIPETTE.span
}

let scaleTex: THREE.CanvasTexture | null = null
/** Шкала пипетки: «0» вверху, риски через 0,02 мл, длинные через 0,1 мл, цифры через 0,2 мл (запятая). */
function pipetteScaleTexture(): THREE.CanvasTexture {
  if (scaleTex) return scaleTex
  const W = 128
  const H = 2048
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  g.clearRect(0, 0, W, H)
  const PAD = 40
  const usable = H - 2 * PAD
  g.strokeStyle = '#1f3f8f'
  g.fillStyle = '#1f3f8f'
  for (let i = 0; i <= 100; i++) {
    const y = PAD + (i / 100) * usable
    const major = i % 5 === 0
    const labeled = i % 10 === 0
    g.lineWidth = major ? 4 : 2.2
    g.beginPath()
    g.moveTo(4, y)
    g.lineTo(4 + (labeled ? 52 : major ? 38 : 22), y)
    g.stroke()
    if (labeled) {
      g.font = '700 30px system-ui, "Segoe UI", Arial, sans-serif'
      g.textAlign = 'left'
      g.textBaseline = 'middle'
      const v = i / 50
      g.fillText(i === 0 ? '0' : v.toFixed(1).replace('.', ','), 62, y)
    }
  }
  g.font = '600 20px system-ui, "Segoe UI", Arial, sans-serif'
  g.fillText('2 ml', 60, PAD * 0.45)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  scaleTex = t
  return t
}

export function GradPipette({ level, color, squeeze }: { level: PFn; color: string; squeeze?: PFn }) {
  const { quality, p } = useRig()
  const P = GRAD_PIPETTE
  const glassGeo = useMemo(() => {
    const pts = [
      new THREE.Vector2(0.0006, 0),
      new THREE.Vector2(0.0009, 0.0006),
      new THREE.Vector2(0.0016, P.tipLen * 0.6),
      new THREE.Vector2(P.ro, P.tipLen),
      new THREE.Vector2(P.ro, P.top),
      new THREE.Vector2(P.ri + 0.0002, P.top),
    ]
    return new THREE.LatheGeometry(pts, quality === 'high' ? 16 : 10)
  }, [quality, P.ro, P.ri, P.top, P.tipLen])
  const liq = useMemo(() => labLiquidMaterial(color, 0.8), [color])
  const tex = useMemo(pipetteScaleTexture, [])
  const rubber = useMemo(() => new THREE.MeshStandardMaterial({ color: '#b8322a', roughness: 0.6 }), [])
  const col = useRef<THREE.Mesh>(null)
  const tip = useRef<THREE.Mesh>(null)
  const bulb = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const pv = p.current ?? 0
    const lv = Math.min(P.top - 0.004, Math.max(0, level(pv)))
    const m = col.current
    if (m) {
      const h = Math.max(0, lv - P.tipLen)
      m.visible = h > 0.0005
      m.scale.set(1, Math.max(1e-4, h), 1)
      m.position.y = P.tipLen + h / 2
    }
    if (tip.current) tip.current.visible = lv > 0.004
    if (bulb.current) {
      const k = squeeze ? squeeze(pv) : 0
      bulb.current.scale.set(1 - 0.32 * k, 1 + 0.1 * k, 1 - 0.32 * k)
    }
  })
  const bandH = P.span / (1 - 2 * (40 / 2048))
  return (
    <group>
      <mesh geometry={glassGeo} material={sharedGlass(quality)} renderOrder={3} />
      <mesh geometry={glassGeo} material={sharedGlassEdge()} renderOrder={4} />
      {/* шкала на передней дуге: «0» вверху (y = zero), «2» внизу */}
      <mesh position={[0, P.zero - P.span / 2, 0]} renderOrder={5}>
        <cylinderGeometry args={[P.ro + 0.0003, P.ro + 0.0003, bandH, 16, 1, true, -1.2, 2.4]} />
        <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      {/* раствор: в оттянутом кончике и столбик до мениска */}
      <mesh ref={tip} position={[0, P.tipLen * 0.5, 0]} material={liq} renderOrder={2}>
        <cylinderGeometry args={[P.ri * 0.95, 0.0005, P.tipLen * 0.95, 8]} />
      </mesh>
      <mesh ref={col} material={liq} renderOrder={2}>
        <cylinderGeometry args={[P.ri * 0.95, P.ri * 0.95, 1, 10]} />
      </mesh>
      {/* груша надета на верхний конец */}
      <mesh position={[0, P.top - 0.004, 0]} material={rubber}>
        <cylinderGeometry args={[P.ro + 0.0012, P.ro + 0.0018, 0.012, 14]} />
      </mesh>
      <mesh ref={bulb} position={[0, P.top + 0.002 + P.bulbLen / 2 + P.bulbR * 0.4, 0]} material={rubber} castShadow>
        <capsuleGeometry args={[P.bulbR, P.bulbLen * 0.55, 6, 16]} />
      </mesh>
    </group>
  )
}
