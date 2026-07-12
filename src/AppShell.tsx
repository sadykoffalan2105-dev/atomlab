import { NavLink, Outlet } from 'react-router-dom'
import { useEffect } from 'react'
import { IconVrLab } from './components/vrLab/IconVrLab'
import { DesktopUpdateBadge } from './components/desktop/DesktopUpdateBadge'
import { compoundById } from './data/compounds'
import { warmupLabSynthesisInfra } from './lab/labSynthesisWarmup'
import { useLocale } from './i18n/useLocale'
import { useT } from './i18n/useT'
import styles from './AppShell.module.css'

export function AppShell() {
  const { locale, setLocale } = useLocale()
  const { t } = useT()

  useEffect(() => {
    warmupLabSynthesisInfra(Object.values(compoundById))
  }, [])

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
              to="/vr-lab"
              className={({ isActive }) =>
                `${styles.navLink} ${styles.navLinkIcon} ${isActive ? styles.navLinkActive : ''}`
              }
            >
              <IconVrLab size={16} />
              {t('nav.vrLab')}
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
          <DesktopUpdateBadge />
          <div className={styles.langPicker} role="group" aria-label={t('lang.toggle', { current: locale.toUpperCase() })}>
            {(['ru', 'en', 'uz'] as const).map((code) => (
              <button
                key={code}
                type="button"
                className={locale === code ? styles.langBtnActive : styles.langBtn}
                onClick={() => setLocale(code)}
                title={
                  code === 'ru'
                    ? t('lang.switchToRu')
                    : code === 'en'
                      ? t('lang.switchToEn')
                      : t('lang.switchToUz')
                }
                aria-pressed={locale === code}
              >
                {code.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
