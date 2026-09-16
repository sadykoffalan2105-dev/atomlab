import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { learnChapterById, learnGradeById } from '../../../data/learnCurriculumUz'
import {
  loadReaderGrade,
  readerUnitById,
  unitsForAppChapter,
  type ReaderGrade,
  type ReaderGradeId,
  type ReaderUnit,
} from '../../../data/textbook/bookReader'
import { useT } from '../../../i18n/useT'
import { ReactionCard, ReactionChip } from './ReactionChip'
import { bookSectionKey, unitKpLabel, unitPagesLabel } from './bookUi'
import styles from './BookEquationsPanel.module.css'

type Props = {
  gradeId: ReaderGradeId
  /** Глава приложения («c1»), открытая в оглавлении PDF-читалки. */
  chapterId: string
  /** Активный раздел приложения (для подсветки параграфа, когда ?unit= не задан). */
  activeSectionId: string
  /** ?unit= — параграф, выбранный явно (в т.ч. по ссылке «назад» из лаборатории). */
  selectedUnitId: string | null
  /** ?rx= — реакция, к которой нужно прокрутить и подсветить. */
  highlightRxId: string | null
  /** Узкий экран: карточка реакции — нижний лист. */
  narrow: boolean
  /** Переход к параграфу: страница PDF + оглавление + ?unit=. */
  onOpenUnit: (unit: ReaderUnit) => void
}

type CardState = { unitId: string; index: number; anchor: HTMLElement }

/**
 * Вкладка «Уравнения» PDF-читалки: параграфы текущей главы с их реакциями (карточка ReactionChip → лаборатория,
 * «уравнять самому», каталог) и свёрнутый список всех тем с уравнениями.
 */
