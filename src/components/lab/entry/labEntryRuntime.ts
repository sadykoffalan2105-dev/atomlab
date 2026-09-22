/**
 * Общее изменяемое состояние экрана входа.
 *
 * Слои сцены (реакция, пояс, захват, подписи) читают и пишут один объект, а не
 * гоняют пропсы через React: кадр не должен вызывать ни одного ререндера.
 * Объект создаётся один раз на монтирование (useMemo) и живёт до размонтирования.
 */
import type { SpringState } from '../../../lab/cinema/core/spring'
import { ENTRY_LOOP_SEC, entryLoopYaw, type EntryPhase } from './labEntryScenario'
import { ENTRY_DEFAULT_SCENARIO, entryScenarioAt, type EntryScenarioSpec } from './labEntryScenarioSet'

export type EntryRuntime = {
  /** время сюжета, 0..ENTRY_LOOP_SEC */
  t: number
  phase: EntryPhase
  local01: number
  /** вкладка скрыта или сцена за пределами экрана — кадр не считается вовсе */
  paused: boolean
  /** молекулу держат в руке: время стоит, но пул пишется (нужны смещения) */
  hold: boolean
  /** prefers-reduced-motion: сцена замерла на готовой воде */
  reduced: boolean
  /** 0..1 — «магнит» указателя, ускоряет сведение атомов */
  boost: number
  /** множитель темпа: на слабых устройствах цикл растянут */
  speed: number
  /** номер цикла с монтирования */
  loop: number
  /** вещество текущей петли: вода → аммиак → углекислый газ → соль */
  spec: EntryScenarioSpec
  /** номер петли, под который уже записаны постоянные поля пулов (цвета, радиусы) */
  writtenLoop: number
  /** разворот текущего цикла, радианы */
  yaw: number
  /** раскрытие H–O–H, градусы (пружина 180° → угол воды из ядра) */
  angle: SpringState
  /** сила вспышки 0..1 — её читает атмосфера и ореол */
  flash: number
  /** общий масштаб героя: подбирается под вещество петли и размер кадра */
  heroScale: number
  /** масштаб «как задумано», от которого подгонка только уменьшает */
  baseScale: number
  /** полуширина и полувысота видимого мира — из viewport R3F */
  halfW: number
  halfH: number
  /** 1 — полный разлёт; меньше — узкий кадр, реагенты подлетают ближе */
  spread: number
  /** подъём героя: на портрете нижняя треть отдаётся подписям и зоне броска */
  liftY: number
  /** смещения молекул при захвате, xyz × 2 */
  offsets: Float32Array
  offVel: Float32Array
  /** индекс схваченной молекулы или −1 */
  grabbed: number
  /** индекс улетающей в реактор молекулы или −1 */
  flying: number
  flyT: number
  /** 0..1 — проявление сцены на первых кадрах (под ним проходит компиляция шейдеров) */
  intro: number
}

export function createEntryRuntime(): EntryRuntime {
  return {
    t: 0,
    phase: 'disperse',
    local01: 0,
    paused: false,
    hold: false,
    reduced: false,
    boost: 0,
    speed: 1,
    loop: 0,
    spec: ENTRY_DEFAULT_SCENARIO,
    writtenLoop: -1,
    yaw: entryLoopYaw(0),
    angle: { x: ENTRY_DEFAULT_SCENARIO.angleStartDeg, v: 0 },
    flash: 0,
    heroScale: 3.2,
    baseScale: 3.2,
    halfW: 5.2,
    halfH: 3,
    spread: 1,
    liftY: 0,
    offsets: new Float32Array(6),
    offVel: new Float32Array(6),
    grabbed: -1,
    flying: -1,
    flyT: 0,
    intro: 0,
  }
}

/** Прокрутка петли со сменой разворота: повтор не читается как зацикленная гифка. */
export function advanceEntryLoop(rt: EntryRuntime, stepSec: number): void {
  rt.t += stepSec
  while (rt.t >= ENTRY_LOOP_SEC) {
    rt.t -= ENTRY_LOOP_SEC
    rt.loop += 1
    // Новая петля — новое вещество: к этому моменту атомы прошлой растворились
    // полностью (фаза fade), поэтому подмена пулов не видна ни одним кадром.
    rt.spec = entryScenarioAt(rt.loop)
    rt.yaw = entryLoopYaw(rt.loop)
    rt.angle.x = rt.spec.angleStartDeg
    rt.angle.v = 0
    rt.offsets.fill(0)
    rt.offVel.fill(0)
  }
}
