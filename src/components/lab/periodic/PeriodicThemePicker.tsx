import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { useT } from '../../../i18n/useT'
import { CATEGORY_COLOR } from './periodicMeta'
import {
  PERIODIC_THEMES,
  type PeriodicColorMode,
  type PeriodicThemeId,
  type PeriodicThemeMeta,
} from './periodicThemes'
import styles from './PeriodicThemePicker.module.css'

type Props = {
  theme: PeriodicThemeId
  onThemeChange: (id: PeriodicThemeId) => void
  colorMode: PeriodicColorMode
  onColorModeChange: (mode: PeriodicColorMode) => void
}

const BLOCK_LABELS = ['s', 'p', 'd', 'f'] as const
const CATEGORY_SWATCHES = [
  CATEGORY_COLOR['alkali-metal'],
  CATEGORY_COLOR['alkaline-earth-metal'],
  CATEGORY_COLOR['transition-metal'],
  CATEGORY_COLOR.nonmetal,
  CATEGORY_COLOR.halogen,
  CATEGORY_COLOR['noble-gas'],
] as const

function IconPalette({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M10 2.6c-4.2 0-7.4 3.1-7.4 7.1 0 3.9 3.1 7.7 6.9 7.7 1.2 0 1.8-.8 1.8-1.6 0-1.1-.9-1.4-.9-2.4 0-.9.7-1.5 1.7-1.5h1.6c2.4 0 3.7-1.5 3.7-3.5 0-3.3-3.2-5.8-7.4-5.8z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <circle cx="6.4" cy="9.4" r="1.15" fill="currentColor" />
      <circle cx="8.6" cy="6.1" r="1.15" fill="currentColor" />
      <circle cx="12.4" cy="6.1" r="1.15" fill="currentColor" />
    </svg>
  )
}

function ThemePreview({ meta }: { meta: PeriodicThemeMeta }) {
  const { preview } = meta
  return (
    <span
      className={styles.preview}
      data-fill={preview.fill}
      style={{ '--pv-bg': preview.bg, '--pv-frame': preview.frame, '--pv-ink': preview.ink } as CSSProperties}
      aria-hidden
    >
      {[0, 1, 2, 3, 3, 1, 2, 0].map((ti, i) => (
        <span key={i} className={styles.previewTile} style={{ '--tile': preview.tiles[ti] } as CSSProperties}>
          {i === 0 ? 'H' : i === 5 ? 'O' : null}
        </span>
      ))}
    </span>
  )
}

/** Кнопка «Тема» в шапке страницы: темы таблицы и режим раскраски ячеек. */
export function PeriodicThemePicker({ theme, onThemeChange, colorMode, onColorModeChange }: Props) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const toggleRef = useRef<HTMLButtonElement | null>(null)
  const popId = useId()
  const current = PERIODIC_THEMES.find((th) => th.id === theme) ?? PERIODIC_THEMES[0]

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const inside = wrapRef.current?.contains(document.activeElement) ?? false
      setOpen(false)
      if (inside) toggleRef.current?.focus()
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        ref={toggleRef}
        type="button"
        className={styles.toggle}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={popId}
        aria-label={t('periodic.themeButton')}
        title={t('periodic.themeButtonTitle')}
      >
        <IconPalette className={styles.toggleIcon} />
        <span className={styles.toggleLabel}>{t('periodic.themeButton')}</span>
        <span className={styles.toggleSwatch} aria-hidden>
          {current.preview.tiles.map((c, i) => (
            <span key={i} style={{ background: c }} />
          ))}
        </span>
      </button>

      <div id={popId} className={styles.pop} hidden={!open}>
        <p className={styles.popTitle}>{t('periodic.themeTitle')}</p>
        <div className={styles.themeGrid} role="group" aria-label={t('periodic.themeTitle')}>
          {PERIODIC_THEMES.map((meta) => {
            const active = meta.id === theme
            return (
              <button
                key={meta.id}
                type="button"
                aria-pressed={active}
                className={active ? `${styles.themeCard} ${styles.themeCardOn}` : styles.themeCard}
                onClick={() => onThemeChange(meta.id)}
              >
                <ThemePreview meta={meta} />
                <span className={styles.themeText}>
                  <span className={styles.themeName}>{t(meta.nameKey)}</span>
                  <span className={styles.themeDesc}>{t(meta.descKey)}</span>
                </span>
                {active ? (
                  <span className={styles.check} aria-hidden>
                    ✓
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>

        <p className={styles.popTitle}>{t('periodic.colorModeTitle')}</p>
        <div className={styles.modeRow} role="group" aria-label={t('periodic.colorModeTitle')}>
          <button
            type="button"
            aria-pressed={colorMode === 'block'}
            className={colorMode === 'block' ? `${styles.mode} ${styles.modeOn}` : styles.mode}
            onClick={() => onColorModeChange('block')}
          >
            <span className={styles.modeSwatches} aria-hidden>
              {BLOCK_LABELS.map((b, i) => (
                <span key={b} className={styles.blockChip} style={{ '--tile': current.preview.tiles[i] } as CSSProperties}>
                  {b}
                </span>
              ))}
            </span>
            <span className={styles.modeLabel}>{t('periodic.colorModeBlock')}</span>
          </button>
          <button
            type="button"
            aria-pressed={colorMode === 'category'}
            className={colorMode === 'category' ? `${styles.mode} ${styles.modeOn}` : styles.mode}
            onClick={() => onColorModeChange('category')}
          >
            <span className={styles.modeSwatches} aria-hidden>
              {CATEGORY_SWATCHES.map((c, i) => (
                <span key={i} className={styles.catDot} style={{ background: c }} />
              ))}
            </span>
            <span className={styles.modeLabel}>{t('periodic.colorModeCategory')}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
