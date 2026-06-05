import { lazy, Suspense, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { CyberTaskDef } from '../../../../learn/learnCyberDashboard'
import type { CyberGameDef } from '../../../../learn/learnCyberGames'
import { useT } from '../../../../i18n/useT'
import { LearnAssistantMarkdown } from '../../LearnAssistantMarkdown'
import { CyberTaskViewport } from './native/CyberTaskViewport'
import styles from './CyberTaskFullscreen.module.css'

const CyberExploreOverlay = lazy(() =>
  import('./explore/CyberExploreOverlay').then((m) => ({ default: m.CyberExploreOverlay })),
)

const CyberGameOverlay = lazy(() =>
  import('./games/CyberGameOverlay').then((m) => ({ default: m.CyberGameOverlay })),
)

function bodyParagraphs(text: string): string[] {
  return text.split(/\n\n+/).filter((p) => p.trim().length > 0)
}

export function CyberTaskFullscreen({
  task,
  explore,
  game,
  onClose,
  onHotspotFocus,
  onCloseExplore,
  onPlayGame,
  onCloseGame,
}: {
  task: CyberTaskDef
  explore: { taskId: string; hotspotId: string } | null
  game: CyberGameDef | null
  onClose: () => void
  onHotspotFocus: (hotspotId: string) => void
  onCloseExplore: () => void
  onPlayGame: () => void
  onCloseGame: () => void
}) {
  const { t } = useT()

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  return createPortal(
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cyber-fs-title"
      style={{ ['--fs-accent' as string]: task.accent }}
    >
      <header className={styles.toolbar}>
        <span className={styles.order}>{task.order}</span>
        <h2 id="cyber-fs-title" className={styles.title}>
          {t(task.titleKey)}
        </h2>
        <div className={styles.toolbarActions}>
          {game ? null : (
            <button type="button" className={styles.btnPrimary} onClick={onPlayGame}>
              {t('learn.g7.c1.s01.game.play')}
            </button>
          )}
          <button type="button" className={styles.btn} onClick={onClose}>
            {t('learn.g7.c1.s01.cyber.fullscreenClose')}
          </button>
        </div>
      </header>

      <div className={styles.layout}>
        <main className={styles.scene}>
          <div className={styles.viewportWrap}>
            <CyberTaskViewport
              task={task}
              activeHotspot={explore?.taskId === task.id ? explore.hotspotId : null}
              animate
              onHotspotFocus={onHotspotFocus}
            />
          </div>
          {explore && explore.taskId === task.id ? (
            <Suspense fallback={null}>
              <CyberExploreOverlay
                taskId={explore.taskId}
                hotspotId={explore.hotspotId}
                accent={task.accent}
                animate
                onClose={onCloseExplore}
              />
            </Suspense>
          ) : null}
          {game ? (
            <Suspense fallback={null}>
              <CyberGameOverlay game={game} accent={task.accent} onClose={onCloseGame} />
            </Suspense>
          ) : null}
        </main>

        <aside className={styles.sidebar}>
          <div className={styles.sidebarAccent} aria-hidden />
          <div className={styles.body}>
            {bodyParagraphs(t(task.bodyKey)).map((para) => (
              <div key={para.slice(0, 32)} className={styles.para}>
                <LearnAssistantMarkdown text={para} />
              </div>
            ))}
            {!game ? (
              <button type="button" className={styles.playBtn} onClick={onPlayGame}>
                {t('learn.g7.c1.s01.game.play')}
              </button>
            ) : null}
          </div>
        </aside>
      </div>
    </div>,
    document.body,
  )
}
