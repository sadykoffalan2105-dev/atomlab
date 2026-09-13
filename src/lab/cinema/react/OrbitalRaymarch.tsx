import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  createOrbitalRaymarchMaterial,
  ORBITAL_PHASE_PALETTE,
  ORBITAL_RAYMARCH_MAX_ATOMS,
  ORBITAL_RAYMARCH_MAX_STEPS,
  slaterPNorm,
  slaterPPeak,
  slaterPReach,
  type OrbitalPhasePalette,
} from '../core/orbitalLobeShader'

/**
 * Молекулярная π-орбиталь честным рэймарчингом — только cinematic.
 *
 *   ψ(p) = Σ cᵢ · Nᵢ · (n·(p − Rᵢ)) · e^(−ζᵢ|p − Rᵢ|),   Nᵢ = √(ζᵢ⁵/π)
 *
 * — сумма нормированных слейтеровских p-функций, перпендикулярных плоскости
 * молекулы (нормаль n). Для ClO₂ это 2b1 (π*): узловая плоскость совпадает с
 * плоскостью молекулы, лепестки над и под ней, фаза на Cl и на O противоположна.
 *
 * iso — ОТНОСИТЕЛЬНЫЙ изоуровень: ψ масштабирована так, что пик самой сильной
 * отдельной АО (|cᵢ|·Nᵢ/(e·ζᵢ)) равен 1. Поэтому iso не зависит от единиц сцены;
 * 0.2–0.35 даёт привычный «учебниковый» размер лепестков.
 *
 * Бокс ориентирован: z = normal, x — от атома 0 к центроиду остальных (для O–Cl–O
 * с Cl первым это биссектриса угла), y = z × x. Без boxCenter/boxHalfSize бокс
 * подгоняется сам: вокруг каждого атома сфера, вне которой |вклад АО| < iso/n, —
 * там |ψ| < iso гарантированно, так что изоповерхность не обрезается, а
 * заливка пикселей минимальна. boxHalfSize задаётся в осях этого бокса.
 *
 * Глубина: рисуются задние грани бокса после непрозрачных (transparent), depthTest
 * включён, и шейдер пишет gl_FragDepth первой точки изоповерхности — атомы
 * корректно закрывают лепестки за собой без текстуры глубины сцены. Всё, что за
 * первой поверхностью (задние стенки лепестков), композитится поверх, даже если
 * между ними стоит атом, — при полупрозрачной оболочке это незаметно.
 *
 * Стоимость: ≤ 48 шагов × n экспонент на пиксель бокса, ранний выход по
 * накопленной непрозрачности. Держите бокс ≤ 25% экрана.
 */

export type OrbitalRaymarchProps = {
  /** xyz × n — позиции ядер в системе родителя (обычно риг сцены), n ≤ 6 */
  atoms: Float32Array
  /** n — знаковые коэффициенты ЛКАО */
  coefs: Float32Array
  /** n — слейтеровские экспоненты, 1/единица сцены */
  zeta: Float32Array
  /** нормаль плоскости молекулы (ось p-орбиталей); нормируется внутри */
  normal: THREE.Vector3
  /** относительный изоуровень 0..1 (доля пика сильнейшей АО) */
  iso: number
  /** 0..1 */
  opacity: number
  /** центр бокса в системе родителя; по умолчанию — автоподгонка */
  boxCenter?: THREE.Vector3
  /** полуразмеры бокса в его осях (x — к центроиду, y, z — нормаль); по умолчанию — автоподгонка */
  boxHalfSize?: THREE.Vector3
  /** сколько атомов брать из массивов; по умолчанию coefs.length */
  count?: number
  palette?: OrbitalPhasePalette
  renderOrder?: number
}

type RaymarchState = {
  material: THREE.ShaderMaterial
  n: THREE.Vector3
  x: THREE.Vector3
  y: THREE.Vector3
  tmp: THREE.Vector3
  centroid: THREE.Vector3
  lastPositive: number
  lastNegative: number
}

function createRaymarchState(): RaymarchState {
  return {
    material: createOrbitalRaymarchMaterial(),
    n: new THREE.Vector3(),
    x: new THREE.Vector3(),
    y: new THREE.Vector3(),
    tmp: new THREE.Vector3(),
    centroid: new THREE.Vector3(),
    lastPositive: -1,
    lastNegative: -1,
  }
}

let unitBox: THREE.BoxGeometry | null = null
function raymarchBoxGeometry(): THREE.BoxGeometry {
  if (!unitBox) unitBox = new THREE.BoxGeometry(2, 2, 2)
  return unitBox
}

