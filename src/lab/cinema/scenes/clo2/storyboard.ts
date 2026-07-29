import { ang, BOND_ANGLE_DEG, BOND_LENGTH_A } from '../../core/atoms'
import type { StorySegment } from '../../core/storyTime'
import type { Cue } from '../../core/cues'
import type { ScalarTrack, Vec3Track } from '../../core/tracks'
import { validateTrack } from '../../core/tracks'
import { buildClo2TeacherSegments } from '../../../teacher/labTeacherTiming'

/**
 * Раскадровка синтеза диоксида хлора: 2 NaClO₂ + Cl₂ → 2 NaCl + 2 ClO₂.
 *
 * Это ДАННЫЕ, а не код: каждый объект сцены имеет одну дорожку на всю сцену,
 * поэтому на границах фаз ничего не прыгает и не подменяется клоном.
 * Хронометраж написан в «времени сюжета»; сколько это займёт на экране,
 * решает SEGMENTS (там же живёт slow-motion на моменте разрыва связи).
 *
 * Химия сцены (важно, здесь была ошибка в прошлой версии):
 *   • хлорит-ион ClO₂⁻ ОТДАЁТ электрон: Cl +3 → +4, получается радикал ClO₂;
 *   • молекула Cl₂ электрон ПРИНИМАЕТ: Cl 0 → −1, связь Cl–Cl рвётся;
 *   • Na⁺ — ион-наблюдатель, он лишь образует ионную пару с новым Cl⁻ → NaCl.
 * Поэтому импульс электрона летит от хлорита к хлору, а не к натрию.
 */

// ——— Ключевые моменты сюжета, сек ———
export const CLO2_PHASE = {
  /** Фаза 1 — реагенты в микромире */
  entryEnd: 2.0,
  /** Фаза 2 — сближение и натяжение связи Cl–Cl */
  approachEnd: 3.5,
  /** Фаза 3 — перенос электрона, разрыв, сборка продуктов */
  transferEnd: 5.0,
  /** Фаза 4 — разлёт: газ вверх, осадок вниз */
  releaseEnd: 6.5,
  /** Финал — герой-план ClO₂ */
  finaleEnd: 8.5,
} as const

/**
 * Моменты внутри фазы 3 — на них ссылаются и дорожки, и события.
 *
 * Расстояния между этими метками — не «на глаз»: ион должен успеть пролететь
 * свой путь со скоростью, которую глаз читает как движение. Захват соли
 * (break → pairSnap) занимает больше половины секунды именно поэтому:
 * на коротком окне ион проскакивал кадр телепортом.
 */
const T = {
  cl2Center: 3.35,
  transferStart: 3.3,
  break: 3.5,
  pairSnap: 4.05,
  reconfigStart: 3.6,
  reconfigEnd: 4.6,
  gasBorn: 4.4,
} as const

export type Clo2Stage = 1 | 2 | 3 | 4 | 5

export function clo2StageAt(t: number): Clo2Stage {
  if (t < CLO2_PHASE.entryEnd) return 1
  if (t < CLO2_PHASE.approachEnd) return 2
  if (t < CLO2_PHASE.transferEnd) return 3
  if (t < CLO2_PHASE.releaseEnd) return 4
  return 5
}

/**
 * Отображение времени сюжета на экранное время.
 * Фаза 3 растянута почти вдвое — это и есть slow-motion на разрыве связи:
 * замедляется вся сцена целиком, включая шейдеры и газ, потому что все они
 * читают story time.
 */
export const CLO2_SEGMENTS: readonly StorySegment[] = [
  { to: CLO2_PHASE.entryEnd, wall: 2.2, ease: 'power2.out' },
  { to: CLO2_PHASE.approachEnd, wall: 2.0, ease: 'power1.inOut' },
  { to: CLO2_PHASE.transferEnd, wall: 2.9, ease: 'power1.inOut' },
  { to: CLO2_PHASE.releaseEnd, wall: 1.8, ease: 'power2.out' },
  { to: CLO2_PHASE.finaleEnd, wall: 2.3, ease: 'sine.inOut' },
]

