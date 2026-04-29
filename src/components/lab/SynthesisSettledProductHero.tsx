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
  return (
    <>
      <color attach="background" args={[BG.c]} />
      <fog attach="fog" args={BG.f} />
      <CatalogSubstanceDisplay compound={compound} reducedEffects />
    </>
  )
}
