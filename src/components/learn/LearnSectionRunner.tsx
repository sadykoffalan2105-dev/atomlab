import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LearnAssistantPanel } from './LearnAssistantPanel'
import { LearnTheoryRich } from './LearnTheoryRich'
import { LearnSlideDeckVisual } from './LearnSlideDeckVisual'
import { prefetchLearnImage } from './LearnSlideVisual'
import { LearnColumnExpandBtn } from './LearnColumnExpandBtn'
import { LearnWorkspace } from './LearnWorkspace'
import type { LearnChapter, LearnGrade, LearnSection, LearnSlide } from '../../types/learn'
import {
  clearLastPosition,
  markSectionCompleted,
  readLearnProgress,
  setLastPosition,
} from '../../learn/learnProgressStorage'
import { getLearnFgosMeta } from '../../data/learnFgosMatrix'
import { buildLabUrl, getLearnLabDeepLink } from '../../data/learnSectionLabLinks'
import { getExtraQuizzesForSection } from '../../data/learnSectionQuizzes'
import { learnNextSection, learnSectionPathId } from '../../data/learnCurriculumUz'
import { useT, type MessageKey } from '../../i18n/useT'
import { compoundById } from '../../data/compounds'
import styles from '../../pages/LearnPage.module.css'

function slideVisualId(slide: LearnSlide, fallback?: string): string | undefined {
  if (slide.type === 'interactive3d') return slide.visualId
  if (slide.type === 'visual') return fallback
  if ('visualId' in slide && slide.visualId) return slide.visualId
  return fallback
}

