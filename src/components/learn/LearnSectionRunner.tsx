import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { LearnAssistantPanel } from './LearnAssistantPanel'
import { LearnTheoryRich } from './LearnTheoryRich'
import { LearnSlideDeckVisual } from './LearnSlideDeckVisual'
import { prefetchLearnImage } from './LearnSlideVisual'
import { LearnColumnPanelTools } from './LearnColumnPanelTools'
import { LearnLessonSidebar } from './LearnLessonSidebar'
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
import { g7TextbookSectionPage, gradeHasTextbook } from '../../data/learnTextbookG7'
import { useT, type MessageKey } from '../../i18n/useT'
import { compoundById } from '../../data/compounds'
import {
  readLearnPanelLayout,
  writeLearnPanelLayout,
  type LearnPanelId,
} from '../../learn/learnPanelLayoutStorage'
import { hasCyberDashboard } from '../../learn/learnCyberDashboard'
import styles from '../../pages/LearnPage.module.css'

type OptionalPanel = LearnPanelId

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
  const [searchParams] = useSearchParams()
  const fromBook = searchParams.get('from') === 'book'
  const [slideIndex, setSlideIndex] = useState(0)
  const [checkpointPick, setCheckpointPick] = useState<number | null>(null)
  const [doneBanner, setDoneBanner] = useState(false)
  const [mobileTab, setMobileTab] = useState<'theory' | '3d' | 'work' | 'assistant'>('theory')
  const [presentationMode, setPresentationMode] = useState(false)
  const [expandedPanel, setExpandedPanel] = useState<'3d' | 'work' | 'assistant' | null>(null)
  const [hiddenPanels, setHiddenPanels] = useState<Set<OptionalPanel>>(
    () => new Set(readLearnPanelLayout().hidden),
  )
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
    if (!fromBook) return
    const timer = window.setTimeout(() => {
      document.getElementById('learn-topic-tools')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 150)
    return () => window.clearTimeout(timer)
  }, [fromBook, section.id])

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
    if (slide.type === 'interactive3d' && !hiddenPanels.has('3d')) setMobileTab('3d')
    if (slide.type === 'visual' && !hiddenPanels.has('3d')) setMobileTab('3d')
    if (slide.type === 'visual' && slide.image) prefetchLearnImage(slide.image)
    if (progressPct >= 80 && nextSec) {
      const nextVisual = `topic_${nextSec.gradeId}_${nextSec.chapterId}_${nextSec.sectionId}`
      prefetchLearnImage(`/learn/posters/${nextVisual}.png`)
    }
  }, [slide, slideIndex, progressPct, nextSec, hiddenPanels])

  const isPanelHidden = useCallback((id: OptionalPanel) => hiddenPanels.has(id), [hiddenPanels])

  const persistHidden = useCallback((next: Set<OptionalPanel>) => {
    writeLearnPanelLayout({ hidden: [...next] })
  }, [])

  const hidePanel = useCallback(
    (id: OptionalPanel) => {
      setHiddenPanels((prev) => {
        if (prev.has(id)) return prev
        const next = new Set(prev)
        next.add(id)
        persistHidden(next)
        return next
      })
      setExpandedPanel((cur) => (cur === id ? null : cur))
      if (mobileTab === id) setMobileTab('theory')
    },
    [mobileTab, persistHidden],
  )

  const showPanel = useCallback(
    (id: OptionalPanel) => {
      setHiddenPanels((prev) => {
        if (!prev.has(id)) return prev
        const next = new Set(prev)
        next.delete(id)
        persistHidden(next)
        return next
      })
      setMobileTab(id === '3d' ? '3d' : id === 'work' ? 'work' : 'assistant')
    },
    [persistHidden],
  )

  const togglePanelVisibility = useCallback(
    (id: OptionalPanel) => {
      if (hiddenPanels.has(id)) showPanel(id)
      else hidePanel(id)
    },
    [hiddenPanels, hidePanel, showPanel],
  )

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

  const moleculeHubSection =
    section.defaultVisualId != null && hasCyberDashboard(section.defaultVisualId)

  const rosterSectionId =
    moleculeHubSection && section.defaultVisualId ? section.defaultVisualId : pathId

  const lessonSlidesContent = (
    <>
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
      {slideBody ? <p className={styles.stepBodyCompact}>{slideBody}</p> : null}
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
      <div className={styles.footerNavCompact}>
        <button type="button" className={styles.btn} onClick={goPrev} disabled={slideIndex === 0}>
          {t('learn.prev')}
        </button>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={goNext}>
          {isLast ? t('learn.finish') : t('learn.next')}
        </button>
      </div>
    </>
  )

  const theoryCol = (
    <LearnLessonSidebar
      grade={grade}
      chapter={chapter}
      section={section}
      rosterSectionId={rosterSectionId}
      lessonContent={lessonSlidesContent}
      showLessonTab={!moleculeHubSection}
      fromBook={fromBook}
    />
  )

  const toggleExpanded = useCallback((panel: '3d' | 'work' | 'assistant') => {
    if (hiddenPanels.has(panel)) {
      showPanel(panel)
      return
    }
    setExpandedPanel((prev) => (prev === panel ? null : panel))
    setMobileTab(panel === '3d' ? '3d' : panel === 'work' ? 'work' : 'assistant')
  }, [hiddenPanels, showPanel])

  const gridTemplateColumns = useMemo(() => {
    if (presentationMode || expandedPanel) return undefined
    const cols = ['minmax(0, 1.1fr)']
    if (!hiddenPanels.has('3d')) cols.push('minmax(0, 1.25fr)')
    if (!hiddenPanels.has('work')) cols.push('minmax(0, 0.95fr)')
    if (!hiddenPanels.has('assistant')) cols.push('minmax(0, 1fr)')
    return cols.length === 1 ? '1fr' : cols.join(' ')
  }, [hiddenPanels, presentationMode, expandedPanel])

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
    <div
      className={`${styles.page} ${styles.learnLessonOneScreen} ${presentationMode ? styles.learnPagePresent : ''}`}
    >
      <header className={`${styles.lessonHeader} ${styles.lessonHeaderCompact}`}>
        <div className={styles.lessonHeaderRow}>
          <div className={styles.lessonHeaderMain}>
            <Link
              className={styles.backLinkInline}
              to={
                fromBook && gradeHasTextbook(grade.id)
                  ? `/learn/g/${grade.id}/book?chapter=${chapter.id}&section=${section.id}&page=${g7TextbookSectionPage(chapter.id, section.id)}`
                  : `/learn/g/${grade.id}/c/${chapter.id}`
              }
            >
              {fromBook ? t('learn.bookTopic.backToBook') : t('learn.backChapters')}
            </Link>
            <h1 className={styles.lessonTitle}>{t(section.titleKey)}</h1>
            <p className={styles.lessonMetaInline}>
              {t('learn.estimatedMin', { n: section.estimatedMin })} ·{' '}
              {t('learn.fgos.badge', { block: fgosMeta.programBlock })}
            </p>
          </div>
          <div className={styles.learnHeaderActions}>
            <Link className={styles.btn} to="/learn/tasks">
              {t('learn.grades.tasks')}
            </Link>
            {gradeHasTextbook(grade.id) ? (
              <Link
                className={styles.btn}
                to={`/learn/g/${grade.id}/book?chapter=${chapter.id}&section=${section.id}&page=${g7TextbookSectionPage(chapter.id, section.id)}`}
              >
                {t('learn.textbook.openSection')}
              </Link>
            ) : null}
            <div className={styles.learnPanelMenu} role="group" aria-label={t('learn.panel.menu')}>
              <button
                type="button"
                className={
                  isPanelHidden('3d')
                    ? styles.learnPanelMenuOff
                    : expandedPanel === '3d'
                      ? styles.learnPanelMenuOn
                      : styles.learnPanelMenuBtn
                }
                onClick={() => togglePanelVisibility('3d')}
                aria-pressed={!isPanelHidden('3d')}
                title={isPanelHidden('3d') ? t('learn.panel.show') : t('learn.panel.hide')}
              >
                {t('learn.panel.open3d')}
              </button>
              <button
                type="button"
                className={
                  isPanelHidden('work')
                    ? styles.learnPanelMenuOff
                    : expandedPanel === 'work'
                      ? styles.learnPanelMenuOn
                      : styles.learnPanelMenuBtn
                }
                onClick={() => togglePanelVisibility('work')}
                aria-pressed={!isPanelHidden('work')}
                title={isPanelHidden('work') ? t('learn.panel.show') : t('learn.panel.hide')}
              >
                {t('learn.panel.openWork')}
              </button>
              {!presentationMode ? (
                <button
                  type="button"
                  className={
                    isPanelHidden('assistant')
                      ? styles.learnPanelMenuOff
                      : expandedPanel === 'assistant'
                        ? styles.learnPanelMenuOn
                        : styles.learnPanelMenuBtn
                  }
                  onClick={() => togglePanelVisibility('assistant')}
                  aria-pressed={!isPanelHidden('assistant')}
                  title={
                    isPanelHidden('assistant') ? t('learn.panel.show') : t('learn.panel.hide')
                  }
                >
                  {t('learn.panel.openAssistant')}
                </button>
              ) : null}
            </div>
            <button
              type="button"
              className={presentationMode ? styles.learnPresentBtnOn : styles.learnPresentBtn}
              onClick={() => {
                setPresentationMode((v) => {
                  const next = !v
                  if (next) {
                    if (hiddenPanels.has('3d')) showPanel('3d')
                    if (hiddenPanels.has('work')) showPanel('work')
                  }
                  return next
                })
              }}
              title={t('learn.present.hint')}
            >
              {presentationMode ? t('learn.present.off') : t('learn.present.on')}
            </button>
          </div>
        </div>
      </header>

      {hiddenPanels.size > 0 ? (
        <div className={styles.learnHiddenPanelsBar} role="region" aria-label={t('learn.panel.hiddenBar')}>
          <span className={styles.learnHiddenPanelsLabel}>{t('learn.panel.hiddenBar')}:</span>
          {isPanelHidden('3d') ? (
            <button type="button" className={styles.learnHiddenPanelsBtn} onClick={() => showPanel('3d')}>
              {t('learn.panel.open3d')}
            </button>
          ) : null}
          {isPanelHidden('work') ? (
            <button type="button" className={styles.learnHiddenPanelsBtn} onClick={() => showPanel('work')}>
              {t('learn.panel.openWork')}
            </button>
          ) : null}
          {!presentationMode && isPanelHidden('assistant') ? (
            <button
              type="button"
              className={styles.learnHiddenPanelsBtn}
              onClick={() => showPanel('assistant')}
            >
              {t('learn.panel.openAssistant')}
            </button>
          ) : null}
        </div>
      ) : null}

      {expandedPanel ? (
        <button
          type="button"
          className={styles.learnFsBackdrop}
          aria-label={t('learn.panel.collapse')}
          onClick={() => setExpandedPanel(null)}
        />
      ) : null}

      <div className={styles.learnMobileTabs} role="tablist">
        {(['theory', '3d', 'work', 'assistant'] as const)
          .filter((tab) => tab === 'theory' || !isPanelHidden(tab))
          .map((tab) => (
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

      <div
        className={layoutClass}
        style={gridTemplateColumns ? { gridTemplateColumns } : undefined}
      >
        <div
          className={`${styles.learnColTheory} ${mobileTab !== 'theory' ? styles.learnColHideMobile : ''}`}
        >
          {theoryCol}
        </div>
        {!isPanelHidden('3d') ? (
          <div
            className={[
              styles.learnCol3d,
              mobileTab !== '3d' && !expandedPanel ? styles.learnColHideMobile : '',
              colFs('3d'),
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <LearnColumnPanelTools
              expanded={expandedPanel === '3d'}
              label={t('learn.lesson.tab3d')}
              onExpand={() => toggleExpanded('3d')}
              onHide={() => hidePanel('3d')}
            />
            <LearnSlideDeckVisual
              slide={slide}
              visualId={visualId}
              sectionSceneId={section.defaultVisualId}
              accent={accent}
              presentationMode={presentationMode || expandedPanel === '3d'}
            />
          </div>
        ) : null}
        {!isPanelHidden('work') ? (
          <div
            className={[
              styles.learnColWork,
              mobileTab !== 'work' && !expandedPanel ? styles.learnColHideMobile : '',
              colFs('work'),
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <LearnColumnPanelTools
              expanded={expandedPanel === 'work'}
              label={t('learn.lesson.tabWork')}
              onExpand={() => toggleExpanded('work')}
              onHide={() => hidePanel('work')}
            />
            <LearnWorkspace
              sectionPathId={pathId}
              taskCategoryId={taskCategoryId}
              presentationMode={presentationMode}
            />
          </div>
        ) : null}
        {!presentationMode ? (
          <>
            {!isPanelHidden('assistant') ? (
              <div
                className={[
                  styles.learnColAssistant,
                  mobileTab !== 'assistant' && !expandedPanel ? styles.learnColHideMobile : '',
                  colFs('assistant'),
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <LearnColumnPanelTools
                  expanded={expandedPanel === 'assistant'}
                  label={t('learn.lesson.tabAssistant')}
                  onExpand={() => toggleExpanded('assistant')}
                  onHide={() => hidePanel('assistant')}
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
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  )
}
