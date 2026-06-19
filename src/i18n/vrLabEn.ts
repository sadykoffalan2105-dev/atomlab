import type { vrLabRu } from './vrLabRu'

export const vrLabEn: Record<keyof typeof vrLabRu, string> = {
  'nav.vrLab': 'VR Lab',

  'vrLab.title': 'VR 3D Laboratory',
  'vrLab.lead':
    'Drag flasks to the bench, fill from the catalog, and mix in the reactor: first reagent into the vat, second starts the reaction.',
  'vrLab.backLab': 'Back to reactor',

  'vrLab.picker.title': 'Substance catalog',
  'vrLab.picker.search': 'Formula or name…',
  'vrLab.picker.starterOnly': 'Reaction-ready only',
  'vrLab.picker.selected': 'Selected: {formula}',

  'vrLab.tube.selected': 'Tube {n}',
  'vrLab.shelf.selected': 'Flask {n}',
  'vrLab.vat.selected': 'Mixing reactor',
  'vrLab.section.shelf': 'Flasks (1–10)',
  'vrLab.shelf.dragHint': 'Drag flasks to the bench or back to the shelf.',
  'vrLab.shelf.onWall': 'On shelf',
  'vrLab.shelf.onBench': 'On bench',
  'vrLab.vat.waitSecond': '{formula} in vat — pour a second reagent.',
  'vrLab.action.pourShelf': 'Fill flask',
  'vrLab.action.pourVat': 'Pour into vat',
  'vrLab.action.selectVat': 'Select vat',
  'vrLab.action.emptyVat': 'Empty vat',
  'vrLab.action.emptyShelf': 'Empty flask',
  'vrLab.action.empty': 'Reset all',

  'vrLab.result.title': 'Result',
  'vrLab.result.equation': 'Equation',
  'vrLab.result.none': 'Pour two different reagents into the vat using filled flasks.',

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
  'vrLab.reaction.empty': 'Flasks empty — fill reagents from the catalog.',

  'vrLab.stats.reactions': '{n} reactions in database',
  'vrLab.stats.colors': '{n} solution colors',
}
