import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LearnAssistantPanel } from './LearnAssistantPanel'
import { LearnTheoryRich } from './LearnTheoryRich'
import { LearnVisual3DPanel } from './LearnVisual3DPanel'
import { LearnWorkspace } from './LearnWorkspace'
import type { LearnChapter, LearnGrade, LearnSection, LearnSlide } from '../../types/learn'
import {
  clearLastPosition,
  markSectionCompleted,
  readLearnProgress,
  setLastPosition,
} from '../../learn/learnProgressStorage'
import { learnSectionPathId } from '../../data/learnCurriculumUz'
import { useT, type MessageKey } from '../../i18n/useT'
import { compoundById } from '../../data/compounds'
import styles from '../../pages/LearnPage.module.css'

function slideVisualId(slide: LearnSlide, fallback?: string): string | undefined {
  if (slide.type === 'interactive3d') return slide.visualId
  if ('visualId' in slide && slide.visualId) return slide.visualId
  return fallback
}

function slideText(
  slide: LearnSlide,
  t: (key: MessageKey, params?: Readonly<Record<string, string | number>>) => string,
): { title: string; body: string } {
  switch (slide.type) {
    case 'theory':
    case 'example':
      return { title: t(slide.titleKey), body: t(slide.bodyKey) }
    case 'interactive3d':
      return { title: t('learn.preview3d'), body: t(slide.captionKey) }
    case 'checkpoint':
      return { title: t(slide.questionKey), body: '' }
    case 'practice':
      return { title: t('learn.practiceOpen'), body: '' }
    case 'labInvite':
      return { title: t('learn.tryLab'), body: t(slide.bodyKey) }
    default:
      return { title: '', body: '' }
  }
}

function richKeys(slide: LearnSlide): {
  bulletsKey?: MessageKey
  calloutKey?: MessageKey
  diagramKey?: MessageKey
} {
  if (slide.type !== 'theory' && slide.type !== 'example') return {}
  return {
    bulletsKey: slide.bulletsKey,
    calloutKey: slide.calloutKey,
    diagramKey: slide.type === 'theory' ? slide.diagramKey : undefined,
  }
}

