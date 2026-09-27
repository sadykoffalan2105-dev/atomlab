import { bondLengthPm } from '../../../../chemistry/data/bondData'
import { CO2_SPEC as CO2_SCIENCE } from '../school/specs/co2'
import { particleOf, sceneBond, sceneCounts, sceneTexts, sceneTiming } from '../school/specs/sceneBridge'
import type { SchoolSceneSpec } from '../school/schoolSpec'

/**
 * Школьная сцена: C + O₂ → CO₂ (Kimyo 7, § 4.5, с. 95). Химия, тексты и шаги — из научной
 * спецификации school/specs/co2.ts; здесь только постановка кадра (пм).
 *
 *   • реагенты: один атом C из угля (C +6 )2 )4: пара 2s и два неспаренных — основное состояние)
 *     и молекула O₂ (O=O, по две неподелённые пары у атомов);
 *   • разрыв: две пары O=O расходятся по электрону; у C пара распаривается — 4 неспаренных
 *     («возбуждённое состояние», 9 кл., с. 10 — splitElectrons спецификации);
 *   • CO₂: O=C=O, две двойные связи (C=O 116,0 пм — ядро 'C=O(CO2)'), 180°, у каждого O две
 *     неподелённые пары, у C неподелённых пар нет.
 *
 * Раскладка (широкий кадр, как у H₂O): атом C слева сверху, O₂ снизу по центру; атомы O расходятся
 * влево и вправо, C встаёт между ними — молекула собирается в центре. Подписи слоёв (над атомами) и
 * формул (под молекулами) не сталкиваются.
 */

const P_C = particleOf(CO2_SCIENCE, 'C')
const P_O2 = particleOf(CO2_SCIENCE, 'O2')
const P_CO2 = particleOf(CO2_SCIENCE, 'CO2')

const R_IDS = { C: 'C1', Oa: 'O1', Ob: 'O2' }
const P_IDS = { C: 'C1', O1: 'O1', O2: 'O2' }

const CO = bondLengthPm('C=O(CO2)')
const OO = bondLengthPm('O=O')
const { steps, textbook } = sceneTiming(CO2_SCIENCE)
const excited = CO2_SCIENCE.mechanism.splitElectrons?.find((s) => s.particle === 'C' && s.atom === 'C')

export const CO2_SCHOOL_SPEC: SchoolSceneSpec = {
  id: 'co2',
  product: 'CO₂',
  equation: CO2_SCIENCE.reaction.equation,
  textbook,
  atoms: [
    { id: 'C1', element: 'C' },
    { id: 'O1', element: 'O' },
    { id: 'O2', element: 'O' },
  ],
  reactants: [
    {
      id: 'C',
      formula: 'C',
      state: 's',
      atoms: ['C1'],
      bonds: [],
      lonePairs: sceneCounts(P_C.lonePairs, R_IDS),
      unpaired: sceneCounts(P_C.unpaired, R_IDS),
      coords: { C1: [0, 0, 0] },
      place: [-225, 55, 0],
    },
    {
      id: 'O2',
      formula: 'O₂',
      state: 'g',
      atoms: ['O1', 'O2'],
      bonds: [sceneBond(P_O2, 'Oa', 'Ob', R_IDS)],
      lonePairs: sceneCounts(P_O2.lonePairs, R_IDS),
      coords: { O1: [-OO / 2, 0, 0], O2: [OO / 2, 0, 0] },
      place: [0, -65, 0],
    },
  ],
  products: [
    {
      id: 'CO2',
      formula: 'CO₂',
      state: 'g',
      atoms: ['C1', 'O1', 'O2'],
      bonds: [sceneBond(P_CO2, 'C', 'O1', P_IDS), sceneBond(P_CO2, 'C', 'O2', P_IDS)],
      lonePairs: sceneCounts(P_CO2.lonePairs, P_IDS),
      coords: { O1: [-CO, 0, 0], C1: [0, 0, 0], O2: [CO, 0, 0] },
      angles: [{ a: 'O1', center: 'C1', b: 'O2', angleKey: 'carbonDioxide' }],
      place: [0, 0, 0],
    },
  ],
  split: {
    O1: [-225, -45, 0],
    O2: [225, -45, 0],
    C1: [-20, 85, 0],
  },
  ...(excited ? { splitElectrons: { C1: { lone: excited.lone, unpaired: excited.unpaired } } } : {}),
  steps,
  captions: CO2_SCIENCE.captions,
  text: sceneTexts(CO2_SCIENCE),
}
