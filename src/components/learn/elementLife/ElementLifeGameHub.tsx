import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ELEMENT_LIFE_CARDS,
  getElementLifeCard,
  pickQuizDistractors,
  shuffleArray,
  type ElementRealLifeCard,
} from '../../../data/elementRealLife'
import { ELEMENT_NAMES_UZ } from '../../../data/elementNamesUz'
import { useLocale } from '../../../i18n/useLocale'
import type { AppLocale } from '../../../i18n/types'
import { useT } from '../../../i18n/useT'
import styles from './ElementLifeGameHub.module.css'

type Mode = 'learn' | 'quiz'
type InfoTab = 'appearance' | 'uses' | 'extraction'

const VIEWED_KEY = 'atomlab.elementLife.viewed'

function loadViewed(): Set<number> {
  try {
    const raw = localStorage.getItem(VIEWED_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as number[])
  } catch {
    return new Set()
  }
}

function saveViewed(set: Set<number>) {
  localStorage.setItem(VIEWED_KEY, JSON.stringify([...set]))
}

function cardLabel(card: ElementRealLifeCard, locale: AppLocale): string {
  if (locale === 'en') return card.nameEn
  if (locale === 'uz') return ELEMENT_NAMES_UZ[card.z - 1] ?? card.nameEn
  return card.nameRu
}

function cardCaption(card: ElementRealLifeCard, locale: AppLocale): string {
  if (locale === 'uz') return card.captionEn
  return locale === 'en' ? card.captionEn : card.captionRu
}

