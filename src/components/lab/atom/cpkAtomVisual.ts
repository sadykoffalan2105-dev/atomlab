/**
 * Геометрия и подписи CPK-сфер превью реактора: только числа и строки,
 * без three и без DOM — тестируется node-скриптом scripts/test-cpk-atom.mts.
 *
 * РАДИУС (почему именно так)
 *  • нейтральный атом — ван-дер-ваальсов радиус (Bondi 1964 / Alvarez 2013).
 *    Это и есть каноническая модель CPK (space-filling): шары соприкасаются
 *    по вдв-контакту. Ковалентный или металлический радиус для «шарика на
 *    экране» не годится: H (31 пм) рядом с K (227 пм) превратился бы в точку,
 *    хотя в модели Кори–Полинга–Колтуна это 120 пм против 275 пм.
 *  • ион — эффективный ионный радиус Шеннона, КЧ 6 (для Fe/Mn — HS).
 *    Катион МЕНЬШЕ своего атома (Na⁰ 227 вдв / 186 металл. → Na⁺ 102 пм),
 *    анион заметно БОЛЬШЕ катиона: Cl⁻ 181 / Na⁺ 102 = 1.77 — ровно та
 *    пропорция, которая должна читаться глазом в решётке NaCl.
 *    Если конкретного иона нет в таблице Шеннона, берём реальный
 *    металлический/ковалентный радиус (radiusForSpecies), а НЕ выдумываем число.
 *
 * ЦВЕТ — CPK: H белый, C тёмно-серый, N синий, O красный, Cl жёлто-зелёный,
 * S жёлтый, Na фиолетовый, Mg светло-зелёный, Ca тёмно-зелёный, Fe оранжево-
 * коричневый, Zn сине-серый. Источник — ATOMIC_DATA (выверенная таблица);
 * для элементов вне её (вся остальная таблица Менделеева) — cpkHex из
 * periodicTableRaw.json, тот же общепринятый набор Jmol/CPK.
 */
import { getElementByZ } from '../../../data/elements'
import {
  ATOMIC_DATA,
  isElementSymbol,
  radiusForSpecies,
  type ElementSymbol,
} from '../../../chemistry/data/atomicData'
import { SCENE_PER_ANGSTROM, pmToAngstrom } from '../../../lab/cinema/core/atoms'

/**
 * Масштаб превью. Минимальный зазор между центрами слотов — PREVIEW_ATOM_MIN_GAP
 * (0.52 мировых единиц до общего scale). Самый крупный школьный атом — K,
 * вдв 275 пм → 2.75 Å → 2.75 · 0.285 · 0.31 ≈ 0.243, то есть диаметр 0.486:
 * соседние калии почти касаются, но не сливаются. H (120 пм) → 0.106.
 */
export const CPK_PREVIEW_RADIUS_SCALE = 0.31
/** Нижняя отсечка: ион вроде Al³⁺ (53 пм) всё ещё должен быть виден. */
export const CPK_MIN_RADIUS = 0.055
/** Верхняя отсечка: Cs (343 пм) не имеет права перекрыть соседний слот. */
export const CPK_MAX_RADIUS = 0.255
/** Запасной вдв-радиус для элемента, которого нет ни в одной таблице. */
export const CPK_FALLBACK_VDW_PM = 160

export type CpkSpecies = {
  /** Символ элемента — подпись на сфере (химическая нотация, не переводится). */
  symbol: string
  /** Цвет CPK строкой '#rrggbb'. */
  colorHex: string
  /** Радиус частицы, пм (вдв для атома, Шеннон для иона). */
  radiusPm: number
  /** Радиус в мировых единицах сцены превью. */
  radius: number
  /** Заряд иона; 0 — нейтральный атом. */
  charge: number
  /** Надстрочный бейдж заряда: '', '+', '2+', '−', '2−'… */
  chargeLabel: string
  /** true — радиус взят из таблицы Шеннона (ион), а не вдв. */
  ionic: boolean
}

/** Символ элемента по Z; null — элемента нет в таблице. */
export function cpkSymbolForZ(z: number): string | null {
  const datum = elementDatumByZ(z)
  if (datum) return datum.symbol
  return getElementByZ(z)?.symbol ?? null
}

function elementDatumByZ(z: number): (typeof ATOMIC_DATA)[ElementSymbol] | null {
  const sym = getElementByZ(z)?.symbol
  if (sym && isElementSymbol(sym)) return ATOMIC_DATA[sym]
  return null
}

/** Ван-дер-ваальсов радиус, пм: выверенная таблица → periodicTableRaw → запасной. */
export function cpkVdwRadiusPm(z: number): number {
  const datum = elementDatumByZ(z)
  if (datum) return datum.vdwRadiusPm
  // В periodicTableRaw.json поле atomicRadius — это именно вдв-набор
  // (H 120, C 170, O 152, Cl 175, K 275), тот же Bondi/Alvarez.
  const raw = getElementByZ(z)?.atomicRadius
  return typeof raw === 'number' && raw > 0 ? raw : CPK_FALLBACK_VDW_PM
}

/**
 * Радиус частицы, пм. charge = 0 → вдв (CPK space-filling);
 * charge ≠ 0 → Шеннон КЧ 6, иначе реальный металл./ковал. радиус.
 */
