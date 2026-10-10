/**
 * Панель показа «Как образуется» v2 в лаборатории (справа; на телефоне — сверху): этапы, тексты этапа
 * (formationStageText через FormationCaptions), уравнение, ⏮ ⏯ ⏭, скорость, ползунок, «Закрыть».
 * Плюс HUD-карточки (уравнение пути, частицы, решётка) — в правом верхнем углу свободной части 3D-сцены.
 */
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { formationPlan } from '../../../../chemistry/formationPlan'
import { compoundById } from '../../../../data/compounds'
import { useT } from '../../../../i18n/useT'
import { FormationHud } from '../FormationHud'
import { FormationCaptions } from '../FormationPanel'
import { formationStoryFor } from '../formationStory'
import type { FormationControl } from '../useFormation'
import { formationLab, useFormationLab } from './formationLabStore'
import styles from './FormationLabPanel.module.css'

const noop = () => {}
const CLOSE = ['Закрыть показ', 'Close the show', 'Koʻrsatuvni yopish'] as const

export default function FormationLabPanel() {
  const s = useFormationLab()
  const { locale, t } = useT()
  const ref = useRef<HTMLDivElement>(null)
  const [maxH, setMaxH] = useState<number | null>(null)
  const id = s.id
  const plan = useMemo(() => (id ? formationPlan(id) : null), [id])
  const story = useMemo(() => (id ? formationStoryFor(id) : null), [id])

  // Где панель (сцена вписывается в остаток кадра) и сколько ей можно вниз — до реактора.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const upd = () => {
      formationLab.panelRect = el.getBoundingClientRect()
      const r = document.querySelector('[data-lab-reactor][data-open="true"]')?.getBoundingClientRect()
      const top = el.getBoundingClientRect().top
      const phone = window.innerWidth <= 760
      const lim = phone ? Math.round(window.innerHeight * 0.36) : Math.round((r && r.height > 0 ? r.top : window.innerHeight) - top - 12)
      setMaxH((p) => (p === lim ? p : Math.max(160, lim)))
    }
    upd()
    const ro = new ResizeObserver(upd)
    ro.observe(el)
    window.addEventListener('resize', upd)
    const iv = window.setInterval(upd, 600)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', upd)
      window.clearInterval(iv)
      formationLab.panelRect = null
    }
  }, [id])

  const control = useMemo<FormationControl>(
    () => ({
      active: true,
      playing: s.playing,
      step: s.step,
      time: s.t,
      total: s.total,
      speed: s.speed,
      clock: formationLab.clock,
      start: noop,
      toggle: formationLab.toggle,
      replay: formationLab.replay,
      close: formationLab.dismiss,
      prev: formationLab.prev,
      next: formationLab.next,
      seek: formationLab.seek,
      setSpeed: formationLab.setSpeed,
    }),
    [s.playing, s.step, s.t, s.total, s.speed],
  )
  if (!id) return null
  const phone = typeof window !== 'undefined' && window.innerWidth <= 760
  const c = compoundById[id]
  const free = s.free
  return createPortal(
    <>
      <div
        ref={ref}
        className={styles.panel}
        style={{ ...(maxH ? { maxHeight: maxH } : null), ...(phone && s.canvasTop > 0 ? { top: s.canvasTop + 6 } : null) }}
        data-formation-lab={id}
        data-formation-lab-mode={s.mode}
        role="region"
        aria-label={`${t('reactor.howForms')} · ${c?.formulaUnicode ?? id}`}
      >
        <div className={styles.head}>
          <p className={styles.title}>
            {t('reactor.howForms')} · <span className={styles.formula}>{c?.formulaUnicode ?? id}</span>
          </p>
          {/* «Закрыть» всегда на виду (на телефоне кнопки показа уходят под прокрутку) — возврат к лаборатории. */}
          <button type="button" className={styles.close} onClick={formationLab.dismiss} aria-label={CLOSE[locale === 'en' ? 1 : locale === 'uz' ? 2 : 0]} title={CLOSE[locale === 'en' ? 1 : locale === 'uz' ? 2 : 0]} data-formation-lab-close="">
            ×
          </button>
        </div>
        {s.stages ? <FormationCaptions compoundId={id} control={control} locale={locale} obtainingSection={t('compound.obtainingSteps')} /> : null}
      </div>
      {free && plan && story ? (
        <div className={styles.hudHost} style={{ left: free.left, top: free.top, width: free.width, height: free.height }} data-formation-lab-hud="">
          <FormationHud key={id} story={story} plan={plan} clock={formationLab.clock} layout={formationLab.hudLayout} />
        </div>
      ) : null}
    </>,
    document.body,
  )
}
