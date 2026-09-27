import { bondAngleDeg, bondLengthPm } from '../../../../chemistry/data/bondData'
import { SO2_SPEC as SO2_SCIENCE } from '../school/specs/so2'
import { particleOf, sceneBond, sceneCounts, sceneTexts, sceneTiming } from '../school/specs/sceneBridge'
import type { SchoolSceneSpec, SchoolVec3 } from '../school/schoolSpec'

/**
 * Школьная сцена: S + O₂ → SO₂ (Kimyo 7, § 4.5, с. 95). Химия, тексты и шаги — из научной
 * спецификации school/specs/so2.ts; здесь только постановка кадра (пм).
 *
 *   • реагенты: один атом S из серы (S +16 )2 )8 )6: две пары и два неспаренных) и O₂ (O=O);
 *   • разрыв: пары O=O расходятся; у S одна пара распаривается — пара + 4 неспаренных
 *     (splitElectrons спецификации: так объясняют валентность IV);
 *   • SO₂: школьная формула O=S=O (две двойные связи S=O — ядро 'S=O'), у S одна неподелённая
 *     пара — молекула угловая, ∠OSO = 119,5° (ядро 'sulfurDioxide'); оговорка о расширенном
 *     октете — в тексте спецификации.
 *
 * Раскладка (широкий кадр, как у H₂O): атом S слева сверху, O₂ снизу по центру; S встаёт вершиной
 * угла, атомы O — вниз влево и вправо, неподелённая пара S смотрит вверх (от атомов O).
 */

const P_S = particleOf(SO2_SCIENCE, 'S')
const P_O2 = particleOf(SO2_SCIENCE, 'O2')
const P_SO2 = particleOf(SO2_SCIENCE, 'SO2')

const R_IDS = { S: 'S1', Oa: 'O1', Ob: 'O2' }
const P_IDS = { S: 'S1', O1: 'O1', O2: 'O2' }

const SO = bondLengthPm('S=O')
const OSO = bondAngleDeg('sulfurDioxide')
const OO = bondLengthPm('O=O')
const half = ((OSO / 2) * Math.PI) / 180
const ox = SO * Math.sin(half)
const oy = SO * Math.cos(half)
/** S — вершина угла выше центра, атомы O ниже; центр молекулы — середина по высоте. */
const G: Record<'S1' | 'O1' | 'O2', SchoolVec3> = { S1: [0, oy / 2, 0], O1: [-ox, -oy / 2, 0], O2: [ox, -oy / 2, 0] }

const { steps, textbook } = sceneTiming(SO2_SCIENCE)
const split = SO2_SCIENCE.mechanism.splitElectrons?.find((s) => s.particle === 'S' && s.atom === 'S')

export const SO2_SCHOOL_SPEC: SchoolSceneSpec = {
  id: 'so2',
  product: 'SO₂',
  equation: SO2_SCIENCE.reaction.equation,
  textbook,
  atoms: [
    { id: 'S1', element: 'S' },
    { id: 'O1', element: 'O' },
    { id: 'O2', element: 'O' },
  ],
  reactants: [
    {
      id: 'S',
      formula: 'S',
      state: 's',
      atoms: ['S1'],
      bonds: [],
      lonePairs: sceneCounts(P_S.lonePairs, R_IDS),
      unpaired: sceneCounts(P_S.unpaired, R_IDS),
      coords: { S1: [0, 0, 0] },
      place: [-235, 60, 0],
    },
    {
      id: 'O2',
      formula: 'O₂',
      state: 'g',
      atoms: ['O1', 'O2'],
      bonds: [sceneBond(P_O2, 'Oa', 'Ob', R_IDS)],
      lonePairs: sceneCounts(P_O2.lonePairs, R_IDS),
      coords: { O1: [-OO / 2, 0, 0], O2: [OO / 2, 0, 0] },
      place: [0, -70, 0],
    },
  ],
  products: [
    {
      id: 'SO2',
      formula: 'SO₂',
      state: 'g',
      atoms: ['S1', 'O1', 'O2'],
      bonds: [sceneBond(P_SO2, 'S', 'O1', P_IDS), sceneBond(P_SO2, 'S', 'O2', P_IDS)],
      lonePairs: sceneCounts(P_SO2.lonePairs, P_IDS),
      coords: G,
      angles: [{ a: 'O1', center: 'S1', b: 'O2', angleKey: 'sulfurDioxide' }],
      place: [0, 0, 0],
    },
  ],
  split: {
    S1: [-30, 100, 0],
    O1: [-230, -60, 0],
    O2: [230, -60, 0],
  },
  ...(split ? { splitElectrons: { S1: { lone: split.lone, unpaired: split.unpaired } } } : {}),
  steps,
  captions: SO2_SCIENCE.captions,
  text: sceneTexts(SO2_SCIENCE),
}
