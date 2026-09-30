import { useSyncExternalStore } from 'react'
import type { ScientificSynthesisFxProps } from '../../../scientificSynthesis/types'
import { lessonModeStore, type LessonMode } from '../lessonMode'
import { SchoolCinemaScene } from '../school/SchoolCinemaScene'
import type { SchoolSceneFactory } from '../school/schoolRuntime'
import { SolutionExchangeScene, type SolutionSceneOptions } from '../school/solution/SolutionExchangeScene'
import { BASO4_SOLUTION_SPEC, solutionSpecForMode } from '../school/solution/solutionSpec'

/**
 * Урок «белый осадок»: BaCl₂ + H₂SO₄ → BaSO₄↓ + 2HCl — школьная сцена «на уровне частиц» (Kimyo 7, гл. II,
 * тема 12, с. 67 — признак реакции «осадок»; 8 кл. § 32, с. 138–139; 9 кл. § 6, с. 28–31).
 * Два режима (lessonMode.ts, docs/plans/baso4-modes.md): школьный по умолчанию — H⁺, без воды и решётки,
 * уравнения РИО со знаком «=»; продвинутый — ионы в воде, H₃O⁺, ячейка барита. Химия — school/specs/baso4.ts.
 * Смена режима даёт новую фабрику: адаптер пересоздаёт сцену и продолжает с текущего шага.
 */
/** Опции сцены + флаг «объём раствора» (фон мира частиц без молекул воды — рисует класс сцены). */
type Baso4SceneOptions = SolutionSceneOptions & { solutionVolume?: boolean }
const FACTORIES: Record<LessonMode, SchoolSceneFactory> = {
  school: (opts) => {
    const o: Baso4SceneOptions = { ...opts, solutionVolume: true }
    return new SolutionExchangeScene(solutionSpecForMode(BASO4_SOLUTION_SPEC, 'school'), o)
  },
  advanced: (opts) => {
    const o: Baso4SceneOptions = { ...opts, solutionVolume: false }
    return new SolutionExchangeScene(BASO4_SOLUTION_SPEC, o)
  },
}

export function Baso4CinemaScene(props: ScientificSynthesisFxProps) {
  const mode = useSyncExternalStore(lessonModeStore.subscribe, lessonModeStore.getSnapshot, () => 'school' as const)
  return <SchoolCinemaScene {...props} create={FACTORIES[mode]} lesson="baso4" heroCompound="salt_ba_so4" />
}
