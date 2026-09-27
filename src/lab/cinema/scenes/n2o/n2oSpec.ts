import { bondAngleDeg, bondLengthPm } from '../../../../chemistry/data/bondData'
import { reagentAngleDeg, reagentBondPm } from '../../../../chemistry/data'
import type { SchoolSceneSpec, SchoolVec3 } from '../school/schoolSpec'
import { lessonText, stepTimings, textbookOf } from '../school/specs/adapter'
import { N2O_SPEC as N2O_SCIENCE } from '../school/specs/n2o'

/**
 * Школьная сцена NH₄NO₃ →(t°) N₂O + 2H₂O (Kimyo 8, § 39, с. 168; запись 7 кл., с. 102 «N₂ + O₃» — только
 * в note: так почти не идёт). Химия и тексты — из научной спецификации specs/n2o.ts; здесь — кадр в пм.
 *
 * Реагент — пара ионов (поле charges):
 *   • NH₄⁺: четыре общие пары N–H (по электрону от N и H) — у азота 4 электрона, заряд +1;
 *     длина N–H — как в аммиаке ('N-H'), угол тетраэдрический — это схема иона;
 *   • NO₃⁻: N=O (две пары), N→O (донорно-акцепторная пара азота) и N–O⁻ (у O три неподелённые пары,
 *     заряд −1); длина N–O нитрат-иона 124 пм и угол 120° — из ядра (REAGENT_GEOMETRY.n2o5Crystal).
 * Разрыв — по схеме подсчёта атомов учебника «NH₄NO₃ → N + NO + 4H + 2O»: связи N–H и две связи N–O
 * рвутся по электрону к атомам; ионы становятся НЕЙТРАЛЬНЫМИ атомами (splitCharges): электрон, которого
 * не хватает азоту NH₄⁺, возвращается к нему от O⁻ нитрата. Связь N→O нитрата СОХРАНЯЕТСЯ и переходит
 * в N₂O. Концевой N — из NH₄⁺, центральный — из NO₃⁻ (опыт с меткой ¹⁵N — note спецификации).
 * Продукт: N≡N→O, линейная, N–N 112,8 и N–O 118,4 пм ('N-N(N2O)', 'N-O(N2O)'), 180°; у концевого N
 * неподелённая пара, у O три. Вода — O–H 95,8 пм, 104,5°.
 *
 * Раскладка: NH₄⁺ слева, NO₃⁻ справа (N→O смотрит вправо). Азот аммония уходит вправо к азоту нитрата
 * — N₂O в центре; кислороды нитрата уходят вверх-влево и вниз-влево, где их ждут атомы H: две воды слева.
 */

const NH = bondLengthPm('N-H')
const NO3 = reagentBondPm('n2o5Crystal', 'N–O(NO₃⁻)')
const NO3_ANGLE = reagentAngleDeg('n2o5Crystal', '∠O–N–O(NO₃⁻)')
const NO3_SRC = 'REAGENT_GEOMETRY.n2o5Crystal (ядро): Grison, Eriks & de Vries, Acta Cryst. 3 (1950) 290'
const NN = bondLengthPm('N-N(N2O)')
const NOx = bondLengthPm('N-O(N2O)')
const OH = bondLengthPm('O-H')
const HOH = bondAngleDeg('water')

/** Тетраэдр «в кубе»: проекции четырёх H на плоскость кадра не совпадают. */
const tet = (x: number, y: number, z: number): SchoolVec3 => {
  const k = NH / Math.sqrt(3)
  return [x * k, y * k, z * k]
}
const rad = (d: number) => (d * Math.PI) / 180
/** Нитрат: O2 (N→O) вправо, O1 и O3 — под углом 120° (NO3_ANGLE) вверх-влево и вниз-влево. */
const nitrate = (deg: number): SchoolVec3 => [NO3 * Math.cos(rad(deg)), NO3 * Math.sin(rad(deg)), 0]
/** Вода: O сверху, H снизу (как h2oSpec). */
const half = rad(HOH / 2)
const WX = OH * Math.sin(half)
const WY = OH * Math.cos(half)
/** N₂O: N–N–O по оси x, центр — середина молекулы. */
const N2O_MID = (NN + NOx) / 2

