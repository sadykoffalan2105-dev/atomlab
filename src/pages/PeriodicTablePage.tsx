import { useLayoutEffect, useRef, useState } from 'react'
import { PeriodicTableGrid } from '../components/lab/PeriodicTableGrid'
import { ElementDetailModal } from '../components/lab/ElementDetailModal'
import pageStyles from './PeriodicTablePage.module.css'

/** Полноэкранная таблица: клик по ячейке — карточка со всеми данными элемента. */
export function PeriodicTablePage() {
  const [detailZ, setDetailZ] = useState<number | null>(null)
  const fitRef = useRef<HTMLDivElement | null>(null)
  const innerRef = useRef<HTMLDivElement | null>(null)
  const [showIntro, setShowIntro] = useState(false)

  useLayoutEffect(() => {
    const fit = fitRef.current
    const inner = innerRef.current
    if (!fit || !inner) return

    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

    const compute = () => {
      const aw = Math.max(1, fit.clientWidth)
      const ah = Math.max(1, fit.clientHeight)

      // Note: offsetWidth/Height are not affected by CSS transform scale.
      const nw = Math.max(1, inner.offsetWidth)
      const nh = Math.max(1, inner.offsetHeight)

      const s = Math.min(aw / nw, ah / nh)
      // Allow upscaling to fill the viewport (still strictly fit by min(w,h) ratio).
      const scale = clamp(s, 0.1, 6)
      inner.style.setProperty('--pt-scale', String(scale))
    }

    compute()
    const ro = new ResizeObserver(() => compute())
    ro.observe(fit)
    ro.observe(inner)
    window.addEventListener('resize', compute)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', compute)
    }
  }, [])

  return (
    <div className={pageStyles.page}>
      <div className={pageStyles.introRow}>
        <button
          type="button"
          className={pageStyles.introToggle}
          onClick={() => setShowIntro((v) => !v)}
          aria-expanded={showIntro}
        >
          {showIntro ? 'Скрыть описание' : 'Показать описание'}
        </button>
      </div>
      {showIntro ? (
        <>
          <p className={pageStyles.headIntro}>
            Свойства элементов, в том числе валентность и строение атомов, периодически меняются с ростом заряда ядра.
          </p>
          <p className={pageStyles.lead}>
            Справочная таблица. Нажмите на элемент — откроется окно с полными данными. В лаборатории (⊞) тот же стиль
            связан с 3D-моделью в центре сцены.
          </p>
        </>
      ) : null}
      <div className={pageStyles.tableWrap}>
        <div className={pageStyles.tableFit} ref={fitRef}>
          <div className={pageStyles.tableFitInner} ref={innerRef}>
            <PeriodicTableGrid
              mode="static"
              onPickElement={setDetailZ}
              wrapClassName={pageStyles.ptWrapNoScroll}
            />
          </div>
        </div>
      </div>
      <ElementDetailModal z={detailZ} onClose={() => setDetailZ(null)} />
    </div>
  )
}
