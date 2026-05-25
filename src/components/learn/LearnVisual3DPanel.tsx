import { useState } from 'react'
import { getLearnVisual } from '../../learn/learnVisualRegistry'
import { getTopicSceneLabel } from '../../learn/learnTopicSceneDefs'
import type { LearnTopicArtId, LearnVisualSpec } from '../../types/learn'
import { useT } from '../../i18n/useT'
import { isWebGLAvailable } from '../../utils/webgl'
import { CanvasErrorBoundary } from '../common/CanvasErrorBoundary'
import { CanvasSceneErrorFallback } from '../common/CanvasSceneErrorFallback'
import { LearnIllustrationBoard } from './LearnIllustrationBoard'
import { LearnPremiumCanvas } from './LearnPremiumScene'
import styles from '../../pages/LearnPage.module.css'

function visualLabel(spec: LearnVisualSpec | null, fallback: string): string {
  if (!spec) return fallback
  if (spec.kind === 'topicScene') {
    return getTopicSceneLabel(spec.sceneId)
  }
  return spec.id
}

export function LearnVisual3DPanel({
  visualId,
  fallbackAccent = '#3dffec',
  presentationMode = false,
}: {
  visualId: string | undefined
  fallbackAccent?: string
  presentationMode?: boolean
}) {
  const { t } = useT()
  const [autoRotate, setAutoRotate] = useState(true)
  const spec = getLearnVisual(visualId)
  const webglOk = isWebGLAvailable()

  const accent = fallbackAccent

  const label = visualLabel(spec, t('learn.visual.fallback'))

  const isTopic3d = spec?.kind === 'topicScene'

  const frameClass = [
    styles.learnVisual3d,
    presentationMode ? styles.learnVisual3dPresent : '',
    styles.learnVisual3dPremium,
  ]
    .filter(Boolean)
    .join(' ')

  const hud = (
    <div className={styles.learnVisualHud}>
      <div className={styles.learnVisualHudLeft}>
        <span className={styles.learnVisualHudBadge}>{t('learn.visual.badge3d')}</span>
        <span className={styles.learnVisualHudLabel}>{label}</span>
      </div>
      <div className={styles.learnVisualHudRight}>
        <span className={styles.learnVisualHudHint}>{t('learn.visual.rotateHint')}</span>
        {spec && isTopic3d && webglOk ? (
          <button
            type="button"
            className={styles.learnVisualHudBtn}
            onClick={() => setAutoRotate((v) => !v)}
            aria-pressed={autoRotate}
          >
            {autoRotate ? t('learn.visual.autoOn') : t('learn.visual.autoOff')}
          </button>
        ) : null}
      </div>
    </div>
  )

  if (!spec || spec.kind === 'svgFallback') {
    const artId = (spec?.kind === 'svgFallback' ? spec.artId : 'periodicity') as LearnTopicArtId
    return (
      <div className={frameClass} style={{ ['--learn-accent' as string]: accent }}>
        {hud}
        <div className={styles.learnVisualStage}>
          <LearnIllustrationBoard
            artId={artId}
            accent={accent}
            title={t('learn.visual.illusTitle')}
            subtitle={t('learn.visual.illusSub')}
          />
        </div>
        <div className={styles.learnVisualScanline} aria-hidden />
      </div>
    )
  }

  if (!webglOk) {
    return (
      <div className={frameClass} style={{ ['--learn-accent' as string]: accent }}>
        {hud}
        <div className={styles.learnVisualWebglFallback}>{t('catalog.webglUnavailable')}</div>
      </div>
    )
  }

  return (
    <div
      className={frameClass}
      style={{ ['--learn-accent' as string]: accent, ['--learn-auto' as string]: autoRotate ? '1' : '0' }}
    >
      {hud}
      <div className={styles.learnVisualStage}>
        <CanvasErrorBoundary fallback={<CanvasSceneErrorFallback />}>
          <LearnPremiumCanvas spec={spec} autoRotate={autoRotate} />
        </CanvasErrorBoundary>
      </div>
      <div className={styles.learnVisualGlow} aria-hidden />
      <div className={styles.learnVisualScanline} aria-hidden />
    </div>
  )
}
