import { lazy, Suspense, useState } from 'react'
import { getLearnVisual } from '../../learn/learnVisualRegistry'
import { compoundById } from '../../data/compounds'
import { getCompoundLocaleStrings } from '../../i18n/compoundLocale'
import { getTopicSceneLabel } from '../../learn/learnTopicSceneDefs'
import { ELEMENTS } from '../../data/elements'
import { buildNanoBananaPrompt } from '../../learn/learnNanoBananaPrompts'
import type { LearnTopicArtId, LearnVisualSpec } from '../../types/learn'
import { useT } from '../../i18n/useT'
import { isWebGLAvailable } from '../../utils/webgl'
import { CanvasErrorBoundary } from '../common/CanvasErrorBoundary'
import { CanvasSceneErrorFallback } from '../common/CanvasSceneErrorFallback'
import { LearnPosterFallback } from './LearnPosterFallback'
import { LearnIllustrationBoard } from './LearnIllustrationBoard'
import { LearnTopicLifeScene } from './topicScenes/LearnTopicLifeScene'
import { LearnCyberDashboard } from './topicScenes/LearnCyberDashboard'
import { hasLifeScenePhotos } from '../../learn/learnTopicLifePhotos'
import { hasCyberDashboard } from '../../learn/learnCyberDashboard'
import styles from '../../pages/LearnPage.module.css'

const LearnPremiumCanvas = lazy(() =>
  import('./LearnPremiumScene').then((m) => ({ default: m.LearnPremiumCanvas })),
)

function visualLabel(
  spec: LearnVisualSpec | null,
  fallback: string,
  locale: 'ru' | 'en' | 'uz',
  t: (key: import('../../i18n/messagesRu').MessageKey) => string,
): string {
  if (!spec) return fallback
  if (spec.kind === 'topicScene') return getTopicSceneLabel(spec.sceneId)
  if (spec.kind === 'molecule') {
    const c = compoundById[spec.compoundId]
    if (c) return `${c.formulaUnicode} · ${getCompoundLocaleStrings(c, locale, t).name}`
  }
  if (spec.kind === 'diatomic' || spec.kind === 'atom' || spec.kind === 'element') {
    const el = ELEMENTS.find((e) => e.z === spec.z)
    if (el) return spec.kind === 'diatomic' ? `${el.symbol}₂` : `${el.symbol} · ${el.nameRu}`
    return spec.kind === 'diatomic' ? `diatomic:${spec.z}` : `Z=${spec.z}`
  }
  return spec.id
}

