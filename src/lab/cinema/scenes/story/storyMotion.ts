/**
 * НОРМЫ ДВИЖЕНИЯ «СЮЖЕТА РЕАКЦИИ» (чистый TS, без three: его читают сцена и тест scripts/test-story-motion.mts).
 * Те же нормы, что у «Как образуется» v2 (components/lab/formation/motion.ts, story/phase.ts VIB_LIMITS):
 *  • тепловые колебания — ≤ 4 пм и ≤ 1,5 Гц (самая быстрая составляющая), у каждой частицы своя фаза (золотой угол);
 *  • плавный разгон за шаг «Исходные» (S(x) = 3x² − 2x³ — без скачка скорости), затухание за 1 с с начала разрыва;
 *    на переносе e⁻, образовании и в «Итоге» колебаний нет совсем (кадр «как в жизни» — неподвижный кристалл);
 *  • все прочие периодические эффекты сцены (пульс e⁻, свечение ролей, подсветка групп) — ≤ 1,5 Гц.
 *
 * Масштаб сюжета: ионы касаются (Na⁺ 0,272 + Cl⁻ 0,355 ед. ↔ 283 пм) — 1 пм ≈ 0,0022 ед. Это самый «крупный»
 * масштаб сцены (у палочек 1 пм ≈ 0,005 ед.), поэтому 4 пм в нём — строгая верхняя граница для любой частицы.
 */
import { VIB_LIMITS } from '../../../../components/lab/formation/story/phase'

/** Единиц сцены сюжета на 1 пм (по ионному контакту Na⁺–Cl⁻; см. шапку). */
export const STORY_PM_K = 0.0022
/** Нормы колебаний (общие с «Как образуется»). */
export const STORY_VIB = { ampPm: VIB_LIMITS.ampPm, hz: 1.2, hzMax: VIB_LIMITS.hzMax } as const
/** Частоты прочих периодических эффектов (Гц): пульс точки e⁻, «дыхание» свечения ролей, подсветка групп. */
export const STORY_FX_HZ = { electronPulse: 1.0, roleGlow: 0.55, keptGlow: 0.42 } as const
/** Затухание колебаний после начала разрыва, с. */
export const STORY_VIB_COOL = 1
/** Золотой угол: фазы соседних частиц не совпадают. */
const PHASE_STEP = 2.39996
const INV_SQRT3 = 1 / Math.sqrt(3)

/** Гладкая ступенька S(x) = 3x² − 2x³ на [0, 1]. */
export function smooth01(x: number): number {
  const u = x < 0 ? 0 : x > 1 ? 1 : x
  return u * u * (3 - 2 * u)
}

type VibWin = { readonly rampTo: number; readonly coolFrom: number }

/** Окно колебаний по расписанию сюжета: разгон [0, конец «Исходных»], затухание с начала разрыва за 1 с. */
export function storyVibWindow(steps: readonly { readonly id: string; readonly from: number; readonly to: number }[], breakFrom: number): VibWin {
  const r = steps.find((s) => s.id === 'reactants')
  return { rampTo: Math.max(0.5, r ? r.to : 2), coolFrom: breakFrom }
}

/** Уровень колебаний 0…1 в момент t. */
export function storyVibLevel(w: VibWin, t: number): number {
  if (t <= 0) return 0
  const k = smooth01(t / w.rampTo) * (1 - smooth01((t - w.coolFrom) / STORY_VIB_COOL))
  return k > 0 ? k : 0
}

/**
 * Смещение частицы i в момент t (единицы сцены, пишет в out[o..o+2]).
 * Δr = A/√3 · [sin(ω₁t + φ), sin(1,11ω₁t + φ + 2,1), sin(0,89ω₁t + φ + 4,2)], |Δr| ≤ A = 4 пм · K · уровень.
 */
export function storyVibOffset(w: VibWin, i: number, t: number, out: Float32Array | number[], o = 0): void {
  const lv = storyVibLevel(w, t)
  if (lv <= 0) {
    out[o] = 0
    out[o + 1] = 0
    out[o + 2] = 0
    return
  }
  const a = STORY_VIB.ampPm * STORY_PM_K * lv * INV_SQRT3
  const w1 = 2 * Math.PI * Math.min(STORY_VIB.hz, STORY_VIB.hzMax / 1.11)
  const f = PHASE_STEP * i
  out[o] = a * Math.sin(w1 * t + f)
  out[o + 1] = a * Math.sin(1.11 * w1 * t + f + 2.1)
  out[o + 2] = a * Math.sin(0.89 * w1 * t + f + 4.2)
}

/** Пульс (множитель 1 ± amp) с частотой hz — для яркости/размера эффектов; hz ограничена нормой. */
export function storyPulse(hz: number, t: number, phase: number, amp: number): number {
  return 1 + amp * Math.sin(2 * Math.PI * Math.min(hz, STORY_VIB.hzMax) * t + phase)
}
