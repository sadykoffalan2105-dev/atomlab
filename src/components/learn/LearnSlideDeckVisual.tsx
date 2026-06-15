import type { LearnSlide } from '../../types/learn'
import { hasCyberDashboard } from '../../learn/learnCyberDashboard'
import { LearnCyberDashboard } from './topicScenes/LearnCyberDashboard'
import { useT } from '../../i18n/useT'
import styles from '../../pages/LearnPage.module.css'

function resolveCyberSceneId(
  visualId: string | undefined,
  sectionSceneId: string | undefined,
): string | null {
  for (const id of [sectionSceneId, visualId]) {
    if (id && hasCyberDashboard(id)) return id
  }
  return null
}

/** 3D-колонка: только каталог молекул + тест (без шаблонных слайдов и изометрии). */
export function LearnSlideDeckVisual({
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
  const cyberSceneId = resolveCyberSceneId(visualId, sectionSceneId)

  if (!cyberSceneId) {
    return (
      <div className={styles.learnVisual3d} style={{ ['--learn-accent' as string]: accent }}>
        <p className={styles.learnVisualWebglFallback}>{t('learn.visual.fallback')}</p>
      </div>
    )
  }

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
          <span className={styles.learnVisualHudHint}>{t('learn.visual.cyberHint')}</span>
        </div>
      </div>
      <div className={styles.learnVisualStage}>
        <LearnCyberDashboard sceneId={cyberSceneId} presentationMode={presentationMode} />
      </div>
      <div className={styles.learnVisualGlow} aria-hidden />
      <div className={styles.learnVisualScanline} aria-hidden />
    </div>
  )
}
