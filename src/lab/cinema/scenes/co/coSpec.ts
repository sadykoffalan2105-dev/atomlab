import { bondLengthPm } from '../../../../chemistry/data/bondData'
import { CO_SPEC as CO_SCIENCE } from '../school/specs/co'
import { particleOf, sceneBond, sceneCounts, sceneTexts, sceneTiming } from '../school/specs/sceneBridge'
import type { SchoolSceneSpec } from '../school/schoolSpec'

/**
 * Школьная сцена: 2C + O₂ → 2CO (Kimyo 7, § 2.12, с. 69; кислорода мало). Химия, тексты и шаги — из
 * научной спецификации school/specs/co.ts; здесь только постановка кадра (пм).
 *
 *   • реагенты: два атома C из угля (пара + два неспаренных) и одна молекула O₂ (O=O);
 *   • разрыв: пары O=O расходятся — у каждого O две неподелённые пары и два неспаренных электрона;
 *   • C≡O: две обменные пары (по электрону от C и O) + одна донорно-акцепторная ОТ КИСЛОРОДА
 *     (его неподелённая пара, pairOrigins спецификации); C≡O 112,8 пм (ядро 'C#O');
 *     по одной неподелённой паре у C и у O — на оси молекулы, с внешней стороны.
 *
 * Раскладка: O₂ сверху по центру, атомы C слева и справа снизу; две молекулы CO зеркально
 * (атомы O ближе к центру), чтобы пути атомов не пересекались.
 */

const P_C = particleOf(CO_SCIENCE, 'C')
const P_O2 = particleOf(CO_SCIENCE, 'O2')
const P_CO = particleOf(CO_SCIENCE, 'CO')

const R_IDS = { Oa: 'O1', Ob: 'O2' }
const P1 = { C: 'C1', O: 'O1' }
const P2 = { C: 'C2', O: 'O2' }

const CO = bondLengthPm('C#O')
const OO = bondLengthPm('O=O')
const { steps, textbook } = sceneTiming(CO_SCIENCE)

export const CO_SCHOOL_SPEC: SchoolSceneSpec = {
  id: 'co',
  product: 'CO',
  equation: CO_SCIENCE.reaction.equation,
  textbook,
  atoms: [
    { id: 'C1', element: 'C' },
    { id: 'C2', element: 'C' },
    { id: 'O1', element: 'O' },
    { id: 'O2', element: 'O' },
  ],
  reactants: [
    {
      id: 'Ca',
      formula: 'C',
      state: 's',
      atoms: ['C1'],
      bonds: [],
      lonePairs: sceneCounts(P_C.lonePairs, { C: 'C1' }),
      unpaired: sceneCounts(P_C.unpaired, { C: 'C1' }),
      coords: { C1: [0, 0, 0] },
      place: [-235, -60, 0],
    },
    {
      id: 'O2',
      formula: 'O₂',
      state: 'g',
      atoms: ['O1', 'O2'],
      bonds: [sceneBond(P_O2, 'Oa', 'Ob', R_IDS)],
      lonePairs: sceneCounts(P_O2.lonePairs, R_IDS),
      coords: { O1: [-OO / 2, 0, 0], O2: [OO / 2, 0, 0] },
      place: [0, 75, 0],
    },
    {
      id: 'Cb',
      formula: 'C',
      state: 's',
      atoms: ['C2'],
      bonds: [],
      lonePairs: sceneCounts(P_C.lonePairs, { C: 'C2' }),
      unpaired: sceneCounts(P_C.unpaired, { C: 'C2' }),
      coords: { C2: [0, 0, 0] },
      place: [235, -60, 0],
    },
  ],
  products: [
    {
      id: 'CO1',
      formula: 'CO',
      state: 'g',
      atoms: ['C1', 'O1'],
      bonds: [sceneBond(P_CO, 'C', 'O', P1)],
      lonePairs: sceneCounts(P_CO.lonePairs, P1),
      coords: { C1: [-CO / 2, 0, 0], O1: [CO / 2, 0, 0] },
      place: [-165, 0, 0],
    },
    {
      id: 'CO2',
      formula: 'CO',
      state: 'g',
      atoms: ['C2', 'O2'],
      bonds: [sceneBond(P_CO, 'C', 'O', P2)],
      lonePairs: sceneCounts(P_CO.lonePairs, P2),
      coords: { O2: [-CO / 2, 0, 0], C2: [CO / 2, 0, 0] },
      place: [165, 0, 0],
    },
  ],
  split: {
    C1: [-290, -70, 0],
    C2: [290, -70, 0],
    O1: [-120, 105, 0],
    O2: [120, 105, 0],
  },
  steps,
  captions: CO_SCIENCE.captions,
  text: sceneTexts(CO_SCIENCE),
}
