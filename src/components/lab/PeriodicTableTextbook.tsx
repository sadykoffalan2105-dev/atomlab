import { memo, useMemo } from 'react'
import { toFullElectronConfiguration } from '../../data/electronConfigExpand'
import { elementDisplayName } from '../../data/elementDisplayName'
import { massDisplay } from '../../data/elementDisplay'
import { ELEMENTS } from '../../data/elements'
import { RU_GROUP_LABELS } from '../../data/ruGroupLabels'
import {
  CENTER_PANEL_COL_END,
  CENTER_PANEL_COL_START,
  CENTER_PANEL_ROW,
  F_BLOCK_GAP_ROW,
  F_ROW_GRID_COLUMN,
  LEGEND_GRID_ROW,
  TRIAD_VOID_COL_END,
  TRIAD_VOID_COL_START,
  TRIAD_VOID_ROW_END,
  TRIAD_VOID_ROW_START,
  getRuGridPos,
  group8HeaderSpan,
  groupGridColumn,
  groupHeaderSpan,
  ruElementGridColumn,
  ruFBlockGridRow,
  ruMainGridRow,
  ruMainVoidCells,
  ruPeriodLabelForRow,
  ruPeriodLabelRowSpan,
  triadGridColumn,
} from '../../data/ruElementGrid'
import { textbookBlockClass } from '../../data/mendeleevTextbookBlock'
import { useT } from '../../i18n/useT'
import tbStyles from './PeriodicTableTextbook.module.css'

const MAIN_ROWS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const
const LANTHANIDES = ELEMENTS.filter((e) => e.z >= 58 && e.z <= 71)
const ACTINIDES = ELEMENTS.filter((e) => e.z >= 90 && e.z <= 103)

/** Подсветка заголовков групп по типичному блоку столбца. */
const GROUP_HEAD_TINT = [
  'headS',
  'headS',
  'headP',
  'headP',
  'headP',
  'headP',
  'headP',
  'headP',
] as const

function schoolConfigLabel(config: string | undefined): string {
  const full = toFullElectronConfiguration(config)
  if (full === '—') return ''
  const noNote = full.replace(/\s*\([^)]*\)\s*$/, '').trim()
  return noNote.length > 18 ? config?.replace(/\s+/g, ' ').trim() ?? noNote : noNote
}

function tbBlockClass(el: (typeof ELEMENTS)[number]): string {
  const key = textbookBlockClass(el)
  return tbStyles[key] ?? tbStyles.tbS
}

function TextbookCellInner({ el }: { el: (typeof ELEMENTS)[number] }) {
  const { locale } = useT()
  const ruName = elementDisplayName(el, locale)
  const config = schoolConfigLabel(el.electronConfiguration)

  return (
    <div className={tbStyles.tbCellInner}>
      <span className={tbStyles.tbZ}>{el.z}</span>
      <span className={tbStyles.tbMass}>{massDisplay(el.atomicMass)}</span>
      <span className={tbStyles.tbSym} title={config}>
        {el.symbol}
      </span>
      <span className={tbStyles.tbRu} title={ruName}>
        {ruName}
      </span>
    </div>
  )
}

function renderElementCell(
  el: (typeof ELEMENTS)[number],
  onPick: ((z: number) => void) | undefined,
  extraClass = '',
) {
  const pos = getRuGridPos(el.z)
  const block = tbBlockClass(el)
  const inner = (
    <div className={tbStyles.cellSlotInner}>
      <TextbookCellInner el={el} />
    </div>
  )

  if (pos?.f != null) {
    const btnCls = `${onPick ? tbStyles.tbCellBtn : tbStyles.tbCellStatic} ${block} ${extraClass}`
    return (
      <div key={el.z} className={tbStyles.fCell}>
        {onPick ? (
          <button type="button" className={btnCls} onClick={() => onPick(el.z)}>
            {inner}
          </button>
        ) : (
          <div className={btnCls}>{inner}</div>
        )}
      </div>
    )
  }

  const col = pos ? ruElementGridColumn(pos) : null
  const row = pos ? ruMainGridRow(pos.y) : null
  if (col == null || row == null) return null

  const ghost = el.z === 57 || el.z === 89
  const style = { gridColumn: col, gridRow: row }
  const cls = `${onPick ? tbStyles.tbCellBtn : tbStyles.tbCellStatic} ${block} ${ghost ? tbStyles.tbGhost : ''} ${extraClass}`

  if (onPick) {
    return (
      <button key={el.z} type="button" className={cls} style={style} onClick={() => onPick(el.z)}>
        {inner}
        {ghost ? <span className={tbStyles.tbGhostMark}>{el.z === 57 ? '*' : '**'}</span> : null}
      </button>
    )
  }

  return (
    <div key={el.z} className={cls} style={style} role="group">
      {inner}
      {ghost ? <span className={tbStyles.tbGhostMark}>{el.z === 57 ? '*' : '**'}</span> : null}
    </div>
  )
}