function ElementLifeCardModal({
  card,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: {
  card: ElementRealLifeCard
  onClose: () => void
  onPrev: () => void
  onNext: () => void
  hasPrev: boolean
  hasNext: boolean
}) {
  const { locale } = useLocale()
  const { t } = useT()
  const [tab, setTab] = useState<InfoTab>('appearance')

  const appearance = locale === 'ru' ? card.appearanceRu : card.appearanceEn
  const uses = locale === 'ru' ? card.usesRu : card.usesEn
  const extraction = locale === 'ru' ? card.extractionRu : card.extractionEn

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && hasPrev) onPrev()
      if (e.key === 'ArrowRight' && hasNext) onNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onPrev, onNext, hasPrev, hasNext])

  return (
    <div className={styles.modalBackdrop} role="presentation" onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal
        aria-labelledby="el-life-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHero}>
          <img src={card.image} alt={cardLabel(card, locale)} loading="lazy" />
          <div className={styles.modalHeroOverlay}>
            <h2 id="el-life-modal-title" className={styles.modalHeroTitle}>
              {card.z}. {cardLabel(card, locale)} ({card.symbol})
            </h2>
            <p className={styles.modalHeroSub}>{cardCaption(card, locale)}</p>
          </div>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.infoTabs}>
            {(['appearance', 'uses', 'extraction'] as const).map((id) => (
              <button
                key={id}
                type="button"
                className={`${styles.infoTab} ${tab === id ? styles.infoTabActive : ''}`}
                onClick={() => setTab(id)}
              >
                {t(`learn.elements.life.tab.${id}`)}
              </button>
            ))}
          </div>
          {tab === 'appearance' ? <p className={styles.infoText}>{appearance}</p> : null}
          {tab === 'uses' ? (
            <ul className={styles.usesList}>
              {(uses as readonly string[]).map((u: string) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
          ) : null}
          {tab === 'extraction' ? <p className={styles.infoText}>{extraction}</p> : null}
          <div className={styles.modalActions}>
            <button type="button" className={styles.btn} onClick={onPrev} disabled={!hasPrev}>
              ← {t('learn.elements.life.prev')}
            </button>
            <button type="button" className={styles.btn} onClick={onClose}>
              {t('learn.elements.life.close')}
            </button>
            <button type="button" className={styles.btn} onClick={onNext} disabled={!hasNext}>
              {t('learn.elements.life.next')} →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ElementLifeQuiz({
  minViewed,
  viewedCount,
}: {
  minViewed: number
  viewedCount: number
}) {
  const { locale } = useLocale()
  const { t } = useT()
  const [round, setRound] = useState(0)
  const [score, setScore] = useState(0)
  const [answered, setAnswered] = useState(false)
  const [pickedZ, setPickedZ] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<'ok' | 'bad' | null>(null)

  const question = useMemo(() => {
    const correct = ELEMENT_LIFE_CARDS[round % ELEMENT_LIFE_CARDS.length]!
    const distractors = pickQuizDistractors(correct.z, 3).map((z) => getElementLifeCard(z)!)
    const options = shuffleArray([correct, ...distractors])
    return { correct, options }
  }, [round])

  const onPick = (z: number) => {
    if (answered) return
    setPickedZ(z)
    setAnswered(true)
    const ok = z === question.correct.z
    setFeedback(ok ? 'ok' : 'bad')
    if (ok) setScore((s) => s + 1)
  }

  const nextRound = () => {
    setRound((r) => r + 1)
    setAnswered(false)
    setPickedZ(null)
    setFeedback(null)
  }

  if (viewedCount < minViewed) {
    return (
      <p className={styles.lockedHint}>
        {t('learn.elements.life.quizLocked', {
          viewed: String(viewedCount),
          need: String(minViewed),
        })}
      </p>
    )
  }

  return (
    <div className={styles.quizWrap}>
      <div className={styles.quizScore}>
        {t('learn.elements.life.quizScore', {
          score: String(score),
          round: String(round + 1),
        })}
      </div>
      <div className={styles.quizPhoto}>
        <img
          src={question.correct.image}
          alt={t('learn.elements.life.quizPhotoAlt')}
          loading="eager"
        />
      </div>
      <p className={styles.quizPrompt}>{t('learn.elements.life.quizPrompt')}</p>
      <div className={styles.quizOptions}>
        {question.options.map((opt) => {
          let cls = styles.quizOption
          if (answered && opt.z === question.correct.z) cls += ` ${styles.quizOptionCorrect}`
          else if (answered && pickedZ === opt.z && opt.z !== question.correct.z)
            cls += ` ${styles.quizOptionWrong}`
          return (
            <button
              key={opt.z}
              type="button"
              className={cls}
              disabled={answered}
              onClick={() => onPick(opt.z)}
            >
              {opt.z}. {cardLabel(opt, locale)}
            </button>
          )
        })}
      </div>
      <div
        className={`${styles.quizFeedback} ${
          feedback === 'ok' ? styles.quizFeedbackOk : feedback === 'bad' ? styles.quizFeedbackBad : ''
        }`}
      >
        {feedback === 'ok'
          ? t('learn.elements.life.quizCorrect')
          : feedback === 'bad'
            ? t('learn.elements.life.quizWrong', {
                name: cardLabel(question.correct, locale),
              })
            : ''}
      </div>
      <div className={styles.quizActions}>
        {answered ? (
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={nextRound}>
            {t('learn.elements.life.quizNext')}
          </button>
        ) : null}
      </div>
    </div>
  )
}

export function ElementLifeGameHub() {
  const { locale } = useLocale()
  const { t } = useT()
  const [mode, setMode] = useState<Mode>('learn')
  const [search, setSearch] = useState('')
  const [detailZ, setDetailZ] = useState<number | null>(null)
  const [viewed, setViewed] = useState<Set<number>>(() => loadViewed())

  const minViewedForQuiz = 8

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return ELEMENT_LIFE_CARDS
    return ELEMENT_LIFE_CARDS.filter(
      (c) =>
        c.symbol.toLowerCase().includes(q) ||
        c.nameRu.toLowerCase().includes(q) ||
        c.nameEn.toLowerCase().includes(q) ||
        String(c.z).includes(q),
    )
  }, [search])

  const detailCard = detailZ != null ? getElementLifeCard(detailZ) : null
  const detailIndex = detailZ != null ? filtered.findIndex((c) => c.z === detailZ) : -1

  const markViewed = useCallback((z: number) => {
    setViewed((prev) => {
      if (prev.has(z)) return prev
      const next = new Set(prev)
      next.add(z)
      saveViewed(next)
      return next
    })
  }, [])

  const openCard = (z: number) => {
    markViewed(z)
    setDetailZ(z)
  }

  return (
    <div className={styles.learnElementLife} style={{ ['--el-accent' as string]: '#5cffd4' }}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <span className={styles.badge}>{t('learn.elements.life.badge')}</span>
          <h2 className={styles.title}>{t('learn.elements.life.title')}</h2>
          <p className={styles.subtitle}>{t('learn.elements.life.subtitle')}</p>
        </div>
        <div className={styles.modeTabs}>
          <button
            type="button"
            className={`${styles.modeBtn} ${mode === 'learn' ? styles.modeBtnActive : ''}`}
            onClick={() => setMode('learn')}
          >
            {t('learn.elements.life.modeLearn')}
          </button>
          <button
            type="button"
            className={`${styles.modeBtn} ${mode === 'quiz' ? styles.modeBtnActive : ''}`}
            onClick={() => setMode('quiz')}
          >
            {t('learn.elements.life.modeQuiz')}
          </button>
        </div>
      </header>

      <div className={styles.body}>
        {mode === 'learn' ? (
          <>
            <div className={styles.learnToolbar}>
              <input
                type="search"
                className={styles.search}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('learn.elements.life.search')}
                aria-label={t('learn.elements.life.search')}
              />
              <span className={styles.progress}>
                {t('learn.elements.life.viewed', {
                  count: String(viewed.size),
                  total: '118',
                })}
              </span>
            </div>
            <div className={styles.grid}>
              {filtered.map((card) => (
                <button
                  key={card.z}
                  type="button"
                  className={styles.card}
                  onClick={() => openCard(card.z)}
                >
                  <div className={styles.cardImgWrap}>
                    <img
                      className={styles.cardImg}
                      src={card.image}
                      alt={cardLabel(card, locale)}
                      loading="lazy"
                    />
                    <span className={styles.cardZ}>{card.z}</span>
                    <span className={styles.cardSym}>{card.symbol}</span>
                  </div>
                  <div className={styles.cardMeta}>
                    <p className={styles.cardName}>{cardLabel(card, locale)}</p>
                    <p className={styles.cardCaption}>{cardCaption(card, locale)}</p>
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <ElementLifeQuiz minViewed={minViewedForQuiz} viewedCount={viewed.size} />
        )}
      </div>

      {detailCard ? (
        <ElementLifeCardModal
          card={detailCard}
          onClose={() => setDetailZ(null)}
          hasPrev={detailIndex > 0}
          hasNext={detailIndex >= 0 && detailIndex < filtered.length - 1}
          onPrev={() => {
            const prev = filtered[detailIndex - 1]
            if (prev) openCard(prev.z)
          }}
          onNext={() => {
            const next = filtered[detailIndex + 1]
            if (next) openCard(next.z)
          }}
        />
      ) : null}
    </div>
  )
}
