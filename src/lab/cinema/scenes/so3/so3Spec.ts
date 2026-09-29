import { bondAngleDeg, bondLengthPm } from '../../../../chemistry/data/bondData'
import { SO3_SPEC as SO3_SCIENCE } from '../school/specs/so3'
import { particleOf, sceneBond, sceneCounts, sceneTexts, sceneTiming } from '../school/specs/sceneBridge'
import type { SchoolMoleculeSpec, SchoolSceneSpec, SchoolVec3 } from '../school/schoolSpec'

/**
 * Школьная сцена: 2SO₂ + O₂ ⇄ 2SO₃ (t, V₂O₅; Kimyo 7, с. 96; Kimyo 8, с. 136). Химия, тексты и шаги —
 * из научной спецификации school/specs/so3.ts; здесь только постановка кадра (пм).
 *
 *   • реагенты: две молекулы SO₂ (O=S=O, у S неподелённая пара, 119,5°) и O₂ (O=O);
 *   • разрыв: рвётся ТОЛЬКО O=O; связи S=O молекул SO₂ сохраняются (фрагменты стоят на месте);
 *     неподелённая пара S распаривается — два неспаренных электрона (splitElectrons спецификации);
 *   • SO₃: третья двойная связь S=O — пары из двух электронов S и двух неспаренных O;
 *     плоский треугольник 120° (ядро 'sulfurTrioxide'), S=O 141,98 пм (ядро 'S=O(SO3)'),
 *     у S неподелённых пар нет, молекула неполярная.
 *
 * Раскладка: SO₂ слева и справа (S — вершиной вверх, неподелённая пара смотрит вверх), O₂ сверху
 * по центру; атом O садится на место неподелённой пары S.
 */

const P_SO2 = particleOf(SO3_SCIENCE, 'SO2')
const P_O2 = particleOf(SO3_SCIENCE, 'O2')
const P_SO3 = particleOf(SO3_SCIENCE, 'SO3')

const SO2_A = { S: 'S1', O1: 'O1', O2: 'O2' }
const SO2_B = { S: 'S2', O1: 'O3', O2: 'O4' }
const O2_IDS = { Oa: 'O5', Ob: 'O6' }
const SO3_A = { S: 'S1', O1: 'O1', O2: 'O2', O3: 'O5' }
const SO3_B = { S: 'S2', O1: 'O3', O2: 'O4', O3: 'O6' }

const SO = bondLengthPm('S=O')
const OSO = bondAngleDeg('sulfurDioxide')
const SO3L = bondLengthPm('S=O(SO3)')
const TRI = bondAngleDeg('sulfurTrioxide')
const OO = bondLengthPm('O=O')

/** Точка на расстоянии r под углом deg (от оси x против часовой). */
const polar = (r: number, deg: number): SchoolVec3 => [r * Math.cos((deg * Math.PI) / 180), r * Math.sin((deg * Math.PI) / 180), 0]

/** SO₂: S в начале координат, атомы O вниз — симметрично оси y; неподелённая пара S — вверх. */
function so2Coords(ids: Record<string, string>): Record<string, SchoolVec3> {
  return { [ids.S!]: [0, 0, 0], [ids.O1!]: polar(SO, -90 - OSO / 2), [ids.O2!]: polar(SO, -90 + OSO / 2) }
}
/** SO₃: S в центре, «старые» O там же, где в SO₂ (углы 120°), новый O — вверх, на место пары S. */
function so3Coords(ids: Record<string, string>): Record<string, SchoolVec3> {
  return { [ids.S!]: [0, 0, 0], [ids.O1!]: polar(SO3L, -90 - TRI / 2), [ids.O2!]: polar(SO3L, -90 + TRI / 2), [ids.O3!]: polar(SO3L, 90) }
}

function so2(id: string, ids: Record<string, string>, place: SchoolVec3): SchoolMoleculeSpec {
  return {
    id,
    formula: 'SO₂',
    state: 'g',
    atoms: [ids.S!, ids.O1!, ids.O2!],
    bonds: [sceneBond(P_SO2, 'S', 'O1', ids), sceneBond(P_SO2, 'S', 'O2', ids)],
    lonePairs: sceneCounts(P_SO2.lonePairs, ids),
    coords: so2Coords(ids),
    angles: [{ a: ids.O1!, center: ids.S!, b: ids.O2!, angleKey: 'sulfurDioxide' }],
    place,
  }
}

