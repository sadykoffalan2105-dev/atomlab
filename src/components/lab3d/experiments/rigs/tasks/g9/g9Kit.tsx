/**
 * Общие детали установок задач-опытов Kimyo 9: переносы предметов по естественной траектории (поднять →
 * перенести → опустить), наклон сосуда при переливании вокруг его носика, весы на столе, «станция фильтрования»
 * (сухой фильтр на весы → конус в воронку → фильтрование и промывание → сушка → фильтр с осадком на весы).
 * Начало координат — центр рабочего места, верх стола y = 0, ученик смотрит в −Z.
 */
import * as THREE from 'three'
import { Pose, Target, ease, hill, mix, mixV, useRig, useSoundAt, type PFn, type PoseValue, type V3 } from '../../../rigCore'
import { PourStream } from '../../../parts/effects'
import { BOTTLE_H, ReagentBottle, WatchGlass } from '../../../parts/glassware'
import { FILTER_CONE, FUNNEL, Falling, FilterPaper, Funnel, RingStand } from '../../../parts/practicalware'
import { BEAKERS, MeasuringBeaker } from '../../../../measure/devices/Glass'
import { DryingOven, OVEN, OVEN_SHELF } from '../../../../measure/devices/Bench'
import { Readout, SCALES_PAN_CENTER } from '../../../../measure/devices/Scales'
import { fmtNum } from '../../../../measure/instruments'

/** Перенос: [начало, конец, куда, высота подъёма]. Без высоты — прямо (сдвинуть по столу / опустить). */
export type Move = readonly [a: number, b: number, to: V3, liftY?: number]

/** Положение предмета по шагам: из rest по очереди переносами (каждый — поднять → перенести → опустить). */
export function track(rest: V3, moves: readonly Move[]): (p: number) => [number, number, number] {
  return (p) => {
    let at: V3 = rest
    let q: [number, number, number] = [rest[0], rest[1], rest[2]]
    for (const [a, b, to, hy] of moves) {
      if (p <= a) break
      if (hy == null) q = mixV(at, to, ease(p, a, b))
      else {
        const d = b - a
        const up: V3 = [at[0], Math.max(at[1], hy), at[2]]
        const over: V3 = [to[0], Math.max(to[1], hy), to[2]]
        q = mixV(at, up, ease(p, a, a + d * 0.28))
        q = mixV(q, over, ease(p, a + d * 0.22, b - d * 0.24))
        q = mixV(q, to, ease(p, b - d * 0.3, b))
      }
      if (p < b) break
      at = to
    }
    return q
  }
}

/** Точка на чаше весов, стоящих в sc (основание весов). */
export const panAt = (sc: V3, dx = 0, dz = 0): V3 => [sc[0] + SCALES_PAN_CENTER[0] + dx, sc[1] + SCALES_PAN_CENTER[1], sc[2] + SCALES_PAN_CENTER[2] + dz]

/**
 * Переливание из сосуда (начало сосуда — центр дна, высота h, радиус носика r): шаг s — поднять, поднести носик
 * к точке lip над приёмником (палец ведёт до s + 0.42), наклон tilt (рад), струя s + pourA…pourB, обратно на место.
 * side = 1: сосуд справа от приёмника (наклон влево), −1 — слева.
 */
export function pourPose(rest: V3, h: number, r: number, side: 1 | -1, uses: readonly (readonly [s: number, lip: V3, tilt: number, after?: V3])[]) {
  return (p: number): PoseValue => {
    let pos: V3 = rest
    let rot = 0
    let home: V3 = rest
    for (const [s, lip, tilt, after] of uses) {
      if (p <= s) break
      const k = ease(p, s + 0.38, s + 0.5) * (1 - ease(p, s + 0.74, s + 0.84))
      const a = tilt * side * k
      // носик (−side·r, h) после поворота на a — в точке lip; основание сдвигается так, чтобы носик стоял на месте
      const nx = -side * r * Math.cos(a) - h * Math.sin(a)
      const ny = -side * r * Math.sin(a) + h * Math.cos(a)
      const base: V3 = [lip[0] - nx, lip[1] - ny, lip[2]]
      const back = after ?? home
      const lifted: V3 = [home[0], Math.max(home[1], lip[1] - h + 0.06), home[2]]
      const near: V3 = [lip[0] + side * r, lip[1] - h + 0.012, lip[2]]
      const liftedBack: V3 = [back[0], Math.max(back[1], lip[1] - h + 0.06), back[2]]
      let q = mixV(home, lifted, ease(p, s, s + 0.18))
      q = mixV(q, near, ease(p, s + 0.16, s + 0.36))
      q = mixV(q, base, ease(p, s + 0.34, s + 0.5) * (1 - ease(p, s + 0.76, s + 0.86)))
      q = mixV(q, liftedBack, ease(p, s + 0.84, s + 0.92))
      q = mixV(q, back, ease(p, s + 0.91, s + 0.99))
      pos = q
      rot = k > 0 ? a : 0
      home = back
    }
    return { pos, rot: [0, 0, rot] }
  }
}

