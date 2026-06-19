import { useFrame, useThree } from '@react-three/fiber'
import { useEffect } from 'react'

type Props = {
  animPhase: 'idle' | 'pouring' | 'combining' | 'reacting'
  dragging: boolean
  mixing: boolean
  autoMixActive?: boolean
}

/** При frameloop="demand" — перерисовка во время анимаций, drag и damping камеры. */
export function VrLabSceneDriver({ animPhase, dragging, mixing, autoMixActive = false }: Props) {
  const invalidate = useThree((s) => s.invalidate)
  const animating = animPhase !== 'idle' || dragging || mixing || autoMixActive

  useEffect(() => {
    invalidate()
  }, [animPhase, dragging, mixing, autoMixActive, invalidate])

  useFrame(() => {
    if (animating) invalidate()
  })

  return null
}
