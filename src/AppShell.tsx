import { NavLink, Outlet } from 'react-router-dom'
import { useLocale } from './i18n/useLocale'
import { useT } from './i18n/useT'
import styles from './AppShell.module.css'

export function AppShell() {
  const { locale, toggleLocale } = useLocale()
  const { t } = useT()

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <NavLink to="/" className={styles.logo} end>
          ATOMLAB
        </NavLink>
        <div className={styles.headerTools}>
          <nav className={styles.nav}>
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
              }
            >
              {t('nav.laboratory')}
            </NavLink>
            <NavLink
              to="/periodic"
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
              }
            >
              {t('nav.periodic')}
            </NavLink>
            <NavLink
              to="/catalog"
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
              }
            >
              {t('nav.catalog')}
            </NavLink>
            <NavLink
              to="/learn"
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
              }
            >
              {t('nav.learn')}
            </NavLink>
          </nav>
          <button
            type="button"
            className={styles.langToggle}
            onClick={toggleLocale}
            title={locale === 'ru' ? t('lang.switchToEn') : t('lang.switchToRu')}
            aria-label={t('lang.toggle', { current: locale.toUpperCase() })}
          >
            <span className={styles.langGlobe} aria-hidden>
              🌐
            </span>
            <span className={styles.langCode}>{locale.toUpperCase()}</span>
          </button>
        </div>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
