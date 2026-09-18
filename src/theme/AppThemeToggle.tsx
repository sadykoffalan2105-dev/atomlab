/** Переключатель светлой/тёмной темы в шапке приложения (солнце ↔ луна). */
import { useT } from '../i18n/useT'
import { useAppTheme } from './appTheme'
import styles from './AppThemeToggle.module.css'

function IconSun() {
  return (
    <svg className={`${styles.icon} ${styles.iconSun}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="4.4" stroke="currentColor" strokeWidth="1.8" />
      <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M12 2.6v2.3M12 19.1v2.3M2.6 12h2.3M19.1 12h2.3" />
        <path d="M5.4 5.4 7 7M17 17l1.6 1.6M18.6 5.4 17 7M7 17l-1.6 1.6" opacity="0.75" />
      </g>
    </svg>
  )
}

function IconMoon() {
  return (
    <svg className={`${styles.icon} ${styles.iconMoon}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20 14.2A8.4 8.4 0 0 1 9.8 4a8.4 8.4 0 1 0 10.2 10.2z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="16.4" cy="5.6" r="0.9" fill="currentColor" opacity="0.7" />
      <circle cx="19.4" cy="9" r="0.6" fill="currentColor" opacity="0.5" />
    </svg>
  )
}

export function AppThemeToggle() {
  const { t } = useT()
  const { theme, toggle } = useAppTheme()
  const isLight = theme === 'light'
  const label = isLight ? t('theme.switchToDark') : t('theme.switchToLight')

  return (
    <button
      type="button"
      className={styles.toggle}
      data-theme={theme}
      onClick={toggle}
      aria-pressed={isLight}
      aria-label={label}
      title={`${label} · ${isLight ? t('theme.light') : t('theme.dark')}`}
    >
      <span className={styles.stage} aria-hidden>
        <IconSun />
        <IconMoon />
      </span>
    </button>
  )
}
