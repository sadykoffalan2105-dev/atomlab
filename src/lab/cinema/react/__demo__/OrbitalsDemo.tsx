import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import * as THREE from 'three'
import { ang, CPK } from '../../core/atoms'
import { createLobePool, LobeKind, writeVec3, type LobePool } from '../../core/pools'
import { LOBE_P_BOUNDS } from '../../core/orbitalLobeShader'
import { OrbitalLobes } from '../OrbitalLobes'
import { OrbitalRaymarch } from '../OrbitalRaymarch'

/**
 * Демо орбиталей (в приложение НЕ импортируется).
 *
 * Слева — OrbitalLobes (все уровни качества): 2b1 (π*) ClO₂ из трёх
 * p-лепестков, перпендикулярных плоскости O–Cl–O, заселённость 0.5.
 * Справа — OrbitalRaymarch (cinematic): та же ЛКАО честной суммой слейтеровских функций.
 * Внизу — проверка остальных режимов лепестков: неподелённая пара (occ 1),
 * заполненная p (occ 1) и пустая p (occ 0, только кромка — как σ*).
 *
 * Коэффициенты правдоподобные, НЕ из расчёта: Cl +0.66, O −0.53, −0.53.
 * ζ по правилам Слейтера: Cl 3p 2.03 бор⁻¹ ≈ 13.5, O 2p 2.28 бор⁻¹ ≈ 15.1 ед. сцены⁻¹.
 *
 * Как посмотреть (dev-сервер Vite запущен): открыть приложение, в консоли DevTools
 *   (await import('/src/lab/cinema/react/__demo__/mountOrbitalsDemo.ts')).mountOrbitalsDemo()
 * — демо откроется поверх страницы на весь экран; вызов возвращает функцию закрытия.
 */

const ZETA_CL = 13.5
const ZETA_O = 15.1
const COEF_CL = 0.66
const COEF_O = -0.53
/** Cl–O 1.47 Å, ∠O–Cl–O 117.4° — геометрия ClO₂. */
const BOND = ang(1.47)
const HALF_ANGLE = ((117.4 / 2) * Math.PI) / 180
const O_X = Math.sin(HALF_ANGLE) * BOND
const O_Y = -Math.cos(HALF_ANGLE) * BOND

/**
 * Длина лепестка при |coef| = 1. Кончик 30%-изоповерхности собственной АО —
 * tipAxial·r₀, r₀ = 1/ζ; деление на √|c_max| компенсирует √|coef| в OrbitalLobes,
 * и сильнейшая АО получается того же размера, что у рэймарчинга с iso = 0.3.
 */
function lobeSize(zeta: number): number {
  return LOBE_P_BOUNDS.tipAxial / zeta / Math.sqrt(COEF_CL)
}

function writeLobeEntry(
  pool: LobePool,
  i: number,
  c: [number, number, number],
  axis: [number, number, number],
  size: number,
  coef: number,
  kind: number,
  occupancy: number,
): void {
  writeVec3(pool.center, i, c[0], c[1], c[2])
  writeVec3(pool.axis, i, axis[0], axis[1], axis[2])
  pool.size[i] = size
  pool.coef[i] = coef
  pool.kind[i] = kind
  pool.occupancy[i] = occupancy
  pool.opacity[i] = 1
}

function createDemoPool(): LobePool {
  const pool = createLobePool(8)
  const z: [number, number, number] = [0, 0, 1]
  // 2b1: лепестки над/под плоскостью молекулы, фаза на Cl против фазы на O.
  writeLobeEntry(pool, 0, [0, 0, 0], z, lobeSize(ZETA_CL), COEF_CL, LobeKind.p, 0.5)
  writeLobeEntry(pool, 1, [O_X, O_Y, 0], z, lobeSize(ZETA_O), COEF_O, LobeKind.p, 0.5)
  writeLobeEntry(pool, 2, [-O_X, O_Y, 0], z, lobeSize(ZETA_O), COEF_O, LobeKind.p, 0.5)
  // Нижний ряд: остальные режимы.
  const row = -0.62
  writeLobeEntry(pool, 3, [-0.34, row, 0], [0.7, 0.7, 0], 0.26, 0.9, LobeKind.lonePair, 1)
  writeLobeEntry(pool, 4, [0, row, 0], [0, 1, 0], 0.22, 1, LobeKind.p, 1)
  writeLobeEntry(pool, 5, [0.34, row, 0], [0, 1, 0], 0.22, 1, LobeKind.p, 0)
  pool.count = 6
  pool.version = 1
  return pool
}

function createRaymarchInput() {
  return {
    atoms: new Float32Array([0, 0, 0, O_X, O_Y, 0, -O_X, O_Y, 0]),
    coefs: new Float32Array([COEF_CL, COEF_O, COEF_O]),
    zeta: new Float32Array([ZETA_CL, ZETA_O, ZETA_O]),
    normal: new THREE.Vector3(0, 0, 1),
  }
}

/** Наклон плоскости молекулы к камере: лепестки над/под плоскостью видны сбоку. */
const TILT: [number, number, number] = [-1.1, 0.35, 0]

function tickTime(time: { current: number }, elapsed: number): void {
  time.current = elapsed
}

function Atom({ position, radius, color }: { position: [number, number, number]; radius: number; color: number }) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[radius, 24, 16]} />
      <meshStandardMaterial color={color} roughness={0.35} metalness={0.05} />
    </mesh>
  )
}

function Clo2Atoms() {
  return (
    <>
      <Atom position={[0, 0, 0]} radius={ang(0.36)} color={CPK.Cl} />
      <Atom position={[O_X, O_Y, 0]} radius={ang(0.3)} color={CPK.O} />
      <Atom position={[-O_X, O_Y, 0]} radius={ang(0.3)} color={CPK.O} />
    </>
  )
}

function DemoScene() {
  const pool = useMemo(() => createDemoPool(), [])
  const input = useMemo(() => createRaymarchInput(), [])
  const time = useRef(0)

  useFrame((s) => tickTime(time, s.clock.elapsedTime))

  return (
    <>
      <color attach="background" args={['#02030a']} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[2, 3, 4]} intensity={1.6} />

      {/* Масштаб группы проверяет, что оба рендерера учитывают масштаб рига. */}
      <group position={[-0.95, 0.25, 0]} rotation={TILT} scale={2.2}>
        <Clo2Atoms />
        <Atom position={[-0.34, -0.62, 0]} radius={ang(0.2)} color={CPK.N} />
        <Atom position={[0, -0.62, 0]} radius={ang(0.2)} color={CPK.O} />
        <Atom position={[0.34, -0.62, 0]} radius={ang(0.2)} color={CPK.Cl} />
        <OrbitalLobes pool={pool} time={time} />
      </group>

      <group position={[0.95, 0.25, 0]} rotation={TILT} scale={2.2}>
        <Clo2Atoms />
        <OrbitalRaymarch
          atoms={input.atoms}
          coefs={input.coefs}
          zeta={input.zeta}
          normal={input.normal}
          iso={0.3}
          opacity={0.9}
        />
      </group>

      <OrbitControls makeDefault enableDamping />
      <EffectComposer>
        <Bloom intensity={0.5} luminanceThreshold={0.55} mipmapBlur />
      </EffectComposer>
    </>
  )
}

export function OrbitalsDemo() {
  return (
    <Canvas camera={{ position: [0.4, 0.5, 4.4], fov: 45 }} dpr={[1, 2]}>
      <DemoScene />
    </Canvas>
  )
}
