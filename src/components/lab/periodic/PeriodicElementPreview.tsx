import { type CSSProperties } from 'react'
import { ELEMENTS } from '../../../data/elements'
import { elementDisplayName } from '../../../data/elementDisplayName'
import { massDisplay } from '../../../data/elementDisplay'
import { elementCategoryId } from '../../../data/elementCategory'
import { textbookBlockClass } from '../../../data/mendeleevTextbookBlock'
import { useT } from '../../../i18n/useT'
import {
  BLOCK_ACCENT,
  CATEGORY_COLOR,
  CATEGORY_I18N,
  blockLegendKey,
  configParts,
  ruPeriodGroup,
} from './periodicMeta'
import styles from './PeriodicChrome.module.css'

type Props = {
  z: number
  /** true — ничего не наведено, показываем пример и подсказку. */
  featured?: boolean
  onOpen: (z: number) => void
  /** strip — горизонтальная полоса в пустом ряду таблицы (между H и He). */
  variant?: 'card' | 'strip'
}

/** Карточка-предпросмотр элемента: крупная плитка, ключевые данные, «Подробнее». */
export function PeriodicElementPreview({ z, featured = false, onOpen, variant = 'card' }: Props) {
  const { t, locale } = useT()
  const el = ELEMENTS.find((e) => e.z === z)
  if (!el) return null

  const name = elementDisplayName(el, locale)
  const block = textbookBlockClass(el)
  const accent = BLOCK_ACCENT[block]
  const category = elementCategoryId(el)
  const { period, group } = ruPeriodGroup(el.z)
  const config = el.electronConfiguration?.trim()
  const oxidation = el.oxidationStates?.trim()
  const en = el.electronegativity

  const tone = { '--pv-a': accent.a, '--pv-b': accent.b } as CSSProperties

  if (variant === 'strip') {
    return (
      <section className={styles.strip} style={tone} aria-label={t('periodic.previewAria')}>
        <div className={styles.stripTile} aria-hidden>
          <span className={styles.stripTileZ}>{el.z}</span>
          <span className={styles.stripTileSym}>{el.symbol}</span>
        </div>
        <div className={styles.stripHead}>
          <h2 className={styles.stripName}>
            {name}
            {featured ? <span className={styles.stripEyebrow}>{t('periodic.previewFeatured')}</span> : null}
          </h2>
          <p className={styles.stripMeta}>
            {category ? (
              <span className={styles.previewCat}>
                <span className={styles.dot} style={{ '--chip-c': CATEGORY_COLOR[category] } as CSSProperties} aria-hidden />
                {t(CATEGORY_I18N[category])}
              </span>
            ) : null}
            {period != null ? <span>{t('periodic.previewPeriod', { n: period })}</span> : null}
            {group ? <span>{t('periodic.previewGroup', { g: group })}</span> : null}
          </p>
        </div>
        <dl className={styles.stripStats}>
          <div className={styles.stripStat}>
            <dt>{t('periodic.previewMass')}</dt>
            <dd>{massDisplay(el.atomicMass)}</dd>
          </div>
          {en != null ? (
            <div className={styles.stripStat}>
              <dt>{t('periodic.previewElectronegativity')}</dt>
              <dd>{en}</dd>
            </div>
          ) : null}
          {config ? (
            <div className={[styles.stripStat, styles.stripStatConfig].join(' ')}>
              <dt>{t('periodic.previewConfig')}</dt>
              <dd className={styles.previewConfig}>
                {configParts(config).map((part, i) => (
                  <span key={i}>
                    {part.text}
                    {part.sup ? <sup>{part.sup}</sup> : null}
                  </span>
                ))}
              </dd>
            </div>
          ) : null}
          {oxidation ? (
            <div className={[styles.stripStat, styles.stripStatOx].join(' ')}>
              <dt>{t('periodic.previewOxidation')}</dt>
              <dd>{oxidation.replace(/,\s*/g, ', ')}</dd>
            </div>
          ) : null}
        </dl>
        <button type="button" className={styles.stripMore} onClick={() => onOpen(el.z)}>
          {t('periodic.previewMore')}
          <span aria-hidden>→</span>
        </button>
      </section>
    )
  }

  return (
    <section className={styles.preview} style={tone} aria-label={t('periodic.previewAria')}>
      <div className={styles.previewTop}>
        <div className={styles.previewTile} aria-hidden>
          <span className={styles.previewTileZ}>{el.z}</span>
          <span className={styles.previewTileSym}>{el.symbol}</span>
          <span className={styles.previewTileMass}>{massDisplay(el.atomicMass)}</span>
        </div>
        <div className={styles.previewHead}>
          {featured ? <span className={styles.previewEyebrow}>{t('periodic.previewFeatured')}</span> : null}
          <h2 className={styles.previewName}>{name}</h2>
          <p className={styles.previewMeta}>
            {category ? (
              <span className={styles.previewCat}>
                <span
                  className={styles.dot}
                  style={{ '--chip-c': CATEGORY_COLOR[category] } as CSSProperties}
                  aria-hidden
                />
                {t(CATEGORY_I18N[category])}
              </span>
            ) : null}
          </p>
          <p className={styles.previewPos}>
            {period != null ? <span>{t('periodic.previewPeriod', { n: period })}</span> : null}
            {group ? <span>{t('periodic.previewGroup', { g: group })}</span> : null}
            <span className={styles.previewBlock}>{t(blockLegendKey(block))}</span>
          </p>
        </div>
      </div>

      <dl className={styles.previewStats}>
        <div className={styles.previewStat}>
          <dt>{t('periodic.previewMass')}</dt>
          <dd>{massDisplay(el.atomicMass)}</dd>
        </div>
        {en != null ? (
          <div className={styles.previewStat}>
            <dt>{t('periodic.previewElectronegativity')}</dt>
            <dd>{en}</dd>
          </div>
        ) : null}
        {config ? (
          <div className={`${styles.previewStat} ${styles.previewStatWide}`}>
            <dt>{t('periodic.previewConfig')}</dt>
            <dd className={styles.previewConfig}>
              {configParts(config).map((part, i) => (
                <span key={i}>
                  {part.text}
                  {part.sup ? <sup>{part.sup}</sup> : null}
                </span>
              ))}
            </dd>
          </div>
        ) : null}
        {oxidation ? (
          <div className={`${styles.previewStat} ${styles.previewStatWide}`}>
            <dt>{t('periodic.previewOxidation')}</dt>
            <dd>{oxidation.replace(/,\s*/g, ', ')}</dd>
          </div>
        ) : null}
      </dl>

      {featured ? <p className={styles.previewHint}>{t('periodic.previewHint')}</p> : null}

      <button type="button" className={styles.previewMore} onClick={() => onOpen(el.z)}>
        {t('periodic.previewMore')}
        <span aria-hidden>→</span>
      </button>
    </section>
  )
}
