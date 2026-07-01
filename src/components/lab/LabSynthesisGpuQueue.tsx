import { useEffect, useMemo, useRef, useState } from 'react'
import type { CompoundDef } from '../../types/chemistry'
import { GPU_COMPILE_QUEUE_GAP_MS } from '../../lab/synthesisHangGuard'
import { isProductGpuCompiled } from '../../lab/productGpuCompileCache'
import { LabProductHeroSlot } from './LabProductHeroSlot'

function buildQueueCompounds(
  compounds: readonly CompoundDef[],
  priorityCompound: CompoundDef | null | undefined,
): CompoundDef[] {
  const out: CompoundDef[] = []
  const seen = new Set<string>()
  if (priorityCompound && !seen.has(priorityCompound.id)) {
    out.push(priorityCompound)
    seen.add(priorityCompound.id)
  }
  for (const c of compounds) {
    if (!seen.has(c.id)) {
      out.push(c)
      seen.add(c.id)
    }
  }
  return out
}

/**
 * Фоновая очередь GPU-compile (idle, один за раз, micro-scale).
 * Не влияет на continuity — отдельный скрытый слот, первый синтез без hitch.
 */
export function LabSynthesisGpuQueue({
  compounds,
  priorityCompound = null,
  active,
}: {
  compounds: readonly CompoundDef[]
  priorityCompound?: CompoundDef | null
  active: boolean
}) {
  const queueCompounds = useMemo(
    () => buildQueueCompounds(compounds, priorityCompound),
    [compounds, priorityCompound],
  )
  const [queueIndex, setQueueIndex] = useState(0)
  const advanceTimerRef = useRef<number | null>(null)
  const priorityIdRef = useRef<string | null>(null)

  useEffect(() => {
    const pid = priorityCompound?.id ?? null
    if (pid && pid !== priorityIdRef.current) {
      priorityIdRef.current = pid
      setQueueIndex(0)
    }
  }, [priorityCompound?.id])

  const compound =
    queueCompounds.length > 0 ? queueCompounds[queueIndex % queueCompounds.length]! : null

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
        if (queueCompounds.length === 0) return 0
        return next >= queueCompounds.length * 2 ? 0 : next
      })
      void compoundId
    }, GPU_COMPILE_QUEUE_GAP_MS)
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
