import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { LobeKind, type LobePool } from '../core/pools'
import {
  createOrbitalLobeMaterial,
  LOBE_LONE_PAIR_BACK_SCALE,
  LOBE_LONE_PAIR_BOUNDS,
  LOBE_LONE_PAIR_STRETCH,
  LOBE_P_BOUNDS,
  LOBE_P_STRETCH,
  ORBITAL_PHASE_PALETTE,
  type LobeBounds,
  type OrbitalPhasePalette,
} from '../core/orbitalLobeShader'

/**
 * Орбитальные лепестки из LobePool — один draw call на весь пул, все уровни качества.
 *
 * Каждая запись пула — атомная орбиталь (или её вклад в МО), из неё получаются
 * ДВА инстанса-лепестка:
 *   • LobeKind.p        — лепестки вдоль +axis и −axis с противоположной фазой;
 *                         на +axis фаза = знак coef;
 *   • LobeKind.lonePair — большой лепесток-«капля» вдоль +axis (фаза = знак coef)
 *                         и малый задний лепесток (обратная фаза).
 *
 * Отображение чисел пула в картинку:
 *   • длина лепестка (от ядра до кончика изоповерхности) L = size·√|coef|;
 *     у заднего лепестка неподелённой пары — 0.38·L. Корень, а не |coef|:
 *     плотность ∝ c², и видимая «масса» лепестка растёт медленнее коэффициента,
 *     но слабый вклад не исчезает в точку;
 *   • яркость = opacity·clamp(√|coef|, 0.2, 1);
 *   • occupancy 1 — залитое свечение; 0.5 — заливка вполсилы и одна искра,
 *     блуждающая по лепесткам пула (один неспаренный электрон); 0 — только
 *     кромка изоповерхности (пустая акцепторная орбиталь, например σ*).
 *
 * Пул перечитывается, только когда меняется pool.version или pool.count.
 * Координаты пула — в локальной системе этого компонента (обычно риг сцены);
 * масштаб родителя учитывается в шейдере.
 */

type LobeGpu = {
  geo: THREE.InstancedBufferGeometry
  center: Float32Array
  axis: Float32Array
  bound: Float32Array
  look: Float32Array
  attrs: THREE.InstancedBufferAttribute[]
  lastPool: LobePool | null
  lastVersion: number
  lastCount: number
  lastPositive: number
  lastNegative: number
}

function createLobeGpu(capacity: number): LobeGpu {
  const instances = Math.max(1, capacity * 2)
  const geo = new THREE.InstancedBufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3))
  geo.setIndex([0, 1, 2, 0, 2, 3])
  const center = new Float32Array(instances * 4)
  const axis = new Float32Array(instances * 4)
  const bound = new Float32Array(instances * 4)
  const look = new Float32Array(instances * 4)
  const attrs = [
    ['aCenter', center],
    ['aAxis', axis],
    ['aBound', bound],
    ['aLook', look],
  ].map(([name, arr]) => {
    const a = new THREE.InstancedBufferAttribute(arr as Float32Array, 4).setUsage(THREE.DynamicDrawUsage)
    geo.setAttribute(name as string, a)
    return a
  })
  geo.instanceCount = 0
  return { geo, center, axis, bound, look, attrs, lastPool: null, lastVersion: -1, lastCount: -1, lastPositive: -1, lastNegative: -1 }
}

function writeLobe(
  gpu: LobeGpu,
  j: number,
  cx: number,
  cy: number,
  cz: number,
  ax: number,
  ay: number,
  az: number,
  length: number,
  stretch: number,
  bounds: LobeBounds,
  phase: number,
  sparkSlot: number,
  bright: number,
  occupancy: number,
): void {
  const o = j * 4
  // r₀ такой, чтобы кончик изоповерхности оказался ровно на расстоянии length от ядра.
  gpu.center[o] = cx
  gpu.center[o + 1] = cy
  gpu.center[o + 2] = cz
  gpu.center[o + 3] = length / bounds.tipAxial
  gpu.axis[o] = ax
  gpu.axis[o + 1] = ay
  gpu.axis[o + 2] = az
  gpu.axis[o + 3] = stretch
  gpu.bound[o] = bounds.centerAxial
  gpu.bound[o + 1] = bounds.radius
  gpu.bound[o + 2] = phase
  gpu.bound[o + 3] = sparkSlot
  gpu.look[o] = bright
  gpu.look[o + 1] = occupancy
  gpu.look[o + 2] = 0
  gpu.look[o + 3] = 0
}