/** Плашка над весами видна в окне [s + 0.72, s + 1.6] каждого шага-измерения. */
export const readoutAfter = (...steps: number[]): PFn => (p) => (steps.some((s) => p >= s + 0.72 && p <= s + 1.6) ? 1 : 0)

/** Склянка с раствором: стоит на столе в rest (горлышко — начало), наливает по шагам (bottlePose из worksKit). */
export function SolutionBottle({ pose, formula, name, level, target }: { pose: (p: number) => PoseValue; formula: string; name: string; level: PFn; target: string }) {
  return (
    <Pose pose={pose}>
      <ReagentBottle formula={formula} name={name} level={level} />
      <group position={[0, -BOTTLE_H, 0]}>
        <Target name={target} size={[0.07, 0.13, 0.07]} center={[0, 0.06, 0]} hintY={0.16} />
      </group>
    </Pose>
  )
}

/* ── Станция фильтрования ── */

/** Воронка на кольце штатива: вершина конуса (начало воронки) и стакан для фильтрата под ней. */
export const FUN: V3 = [0.13, 0.2, -0.13]
export const FILTRATE: V3 = [0.13, 0, -0.13]
/** Сушильный шкаф и часовое стекло на его полке; место сушки на воздухе. */
export const OVEN_AT: V3 = [0.45, 0, -0.12]
export const AIR_DRY: V3 = [0.36, 0, -0.08]
const FILTER_REST: V3 = [0.12, 0, 0.17]
const WASH: V3 = [0.24, 0, 0.03]
/** Наклон лежащего конуса фильтра: образующая лежит на опоре (tg θ = h / r). */
const LIE = Math.atan2(FILTER_CONE.h, FILTER_CONE.r)

export interface FilterPlan {
  /** Весы (основание). */
  readonly sc: V3
  /** Шаг: сухой фильтр на весы; шаг, в начале которого его снимают с весов (на весы ставят стакан). */
  readonly weigh: number
  readonly clear: number
  /** Шаг фильтрования: сложить и вложить фильтр (0…0.3), слив (0.34…0.66), промывание (0.7…0.92). */
  readonly filter: number
  /** Шаг сушки и шаг взвешивания фильтра с осадком. */
  readonly dry: number
  readonly weigh2: number
  readonly how: 'oven' | 'air'
  readonly solid: string
  /** Цвет раствора, который льют на фильтр, и фильтрата. */
  readonly liquid: string
  readonly filtrate: string
  /** Объём фильтрата в стакане (мл) после слива и после промывания. */
  readonly filtrateMl: number
  /** Показ температуры и времени сушки на дисплее шкафа. */
  readonly ovenT?: number
  /** Стакан для фильтрата: 100 или 250 мл; где он стоит (по умолчанию — под воронкой); муть (проба на избыток). */
  readonly receiver?: 100 | 250
  readonly receiverAt?: (p: number) => V3
  readonly receiverCloud?: PFn
}

