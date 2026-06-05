import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getCyberDashboard } from '../../../learn/learnCyberDashboard'
import { getCyberGameForTask } from '../../../learn/learnCyberGames'
import { useT } from '../../../i18n/useT'
import { LearnAssistantMarkdown } from '../LearnAssistantMarkdown'
import { CyberDashboardGrid } from './cyber/native/CyberDashboardGrid'
import styles from './LearnCyberDashboard.module.css'

const CyberExploreOverlay = lazy(() =>
  import('./cyber/explore/CyberExploreOverlay').then((m) => ({
    default: m.CyberExploreOverlay,
  })),
)

const CyberGameOverlay = lazy(() =>
  import('./cyber/games/CyberGameOverlay').then((m) => ({
    default: m.CyberGameOverlay,
  })),
)

function bodyParagraphs(text: string): string[] {
  return text.split(/\n\n+/).filter((p) => p.trim().length > 0)
}

export function LearnCyberDashboard({
  sceneId,
  presentationMode = false,
}: {
  sceneId: string
  presentationMode?: boolean
}) {
  const { t } = useT()
  const def = useMemo(() => getCyberDashboard(sceneId), [sceneId])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [explore, setExplore] = useState<{ taskId: string; hotspotId: string } | null>(null)
  const [gameTaskId, setGameTaskId] = useState<string | null>(null)
  const [searchParams] = useSearchParams()
  const cyberDebug = searchParams.get('cyberDebug') === '1'

  const activeTask = def?.tasks.find((task) => task.id === activeId) ?? null
  const exploreTask = def?.tasks.find((task) => task.id === explore?.taskId) ?? null
  const gameTask = def?.tasks.find((task) => task.id === gameTaskId) ?? null
  const activeGame = gameTaskId ? getCyberGameForTask(gameTaskId) : null

  const closePanel = useCallback(() => setActiveId(null), [])
  const closeExplore = useCallback(() => setExplore(null), [])
  const closeGame = useCallback(() => setGameTaskId(null), [])

  const onSelect = useCallback((taskId: string) => {
    setActiveId((prev) => (prev === taskId ? null : taskId))
  }, [])

  const onHotspotFocus = useCallback((taskId: string, hotspotId: string) => {
    setActiveId(taskId)
    setExplore({ taskId, hotspotId })
  }, [])

  useEffect(() => {
    if (!activeId && !explore && !gameTaskId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (gameTaskId) closeGame()
      else if (explore) closeExplore()
      else closePanel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeId, explore, gameTaskId, closePanel, closeExplore, closeGame])

  if (!def) return null

  /** Схемы и 3D всегда «живые» — без ожидания клика и без reduced-motion */
  const cardAnimate = true
  const exploreAnimate = true
  const panelAccent = activeTask?.accent ?? exploreTask?.accent ?? '#3dffec'

  const rootClass = [
    styles.root,
    activeId ? styles.rootWithPanel : '',
    explore ? styles.rootWithExplore : '',
    gameTaskId ? styles.rootWithGame : '',
    presentationMode ? styles.present : '',
    cyberDebug ? styles.rootDebug : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={rootClass} style={{ ['--cyber-panel-accent' as string]: panelAccent }}>
      <div className={styles.stage}>
        <CyberDashboardGrid
          def={def}
          activeId={activeId}
          explore={explore}
          animate={cardAnimate}
          debug={cyberDebug}
          onSelect={onSelect}
          onHotspotFocus={onHotspotFocus}
        />
        {explore ? (
          <Suspense fallback={<div className={styles.exploreLoading} aria-busy />}>
            <CyberExploreOverlay
              taskId={explore.taskId}
              hotspotId={explore.hotspotId}
              accent={exploreTask?.accent ?? '#3dffec'}
              animate={exploreAnimate}
              onClose={closeExplore}
            />
          </Suspense>
        ) : null}
        {activeGame ? (
          <Suspense fallback={<div className={styles.exploreLoading} aria-busy />}>
            <CyberGameOverlay
              game={activeGame}
              accent={gameTask?.accent ?? '#3dffec'}
              onClose={closeGame}
            />
          </Suspense>
        ) : null}
      </div>

      {activeTask ? (
        <aside
          className={styles.panel}
          role="dialog"
          aria-labelledby="cyber-panel-title"
          key={activeTask.id}
        >
          <div className={styles.panelAccentBar} aria-hidden />
          <div className={styles.panelHead}>
            <span className={styles.panelOrder}>{activeTask.order}</span>
            <h3 id="cyber-panel-title" className={styles.panelTitle}>
              {t(activeTask.titleKey)}
            </h3>
            <button type="button" className={styles.closeBtn} onClick={closePanel}>
              {t('learn.g7.c1.s01.cyber.close')}
            </button>
          </div>
          <div className={styles.panelBody}>
            {bodyParagraphs(t(activeTask.bodyKey)).map((para) => (
              <div key={para.slice(0, 32)} className={styles.panelPara}>
                <LearnAssistantMarkdown text={para} />
              </div>
            ))}
            {getCyberGameForTask(activeTask.id) ? (
              <button
                type="button"
                className={styles.playBtn}
                onClick={() => {
                  setGameTaskId(activeTask.id)
                  setExplore(null)
                }}
              >
                {t('learn.g7.c1.s01.game.play')}
              </button>
            ) : null}
          </div>
        </aside>
      ) : null}
    </div>
  )
}
