import { useEffect, useRef } from 'react'
import type { VrLabBenchState } from './types'
import {
  playVrLabCombineSound,
  playVrLabPourSound,
  playVrLabReactionSound,
} from './vrLabSound'

/** Звуковые эффекты при смене фаз анимации. */
export function useVrLabSoundFx(state: VrLabBenchState) {
  const prevPhase = useRef(state.animPhase)

  useEffect(() => {
    const phase = state.animPhase
    const prev = prevPhase.current

    if (phase === 'pouring' && prev !== 'pouring') {
      playVrLabPourSound()
    }
    if (phase === 'combining' && prev !== 'combining') {
      playVrLabCombineSound()
    }
    if (phase === 'reacting' && prev !== 'reacting' && state.lastMix) {
      playVrLabReactionSound(state.lastMix.effect, state.lastMix.heat)
    }

    prevPhase.current = phase
  }, [state.animPhase, state.lastMix])
}
