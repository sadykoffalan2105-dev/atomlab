import { useT } from '../../../../../i18n/useT'
import gridStyles from './CyberDashboardGrid.module.css'

export function CyberDashboardHeader() {
  const { t } = useT()
  return (
    <header className={gridStyles.header}>
      <span className={gridStyles.gradeBadge}>{t('learn.g7.c1.s01.cyber.gradeBadge')}</span>
      <h2 className={gridStyles.mainTitle}>{t('learn.g7.c1.s01.cyber.dashboardTitle')}</h2>
      <span className={gridStyles.gradeBadge}>{t('learn.g7.c1.s01.cyber.gradeBadge')}</span>
    </header>
  )
}
