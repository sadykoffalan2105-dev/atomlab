/** Панель этапов показа «Как образуется» поверх лаборатории (справа; на телефоне — сверху). */
import { useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useLocale } from '../../../../i18n/useLocale'
import { RouteStagePanel } from './RouteStagePanel'
import { routeLab, useRouteLab } from './routeLabStore'
import { attachPanelValve } from '../lab/panelValve'
import { ROUTE_TEXTS, ROUTE_UI } from './texts/co2Routes'
import styles from './RouteFormation.module.css'

export default function RouteLabPanel() {
  const s = useRouteLab()
  const { locale } = useLocale()
  const L: 0 | 1 | 2 = locale === 'en' ? 1 : locale === 'uz' ? 2 : 0
  const ref = useRef<HTMLDivElement>(null)
  // Раскладка — CSS (над реактором, в окне, как у панели образования); клапан — страховка без интервалов.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    return attachPanelValve(el, (r) => {
      routeLab.panelRect = r
    })
  }, [s.id, s.stages])
  if (!s.id || !s.stages) return null
  const tx = ROUTE_TEXTS[s.id]
  return createPortal(
    <div ref={ref} className={styles.labPanel} data-route-lab={s.id} data-lab-show-panel="" role="region" aria-label={`${ROUTE_UI.heading[L]} · ${tx.title[L]}`}>
      <p className={styles.labTitle}>
        {ROUTE_UI.heading[L]} · {tx.title[L]}
      </p>
      <p className={styles.equation}>{tx.equation}</p>
      <RouteStagePanel
        id={s.id}
        model={{ stages: s.stages }}
        L={L}
        time={s.t}
        playing={s.playing}
        speed={s.speed}
        toggle={routeLab.toggle}
        seek={routeLab.seek}
        replay={routeLab.replay}
        setSpeed={routeLab.setSpeed}
        prev={routeLab.prev}
        next={routeLab.next}
        className={styles.labSide}
      />
    </div>,
    document.body,
  )
}
