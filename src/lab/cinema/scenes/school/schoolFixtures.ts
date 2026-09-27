import type { SchoolSceneSpec } from './schoolSpec'
import { H2O_SPEC } from '../h2o/h2oSpec'

/**
 * ЗАГОТОВКИ ДВИЖКА (не сцены урока!): проверяют, что движок принимает трудные случаи спецификаций
 * без правок — донорно-акцепторную пару, тройную связь, сохранённую при реакции связь, неспаренный
 * электрон в продукте. Их читают тест scripts/test-school-scene.mts и страница предпросмотра
 * school-preview.html. Числа геометрии здесь приблизительные и в каталог не идут; научные
 * спецификации веществ пишутся отдельно (с ключами ядра bondData).
 */

const NO_TEXT = H2O_SPEC.text
const STEPS6 = H2O_SPEC.steps
type P3 = [number, number, number]
const TET: readonly P3[] = [
  [1, 1, 1],
  [1, -1, -1],
  [-1, 1, -1],
  [-1, -1, 1],
].map((v) => v.map((x) => x / Math.sqrt(3)) as P3)
const at = (d: P3, r: number, dx = 0): P3 => [d[0] * r + dx, d[1] * r, d[2] * r]
const CAP = { reactants: { ru: 'заготовка движка', en: 'engine fixture', uz: 'dvigatel namunasi' }, result: { ru: 'заготовка движка', en: 'engine fixture', uz: 'dvigatel namunasi' } }
/** 2C + O₂ → 2CO: C≡O = две обменные пары + донорная пара O → C. */
export const FIX_CO: SchoolSceneSpec = {
  id: 'fixture-co',
  product: 'CO',
  equation: '2C + O₂ → 2CO',
  textbook: { grade: 7, page: 69 },
  atoms: [
    { id: 'C1', element: 'C' },
    { id: 'C2', element: 'C' },
    { id: 'O1', element: 'O' },
    { id: 'O2', element: 'O' },
  ],
  reactants: [
    { id: 'Ca', formula: 'C', state: 's', atoms: ['C1'], bonds: [], lonePairs: { C1: 1 }, unpaired: { C1: 2 }, coords: { C1: [0, 0, 0] }, place: [-220, -60, 0] },
    { id: 'Cb', formula: 'C', state: 's', atoms: ['C2'], bonds: [], lonePairs: { C2: 1 }, unpaired: { C2: 2 }, coords: { C2: [0, 0, 0] }, place: [220, -60, 0] },
    { id: 'O2m', formula: 'O₂', state: 'g', atoms: ['O1', 'O2'], bonds: [{ a: 'O1', b: 'O2', pairs: ['ab', 'ab'], bondKey: 'O=O' }], lonePairs: { O1: 2, O2: 2 }, coords: { O1: [-60.375, 0, 0], O2: [60.375, 0, 0] }, place: [0, 70, 0] },
  ],
  products: [
    { id: 'CO1', formula: 'CO', state: 'g', atoms: ['C1', 'O1'], bonds: [{ a: 'C1', b: 'O1', pairs: ['ab', 'ab', 'b'], lengthPm: 112.8, source: 'NIST CCCBDB' }], lonePairs: { C1: 1, O1: 1 }, coords: { C1: [-56.4, 0, 0], O1: [56.4, 0, 0] }, place: [-150, 0, 0] },
    { id: 'CO2m', formula: 'CO', state: 'g', atoms: ['C2', 'O2'], bonds: [{ a: 'O2', b: 'C2', pairs: ['ab', 'ab', 'a'], lengthPm: 112.8, source: 'NIST CCCBDB' }], lonePairs: { C2: 1, O2: 1 }, coords: { C2: [56.4, 0, 0], O2: [-56.4, 0, 0] }, place: [150, 0, 0] },
  ],
  split: { C1: [-250, -80, 0], C2: [250, -80, 0], O1: [-120, 120, 0], O2: [120, 120, 0] },
  steps: STEPS6,
  captions: CAP,
  text: NO_TEXT,
}
/** 2NO + O₂ → 2NO₂: связь N=O сохраняется, N — донор пары для O, неспаренный электрон остаётся на N. */
export const FIX_NO2: SchoolSceneSpec = {
  id: 'fixture-no2',
  product: 'NO₂',
  equation: '2NO + O₂ → 2NO₂',
  textbook: { grade: 7, page: 71 },
  atoms: [
    { id: 'N1', element: 'N' },
    { id: 'O1', element: 'O' },
    { id: 'N2', element: 'N' },
    { id: 'O2', element: 'O' },
    { id: 'O3', element: 'O' },
    { id: 'O4', element: 'O' },
  ],
  reactants: [
    { id: 'NOa', formula: 'NO', state: 'g', atoms: ['N1', 'O1'], bonds: [{ a: 'N1', b: 'O1', pairs: ['ab', 'ab'], lengthPm: 115.1, source: 'NIST' }], lonePairs: { N1: 1, O1: 2 }, unpaired: { N1: 1 }, coords: { N1: [0, 0, 0], O1: [-115.1, 0, 0] }, place: [-200, 0, 0] },
    { id: 'NOb', formula: 'NO', state: 'g', atoms: ['N2', 'O2'], bonds: [{ a: 'N2', b: 'O2', pairs: ['ab', 'ab'], lengthPm: 115.1, source: 'NIST' }], lonePairs: { N2: 1, O2: 2 }, unpaired: { N2: 1 }, coords: { N2: [0, 0, 0], O2: [115.1, 0, 0] }, place: [200, 0, 0] },
    { id: 'O2m', formula: 'O₂', state: 'g', atoms: ['O3', 'O4'], bonds: [{ a: 'O3', b: 'O4', pairs: ['ab', 'ab'], bondKey: 'O=O' }], lonePairs: { O3: 2, O4: 2 }, coords: { O3: [-60.375, 0, 0], O4: [60.375, 0, 0] }, place: [0, 120, 0] },
  ],
  products: [
    { id: 'P1', formula: 'NO₂', state: 'g', atoms: ['N1', 'O1', 'O3'], bonds: [{ a: 'O1', b: 'N1', pairs: ['ab', 'ab'], lengthPm: 115.1, source: 'NIST' }, { a: 'N1', b: 'O3', pairs: ['a'], lengthPm: 119.7, source: 'NIST' }], lonePairs: { O1: 2, O3: 3 }, unpaired: { N1: 1 }, coords: { N1: [0, 0, 0], O1: [-115.1, 0, 0], O3: [119.7 * Math.cos(Math.PI - 2.339), 119.7 * Math.sin(Math.PI - 2.339), 0] }, place: [-200, 0, 0] },
    { id: 'P2', formula: 'NO₂', state: 'g', atoms: ['N2', 'O2', 'O4'], bonds: [{ a: 'N2', b: 'O2', pairs: ['ab', 'ab'], lengthPm: 115.1, source: 'NIST' }, { a: 'N2', b: 'O4', pairs: ['a'], lengthPm: 119.7, source: 'NIST' }], lonePairs: { O2: 2, O4: 3 }, unpaired: { N2: 1 }, coords: { N2: [0, 0, 0], O2: [115.1, 0, 0], O4: [-119.7 * Math.cos(Math.PI - 2.339), 119.7 * Math.sin(Math.PI - 2.339), 0] }, place: [200, 0, 0] },
  ],
  split: { N1: [-200, 0, 0], O1: [-315.1, 0, 0], N2: [200, 0, 0], O2: [315.1, 0, 0], O3: [-110, 150, 0], O4: [110, 150, 0] },
  steps: STEPS6,
  captions: CAP,
  text: NO_TEXT,
}