/**
 * Удлинённый wall-time под озвучку преподавателя (те же story-метки).
 * Бюджет считается в labTeacherTiming: умножаем фазу разрыва, делим хвост после реакции.
 */
export const CLO2_SEGMENTS_TEACHER: readonly StorySegment[] = buildClo2TeacherSegments('ru')

export type Clo2CueId =
  | 'tension'
  | 'transfer'
  | 'break'
  | 'pairA'
  | 'pairB'
  | 'radicalA'
  | 'radicalB'
  | 'embryo'
  | 'precipitate'
  | 'birth'
  | 'complete'

export const CLO2_CUES: readonly Cue<Clo2CueId>[] = [
  /** искра-разряд на подходе: энергия накапливается */
  { at: 2.85, id: 'tension' },
  /** электрон уходит из хлорита в молекулу хлора */
  { at: T.transferStart, id: 'transfer' },
  /** связь Cl–Cl рвётся */
  { at: T.break, id: 'break' },
  /** Cl⁻ защёлкивается с Na⁺ → NaCl */
  { at: T.pairSnap, id: 'pairA' },
  { at: T.pairSnap + 0.06, id: 'pairB' },
  /** радикал ClO₂ добрал угол 117.4° — световая волна */
  { at: T.reconfigEnd - 0.05, id: 'radicalA' },
  { at: T.reconfigEnd + 0.08, id: 'radicalB' },
  /** продукт готов — лаборатория может показывать зародыш молекулы */
  { at: 4.9, id: 'embryo' },
  /** соль уходит в осадок: пылевой шлейф */
  { at: 5.6, id: 'precipitate' },
  { at: CLO2_PHASE.releaseEnd + 0.1, id: 'birth' },
  { at: CLO2_PHASE.finaleEnd, id: 'complete' },
]

/** Story-время для озвучки: на ~0.25 с раньше визуала — голос опережает кадр. */
export const CLO2_NARRATION_LEAD = 0.25

export const CLO2_NARRATION_CUES: readonly Cue<Clo2CueId>[] = CLO2_CUES.map((c) => ({
  at: Math.max(0, c.at - CLO2_NARRATION_LEAD),
  id: c.id,
}))

// ——— Геометрия: реальные длины связей и радиусы, переведённые в единицы сцены ———
export const CLO2_GEOM = {
  clOChlorite: ang(BOND_LENGTH_A.ClO_chlorite),
  clORadical: ang(BOND_LENGTH_A.ClO_radical),
  clCl: ang(BOND_LENGTH_A.ClCl),
  naCl: ang(BOND_LENGTH_A.NaCl),
  radius: {
    /** Cl в хлорите / радикале (ковалентный) */
    cl: ang(1.02) * 0.8,
    o: ang(0.66) * 0.8,
    /** Na⁺ — катион, он заметно меньше нейтрального натрия */
    na: ang(1.02) * 0.62,
    /** Cl⁻ — анион, крупнее атома Cl: электрон реально «раздувает» оболочку */
    clAnion: ang(1.81) * 0.52,
  },
  angle: {
    chlorite: BOND_ANGLE_DEG.chlorite,
    radical: BOND_ANGLE_DEG.clo2,
  },
} as const

const HALF_CL2 = CLO2_GEOM.clCl / 2
/** Натяжение перед разрывом: связь удлиняется в 1.55 раза. */
const HALF_CL2_STRETCHED = (CLO2_GEOM.clCl * 1.55) / 2
const HALF_NACL = CLO2_GEOM.naCl / 2

// ——— Опорные точки кадра ———
const REST_A = [-1.52, 0.28, 0.12] as const
const REST_B = [1.52, 0.28, -0.12] as const
const NA_A_REST = [-2.2, 0.8, 0.0] as const
const NA_B_REST = [2.2, 0.8, 0.0] as const
const CL2_ENTRY = [0, -1.55, 0.95] as const
const CL2_MID = [0, 0.1, 0.05] as const
/** Центр ионной пары NaCl после захвата электрона. */
const PAIR_A = [-1.62, -0.66, -0.32] as const
const PAIR_B = [1.62, -0.66, -0.32] as const
/** Осадок: пары уходят вниз и вглубь кадра, в туман. */
const SINK_A = [-2.05, -2.05, -3.0] as const
const SINK_B = [2.05, -2.05, -3.0] as const