/** Кадр: ЛКАО → uniforms, ориентированный бокс, шаг луча. Без аллокаций. */
function syncRaymarch(state: RaymarchState, mesh: THREE.Mesh | null, p: OrbitalRaymarchProps): void {
  const u = state.material.uniforms
  const count = Math.max(0, Math.min(p.count ?? p.coefs.length, ORBITAL_RAYMARCH_MAX_ATOMS, p.zeta.length, Math.floor(p.atoms.length / 3)))
  const iso = Math.max(1e-3, p.iso)
  const visible = count > 0 && p.opacity > 0.002

  if (mesh) mesh.visible = visible
  if (!visible) return

  // Нормаль и оси бокса.
  const n = state.n.copy(p.normal)
  if (n.lengthSq() < 1e-12) n.set(0, 0, 1)
  n.normalize()
  const atoms = p.atoms
  const centroid = state.centroid.set(0, 0, 0)
  for (let i = 0; i < count; i++) {
    centroid.x += atoms[i * 3]!
    centroid.y += atoms[i * 3 + 1]!
    centroid.z += atoms[i * 3 + 2]!
  }
  centroid.multiplyScalar(1 / count)

  const x = state.x.set(0, 0, 0)
  if (count > 1) {
    for (let i = 1; i < count; i++) {
      x.x += atoms[i * 3]! - atoms[0]!
      x.y += atoms[i * 3 + 1]! - atoms[1]!
      x.z += atoms[i * 3 + 2]! - atoms[2]!
    }
  }
  x.addScaledVector(n, -x.dot(n))
  if (x.lengthSq() < 1e-10) {
    // Один атом или вырожденная геометрия: любая ось в плоскости.
    x.set(Math.abs(n.x) < 0.9 ? 1 : 0, Math.abs(n.x) < 0.9 ? 0 : 1, 0)
    x.addScaledVector(n, -x.dot(n))
  }
  x.normalize()
  const y = state.y.crossVectors(n, x).normalize()
  ;(u.uRot!.value as THREE.Matrix3).set(x.x, y.x, n.x, x.y, y.y, n.y, x.z, y.z, n.z)
  u.uNormal!.value.copy(n)

  // Амплитуды: ψ нормирована на пик сильнейшей АО.
  let peak = 0
  for (let i = 0; i < count; i++) peak = Math.max(peak, slaterPPeak(p.coefs[i]!, p.zeta[i]!))
  const psiScale = peak > 0 ? 1 / peak : 0
  const amp = u.uAmp!.value as Float32Array
  const zeta = u.uZeta!.value as Float32Array
  const atomU = u.uAtoms!.value as THREE.Vector3[]

  const center = u.uCenter!.value as THREE.Vector3
  const half = u.uHalf!.value as THREE.Vector3
  let minX = Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let maxZ = -Infinity
  let active = 0
  for (let i = 0; i < count; i++) {
    const z = Math.max(1e-4, p.zeta[i]!)
    amp[i] = p.coefs[i]! * slaterPNorm(z) * psiScale
    zeta[i] = z
    atomU[i]!.set(atoms[i * 3]!, atoms[i * 3 + 1]!, atoms[i * 3 + 2]!)
    if (Math.abs(amp[i]!) > 0) active++
  }
  const threshold = iso / Math.max(1, active)
  for (let i = 0; i < count; i++) {
    const reach = slaterPReach(amp[i]!, zeta[i]!, threshold)
    if (reach <= 0) continue
    const d = state.tmp.copy(atomU[i]!).sub(centroid)
    const px = d.dot(x)
    const py = d.dot(y)
    const pz = d.dot(n)
    minX = Math.min(minX, px - reach)
    maxX = Math.max(maxX, px + reach)
    minY = Math.min(minY, py - reach)
    maxY = Math.max(maxY, py + reach)
    minZ = Math.min(minZ, pz - reach)
    maxZ = Math.max(maxZ, pz + reach)
  }
  for (let i = count; i < ORBITAL_RAYMARCH_MAX_ATOMS; i++) amp[i] = 0
  u.uCount!.value = count

  if (p.boxCenter && p.boxHalfSize) {
    center.copy(p.boxCenter)
    half.copy(p.boxHalfSize)
  } else if (minX <= maxX) {
    center
      .copy(centroid)
      .addScaledVector(x, 0.5 * (minX + maxX))
      .addScaledVector(y, 0.5 * (minY + maxY))
      .addScaledVector(n, 0.5 * (minZ + maxZ))
    half.set(0.5 * (maxX - minX), 0.5 * (maxY - minY), 0.5 * (maxZ - minZ))
    if (p.boxCenter) center.copy(p.boxCenter)
    if (p.boxHalfSize) half.copy(p.boxHalfSize)
  } else {
    // Изоуровень выше любой АО — рисовать нечего.
    if (mesh) mesh.visible = false
    return
  }
  half.set(Math.max(half.x, 1e-3), Math.max(half.y, 1e-3), Math.max(half.z, 1e-3))
  // Шаг: диагональ бокса / MAX_STEPS — сквозной луч укладывается в бюджет.
  u.uStep!.value = (2 * half.length()) / ORBITAL_RAYMARCH_MAX_STEPS
  u.uIso!.value = iso
  u.uOpacity!.value = Math.min(1, p.opacity)

  const positive = p.palette?.positive ?? ORBITAL_PHASE_PALETTE.positive
  const negative = p.palette?.negative ?? ORBITAL_PHASE_PALETTE.negative
  if (positive !== state.lastPositive) {
    state.lastPositive = positive
    ;(u.uPositive!.value as THREE.Color).setHex(positive)
  }
  if (negative !== state.lastNegative) {
    state.lastNegative = negative
    ;(u.uNegative!.value as THREE.Color).setHex(negative)
  }
}

export function OrbitalRaymarch(props: OrbitalRaymarchProps) {
  const { renderOrder = 7 } = props
  const mesh = useRef<THREE.Mesh>(null)
  const state = useMemo(() => createRaymarchState(), [])

  useEffect(() => {
    return () => state.material.dispose()
  }, [state])

  // R3F держит в useFrame последнее замыкание — props всегда свежие.
  useFrame(() => {
    syncRaymarch(state, mesh.current, props)
  })

  return (
    <mesh
      ref={mesh}
      geometry={raymarchBoxGeometry()}
      material={state.material}
      renderOrder={renderOrder}
      frustumCulled={false}
      visible={false}
      dispose={null}
    />
  )
}
