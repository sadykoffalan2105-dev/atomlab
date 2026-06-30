import { useEffect, useRef, useState } from 'react'
import type { CompoundDef } from '../../types/chemistry'
import { isProductGpuCompiled } from '../../lab/productGpuCompileCache'
import { LabProductHeroSlot } from './LabProductHeroSlot'

/**
 * Фоновая очередь GPU-compile популярных веществ (idle, один за раз).
 * Первый синтез конкретного продукта не блокирует кадр.
 */
export function LabSynthesisGpuQueue({
  compounds,
  active,
}: {
  compounds: readonly CompoundDef[]
  active: boolean
}) {
  const [queueIndex, setQueueIndex] = useState(0)
  const advanceTimerRef = useRef<number | null>(null)

  const compound = compounds.length > 0 ? compounds[queueIndex % compounds.length]! : null

  useEffect(() => {
    if (!active || !compound) return
    if (isProductGpuCompiled(compound.id)) {
      setQueueIndex((i) => i + 1)
    }
  }, [active, compound, queueIndex])

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current != null) window.clearTimeout(advanceTimerRef.current)
    }
  }, [])

  const handleCompiled = (compoundId: string) => {
    if (advanceTimerRef.current != null) window.clearTimeout(advanceTimerRef.current)
    advanceTimerRef.current = window.setTimeout(() => {
      advanceTimerRef.current = null
      setQueueIndex((i) => {
        const next = i + 1
        if (compounds.length === 0) return 0
        return next >= compounds.length * 2 ? 0 : next
      })
      void compoundId
    }, 120)
  }

  if (!active || !compound || isProductGpuCompiled(compound.id)) return null

  return (
    <LabProductHeroSlot
      key={`queue-${compound.id}-${queueIndex}`}
      compound={compound}
      visible={false}
      prewarm
      entrance="none"
      shaderCompileAsync
      onGpuCompiled={handleCompiled}
    />
  )
}
