import { useEffect, useMemo, useState } from 'react'
import {
  equationSidesMatch,
  equationsByGrade,
  G10_G11_EDU_EQUATIONS,
  type GradeEq,
} from '../../../data/researchLab/g10g11Equations'
import { useLocale } from '../../../i18n/useLocale'
import { useT } from '../../../i18n/useT'
import styles from './OrganicBuilderCanvas.module.css'

type GradeFilter = 'all' | 'g10' | 'g11'
type Side = 'left' | 'right' | 'bank'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

function topicLabel(eq: GradeEq, locale: string) {
  if (locale === 'en') return eq.topicEn
  if (locale === 'uz') return eq.topicUz
  return eq.topicRu
}

function hintLabel(eq: GradeEq, locale: string) {
  if (locale === 'en') return eq.hintEn
  if (locale === 'uz') return eq.hintUz
  return eq.hintRu
}

function buildBank(target: GradeEq, pool: readonly GradeEq[]): string[] {
  const needed = [...target.left, ...target.right]
  const distractors: string[] = []
  for (const eq of pool) {
    if (eq.id === target.id) continue
    for (const tok of [...eq.left, ...eq.right]) {
      if (!needed.includes(tok) && !distractors.includes(tok)) distractors.push(tok)
      if (distractors.length >= 3) break
    }
    if (distractors.length >= 3) break
  }
  return shuffle([...needed, ...distractors.slice(0, 3)])
}