export const CLO2_TRACKS = {
  /** Центр хлоритной группы A: покой → доокисление → подъём газом → герой-план. */
  unitAOrigin: [
    { t: 0, v: REST_A },
    { t: T.reconfigStart, v: REST_A },
    { t: T.reconfigEnd, v: [-1.34, 0.64, 0.22], ease: 'outCubic' },
    { t: CLO2_PHASE.transferEnd, v: [-1.2, 0.9, 0.3], ease: 'inOutSine' },
    // Подъём газа ограничен рамкой кадра: выше живёт подпись фазы, и молекула
    // не должна в неё влетать.
    { t: CLO2_PHASE.releaseEnd, v: [-1.05, 1.4, 0.42], ease: 'outQuad' },
    { t: 7.6, v: [0, 0.52, 0.46], ease: 'inOutCubic' },
    { t: CLO2_PHASE.finaleEnd, v: [0, 0.5, 0.46], ease: 'inOutSine' },
  ] satisfies Vec3Track,

  /** Центр хлоритной группы B: то же, но в финале уходит из кадра — герой один. */
  unitBOrigin: [
    { t: 0, v: REST_B },
    { t: T.reconfigStart, v: REST_B },
    { t: T.reconfigEnd, v: [1.34, 0.68, -0.22], ease: 'outCubic' },
    { t: CLO2_PHASE.transferEnd, v: [1.2, 0.95, -0.3], ease: 'inOutSine' },
    { t: CLO2_PHASE.releaseEnd, v: [1.12, 1.5, -0.4], ease: 'outQuad' },
    { t: CLO2_PHASE.finaleEnd, v: [3.1, 2.9, -2.6], ease: 'inOutSine' },
  ] satisfies Vec3Track,

  /** Разворот молекул: продукты медленно вращаются, показывая уголковую форму. */
  unitAYaw: [
    { t: 0, v: 0.2 },
    { t: CLO2_PHASE.approachEnd, v: 0.32, ease: 'inOutSine' },
    { t: CLO2_PHASE.transferEnd, v: 0.9, ease: 'outCubic' },
    { t: CLO2_PHASE.releaseEnd, v: 2.0, ease: 'linear' },
    { t: CLO2_PHASE.finaleEnd, v: 4.1, ease: 'linear' },
  ] satisfies ScalarTrack,

  unitBYaw: [
    { t: 0, v: -0.18 },
    { t: CLO2_PHASE.approachEnd, v: -0.3, ease: 'inOutSine' },
    { t: CLO2_PHASE.transferEnd, v: -0.85, ease: 'outCubic' },
    { t: CLO2_PHASE.finaleEnd, v: -3.2, ease: 'linear' },
  ] satisfies ScalarTrack,

  /** Наклон: молекула не плоская схема, у неё есть объём. */
  unitAPitch: [
    { t: 0, v: 0.12 },
    { t: CLO2_PHASE.transferEnd, v: 0.24, ease: 'inOutSine' },
    { t: CLO2_PHASE.finaleEnd, v: 0.34, ease: 'inOutSine' },
  ] satisfies ScalarTrack,

  unitBPitch: [
    { t: 0, v: -0.14 },
    { t: CLO2_PHASE.finaleEnd, v: -0.3, ease: 'inOutSine' },
  ] satisfies ScalarTrack,

  /** Валентный угол O–Cl–O: хлорит 110.5° → радикал ClO₂ 117.4°, с лёгким «щелчком». */
  bondAngle: [
    { t: 0, v: CLO2_GEOM.angle.chlorite },
    { t: T.reconfigStart, v: CLO2_GEOM.angle.chlorite },
    { t: T.reconfigEnd, v: CLO2_GEOM.angle.radical, ease: 'outBack' },
    { t: CLO2_PHASE.finaleEnd, v: CLO2_GEOM.angle.radical },
  ] satisfies ScalarTrack,

  /** Длина связи Cl–O: 1.57 Å в хлорит-ионе → 1.47 Å в радикале (порядок связи растёт). */
  clOBond: [
    { t: 0, v: CLO2_GEOM.clOChlorite },
    { t: T.reconfigStart, v: CLO2_GEOM.clOChlorite },
    { t: T.reconfigEnd, v: CLO2_GEOM.clORadical, ease: 'outCubic' },
    { t: CLO2_PHASE.finaleEnd, v: CLO2_GEOM.clORadical },
  ] satisfies ScalarTrack,

  /** Na⁺ группы A: висит у хлорита → притягивается к новому Cl⁻ → тонет осадком. */
  naA: [
    { t: 0, v: NA_A_REST },
    { t: T.break, v: [NA_A_REST[0] + 0.06, NA_A_REST[1] - 0.05, NA_A_REST[2]], ease: 'inOutSine' },
    // Кулоновский захват: ион стартует из покоя, разгоняется и тормозит у пары.
    // inOutSine держит пиковую скорость около 4 ед/с — это ещё читается глазом.
    { t: T.pairSnap, v: [PAIR_A[0] - HALF_NACL, PAIR_A[1], PAIR_A[2]], ease: 'inOutSine', arc: 0.18 },
    // Короткий «щелчок» кристаллизации: пара чуть сжимается и замирает.
    { t: T.pairSnap + 0.2, v: [PAIR_A[0] - HALF_NACL + 0.03, PAIR_A[1] - 0.02, PAIR_A[2]], ease: 'outBack' },
    { t: CLO2_PHASE.transferEnd, v: [PAIR_A[0] - HALF_NACL, PAIR_A[1] - 0.12, PAIR_A[2] - 0.06], ease: 'inOutSine' },
    { t: CLO2_PHASE.releaseEnd, v: [SINK_A[0] - HALF_NACL + 0.3, -1.55, -1.6], ease: 'inQuad' },
    { t: CLO2_PHASE.finaleEnd, v: [SINK_A[0] - HALF_NACL, SINK_A[1], SINK_A[2]], ease: 'outQuad' },
  ] satisfies Vec3Track,

  naB: [
    { t: 0, v: NA_B_REST },
    { t: T.break, v: [NA_B_REST[0] - 0.06, NA_B_REST[1] - 0.05, NA_B_REST[2]], ease: 'inOutSine' },
    { t: T.pairSnap + 0.06, v: [PAIR_B[0] + HALF_NACL, PAIR_B[1], PAIR_B[2]], ease: 'inOutSine', arc: 0.18 },
    { t: T.pairSnap + 0.26, v: [PAIR_B[0] + HALF_NACL - 0.03, PAIR_B[1] - 0.02, PAIR_B[2]], ease: 'outBack' },
    { t: CLO2_PHASE.transferEnd, v: [PAIR_B[0] + HALF_NACL, PAIR_B[1] - 0.12, PAIR_B[2] - 0.06], ease: 'inOutSine' },
    { t: CLO2_PHASE.releaseEnd, v: [SINK_B[0] + HALF_NACL - 0.3, -1.55, -1.6], ease: 'inQuad' },
    { t: CLO2_PHASE.finaleEnd, v: [SINK_B[0] + HALF_NACL, SINK_B[1], SINK_B[2]], ease: 'outQuad' },
  ] satisfies Vec3Track,

  /**
   * Левый атом молекулы Cl₂ → после приёма электрона это Cl⁻ пары NaCl.
   * Одна дорожка на весь сюжет: влёт, натяжение, разрыв, захват, осадок.
   */
  clA: [
    { t: 0, v: [CL2_ENTRY[0] - HALF_CL2, CL2_ENTRY[1], CL2_ENTRY[2]] },
    { t: CLO2_PHASE.entryEnd, v: [CL2_ENTRY[0] - HALF_CL2, CL2_ENTRY[1] + 0.1, CL2_ENTRY[2] - 0.05] },
    { t: T.cl2Center, v: [CL2_MID[0] - HALF_CL2, CL2_MID[1], CL2_MID[2]], ease: 'inOutCubic', arc: 0.32 },
    { t: T.break, v: [CL2_MID[0] - HALF_CL2_STRETCHED, CL2_MID[1] - 0.02, CL2_MID[2]], ease: 'outQuad' },
    // Новорождённый Cl⁻ уходит к своему Na⁺ по дуге: сорвался с растянутой связи
    // и притянулся к катиону. Скорость ограничена тем же бюджетом, что у Na⁺.
    { t: T.pairSnap, v: [PAIR_A[0] + HALF_NACL, PAIR_A[1], PAIR_A[2]], ease: 'inOutSine', arc: 0.24 },
    { t: T.pairSnap + 0.2, v: [PAIR_A[0] + HALF_NACL - 0.03, PAIR_A[1] - 0.02, PAIR_A[2]], ease: 'outBack' },
    { t: CLO2_PHASE.transferEnd, v: [PAIR_A[0] + HALF_NACL, PAIR_A[1] - 0.12, PAIR_A[2] - 0.06], ease: 'inOutSine' },
    { t: CLO2_PHASE.releaseEnd, v: [SINK_A[0] + HALF_NACL + 0.3, -1.55, -1.6], ease: 'inQuad' },
    { t: CLO2_PHASE.finaleEnd, v: [SINK_A[0] + HALF_NACL, SINK_A[1], SINK_A[2]], ease: 'outQuad' },
  ] satisfies Vec3Track,

  clB: [
    { t: 0, v: [CL2_ENTRY[0] + HALF_CL2, CL2_ENTRY[1], CL2_ENTRY[2]] },
    { t: CLO2_PHASE.entryEnd, v: [CL2_ENTRY[0] + HALF_CL2, CL2_ENTRY[1] + 0.1, CL2_ENTRY[2] - 0.05] },
    { t: T.cl2Center, v: [CL2_MID[0] + HALF_CL2, CL2_MID[1], CL2_MID[2]], ease: 'inOutCubic', arc: 0.32 },
    { t: T.break, v: [CL2_MID[0] + HALF_CL2_STRETCHED, CL2_MID[1] - 0.02, CL2_MID[2]], ease: 'outQuad' },
    { t: T.pairSnap + 0.06, v: [PAIR_B[0] - HALF_NACL, PAIR_B[1], PAIR_B[2]], ease: 'inOutSine', arc: 0.24 },
    { t: T.pairSnap + 0.26, v: [PAIR_B[0] - HALF_NACL + 0.03, PAIR_B[1] - 0.02, PAIR_B[2]], ease: 'outBack' },
    { t: CLO2_PHASE.transferEnd, v: [PAIR_B[0] - HALF_NACL, PAIR_B[1] - 0.12, PAIR_B[2] - 0.06], ease: 'inOutSine' },
    { t: CLO2_PHASE.releaseEnd, v: [SINK_B[0] - HALF_NACL - 0.3, -1.55, -1.6], ease: 'inQuad' },
    { t: CLO2_PHASE.finaleEnd, v: [SINK_B[0] - HALF_NACL, SINK_B[1], SINK_B[2]], ease: 'outQuad' },
  ] satisfies Vec3Track,

  /** Радиус свободного хлора: атом Cl (0) принимает электрон и растёт до Cl⁻ (−1). */
  clAnionGrowth: [
    { t: 0, v: 0 },
    { t: T.transferStart, v: 0 },
    { t: T.break + 0.15, v: 1, ease: 'outCubic' },
    { t: CLO2_PHASE.finaleEnd, v: 1 },
  ] satisfies ScalarTrack,

  /** Натяжение связи Cl–Cl: к разрыву уходит в белый и «трещит». */
  cl2Stress: [
    { t: 0, v: 0.12 },
    { t: CLO2_PHASE.entryEnd, v: 0.3, ease: 'inOutSine' },
    { t: T.transferStart, v: 0.82, ease: 'inQuad' },
    { t: T.break - 0.02, v: 1, ease: 'inQuad' },
    { t: T.break, v: 1 },
  ] satisfies ScalarTrack,

  /** Видимость связи Cl–Cl: существует до момента разрыва. */
  cl2Opacity: [
    { t: 0, v: 1 },
    { t: T.break - 0.01, v: 1 },
    { t: T.break + 0.1, v: 0, ease: 'inQuad' },
    { t: CLO2_PHASE.finaleEnd, v: 0 },
  ] satisfies ScalarTrack,

  /** Истончение связи Cl–Cl перед разрывом. */
  cl2Thinning: [
    { t: 0, v: 0 },
    { t: CLO2_PHASE.entryEnd, v: 0.12, ease: 'inOutSine' },
    { t: T.break, v: 0.82, ease: 'inQuad' },
  ] satisfies ScalarTrack,

  /** Ионные связи Na⁺–Cl⁻: появляются в момент кристаллизации соли. */
  naClOpacity: [
    { t: 0, v: 0 },
    { t: T.pairSnap - 0.02, v: 0 },
    { t: T.pairSnap + 0.16, v: 1, ease: 'outCubic' },
    { t: CLO2_PHASE.finaleEnd, v: 0.85 },
  ] satisfies ScalarTrack,

  /** Волна образования по ионной связи (расходится из центра к ионам). */
  naClForm: [
    { t: 0, v: 0 },
    { t: T.pairSnap, v: 0 },
    { t: T.pairSnap + 0.4, v: 1, ease: 'outQuad' },
  ] satisfies ScalarTrack,

  /** Напряжение связей Cl–O при перестройке хлорита в радикал. */
  clOStress: [
    { t: 0, v: 0.06 },
    { t: T.reconfigStart, v: 0.1 },
    { t: T.reconfigStart + 0.35, v: 0.42, ease: 'outQuad' },
    { t: T.reconfigEnd + 0.2, v: 0.08, ease: 'inOutSine' },
    { t: CLO2_PHASE.finaleEnd, v: 0.12 },
  ] satisfies ScalarTrack,

  /** Зелёное облако газа Cl₂: приходит с реагентом и расходуется в реакции. */
  gasCl2Opacity: [
    { t: 0, v: 0 },
    { t: 0.5, v: 0.5, ease: 'outCubic' },
    { t: T.cl2Center, v: 0.62, ease: 'inOutSine' },
    { t: T.break, v: 0.5, ease: 'inOutSine' },
    { t: 4.3, v: 0, ease: 'inQuad' },
    { t: CLO2_PHASE.finaleEnd, v: 0 },
  ] satisfies ScalarTrack,

  gasCl2Spread: [
    { t: 0, v: 0.95 },
    { t: T.cl2Center, v: 1.2, ease: 'inOutSine' },
    { t: 4.3, v: 1.9, ease: 'outQuad' },
  ] satisfies ScalarTrack,

  /** Янтарно-красный газ ClO₂: рождается вместе с радикалом и поднимается. */
  gasClo2Opacity: [
    { t: 0, v: 0 },
    { t: T.gasBorn, v: 0 },
    { t: CLO2_PHASE.transferEnd + 0.4, v: 0.5, ease: 'outCubic' },
    { t: CLO2_PHASE.releaseEnd, v: 0.62, ease: 'inOutSine' },
    { t: CLO2_PHASE.finaleEnd, v: 0.55 },
  ] satisfies ScalarTrack,

  gasClo2Spread: [
    { t: 0, v: 0.6 },
    { t: CLO2_PHASE.transferEnd, v: 0.9, ease: 'outCubic' },
    { t: CLO2_PHASE.finaleEnd, v: 1.45, ease: 'inOutSine' },
  ] satisfies ScalarTrack,

  gasClo2Rise: [
    { t: 0, v: 0 },
    { t: CLO2_PHASE.transferEnd, v: 0.12 },
    { t: CLO2_PHASE.finaleEnd, v: 0.55, ease: 'inOutSine' },
  ] satisfies ScalarTrack,

  /** Туман у «дна» сцены — в него оседает соль. Он же даёт ощущение глубины кадра. */
  fogOpacity: [
    { t: 0, v: 0.16 },
    { t: CLO2_PHASE.entryEnd, v: 0.24, ease: 'inOutSine' },
    { t: 5.6, v: 0.42, ease: 'outCubic' },
    { t: CLO2_PHASE.finaleEnd, v: 0.44 },
  ] satisfies ScalarTrack,

  /** Тёплый ореол готового ClO₂ (по ТЗ — янтарно-красный). */
  amber: [
    { t: 0, v: 0 },
    { t: T.reconfigStart, v: 0 },
    { t: T.reconfigEnd, v: 0.75, ease: 'outCubic' },
    { t: CLO2_PHASE.releaseEnd, v: 1 },
    { t: CLO2_PHASE.finaleEnd, v: 0.92 },
  ] satisfies ScalarTrack,

  /** Свечение зоны реакции. */
  zone: [
    { t: 0, v: 0.32 },
    { t: CLO2_PHASE.entryEnd, v: 0.45, ease: 'inOutSine' },
    { t: T.break, v: 1, ease: 'inQuad' },
    { t: CLO2_PHASE.transferEnd, v: 0.62, ease: 'outCubic' },
    { t: CLO2_PHASE.releaseEnd, v: 0.34, ease: 'inOutSine' },
    { t: CLO2_PHASE.finaleEnd, v: 0.4 },
  ] satisfies ScalarTrack,

  /** Экзотермический свет: пик ровно на переносе электрона и разрыве связи. */
  exoLight: [
    { t: 0, v: 0.12 },
    { t: T.transferStart, v: 0.5, ease: 'inQuad' },
    { t: T.break + 0.12, v: 1, ease: 'outQuad' },
    { t: T.reconfigEnd, v: 0.55, ease: 'inOutSine' },
    { t: CLO2_PHASE.finaleEnd, v: 0.3, ease: 'inOutSine' },
  ] satisfies ScalarTrack,

  /** Броуновское микро-колебание: заметно в покое, гаснет при контакте. */
  jitter: [
    { t: 0, v: 1 },
    { t: CLO2_PHASE.entryEnd, v: 0.85 },
    { t: T.transferStart, v: 0.25, ease: 'outQuad' },
    { t: T.break, v: 0 },
  ] satisfies ScalarTrack,

  /** Счётчики коэффициентов реагентов: 2 NaClO₂ и 1 Cl₂. */
  reactantCounters: [
    { t: 0, v: 0 },
    { t: 0.45, v: 1, ease: 'outCubic' },
    { t: 3.2, v: 1 },
    { t: 3.6, v: 0, ease: 'inQuad' },
  ] satisfies ScalarTrack,

  /** Счётчики продуктов: 2 ClO₂ и 2 NaCl. */
  productCounters: [
    { t: 0, v: 0 },
    { t: CLO2_PHASE.transferEnd, v: 0 },
    { t: CLO2_PHASE.transferEnd + 0.45, v: 1, ease: 'outCubic' },
    { t: 7.9, v: 1 },
    { t: 8.3, v: 0, ease: 'inQuad' },
  ] satisfies ScalarTrack,

  /** Метки степеней окисления — только на моменте ОВР, чтобы не засорять кадр. */
  oxidationTags: [
    { t: 0, v: 0 },
    { t: T.transferStart, v: 0 },
    { t: T.break + 0.2, v: 1, ease: 'outCubic' },
    { t: 4.8, v: 1 },
    { t: CLO2_PHASE.transferEnd + 0.2, v: 0, ease: 'inQuad' },
  ] satisfies ScalarTrack,

  // ——— Виртуальная камера: наезд на разрыв, отъезд на разлёт, герой-план ———
  camZoom: [
    { t: 0, v: 0.96 },
    { t: CLO2_PHASE.entryEnd, v: 1.04, ease: 'outCubic' },
    { t: T.break, v: 1.24, ease: 'inOutCubic' },
    { t: CLO2_PHASE.transferEnd, v: 1.14, ease: 'inOutSine' },
    { t: CLO2_PHASE.releaseEnd, v: 0.94, ease: 'inOutCubic' },
    { t: CLO2_PHASE.finaleEnd, v: 1.12, ease: 'inOutCubic' },
  ] satisfies ScalarTrack,

  camOffset: [
    { t: 0, v: [0, 0, 0] },
    { t: CLO2_PHASE.entryEnd, v: [0, -0.04, 0], ease: 'inOutSine' },
    { t: T.break, v: [0, -0.02, 0], ease: 'inOutSine' },
    { t: CLO2_PHASE.releaseEnd, v: [0, -0.5, 0], ease: 'inOutCubic' },
    { t: CLO2_PHASE.finaleEnd, v: [0, -0.28, 0], ease: 'inOutCubic' },
  ] satisfies Vec3Track,

  camRoll: [
    { t: 0, v: 0.018 },
    { t: T.break, v: -0.014, ease: 'inOutSine' },
    { t: CLO2_PHASE.releaseEnd, v: 0.01, ease: 'inOutSine' },
    { t: CLO2_PHASE.finaleEnd, v: 0, ease: 'inOutSine' },
  ] satisfies ScalarTrack,

  camYaw: [
    { t: 0, v: 0.06 },
    { t: CLO2_PHASE.approachEnd, v: -0.03, ease: 'inOutSine' },
    { t: CLO2_PHASE.releaseEnd, v: 0.05, ease: 'inOutSine' },
    { t: CLO2_PHASE.finaleEnd, v: -0.04, ease: 'inOutSine' },
  ] satisfies ScalarTrack,

  camShake: [
    { t: 0, v: 0 },
    { t: T.break - 0.05, v: 0 },
    { t: T.break + 0.04, v: 1, ease: 'outQuad' },
    { t: T.break + 0.5, v: 0, ease: 'outQuad' },
  ] satisfies ScalarTrack,

  postBloom: [
    { t: 0, v: 0.28 },
    { t: CLO2_PHASE.entryEnd, v: 0.42, ease: 'inOutSine' },
    { t: T.break, v: 1, ease: 'inQuad' },
    { t: 4.4, v: 0.6, ease: 'outCubic' },
    { t: CLO2_PHASE.releaseEnd, v: 0.48, ease: 'inOutSine' },
    { t: CLO2_PHASE.finaleEnd, v: 0.56 },
  ] satisfies ScalarTrack,

  postVignette: [
    { t: 0, v: 0.3 },
    { t: T.break, v: 0.48, ease: 'inOutSine' },
    { t: CLO2_PHASE.finaleEnd, v: 0.34, ease: 'inOutSine' },
  ] satisfies ScalarTrack,
} as const

