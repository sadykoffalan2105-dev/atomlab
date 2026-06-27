import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'

/** Универсальный FPS-governor: понижает runtime preset при просадке ниже порога. */
export function useRuntimeFpsGovernor(opts: {
  enabled: boolean
  onDowngrade: () => void
  enterFps?: number
  sampleSec?: number
  cooldownSec?: number
}) {
  const {
    enabled,
    onDowngrade,
    enterFps = 42,
    sampleSec = 0.75,
    cooldownSec = 8,
  } = opts
  const onDowngradeRef = useRef(onDowngrade)
  onDowngradeRef.current = onDowngrade

  const accRef = useRef({ t: 0, ema: 60, lastDowngrade: 0 })

  useEffect(() => {
    if (!enabled) accRef.current = { t: 0, ema: 60, lastDowngrade: 0 }
  }, [enabled])

  useFrame((_, delta) => {
    if (!enabled) return
    const d = Math.min(0.25, Math.max(0.0005, delta))
    const fps = 1 / d
    const a = accRef.current
    a.ema = a.ema * 0.9 + fps * 0.1
    a.t += d
    if (a.t < sampleSec) return
    a.t = 0

    const now = performance.now()
    if (a.ema >= enterFps) return
    if (now - a.lastDowngrade < cooldownSec * 1000) return
    a.lastDowngrade = now
    onDowngradeRef.current()
  })
}
