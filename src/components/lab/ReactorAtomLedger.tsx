import { useEffect, useMemo, useRef, useState } from 'react'
import { getElementByZ } from '../../data/elements'
import { compoundById } from '../../data/compounds'
import type { MessageKey } from '../../i18n/messagesRu'
import { useT } from '../../i18n/useT'
import type { ReactorEquationTerm } from '../../chemistry/reactorEquationBalance'
import type { ReactorCoProductTerm } from '../../chemistry/scientificReactorRecipes'
import type { CompoundDef } from '../../types/chemistry'
import {
  buildAtomLedger,
  leftTermsComposition,
  rightSideComposition,
  type AtomLedger,
} from '../../lab/reactorParticles'
import styles from './ReactorAtomLedger.module.css'

/**
 * Счётчик атомов над знаком «=/→»: строки по элементам «Na 2 | 2».
 * Красное состояние, пока слева и справа не сошлось, зелёное — когда сошлось,
 * и общая подсветка «атомов слева = справа». Каждое ± коэффициента комментируется
 * строкой в aria-live («Добавили молекулу Cl₂ — Cl: 4 слева, 2 справа…»).
 * Состав реагентов с compoundId — из каталога (reactorParticles.termUnitComposition).
 */

type LedgerInput = {
  leftTerms: readonly ReactorEquationTerm[]
  coProducts: readonly ReactorCoProductTerm[]
  productCompound: CompoundDef | null
  productCoeff: number
}

function termFormula(t: { z?: number; compoundId?: string; diatomic?: boolean }): string {
  if (t.compoundId) return compoundById[t.compoundId]?.formulaUnicode ?? t.compoundId
  const sym = t.z != null ? getElementByZ(t.z)?.symbol : undefined
  if (!sym) return '—'
  return t.diatomic ? `${sym}₂` : sym
}

/** Снимок коэффициентов: ключ → [коэффициент, формула, вид члена]. */
type Snapshot = Map<string, { coeff: number; formula: string; kind: 'molecule' | 'atom' | 'unit' | 'right' }>

function snapshotOf(input: LedgerInput): Snapshot {
  const m: Snapshot = new Map()
  for (const t of input.leftTerms) {
    const kind = t.compoundId ? 'unit' : t.diatomic ? 'molecule' : 'atom'
    m.set(`l:${t.id}`, { coeff: Math.max(0, Math.floor(t.coeff)), formula: termFormula(t), kind })
  }
  for (const cp of input.coProducts) {
    m.set(`c:${cp.id}`, { coeff: Math.max(0, Math.floor(cp.coeff)), formula: termFormula(cp), kind: 'right' })
  }
  if (input.productCompound) {
    m.set('p', { coeff: Math.max(0, Math.floor(input.productCoeff)), formula: input.productCompound.formulaUnicode, kind: 'right' })
  }
  return m
}

/**
 * clearWhen: пока true (идёт синтез), комментарий к прошлому ± сброшен — после синтеза он не
 * возвращается устаревшим.
 */
export function useAtomLedger(input: LedgerInput, clearWhen = false): { ledger: AtomLedger; comment: string } {
  const { t } = useT()
  const { leftTerms, coProducts, productCompound, productCoeff } = input
  const ledger = useMemo(
    () => buildAtomLedger(leftTermsComposition(leftTerms), rightSideComposition(productCompound, productCoeff, coProducts)),
    [leftTerms, coProducts, productCompound, productCoeff],
  )
  const [comment, setComment] = useState('')
  const prevRef = useRef<Snapshot | null>(null)

  useEffect(() => {
    const snap = snapshotOf({ leftTerms, coProducts, productCompound, productCoeff })
    const prev = prevRef.current
    prevRef.current = snap
    if (!prev) return
    // Какой член изменился: первый по порядку уравнения (левые раньше правых).
    // Смена состава уравнения (член добавлен/убран) — не ±, комментарий не пишем.
    if (prev.size !== snap.size) return
    let changed: { delta: number; formula: string; kind: string; coeff: number } | null = null
    for (const [key, cur] of snap) {
      const was = prev.get(key)
      if (!was) return
      if (!changed && was.coeff !== cur.coeff) {
        changed = { delta: cur.coeff - was.coeff, formula: cur.formula, kind: cur.kind, coeff: cur.coeff }
      }
    }
    if (!changed) return
    const add = changed.delta > 0
    const actionKey: MessageKey =
      changed.kind === 'right'
        ? 'reactor.ledger.rightNow'
        : changed.kind === 'molecule'
          ? add
            ? 'reactor.ledger.addMolecule'
            : 'reactor.ledger.removeMolecule'
          : changed.kind === 'unit'
            ? add
              ? 'reactor.ledger.addUnit'
              : 'reactor.ledger.removeUnit'
            : add
              ? 'reactor.ledger.addAtom'
              : 'reactor.ledger.removeAtom'
    const action = t(actionKey, { formula: changed.formula, coeff: changed.coeff })
    const counts = ledger.rows
      .map((r) => t('reactor.ledger.count', { el: r.el, left: r.left, right: r.right }))
      .join('; ')
    const status = ledger.balanced ? t('reactor.ledger.equal') : t('reactor.ledger.notEqual')
    setComment(`${action} — ${counts}: ${status}`)
  }, [leftTerms, coProducts, productCompound, productCoeff, ledger, t])

  useEffect(() => {
    if (clearWhen) setComment('')
  }, [clearWhen])

  return { ledger, comment }
}

/** Таблица «элемент | слева | справа» над знаком уравнения. */
export function ReactorAtomLedger({ ledger }: { ledger: AtomLedger }) {
  const { t } = useT()
  const [flash, setFlash] = useState(false)
  const wasBalanced = useRef(ledger.balanced)
  useEffect(() => {
    if (ledger.balanced && !wasBalanced.current) {
      setFlash(true)
      const id = window.setTimeout(() => setFlash(false), 1400)
      wasBalanced.current = true
      return () => window.clearTimeout(id)
    }
    wasBalanced.current = ledger.balanced
    return undefined
  }, [ledger.balanced])

  if (ledger.rows.length === 0) return null
  return (
    <div
      className={styles.ledger}
      data-balanced={ledger.balanced ? 'true' : 'false'}
      data-flash={flash ? 'true' : undefined}
      role="group"
      aria-label={t('reactor.ledger.aria')}
      data-reactor-ledger=""
    >
      <table className={styles.table}>
        <tbody>
          {ledger.rows.map((r) => (
            <tr
              key={r.el}
              className={r.ok ? styles.rowOk : styles.rowBad}
              aria-label={t('reactor.ledger.row', { el: r.el, left: r.left, right: r.right })}
            >
              <th scope="row" className={styles.el}>
                {r.el}
              </th>
              <td className={styles.n}>{r.left}</td>
              <td className={styles.bar} aria-hidden>
                |
              </td>
              <td className={styles.n}>{r.right}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <span className={styles.state}>{ledger.balanced ? t('reactor.ledger.balanced') : t('reactor.ledger.unbalanced')}</span>
    </div>
  )
}

/** Строка-комментарий к последнему ± (видимая и для экранного диктора). */
export function ReactorLedgerComment({ text, balanced }: { text: string; balanced: boolean }) {
  return (
    <p className={styles.comment} data-balanced={balanced ? 'true' : 'false'} aria-live="polite" role="status" data-reactor-ledger-comment="">
      {text}
    </p>
  )
}
