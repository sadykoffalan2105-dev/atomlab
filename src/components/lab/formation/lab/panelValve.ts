/**
 * Клапан панели этапов показа (образование и путь — одинаково): раскладку держит CSS (над реактором, в окне),
 * а клапан после монтирования и на изменения (ResizeObserver панели, ресайз окна, смена прямоугольника
 * реактора) проверяет, что панель внутри окна и выше верха реактора, иначе ставит inline right / max-width /
 * max-height. Без интервалов и без опроса DOM в кадре.
 */
import { formationLab } from './formationLabStore'

const GAP = 8

export function attachPanelValve(el: HTMLElement, onRect: (r: DOMRect | null) => void): () => void {
  let busy = false
  const run = () => {
    if (busy) return
    busy = true
    try {
      el.style.removeProperty('right')
      el.style.removeProperty('max-width')
      el.style.removeProperty('max-height')
      const W = window.innerWidth
      const H = window.innerHeight
      let r = el.getBoundingClientRect()
      if (r.width > W - 2 * GAP) el.style.maxWidth = `${Math.max(160, W - 2 * GAP)}px`
      r = el.getBoundingClientRect()
      if (r.right > W - GAP) el.style.right = `${GAP}px`
      const phone = W <= 760
      const rt = formationLab.rects.reactor
      const limit = !phone && rt && rt.height > 0 && rt.top > r.top ? rt.top - GAP : H - GAP
      r = el.getBoundingClientRect()
      if (r.bottom > limit) el.style.maxHeight = `${Math.max(120, Math.floor(limit - r.top))}px`
      onRect(el.getBoundingClientRect())
    } finally {
      busy = false
    }
  }
  run()
  const ro = new ResizeObserver(run)
  ro.observe(el)
  window.addEventListener('resize', run)
  const off = formationLab.onRects(run)
  return () => {
    ro.disconnect()
    window.removeEventListener('resize', run)
    off()
    onRect(null)
  }
}
