import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { estimateNeutrons, getElementByZ } from '../../data/elements'
import { elementDisplayName } from '../../data/elementDisplayName'
import {
  groupBlockLabelEn,
  groupBlockLabelRu,
  standardStateLabelEn,
  standardStateLabelRu,
} from '../../data/elementI18n'
import { toFullElectronConfiguration } from '../../data/electronConfigExpand'
import { mendeleevBlock } from '../../data/mendeleevBlock'
import { massDisplay } from '../../data/elementDisplay'
import { useT } from '../../i18n/useT'
import styles from './ElementDetailContent.module.css'

function blockLabelKey(block: 's' | 'p' | 'd' | 'f'): 'elementDetail.blockS' | 'elementDetail.blockP' | 'elementDetail.blockD' | 'elementDetail.blockF' {
  if (block === 's') return 'elementDetail.blockS'
  if (block === 'p') return 'elementDetail.blockP'
  if (block === 'd') return 'elementDetail.blockD'
  return 'elementDetail.blockF'
}

function isValidCpkHex(hex: string): boolean {
  return /^[0-9A-Fa-f]{6}$/.test(hex)
}

const variantClass = {
  default: styles.root,
  compact: styles.rootCompact,
  lab: styles.rootLab,
} as const

export function ElementDetailContent({
  z,
  titleId,
  headerEnd,
  variant = 'default',
}: {
  z: number
  titleId: string
  headerEnd?: ReactNode
  /** default — широкая сетка; compact — в одну колонку; lab — плотно для панели лаборатории */
  variant?: 'default' | 'compact' | 'lab'
}) {
  const { locale, t } = useT()
  const el = getElementByZ(z)
  const displayName = useMemo(() => (el ? elementDisplayName(el, locale) : ''), [el, locale])
  if (!el) return null

  const block = mendeleevBlock(el)
  const cpk = el.cpkHex.replace(/^#/, '')
  const fullConfig = toFullElectronConfiguration(el.electronConfiguration)
  const categoryLabel =
    locale === 'en' ? groupBlockLabelEn(el.groupBlock) : groupBlockLabelRu(el.groupBlock)
  const stateLabel =
    locale === 'en' ? standardStateLabelEn(el.standardState) : standardStateLabelRu(el.standardState)
  const showCpk = isValidCpkHex(cpk)
  const rootClass = variantClass[variant] ?? styles.root
  const neutronEstimate = estimateNeutrons(el.atomicMass, el.z)

  return (
    <div className={rootClass}>
      <header className={styles.head}>
        <div>
          <h2 id={titleId} className={styles.symbol}>
            {el.symbol}
          </h2>
          <p className={styles.name}>{displayName}</p>
          <p className={styles.zLine}>Z = {el.z}</p>
        </div>
        {headerEnd}
      </header>

      <dl className={styles.dl}>
        <dt className={styles.dt}>{t('elementDetail.atomicMass')}</dt>
        <dd className={styles.dd}>{massDisplay(el.atomicMass)} u</dd>

        <dt className={styles.dt}>{t('elementDetail.protons')}</dt>
        <dd className={styles.dd}>{el.z}</dd>

        <dt className={styles.dt}>{t('elementDetail.electrons')}</dt>
        <dd className={styles.dd}>{el.z}</dd>

        <dt className={styles.dt}>{t('elementDetail.neutrons')}</dt>
        <dd className={styles.dd}>{neutronEstimate}</dd>

        <dt className={styles.dt}>{t('elementDetail.electronConfig')}</dt>
        <dd className={`${styles.dd} ${styles.configBlock}`}>{fullConfig}</dd>

        <dt className={styles.dt}>{t('elementDetail.oxidation')}</dt>
        <dd className={styles.dd}>{el.oxidationStates}</dd>

        <dt className={styles.dt}>{t('elementDetail.category')}</dt>
        <dd className={styles.dd}>{categoryLabel}</dd>

        <dt className={styles.dt}>{t('elementDetail.blockZone')}</dt>
        <dd className={styles.dd}>{t(blockLabelKey(block))}</dd>

        <dt className={styles.dt}>{t('elementDetail.standardState')}</dt>
        <dd className={styles.dd}>{stateLabel}</dd>

        <dt className={styles.dt}>{t('elementDetail.cpkColor')}</dt>
        <dd className={styles.dd}>
          {showCpk ? (
            <span className={styles.cpkRow}>
              <span
                className={styles.cpkSwatch}
                style={{ backgroundColor: `#${cpk}` }}
                aria-label={t('elementDetail.cpkSwatchAria')}
              />
            </span>
          ) : (
            t('elementDetail.cpkNotSet')
          )}
        </dd>
      </dl>
    </div>
  )
}