export function ResearchEquationBuilder({
  onMacro,
  compact,
  preferFormula,
  onSelectEquation,
  allowedEquationIds,
  hideGradeFilters = false,
  onSolved,
}: {
  onMacro: (text: string) => void
  compact?: boolean
  /** Предпочесть уравнения, связанные с формулой текущей молекулы */
  preferFormula?: string
  /** Выбор уравнения → загрузка правильной 3D-молекулы снаружи */
  onSelectEquation?: (eq: GradeEq) => void
  /** Ограничить пул (урок органической лаборатории) */
  allowedEquationIds?: readonly string[]
  hideGradeFilters?: boolean
  onSolved?: () => void
}) {
  const { t } = useT()
  const { locale } = useLocale()
  const [grade, setGrade] = useState<GradeFilter>('all')
  const pool = useMemo(() => {
    const base = equationsByGrade(grade)
    if (!allowedEquationIds?.length) return base
    const set = new Set(allowedEquationIds)
    const scoped = G10_G11_EDU_EQUATIONS.filter((e) => set.has(e.id))
    return scoped.length > 0 ? scoped : base
  }, [grade, allowedEquationIds])

  const preferredId = useMemo(() => {
    if (!preferFormula) return pool[0]?.id ?? ''
    const ascii = preferFormula.replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (d) => String('₀₁₂₃₄₅₆₇₈₉'.indexOf(d)))
    const hit = pool.find(
      (e) =>
        e.displayRu.includes(preferFormula) ||
        e.displayRu.includes(ascii) ||
        e.left.some((x) => x.includes(ascii) || preferFormula.includes(x.replace(/\d/g, ''))) ||
        e.right.some((x) => x.includes(ascii)),
    )
    return hit?.id ?? pool[0]?.id ?? ''
  }, [pool, preferFormula])

  const [eqId, setEqId] = useState(preferredId)
  const target = pool.find((e) => e.id === eqId) ?? pool.find((e) => e.id === preferredId) ?? pool[0]

  const [bank, setBank] = useState<string[]>(() => (target ? buildBank(target, pool) : []))
  const [left, setLeft] = useState<string[]>([])
  const [right, setRight] = useState<string[]>([])
  const [result, setResult] = useState<'idle' | 'ok' | 'bad'>('idle')
  const [seed, setSeed] = useState(0)

  useEffect(() => {
    if (!preferredId) return
    const eq = pool.find((e) => e.id === preferredId)
    if (!eq) return
    setEqId(preferredId)
    setBank(buildBank(eq, pool))
    setLeft([])
    setRight([])
    setResult('idle')
    setSeed((s) => s + 1)
  }, [preferredId, pool])

  const resetFor = (eq: GradeEq, list: readonly GradeEq[]) => {
    setBank(buildBank(eq, list))
    setLeft([])
    setRight([])
    setResult('idle')
    setSeed((s) => s + 1)
  }

  const onPickGrade = (g: GradeFilter) => {
    setGrade(g)
    const next = equationsByGrade(g)
    const first = next[0]
    if (first) {
      setEqId(first.id)
      resetFor(first, next)
    }
  }

  const onPickEq = (id: string) => {
    setEqId(id)
    const eq = pool.find((e) => e.id === id)
    if (eq) {
      resetFor(eq, pool)
      onSelectEquation?.(eq)
    }
  }

  const moveToken = (token: string, from: Side, fromIdx: number, to: Side) => {
    if (from === to) return
    const take = (arr: string[]) => arr.filter((_, i) => i !== fromIdx)
    let nextBank = bank
    let nextLeft = left
    let nextRight = right
    if (from === 'bank') nextBank = take(bank)
    if (from === 'left') nextLeft = take(left)
    if (from === 'right') nextRight = take(right)
    if (to === 'bank') nextBank = [...nextBank, token]
    if (to === 'left') nextLeft = [...nextLeft, token]
    if (to === 'right') nextRight = [...nextRight, token]
    setBank(nextBank)
    setLeft(nextLeft)
    setRight(nextRight)
    setResult('idle')
  }

  const check = () => {
    if (!target) return
    const ok = equationSidesMatch(left, right, target)
    setResult(ok ? 'ok' : 'bad')
    onMacro(ok ? target.displayRu : t('learn.research.eqBuilderBadMacro'))
    if (ok) onSolved?.()
  }

  if (!target) {
    return <p className={styles.hintLine}>{t('learn.research.eqBuilderEmpty')}</p>
  }

  return (
    <div className={styles.eqBuilder} key={`${target.id}-${seed}`}>
      {!compact ? <p className={styles.hintLine}>{t('learn.research.studioEquationLead')}</p> : null}

      {!hideGradeFilters && !allowedEquationIds?.length ? (
        <div className={styles.eqFilters} role="group" aria-label={t('learn.research.eqBuilderGradeAria')}>
          {(['all', 'g10', 'g11'] as const).map((g) => (
            <button
              key={g}
              type="button"
              className={`${styles.tool} ${grade === g ? styles.toolActive : ''}`}
              onClick={() => onPickGrade(g)}
            >
              {g === 'all'
                ? t('learn.research.eqBuilderAll')
                : g === 'g10'
                  ? t('learn.research.eqBuilderG10')
                  : t('learn.research.eqBuilderG11')}
            </button>
          ))}
          <span className={styles.hintLine}>
            {t('learn.research.eqBuilderCount', { n: pool.length })}
          </span>
        </div>
      ) : (
        <p className={styles.hintLine}>{t('learn.research.eqBuilderCount', { n: pool.length })}</p>
      )}

      <label className={styles.eqSelectLabel}>
        <span>{t('learn.research.eqBuilderPick')}</span>
        <select
          className={styles.eqSelect}
          value={target.id}
          onChange={(e) => onPickEq(e.target.value)}
        >
          {pool.map((eq) => (
            <option key={eq.id} value={eq.id}>
              [{eq.grade === 'g10' ? '10' : '11'}] {topicLabel(eq, locale)} — {eq.displayRu}
            </option>
          ))}
        </select>
      </label>

      <p className={styles.hintLine}>{hintLabel(target, locale)}</p>

      <div className={styles.eqBoard}>
        <div className={styles.eqSide}>
          <span className={styles.eqSideLabel}>{t('learn.research.eqBuilderLeft')}</span>
          <div className={styles.eqSlots}>
            {left.length === 0 ? (
              <span className={styles.eqEmpty}>{t('learn.research.eqBuilderDrop')}</span>
            ) : (
              left.map((tok, i) => (
                <button
                  key={`L-${tok}-${i}`}
                  type="button"
                  className={styles.eqToken}
                  onClick={() => moveToken(tok, 'left', i, 'bank')}
                  title={t('learn.research.eqBuilderReturn')}
                >
                  {tok}
                </button>
              ))
            )}
          </div>
          <div className={styles.eqSideActions}>
            <button
              type="button"
              className={styles.tool}
              disabled={bank.length === 0}
              onClick={() => {
                const tok = bank[0]
                if (tok == null) return
                moveToken(tok, 'bank', 0, 'left')
              }}
            >
              {t('learn.research.eqBuilderAddLeft')}
            </button>
          </div>
        </div>

        <span className={styles.eqArrow} aria-hidden>
          →
        </span>

        <div className={styles.eqSide}>
          <span className={styles.eqSideLabel}>{t('learn.research.eqBuilderRight')}</span>
          <div className={styles.eqSlots}>
            {right.length === 0 ? (
              <span className={styles.eqEmpty}>{t('learn.research.eqBuilderDrop')}</span>
            ) : (
              right.map((tok, i) => (
                <button
                  key={`R-${tok}-${i}`}
                  type="button"
                  className={styles.eqToken}
                  onClick={() => moveToken(tok, 'right', i, 'bank')}
                  title={t('learn.research.eqBuilderReturn')}
                >
                  {tok}
                </button>
              ))
            )}
          </div>
          <div className={styles.eqSideActions}>
            <button
              type="button"
              className={styles.tool}
              disabled={bank.length === 0}
              onClick={() => {
                const tok = bank[0]
                if (tok == null) return
                moveToken(tok, 'bank', 0, 'right')
              }}
            >
              {t('learn.research.eqBuilderAddRight')}
            </button>
          </div>
        </div>
      </div>

      <div className={styles.eqBank}>
        <span className={styles.eqSideLabel}>{t('learn.research.eqBuilderBank')}</span>
        <div className={styles.eqSlots}>
          {bank.map((tok, i) => (
            <div key={`B-${tok}-${i}`} className={styles.eqTokenRow}>
              <button
                type="button"
                className={styles.eqToken}
                onClick={() => moveToken(tok, 'bank', i, 'left')}
              >
                {tok}
              </button>
              <button
                type="button"
                className={styles.eqMini}
                onClick={() => moveToken(tok, 'bank', i, 'left')}
                title={t('learn.research.eqBuilderAddLeft')}
              >
                L
              </button>
              <button
                type="button"
                className={styles.eqMini}
                onClick={() => moveToken(tok, 'bank', i, 'right')}
                title={t('learn.research.eqBuilderAddRight')}
              >
                R
              </button>
            </div>
          ))}
        </div>
      </div>

      <p className={styles.eqPreview}>
        {left.length ? left.join(' + ') : '…'} → {right.length ? right.join(' + ') : '…'}
      </p>

      <div className={styles.toolbar}>
        <button type="button" className={`${styles.tool} ${styles.toolPrimary}`} onClick={check}>
          {t('learn.research.eqBuilderCheck')}
        </button>
        <button type="button" className={styles.tool} onClick={() => resetFor(target, pool)}>
          {t('learn.research.eqBuilderReset')}
        </button>
        {result === 'ok' ? (
          <span className={styles.statusOk}>{t('learn.research.eqBuilderOk')}</span>
        ) : null}
        {result === 'bad' ? (
          <span className={styles.statusBad}>{t('learn.research.eqBuilderBad')}</span>
        ) : null}
      </div>
    </div>
  )
}
