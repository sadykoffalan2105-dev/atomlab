import { useState } from 'react'
import { getCyberHotspot } from '../../../../../learn/learnCyberHotspots'
import { useT } from '../../../../../i18n/useT'
import { CyberExploreCanvas } from './CyberExploreCanvas'
import overlayStyles from './CyberExploreOverlay.module.css'

export function CyberExploreOverlay({
  taskId,
  hotspotId,
  accent,
  animate,
  onClose,
}: {
  taskId: string
  hotspotId: string
  accent: string
  animate: boolean
  onClose: () => void
}) {
  const { t } = useT()
  const hotspot = getCyberHotspot(taskId, hotspotId)
  const [resetToken, setResetToken] = useState(0)

  if (!hotspot) return null

  return (
    <div
      className={overlayStyles.overlay}
      role="dialog"
      aria-labelledby="cyber-explore-title"
      style={{ ['--cyber-explore-accent' as string]: accent }}
    >
      <div className={overlayStyles.toolbar}>
        <span className={overlayStyles.mode}>{t('learn.g7.c1.s01.cyber.explore.title')}</span>
        <span className={overlayStyles.hint}>{t('learn.g7.c1.s01.cyber.explore.hint')}</span>
        <div className={overlayStyles.actions}>
          <button
            type="button"
            className={overlayStyles.btn}
            onClick={() => setResetToken((n) => n + 1)}
          >
            {t('learn.g7.c1.s01.cyber.explore.reset')}
          </button>
          <button type="button" className={overlayStyles.btnPrimary} onClick={onClose}>
            {t('learn.g7.c1.s01.cyber.explore.back')}
          </button>
        </div>
      </div>
      <div className={overlayStyles.body}>
        <div className={overlayStyles.canvasCol}>
          <CyberExploreCanvas
            taskId={taskId}
            hotspotId={hotspotId}
            animate={animate}
            resetToken={resetToken}
          />
        </div>
        <div className={overlayStyles.meta}>
          <h4 id="cyber-explore-title" className={overlayStyles.title}>
            {t(hotspot.labelKey)}
          </h4>
          <p className={overlayStyles.detail}>{t(hotspot.detailKey)}</p>
        </div>
      </div>
    </div>
  )
}
