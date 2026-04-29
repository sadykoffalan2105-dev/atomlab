import type { ReactNode } from 'react'
import { getElementByZ } from '../../data/elements'
import { toFullElectronConfiguration } from '../../data/electronConfigExpand'
import { groupBlockLabelRu, standardStateLabelRu } from '../../data/elementI18n'
import { mendeleevBlock } from '../../data/mendeleevBlock'
import { massDisplay } from '../../data/elementDisplay'
import styles from './ElementDetailContent.module.css'

function blockLabelRu(block: 's' | 'p' | 'd' | 'f'): string {
  if (block === 's') return 's-элементы'
  if (block === 'p') return 'p-элементы'
  if (block === 'd') return 'd-элементы'
  return 'f-элементы'
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
  const el = getElementByZ(z)
  if (!el) return null

  const block = mendeleevBlock(el)
  const cpk = el.cpkHex.replace(/^#/, '')
  const fullConfig = toFullElectronConfiguration(el.electronConfiguration)
  const categoryRu = groupBlockLabelRu(el.groupBlock)
  const stateRu = standardStateLabelRu(el.standardState)
  const showCpk = isValidCpkHex(cpk)
  const rootClass = variantClass[variant] ?? styles.root

  return (
    <div className={rootClass}>
      <header className={styles.head}>
        <div>
          <h2 id={titleId} className={styles.symbol}>
            {el.symbol}
          </h2>
          <p className={styles.name}>{el.nameRu}</p>
          <p className={styles.zLine}>Z = {el.z}</p>
        </div>
        {headerEnd}
      </header>

      <dl className={styles.dl}>
        <dt className={styles.dt}>Относительная атомная масса</dt>
        <dd className={styles.dd}>{massDisplay(el.atomicMass)} u</dd>

        <dt className={styles.dt}>Полная электронная конфигурация</dt>
        <dd className={`${styles.dd} ${styles.configBlock}`}>{fullConfig}</dd>

        <dt className={styles.dt}>Степени окисления (валентные состояния)</dt>
        <dd className={styles.dd}>{el.oxidationStates}</dd>

        <dt className={styles.dt}>Категория элемента (по классификации ПСХЭ)</dt>
        <dd className={styles.dd}>{categoryRu}</dd>

        <dt className={styles.dt}>Зона s / p / d / f в раскраске таблицы</dt>
        <dd className={styles.dd}>{blockLabelRu(block)}</dd>

        <dt className={styles.dt}>Агрегатное состояние (при н. у., по справочнику)</dt>
        <dd className={styles.dd}>{stateRu}</dd>

        <dt className={styles.dt}>Цвет атома на схеме (модель CPK)</dt>
        <dd className={styles.dd}>
          {showCpk ? (
            <span className={styles.cpkRow}>
              <span
                className={styles.cpkSwatch}
                style={{ backgroundColor: `#${cpk}` }}
                aria-label="цвет CPK"
              />
            </span>
          ) : (
            'не задан'
          )}
        </dd>
      </dl>
    </div>
  )
}
