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
}: {
  task: CyberTaskDef
  isActive: boolean
  focusedHotspot: string | null
  animate: boolean
  debug?: boolean
  composite?: boolean
  onSelect: (taskId: string) => void
  onHotspotFocus: (hotspotId: string) => void
}) {
  const { t } = useT()

  return (
    <button
      type="button"
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
      aria-pressed={isActive}
      aria-label={t(task.titleKey)}
      onClick={() => onSelect(task.id)}
    >
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
    </button>
  )
}
