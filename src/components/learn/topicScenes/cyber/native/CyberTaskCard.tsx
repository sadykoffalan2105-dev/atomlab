import type { CyberTaskDef } from '../../../../../learn/learnCyberDashboard'
import { useT } from '../../../../../i18n/useT'
import { CyberTaskViewport } from './CyberTaskViewport'
import gridStyles from './CyberDashboardGrid.module.css'

export function CyberTaskCard({
  task,
  isActive,
  focusedHotspot,
  animate,
  debug,
  composite = false,
  onSelect,
  onHotspotFocus,
  onFullscreen,
}: {
  task: CyberTaskDef
  isActive: boolean
  focusedHotspot: string | null
  animate: boolean
  debug?: boolean
  composite?: boolean
  onSelect: (taskId: string) => void
  onHotspotFocus: (hotspotId: string) => void
  onFullscreen: (taskId: string) => void
}) {
  const { t } = useT()

  return (
    <div
      className={[
        gridStyles.card,
        composite ? gridStyles.cardComposite : '',
        isActive ? gridStyles.cardActive : '',
        composite && isActive ? gridStyles.cardCompositeActive : '',
        debug ? gridStyles.cardDebug : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        gridArea: task.gridArea,
        ['--card-accent' as string]: composite ? '#00ffff' : task.accent,
      }}
      role="button"
      tabIndex={0}
      aria-pressed={isActive}
      aria-label={t(task.titleKey)}
      onClick={() => onSelect(task.id)}
      onDoubleClick={() => onFullscreen(task.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(task.id)
        }
      }}
    >
      <button
        type="button"
        className={gridStyles.expandBtn}
        aria-label={t('learn.g7.c1.s01.cyber.fullscreen')}
        title={t('learn.g7.c1.s01.cyber.fullscreen')}
        onClick={(e) => {
          e.stopPropagation()
          onFullscreen(task.id)
        }}
      >
        ⛶
      </button>
      {composite ? null : (
        <>
          <span className={gridStyles.cardCorners} aria-hidden />
          <span className={gridStyles.cardOrder}>{task.order}</span>
          <span className={gridStyles.cardTitle}>{t(task.titleKey)}</span>
          <CyberTaskViewport
            task={task}
            activeHotspot={focusedHotspot}
            animate={animate}
            onHotspotFocus={onHotspotFocus}
          />
        </>
      )}
    </div>
  )
}
