import type { CyberTaskDef } from '../../../../../learn/learnCyberDashboard'
import { useT } from '../../../../../i18n/useT'
import { CyberTaskSceneSvg } from './CyberTaskSceneSvg'
import vpStyles from './CyberTaskViewport.module.css'

export function CyberTaskViewport({
  task,
  activeHotspot,
  animate,
  onHotspotFocus,
}: {
  task: CyberTaskDef
  activeHotspot: string | null
  animate: boolean
  onHotspotFocus: (hotspotId: string) => void
}) {
  const { t } = useT()

  return (
    <div className={vpStyles.viewport}>
      <CyberTaskSceneSvg
        task={task}
        activeHotspot={activeHotspot}
        animate={animate}
        onHotspotFocus={onHotspotFocus}
      />
      <p className={vpStyles.hint}>{t('learn.g7.c1.s01.cyber.explore.tap')}</p>
    </div>
  )
}
