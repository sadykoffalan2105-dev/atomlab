import { useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { heroBondStyle } from '../../chemistry/catalogHeroAppearance'
import { mapPreviewIndicesToProduct } from '../../lab/synthesisBondMapping'
import type { CompoundDef } from '../../types/chemistry'

const _a = new THREE.Vector3()
const _b = new THREE.Vector3()
const _mid = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)
const _quat = new THREE.Quaternion()

type BondSlot = {
  previewI: number
  previewJ: number
}

/**
 * Неоновые связи — один useFrame на все связи (меньше overhead).
 */
export function SynthesisNeonBondFormation({
  product,
  previewZs,
  previewAtomGroupRefs,
  growRef,
  lockRef,
  impactRef,
  active,
}: {
  product: CompoundDef
  previewZs: readonly number[]
  previewAtomGroupRefs: MutableRefObject<(THREE.Group | null)[]>
  growRef: MutableRefObject<number>
  lockRef: MutableRefObject<number>
  impactRef: MutableRefObject<number>
  active: boolean
}) {
  const bondStyle = useMemo(() => heroBondStyle(product.category), [product.category])

  const bondSlots = useMemo<BondSlot[]>(() => {
    if (!product.bonds?.length || !product.atoms?.length) return []
    const map = mapPreviewIndicesToProduct(previewZs, product.atoms)
    const out: BondSlot[] = []
    for (const [i, j] of product.bonds) {
      const pi = map[i]
      const pj = map[j]
      if (pi == null || pj == null) continue
      out.push({ previewI: pi, previewJ: pj })
    }
    return out
  }, [product, previewZs])

  const groupRefs = useRef<(THREE.Group | null)[]>([])
  const coreMats = useRef<(THREE.MeshBasicMaterial | null)[]>([])
  const haloMats = useRef<(THREE.MeshBasicMaterial | null)[]>([])

  useLayoutEffect(() => {
    groupRefs.current = new Array(bondSlots.length).fill(null)
    coreMats.current = new Array(bondSlots.length).fill(null)
    haloMats.current = new Array(bondSlots.length).fill(null)
  }, [bondSlots.length, product.id])

  useFrame((s) => {
    if (!active || bondSlots.length === 0) return
    const grow = THREE.MathUtils.clamp(growRef.current, 0, 1)
    const lock = THREE.MathUtils.clamp(lockRef.current, 0, 1)
    const impact = impactRef.current
    const t = s.clock.elapsedTime

    for (let index = 0; index < bondSlots.length; index++) {
      const slot = bondSlots[index]!
      const fromRef = previewAtomGroupRefs.current[slot.previewI]
      const toRef = previewAtomGroupRefs.current[slot.previewJ]
      const g = groupRefs.current[index]
      const coreMat = coreMats.current[index]
      const haloMat = haloMats.current[index]
      if (!g || !fromRef || !toRef) continue

      fromRef.getWorldPosition(_a)
      toRef.getWorldPosition(_b)
      const fullLen = Math.max(0.04, _a.distanceTo(_b))

      const stagger = index * 0.07
      const localGrow = THREE.MathUtils.clamp((grow - stagger) / Math.max(0.001, 1 - stagger), 0, 1)
      const visibleLen = fullLen * localGrow

      _mid.copy(_a).add(_b).multiplyScalar(0.5)
      _dir.copy(_b).sub(_a)
      if (_dir.lengthSq() < 1e-6) _dir.set(0, 1, 0)
      else _dir.normalize()
      _quat.setFromUnitVectors(_up, _dir)

      g.position.copy(_mid)
      g.quaternion.copy(_quat)
      g.scale.set(1, Math.max(0.001, visibleLen), 1)

      const flash = impact * (1 - lock * 0.35)
      const wave = 0.12 * Math.sin(t * 8.5 + index * 1.3)
      const alpha = THREE.MathUtils.clamp(0.1 + localGrow * 0.82 + flash * 0.4 + wave * 0.25, 0, 1)
      if (coreMat) coreMat.opacity = alpha
      if (haloMat) haloMat.opacity = THREE.MathUtils.clamp(localGrow * 0.38 + flash * 0.15, 0, 0.5)
    }
  })

  if (!active || bondSlots.length === 0) return null

  return (
    <group frustumCulled={false}>
      {bondSlots.map((slot, k) => (
        <group
          key={`${slot.previewI}-${slot.previewJ}-${k}`}
          ref={(el) => {
            groupRefs.current[k] = el
          }}
        >
          <mesh renderOrder={12}>
            <cylinderGeometry args={[0.014, 0.014, 1, 8, 1]} />
            <meshBasicMaterial
              ref={(el) => {
                coreMats.current[k] = el
              }}
              color={bondStyle.core}
              transparent
              opacity={0}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
          <mesh renderOrder={11}>
            <cylinderGeometry args={[0.034, 0.034, 1, 8, 1]} />
            <meshBasicMaterial
              ref={(el) => {
                haloMats.current[k] = el
              }}
              color={bondStyle.halo}
              transparent
              opacity={0}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}
