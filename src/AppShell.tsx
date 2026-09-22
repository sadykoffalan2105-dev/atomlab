import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { IconVrLab } from './components/vrLab/IconVrLab'
import { DesktopUpdateBadge } from './components/desktop/DesktopUpdateBadge'
import { compoundById } from './data/compounds'
import { warmupLabSynthesisInfra } from './lab/labSynthesisWarmup'
import { prefetchAppRoutes, prefetchRouteForPath } from './lab/prefetchAppRoutes'
import { useLocale } from './i18n/useLocale'
import { useT } from './i18n/useT'
import { AppThemeToggle } from './theme/AppThemeToggle'
import styles from './AppShell.module.css'

type IconProps = { className?: string }

function IconLogo({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden>
      <ellipse cx="16" cy="16" rx="12.5" ry="5" stroke="currentColor" strokeWidth="1.6" transform="rotate(30 16 16)" />
      <ellipse cx="16" cy="16" rx="12.5" ry="5" stroke="currentColor" strokeWidth="1.6" transform="rotate(-30 16 16)" opacity="0.75" />
      <ellipse cx="16" cy="16" rx="12.5" ry="5" stroke="currentColor" strokeWidth="1.6" transform="rotate(90 16 16)" opacity="0.5" />
      <circle cx="16" cy="16" r="3" fill="currentColor" />
    </svg>
  )
}

function IconFlask({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M7.5 2.5h5M8.3 2.5v4.4L3.9 14.6a1.9 1.9 0 0 0 1.7 2.9h8.8a1.9 1.9 0 0 0 1.7-2.9l-4.4-7.7V2.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M6 12h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.6" />
    </svg>
  )
}

function IconGrid({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="2.5" y="3" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="13.5" y="3" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="2.5" y="9" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="8" y="9" width="4" height="4" rx="1" fill="currentColor" opacity="0.85" />
      <rect x="13.5" y="9" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <path d="M4 16h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.6" />
    </svg>
  )
}

function IconCatalog({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M4 3.5h9.5A2.5 2.5 0 0 1 16 6v10.5H6.5A2.5 2.5 0 0 1 4 14V3.5z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="8.6" cy="9.4" r="1.4" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="12" cy="7.4" r="1" fill="currentColor" />
      <circle cx="12" cy="11.6" r="1" fill="currentColor" />
      <path d="M9.8 8.8 11.2 8M9.8 10l1.4.9" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}

function IconLearn({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="m10 3.5 8 4-8 4-8-4 8-4z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M5.2 9.3v3.9c0 1.2 2.2 2.3 4.8 2.3s4.8-1.1 4.8-2.3V9.3" stroke="currentColor" strokeWidth="1.4" />
      <path d="M18 7.5v4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function AppShell() {
  const { locale, setLocale } = useLocale()
  const { t } = useT()
  const { pathname } = useLocation()
  const navRef = useRef<HTMLElement | null>(null)

  /* Телефон: навигация прокручивается по горизонтали — держим активную вкладку в поле зрения. */
  useLayoutEffect(() => {
    const nav = navRef.current
    if (!nav || nav.scrollWidth <= nav.clientWidth + 1) return
    if (typeof window.matchMedia === 'function' && !window.matchMedia('(max-width: 720px)').matches) return
    const active = nav.querySelector<HTMLElement>('[aria-current="page"]')
    if (!active) return
    const delta = active.getBoundingClientRect().left - nav.getBoundingClientRect().left - 12
    nav.scrollLeft += delta
  }, [pathname])

  useEffect(() => {
    warmupLabSynthesisInfra(Object.values(compoundById))
    // Повторно (на случай если boot уже прошёл) — вкладки открываются с первого клика.
    let idleId: number | undefined
    let timeoutId: number | undefined
    if (typeof requestIdleCallback === 'function') {
      idleId = requestIdleCallback(() => prefetchAppRoutes(), { timeout: 1800 })
    } else {
      timeoutId = window.setTimeout(() => prefetchAppRoutes(), 400)
    }
    return () => {
      if (idleId != null && typeof cancelIdleCallback === 'function') {
        cancelIdleCallback(idleId)
      }
      if (timeoutId != null) window.clearTimeout(timeoutId)
    }
  }, [])

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <NavLink to="/" className={styles.logo} end aria-label="ATOMLAB">
          <span className={styles.logoMark} aria-hidden>
            <IconLogo className={styles.logoIcon} />
          </span>
          <span className={styles.logoText}>ATOMLAB</span>
        </NavLink>
        <div className={styles.headerTools}>
          <nav className={styles.nav} ref={navRef}>
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `${styles.navLink} ${styles.navLinkIcon} ${isActive ? styles.navLinkActive : ''}`
              }
            >
              <IconFlask className={styles.navIcon} />
              {t('nav.laboratory')}
            </NavLink>
            <NavLink
              to="/vr-lab"
              onPointerEnter={() => prefetchRouteForPath('/vr-lab')}
              onFocus={() => prefetchRouteForPath('/vr-lab')}
              className={({ isActive }) =>
                `${styles.navLink} ${styles.navLinkIcon} ${isActive ? styles.navLinkActive : ''}`
              }
            >
              <IconVrLab size={18} />
              {t('nav.vrLab')}
            </NavLink>
            <NavLink
              to="/periodic"
              onPointerEnter={() => prefetchRouteForPath('/periodic')}
              onFocus={() => prefetchRouteForPath('/periodic')}
              className={({ isActive }) =>
                `${styles.navLink} ${styles.navLinkIcon} ${isActive ? styles.navLinkActive : ''}`
              }
            >
              <IconGrid className={styles.navIcon} />
              {t('nav.periodic')}
            </NavLink>
            <NavLink
              to="/catalog"
              onPointerEnter={() => prefetchRouteForPath('/catalog')}
              onFocus={() => prefetchRouteForPath('/catalog')}
              className={({ isActive }) =>
                `${styles.navLink} ${styles.navLinkIcon} ${isActive ? styles.navLinkActive : ''}`
              }
            >
              <IconCatalog className={styles.navIcon} />
              {t('nav.catalog')}
            </NavLink>
            <NavLink
              to="/learn"
              onPointerEnter={() => prefetchRouteForPath('/learn')}
              onFocus={() => prefetchRouteForPath('/learn')}
              className={({ isActive }) =>
                `${styles.navLink} ${styles.navLinkIcon} ${isActive ? styles.navLinkActive : ''}`
              }
            >
              <IconLearn className={styles.navIcon} />
              {t('nav.learn')}
            </NavLink>
          </nav>
          <div className={styles.updateSlot}>
            <DesktopUpdateBadge />
          </div>
          {/* Собственная ячейка: на телефоне .headerTools раскладывается сеткой
              (display: contents), и без явного места тумблер уезжал в новый ряд. */}
          <div className={styles.themeSlot}>
            <AppThemeToggle />
          </div>
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