/** Фильтр: на столе плоским листом → на весы → обратно → сложен в конус, в воронку → на сушку (лёжа) → на весы. */
function filterPose(f: FilterPlan) {
  const pan = panAt(f.sc, 0.028, 0)
  const panFlat = panAt(f.sc)
  const inFunnel: V3 = [FUN[0], FUN[1] + 0.011, FUN[2]]
  const oven = f.how === 'oven'
  const dryAt: V3 = oven ? [OVEN_AT[0] + OVEN_SHELF[0] + 0.03, OVEN_AT[1] + OVEN_SHELF[1] + 0.007, OVEN_AT[2] + OVEN_SHELF[2] + 0.02] : [AIR_DRY[0] + 0.03, 0.007, AIR_DRY[2]]
  // в шкаф — только через открытую дверцу: перед шкафом опустить до полки, затем внутрь по горизонтали
  const front: V3 = [dryAt[0], dryAt[1] + 0.004, OVEN_AT[2] + OVEN.d / 2 + 0.07]
  const w = f.weigh2
  const pos = track(FILTER_REST, [
    [f.weigh, f.weigh + 0.7, panFlat, 0.12],
    [f.clear, f.clear + 0.3, FILTER_REST, 0.12],
    [f.filter, f.filter + 0.22, [FUN[0], 0.32, FUN[2]], 0.32],
    [f.filter + 0.2, f.filter + 0.3, inFunnel],
    ...(oven
      ? ([
          [f.dry, f.dry + 0.2, front, 0.32],
          [f.dry + 0.2, f.dry + 0.3, dryAt],
          [w, w + 0.15, front],
          [w + 0.15, w + 0.6, pan, 0.3],
        ] as const)
      : ([
          [f.dry, f.dry + 0.45, dryAt, 0.32],
          [w, w + 0.55, pan, 0.3],
        ] as const)),
  ])
  return (p: number): PoseValue => {
    // в воздухе над воронкой сложенный конус стоит вершиной вниз; на сушку и на весы — уложен на бок
    const lie = ease(p, f.dry + 0.05, f.dry + 0.2)
    return { pos: pos(p), rot: [0, 0, LIE * lie] }
  }
}

