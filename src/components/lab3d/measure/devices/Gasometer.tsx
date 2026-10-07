/**
 * Газометр 1 л (цена деления 10 мл, ±5 мл) с напорной склянкой: градуированный стеклянный сосуд с газом, внизу —
 * запорная жидкость (вазелиновое масло: HCl и другие растворимые газы в нём почти не растворяются). Склянка с маслом
 * стоит выше на подставке и соединена шлангом с низом газометра: когда открыт кран газа наверху, масло перетекает
 * в газометр и вытесняет газ в трубку. Шкала — от «0» внизу: уровень масла = сколько газа вышло (мл).
 * Начало координат — центр основания газометра на столе; выход газа — кран наверху, трубка влево (−X);
 * напорная склянка — справа (+X). Объём масла в газометре и в склянке связан: что ушло из склянки, пришло в газометр.
 */
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { labLiquidMaterial } from '../../labContract'
import { useRig, type PFn, type V3 } from '../../experiments/rigCore'
import { sharedGlass, sharedGlassEdge } from '../../experiments/parts/glassware'
import { GlassPath } from '../../experiments/parts/practicalware'
import { RubberHose } from '../../experiments/rigs/worksKit'
import { scaleTexture, SCALE_TEX_PAD, type ScaleSpec } from './deviceTextures'

const RI = 0.045
const SCALE_H = 1000e-6 / (Math.PI * RI * RI)
export const GASOMETER = {
  ri: RI,
  ro: RI + 0.0016,
  foot: 0.01,
  floor: 0.016,
  /** Риска «0» (масло ниже — гидрозатвор). */
  y0: 0.03,
  scaleH: SCALE_H,
  top: 0.03 + SCALE_H + 0.016,
  /** Кран газа (центр) и конец выходной трубки (сюда надевают шланг). */
  tap: [-0.016, 0.03 + SCALE_H + 0.042, 0] as V3,
  outlet: [-0.04, 0.03 + SCALE_H + 0.042, 0] as V3,
  /** Напорная склянка: центр дна (на подставке), внутренний радиус, высота. */
  bottle: [0.135, 0.13, 0] as V3,
  bottleRi: 0.042,
  bottleH: 0.15,
  capacity: 1000,
} as const

/** Высота уровня масла в газометре (м от основания) для отсчёта r мл. */
export function gasometerLevelY(r: number): number {
  return GASOMETER.y0 + (r / GASOMETER.capacity) * GASOMETER.scaleH
}

const OIL = '#efdf9a'
/** Масло в склянке до опыта (мл). */
const BOTTLE_OIL = 820

/**
 * passed(p) — отсчёт по шкале (мл газа, вышедшего из газометра), tap(p) 0…1 — кран газа (ручка вдоль трубки — открыт).
 */
