import type { vrLabRu } from './vrLabRu'

export const vrLabEn: Record<keyof typeof vrLabRu, string> = {
  'nav.vrLab': 'VR Lab',

  'vrLab.title': 'VR 3D Laboratory',
  'vrLab.lead':
    'Virtual lab bench: test tubes, beaker, mixing solutions and visible reactions. Pick a substance, pour into a tube, mix 1+2 — result appears in the beaker.',
  'vrLab.backLab': 'Back to reactor',

  'vrLab.picker.title': 'Substance catalog',
  'vrLab.picker.search': 'Formula or name…',
  'vrLab.picker.starterOnly': 'Reaction-ready only',
  'vrLab.picker.selected': 'Selected: {formula}',

  'vrLab.tube.selected': 'Tube {n}',
  'vrLab.action.pour': 'Pour into tube',
  'vrLab.action.mix': 'Mix 1 + 2',
  'vrLab.action.empty': 'Clear bench',
  'vrLab.action.emptyTube': 'Empty tube',

  'vrLab.result.title': 'Result',
  'vrLab.result.equation': 'Equation',
  'vrLab.result.none': 'Put two different reagents in tubes 1 and 2.',

  'vrLab.reaction.neutralization': 'Neutralization — salt and water formed, heat released.',
  'vrLab.reaction.hydration': 'Oxide hydration — base or acid formed.',
  'vrLab.reaction.gas': 'Gas dissolution — bubbles and color change.',
  'vrLab.reaction.co2': 'CO₂ evolution — vigorous bubbling!',
  'vrLab.reaction.catalysis': 'Catalytic decomposition — active gas evolution.',
  'vrLab.reaction.dissolve': 'Precipitate dissolved — solution color changed.',
  'vrLab.reaction.blueSolution': 'Blue copper sulfate solution formed.',
  'vrLab.reaction.yellowSolution': 'Yellowish iron(III) chloride solution formed.',
  'vrLab.reaction.whiteFume': 'White NH₄Cl fumes formed.',
  'vrLab.reaction.precipitate': 'Precipitate formed.',
  'vrLab.reaction.noReaction': 'No visible reaction — mixture unchanged.',
  'vrLab.reaction.unlistedAcidBase': 'Acid and base mixed — neutralization possible (not in demo set).',
  'vrLab.reaction.same': 'Same substances — no new reaction.',
  'vrLab.reaction.empty': 'Tubes empty — add reagents.',

  'vrLab.stats.reactions': '{n} reactions in database',
  'vrLab.stats.colors': '{n} solution colors',
}
