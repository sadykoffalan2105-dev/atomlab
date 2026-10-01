/**
 * Выбор реакции в реакторе — только из 200 основных (docs/plans/reactions-top200.md, п. 2).
 * Шторка справа: поиск (формула или название), тип, класс; уравнение показано без коэффициентов —
 * после выбора вещества встают в реактор с коэффициентами 1, ученику остаётся только уравнять.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMainReactionSearch } from '../catalog/mainReactionSearch'
import {
  MAIN_REACTIONS_200,
  MAIN_REACTION_TYPE_ORDER,
  mainReactionSkeleton,
  type MainReaction,
  type MainReactionType,
} from '../../data/catalog/mainReactions'
import type { MessageKey } from '../../i18n/useT'
import { useT } from '../../i18n/useT'
import styles from './MainReactionPicker.module.css'

const TYPE_TONE: Record<MainReactionType, string> = {
  combination: '#38bdf8',
  decomposition: '#f97316',
  substitution: '#a78bfa',
  exchange: '#34d399',
  neutralization: '#2dd4bf',
  combustion: '#fb7185',
  redox: '#fbbf24',
}

const typeKey = (type: MainReactionType) => `learn.book.rx.type.${type}` as MessageKey

export function MainReactionPicker({
  open,
  onClose,
  onPick,
  currentId,
  preferIds,
}: {
  open: boolean
  onClose: () => void
  onPick: (r: MainReaction) => void
  /** Реакция, которая сейчас в реакторе — подсвечена. */
  currentId?: string | null
  /** Сначала — реакции урока (раздел учебника), если есть. */
  preferIds?: readonly string[] | null
}) {
  const { locale, t } = useT()
  const [q, setQ] = useState('')
  const [type, setType] = useState<MainReactionType | 'all'>('all')
  const searchRef = useRef<HTMLInputElement>(null)
  const matches = useMainReactionSearch(q, locale, t)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    // фокус в поиск — на телефоне без клавиатуры сразу не открываем
    if (window.matchMedia?.('(pointer: fine)').matches) searchRef.current?.focus({ preventScroll: true })
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const searched = useMemo(() => MAIN_REACTIONS_200.filter(matches), [matches])
  const counts = useMemo(() => {
    const m = new Map<MainReactionType, number>()
    for (const r of searched) m.set(r.type, (m.get(r.type) ?? 0) + 1)
    return m
  }, [searched])
  const groups = useMemo(() => {
    const list = type === 'all' ? searched : searched.filter((r) => r.type === type)
    const prefer = new Set(preferIds ?? [])
    const out: { key: string; title: string; items: MainReaction[] }[] = []
    if (prefer.size > 0 && type === 'all' && !q) {
      const lesson = list.filter((r) => prefer.has(r.id))
      if (lesson.length) out.push({ key: 'lesson', title: t('reactor.pick.lesson'), items: lesson })
    }
    for (const tp of MAIN_REACTION_TYPE_ORDER) {
      const items = list.filter((r) => r.type === tp)
      if (items.length) out.push({ key: tp, title: t(typeKey(tp)), items })
    }
    return out
  }, [searched, type, preferIds, q, t])
  const shown = type === 'all' ? searched.length : (counts.get(type) ?? 0)

  if (!open) return null

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} aria-hidden data-app-night="" />
      {/* Лаборатория тёмная в обеих темах: шторка — «ночной остров» (src/theme/appTheme.css). */}
      <section
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="main-rx-picker-title"
        data-main-rx-picker=""
        data-app-night=""
      >
        <header className={styles.head}>
          <div className={styles.headText}>
            <h2 id="main-rx-picker-title" className={styles.title}>
              {t('reactor.pick.title')}
            </h2>
            <p className={styles.lead}>{t('reactor.pick.lead')}</p>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label={t('reactor.pick.close')} title={t('reactor.pick.close')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M7 7l10 10M17 7L7 17" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className={styles.tools}>
          <label className={styles.search}>
            <svg className={styles.searchIcon} viewBox="0 0 20 20" fill="none" aria-hidden>
              <circle cx="8.6" cy="8.6" r="5.6" stroke="currentColor" strokeWidth="1.7" />
              <path d="m12.8 12.8 4.2 4.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
            <input
              ref={searchRef}
              className={styles.searchInput}
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('reactor.pick.search')}
              aria-label={t('reactor.pick.search')}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <div className={styles.chips} role="group" aria-label={t('catalog.reactionClassAria')}>
            <button
              type="button"
              className={type === 'all' ? `${styles.chip} ${styles.chipOn}` : styles.chip}
              aria-pressed={type === 'all'}
              onClick={() => setType('all')}
            >
              {t('reactor.pick.all')}
              <span className={styles.chipCount}>{searched.length}</span>
            </button>
            {MAIN_REACTION_TYPE_ORDER.map((tp) => {
              const n = counts.get(tp) ?? 0
              return (
                <button
                  key={tp}
                  type="button"
                  className={type === tp ? `${styles.chip} ${styles.chipOn}` : styles.chip}
                  aria-pressed={type === tp}
                  disabled={n === 0 && type !== tp}
                  style={{ ['--tone' as string]: TYPE_TONE[tp] }}
                  onClick={() => setType(type === tp ? 'all' : tp)}
                >
                  <span className={styles.dot} aria-hidden />
                  {t(typeKey(tp))}
                  <span className={styles.chipCount}>{n}</span>
                </button>
              )
            })}
          </div>
          <p className={styles.count} role="status">
            {t('reactor.pick.count', { count: shown })}
          </p>
        </div>

        <div className={styles.list}>
          {groups.length === 0 ? <p className={styles.empty}>{t('reactor.pick.empty')}</p> : null}
          {groups.map((g) => (
            <section key={g.key} className={styles.group}>
              <h3 className={styles.groupTitle}>
                {g.title}
                <span className={styles.groupCount}>{g.items.length}</span>
              </h3>
              <ul className={styles.rows}>
                {g.items.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      className={r.id === currentId ? `${styles.row} ${styles.rowOn}` : styles.row}
                      style={{ ['--tone' as string]: TYPE_TONE[r.type] }}
                      onClick={() => onPick(r)}
                      data-main-rx-pick={r.id}
                    >
                      <span className={styles.eq}>{mainReactionSkeleton(r.equation)}</span>
                      <span className={styles.meta}>
                        <span className={styles.dot} aria-hidden />
                        {r.titleRu && locale === 'ru' ? <span className={styles.metaTitle}>{r.titleRu}</span> : <span>{t(typeKey(r.type))}</span>}
                        {r.qualitative ? <span className={styles.badge}>{t('catalog.rx.qualitative', { ion: r.qualitative })}</span> : null}
                      </span>
                      <span className={styles.go} aria-hidden>
                        {t('reactor.pick.open')} →
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>
    </>
  )
}
