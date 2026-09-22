/**
 * Палитра экрана входа: небо сцены и адаптация цветов атомов под тему.
 *
 * Модуль без three и React намеренно: те же функции считает проверочный скрипт,
 * поэтому «водород виден на фоне» — измеримое утверждение, а не мнение.
 *
 * Зачем адаптация вообще. Цвет водорода в CPK — чистый белый (0xffffff,
 * см. ATOMIC_DATA.H.cpk). В тёмной теме это идеально; в светлой белый шар на
 * бледно-голубом небе пропадает: у него остаётся только затенение по краю.
 * Лечится с двух сторон сразу:
 *   1) небо светлой темы опущено до дневного холодного тона (не почти-белого);
 *   2) цвета, которые ДАЖЕ ТАК не отрываются от фона, приглушаются по общему
 *      правилу — ENTRY_MIN_ATOM_CONTRAST.
 *
 * Пункт 2 — заявленное отступление от CPK и только в светлой теме: оттенок
 * сохраняется, падает лишь светлота, так что водород остаётся «самым светлым
 * атомом кадра», а не превращается в другой элемент. В тёмной теме цвета
 * данных ядра идут как есть, без единой правки.
 */
import type { AppThemeId } from '../../../theme/appTheme'

export type EntrySkyPalette = {
  /** зенит и надир вертикального градиента неба */
  readonly top: number
  readonly bottom: number
  /** цвет ядра за реакцией: в тёмной теме светлее фона, в светлой — темнее */
  readonly accent: number
  /** цвет вспышки связывания (всегда прибавляется к фону) */
  readonly flash: number
  /** вес широкого пятна и узкого кольца-ореола */
  readonly core: number
  readonly ring: number
}

/**
 * Небо экрана входа.
 *
 * light — дневной воздух, но НЕ лист бумаги. Прежний почти-белый (0xf3f7fd /
 * 0xdbe4f2) давал белому водороду контраст 1.1 у края кадра: атом читался
 * только тенью. Тон опущен до холодного голубого средней светлоты — страница
 * вокруг канваса остаётся светлой, а у сцены появляется своё небо, на котором
 * видны и белый водород, и светлые щелочные металлы.
 */
export const ENTRY_SKY: Record<AppThemeId, EntrySkyPalette> = {
  dark: { top: 0x0b1236, bottom: 0x030309, accent: 0x24408f, flash: 0xfff0c8, core: 0.55, ring: 0.14 },
  light: { top: 0xc6d6ec, bottom: 0x9fb4d6, accent: 0x7d96c2, flash: 0xfff6dc, core: 0.66, ring: 0.18 },
}

// --- цветовая арифметика (та же, что в шейдере неба) -------------------------

function toLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

function toSrgb(c: number): number {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
}

/** hex (sRGB) → линейные компоненты 0..1 — в этом пространстве смешивает GPU. */
export function hexToLinear(hex: number): [number, number, number] {
  return [toLinear(((hex >> 16) & 255) / 255), toLinear(((hex >> 8) & 255) / 255), toLinear((hex & 255) / 255)]
}

/** Линейные компоненты → hex (sRGB). */
export function linearToHex(rgb: readonly [number, number, number]): number {
  const q = (c: number) => Math.max(0, Math.min(255, Math.round(toSrgb(Math.max(0, Math.min(1, c))) * 255)))
  return (q(rgb[0]) << 16) | (q(rgb[1]) << 8) | q(rgb[2])
}

/** Относительная яркость по WCAG 2.1 (линейные компоненты уже посчитаны). */
export function relativeLuminance(hex: number): number {
  const [r, g, b] = hexToLinear(hex)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Контраст по WCAG 2.1: 1 — цвета неразличимы по светлоте, 21 — чёрное на белом. */
export function contrastRatio(a: number, b: number): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  return la > lb ? (la + 0.05) / (lb + 0.05) : (lb + 0.05) / (la + 0.05)
}

/**
 * Цвет неба на горизонте кадра, на расстоянии `r` от центра в единицах NDC.
 *
 * Повторяет фрагментный шейдер `LabEntryAtmosphere` (h = 0.5 — направление
 * «прямо перед камерой»), без слагаемого вспышки: вспышка живёт доли секунды,
 * а фон атома нужно оценивать по дежурному состоянию.
 */
export function entryBackdropHex(theme: AppThemeId, r: number): number {
  const p = ENTRY_SKY[theme]
  const top = hexToLinear(p.top)
  const bottom = hexToLinear(p.bottom)
  const accent = hexToLinear(p.accent)
  const h = 0.5 * 0.5 // h * h при vDir.y = 0
  const core = Math.exp(-r * r * 2.6)
  const ring = Math.exp(-Math.pow(r - 0.58, 2) * 11)
  const k = Math.max(0, Math.min(1, core * p.core + ring * p.ring))
  const out: [number, number, number] = [0, 0, 0]
  for (let i = 0; i < 3; i++) {
    const base = bottom[i]! + (top[i]! - bottom[i]!) * h
    out[i] = base + (accent[i]! - base) * k
  }
  return linearToHex(out)
}

/**
 * Опорные точки фона для оценки атомов.
 *   core — центр кадра, где собирается продукт;
 *   belt — кольцо пояса веществ и трасса влёта реагентов (самый светлый фон
 *          в светлой теме, именно там белый водород и пропадал).
 */
export const ENTRY_BACKDROP_PROBE = { core: 0, belt: 0.72 } as const

/** Ниже этого контраста атом в светлой теме считается слипшимся с фоном. */
export const ENTRY_MIN_ATOM_CONTRAST = 1.9

/**
 * Цвет атома под тему.
 *
 * В тёмной теме — ровно hex из ядра данных. В светлой: если контраст с самым
 * светлым участком неба ниже порога, светлота цвета опускается (оттенок и
 * соотношение каналов сохраняются) до первого значения, которое порог берёт.
 * Поиск — деление отрезка, 18 шагов: функция вызывается при смене вещества
 * петли и темы, в кадре её нет.
 */
export function entryAtomCpk(hex: number, theme: AppThemeId): number {
  if (theme === 'dark') return hex
  const bg = entryBackdropHex('light', ENTRY_BACKDROP_PROBE.belt)
  if (contrastRatio(hex, bg) >= ENTRY_MIN_ATOM_CONTRAST) return hex
  const lin = hexToLinear(hex)
  let lo = 0
  let hi = 1
  for (let step = 0; step < 18; step++) {
    const mid = (lo + hi) * 0.5
    const probe = linearToHex([lin[0] * mid, lin[1] * mid, lin[2] * mid])
    if (contrastRatio(probe, bg) >= ENTRY_MIN_ATOM_CONTRAST) lo = mid
    else hi = mid
  }
  return linearToHex([lin[0] * lo, lin[1] * lo, lin[2] * lo])
}
