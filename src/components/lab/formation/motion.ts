/**
 * Движение частиц «Как образуется» без тряски (чистый TS — без three/react: его читают вид, облака и аудит B).
 *
 * Нагревание показываем двумя честными эффектами:
 *  1) тепловые колебания — медленное «дыхание» с малой амплитудой (≤ 4 пм, ≤ 1,5 Гц), каждая частица со своей
 *     фазой (золотой угол — соседи не в фазе), разгон за весь этап «Нагревание» (без стартового скачка),
 *     затухание за 1 с на разрыве; в «Решётке» и «Итоге» колебаний нет совсем;
 *  2) тепловое расширение — фрагмент чуть «раздувается» от центроида на 1 + expand (α ≈ 3·10⁻⁵ К⁻¹ × ΔT ≈ 500 К ≈ 1,5 %).
 *
 * Δr_i(t) = A(t)/√3 · [ê_x sin(ω₁t+φ_i) + ê_y sin(ω₂t+φ_i+2.1) + ê_z sin(ω₃t+φ_i+4.2)], φ_i = 2.39996·i,
 * ω₁ = 2π·hz, ω₂ = 1.11·ω₁, ω₃ = 0.89·ω₁. Деление на √3 — чтобы ДЛИНА вектора смещения не превышала A (а не каждая
 * компонента). hz ограничен так, что и самая быстрая компонента (1.11·hz) ≤ VIB_LIMITS.hzMax.
 * A(t) = ampPm·K·S(u)·(1−S(v))·(1−S(w)), S(x) = 3x²−2x³ на [0,1], K = 0,00285 ед/пм (pmToScene(1)),
 * u = (t−heat.t0)/heat.dur, v = (t−t_cool)/1, w = (t−lattice.t0)/1 (нет «Решётки» — от final.t0).
 * При 60 к/с смещение за кадр ≤ A·ω/60 ≈ 4 пм·9,4/60 ≈ 0,6 пм ≈ 0,4 px (1 Å ≈ 60 px).
 */
import type { FormationStory } from './formationStory'
import { VIB_LIMITS, vibOf } from './story/phase'

type V3 = [number, number, number]

/** pmToScene(1): 1 пм = 0,01 Å × 0,285 ед/Å (lab/cinema/core/atoms SCENE_PER_ANGSTROM). */
export const PM_K = 0.00285
/** Предельная амплитуда (пм) — равна VIB_LIMITS.ampPm (аудит B проверяет регулярным выражением и в виде). */
export const HEAT_AMP_PM = 4
/** Нормы движения вида (аудит P сверяет с VIB_LIMITS). */
export const MOTION = { ampPm: VIB_LIMITS.ampPm, hzMax: VIB_LIMITS.hzMax } as const
/** Золотой угол (рад): фазы соседних частиц не совпадают. */
export const PHASE_STEP = 2.39996
const INV_SQRT3 = 1 / Math.sqrt(3)

/** Гладкая ступенька S(x) = 3x² − 2x³ на [0, 1] (C¹-непрерывна: без скачка скорости). */
export function smooth01(x: number): number {
  const u = x < 0 ? 0 : x > 1 ? 1 : x
  return u * u * (3 - 2 * u)
}

type Win = { heat: { t0: number; dur: number } | null; cool: number; calm: number }
const winCache = new WeakMap<FormationStory, Win>()
function windows(story: FormationStory): Win {
  const c = winCache.get(story)
  if (c) return c
  const st = (k: string) => story.stages.find((s) => s.key === k) ?? null
  const heat = st('heat')
  const brk = st('break')
  const lat = st('lattice')
  const fin = story.stages[story.stages.length - 1]!
  let cool = Infinity
  if (heat) {
    const end = heat.t0 + heat.dur
    cool = brk && brk.t0 >= end - 0.01 && brk.t0 <= end + 0.5 ? brk.t0 : end
  }
  const w: Win = { heat: heat ? { t0: heat.t0, dur: Math.max(1e-3, heat.dur) } : null, cool, calm: lat ? lat.t0 : fin.t0 }
  winCache.set(story, w)
  return w
}

/** Уровень нагрева 0…1 (разгон за этап, остывание за 1 с, ноль в «Решётке»/«Итоге»). */
export function heatLevel(story: FormationStory, t: number): number {
  const w = windows(story)
  if (!w.heat || t <= w.heat.t0) return 0
  const k = smooth01((t - w.heat.t0) / w.heat.dur) * (1 - smooth01(t - w.cool)) * (1 - smooth01(t - w.calm))
  return k > 0 ? k : 0
}

/** Действующие параметры колебаний (с ограничением норм). */
export function vibParams(story: FormationStory): { ampPm: number; hz: number; expand: number } {
  const v = vibOf(story)
  return {
    ampPm: Math.max(0, Math.min(v.ampPm, VIB_LIMITS.ampPm)),
    hz: Math.max(0, Math.min(v.hz, VIB_LIMITS.hzMax / 1.11)),
    expand: Math.max(0, Math.min(v.expand, 0.03)),
  }
}

/** Смещение частицы i от тепловых колебаний в момент t (мир модели, пишет в out). */
export function vibOffset(story: FormationStory, i: number, t: number, out: V3): V3 {
  const lv = heatLevel(story, t)
  if (lv <= 0) {
    out[0] = 0
    out[1] = 0
    out[2] = 0
    return out
  }
  const p = vibParams(story)
  const a = p.ampPm * PM_K * lv * INV_SQRT3
  const w1 = 2 * Math.PI * p.hz
  const f = PHASE_STEP * i
  out[0] = a * Math.sin(w1 * t + f)
  out[1] = a * Math.sin(1.11 * w1 * t + f + 2.1)
  out[2] = a * Math.sin(0.89 * w1 * t + f + 4.2)
  return out
}

/** Множитель теплового расширения фрагмента от центроида: 1 + expand·уровень нагрева. */
export function heatExpand(story: FormationStory, t: number): number {
  const lv = heatLevel(story, t)
  return lv > 0 ? 1 + vibParams(story).expand * lv : 1
}
