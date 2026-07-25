import { NavLink } from 'react-router-dom'
import { useT } from '../../i18n/useT'
import { prefetchAppRoute } from '../../lab/prefetchAppRoutes'
import styles from './LabDomainTabs.module.css'

/** Переключатель Неорганика | Органика в лаборатории. */
export function LabDomainTabs({ active }: { active: 'inorganic' | 'organic' }) {
  const { t } = useT()
  return (
    <div className={styles.tabs} role="tablist" aria-label={t('lab.domainAria')}>
      <NavLink
        to="/"
        end
        role="tab"
        aria-selected={active === 'inorganic'}
        className={`${styles.tab} ${active === 'inorganic' ? styles.tabActive : ''}`}
      >
        {t('lab.domainInorganic')}
      </NavLink>
      <NavLink
        to="/organic"
        role="tab"
        aria-selected={active === 'organic'}
        className={`${styles.tab} ${active === 'organic' ? styles.tabActive : ''}`}
        onPointerEnter={() => prefetchAppRoute('organic')}
        onFocus={() => prefetchAppRoute('organic')}
      >
        {t('lab.domainOrganic')}
      </NavLink>
    </div>
  )
}
