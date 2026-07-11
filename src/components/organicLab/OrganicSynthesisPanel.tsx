import { useMemo, useState } from 'react'
import {
  bagFormulaUnicode,
  matchOrganicByComposition,
  type AtomBag,
} from '../../data/organicLab/organicCompositionMatch'
import type { OrganicMoleculeDef } from '../../data/organicLab/organicMoleculeTypes'
import { useLocale } from '../../i18n/useLocale'
import { useT } from '../../i18n/useT'
import styles from './OrganicSynthesisPanel.module.css'

const ATOMS = [
  { el: 'C' as const, color: '#909090', label: 'C' },
  { el: 'H' as const, color: '#ffffff', label: 'H' },
  { el: 'O' as const, color: '#ff0d0d', label: 'O' },
  { el: 'N' as const, color: '#3050f8', label: 'N' },
  { el: 'Cl' as const, color: '#1ff01f', label: 'Cl' },
]

function pickName(m: OrganicMoleculeDef, locale: string) {
  if (locale === 'en') return m.nameEn
  if (locale === 'uz') return m.nameUz
  return m.nameRu
}

const emptyBag = (): AtomBag => ({ C: 0, H: 0, O: 0, N: 0, Cl: 0 })

export function OrganicSynthesisPanel({
  onProduct,
}: {
  onProduct: (mol: OrganicMoleculeDef) => void
}) {
  const { t } = useT()
  const { locale } = useLocale()
  const [bag, setBag] = useState<AtomBag>(emptyBag)
  const [picked, setPicked] = useState<OrganicMoleculeDef[]>([])
  const [msg, setMsg] = useState('')

  const formula = useMemo(() => bagFormulaUnicode(bag), [bag])
  const total = useMemo(
    () => Object.values(bag).reduce((s, n) => s + (n ?? 0), 0),
    [bag],
  )

  const add = (el: keyof AtomBag) => {
    setBag((b) => ({ ...b, [el]: (b[el] ?? 0) + 1 }))
    setMsg('')
    setPicked([])
  }

  const sub = (el: keyof AtomBag) => {
    setBag((b) => ({ ...b, [el]: Math.max(0, (b[el] ?? 0) - 1) }))
    setMsg('')
    setPicked([])
  }

  const reset = () => {
    setBag(emptyBag())
    setPicked([])
    setMsg('')
  }

  const run = () => {
    if (total === 0) {
      setMsg(t('organicLab.synthNeedAtoms'))
      setPicked([])
      return
    }
    const hits = matchOrganicByComposition(bag)
    setPicked(hits)
    if (hits.length === 0) {
      setMsg(t('organicLab.synthNoMatch', { f: formula }))
      return
    }
    if (hits.length === 1) {
      setMsg(t('organicLab.synthOk', { name: pickName(hits[0]!, locale), f: formula }))
      onProduct(hits[0]!)
      return
    }
    setMsg(t('organicLab.synthIsomers', { n: hits.length, f: formula }))
  }

  return (
    <section className={styles.panel} aria-label={t('organicLab.synthAria')}>
      <div className={styles.head}>
        <h3 className={styles.title}>{t('organicLab.synthTitle')}</h3>
        <p className={styles.hint}>{t('organicLab.synthHint')}</p>
      </div>

      <div className={styles.atoms} role="group" aria-label={t('organicLab.synthAtoms')}>
        {ATOMS.map((a) => (
          <div key={a.el} className={styles.atomCard}>
            <button
              type="button"
              className={styles.atomOrb}
              style={{
                ['--atom' as string]: a.color,
                color: a.el === 'H' ? '#0f172a' : '#fff',
              }}
              onClick={() => add(a.el)}
              title={t('organicLab.synthAdd', { el: a.label })}
            >
              {a.label}
            </button>
            <div className={styles.atomCtrl}>
              <button type="button" className={styles.mini} onClick={() => sub(a.el)} disabled={!bag[a.el]}>
                −
              </button>
              <span className={styles.count}>{bag[a.el] ?? 0}</span>
              <button type="button" className={styles.mini} onClick={() => add(a.el)}>
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.formulaRow}>
        <span className={styles.formulaLabel}>{t('organicLab.synthBag')}</span>
        <code className={styles.formula}>{formula}</code>
        <span className={styles.total}>
          {t('organicLab.synthTotal', { n: total })}
        </span>
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={run}>
          {t('organicLab.synthRun')}
        </button>
        <button type="button" className={styles.ghost} onClick={reset}>
          {t('organicLab.synthReset')}
        </button>
      </div>

      {msg ? <p className={styles.msg}>{msg}</p> : null}

      {picked.length > 1 ? (
        <div className={styles.isomerRow}>
          {picked.map((m) => (
            <button
              key={m.id}
              type="button"
              className={styles.isomerBtn}
              onClick={() => {
                onProduct(m)
                setMsg(t('organicLab.synthOk', { name: pickName(m, locale), f: formula }))
              }}
            >
              {m.formula} · {pickName(m, locale)}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  )
}