export function cpkRadiusPm(z: number, charge = 0): number {
  if (charge === 0) return cpkVdwRadiusPm(z)
  const datum = elementDatumByZ(z)
  if (!datum) return cpkVdwRadiusPm(z)
  return radiusForSpecies(datum.symbol, charge)
}

/** Радиус сферы в мировых единицах превью реактора. */
export function cpkPreviewRadius(z: number, charge = 0): number {
  const pm = cpkRadiusPm(z, charge)
  const world = pmToAngstrom(pm) * SCENE_PER_ANGSTROM * CPK_PREVIEW_RADIUS_SCALE
  return Math.min(CPK_MAX_RADIUS, Math.max(CPK_MIN_RADIUS, world))
}

/** Цвет CPK строкой '#rrggbb'. */
export function cpkColorHex(z: number): string {
  const datum = elementDatumByZ(z)
  if (datum) return `#${datum.cpk.toString(16).padStart(6, '0')}`
  // Нижний регистр обязателен: hex — часть ключа кэша материалов.
  const hex = getElementByZ(z)?.cpkHex
  return hex ? `#${hex.replace(/^#/, '').toLowerCase()}` : '#8899aa'
}

/**
 * Надстрочный бейдж заряда в химической нотации: 1 → '+', 2 → '2+',
 * −1 → '−', −2 → '2−' (U+2212, а не дефис). 0 → пустая строка.
 * Это химические символы, одинаковые в ru/en/uz — через t() не идут.
 */
export function cpkChargeLabel(charge: number): string {
  const c = Math.trunc(charge)
  if (c === 0) return ''
  const n = Math.abs(c)
  const sign = c > 0 ? '+' : '−'
  return n === 1 ? sign : `${n}${sign}`
}

/** Полное описание частицы для рендера одной сферы. */
export function cpkSpecies(z: number, charge = 0): CpkSpecies {
  const c = Math.trunc(charge)
  const datum = elementDatumByZ(z)
  const ionic = c !== 0 && datum != null
  return {
    symbol: cpkSymbolForZ(z) ?? '?',
    colorHex: cpkColorHex(z),
    radiusPm: cpkRadiusPm(z, c),
    radius: cpkPreviewRadius(z, c),
    charge: c,
    chargeLabel: cpkChargeLabel(c),
    ionic,
  }
}

/**
 * Размер спрайта-подписи. Верхняя граница подобрана так, чтобы подпись
 * НЕ вылезала за силуэт своего шара: самый крупный школьный атом — K
 * (вдв 275 пм) даёт диаметр 0.486, у Na — 0.401, у Cl — 0.309, и всюду
 * size < диаметра. Тогда подпись не может «уехать» на соседний атом.
 */
export function cpkLabelSize(radius: number): number {
  return Math.min(0.3, Math.max(0.18, radius * 1.55))
}

/**
 * Высота подписи над центром сферы: символ садится прямо на верхний край
 * своего шара. Раньше подпись висела на (r + 0.44·size) и в плотном кластере
 * (2Na + Cl₂ — атомы в кольце XZ с шагом 0.52) проекционно наезжала на
 * соседний шар: «Cl» оказывался поверх натрия.
 */
export function cpkLabelOffsetY(radius: number): number {
  return radius * 1.04 + cpkLabelSize(radius) * 0.3
}

/**
 * Какие атомы подписывать. В «2 Na» все шары — один и тот же натрий, и пять
 * одинаковых спрайтов не учат ничему, зато превращают кластер в кашу.
 * Подписываем ПЕРВОЕ вхождение каждого элемента внутри его слагаемого:
 * у HCl подпишутся и H, и Cl; у ZnCl₂ — Zn и один Cl; у «2 Na» — один Na.
 *
 * group — индекс слагаемого (термина) или молекулы; z — атомный номер.
 */
export function cpkLabelIndices(
  items: readonly ({ readonly z: number; readonly group: number } | null | undefined)[],
): Set<number> {
  const seen = new Set<string>()
  const out = new Set<number>()
  for (let i = 0; i < items.length; i += 1) {
    const it = items[i]
    if (!it) continue
    const key = `${it.group}|${it.z}`
    if (seen.has(key)) continue
    seen.add(key)
    out.add(i)
  }
  return out
}

/** Радиус мягкого «электронного облака» — оболочка поверх ядра-сферы. */
export function cpkCloudRadius(radius: number): number {
  return radius * 1.34
}

/** Размер аддитивного ореола (спрайт) вокруг атома. */
export function cpkHaloSize(radius: number): number {
  return radius * 6.2
}

/**
 * Дыхание: медленный вдох-выдох, у каждого слота своя фаза, чтобы кластер
 * не пульсировал синхронно. Возвращает множитель масштаба около 1.
 */
export function cpkBreathScale(elapsedSec: number, slotPhase: number, amp = 0.035): number {
  return 1 + amp * Math.sin(elapsedSec * 0.85 + slotPhase)
}

/** Фаза дыхания по Z и индексу слота — детерминированная, без Math.random. */
export function cpkBreathPhase(z: number, slotIndex = 0): number {
  return ((z * 1.618 + slotIndex * 0.73) % (Math.PI * 2)) as number
}
