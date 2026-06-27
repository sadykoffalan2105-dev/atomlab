import { useCallback, useEffect, useRef, useState } from 'react'
import { useGraphicsSettings } from '../../perf/GraphicsSettingsProvider'
import type { GraphicsPreset } from '../../perf/graphicsSettings'
import { useT, type MessageKey } from '../../i18n/useT'
import styles from './GraphicsSettingsPanel.module.css'

const OPTIONS: GraphicsPreset[] = ['auto', 'low', 'medium', 'high', 'ultra']

export function GraphicsSettingsPanel() {
  const { t } = useT()
  const { preset, effectivePreset, setPreset } = useGraphicsSettings()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const labelKey = (p: GraphicsPreset): MessageKey =>
    `graphics.preset.${p}` as MessageKey

  const onPick = useCallback(
    (p: GraphicsPreset) => {
      setPreset(p)
      setOpen(false)
    },
    [setPreset],
  )

  const buttonLabel =
    preset === 'auto'
      ? t('graphics.buttonAuto', { tier: t(labelKey(effectivePreset)) })
      : t('graphics.button', { tier: t(labelKey(preset)) })

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.toggle}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={t('graphics.title')}
      >
        {buttonLabel}
      </button>
      {open ? (
        <div className={styles.menu} role="listbox" aria-label={t('graphics.title')}>
          <p className={styles.title}>{t('graphics.title')}</p>
          {OPTIONS.map((p) => (
            <button
              key={p}
              type="button"
              role="option"
              aria-selected={preset === p}
              className={`${styles.option} ${preset === p ? styles.optionActive : ''}`}
              onClick={() => onPick(p)}
            >
              {t(labelKey(p))}
            </button>
          ))}
          <p className={styles.hint}>{t('graphics.hint')}</p>
        </div>
      ) : null}
    </div>
  )
}