function so3(id: string, ids: Record<string, string>, place: SchoolVec3, allAngles: boolean): SchoolMoleculeSpec {
  const S = ids.S!
  const [o1, o2, o3] = [ids.O1!, ids.O2!, ids.O3!]
  return {
    id,
    formula: 'SO₃',
    state: 'g',
    atoms: [S, o1, o2, o3],
    bonds: [sceneBond(P_SO3, 'S', 'O1', ids), sceneBond(P_SO3, 'S', 'O2', ids), sceneBond(P_SO3, 'S', 'O3', ids)],
    lonePairs: sceneCounts(P_SO3.lonePairs, ids),
    coords: so3Coords(ids),
    // Подписывается один угол (движок подписывает углы первой молекулы продукта), тест проверяет все три
    // у второй молекулы — они одинаковы.
    angles: allAngles
      ? [
          { a: o1, center: S, b: o2, angleKey: 'sulfurTrioxide' },
          { a: o2, center: S, b: o3, angleKey: 'sulfurTrioxide' },
          { a: o3, center: S, b: o1, angleKey: 'sulfurTrioxide' },
        ]
      : [{ a: o3, center: S, b: o1, angleKey: 'sulfurTrioxide' }],
    place,
  }
}

const { steps, textbook } = sceneTiming(SO3_SCIENCE)
const split = SO3_SCIENCE.mechanism.splitElectrons?.find((s) => s.particle === 'SO2' && s.atom === 'S')

const RA: SchoolVec3 = [-215, -40, 0]
const RB: SchoolVec3 = [215, -40, 0]
const at = (place: SchoolVec3, p: SchoolVec3): SchoolVec3 => [place[0] + p[0], place[1] + p[1], place[2] + p[2]]
const RA_C = so2Coords(SO2_A)
const RB_C = so2Coords(SO2_B)

export const SO3_SCHOOL_SPEC: SchoolSceneSpec = {
  id: 'so3',
  product: 'SO₃',
  equation: SO3_SCIENCE.reaction.equation,
  textbook,
  atoms: [
    { id: 'S1', element: 'S' },
    { id: 'O1', element: 'O' },
    { id: 'O2', element: 'O' },
    { id: 'S2', element: 'S' },
    { id: 'O3', element: 'O' },
    { id: 'O4', element: 'O' },
    { id: 'O5', element: 'O' },
    { id: 'O6', element: 'O' },
  ],
  reactants: [
    so2('SO2a', SO2_A, RA),
    {
      id: 'O2',
      formula: 'O₂',
      state: 'g',
      atoms: ['O5', 'O6'],
      bonds: [sceneBond(P_O2, 'Oa', 'Ob', O2_IDS)],
      lonePairs: sceneCounts(P_O2.lonePairs, O2_IDS),
      coords: { O5: [-OO / 2, 0, 0], O6: [OO / 2, 0, 0] },
      place: [0, 105, 0],
    },
    so2('SO2b', SO2_B, RB),
  ],
  // Молекулы SO₃ разнесены: при ±170 пм внутренние O двух молекул перекрывались шарами (шаги pairs, result).
  products: [so3('SO3a', SO3_A, [-235, -25, 0], false), so3('SO3b', SO3_B, [235, -25, 0], true)],
  // Фрагменты SO₂ стоят на месте (их связи S=O не рвутся), атомы O из O₂ расходятся к атомам S.
  split: {
    S1: at(RA, RA_C.S1!),
    O1: at(RA, RA_C.O1!),
    O2: at(RA, RA_C.O2!),
    S2: at(RB, RB_C.S2!),
    O3: at(RB, RB_C.O3!),
    O4: at(RB, RB_C.O4!),
    O5: [-125, 165, 0],
    O6: [125, 165, 0],
  },
  ...(split ? { splitElectrons: { S1: { lone: split.lone, unpaired: split.unpaired }, S2: { lone: split.lone, unpaired: split.unpaired } } } : {}),
  // Плоская SO₃: умеренный поворот — треугольник читается, нижний O не уходит за шар S.
  productTurn: 0.6,
  steps,
  captions: SO3_SCIENCE.captions,
  text: sceneTexts(SO3_SCIENCE),
}
