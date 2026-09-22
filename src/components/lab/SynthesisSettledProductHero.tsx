import { ProductHero } from './hero/ProductHero'
import type { CompoundDef } from '../../types/chemistry'

const BG = {
  c: '#0a0c18' as const,
  f: ['#0a0c18', 6.5, 16] as [string, number, number],
}

/**
 * «Герой» после FSM успешного синтеза: решётка или молекула по данным ядра (hero/ProductHero), без ауры.
 */
export function SynthesisSettledProductHero({ compound }: { compound: CompoundDef }) {
  return (
    <>
      <color attach="background" args={[BG.c]} />
      <fog attach="fog" args={BG.f} />
      <ProductHero compound={compound} showLabels />
    </>
  )
}
