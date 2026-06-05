import type { LearnSlide } from '../../types/learn'
import { hasCyberDashboard } from '../../learn/learnCyberDashboard'
import { LearnSlideVisual } from './LearnSlideVisual'
import { LearnVisual3DPanel } from './LearnVisual3DPanel'
import { LearnCyberDashboard } from './topicScenes/LearnCyberDashboard'
import { useT } from '../../i18n/useT'
import styles from '../../pages/LearnPage.module.css'

function resolveCyberSceneId(
  slide: LearnSlide,
  visualId: string | undefined,
  sectionSceneId: string | undefined,
): string | null {
  const candidates = [
    sectionSceneId,
    slide.type === 'interactive3d' ? slide.visualId : undefined,
    visualId,
  ]
  for (const id of candidates) {
    if (id && hasCyberDashboard(id)) return id
  }
  return null
}

export function LearnSlideDeckVisual({
  slide,
  visualId,
  sectionSceneId,
  accent,
  presentationMode,
}: {
  slide: LearnSlide
  visualId: string | undefined
  /** Стабильный id § для 3D-колонки (topic_g7_c1_s01) */
  sectionSceneId?: string
  accent: string
  presentationMode: boolean
}) {
  const { t } = useT()
  const cyberSceneId = resolveCyberSceneId(slide, visualId, sectionSceneId)

  if (cyberSceneId) {
    return (
      <div
        className={`${styles.learnVisual3d} ${styles.learnVisual3dPremium} ${styles.learnVisualCyber} ${
          presentationMode ? styles.learnVisual3dPresent : ''
        }`}
        style={{ ['--learn-accent' as string]: accent }}
      >
        <div className={styles.learnVisualHud}>
          <div className={styles.learnVisualHudLeft}>
            <span className={styles.learnVisualHudBadge}>{t('learn.visual.badge3d')}</span>
            <span className={styles.learnVisualHudLabel}>{t('learn.g7.c1.s01.title')}</span>
          </div>
          <span className={styles.learnVisualHudHint}>{t('learn.visual.cyberHint')}</span>
        </div>
        <div className={styles.learnVisualStage}>
          <LearnCyberDashboard sceneId={cyberSceneId} presentationMode={presentationMode} />
        </div>
        <div className={styles.learnVisualGlow} aria-hidden />
        <div className={styles.learnVisualScanline} aria-hidden />
      </div>
    )
  }
  if (slide.type === 'visual') {
    const inner = (
      <LearnSlideVisual
        titleKey={slide.titleKey}
        bodyKey={slide.bodyKey}
        image={slide.image}
        kenBurns={slide.kenBurns}
        fullscreen={presentationMode}
      />
    )
    if (presentationMode) {
      return <div className={styles.learnSlideDeckPresent}>{inner}</div>
    }
    return inner
  }

  const mount3d = slide.type === 'theory' || slide.type === 'example'
  return (
    <LearnVisual3DPanel
      visualId={visualId}
      fallbackAccent={accent}
      presentationMode={presentationMode}
      mount3d={mount3d && !!visualId}
    />
  )
}
