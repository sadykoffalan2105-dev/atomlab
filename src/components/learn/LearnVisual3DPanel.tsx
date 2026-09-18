import { lazy, Suspense, useId, useState, type ReactNode } from 'react'
import { getLearnVisual } from '../../learn/learnVisualRegistry'
import { compoundById } from '../../data/compounds'
import { getCompoundLocaleStrings } from '../../i18n/compoundLocale'
import { getTopicSceneLabel } from '../../learn/learnTopicSceneDefs'
import { ELEMENTS } from '../../data/elements'
import { elementDisplayName } from '../../data/elementDisplayName'
import type { AppLocale } from '../../i18n/types'
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
import styles from './LearnVisual3DPanel.module.css'

const LearnPremiumCanvas = lazy(() =>
  import('./LearnPremiumScene').then((m) => ({ default: m.LearnPremiumCanvas })),
)

/* ——— Иконки HUD (inline SVG, декоративные) ——— */

function HudIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      {children}
    </svg>
  )
}

function IconDownload() {
  return (
    <HudIcon>
      <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
    </HudIcon>
  )
}

function IconCopy() {
  return (
    <HudIcon>
      <rect x="9" y="9" width="11" height="11" rx="2.5" />
      <path d="M15 9V6.5A2.5 2.5 0 0 0 12.5 4h-6A2.5 2.5 0 0 0 4 6.5v6A2.5 2.5 0 0 0 6.5 15H9" />
    </HudIcon>
  )
}

function IconCheck() {
  return (
    <HudIcon>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </HudIcon>
  )
}

function IconRotate() {
  return (
    <HudIcon>
      <path d="M20 12a8 8 0 1 1-2.35-5.65M20 4v4.5h-4.5" />
    </HudIcon>
  )
}

function IconHand() {
  return (
    <HudIcon>
      <path d="M8 12V6.5a1.5 1.5 0 0 1 3 0V11M11 10V5a1.5 1.5 0 0 1 3 0v6M14 10.5V7a1.5 1.5 0 0 1 3 0v6.5a6.5 6.5 0 0 1-6.5 6.5h-.3a6 6 0 0 1-4.6-2.2L3.5 14.8a1.5 1.5 0 0 1 2.3-1.9L8 15" />
    </HudIcon>
  )
}

/** Иллюстрация пустого состояния (нет WebGL / 3D не смонтировано). */
function FallbackArt() {
  const gid = `v3dArt${useId().replace(/:/g, '')}`
  const paint = `url(#${gid})`
  return (
    <svg className={styles.fallbackArt} viewBox="0 0 80 80" aria-hidden focusable="false">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5b8cff" />
          <stop offset="55%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#d946ef" />
        </linearGradient>
      </defs>
      <circle cx="40" cy="40" r="38" fill={paint} opacity="0.16" />
      <circle cx="40" cy="40" r="37.5" fill="none" stroke={paint} strokeOpacity="0.55" />
      <g fill="none" stroke={paint} strokeWidth="3" strokeLinejoin="round">
        <path d="M40 20 57 29.5v19L40 58l-17-9.5v-19z" />
        <path d="M23 29.5 40 39l17-9.5M40 39v19" />
      </g>
    </svg>
  )
}