export function BookEquationsPanel({
  gradeId,
  chapterId,
  activeSectionId,
  selectedUnitId,
  highlightRxId,
  narrow,
  onOpenUnit,
}: Props) {
  const { t } = useT()
  const [loaded, setLoaded] = useState<{ id: string; grade: ReaderGrade | null; error: boolean } | null>(null)
  const [card, setCard] = useState<CardState | null>(null)
  const [flashId, setFlashId] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    loadReaderGrade(gradeId).then(
      (g) => {
        if (alive) setLoaded({ id: gradeId, grade: g, error: false })
      },
      () => {
        if (alive) setLoaded({ id: gradeId, grade: null, error: true })
      },
    )
    return () => {
      alive = false
    }
  }, [gradeId])

  const grade = loaded?.id === gradeId ? loaded.grade : null
  const error = loaded?.id === gradeId && loaded.error

  const chapter = learnChapterById(gradeId, chapterId)
  const appGrade = learnGradeById(gradeId)

  const units = useMemo(() => {
    if (!grade) return []
    const list = unitsForAppChapter(grade, chapterId)
    const selected = selectedUnitId ? readerUnitById(grade, selectedUnitId) : null
    if (selected && !list.some((u) => u.unitId === selected.unitId)) return [selected, ...list]
    return list
  }, [grade, chapterId, selectedUnitId])

  const currentUnitId = useMemo(() => {
    if (selectedUnitId) return selectedUnitId
    const key = bookSectionKey(gradeId, chapterId, activeSectionId)
    return units.find((u) => u.unitId === key || u.appSections.includes(key))?.unitId ?? null
  }, [activeSectionId, chapterId, gradeId, selectedUnitId, units])

  const chapterRxCount = units.reduce((s, u) => s + u.reactions.length, 0)

  /* ?rx= (ссылка «назад» из лаборатории): прокрутить к строке реакции и подсветить её. */
  useEffect(() => {
    if (!grade || !highlightRxId || !currentUnitId) return
    const root = rootRef.current
    const el = root?.querySelector<HTMLElement>(`[data-unit-id="${currentUnitId}"] [data-rx-id="${highlightRxId}"]`)
    if (!el) return
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    setFlashId(`${currentUnitId}/${highlightRxId}`)
    const timer = window.setTimeout(() => setFlashId(null), 3000)
    return () => window.clearTimeout(timer)
  }, [grade, highlightRxId, currentUnitId])

  /* Текущий параграф — в зоне видимости панели (без ?rx=). */
  useEffect(() => {
    if (!grade || !currentUnitId || highlightRxId) return
    const el = rootRef.current?.querySelector<HTMLElement>(`[data-unit-id="${currentUnitId}"]`)
    el?.scrollIntoView({ block: 'start' })
  }, [grade, currentUnitId, highlightRxId])

  const closeCard = useCallback(() => setCard(null), [])

  const cardUnit = card && grade ? readerUnitById(grade, card.unitId) : null
  const cardRx = card && cardUnit ? (cardUnit.reactions[card.index] ?? null) : null

  if (error) {
    return (
      <div className={styles.panel} ref={rootRef}>
        <p className={styles.status} role="alert">
          {t('learn.bookPanel.error')}
        </p>
      </div>
    )
  }
  if (!grade) {
    return (
      <div className={styles.panel} ref={rootRef}>
        <p className={styles.status}>{t('learn.bookPanel.loading')}</p>
      </div>
    )
  }

  return (
    <div className={styles.panel} ref={rootRef} data-book-panel>
      <header className={styles.head}>
        <h2 className={styles.chapterTitle}>{chapter ? t(chapter.titleKey) : t('learn.book.toc')}</h2>
        <p className={styles.chapterMeta}>{t('learn.bookPanel.chapterRx', { n: chapterRxCount })}</p>
      </header>

      {units.length === 0 ? <p className={styles.status}>{t('learn.bookPanel.noUnits')}</p> : null}

      <ol className={styles.unitList}>
        {units.map((u) => {
          const current = u.unitId === currentUnitId
          const kp = unitKpLabel(u, t)
          const pages = unitPagesLabel(u, t)
          return (
            <li key={u.unitId} className={styles.unit} data-unit-id={u.unitId} data-current={current || undefined}>
              <button
                type="button"
                className={styles.unitBtn}
                onClick={() => onOpenUnit(u)}
                aria-current={current ? 'true' : undefined}
                aria-label={t('learn.bookPanel.jumpAria', { title: `${kp ?? ''} ${u.title}`.trim() })}
                data-book-unit-btn={u.unitId}
              >
                {kp ? <span className={styles.unitKp}>{kp}</span> : null}
                <span className={styles.unitTitle}>{u.title}</span>
                {pages ? <span className={styles.unitPages}>{pages}</span> : null}
              </button>
              {u.reactions.length ? (
                <ul className={styles.rxList}>
                  {u.reactions.map((rx, i) => (
                    <li key={rx.id} className={styles.rxRow}>
                      <ReactionChip
                        rx={rx}
                        index={i}
                        open={!!card && card.unitId === u.unitId && card.index === i}
                        flash={flashId === `${u.unitId}/${rx.id}`}
                        onOpen={(index, anchor) =>
                          setCard((prev) =>
                            prev && prev.unitId === u.unitId && prev.index === index ? null : { unitId: u.unitId, index, anchor },
                          )
                        }
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.noRx}>{t('learn.bookPanel.noReactions')}</p>
              )}
            </li>
          )
        })}
      </ol>

      <details className={styles.allTopics}>
        <summary className={styles.allTopicsSummary}>{t('learn.bookPanel.allTopics')}</summary>
        <div className={styles.allTopicsBody}>
          {(appGrade?.chapters ?? []).map((ch) => {
            const chUnits = unitsForAppChapter(grade, ch.id).filter((u) => u.reactions.length > 0)
            if (!chUnits.length) return null
            return (
              <div key={ch.id} className={styles.topicChapter}>
                <p className={styles.topicChapterTitle}>{t(ch.titleKey)}</p>
                <ul className={styles.topicList}>
                  {chUnits.map((u) => (
                    <li key={u.unitId}>
                      <button
                        type="button"
                        className={styles.topicBtn}
                        onClick={() => onOpenUnit(u)}
                        aria-current={u.unitId === currentUnitId ? 'true' : undefined}
                      >
                        <span className={styles.topicKp}>{unitKpLabel(u, t) ?? '§'}</span>
                        <span className={styles.topicTitle}>{u.title}</span>
                        <span className={styles.topicCount}>{t('learn.bookPanel.rxCount', { n: u.reactions.length })}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </details>

      <ReactionCard
        rx={cardRx}
        gradeId={gradeId}
        unitId={card?.unitId ?? null}
        anchor={card?.anchor ?? null}
        sheet={narrow}
        contextLabel={cardUnit ? unitKpLabel(cardUnit, t) : null}
        onClose={closeCard}
      />
    </div>
  )
}