export function LearnVisual3DPanel({
  visualId,
  fallbackAccent = '#3dffec',
  presentationMode = false,
  mount3d = true,
}: {
  visualId: string | undefined
  fallbackAccent?: string
  presentationMode?: boolean
  /** Монтировать WebGL только когда true (lazy на interactive3d слайде) */
  mount3d?: boolean
}) {
  const { t, locale } = useT()
  const [autoRotate, setAutoRotate] = useState(true)
  const [copiedPrompt, setCopiedPrompt] = useState(false)

  if (visualId && hasCyberDashboard(visualId)) {
    return (
      <div
        className={`${styles.learnVisual3d} ${styles.learnVisual3dPremium} ${styles.learnVisualCyber} ${
          presentationMode ? styles.learnVisual3dPresent : ''
        }`}
        style={{ ['--learn-accent' as string]: fallbackAccent }}
      >
        <div className={styles.learnVisualHud}>
          <div className={styles.learnVisualHudLeft}>
            <span className={styles.learnVisualHudBadge}>{t('learn.visual.badge3d')}</span>
            <span className={styles.learnVisualHudHint}>{t('learn.visual.cyberHint')}</span>
          </div>
        </div>
        <div className={styles.learnVisualStage}>
          <LearnCyberDashboard sceneId={visualId} presentationMode={presentationMode} />
        </div>
        <div className={styles.learnVisualGlow} aria-hidden />
      </div>
    )
  }

  const spec = getLearnVisual(visualId)
  const webglOk = isWebGLAvailable()
  const topicSceneId = spec?.kind === 'topicScene' ? spec.sceneId : undefined
  const cyberSceneId =
    visualId && hasCyberDashboard(visualId)
      ? visualId
      : topicSceneId && hasCyberDashboard(topicSceneId)
        ? topicSceneId
        : undefined
  const useCyberDashboard = Boolean(cyberSceneId)
  const useLifePhotos = Boolean(
    topicSceneId && !useCyberDashboard && hasLifeScenePhotos(topicSceneId),
  )

  const accent = fallbackAccent
  const label = visualLabel(spec, t('learn.visual.fallback'), locale, t)

  const copyNanoBanana = () => {
    if (!topicSceneId) return
    const prompt = buildNanoBananaPrompt(topicSceneId)
    void navigator.clipboard.writeText(prompt).then(() => {
      setCopiedPrompt(true)
      window.setTimeout(() => setCopiedPrompt(false), 2000)
    })
  }

  const canAutoRotate =
    (spec?.kind === 'topicScene' && !useLifePhotos && !useCyberDashboard) ||
    spec?.kind === 'molecule' ||
    spec?.kind === 'diatomic' ||
    spec?.kind === 'atom' ||
    spec?.kind === 'element' ||
    spec?.kind === 'bond' ||
    spec?.kind === 'electrolysis'

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
        <span className={styles.learnVisualHudHint}>
          {useCyberDashboard
            ? t('learn.visual.cyberHint')
            : useLifePhotos
              ? t('learn.visual.lifeHint')
              : t('learn.visual.rotateHint')}
        </span>
        {topicSceneId ? (
          <>
            <a
              className={styles.learnVisualHudBtn}
              href={`/learn/posters/${topicSceneId}.png`}
              download={`${topicSceneId}.png`}
            >
              {t('learn.visual.downloadPoster')}
            </a>
            <button type="button" className={styles.learnVisualHudBtn} onClick={copyNanoBanana}>
              {copiedPrompt ? '✓' : t('learn.visual.copyNanoBanana')}
            </button>
          </>
        ) : null}
        {spec && canAutoRotate && webglOk && mount3d ? (
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

  if (useCyberDashboard && cyberSceneId) {
    return (
      <div
        className={`${frameClass} ${styles.learnVisualCyber}`}
        style={{ ['--learn-accent' as string]: accent }}
      >
        {hud}
        <div className={styles.learnVisualStage}>
          <LearnCyberDashboard sceneId={cyberSceneId} presentationMode={presentationMode} />
        </div>
        <div className={styles.learnVisualGlow} aria-hidden />
        <div className={styles.learnVisualScanline} aria-hidden />
      </div>
    )
  }

  const lifeStage = useLifePhotos && topicSceneId ? (
    <LearnTopicLifeScene sceneId={topicSceneId} presentationMode={presentationMode} />
  ) : null

  if (useLifePhotos && lifeStage) {
    return (
      <div
        className={`${frameClass} ${styles.learnVisualLife}`}
        style={{ ['--learn-accent' as string]: accent }}
      >
        {hud}
        <div className={styles.learnVisualStage}>{lifeStage}</div>
        <div className={styles.learnVisualGlow} aria-hidden />
      </div>
    )
  }

  if (!mount3d) {
    return (
      <div className={frameClass} style={{ ['--learn-accent' as string]: accent }}>
        {hud}
        <div className={styles.learnVisualStage}>
          {topicSceneId ? (
            <LearnPosterFallback sceneId={topicSceneId} label={label} />
          ) : (
            <div className={styles.learnVisualWebglFallback}>{t('learn.visual.fallback')}</div>
          )}
        </div>
      </div>
    )
  }

  if (!webglOk) {
    return (
      <div className={frameClass} style={{ ['--learn-accent' as string]: accent }}>
        {hud}
        <div className={styles.learnVisualStage}>
          {topicSceneId ? (
            <LearnPosterFallback sceneId={topicSceneId} label={label} />
          ) : (
            <div className={styles.learnVisualWebglFallback}>{t('catalog.webglUnavailable')}</div>
          )}
        </div>
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
        <CanvasErrorBoundary
          fallback={
            topicSceneId ? (
              <LearnPosterFallback sceneId={topicSceneId} label={label} />
            ) : (
              <CanvasSceneErrorFallback />
            )
          }
        >
          <Suspense fallback={<LearnPosterFallback sceneId={topicSceneId ?? 'topic_g7_c1_s01'} label={label} />}>
            <LearnPremiumCanvas spec={spec} autoRotate={autoRotate} />
          </Suspense>
        </CanvasErrorBoundary>
      </div>
      <div className={styles.learnVisualGlow} aria-hidden />
      <div className={styles.learnVisualScanline} aria-hidden />
    </div>
  )
}
