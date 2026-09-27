import { bondAngleDeg, bondLengthPm } from '../../../../chemistry/data/bondData'
import type { SchoolSceneSpec, SchoolVec3 } from '../school/schoolSpec'
import { lessonText, stepTimings, textbookOf } from '../school/specs/adapter'
import { NO2_SPEC as NO2_SCIENCE } from '../school/specs/no2'

/**
 * Школьная сцена 2NO + O₂ → 2NO₂ (Kimyo 7, § 4.5, с. 96; § 2.13, с. 71). Химия и тексты — из научной
 * спецификации specs/no2.ts; здесь — постановка кадра в пм. Числа — только из ядра bondData:
 * N=O в NO 115,1 пм; в NO₂ обе связи 'N-O(NO2)' 119,3 пм, угол 'nitrogenDioxide' 134,1°.
 *
 * Электроны:
 *   • NO: N=O (две общие пары), у N неподелённая пара и неспаренный электрон, у O две пары;
 *   • связь N=O молекулы NO СОХРАНЯЕТСЯ (движок: пары реагента и продукта совпадают);
 *   • O=O рвётся; свободный атом O — акцептор: спаривает свои электроны в 3 пары (splitElectrons
 *     спецификации), освобождая место для пары азота;
 *   • новая связь N→O донорно-акцепторная: общая пара — неподелённая пара азота ('a', донор N);
 *   • в NO₂ неспаренный электрон остаётся на N; 17 внешних электронов.
 *
 * Раскладка: O₂ сверху по центру, две молекулы NO слева и справа (каждая уже повёрнута так, как
 * войдёт в NO₂); атомы O уходят вниз-внутрь к азоту, получаются две зеркальные изогнутые NO₂.
 */

const NO = bondLengthPm('N=O')
const OO = bondLengthPm('O=O')
const L = bondLengthPm('N-O(NO2)')
const HALF = ((bondAngleDeg('nitrogenDioxide') / 2) * Math.PI) / 180
const SX = Math.sin(HALF)
const CY = Math.cos(HALF)
/** NO₂: N сверху, два O снизу слева и справа; центр — середина по высоте. */
const bent = (sign: 1 | -1): { N: SchoolVec3; Oin: SchoolVec3; Oout: SchoolVec3 } => ({
  N: [0, (L * CY) / 2, 0],
  // «внешний» O (из NO) — к краю кадра, «внутренний» (из O₂) — к центру
  Oout: [-sign * L * SX, (-L * CY) / 2, 0],
  Oin: [sign * L * SX, (-L * CY) / 2, 0],
})
const P1 = bent(1)
const P2 = bent(-1)
/** NO реагента повёрнута как связь N–O в NO₂ (сохранённая связь не крутится). */
const noCoords = (sign: 1 | -1): SchoolVec3 => [-sign * NO * SX, -NO * CY, 0]

export const NO2_SCENE_SPEC: SchoolSceneSpec = {
  id: 'no2',
  product: 'NO₂',
  equation: NO2_SCIENCE.reaction.equation,
  textbook: textbookOf(NO2_SCIENCE),
  atoms: [
    { id: 'N1', element: 'N' },
    { id: 'N2', element: 'N' },
    { id: 'O1', element: 'O' },
    { id: 'O2', element: 'O' },
    { id: 'O3', element: 'O' },
    { id: 'O4', element: 'O' },
  ],
  reactants: [
    {
      id: 'NOa',
      formula: 'NO',
      state: 'g',
      atoms: ['N1', 'O1'],
      bonds: [{ a: 'N1', b: 'O1', pairs: ['ab', 'ab'], bondKey: 'N=O' }],
      lonePairs: { N1: 1, O1: 2 },
      unpaired: { N1: 1 },
      coords: { N1: [0, 0, 0], O1: noCoords(1) },
      place: [-175, 20, 0],
    },
    {
      id: 'O2m',
      formula: 'O₂',
      state: 'g',
      atoms: ['O3', 'O4'],
      bonds: [{ a: 'O3', b: 'O4', pairs: ['ab', 'ab'], bondKey: 'O=O' }],
      lonePairs: { O3: 2, O4: 2 },
      coords: { O3: [-OO / 2, 0, 0], O4: [OO / 2, 0, 0] },
      place: [0, 125, 0],
    },
    {
      id: 'NOb',
      formula: 'NO',
      state: 'g',
      atoms: ['N2', 'O2'],
      bonds: [{ a: 'N2', b: 'O2', pairs: ['ab', 'ab'], bondKey: 'N=O' }],
      lonePairs: { N2: 1, O2: 2 },
      unpaired: { N2: 1 },
      coords: { N2: [0, 0, 0], O2: noCoords(-1) },
      place: [175, 20, 0],
    },
  ],
  products: [
    {
      id: 'NO2a',
      formula: 'NO₂',
      state: 'g',
      atoms: ['N1', 'O1', 'O3'],
      bonds: [
        { a: 'N1', b: 'O1', pairs: ['ab', 'ab'], bondKey: 'N-O(NO2)' },
        { a: 'N1', b: 'O3', pairs: ['a'], bondKey: 'N-O(NO2)' },
      ],
      lonePairs: { O1: 2, O3: 3 },
      unpaired: { N1: 1 },
      coords: { N1: P1.N, O1: P1.Oout, O3: P1.Oin },
      angles: [{ a: 'O1', center: 'N1', b: 'O3', angleKey: 'nitrogenDioxide' }],
      place: [-185, -5, 0],
    },
    {
      id: 'NO2b',
      formula: 'NO₂',
      state: 'g',
      atoms: ['N2', 'O2', 'O4'],
      bonds: [
        { a: 'N2', b: 'O2', pairs: ['ab', 'ab'], bondKey: 'N-O(NO2)' },
        { a: 'N2', b: 'O4', pairs: ['a'], bondKey: 'N-O(NO2)' },
      ],
      lonePairs: { O2: 2, O4: 3 },
      unpaired: { N2: 1 },
      coords: { N2: P2.N, O2: P2.Oout, O4: P2.Oin },
      angles: [{ a: 'O2', center: 'N2', b: 'O4', angleKey: 'nitrogenDioxide' }],
      place: [185, -5, 0],
    },
  ],
  // Фрагменты NO не рвутся — стоят на месте (длина N=O сохраняется); атомы O уходят к азоту.
  split: {
    N1: [-175, 20, 0],
    O1: [-175 - NO * SX, 20 - NO * CY, 0],
    N2: [175, 20, 0],
    O2: [175 + NO * SX, 20 - NO * CY, 0],
    O3: [-80, 118, 0],
    O4: [80, 118, 0],
  },
  // Атом O — акцептор донорно-акцепторной пары азота: 3 неподелённые пары, неспаренных нет (specs/no2.ts).
  splitElectrons: { O3: { lone: 3, unpaired: 0 }, O4: { lone: 3, unpaired: 0 } },
  // Плоские / линейные молекулы: лёгкий поворот, чтобы угол и пары не уходили за шары.
  productTurn: 0.3,
  steps: stepTimings(NO2_SCIENCE),
  captions: NO2_SCIENCE.captions,
  text: { ru: lessonText(NO2_SCIENCE, 'ru'), en: lessonText(NO2_SCIENCE, 'en'), uz: lessonText(NO2_SCIENCE, 'uz') },
}
