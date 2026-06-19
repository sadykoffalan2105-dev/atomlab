import { useEffect, useRef } from 'react'
import type { VrLabBenchState } from './types'
import { findCuratedReaction } from './reactions/curatedReactions'
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
      const pair = state.lastReactionPair
      const curated = pair ? findCuratedReaction(pair.a, pair.b) : null
      playVrLabReactionSound(state.lastMix.effect, state.lastMix.heat, curated?.id)
    }

    prevPhase.current = phase
  }, [state.animPhase, state.lastMix, state.lastReactionPair])
}