/** Подписи фаз — то, что ученик читает на экране. */
export const CLO2_CAPTIONS: Record<Clo2Stage, { text: string; sub: string }> = {
  1: {
    text: 'Фаза 1 · Реагенты · 2 NaClO₂ (тв.) + Cl₂ (газ)',
    sub: 'Хлорит натрия и зелёное облако хлора в неоновом микромире',
  },
  2: {
    text: 'Фаза 2 · Сближение · Cl₂ входит в зону реакции',
    sub: 'Связь Cl–Cl натягивается, истончается и светится белым',
  },
  3: {
    text: 'Фаза 3 · Перенос электрона · ClO₂⁻ → Cl₂',
    sub: 'Cl: +3 → +4 (окисление) · Cl: 0 → −1 (восстановление) · Na⁺ — наблюдатель',
  },
  4: {
    text: 'Фаза 4 · Разлёт · 2 ClO₂ (газ) · 2 NaCl (осадок)',
    sub: 'Янтарно-красный газ поднимается, соль оседает на дно',
  },
  5: {
    text: 'ClO₂ · угол O–Cl–O ≈ 117.4° · сильный окислитель',
    sub: '2 NaClO₂ + Cl₂ → 2 NaCl + 2 ClO₂',
  },
}

/** Момент переноса электрона — сцена анимирует импульс между этими метками. */
export const CLO2_TRANSFER_WINDOW: readonly [number, number] = [T.transferStart, T.break]

/** Проверка раскадровки: ключи дорожек должны идти строго по возрастанию. */
export function validateClo2Storyboard(): void {
  for (const [name, track] of Object.entries(CLO2_TRACKS)) {
    validateTrack(name, track as ReadonlyArray<{ t: number }>)
  }
}
