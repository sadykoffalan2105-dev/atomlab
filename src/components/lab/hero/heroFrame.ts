/**
 * Кадр героя продукта: где стоит модель и насколько отъехать камере.
 *
 * Свободная область канвы — та же, что у сцен (core/safeArea.measureSafeArea: верхние пилюли,
 * реактор снизу, панель урока слева или снизу) плюс карточка продукта [data-lab-hero-card]:
 * карточку обходим сверху или справа — где свободный прямоугольник останется крупнее.
 * Камера целится по X и Y так, чтобы центр композиции (модель + подписи) встал в центр свободной
 * области, и отъезжает, пока описанная сфера композиции не впишется в неё с полем.
 */
import { createSafeArea, measureSafeArea } from '../../../lab/cinema/core/safeArea'
import { buildHeroModel } from './heroGeometry'

/** Радиус описанной сферы модели героя в мире после нормировки (кристалл и молекула одинаково). */
export const HERO_FIT_RADIUS = 1
/** Медленный облёт: ≈ 55 с на оборот. */
export const HERO_ORBIT_RAD_PER_SEC = 0.115
/** Подпись кристалла под моделью: отступ от низа модели и шаг строк, CSS-пиксели (DOM-текст). */
export const CAPTION_GAP_PX = 16
export const CAPTION_LINE_PX = 19
/** Поле вокруг композиции: доля свободной области, которую она занимает. */
const FILL = 0.86
/** Каталожная модель (вещества без героя по данным) — прежний габарит кадра. */
const FALLBACK_FIT_RADIUS = 1.2

/** Подпись кристалла в две строки: параметры ячейки / группа и КЧ (только символы и числа). */
export function heroCaptionLines(caption: readonly string[]): string[] {
  if (caption.length === 0) return []
  const cellParams = caption.filter((c) => /^[abc] = /.test(c))
  const rest = caption.filter((c) => !/^[abc] = /.test(c))
  return [cellParams.join(' · '), rest.join(' · ')].filter((s) => s.length > 0)
}

export type HeroFrameGeometry = {
  /** радиус описанной сферы модели (с подписями символов над атомами), мир */
  fitRadius: number
  /** высота подписи под моделью, CSS-пиксели: эта полоса снизу свободной области отдаётся тексту */
  captionPx: number
}

export function heroFrameGeometry(compoundId: string | null | undefined): HeroFrameGeometry {
  const model = compoundId ? buildHeroModel(compoundId) : null
  if (!model) return { fitRadius: FALLBACK_FIT_RADIUS, captionPx: 0 }
  const lines = heroCaptionLines(model.caption).length
  // Подписи символов стоят над атомами — чуть больше радиуса модели.
  return {
    fitRadius: HERO_FIT_RADIUS * 1.08,
    captionPx: lines > 0 ? CAPTION_GAP_PX + lines * CAPTION_LINE_PX : 0,
  }
}

export type HeroFrame = {
  targetX: number
  targetY: number
  /** расстояние камеры до цели */
  radius: number
}

const safe = createSafeArea()

/**
 * Свободный прямоугольник канвы (пиксели канваса) с учётом карточки продукта.
 * null — канва ещё не разложена.
 */
export function measureHeroFreeRect(
  canvas: HTMLCanvasElement,
): { left: number; right: number; top: number; bottom: number; width: number; height: number } | null {
  const r = canvas.getBoundingClientRect()
  if (r.width < 40 || r.height < 80) return null
  safe.counter = 0
  safe.ready = false
  measureSafeArea(safe, canvas)
  if (!safe.ready) return null
  const { left, bottom } = safe
  let { right, top } = safe
  const card = document.querySelector<HTMLElement>('[data-lab-hero-card]')
  if (card) {
    const cr = card.getBoundingClientRect()
    const cl = cr.left - r.left
    const cb = cr.bottom - r.top
    const ct = cr.top - r.top
    if (cr.width > 0 && cr.height > 0 && ct < bottom && cb > top && cl < right) {
      const gap = 10
      const topCut = Math.max(top, cb + gap)
      const rightCut = Math.min(right, cl - gap)
      const scoreTop = Math.min(right - left, bottom - topCut)
      const scoreRight = Math.min(rightCut - left, bottom - top)
      if (scoreTop >= scoreRight) top = topCut
      else right = rightCut
    }
  }
  if (right - left < 60 || bottom - top < 60) return { left: 0, right: r.width, top: 0, bottom: r.height, width: r.width, height: r.height }
  return { left, right, top, bottom, width: r.width, height: r.height }
}

/**
 * Кадр героя: цель камеры (X, Y) и расстояние, при которых композиция радиуса fitRadius
 * вписана в свободную область. baseDistance — прежний каталожный радиус орбиты (не ближе 0,8 от него).
 */
export function measureHeroFrame(
  canvas: HTMLCanvasElement | null,
  geom: HeroFrameGeometry,
  fovDeg: number,
  baseDistance: number,
): HeroFrame | null {
  if (!canvas) return null
  const free = measureHeroFreeRect(canvas)
  if (!free) return null
  const tanH = Math.tan((fovDeg * Math.PI) / 360)
  // Полоса под подпись кристалла — снизу свободной области; модель центрируется над ней.
  const bottom = Math.max(free.top + 60, free.bottom - geom.captionPx)
  const freeMin = Math.max(60, Math.min(free.right - free.left, bottom - free.top))
  const need = (geom.fitRadius * free.height) / (FILL * freeMin * tanH)
  // Потолок отъезда большой: на телефоне с открытым реактором свободная полоса бывает меньше 100 px —
  // пусть модель будет мелкой, но целиком в свободной области, а не под панелью.
  const radius = Math.min(baseDistance * 10, Math.max(baseDistance * 0.8, need))
  const pxPerWorld = free.height / (2 * radius * tanH)
  const cx = (free.left + free.right) / 2
  const cy = (free.top + bottom) / 2
  return {
    targetX: -(cx - free.width / 2) / pxPerWorld,
    targetY: (cy - free.height / 2) / pxPerWorld,
    radius,
  }
}
