import { bondAngleDeg, bondLengthPm } from '../../../../chemistry/data/bondData'
import type { SchoolSceneSpec, SchoolVec3 } from '../school/schoolSpec'
import { H2O_LESSON_TEXT } from './h2oMechanismText'

/**
 * ЭТАЛОННАЯ СПЕЦИФИКАЦИЯ школьной сцены: 2H₂ + O₂ → 2H₂O (Kimyo 7, § 4.5, с. 95).
 *
 * Химия кадра (школьная модель Льюиса, 7 класс):
 *   • H₂: одна общая пара H–H (у H один электрон внешнего слоя: H +1 )1);
 *   • O₂: в школе — O=O, две общие пары и по две неподелённые пары у каждого атома (O +8 )2 )6).
 *     На деле у O₂ два неспаренных электрона (парамагнетизм) — это сказано в note шага 1;
 *   • разрыв: каждая пара H–H и O=O расходится по одному электрону к своим атомам → 4 H (1 неспаренный)
 *     и 2 O (2 неспаренных + 2 неподелённые пары);
 *   • H₂O: у O две общие пары O–H (по электрону от O и от H) и две неподелённые пары; H–O–H 104,5°,
 *     O–H 95,8 пм (r₀, NIST CCCBDB) — числа только из ядра bondData.
 *
 * Раскладка (пм): H₂ слева и справа, O₂ в центре; после разрыва атомы расходятся, затем собираются в
 * две молекулы воды — зеркально сверху и снизу (атом O снаружи, атомы H к центру).
 */

const OH = bondLengthPm('O-H')
const HOH = bondAngleDeg('water')
const HH = bondLengthPm('H-H')
const OO = bondLengthPm('O=O')

const half = ((HOH / 2) * Math.PI) / 180
/** Координаты воды: O выше центра, атомы H ниже (sign = 1) или зеркально (sign = −1). */
function water(sign: 1 | -1): { O: SchoolVec3; Ha: SchoolVec3; Hb: SchoolVec3 } {
  const hx = OH * Math.sin(half)
  const hy = OH * Math.cos(half)
  // центр — середина по высоте, чтобы молекула стояла ровно на месте place
  const oy = (hy / 2) * sign
  return { O: [0, oy, 0], Ha: [-hx, oy - hy * sign, 0], Hb: [hx, oy - hy * sign, 0] }
}
const W1 = water(1)
const W2 = water(-1)

export const H2O_SPEC: SchoolSceneSpec = {
  id: 'h2o',
  product: 'H₂O',
  equation: '2H₂ + O₂ → 2H₂O',
  textbook: { grade: 7, section: '4.5', page: 95 },
  atoms: [
    { id: 'H1', element: 'H' },
    { id: 'H2', element: 'H' },
    { id: 'H3', element: 'H' },
    { id: 'H4', element: 'H' },
    { id: 'O1', element: 'O' },
    { id: 'O2', element: 'O' },
  ],
  reactants: [
    {
      id: 'H2a',
      formula: 'H₂',
      state: 'g',
      atoms: ['H1', 'H2'],
      bonds: [{ a: 'H1', b: 'H2', pairs: ['ab'], bondKey: 'H-H' }],
      coords: { H1: [0, HH / 2, 0], H2: [0, -HH / 2, 0] },
      place: [-235, 0, 0],
    },
    {
      id: 'O2',
      formula: 'O₂',
      state: 'g',
      atoms: ['O1', 'O2'],
      bonds: [{ a: 'O1', b: 'O2', pairs: ['ab', 'ab'], bondKey: 'O=O' }],
      lonePairs: { O1: 2, O2: 2 },
      coords: { O1: [0, OO / 2, 0], O2: [0, -OO / 2, 0] },
      place: [0, 0, 0],
    },
    {
      id: 'H2b',
      formula: 'H₂',
      state: 'g',
      atoms: ['H3', 'H4'],
      bonds: [{ a: 'H3', b: 'H4', pairs: ['ab'], bondKey: 'H-H' }],
      coords: { H3: [0, HH / 2, 0], H4: [0, -HH / 2, 0] },
      place: [235, 0, 0],
    },
  ],
  products: [
    {
      id: 'W1',
      formula: 'H₂O',
      state: 'l',
      atoms: ['O1', 'H1', 'H3'],
      bonds: [
        { a: 'O1', b: 'H1', pairs: ['ab'], bondKey: 'O-H' },
        { a: 'O1', b: 'H3', pairs: ['ab'], bondKey: 'O-H' },
      ],
      lonePairs: { O1: 2 },
      coords: { O1: W1.O, H1: W1.Ha, H3: W1.Hb },
      angles: [{ a: 'H1', center: 'O1', b: 'H3', angleKey: 'water' }],
      place: [0, 118, 0],
    },
    {
      id: 'W2',
      formula: 'H₂O',
      state: 'l',
      atoms: ['O2', 'H2', 'H4'],
      bonds: [
        { a: 'O2', b: 'H2', pairs: ['ab'], bondKey: 'O-H' },
        { a: 'O2', b: 'H4', pairs: ['ab'], bondKey: 'O-H' },
      ],
      lonePairs: { O2: 2 },
      coords: { O2: W2.O, H2: W2.Ha, H4: W2.Hb },
      angles: [{ a: 'H2', center: 'O2', b: 'H4', angleKey: 'water' }],
      place: [0, -118, 0],
    },
  ],
  split: {
    H1: [-245, 150, 0],
    H2: [-245, -150, 0],
    H3: [245, 150, 0],
    H4: [245, -150, 0],
    O1: [0, 185, 0],
    O2: [0, -185, 0],
  },
  steps: [
    { id: 'reactants', from: 0, to: 4.5 },
    { id: 'atoms', from: 4.5, to: 10 },
    { id: 'breaking', from: 10, to: 15.5 },
    { id: 'pairs', from: 15.5, to: 23 },
    { id: 'molecule', from: 23, to: 28 },
    { id: 'result', from: 28, to: 32.5 },
  ],
  captions: {
    reactants: { ru: 'гремучая смесь  H₂ : O₂ = 2 : 1', en: 'oxyhydrogen mixture  H₂ : O₂ = 2 : 1', uz: 'qaldiroq gaz  H₂ : O₂ = 2 : 1' },
    condition: { ru: 'искра', en: 'spark', uz: 'uchqun' },
    result: { ru: 'вода: H–O–H', en: 'water: H–O–H', uz: 'suv: H–O–H' },
  },
  text: H2O_LESSON_TEXT,
}
