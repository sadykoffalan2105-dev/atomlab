import { ELEMENTS } from '../../data/elements'
import { mendeleevBlock } from '../../data/mendeleevBlock'
import {
  PERIOD_TABLE_VISUAL_ROWS,
  periodLabelForVisualRow,
  visualGridRowFromDataY,
} from '../../data/periodLabels'
import { IUPAC_GROUP_LABELS } from '../../data/iupacGroupLabels'
import { massDisplay } from '../../data/elementDisplay'
import styles from './ElementSidePanel.module.css'

const GROUP_COUNT = 18
const PERIODIC_GRID_HEADER_ROWS = 2

function blockClass(block: 's' | 'p' | 'd' | 'f'): string {
  if (block === 's') return styles.blockS
  if (block === 'p') return styles.blockP
  if (block === 'd') return styles.blockD
  return styles.blockF
}

function nameForCell(nameRu: string): string {
  if (!nameRu) return nameRu
  const first = nameRu.charAt(0).toLocaleLowerCase('ru-RU')
  return first + nameRu.slice(1)
}

function cellInner(el: (typeof ELEMENTS)[number]) {
  return (
    <>
      <div className={styles.cellMassLine}>
        <span className={styles.m}>{massDisplay(el.atomicMass)}</span>
      </div>
      <div className={styles.cellSymbolRow}>
        <span className={styles.z}>{el.z}</span>
        <span className={styles.sym}>{el.symbol}</span>
      </div>
      <span className={styles.nameMini}>{nameForCell(el.nameRu)}</span>
    </>
  )
}

/** Компакт: Z, символ, подпись (название по-русски; масса в title) */
function cellInnerCompact(el: (typeof ELEMENTS)[number]) {
  return (
    <div className={styles.cellCompactInner}>
      <span className={styles.cellCompactZ}>{el.z}</span>
      <span className={styles.cellCompactSym}>{el.symbol}</span>
      <span className={styles.cellCompactName} title={el.nameRu}>
        {nameForCell(el.nameRu)}
      </span>
    </div>
  )
}

export function PeriodicTableGrid({
  mode,
  onPickElement,
  onAltPickElement,
  compact = false,
}: {
  mode: 'interactive' | 'static'
  onPickElement?: (z: number) => void
  onAltPickElement?: (z: number) => void
  compact?: boolean
}) {
  return (
    <div className={`${styles.gridWrap} ${compact ? styles.gridWrapCompact : ''}`}>
      <div className={`${styles.grid} ${compact ? styles.gridCompact : ''}`}>
        <div className={styles.corner} aria-hidden style={{ gridColumn: 1, gridRow: '1 / span 2' }} />
        {Array.from({ length: GROUP_COUNT }, (_, i) => (
          <div
            key={`g-${i + 1}`}
            className={styles.axisHead}
            style={{ gridColumn: i + 2, gridRow: 1 }}
          >
            {i + 1}
          </div>
        ))}
        {Array.from({ length: GROUP_COUNT }, (_, i) => (
          <div
            key={`iupac-${i + 1}`}
            className={styles.axisIupac}
            style={{ gridColumn: i + 2, gridRow: 2 }}
          >
            {IUPAC_GROUP_LABELS[i] ?? ''}
          </div>
        ))}
        {Array.from({ length: PERIOD_TABLE_VISUAL_ROWS }, (_, i) => {
          const visualRow = i + 1
          const label = periodLabelForVisualRow(visualRow)
          return (
            <div
              key={`p-v${visualRow}`}
              className={styles.axisSide}
              style={{ gridColumn: 1, gridRow: visualRow + PERIODIC_GRID_HEADER_ROWS }}
            >
              {label}
            </div>
          )
        })}

        {!compact ? (
          <div className={styles.mendeleevLaw} style={{ gridColumn: '3 / 13', gridRow: '3 / 6' }}>
            <strong className={styles.mendeleevLawTitle}>Периодический закон Д. И. Менделеева</strong>
            <p className={styles.mendeleevLawText}>
              Свойства элементов, в том числе валентность и строение атомов, периодически меняются с ростом заряда
              ядра.
            </p>
          </div>
        ) : null}

        {ELEMENTS.map((el) => {
          const block = mendeleevBlock(el)
          const bc = blockClass(block)
          const fullTip = `${el.nameRu} · Z=${el.z} · A≈${massDisplay(el.atomicMass)} u`
          const title = fullTip.length > 200 ? `${fullTip.slice(0, 197)}…` : fullTip
          const gridRow = visualGridRowFromDataY(el.gridY) + PERIODIC_GRID_HEADER_ROWS

          if (onPickElement) {
            return (
              <button
                key={el.z}
                type="button"
                className={`${styles.cellBtn} ${bc}`}
                style={{
                  gridColumn: el.gridX + 1,
                  gridRow,
                }}
                onClick={(ev) => {
                  if (mode === 'interactive' && ev.altKey && onAltPickElement) onAltPickElement(el.z)
                  else onPickElement(el.z)
                }}
                title={title}
              >
                {compact ? cellInnerCompact(el) : cellInner(el)}
              </button>
            )
          }

          return (
            <div
              key={el.z}
              className={`${styles.cellStatic} ${bc}`}
              style={{
                gridColumn: el.gridX + 1,
                gridRow,
              }}
              title={title}
              role="group"
            >
              {compact ? cellInnerCompact(el) : cellInner(el)}
            </div>
          )
        })}
      </div>

      {!compact ? (
        <div className={styles.legend} aria-label="Легенда блоков">
          <div className={styles.legendItem}>
            <span className={`${styles.legendSwatch} ${styles.legendS}`} />
            <span>s-элементы</span>
          </div>
          <div className={styles.legendItem}>
            <span className={`${styles.legendSwatch} ${styles.legendP}`} />
            <span>p-элементы</span>
          </div>
          <div className={styles.legendItem}>
            <span className={`${styles.legendSwatch} ${styles.legendD}`} />
            <span>d-элементы</span>
          </div>
          <div className={styles.legendItem}>
            <span className={`${styles.legendSwatch} ${styles.legendF}`} />
            <span>f-элементы</span>
          </div>
        </div>
      ) : null}
    </div>
  )
}
