import type { VrLabMixResult } from '../../vrLab/types'
import { VfxOrchestrator, resolveCondensationLevel } from './vfx/VfxOrchestrator'

type Props = {
  active: boolean
  result: VrLabMixResult | null
  phase: 'idle' | 'pouring' | 'combining' | 'reacting'
  mixing: boolean
  progress?: number
  position?: [number, number, number]
  reactionPair?: { a: string; b: string } | null
}

/** Делегирует в единый VfxOrchestrator. */
export function VrLabReactionVfx(props: Props) {
  return <VfxOrchestrator {...props} />
}

export { resolveCondensationLevel }
