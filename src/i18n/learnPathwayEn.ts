import type { learnPathwayRu } from './learnPathwayRu'

/** English pathway strings (same keys as learnPathwayRu). */
export const learnPathwayEn: Record<keyof typeof learnPathwayRu, string> = {
  'learn.pathways.title': 'Lab pathways',
  'learn.pathways.lead':
    'Step-by-step scenarios: context → prediction → materials → reactor protocol → results → reflection. Like LabXchange, with ATOMLAB 3D.',
  'learn.pathways.back': 'Back to learn',
  'learn.pathways.open': 'Lab pathways',
  'learn.pathways.estimated': '≈ {n} min',
  'learn.pathways.progress': '{done} of {total} tasks',
  'learn.pathways.completed': 'Pathway complete',
  'learn.pathways.continue': 'Continue',
  'learn.pathways.start': 'Start pathway',

  'learn.pathway.h2o.title': 'Water synthesis',
  'learn.pathway.h2o.lead':
    'Forming H₂O from hydrogen and oxygen: conservation of mass, balancing, and virtual synthesis in the reactor.',

  'learn.pathway.step.context': 'Context',
  'learn.pathway.step.predictions': 'Predictions',
  'learn.pathway.step.materials': 'Materials',
  'learn.pathway.step.protocol': 'Protocol',
  'learn.pathway.step.results': 'Results',
  'learn.pathway.step.reflection': 'Reflection',
  'learn.pathway.step.summary': 'Summary',

  'learn.pathway.sidebar.title': 'Pathway progress',
  'learn.pathway.sidebar.tasks': '{done} / {total}',
  'learn.pathway.nav.prev': 'Back',
  'learn.pathway.nav.next': 'Next',
  'learn.pathway.nav.finish': 'Complete step',

  'learn.pathway.context.title': 'Why this reaction?',
  'learn.pathway.context.body':
    '2H₂ + O₂ → 2H₂O is a classic combination of elements. Hydrogen and oxygen are gases; the product is liquid water. Atom counts must match on both sides.',
  'learn.pathway.context.equationLabel': 'Reaction equation',
  'learn.pathway.context.readDone': 'I read the introduction',

  'learn.pathway.predictions.title': 'Make a prediction',
  'learn.pathway.predictions.q1': 'What coefficients are needed for 2H₂ + O₂ → 2H₂O?',
  'learn.pathway.predictions.q1.a1': '2, 1, 2',
  'learn.pathway.predictions.q1.a2': '1, 1, 1',
  'learn.pathway.predictions.q1.a3': '2, 2, 2',
  'learn.pathway.predictions.q2': 'How many hydrogen atoms are in two moles of H₂O?',
  'learn.pathway.predictions.q2.a1': '4',
  'learn.pathway.predictions.q2.a2': '2',
  'learn.pathway.predictions.q2.a3': '6',
  'learn.pathway.predictions.correct': 'Correct!',
  'learn.pathway.predictions.wrong': 'Try again.',

  'learn.pathway.materials.title': 'Reagents and product',
  'learn.pathway.materials.h2': 'Hydrogen H₂ — colorless gas, fuel.',
  'learn.pathway.materials.o2': 'Oxygen O₂ — gas needed for combustion and oxidation.',
  'learn.pathway.materials.h2o': 'Water H₂O — reaction product.',
  'learn.pathway.materials.viewed': 'I reviewed the reagents',

  'learn.pathway.protocol.title': 'Reactor protocol',
  'learn.pathway.protocol.lead':
    'Complete three steps in the ATOMLAB virtual lab. Open the reactor below — equation and product are pre-filled.',
  'learn.pathway.protocol.check1': 'Opened reactor with equation',
  'learn.pathway.protocol.check2': 'Balanced coefficients',
  'learn.pathway.protocol.check3': 'Ran synthesis and saw H₂O molecule',
  'learn.pathway.protocol.openLab': 'Open reactor',

  'learn.pathway.results.title': 'Prediction vs result',
  'learn.pathway.results.lead':
    'Your prediction: coefficients 2–1–2 and conserved H and O atoms. After synthesis you should see a water molecule.',
  'learn.pathway.results.confirm': 'Synthesis in reactor succeeded',

  'learn.pathway.reflection.title': 'Short reflection',
  'learn.pathway.reflection.q1': 'Why balance the equation before synthesis?',
  'learn.pathway.reflection.q1.a1': 'So atom counts of each element are conserved',
  'learn.pathway.reflection.q1.a2': 'So the equation looks nice',
  'learn.pathway.reflection.q2': 'What changed when water formed?',
  'learn.pathway.reflection.q2.a1': 'A new substance with different properties formed',
  'learn.pathway.reflection.q2.a2': 'Nothing — it is physical mixing',

  'learn.pathway.summary.title': 'Pathway complete!',
  'learn.pathway.summary.body':
    'You completed the full cycle: context, prediction, materials, protocol, results, and reflection. Repeat synthesis in the lab or continue grade 7 topics.',
  'learn.pathway.summary.badge': 'Water synthesis',
  'learn.pathway.summary.toGrade': 'Grade 7 topics',
  'learn.pathway.summary.toLab': 'Reactor again',
}
