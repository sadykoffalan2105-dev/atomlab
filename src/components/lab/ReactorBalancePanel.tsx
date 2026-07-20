import { useMemo, useState } from 'react'
import { useT } from '../../i18n/useT'
import type { CompoundDef } from '../../types/chemistry'
import type { ReactorEquationTerm } from '../../chemistry/reactorEquationBalance'
import { buildAtomBalanceRows } from '../../chemistry/atomBalanceTable'
import {
  computeElectronBalance,
  describeLeftOxLabels,
} from '../../chemistry/electronBalanceEngine'
import { oxidationForProduct } from '../../chemistry/oxidationStateEngine'
import {
  BALANCE_LESSON_BANK,
  lessonToLeftTerms,
  type BalanceLesson,
} from '../../chemistry/balanceLessonBank'
import styles from './ReactorBalancePanel.module.css'

type TabId = 'substitution' | 'electron' | 'lesson'

export function ReactorBalancePanel({
  leftTerms,
  productCompound,
  productCoeff,
  onApplyCoeffs,
  onLoadLesson,
}: {
  leftTerms: readonly ReactorEquationTerm[]
  productCompound: CompoundDef | null
  productCoeff: number
  onApplyCoeffs: (left: Record<string, number>, productCoeff: number) => void
  onLoadLesson: (lesson: BalanceLesson) => void
}) {
  const { t, locale } = useT()
  const [tab, setTab] = useState<TabId>('substitution')
  const [oxPick, setOxPick] = useState<string | null>(null)
  const [redPick, setRedPick] = useState<string | null>(null)

  const table = useMemo(
    () => buildAtomBalanceRows(leftTerms, productCompound, productCoeff),
    [leftTerms, productCompound, productCoeff],
  )

  const electron = useMemo(
    () => computeElectronBalance(leftTerms, productCompound),
    [leftTerms, productCompound],
  )

  const productOx = useMemo(() => oxidationForProduct(productCompound), [productCompound])
  const leftOxLabels = useMemo(() => describeLeftOxLabels(leftTerms), [leftTerms])

  const canApplyElectron = Boolean(electron?.isRedox)

  return (
    <div className={styles.panel} data-lab-balance="">
      <div className={styles.tabs} role="tablist" aria-label={t('reactor.balance.tabsAria')}>
        {(
          [
            ['substitution', 'reactor.balance.tabSubstitution'],
            ['electron', 'reactor.balance.tabElectron'],
            ['lesson', 'reactor.balance.tabLesson'],
          ] as const
        ).map(([id, key]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? `${styles.tab} ${styles.tabActive}` : styles.tab}
            onClick={() => setTab(id)}
          >
            {t(key)}
          </button>
        ))}
      </div>

      {tab === 'substitution' ? (
        <div className={styles.body} role="tabpanel">
          <p className={styles.hint}>{t('reactor.balance.substHint')}</p>
          {table.rows.length === 0 ? (
            <p className={styles.empty}>{t('reactor.balance.needEquation')}</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t('reactor.balance.element')}</th>
                  <th>{t('reactor.balance.left')}</th>
                  <th>{t('reactor.balance.right')}</th>
                  <th>{t('reactor.balance.status')}</th>
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row) => (
                  <tr key={row.symbol} data-ok={row.balanced ? '1' : '0'}>
                    <td className={styles.sym}>{row.symbol}</td>
                    <td>{row.left}</td>
                    <td>{row.right}</td>
                    <td>
                      <span className={row.balanced ? styles.ok : styles.bad}>
                        {row.balanced ? '●' : '●'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {table.allBalanced ? (
            <p className={styles.bannerOk} role="status">
              {t('reactor.balance.allBalanced')}
            </p>
          ) : null}
        </div>
      ) : null}

      {tab === 'electron' ? (
        <div className={styles.body} role="tabpanel">
          <p className={styles.hint}>{t('reactor.balance.electronHint')}</p>
          {!productCompound || leftTerms.length === 0 ? (
            <p className={styles.empty}>{t('reactor.balance.needEquation')}</p>
          ) : (
            <>
              <div className={styles.oxRow}>
                <span className={styles.oxLabel}>{t('reactor.balance.oxStates')}</span>
                <div className={styles.oxChips}>
                  {leftOxLabels.map((lab, i) => (
                    <span key={`L${i}`} className={styles.oxChip}>
                      {lab}
                    </span>
                  ))}
                  <span className={styles.oxArrow}>→</span>
                  <span className={styles.oxChip}>{productOx?.formulaWithOx ?? '—'}</span>
                </div>
              </div>

              {electron?.isRedox ? (
                <>
                  <div className={styles.halfBox}>
                    {electron.halfReactions.map((h) => (
                      <button
                        key={h.symbol + h.kind}
                        type="button"
                        className={
                          (h.kind === 'oxidation' && oxPick === h.symbol) ||
                          (h.kind === 'reduction' && redPick === h.symbol)
                            ? `${styles.halfBtn} ${styles.halfBtnOn}`
                            : styles.halfBtn
                        }
                        onClick={() => {
                          if (h.kind === 'oxidation') setOxPick(h.symbol)
                          else setRedPick(h.symbol)
                        }}
                      >
                        <span className={styles.halfKind}>
                          {h.kind === 'oxidation'
                            ? t('reactor.balance.oxidation')
                            : t('reactor.balance.reduction')}
                        </span>
                        {h.line}
                      </button>
                    ))}
                  </div>
                  {oxPick && redPick ? (
                    <div className={styles.transfer} aria-hidden>
                      <span>{oxPick}</span>
                      <span className={styles.transferArrow}>−−e⁻→</span>
                      <span>{redPick}</span>
                      <span className={styles.lcm}>
                        {t('reactor.balance.lcm')}: {electron.lcm}
                      </span>
                    </div>
                  ) : (
                    <p className={styles.hint}>{t('reactor.balance.pickHalf')}</p>
                  )}
                  <ul className={styles.summary}>
                    {electron.summaryLines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className={styles.applyBtn}
                    disabled={!canApplyElectron}
                    onClick={() => {
                      if (!electron) return
                      onApplyCoeffs(electron.suggestedLeft, electron.suggestedProductCoeff)
                    }}
                  >
                    {t('reactor.balance.applyCoeffs')}
                  </button>
                </>
              ) : (
                <p className={styles.empty}>{t('reactor.balance.notRedox')}</p>
              )}
            </>
          )}
        </div>
      ) : null}

      {tab === 'lesson' ? (
        <div className={styles.body} role="tabpanel">
          <p className={styles.hint}>{t('reactor.balance.lessonHint')}</p>
          <ul className={styles.lessonList}>
            {BALANCE_LESSON_BANK.map((lesson) => {
              const title = locale === 'en' ? lesson.titleEn : lesson.titleRu
              return (
                <li key={lesson.id} className={styles.lessonItem}>
                  <div className={styles.lessonMeta}>
                    <strong>{title}</strong>
                    <span className={styles.lessonGrade}>
                      {t('reactor.balance.grade', { n: lesson.gradeHint })}
                    </span>
                    {lesson.kind === 'practice_only' ? (
                      <span className={styles.lessonPractice}>
                        {lesson.displayEquationRu ?? t('reactor.balance.practiceOnly')}
                      </span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className={styles.lessonLoad}
                    onClick={() => {
                      onLoadLesson(lesson)
                      if (lesson.methodHint === 'electron') setTab('electron')
                      else if (lesson.methodHint === 'substitution') setTab('substitution')
                    }}
                  >
                    {lesson.kind === 'practice_only'
                      ? t('reactor.balance.showPractice')
                      : t('reactor.balance.loadLesson')}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

export { lessonToLeftTerms }