/** Пул → инстансы (только если пул сменился или писатель поднял version). */
function syncLobeGpu(gpu: LobeGpu, pool: LobePool, mesh: THREE.Mesh | null, material: THREE.ShaderMaterial): void {
  const count = Math.min(pool.count, pool.capacity)
  if (pool === gpu.lastPool && pool.version === gpu.lastVersion && count === gpu.lastCount) return
  gpu.lastPool = pool
  gpu.lastVersion = pool.version
  gpu.lastCount = count

  let j = 0
  let sparkSlots = 0
  for (let i = 0; i < count; i++) {
    const opacity = pool.opacity[i]!
    const coef = pool.coef[i]!
    const mag = Math.abs(coef)
    if (opacity <= 0.002 || mag < 1e-4) continue
    let ax = pool.axis[i * 3]!
    let ay = pool.axis[i * 3 + 1]!
    let az = pool.axis[i * 3 + 2]!
    const len = Math.hypot(ax, ay, az)
    if (len < 1e-6) continue
    ax /= len
    ay /= len
    az /= len
    const cx = pool.center[i * 3]!
    const cy = pool.center[i * 3 + 1]!
    const cz = pool.center[i * 3 + 2]!
    const root = Math.sqrt(mag)
    const lobeLength = pool.size[i]! * root
    const bright = opacity * Math.min(1, Math.max(0.2, root))
    const occupancy = Math.min(1, Math.max(0, pool.occupancy[i]!))
    const phase = coef >= 0 ? 1 : -1
    // Искра — только у полузаселённых орбиталей.
    const sparkles = occupancy > 0.2 && occupancy < 0.8
    const slotA = sparkles ? sparkSlots++ : -1
    const slotB = sparkles ? sparkSlots++ : -1

    if (pool.kind[i] === LobeKind.lonePair) {
      writeLobe(gpu, j++, cx, cy, cz, ax, ay, az, lobeLength, LOBE_LONE_PAIR_STRETCH, LOBE_LONE_PAIR_BOUNDS, phase, slotA, bright, occupancy)
      writeLobe(
        gpu,
        j++,
        cx,
        cy,
        cz,
        -ax,
        -ay,
        -az,
        lobeLength * LOBE_LONE_PAIR_BACK_SCALE,
        LOBE_P_STRETCH,
        LOBE_P_BOUNDS,
        -phase,
        slotB,
        bright * 0.8,
        occupancy,
      )
    } else {
      writeLobe(gpu, j++, cx, cy, cz, ax, ay, az, lobeLength, LOBE_P_STRETCH, LOBE_P_BOUNDS, phase, slotA, bright, occupancy)
      writeLobe(gpu, j++, cx, cy, cz, -ax, -ay, -az, lobeLength, LOBE_P_STRETCH, LOBE_P_BOUNDS, -phase, slotB, bright, occupancy)
    }
  }

  gpu.geo.instanceCount = j
  material.uniforms.uSparkCount!.value = sparkSlots
  // Меш всегда видим: пустой пул рисует instanceCount = 0, а шейдер компилируется при монтировании, не посреди урока.
  void mesh
  if (j === 0) return
  for (const a of gpu.attrs) {
    a.clearUpdateRanges()
    a.addUpdateRange(0, j * 4)
    a.needsUpdate = true
  }
}

function syncLobeFrame(
  gpu: LobeGpu,
  material: THREE.ShaderMaterial,
  time: number,
  positive: number,
  negative: number,
): void {
  material.uniforms.uTime!.value = time
  if (positive !== gpu.lastPositive) {
    gpu.lastPositive = positive
    ;(material.uniforms.uPositive!.value as THREE.Color).setHex(positive)
  }
  if (negative !== gpu.lastNegative) {
    gpu.lastNegative = negative
    ;(material.uniforms.uNegative!.value as THREE.Color).setHex(negative)
  }
}

export function OrbitalLobes({
  pool,
  time,
  palette,
  renderOrder = 6,
}: {
  pool: LobePool
  /** время сюжета, с — анимация искры одиночного электрона */
  time: { current: number }
  /** цвета фаз (sRGB hex); по умолчанию янтарь (+) / голубой (−) */
  palette?: OrbitalPhasePalette
  renderOrder?: number
}) {
  const mesh = useRef<THREE.Mesh>(null)
  const gpu = useMemo(() => createLobeGpu(pool.capacity), [pool.capacity])
  const material = useMemo(() => createOrbitalLobeMaterial(), [])
  const positive = palette?.positive ?? ORBITAL_PHASE_PALETTE.positive
  const negative = palette?.negative ?? ORBITAL_PHASE_PALETTE.negative

  useEffect(() => {
    return () => gpu.geo.dispose()
  }, [gpu])
  useEffect(() => {
    return () => material.dispose()
  }, [material])

  useFrame(() => {
    syncLobeGpu(gpu, pool, mesh.current, material)
    syncLobeFrame(gpu, material, time.current, positive, negative)
  })

  return (
    <mesh
      ref={mesh}
      geometry={gpu.geo}
      material={material}
      renderOrder={renderOrder}
      frustumCulled={false}
      dispose={null}
    />
  )
}
