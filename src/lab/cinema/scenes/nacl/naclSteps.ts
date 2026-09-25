import { defineSceneTiming, type SceneFinish, type SceneStep } from '../kit/sceneKit'

/**
 * 2 Na (тв.) + Cl₂ (г.) → 2 NaCl (тв.) — ионная связь, Kimyo 7–8 класс.
 *
 * Шесть шагов урока (числа — только в ядре src/chemistry/data, здесь их нет):
 *   1 «Исходные вещества»       — ячейка металлического натрия (ОЦК, матовый металл) и молекула Cl₂
 *                                 с одинарной связью (цилиндр + общая пара);
 *   2 «Строение атомов»          — два атома Na выходят из металла, связь Cl–Cl рвётся; вокруг атомов
 *                                 проявляются электронные облака внешнего уровня (Na: 1 e⁻, Cl: 7 e⁻);
 *   3 «Переход электрона»        — облако Na тянется к хлору, электрон летит по кривой Безье к «окну»
 *                                 в облаке Cl; в кадр
 *                                 ПОГЛОЩЕНИЯ одновременно и одинаково долго меняются Na → Na⁺ и Cl → Cl⁻;
 *   4 «Ионная связь»             — две пары Na⁺Cl⁻ притягиваются (бегущие точки — схема притяжения);
 *   5 «Ионная решётка»           — 2×2×2 ячейки каменной соли (5 ионов по ребру), шесть соседей иона;
 *   6 «Итог: хлорид натрия»      — облёт решётки, 2Na + Cl₂ → 2NaCl (школьная версия: без энергетики).
 *
 * ВРЕМЯ СЮЖЕТА = ЭКРАННОЕ ВРЕМЯ (to − from = wall, ease 'none'): длительность «0,5 с» в раскадровке —
 * это ровно полсекунды на экране (требование к смене размеров при поглощении электрона).
 *
 * Здесь только РАЗМЕТКА ВРЕМЕНИ: без THREE и React — файл читают тесты, watchdog лаборатории
 * и панель урока.
 */

export const NACL_STEP_IDS = ['reactants', 'sublimation', 'transfer', 'attraction', 'lattice', 'energy'] as const

export type NaclStepId = (typeof NACL_STEP_IDS)[number]

export type NaclStep = SceneStep<NaclStepId>

/** Каждый шаг 4–7 с, шесть шагов — 31 с, с хвостом передачи героя — 32,5 с (26–34 с). */
const STEPS: readonly NaclStep[] = [
  { id: 'reactants', from: 0, to: 4.5, wall: 4.5, ease: 'none' },
  { id: 'sublimation', from: 4.5, to: 9.5, wall: 5, ease: 'none' },
  // Перенос электрона — самый длинный шаг: по замечанию владельца он выглядел «передал и всё».
  // Теперь у каждого электрона есть разгон, полёт 2 с и пауза перед вторым переносом.
  { id: 'transfer', from: 9.5, to: 16.5, wall: 7, ease: 'none' },
  { id: 'attraction', from: 16.5, to: 21, wall: 4.5, ease: 'none' },
  { id: 'lattice', from: 21, to: 27, wall: 6, ease: 'none' },
  { id: 'energy', from: 27, to: 32, wall: 5, ease: 'none' },
]

/**
 * Хвост после последнего шага: подписи и октаэдры гаснут, решётка сцены встаёт ровно на место
 * героя продукта (та же решётка, тот же масштаб и поворот) — в любой кадр видна ОДНА решётка.
 */
export const NACL_FINISH: SceneFinish = { from: 32, to: 33.5, wall: 1.5, ease: 'none' }

export type NaclCueId =
  /** первый атом натрия оторвался от металлической решётки (сублимация) */
  | 'sublimate'
  /** связь Cl–Cl разорвана гомолитически */
  | 'bondBreak'
  /** второй электрон поглощён хлором: обе пары Na⁺ / Cl⁻ готовы */
  | 'transfer'
  /** газовые пары сошлись на r_e(NaCl, г.) */
  | 'contact'
  /** решётка 2×2×2 собрана, рёбра ячеек и октаэдры окружения видны */
  | 'lattice'
  /** итог энергии: ΔH°f на экране (без огня — огонь только в тексте урока) */
  | 'exo'
  /** контракт лаборатории: продукт существует, пора готовить героя */
  | 'embryo'
  | 'birth'
  | 'complete'

/**
 * Переходы электронов (время сюжета): leave — старт с внешнего уровня Na, arrive — поглощение
 * валентной оболочкой Cl. В кадр arrive ОДНОВРЕМЕННО начинается смена размеров, цвета и подписей
 * заряда у обоих партнёров (NACL_MORPH_S). Второй приход совпадает с cue 'transfer'.
 */
export const NACL_ELECTRONS = {
  e1: { leave: 10.4, arrive: 12.4 },
  e2: { leave: 13.6, arrive: 15.6 },
} as const

/** Длительность смены Na → Na⁺ и Cl → Cl⁻ после поглощения, с (0,4–0,6 с экранного времени). */
export const NACL_MORPH_S = 0.5

export const NACL_TIMING = defineSceneTiming<NaclStepId, NaclCueId>({
  steps: STEPS,
  finish: NACL_FINISH,
  cues: [
    { at: 5.2, id: 'sublimate' },
    { at: 7.2, id: 'bondBreak' },
    { at: NACL_ELECTRONS.e2.arrive, id: 'transfer' },
    { at: 19.2, id: 'contact' },
    { at: 25.6, id: 'lattice' },
    { at: 27.6, id: 'exo' },
    // Контракт лаборатории — строго в хвосте, после последнего шага. embryo и birth — в одном кадре
    // (порядок сохранён): лаборатория перерисовывается ОДИН раз, герой монтируется сразу невидимым
    // (его шейдеры и буферы уже прогреты сценой) и ждёт отпускания; complete — в кадр, когда
    // решётка сцены совпала с героем.
    { at: 32.3, id: 'embryo' },
    { at: 32.3, id: 'birth' },
    { at: NACL_FINISH.to, id: 'complete' },
  ],
})

export const NACL_STEPS = NACL_TIMING.steps
export const NACL_SEGMENTS = NACL_TIMING.segments
export const NACL_CUES = NACL_TIMING.cues
export const NACL_END = NACL_TIMING.end

export const naclStepIndexAt = NACL_TIMING.stepIndexAt
export const naclStepById = NACL_TIMING.stepById
export const naclCueAt = NACL_TIMING.cueAt
