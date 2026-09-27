import { bondAngleDeg, bondLengthPm } from '../../../../chemistry/data/bondData'
import { reagentAngleDeg, reagentBondPm } from '../../../../chemistry/data'
import type { SchoolSceneSpec, SchoolVec3 } from '../school/schoolSpec'
import { lessonText, stepTimings, textbookOf } from '../school/specs/adapter'
import { N2O5_SPEC as N2O5_SCIENCE } from '../school/specs/n2o5'

/**
 * Школьная сцена N₂O₅ + H₂O → 2HNO₃ (Kimyo 7, § 6.4, с. 139: «кислотный оксид + вода → кислота»).
 * Химия и тексты — из научной спецификации specs/n2o5.ts; здесь — кадр в пм.
 *
 * Молекула из пара O₂N–O–NO₂ (ядро REAGENT_GEOMETRY.n2o5, McClelland 2001): концевые N–O 118,8 пм,
 * мостиковые N–O 150,5 пм, ∠N–O–N 112,3°, ∠O–N–O 134,2°. Азот плоский (sp²): два угла O(мост)–N–O
 * в ядре не даны, берём их равными (360° − 134,2°) / 2 и не подписываем; поворот групп NO₂
 * «пропеллером» в ядре тоже не задан — рисуем молекулу плоской (это схема, как на доске).
 * У каждого азота четыре общие пары: N=O (две), N→O (донорно-акцепторная пара азота), N–O(мост).
 *
 * Механизм (гетеролиз, поле breakTo): мостиковая связь N2–O рвётся, пара уходит к мостиковому O
 * (остаются NO₃⁻ и NO₂⁺); связь O–H воды рвётся, пара уходит к O воды (OH⁻ и H⁺). Затем бывшая пара
 * N–O мостика становится парой O–H первой кислоты, а бывшая пара O–H воды — парой O–N второй
 * (движок переносит электрон к партнёру по связи продукта). Получаются две HNO₃: H–O–N(=O)→O,
 * геометрия — REAGENT_GEOMETRY.hno3 (Cox & Riveros 1965): плоская молекула, атом H на стороне цис-O.
 */

const G = (name: string) => reagentBondPm('n2o5', name)
const A = (name: string) => reagentAngleDeg('n2o5', name)
const SRC_N2O5 = 'REAGENT_GEOMETRY.n2o5 (ядро): McClelland et al., Helv. Chim. Acta 84 (2001) 1612'
const SRC_HNO3 = 'REAGENT_GEOMETRY.hno3 (ядро): Cox & Riveros, J. Chem. Phys. 42 (1965) 3106'
const NO_END = G('N=O')
const NO_BRIDGE = G('N–O(мост)')
const NON = A('∠N–O–N')
const ONO = A('∠O=N=O')
const H = (name: string) => reagentBondPm('hno3', name)
const HA = (name: string) => reagentAngleDeg('hno3', name)
const OH_W = bondLengthPm('O-H')
const HOH = bondAngleDeg('water')

const rad = (d: number) => (d * Math.PI) / 180
const dir = (deg: number, r: number): [number, number] => [r * Math.cos(rad(deg)), r * Math.sin(rad(deg))]
const at = (o: readonly number[], deg: number, r: number): SchoolVec3 => {
  const [x, y] = dir(deg, r)
  return [o[0]! + x, o[1]! + y, 0]
}

// ——— N₂O₅: мостиковый O1 сверху, N1 слева, N2 справа ———
const bHalf = NON / 2
const O1: SchoolVec3 = [0, 42, 0]
const N1: SchoolVec3 = at(O1, 270 - bHalf, NO_BRIDGE)
const N2: SchoolVec3 = at(O1, 270 + bHalf, NO_BRIDGE)
/** Направление N1 → мостик и два концевых O под углами (360° − ∠ONO) / 2 от него. */
const toBridge1 = 90 - bHalf
const side = (360 - ONO) / 2
const N2O5_COORDS: Record<string, SchoolVec3> = {
  O1,
  N1,
  N2,
  // У N1: O3 (N→O) вверх-влево, O2 (N=O) вниз; у N2 — зеркально: O5 вверх-вправо, O4 вниз.
  O3: at(N1, toBridge1 + side, NO_END),
  O2: at(N1, toBridge1 - side, NO_END),
  O5: at(N2, 180 - (toBridge1 + side), NO_END),
  O4: at(N2, 180 - (toBridge1 - side), NO_END),
}

