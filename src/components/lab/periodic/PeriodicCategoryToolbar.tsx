import { type CSSProperties } from 'react'
import { ELEMENT_CATEGORY_ORDER, type ElementCategoryFilterId } from '../../../data/elementCategory'
import { useT } from '../../../i18n/useT'
import { BLOCK_ACCENT, BLOCK_ORDER, CATEGORY_COLOR, CATEGORY_I18N, blockLegendKey } from './periodicMeta'
import styles from './PeriodicChrome.module.css'

type Props = {
  value: ElementCategoryFilterId | null
  onChange: (id: ElementCategoryFilterId | null) => void
  /** compact — плотная сетка чипов для пустого угла таблицы (без легенды блоков). */
  variant?: 'panel' | 'compact'
}

/** Панель «Классы элементов» (фильтр-чипы) + легенда блоков s/p/d/f. */
export function PeriodicCategoryToolbar({ value, onChange, variant = 'panel' }: Props) {
  const { t } = useT()

  if (variant === 'compact') {
    return (
      <div className={styles.filtersCompact}>
        <div className={styles.filtersCompactHead}>
          <span className={styles.filtersCompactTitle}>{t('periodic.categoryFilterTitle')}</span>
          {value ? (
            <button type="button" className={styles.filtersClear} onClick={() => onChange(null)}>
              {t('periodic.categoryFilterClear')}
            </button>
          ) : null}
        </div>
        <div className={styles.chipsCompact} role="group" aria-label={t('periodic.categoryFilterAria')}>
          {ELEMENT_CATEGORY_ORDER.map((id) => {
            const active = value === id
            const label = t(CATEGORY_I18N[id])
            return (
              <button
                key={id}
                type="button"
                title={label}
                className={[styles.chipCompact, active ? styles.chipActive : ''].join(' ')}
                style={{ '--chip-c': CATEGORY_COLOR[id] } as CSSProperties}
                aria-pressed={active}
                onClick={() => onChange(active ? null : id)}
              >
                <span className={styles.dot} aria-hidden />
                <span className={styles.chipCompactLabel}>{label}</span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.filters}>
      <div className={styles.filtersHead}>
        <span className={styles.filtersTitle}>{t('periodic.categoryFilterTitle')}</span>
        {value ? (
          <button type="button" className={styles.filtersClear} onClick={() => onChange(null)}>
            {t('periodic.categoryFilterClear')}
          </button>
        ) : (
          <span className={styles.filtersHint}>{t('periodic.categoryFilterHint')}</span>
        )}
      </div>

      <div className={styles.chips} role="group" aria-label={t('periodic.categoryFilterAria')}>
        {ELEMENT_CATEGORY_ORDER.map((id) => {
          const active = value === id
          return (
            <button
              key={id}
              type="button"
              className={`${styles.chip} ${active ? styles.chipActive : ''}`}
              style={{ '--chip-c': CATEGORY_COLOR[id] } as CSSProperties}
              aria-pressed={active}
              onClick={() => onChange(active ? null : id)}
            >
              <span className={styles.dot} aria-hidden />
              {t(CATEGORY_I18N[id])}
            </button>
          )
        })}
      </div>

      <div className={styles.blocks} role="list" aria-label={t('periodic.legendAria')}>
        {BLOCK_ORDER.map((key) => (
          <span
            key={key}
            role="listitem"
            className={styles.blockChip}
            style={{ '--chip-c': BLOCK_ACCENT[key].a } as CSSProperties}
          >
            <span className={styles.blockSwatch} aria-hidden />
            {t(blockLegendKey(key))}
          </span>
        ))}
      </div>
    </div>
  )
}