function visualLabel(
  spec: LearnVisualSpec | null,
  fallback: string,
  locale: AppLocale,
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
    if (el) {
      const label = elementDisplayName(el, locale)
      return spec.kind === 'diatomic' ? `${el.symbol}₂` : `${el.symbol} · ${label}`
    }
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

  /*
   * Кибер-дашборд (хаб «3D / каталог») — сам по себе полноценная панель кита
   * со своей шапкой. Внешняя HUD-строка дублировала бы заголовок, поэтому здесь
   * рамка «прозрачная»: только контейнер размера (.bare).
   */
  if (visualId && hasCyberDashboard(visualId)) {
    return (
      <div
        className={`${styles.frame} ${styles.cyber} ${styles.bare} ${presentationMode ? styles.present : ''}`}
        style={{ ['--learn-accent' as string]: fallbackAccent }}
      >
        <div className={styles.stage}>
          <LearnCyberDashboard sceneId={visualId} presentationMode={presentationMode} />
        </div>
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

  const frameClass = [styles.frame, presentationMode ? styles.present : ''].filter(Boolean).join(' ')

  const hintText = useCyberDashboard
    ? t('learn.visual.cyberHint')
    : useLifePhotos
      ? t('learn.visual.lifeHint')
      : t('learn.visual.rotateHint')

  /**
   * Шапка. Над живой 3D-сценой подсказка вынесена в плавающую пилюлю (hintInHud=false),
   * в остальных режимах — текстом в шапке.
   */
  const hud = (hintInHud: boolean) => (
    <div className={styles.hud}>
      <div className={styles.hudLeft}>
        <span className={styles.badge}>{t('learn.visual.badge3d')}</span>
        <span className={styles.label} title={label}>
          {label}
        </span>
      </div>
      <div className={styles.hudRight}>
        {hintInHud ? <span className={styles.hudHint}>{hintText}</span> : null}
        {topicSceneId ? (
          <>
            <a
              className={styles.hudBtn}
              href={`/learn/posters/${topicSceneId}.png`}
              download={`${topicSceneId}.png`}
            >
              <IconDownload />
              {t('learn.visual.downloadPoster')}
            </a>
            <button
              type="button"
              className={`${styles.hudBtn} ${copiedPrompt ? styles.hudBtnDone : ''}`}
              onClick={copyNanoBanana}
            >
              {copiedPrompt ? <IconCheck /> : <IconCopy />}
              {copiedPrompt ? '✓' : t('learn.visual.copyNanoBanana')}
            </button>
          </>
        ) : null}
        {spec && canAutoRotate && webglOk && mount3d ? (
          <button
            type="button"
            className={`${styles.hudBtn} ${autoRotate ? styles.hudBtnOn : ''}`}
            onClick={() => setAutoRotate((v) => !v)}
            aria-pressed={autoRotate}
          >
            <IconRotate />
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
        {hud(true)}
        <div className={styles.stage}>
          <LearnIllustrationBoard
            artId={artId}
            accent={accent}
            title={t('learn.visual.illusTitle')}
            subtitle={t('learn.visual.illusSub')}
          />
        </div>
        <div className={styles.scanline} aria-hidden />
      </div>
    )
  }

  if (useCyberDashboard && cyberSceneId) {
    return (
      <div
        className={`${frameClass} ${styles.cyber} ${styles.bare}`}
        style={{ ['--learn-accent' as string]: accent }}
      >
        <div className={styles.stage}>
          <LearnCyberDashboard sceneId={cyberSceneId} presentationMode={presentationMode} />
        </div>
      </div>
    )
  }

  const lifeStage = useLifePhotos && topicSceneId ? (
    <LearnTopicLifeScene sceneId={topicSceneId} presentationMode={presentationMode} />
  ) : null

  if (useLifePhotos && lifeStage) {
    return (
      <div
        className={`${frameClass} ${styles.life}`}
        style={{ ['--learn-accent' as string]: accent }}
      >
        {hud(true)}
        <div className={styles.stage}>{lifeStage}</div>
        <div className={styles.glow} aria-hidden />
      </div>
    )
  }

  if (!mount3d) {
    return (
      <div className={frameClass} style={{ ['--learn-accent' as string]: accent }}>
        {hud(true)}
        <div className={styles.stage}>
          {topicSceneId ? (
            <LearnPosterFallback sceneId={topicSceneId} label={label} />
          ) : (
            <div className={styles.fallback}>
              <FallbackArt />
              {t('learn.visual.fallback')}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (!webglOk) {
    return (
      <div className={frameClass} style={{ ['--learn-accent' as string]: accent }}>
        {hud(true)}
        <div className={styles.stage}>
          {topicSceneId ? (
            <LearnPosterFallback sceneId={topicSceneId} label={label} />
          ) : (
            <div className={styles.fallback}>
              <FallbackArt />
              {t('catalog.webglUnavailable')}
            </div>
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
      {hud(false)}
      <div className={styles.stage}>
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
        <p className={styles.floatHint}>
          <IconHand />
          <span className={styles.floatHintText}>{hintText}</span>
        </p>
      </div>
      <div className={styles.glow} aria-hidden />
      <div className={styles.scanline} aria-hidden />
    </div>
  )
}