export function LearnSectionRunner({
  grade,
  chapter,
  section,
  onRefresh,
}: {
  grade: LearnGrade
  chapter: LearnChapter
  section: LearnSection
  onRefresh: () => void
}) {
  const { t } = useT()
  const navigate = useNavigate()
  const [slideIndex, setSlideIndex] = useState(0)
  const [checkpointPick, setCheckpointPick] = useState<number | null>(null)
  const [doneBanner, setDoneBanner] = useState(false)
  const [mobileTab, setMobileTab] = useState<'theory' | '3d' | 'work' | 'assistant'>('theory')
  const [presentationMode, setPresentationMode] = useState(false)

  const slides = section.slides
  const slide = slides[slideIndex]!
  const pathId = learnSectionPathId(section)
  const accent = compoundById[chapter.totemCompoundId]?.accentColor ?? '#3dffec'
  const visualId = slideVisualId(slide, section.defaultVisualId)
  const { title: slideTitle, body: slideBody } = slideText(slide, t)
  const isLast = slideIndex >= slides.length - 1
  const progressPct = Math.round(((slideIndex + 1) / slides.length) * 100)

  const taskCategoryId = useMemo(() => {
    if (slide.type === 'practice') return slide.taskCategoryId
    return section.taskCategoryId
  }, [slide, section.taskCategoryId])

  useEffect(() => {
    const p = readLearnProgress()
    if (
      p.last?.gradeId === grade.id &&
      p.last.chapterId === chapter.id &&
      p.last.sectionId === section.id
    ) {
      setSlideIndex(Math.min(Math.max(0, p.last.slideIndex), slides.length - 1))
    } else {
      setSlideIndex(0)
    }
  }, [grade.id, chapter.id, section.id, slides.length])

  useEffect(() => {
    setLastPosition(grade.id, chapter.id, section.id, slideIndex)
    setCheckpointPick(null)
  }, [grade.id, chapter.id, section.id, slideIndex])

  useEffect(() => {
    if (slide.type === 'interactive3d') setMobileTab('3d')
  }, [slide.type, slideIndex])

  const goNext = useCallback(() => {
    if (slide.type === 'checkpoint' && checkpointPick === null) return
    if (isLast) {
      markSectionCompleted(pathId)
      clearLastPosition()
      onRefresh()
      setDoneBanner(true)
      return
    }
    setSlideIndex((i) => Math.min(i + 1, slides.length - 1))
  }, [checkpointPick, isLast, onRefresh, pathId, slide.type, slides.length])

  const goPrev = useCallback(() => {
    setDoneBanner(false)
    setSlideIndex((i) => Math.max(0, i - 1))
  }, [])

  if (doneBanner) {
    return (
      <div className={styles.page}>
        <Link className={styles.backLink} to={`/learn/g/${grade.id}/c/${chapter.id}`}>
          {t('learn.backChapters')}
        </Link>
        <h1 className={styles.h}>{t('learn.sectionDone')}</h1>
        <p className={styles.lead}>{t('learn.sectionDoneLead')}</p>
        <div className={styles.footerNav}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => navigate(`/learn/g/${grade.id}/c/${chapter.id}`)}
          >
            {t('learn.sectionsTitle')}
          </button>
        </div>
      </div>
    )
  }

  const rich = richKeys(slide)

  const theoryCol = (
    <div className={styles.learnSlideCol}>
      <div className={styles.learnProgressBar} aria-hidden>
        <div className={styles.learnProgressFill} style={{ width: `${progressPct}%` }} />
      </div>
      <p className={styles.learnSlideMeta}>
        {t('learn.section.kp', { n: section.kpNumber })} · {t('learn.slideDeck')} {slideIndex + 1}/
        {slides.length}
      </p>
      <nav className={styles.learnSlideNav} aria-label={t('learn.slideDeck')}>
        {slides.map((s, i) => (
          <button
            key={s.id}
            type="button"
            className={`${styles.learnSlideTab} ${i === slideIndex ? styles.learnSlideTabOn : ''}`}
            onClick={() => setSlideIndex(i)}
          >
            {i + 1}
          </button>
        ))}
      </nav>
      <h2 className={styles.stepTitle}>{slideTitle}</h2>
      {slideBody ? <p className={styles.stepBody}>{slideBody}</p> : null}
      <LearnTheoryRich {...rich} />
      {slide.type === 'checkpoint' ? (
        <ul className={styles.taskMcqList}>
          {slide.choiceKeys.map((key, idx) => (
            <li key={key}>
              <button
                type="button"
                className={`${styles.taskMcqBtn} ${
                  checkpointPick === idx
                    ? idx === slide.correctIndex
                      ? styles.taskMcqCorrect
                      : styles.taskMcqWrong
                    : ''
                }`}
                onClick={() => setCheckpointPick(idx)}
              >
                {t(key)}
              </button>
            </li>
          ))}
          {checkpointPick !== null ? (
            <p className={checkpointPick === slide.correctIndex ? styles.taskOk : styles.taskBad}>
              {checkpointPick === slide.correctIndex
                ? t('learn.checkpointCorrect')
                : t('learn.checkpointWrong')}
            </p>
          ) : null}
        </ul>
      ) : null}
      {slide.type === 'labInvite' ? (
        <Link className={styles.labLink} to="/">
          {t('learn.tryLab')}
        </Link>
      ) : null}
      <div className={styles.footerNav}>
        <button type="button" className={styles.btn} onClick={goPrev} disabled={slideIndex === 0}>
          {t('learn.prev')}
        </button>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={goNext}>
          {isLast ? t('learn.finish') : t('learn.next')}
        </button>
      </div>
    </div>
  )

  const layoutClass = [
    styles.learnLessonLayout,
    presentationMode ? styles.learnLessonLayoutPresent : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={`${styles.page} ${presentationMode ? styles.learnPagePresent : ''}`}>
      <Link className={styles.backLink} to={`/learn/g/${grade.id}/c/${chapter.id}`}>
        {t('learn.backChapters')}
      </Link>
      <header className={styles.lessonHeader}>
        <div className={styles.lessonHeaderRow}>
          <div>
            <h1 className={styles.lessonTitle}>{t(section.titleKey)}</h1>
            <p className={styles.lessonEst}>{t('learn.estimatedMin', { n: section.estimatedMin })}</p>
          </div>
          <button
            type="button"
            className={presentationMode ? styles.learnPresentBtnOn : styles.learnPresentBtn}
            onClick={() => setPresentationMode((v) => !v)}
            title={presentationMode ? t('learn.present.hint') : t('learn.present.hint')}
          >
            {presentationMode ? t('learn.present.off') : t('learn.present.on')}
          </button>
        </div>
      </header>

      <div className={styles.learnMobileTabs} role="tablist">
        {(['theory', '3d', 'work', 'assistant'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={mobileTab === tab}
            className={mobileTab === tab ? styles.learnMobileTabOn : styles.learnMobileTab}
            onClick={() => setMobileTab(tab)}
          >
            {t(
              tab === 'theory'
                ? 'learn.lesson.tabTheory'
                : tab === '3d'
                  ? 'learn.lesson.tab3d'
                  : tab === 'work'
                    ? 'learn.lesson.tabWork'
                    : 'learn.lesson.tabAssistant',
            )}
          </button>
        ))}
      </div>

      <div className={layoutClass}>
        <div
          className={`${styles.learnColTheory} ${mobileTab !== 'theory' ? styles.learnColHideMobile : ''}`}
        >
          {theoryCol}
        </div>
        <div className={`${styles.learnCol3d} ${mobileTab !== '3d' ? styles.learnColHideMobile : ''}`}>
          <LearnVisual3DPanel
            visualId={visualId}
            fallbackAccent={accent}
            presentationMode={presentationMode}
          />
        </div>
        {!presentationMode ? (
          <>
            <div
              className={`${styles.learnColWork} ${mobileTab !== 'work' ? styles.learnColHideMobile : ''}`}
            >
              <LearnWorkspace sectionPathId={pathId} taskCategoryId={taskCategoryId} />
            </div>
            <div
              className={`${styles.learnColAssistant} ${mobileTab !== 'assistant' ? styles.learnColHideMobile : ''}`}
            >
              <LearnAssistantPanel
                gradeId={grade.id}
                chapterId={chapter.id}
                section={section}
                slideIndex={slideIndex}
                slideTitle={slideTitle}
                slideBody={slideBody}
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
