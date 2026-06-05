import type { CyberDashboardDef } from '../../../../../learn/learnCyberDashboard'
import { CyberDashboardHeader } from './CyberDashboardHeader'
import { CyberLabEnvironment } from './CyberLabEnvironment'
import { CyberTaskCard } from './CyberTaskCard'
import gridStyles from './CyberDashboardGrid.module.css'

export function CyberDashboardGrid({
  def,
  activeId,
  explore,
  animate,
  debug,
  onSelect,
  onHotspotFocus,
  onFullscreen,
}: {
  def: CyberDashboardDef
  activeId: string | null
  explore: { taskId: string; hotspotId: string } | null
  animate: boolean
  debug?: boolean
  onSelect: (taskId: string) => void
  onHotspotFocus: (taskId: string, hotspotId: string) => void
  onFullscreen: (taskId: string) => void
}) {
  const composite = def.visualMode === 'composite' && def.reference != null
  const ref = def.reference

  const boardClass = [gridStyles.board, composite ? gridStyles.boardComposite : '']
    .filter(Boolean)
    .join(' ')

  const hitGridStyle =
    composite && ref
      ? {
          top: `${ref.gridInset.top}%`,
          right: `${ref.gridInset.right}%`,
          bottom: `${ref.gridInset.bottom}%`,
          left: `${ref.gridInset.left}%`,
        }
      : undefined

  return (
    <div
      className={boardClass}
      style={
        composite && ref
          ? { ['--cyber-ref-aspect' as string]: String(ref.aspect) }
          : undefined
      }
    >
      {composite && ref ? (
        <picture className={gridStyles.refPicture} aria-hidden>
          {ref.src2x ? (
            <source srcSet={ref.src2x} media="(min-resolution: 1.5dppx), (min-width: 900px)" type="image/webp" />
          ) : null}
          <img className={gridStyles.refImg} src={ref.src} alt="" draggable={false} decoding="async" />
        </picture>
      ) : (
        <CyberLabEnvironment />
      )}

      {!composite ? <CyberDashboardHeader /> : null}

      <div
        className={composite ? gridStyles.hitGrid : gridStyles.grid}
        style={hitGridStyle}
      >
        {def.tasks.map((task) => (
          <CyberTaskCard
            key={task.id}
            task={task}
            isActive={activeId === task.id}
            focusedHotspot={
              explore?.taskId === task.id ? explore.hotspotId : null
            }
            animate={animate}
            debug={debug}
            composite={composite}
            onSelect={onSelect}
            onHotspotFocus={(hotspotId) => onHotspotFocus(task.id, hotspotId)}
            onFullscreen={onFullscreen}
          />
        ))}
      </div>
    </div>
  )
}