// ——— HNO₃ (шаблон в системе молекулы, N в начале координат, плоскость кадра) ———
// Шаблон: OH смотрит под углом hDeg; цис-O (N=O) и транс-O (N→O) — по углам ядра; H — на цис-стороне.
function nitric(mirror: boolean, ohDeg: number): { N: SchoolVec3; Oh: SchoolVec3; Ocis: SchoolVec3; Otrans: SchoolVec3; H: SchoolVec3 } {
  const s = mirror ? -1 : 1
  const cis = ohDeg - s * HA('∠HO–N=O(цис)')
  const trans = ohDeg + s * HA('∠HO–N=O(транс)')
  const N: SchoolVec3 = [0, 0, 0]
  const Oh = at(N, ohDeg, H('N–O(H)'))
  // H: от O(H) под углом ∠H–O–N к направлению O → N, в сторону цис-кислорода.
  const back = ohDeg + 180
  const Hh = at(Oh, back + s * HA('∠H–O–N'), H('O–H'))
  return { N, Oh, Ocis: at(N, cis, H('N=O(цис)')), Otrans: at(N, trans, H('N=O(транс)')), H: Hh }
}
// Первая кислота — как группа N1 в N₂O₅ (OH = бывший мостик вверх-вправо), вторая — зеркально.
const K1 = nitric(false, toBridge1)
const K2 = nitric(true, 180 - toBridge1)

const half = rad(HOH / 2)
const WX = OH_W * Math.sin(half)
const WY = OH_W * Math.cos(half)

const P1: SchoolVec3 = [-235, -10, 0]
const P2: SchoolVec3 = [235, -10, 0]
const N2O5_PLACE: SchoolVec3 = [0, 50, 0]
const WATER_PLACE: SchoolVec3 = [0, -200, 0]
const WATER_COORDS: Record<string, SchoolVec3> = { O6: [0, WY / 2, 0], H1: [-WX, -WY / 2, 0], H2: [WX, -WY / 2, 0] }
/** Позиция атома реагента в сцене, сдвинутая на d (фрагменты с сохранёнными связями сдвигаются целиком). */
const moved = (coords: Record<string, SchoolVec3>, place: SchoolVec3, id: string, d: readonly [number, number]): SchoolVec3 => {
  const c = coords[id]!
  return [place[0] + c[0] + d[0], place[1] + c[1] + d[1], place[2] + c[2]]
}
const NO3_SHIFT = [-50, -10] as const
const NO2_SHIFT = [60, -10] as const
const OH_SHIFT = [40, 40] as const

