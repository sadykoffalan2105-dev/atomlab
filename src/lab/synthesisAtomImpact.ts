import { gsap } from 'gsap'
import type { Object3D } from 'three'

/** Микро-импульс «удара» при сближении атомов — scale bump без убийства позиционных твинов. */
export function pulseAtomScaleOnImpact(scaleNode: Object3D, base = 1): void {
  const bx = scaleNode.scale.x || base
  const by = scaleNode.scale.y || base
  const bz = scaleNode.scale.z || base
  gsap.killTweensOf(scaleNode.scale)
  gsap
    .timeline()
    .to(scaleNode.scale, {
      x: bx * 1.34,
      y: by * 1.34,
      z: bz * 1.34,
      duration: 0.07,
      ease: 'power2.out',
    })
    .to(scaleNode.scale, {
      x: bx * 1.06,
      y: by * 1.06,
      z: bz * 1.06,
      duration: 0.2,
      ease: 'elastic.out(1, 0.52)',
    })
}

export function pulseAllPreviewAtomsOnMerge(
  groups: readonly (import('three').Group | null)[],
  scales: readonly (import('three').Group | null)[],
): void {
  scales.forEach((sc, i) => {
    if (!sc) return
    const g = groups[i]
    if (!g) return
    pulseAtomScaleOnImpact(sc, sc.scale.x)
  })
}
