import { useEffect } from 'react'
import { CatalogSubstanceDisplay } from './CatalogSubstanceDisplay'
import type { CompoundDef } from '../../types/chemistry'

const BG = {
  c: '#0a0c18' as const,
  f: ['#0a0c18', 6.5, 16] as [string, number, number],
}

/**
 * «Герой» в стиле каталога: после FSM успешного синтеза остаётся в сцене с орбитой, как в модалке каталога.
 */
export function SynthesisSettledProductHero({ compound }: { compound: CompoundDef }) {
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7401/ingest/69edabaa-df50-4d14-987c-8fc52341b862', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'dbdb64' },
      body: JSON.stringify({
        sessionId: 'dbdb64',
        runId: 'aura-sphere-pre',
        hypothesisId: 'H4',
        location: 'SynthesisSettledProductHero.tsx',
        message: 'settled hero mounts CatalogSubstanceDisplay(reducedEffects only)',
        data: { compoundId: compound.id },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion
  }, [compound.id])

  return (
    <>
      <color attach="background" args={[BG.c]} />
      <fog attach="fog" args={BG.f} />
      <CatalogSubstanceDisplay compound={compound} reducedEffects />
    </>
  )
}