export const N2O_SCENE_SPEC: SchoolSceneSpec = {
  id: 'n2o',
  product: 'N₂O',
  equation: N2O_SCIENCE.reaction.equation,
  textbook: textbookOf(N2O_SCIENCE),
  atoms: [
    { id: 'N1', element: 'N' },
    { id: 'H1', element: 'H' },
    { id: 'H2', element: 'H' },
    { id: 'H3', element: 'H' },
    { id: 'H4', element: 'H' },
    { id: 'N2', element: 'N' },
    { id: 'O1', element: 'O' },
    { id: 'O2', element: 'O' },
    { id: 'O3', element: 'O' },
  ],
  reactants: [
    {
      id: 'NH4',
      formula: 'NH₄⁺',
      state: 's',
      atoms: ['N1', 'H1', 'H2', 'H3', 'H4'],
      bonds: (['H1', 'H2', 'H3', 'H4'] as const).map((h) => ({ a: 'N1', b: h, pairs: ['ab'] as const, bondKey: 'N-H' as const })),
      charges: { N1: 1 },
      // H1, H3 — верхние (к воде W1), H2, H4 — нижние (к воде W2).
      coords: { N1: [0, 0, 0], H1: tet(-1, 1, -1), H3: tet(1, 1, 1), H2: tet(-1, -1, 1), H4: tet(1, -1, -1) },
      angles: [{ a: 'H1', center: 'N1', b: 'H2', angleKey: 'tetrahedral' }],
      place: [-150, 0, 0],
    },
    {
      id: 'NO3',
      formula: 'NO₃⁻',
      state: 's',
      atoms: ['N2', 'O1', 'O2', 'O3'],
      bonds: [
        { a: 'N2', b: 'O1', pairs: ['ab', 'ab'], lengthPm: NO3, source: NO3_SRC },
        { a: 'N2', b: 'O2', pairs: ['a'], lengthPm: NO3, source: NO3_SRC },
        { a: 'N2', b: 'O3', pairs: ['ab'], lengthPm: NO3, source: NO3_SRC },
      ],
      lonePairs: { O1: 2, O2: 3, O3: 3 },
      charges: { O3: -1 },
      coords: { N2: [0, 0, 0], O2: nitrate(0), O1: nitrate(NO3_ANGLE), O3: nitrate(-NO3_ANGLE) },
      angles: [{ a: 'O1', center: 'N2', b: 'O2', deg: NO3_ANGLE, source: NO3_SRC }],
      place: [95, 0, 0],
    },
  ],
  products: [
    {
      id: 'N2O',
      formula: 'N₂O',
      state: 'g',
      atoms: ['N1', 'N2', 'O2'],
      bonds: [
        { a: 'N1', b: 'N2', pairs: ['ab', 'ab', 'ab'], bondKey: 'N-N(N2O)' },
        { a: 'N2', b: 'O2', pairs: ['a'], bondKey: 'N-O(N2O)' },
      ],
      lonePairs: { N1: 1, O2: 3 },
      coords: { N1: [-N2O_MID, 0, 0], N2: [NN - N2O_MID, 0, 0], O2: [N2O_MID, 0, 0] },
      angles: [{ a: 'N1', center: 'N2', b: 'O2', angleKey: 'nitrousOxide' }],
      place: [45, 0, 0],
    },
    {
      id: 'W1',
      formula: 'H₂O',
      state: 'g',
      atoms: ['O1', 'H1', 'H3'],
      bonds: [
        { a: 'O1', b: 'H1', pairs: ['ab'], bondKey: 'O-H' },
        { a: 'O1', b: 'H3', pairs: ['ab'], bondKey: 'O-H' },
      ],
      lonePairs: { O1: 2 },
      coords: { O1: [0, WY / 2, 0], H1: [-WX, -WY / 2, 0], H3: [WX, -WY / 2, 0] },
      angles: [{ a: 'H1', center: 'O1', b: 'H3', angleKey: 'water' }],
      place: [-190, 120, 0],
    },
    {
      id: 'W2',
      formula: 'H₂O',
      state: 'g',
      atoms: ['O3', 'H2', 'H4'],
      bonds: [
        { a: 'O3', b: 'H2', pairs: ['ab'], bondKey: 'O-H' },
        { a: 'O3', b: 'H4', pairs: ['ab'], bondKey: 'O-H' },
      ],
      lonePairs: { O3: 2 },
      coords: { O3: [0, -WY / 2, 0], H2: [-WX, WY / 2, 0], H4: [WX, WY / 2, 0] },
      angles: [{ a: 'H2', center: 'O3', b: 'H4', angleKey: 'water' }],
      place: [-190, -120, 0],
    },
  ],
  split: {
    N1: [-95, 0, 0],
    H1: [-285, 95, 0],
    H3: [-135, 150, 0],
    H2: [-285, -95, 0],
    H4: [-135, -150, 0],
    N2: [95, 0, 0],
    O2: [95 + NO3, 0, 0],
    O1: [-10, 175, 0],
    O3: [-10, -175, 0],
  },
  // Ионы → нейтральные атомы: азоту аммония возвращается электрон от O⁻ нитрата.
  splitCharges: { N1: 0, O3: 0 },
  // Свободный атом азота: пара + 3 неспаренных (N +7 )2 )5).
  splitElectrons: { N1: { lone: 1, unpaired: 3 } },
  steps: stepTimings(N2O_SCIENCE),
  captions: N2O_SCIENCE.captions,
  text: { ru: lessonText(N2O_SCIENCE, 'ru'), en: lessonText(N2O_SCIENCE, 'en'), uz: lessonText(N2O_SCIENCE, 'uz') },
}