/**
 * NH₃ + HCl → NH₄Cl: ионы и гетеролиз. H–Cl рвётся ГЕТЕРОЛИТИЧЕСКИ (пара уходит к Cl → Cl⁻),
 * в NH₄⁺ у N формальный заряд +1 (четыре пары 'ab'); недостающий электрон H⁺ движок берёт из
 * неподелённой пары N — по сути донорно-акцепторная связь N → H⁺.
 */
export const FIX_NH4CL: SchoolSceneSpec = {
  id: 'fixture-nh4cl',
  product: 'NH₄Cl',
  equation: 'NH₃ + HCl → NH₄Cl',
  textbook: { grade: 8, page: 0 },
  atoms: [
    { id: 'N1', element: 'N' },
    { id: 'H1', element: 'H' },
    { id: 'H2', element: 'H' },
    { id: 'H3', element: 'H' },
    { id: 'H4', element: 'H' },
    { id: 'Cl1', element: 'Cl' },
  ],
  reactants: [
    {
      id: 'NH3',
      formula: 'NH₃',
      state: 'g',
      atoms: ['N1', 'H1', 'H2', 'H3'],
      bonds: ['H1', 'H2', 'H3'].map((h) => ({ a: 'N1', b: h, pairs: ['ab'] as const, lengthPm: 101.2, source: 'заготовка' })),
      lonePairs: { N1: 1 },
      coords: { N1: [0, 0, 0], H1: at(TET[1]!, 101.2), H2: at(TET[2]!, 101.2), H3: at(TET[3]!, 101.2) },
      place: [-170, 0, 0],
    },
    {
      id: 'HCl',
      formula: 'HCl',
      state: 'g',
      atoms: ['H4', 'Cl1'],
      bonds: [{ a: 'H4', b: 'Cl1', pairs: ['ab'], bondKey: 'H-Cl', breakTo: 'b' }],
      lonePairs: { Cl1: 3 },
      coords: { H4: [-63.73, 0, 0], Cl1: [63.73, 0, 0] },
      place: [170, 0, 0],
    },
  ],
  products: [
    {
      id: 'NH4',
      formula: 'NH₄⁺',
      state: 's',
      atoms: ['N1', 'H1', 'H2', 'H3', 'H4'],
      bonds: ['H1', 'H2', 'H3', 'H4'].map((h) => ({ a: 'N1', b: h, pairs: ['ab'] as const, lengthPm: 103, source: 'заготовка' })),
      charges: { N1: 1 },
      coords: { N1: [0, 0, 0], H4: at(TET[0]!, 103), H1: at(TET[1]!, 103), H2: at(TET[2]!, 103), H3: at(TET[3]!, 103) },
      place: [-90, 0, 0],
    },
    { id: 'Cl', formula: 'Cl⁻', state: 's', atoms: ['Cl1'], bonds: [], lonePairs: { Cl1: 4 }, charges: { Cl1: -1 }, coords: { Cl1: [0, 0, 0] }, place: [190, 0, 0] },
  ],
  split: {
    N1: [-170, 0, 0],
    H1: at(TET[1]!, 101.2, -170),
    H2: at(TET[2]!, 101.2, -170),
    H3: at(TET[3]!, 101.2, -170),
    H4: [40, 90, 0],
    Cl1: [230, 0, 0],
  },
  steps: STEPS6,
  captions: CAP,
  text: NO_TEXT,
}