export function Gasometer({ passed, tap }: { passed: PFn; tap: PFn }) {
  const { quality, p } = useRig()
  const seg = quality === 'high' ? 40 : 22
  const { ri, ro, foot, floor, top } = GASOMETER
  const vessel = useMemo(() => {
    const pts = [
      new THREE.Vector2(0.0001, foot),
      new THREE.Vector2(ro - 0.004, foot),
      new THREE.Vector2(ro, foot + 0.004),
      new THREE.Vector2(ro, top - 0.012),
      new THREE.Vector2(0.006, top + 0.004),
      new THREE.Vector2(0.0045, top + 0.004),
      new THREE.Vector2(ri - 0.003, top - 0.013),
      new THREE.Vector2(ri, top - 0.016),
      new THREE.Vector2(ri, floor),
      new THREE.Vector2(0.0001, floor),
    ]
    return new THREE.LatheGeometry(pts, seg)
  }, [seg, ri, ro, foot, floor, top])
  const bottleGeo = useMemo(() => {
    const r = GASOMETER.bottleRi
    const h = GASOMETER.bottleH
    const pts = [
      new THREE.Vector2(0.0001, 0),
      new THREE.Vector2(r - 0.002, 0),
      new THREE.Vector2(r + 0.0015, 0.004),
      new THREE.Vector2(r + 0.0015, h - 0.02),
      new THREE.Vector2(0.016, h - 0.004),
      new THREE.Vector2(0.016, h),
      new THREE.Vector2(0.0145, h),
      new THREE.Vector2(0.0145, h - 0.005),
      new THREE.Vector2(r, h - 0.021),
      new THREE.Vector2(r, 0.003),
      new THREE.Vector2(0.0001, 0.003),
    ]
    return new THREE.LatheGeometry(pts, seg)
  }, [seg])
  // без подписи производителя: у верхней риски «1000» ей нет места
  const spec = useMemo<ScaleSpec>(() => ({ capacity: 1000, division: 10, majorEvery: 100, labelEvery: 100 }), [])
  const tex = useMemo(() => scaleTexture(spec), [spec])
  const oil = useMemo(() => labLiquidMaterial(OIL, 0.78), [])
  const footMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2f3740', roughness: 0.6 }), [])
  const wood = useMemo(() => new THREE.MeshStandardMaterial({ color: '#b98a5a', roughness: 0.8 }), [])
  const ptfe = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f4f6f8', roughness: 0.55 }), [])
  const col = useRef<THREE.Mesh>(null)
  const bcol = useRef<THREE.Mesh>(null)
  const handle = useRef<THREE.Group>(null)
  useFrame(() => {
    const pv = p.current ?? 0
    const r = Math.max(0, passed(pv))
    const y = gasometerLevelY(r)
    if (col.current) {
      const h = y - floor
      col.current.scale.set(1, h, 1)
      col.current.position.y = floor + h / 2
    }
    if (bcol.current) {
      const ml = BOTTLE_OIL - r
      const h = ml / 1e6 / (Math.PI * GASOMETER.bottleRi ** 2)
      bcol.current.scale.set(1, Math.max(1e-4, h), 1)
      bcol.current.position.y = 0.003 + h / 2
    }
    if (handle.current) handle.current.rotation.z = (Math.PI / 2) * (1 - Math.max(0, Math.min(1, tap(pv))))
  })
  const bandH = GASOMETER.scaleH / (1 - 2 * SCALE_TEX_PAD)
  const B = GASOMETER.bottle
  const T = GASOMETER.tap
  return (
    <group>
      {/* подставка-основание и газометр */}
      <mesh position={[0, foot / 2, 0]} material={footMat} castShadow receiveShadow>
        <cylinderGeometry args={[ro + 0.012, ro + 0.014, foot, 32]} />
      </mesh>
      <mesh geometry={vessel} material={sharedGlass(quality)} renderOrder={3} />
      <mesh geometry={vessel} material={sharedGlassEdge()} renderOrder={4} />
      <mesh position={[0, GASOMETER.y0 + GASOMETER.scaleH / 2, 0]} renderOrder={5}>
        <cylinderGeometry args={[ro + 0.0004, ro + 0.0004, bandH, 32, 1, true, -0.55, 1.1]} />
        <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={col} material={oil} renderOrder={2}>
        <cylinderGeometry args={[ri - 0.0004, ri - 0.0004, 1, 36]} />
      </mesh>
      {/* горло, кран газа и выходная трубка */}
      <GlassPath points={[[0, top, 0], [0, T[1] - 0.006, 0], [-0.006, T[1], 0], GASOMETER.outlet]} radius={0.0032} />
      <mesh position={T as unknown as THREE.Vector3Tuple} rotation={[Math.PI / 2, 0, 0]} material={sharedGlass(quality)} renderOrder={3}>
        <cylinderGeometry args={[0.0052, 0.0046, 0.02, 14]} />
      </mesh>
      <mesh position={T as unknown as THREE.Vector3Tuple} rotation={[Math.PI / 2, 0, 0]} material={ptfe}>
        <cylinderGeometry args={[0.0042, 0.0036, 0.026, 12]} />
      </mesh>
      <group ref={handle} position={[T[0], T[1], 0.0145]}>
        <mesh material={ptfe} castShadow>
          <boxGeometry args={[0.022, 0.005, 0.0035]} />
        </mesh>
      </group>
      {/* напорная склянка с маслом на деревянной подставке, шланг от её тубуса к низу газометра */}
      <mesh position={[B[0], B[1] / 2, B[2]]} material={wood} castShadow receiveShadow>
        <boxGeometry args={[0.1, B[1], 0.1]} />
      </mesh>
      <group position={B as unknown as THREE.Vector3Tuple}>
        <mesh geometry={bottleGeo} material={sharedGlass(quality)} renderOrder={3} />
        <mesh geometry={bottleGeo} material={sharedGlassEdge()} renderOrder={4} />
        <mesh ref={bcol} material={oil} renderOrder={2}>
          <cylinderGeometry args={[GASOMETER.bottleRi - 0.0004, GASOMETER.bottleRi - 0.0004, 1, 32]} />
        </mesh>
        {/* нижний тубус склянки */}
        <mesh position={[-GASOMETER.bottleRi - 0.008, 0.012, 0]} rotation={[0, 0, Math.PI / 2]} material={sharedGlass(quality)} renderOrder={3}>
          <cylinderGeometry args={[0.0042, 0.0042, 0.016, 10]} />
        </mesh>
      </group>
      {/* нижний тубус газометра */}
      <mesh position={[ro + 0.007, floor + 0.006, 0]} rotation={[0, 0, Math.PI / 2]} material={sharedGlass(quality)} renderOrder={3}>
        <cylinderGeometry args={[0.0042, 0.0042, 0.014, 10]} />
      </mesh>
      <RubberHose
        ends={() => [
          [ro + 0.014, floor + 0.006, 0],
          [B[0] - GASOMETER.bottleRi - 0.016, B[1] + 0.012, 0],
        ]}
        dirs={() => [
          [1, 0, 0],
          [-1, 0, 0],
        ]}
        sag={0.02}
        color="#6b2e24"
      />
    </group>
  )
}

/** Точка отсчёта на шкале газометра (координаты газометра) — для крупного плана. */
export const gasometerReadAt = (r: number): V3 => [0, gasometerLevelY(r), GASOMETER.ro]
