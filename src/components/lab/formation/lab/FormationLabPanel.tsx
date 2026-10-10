/**
 * Панель показа «Как образуется» v2 в лаборатории (справа; на телефоне — сверху): этапы, тексты этапа
 * (formationStageText через FormationCaptions), уравнение, ⏮ ⏯ ⏭, скорость, ползунок, «Закрыть».
 * Плюс HUD-карточки (уравнение пути, частицы, решётка) — в правом верхнем углу свободной части 3D-сцены.
 */
import { useLayoutEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { formationPlan } from '../../../../chemistry/formationPlan'
import { compoundById } from '../../../../data/compounds'
import { useT } from '../../../../i18n/useT'
import { FormationHud } from '../FormationHud'
import { FormationCaptions } from '../FormationPanel'
import { formationStoryFor } from '../formationStory'
import type { FormationControl } from '../useFormation'
import { formationLab, useFormationLab } from './formationLabStore'
import { attachPanelValve } from './panelValve'
import styles from './FormationLabPanel.module.css'

const noop = () => {}
const CLOSE = ['Закрыть показ', 'Close the show', 'Koʻrsatuvni yopish'] as const

export default function FormationLabPanel() {
  const s = useFormationLab()
  const { locale, t } = useT()
  const ref = useRef<HTMLDivElement>(null)
  const id = s.id
  const plan = useMemo(() => (id ? formationPlan(id) : null), [id])
  const story = useMemo(() => (id ? formationStoryFor(id) : null), [id])

  // Где панель (сцена вписывается в остаток кадра). Раскладка — CSS (над реактором, в окне); клапан — страховка.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    return attachPanelValve(el, (r) => {
      formationLab.panelRect = r
    })
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
        style={phone && s.canvasTop > 0 ? { top: s.canvasTop + 6 } : undefined}
        data-lab-show-panel=""
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
