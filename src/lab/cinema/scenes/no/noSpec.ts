import { bondLengthPm } from '../../../../chemistry/data/bondData'
import type { SchoolSceneSpec } from '../school/schoolSpec'
import { lessonText, stepTimings, textbookOf } from '../school/specs/adapter'
import { NO_SPEC as NO_SCIENCE } from '../school/specs/no'

/**
 * Школьная сцена N₂ + O₂ → 2NO (Kimyo 7, § 4.5, с. 95; § 2.13, с. 71 — гроза). Химия и тексты —
 * из научной спецификации specs/no.ts (проверена scripts/test-school-specs.mts), здесь — постановка
 * кадра в пм. Длины — только из ядра bondData: N≡N, O=O, N=O (в NO 115,1 пм).
 *
 * Электроны (школьная модель Льюиса):
 *   • N₂: три общие пары N≡N, у каждого N неподелённая пара (N +7 )2 )5);
 *   • O₂: школьная запись O=O, у каждого O две неподелённые пары;
 *   • разрыв: каждая пара расходится по электрону → N: пара + 3 неспаренных, O: 2 пары + 2 неспаренных;
 *   • NO: две общие пары N=O (по электрону от N и O), у N неподелённая пара и ОДИН неспаренный
 *     электрон, у O две неподелённые пары — всего 11 внешних электронов (порядок связи 2½ — в note).
 *
 * Раскладка: N₂ сверху, O₂ снизу; после разрыва атомы расходятся влево и вправо, и слева и справа
 * встают две одинаковые вертикальные молекулы N=O (азот сверху).
 */

const NN = bondLengthPm('N#N')
const OO = bondLengthPm('O=O')
const NO = bondLengthPm('N=O')

export const NO_SCENE_SPEC: SchoolSceneSpec = {
  id: 'no',
  product: 'NO',
  equation: NO_SCIENCE.reaction.equation,
  textbook: textbookOf(NO_SCIENCE),
  atoms: [
    { id: 'N1', element: 'N' },
    { id: 'N2', element: 'N' },
    { id: 'O1', element: 'O' },
    { id: 'O2', element: 'O' },
  ],
  reactants: [
    {
      id: 'N2m',
      formula: 'N₂',
      state: 'g',
      atoms: ['N1', 'N2'],
      bonds: [{ a: 'N1', b: 'N2', pairs: ['ab', 'ab', 'ab'], bondKey: 'N#N' }],
      lonePairs: { N1: 1, N2: 1 },
      coords: { N1: [-NN / 2, 0, 0], N2: [NN / 2, 0, 0] },
      place: [0, 88, 0],
    },
    {
      id: 'O2m',
      formula: 'O₂',
      state: 'g',
      atoms: ['O1', 'O2'],
      bonds: [{ a: 'O1', b: 'O2', pairs: ['ab', 'ab'], bondKey: 'O=O' }],
      lonePairs: { O1: 2, O2: 2 },
      coords: { O1: [-OO / 2, 0, 0], O2: [OO / 2, 0, 0] },
      place: [0, -88, 0],
    },
  ],
  products: [
    {
      id: 'NOa',
      formula: 'NO',
      state: 'g',
      atoms: ['N1', 'O1'],
      bonds: [{ a: 'N1', b: 'O1', pairs: ['ab', 'ab'], bondKey: 'N=O' }],
      lonePairs: { N1: 1, O1: 2 },
      unpaired: { N1: 1 },
      coords: { N1: [0, NO / 2, 0], O1: [0, -NO / 2, 0] },
      place: [-165, 0, 0],
    },
    {
      id: 'NOb',
      formula: 'NO',
      state: 'g',
      atoms: ['N2', 'O2'],
      bonds: [{ a: 'N2', b: 'O2', pairs: ['ab', 'ab'], bondKey: 'N=O' }],
      lonePairs: { N2: 1, O2: 2 },
      unpaired: { N2: 1 },
      coords: { N2: [0, NO / 2, 0], O2: [0, -NO / 2, 0] },
      place: [165, 0, 0],
    },
  ],
  split: {
    N1: [-205, 112, 0],
    N2: [205, 112, 0],
    O1: [-205, -112, 0],
    O2: [205, -112, 0],
  },
  // Плоские / линейные молекулы: лёгкий поворот, чтобы угол и пары не уходили за шары.
  productTurn: 0.4,
  steps: stepTimings(NO_SCIENCE),
  captions: NO_SCIENCE.captions,
  text: { ru: lessonText(NO_SCIENCE, 'ru'), en: lessonText(NO_SCIENCE, 'en'), uz: lessonText(NO_SCIENCE, 'uz') },
}