export const N2O5_SCENE_SPEC: SchoolSceneSpec = {
  id: 'n2o5',
  product: 'HNO₃',
  equation: N2O5_SCIENCE.reaction.equation,
  textbook: textbookOf(N2O5_SCIENCE),
  // Порядок атомов: H раньше N — движок раздаёт перенесённые электроны по порядку атомов (и к партнёру).
  atoms: [
    { id: 'H1', element: 'H' },
    { id: 'H2', element: 'H' },
    { id: 'N1', element: 'N' },
    { id: 'N2', element: 'N' },
    { id: 'O1', element: 'O' },
    { id: 'O2', element: 'O' },
    { id: 'O3', element: 'O' },
    { id: 'O4', element: 'O' },
    { id: 'O5', element: 'O' },
    { id: 'O6', element: 'O' },
  ],
  reactants: [
    {
      id: 'N2O5',
      formula: 'N₂O₅',
      state: 'g',
      atoms: ['N1', 'N2', 'O1', 'O2', 'O3', 'O4', 'O5'],
      bonds: [
        { a: 'N1', b: 'O2', pairs: ['ab', 'ab'], lengthPm: NO_END, source: SRC_N2O5 },
        { a: 'N1', b: 'O3', pairs: ['a'], lengthPm: NO_END, source: SRC_N2O5 },
        { a: 'N1', b: 'O1', pairs: ['ab'], lengthPm: NO_BRIDGE, source: SRC_N2O5 },
        { a: 'N2', b: 'O4', pairs: ['ab', 'ab'], lengthPm: NO_END, source: SRC_N2O5 },
        { a: 'N2', b: 'O5', pairs: ['a'], lengthPm: NO_END, source: SRC_N2O5 },
        // Мостиковая связь рвётся гетеролитически: пара уходит к мостиковому O.
        { a: 'N2', b: 'O1', pairs: ['ab'], lengthPm: NO_BRIDGE, source: SRC_N2O5, breakTo: 'b' },
      ],
      lonePairs: { O1: 2, O2: 2, O3: 3, O4: 2, O5: 3 },
      coords: N2O5_COORDS,
      angles: [
        { a: 'N1', center: 'O1', b: 'N2', deg: NON, source: SRC_N2O5 },
        { a: 'O2', center: 'N1', b: 'O3', deg: ONO, source: SRC_N2O5 },
        { a: 'O4', center: 'N2', b: 'O5', deg: ONO, source: SRC_N2O5 },
      ],
      place: N2O5_PLACE,
    },
    {
      id: 'H2O',
      formula: 'H₂O',
      state: 'l',
      atoms: ['O6', 'H1', 'H2'],
      bonds: [
        // Связь O–H воды рвётся гетеролитически: пара уходит к O воды (OH⁻ и H⁺).
        { a: 'O6', b: 'H1', pairs: ['ab'], bondKey: 'O-H', breakTo: 'a' },
        { a: 'O6', b: 'H2', pairs: ['ab'], bondKey: 'O-H' },
      ],
      lonePairs: { O6: 2 },
      coords: WATER_COORDS,
      angles: [{ a: 'H1', center: 'O6', b: 'H2', angleKey: 'water' }],
      place: WATER_PLACE,
    },
  ],
  products: [
    {
      id: 'HNO3a',
      formula: 'HNO₃',
      state: 'l',
      atoms: ['H1', 'O1', 'N1', 'O2', 'O3'],
      bonds: [
        { a: 'H1', b: 'O1', pairs: ['ab'], lengthPm: H('O–H'), source: SRC_HNO3 },
        { a: 'N1', b: 'O1', pairs: ['ab'], lengthPm: H('N–O(H)'), source: SRC_HNO3 },
        { a: 'N1', b: 'O2', pairs: ['ab', 'ab'], lengthPm: H('N=O(цис)'), source: SRC_HNO3 },
        { a: 'N1', b: 'O3', pairs: ['a'], lengthPm: H('N=O(транс)'), source: SRC_HNO3 },
      ],
      lonePairs: { O1: 2, O2: 2, O3: 3 },
      coords: { N1: K1.N, O1: K1.Oh, O2: K1.Ocis, O3: K1.Otrans, H1: K1.H },
      angles: [
        { a: 'O2', center: 'N1', b: 'O3', deg: HA('∠O=N=O'), source: SRC_HNO3 },
        { a: 'H1', center: 'O1', b: 'N1', deg: HA('∠H–O–N'), source: SRC_HNO3 },
      ],
      place: P1,
    },
    {
      id: 'HNO3b',
      formula: 'HNO₃',
      state: 'l',
      atoms: ['H2', 'O6', 'N2', 'O4', 'O5'],
      bonds: [
        { a: 'H2', b: 'O6', pairs: ['ab'], lengthPm: H('O–H'), source: SRC_HNO3 },
        { a: 'N2', b: 'O6', pairs: ['ab'], lengthPm: H('N–O(H)'), source: SRC_HNO3 },
        { a: 'N2', b: 'O4', pairs: ['ab', 'ab'], lengthPm: H('N=O(цис)'), source: SRC_HNO3 },
        { a: 'N2', b: 'O5', pairs: ['a'], lengthPm: H('N=O(транс)'), source: SRC_HNO3 },
      ],
      lonePairs: { O6: 2, O4: 2, O5: 3 },
      coords: { N2: K2.N, O6: K2.Oh, O4: K2.Ocis, O5: K2.Otrans, H2: K2.H },
      angles: [
        { a: 'O4', center: 'N2', b: 'O5', deg: HA('∠O=N=O'), source: SRC_HNO3 },
        { a: 'H2', center: 'O6', b: 'N2', deg: HA('∠H–O–N'), source: SRC_HNO3 },
      ],
      place: P2,
    },
  ],
  // После разрыва: NO₃⁻ (N1 с тремя кислородами) — влево, NO₂⁺ — вправо, OH⁻ — вверх-вправо к азоту N2,
  // H⁺ — вверх-влево к мостиковому кислороду. Сохранённые связи фрагментов не меняют длину.
  split: {
    N1: moved(N2O5_COORDS, N2O5_PLACE, 'N1', NO3_SHIFT),
    O1: moved(N2O5_COORDS, N2O5_PLACE, 'O1', NO3_SHIFT),
    O2: moved(N2O5_COORDS, N2O5_PLACE, 'O2', NO3_SHIFT),
    O3: moved(N2O5_COORDS, N2O5_PLACE, 'O3', NO3_SHIFT),
    N2: moved(N2O5_COORDS, N2O5_PLACE, 'N2', NO2_SHIFT),
    O4: moved(N2O5_COORDS, N2O5_PLACE, 'O4', NO2_SHIFT),
    O5: moved(N2O5_COORDS, N2O5_PLACE, 'O5', NO2_SHIFT),
    O6: moved(WATER_COORDS, WATER_PLACE, 'O6', OH_SHIFT),
    H2: moved(WATER_COORDS, WATER_PLACE, 'H2', OH_SHIFT),
    H1: [-40, -70, 0],
  },
  steps: stepTimings(N2O5_SCIENCE),
  captions: N2O5_SCIENCE.captions,
  text: { ru: lessonText(N2O5_SCIENCE, 'ru'), en: lessonText(N2O5_SCIENCE, 'en'), uz: lessonText(N2O5_SCIENCE, 'uz') },
}