function slideText(
  slide: LearnSlide,
  t: (key: MessageKey, params?: Readonly<Record<string, string | number>>) => string,
): { title: string; body: string } {
  switch (slide.type) {
    case 'visual':
      return {
        title: t(slide.titleKey),
        body: slide.bodyKey ? t(slide.bodyKey) : '',
      }
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
  const [expandedPanel, setExpandedPanel] = useState<'3d' | 'work' | 'assistant' | null>(null)
  const [extraQuizIndex, setExtraQuizIndex] = useState(0)
  const [extraQuizPick, setExtraQuizPick] = useState<number | null>(null)
  const [extraQuizPassed, setExtraQuizPassed] = useState(false)

  const extraQuizzes = useMemo(
    () => getExtraQuizzesForSection(grade.id, chapter.id, section.id),
    [grade.id, chapter.id, section.id],
  )
  const fgosMeta = useMemo(
    () => getLearnFgosMeta(section.gradeId, chapter.id, section.id),
    [section.gradeId, chapter.id, section.id],
  )
  const labLink = useMemo(
    () => getLearnLabDeepLink(grade.id, chapter.id, section.id),
    [grade.id, chapter.id, section.id],
  )
  const nextSec = useMemo(
    () => learnNextSection(grade.id, chapter.id, section.id),
    [grade.id, chapter.id, section.id],
  )

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
    setExtraQuizIndex(0)
    setExtraQuizPick(null)
    setExtraQuizPassed(false)
  }, [grade.id, chapter.id, section.id, slideIndex])

  useEffect(() => {
    if (slide.type === 'interactive3d') setMobileTab('3d')
    if (slide.type === 'visual') setMobileTab('3d')
    if (slide.type === 'visual' && slide.image) prefetchLearnImage(slide.image)
    if (progressPct >= 80 && nextSec) {
      const nextVisual = `topic_${nextSec.gradeId}_${nextSec.chapterId}_${nextSec.sectionId}`
      prefetchLearnImage(`/learn/posters/${nextVisual}.png`)
    }
  }, [slide, slideIndex, progressPct, nextSec])

  const goNext = useCallback(() => {
    if (slide.type === 'checkpoint' && checkpointPick === null) return
    if (
      slide.type === 'checkpoint' &&
      extraQuizzes.length > 0 &&
      checkpointPick === slide.correctIndex &&
      !extraQuizPassed
    ) {
      return
    }
    if (isLast) {
      markSectionCompleted(pathId)
      clearLastPosition()
      onRefresh()
      setDoneBanner(true)
      return
    }
    setSlideIndex((i) => Math.min(i + 1, slides.length - 1))
  }, [
    checkpointPick,
    extraQuizPassed,
    extraQuizzes.length,
    isLast,
    onRefresh,
    pathId,
    slide,
    slides.length,
  ])

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
          {nextSec ? (
            <Link
              className={`${styles.btn} ${styles.btnPrimary}`}
              to={`/learn/g/${nextSec.gradeId}/c/${nextSec.chapterId}/s/${nextSec.sectionId}`}
            >
              {t('learn.path.nextSection')}
            </Link>
          ) : null}
        </div>
      </div>
    )
  }

  const rich = richKeys(slide)

  const inExtraExam =
    slide.type === 'checkpoint' &&
    extraQuizzes.length > 0 &&
    checkpointPick === slide.correctIndex &&
    !extraQuizPassed

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
        <>
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
          {inExtraExam && extraQuizzes[extraQuizIndex] ? (
            <div className={styles.teacherBlock} role="region" aria-label={t('learn.exam.title')}>
              <h3 className={styles.stepTitle}>{t('learn.exam.title')}</h3>
              <p className={styles.learnSlideMeta}>
                {t('learn.exam.progress', {
                  n: extraQuizIndex + 1,
                  total: extraQuizzes.length,
                })}
              </p>
              {(() => {
                const eq = extraQuizzes[extraQuizIndex]!
                return (
                  <ul className={styles.taskMcqList}>
                    <li>
                      <p className={styles.stepBody}>{t(eq.questionKey)}</p>
                    </li>
                    {eq.choiceKeys.map((key, idx) => (
                      <li key={key}>
                        <button
                          type="button"
                          className={`${styles.taskMcqBtn} ${
                            extraQuizPick === idx
                              ? idx === eq.correctIndex
                                ? styles.taskMcqCorrect
                                : styles.taskMcqWrong
                              : ''
                          }`}
                          onClick={() => {
                            setExtraQuizPick(idx)
                            if (idx === eq.correctIndex) {
                              if (extraQuizIndex + 1 >= extraQuizzes.length) {
                                setExtraQuizPassed(true)
                              } else {
                                window.setTimeout(() => {
                                  setExtraQuizIndex((i) => i + 1)
                                  setExtraQuizPick(null)
                                }, 600)
                              }
                            }
                          }}
                        >
                          {t(key)}
                        </button>
                      </li>
                    ))}
                  </ul>
                )
              })()}
            </div>
          ) : null}
        </>
      ) : null}
      {slide.type === 'labInvite' ? (
        <Link className={styles.labLink} to={buildLabUrl(labLink)}>
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

  const toggleExpanded = useCallback((panel: '3d' | 'work' | 'assistant') => {
    setExpandedPanel((prev) => (prev === panel ? null : panel))
    setMobileTab(panel === '3d' ? '3d' : panel === 'work' ? 'work' : 'assistant')
  }, [])

  useEffect(() => {
    if (!expandedPanel) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpandedPanel(null)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [expandedPanel])

  const layoutClass = [
    styles.learnLessonLayout,
    presentationMode ? styles.learnLessonLayoutPresent : '',
    expandedPanel ? styles.learnLessonLayoutFs : '',
  ]
    .filter(Boolean)
    .join(' ')

  const colFs = (id: '3d' | 'work' | 'assistant') =>
    expandedPanel === id ? styles.learnColFullscreen : ''

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
            <p className={styles.fgosBadge}>{t('learn.fgos.badge', { block: fgosMeta.programBlock })}</p>
          </div>
          <div className={styles.learnHeaderActions}>
            <div className={styles.learnPanelMenu} role="group" aria-label={t('learn.panel.menu')}>
              <button
                type="button"
                className={expandedPanel === '3d' ? styles.learnPanelMenuOn : styles.learnPanelMenuBtn}
                onClick={() => toggleExpanded('3d')}
              >
                {t('learn.panel.open3d')}
              </button>
              {!presentationMode ? (
                <>
                  <button
                    type="button"
                    className={expandedPanel === 'work' ? styles.learnPanelMenuOn : styles.learnPanelMenuBtn}
                    onClick={() => toggleExpanded('work')}
                  >
                    {t('learn.panel.openWork')}
                  </button>
                  <button
                    type="button"
                    className={
                      expandedPanel === 'assistant' ? styles.learnPanelMenuOn : styles.learnPanelMenuBtn
                    }
                    onClick={() => toggleExpanded('assistant')}
                  >
                    {t('learn.panel.openAssistant')}
                  </button>
                </>
              ) : null}
            </div>
            <button
              type="button"
              className={presentationMode ? styles.learnPresentBtnOn : styles.learnPresentBtn}
              onClick={() => setPresentationMode((v) => !v)}
              title={t('learn.present.hint')}
            >
              {presentationMode ? t('learn.present.off') : t('learn.present.on')}
            </button>
          </div>
        </div>
      </header>

      {expandedPanel ? (
        <button
          type="button"
          className={styles.learnFsBackdrop}
          aria-label={t('learn.panel.collapse')}
          onClick={() => setExpandedPanel(null)}
        />
      ) : null}

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
        <div
          className={[
            styles.learnCol3d,
            mobileTab !== '3d' && !expandedPanel ? styles.learnColHideMobile : '',
            colFs('3d'),
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <LearnColumnExpandBtn
            expanded={expandedPanel === '3d'}
            label={t('learn.lesson.tab3d')}
            onClick={() => toggleExpanded('3d')}
          />
          <LearnSlideDeckVisual
            slide={slide}
            visualId={visualId}
            sectionSceneId={section.defaultVisualId}
            accent={accent}
            presentationMode={presentationMode || expandedPanel === '3d'}
          />
        </div>
        {!presentationMode ? (
          <>
            <div
              className={[
                styles.learnColWork,
                mobileTab !== 'work' && !expandedPanel ? styles.learnColHideMobile : '',
                colFs('work'),
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <LearnColumnExpandBtn
                expanded={expandedPanel === 'work'}
                label={t('learn.lesson.tabWork')}
                onClick={() => toggleExpanded('work')}
              />
              <LearnWorkspace sectionPathId={pathId} taskCategoryId={taskCategoryId} />
            </div>
            <div
              className={[
                styles.learnColAssistant,
                mobileTab !== 'assistant' && !expandedPanel ? styles.learnColHideMobile : '',
                colFs('assistant'),
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <LearnColumnExpandBtn
                expanded={expandedPanel === 'assistant'}
                label={t('learn.lesson.tabAssistant')}
                onClick={() => toggleExpanded('assistant')}
              />
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