export const PeriodicTableTextbook = memo(function PeriodicTableTextbook({
  onPickElement,
  wrapClassName,
}: {
  onPickElement?: (z: number) => void
  wrapClassName?: string
}) {
  const { t } = useT()

  const mainElements = useMemo(
    () => ELEMENTS.filter((e) => (e.z < 58 || e.z > 71) && (e.z < 90 || e.z > 103)),
    [],
  )

  const periodRowStarts = useMemo(() => new Set([1, 2, 3, 4, 6, 8, 10]), [])
  const voidCells = useMemo(() => ruMainVoidCells(), [])

  return (
    <div className={`${tbStyles.textbookWrap} ${wrapClassName ?? ''}`}>
      <div className={tbStyles.panelGlow} aria-hidden />
      <h2 className={tbStyles.textbookTitle}>
        <span className={tbStyles.titleMark} aria-hidden>⟨</span>
        {t('periodic.textbookTitle')}
        <span className={tbStyles.titleMark} aria-hidden>⟩</span>
      </h2>
      <div className={tbStyles.titleOrnament} aria-hidden>
        <span className={tbStyles.titleLine} />
        <span className={tbStyles.titleGem}>◆</span>
        <span className={tbStyles.titleLine} />
      </div>
      <p className={tbStyles.textbookGroupsLabel}>{t('periodic.groupsAxis')}</p>

      <div className={tbStyles.gridFrame}>
        <div className={tbStyles.orbitHalo} aria-hidden />
        <span className={tbStyles.frameTag} data-side="left" aria-hidden>PSХЭ·118</span>
        <span className={tbStyles.frameTag} data-side="right" aria-hidden>ATOMLAB</span>
        <div className={tbStyles.gridScan} aria-hidden />

      <div className={tbStyles.gridTextbook}>
        <div
          className={tbStyles.columnBackdrop}
          style={{ gridColumn: '3 / -1', gridRow: '3 / 17' }}
          aria-hidden
        />

        <div className={tbStyles.cornerPeriod} style={{ gridColumn: 1, gridRow: 1 }}>
          {t('periodic.axisPeriodShort')}
        </div>
        <div className={tbStyles.cornerRow} style={{ gridColumn: 2, gridRow: 1 }}>
          {t('periodic.axisRowShort')}
        </div>

        {RU_GROUP_LABELS.slice(0, 7).map((label, i) => (
          <div
            key={`g-${i}`}
            className={`${tbStyles.axisHead} ${tbStyles[GROUP_HEAD_TINT[i]]}`}
            style={{ gridColumn: groupHeaderSpan(i + 1), gridRow: 1 }}
          >
            {label}
          </div>
        ))}
        <div className={`${tbStyles.axisHead} ${tbStyles.headP}`} style={{ gridColumn: group8HeaderSpan(), gridRow: 1 }}>
          VIII
        </div>

        {RU_GROUP_LABELS.slice(0, 7).map((_, i) => (
          <div
            key={`sub-${i + 1}`}
            className={tbStyles.subHeadGroup}
            style={{ gridColumn: groupGridColumn(i + 1), gridRow: 2 }}
          >
            <span>A</span>
            <span>B</span>
          </div>
        ))}
        <div className={tbStyles.subHeadSubgroup} style={{ gridColumn: groupGridColumn(8), gridRow: 2 }}>
          A
        </div>
        <div className={tbStyles.subHeadSubgroup} style={{ gridColumn: triadGridColumn(1), gridRow: 2 }}>
          B
        </div>
        <div className={tbStyles.subHeadSubgroup} style={{ gridColumn: triadGridColumn(2), gridRow: 2 }}>
          B
        </div>

        {MAIN_ROWS.map((y) => {
          const period = ruPeriodLabelForRow(y)
          const span = ruPeriodLabelRowSpan(y)
          const showPeriod = periodRowStarts.has(y)
          return (
            <div key={`row-labels-${y}`} style={{ display: 'contents' }}>
              {showPeriod ? (
                <div
                  className={tbStyles.axisPeriod}
                  style={{
                    gridColumn: 1,
                    gridRow: span ? `${ruMainGridRow(y)} / span ${span}` : ruMainGridRow(y),
                  }}
                >
                  {period}
                </div>
              ) : null}
              <div className={tbStyles.axisRow} style={{ gridColumn: 2, gridRow: ruMainGridRow(y) }}>
                {y}
              </div>
            </div>
          )
        })}

        {mainElements.map((el) => renderElementCell(el, onPickElement))}

        <div
          className={tbStyles.centerLawPanel}
          style={{
            gridColumn: `${CENTER_PANEL_COL_START} / ${CENTER_PANEL_COL_END}`,
            gridRow: CENTER_PANEL_ROW,
          }}
        >
          <span className={tbStyles.centerLawTitle}>{t('periodic.lawTitle')}</span>
          <span className={tbStyles.centerLawText}>{t('periodic.intro1')}</span>
        </div>

        <div
          className={tbStyles.triadVoidPanel}
          style={{
            gridColumn: `${TRIAD_VOID_COL_START} / ${TRIAD_VOID_COL_END}`,
            gridRow: `${TRIAD_VOID_ROW_START} / ${TRIAD_VOID_ROW_END}`,
          }}
          aria-hidden
        />

        {voidCells.map(({ col, row }) => (
          <div
            key={`void-${col}-${row}`}
            className={tbStyles.voidCell}
            style={{ gridColumn: col, gridRow: row }}
            aria-hidden
          />
        ))}

        <div className={tbStyles.fBlockGap} style={{ gridColumn: '1 / -1', gridRow: F_BLOCK_GAP_ROW }} aria-hidden />

        <div
          className={tbStyles.fBlockBackdrop}
          style={{ gridColumn: F_ROW_GRID_COLUMN, gridRow: `${ruFBlockGridRow(12)} / ${ruFBlockGridRow(13) + 1}` }}
          aria-hidden
        />

        <div
          className={`${tbStyles.fBlockLabel} ${tbStyles.fBlockLabelWide}`}
          style={{ gridColumn: '1 / 3', gridRow: ruFBlockGridRow(12) }}
        >
          {t('periodic.lanthanidesLabel')}
        </div>
        <div
          className={tbStyles.fRowBand}
          style={{ gridColumn: F_ROW_GRID_COLUMN, gridRow: ruFBlockGridRow(12) }}
        >
          {LANTHANIDES.map((el) => renderElementCell(el, onPickElement))}
        </div>

        <div
          className={`${tbStyles.fBlockLabel} ${tbStyles.fBlockLabelWide}`}
          style={{ gridColumn: '1 / 3', gridRow: ruFBlockGridRow(13) }}
        >
          {t('periodic.actinidesLabel')}
        </div>
        <div className={tbStyles.fRowBand} style={{ gridColumn: F_ROW_GRID_COLUMN, gridRow: ruFBlockGridRow(13) }}>
          {ACTINIDES.map((el) => renderElementCell(el, onPickElement))}
        </div>

        <div
          className={tbStyles.legendRow}
          style={{ gridRow: LEGEND_GRID_ROW }}
          aria-label={t('periodic.legendAria')}
        >
          {(['tbS', 'tbP', 'tbD', 'tbF', 'tbNoble'] as const).map((key) => (
            <div key={key} className={tbStyles.legendTextbookItem}>
              <span className={`${tbStyles.legendTextbookSwatch} ${tbStyles[key]}`} />
              <span>
                {key === 'tbNoble'
                  ? t('periodic.legendNoble')
                  : t(`periodic.legend${key.slice(2)}` as 'periodic.legendS')}
              </span>
            </div>
          ))}
        </div>
      </div>
      </div>
    </div>
  )
})