export function FilterStation({ f, receiver = true }: { f: FilterPlan; receiver?: boolean }) {
  const { lang } = useRig()
  const s = f.filter
  useSoundAt(s + 0.36, 'pour', [FUN[0], FUN[1] + 0.06, FUN[2]], 0.45)
  useSoundAt(s + 0.72, 'pour', [FUN[0], FUN[1] + 0.06, FUN[2]], 0.3)
  useSoundAt(f.weigh + 0.68, 'glass-place', panAt(f.sc), 0.25)
  useSoundAt(f.dry + 0.36, 'click', [OVEN_AT[0], 0.03, OVEN_AT[2] + OVEN.d / 2], f.how === 'oven' ? 0.5 : 0)
  const wash = (p: number) => {
    const rest: V3 = [WASH[0], BOTTLE_H, WASH[2]]
    const lipY = FUN[1] + FUNNEL.coneH + 0.02
    const over: V3 = [FUN[0] + 0.012, lipY, FUN[2]]
    let pos = mixV(rest, [WASH[0], lipY + 0.08, WASH[2]], ease(p, s + 0.66, s + 0.72))
    pos = mixV(pos, over, ease(p, s + 0.71, s + 0.76))
    pos = mixV(pos, [WASH[0], lipY + 0.08, WASH[2]], ease(p, s + 0.9, s + 0.94))
    pos = mixV(pos, rest, ease(p, s + 0.94, s + 0.99))
    const tilt = ease(p, s + 0.75, s + 0.79) * (1 - ease(p, s + 0.87, s + 0.9))
    return { pos, rot: [0, 0, 1.85 * tilt] as V3 }
  }
  const filtrate: PFn = (p) => f.filtrateMl * (0.82 * ease(p, s + 0.4, s + 0.7) + 0.18 * ease(p, s + 0.78, s + 0.95))
  const oven = f.how === 'oven'
  const d = f.dry
  return (
    <group>
      {/* штатив с кольцом и воронка */}
      <group position={[0, 0, FUN[2]]}>
        <RingStand rodX={FUN[0] - 0.12} ringX={FUN[0]} ringY={FUN[1] + 0.044} ringR={0.028} rodH={0.36} />
      </group>
      <group position={FUN as unknown as THREE.Vector3Tuple}>
        <Funnel />
      </group>
      <Falling from={[FUN[0], FUN[1] - FUNNEL.stem, FUN[2]]} toY={(p) => 0.004 + 0.0004 * filtrate(p)} a={s + 0.4} b={s + 0.95} n={16} color={f.filtrate} size={0.0017} />
      {receiver ? (
        <Pose pose={(p) => ({ pos: f.receiverAt ? f.receiverAt(p) : FILTRATE })}>
          <MeasuringBeaker size={BEAKERS[f.receiver ?? 100]} volume={filtrate} color={() => f.filtrate} cloud={f.receiverCloud} />
        </Pose>
      ) : null}

      {/* фильтровальная бумага */}
      <Pose pose={filterPose(f)}>
        <FilterPaper
          fold={(p) => ease(p, s + 0.04, s + 0.2)}
          wet={(p) => ease(p, s + 0.34, s + 0.42) * (1 - ease(p, d + 0.4, d + 0.85))}
          fill={(p) => 0.7 * ease(p, s + 0.36, s + 0.44) * (1 - ease(p, s + 0.6, s + 0.7)) + 0.45 * hill(p, s + 0.76, s + 0.92, 0.2)}
          dirt={(p) => ease(p, s + 0.4, s + 0.66)}
          liquidColor={f.liquid}
          dirtColor={f.solid}
        />
        <Target name="filter" size={[0.08, 0.05, 0.08]} center={[0, 0.012, 0]} hintY={0.075} />
      </Pose>

      {/* промывалка с дистиллированной водой */}
      <Pose pose={wash}>
        <ReagentBottle formula="H₂O" name={{ ru: 'дист. вода', en: 'dist. water', uz: 'distillangan suv' }[lang]} level={(p) => mix(0.9, 0.7, ease(p, s + 0.78, s + 0.88))} />
      </Pose>
      <PourStream x={FUN[0] + 0.006} z={FUN[2]} top={() => FUN[1] + FUNNEL.coneH + 0.02} bottom={() => FUN[1] + 0.02} show={(p) => hill(p, s + 0.78, s + 0.88, 0.2)} />

      {oven ? (
        <group position={OVEN_AT as unknown as THREE.Vector3Tuple}>
          <DryingOven
            door={(p) => Math.max(hill(p, d + 0.02, d + 0.42, 0.35), ease(p, d + 0.86, d + 0.97) * (1 - ease(p, f.weigh2 + 0.6, f.weigh2 + 0.85)))}
            on={(p) => ease(p, d + 0.38, d + 0.42) * (1 - ease(p, d + 0.84, d + 0.88))}
            lines={(p) => {
              const min = Math.round(60 * ease(p, d + 0.42, d + 0.84))
              return [`${f.ovenT ?? 105} °C`, `00:${String(min).padStart(2, '0')}`]
            }}
          />
          <group position={[OVEN_SHELF[0] + 0.0, OVEN_SHELF[1], OVEN_SHELF[2] + 0.02]}>
            <WatchGlass />
          </group>
          <Target name="oven" size={[0.24, 0.22, 0.2]} center={[0, 0.11, 0]} hintY={0.26} />
        </group>
      ) : (
        <group position={AIR_DRY as unknown as THREE.Vector3Tuple}>
          <WatchGlass />
          <AirClock at={d} lang={lang} />
        </group>
      )}
    </group>
  )
}

/** Подпись «сушка на воздухе: N ч» над часовым стеклом (время ускорено). */
function AirClock({ at, lang }: { at: number; lang: 'ru' | 'en' | 'uz' }) {
  const label = { ru: 'сушка на воздухе', en: 'air drying', uz: 'havoda quritish' }
  return (
    <Readout
      position={[0, 0.07, 0]}
      label={label}
      text={(p) => {
        if (p < at + 0.45 || p > at + 1.2) return null
        const h = Math.round(24 * ease(p, at + 0.45, at + 0.92))
        return lang === 'en' ? `${h} h` : lang === 'uz' ? `${h} soat` : `${h} ч`
      }}
    />
  )
}

/** Сколько видно числа «сушка» и т. п. — общий формат «t °C». */
export const fmtC = (t: number, lang: 'ru' | 'en' | 'uz') => `${fmtNum(t, 1, lang)} °C`
