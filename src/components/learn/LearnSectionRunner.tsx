import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { LearnAssistantPanel } from './LearnAssistantPanel'
import { LearnSlideDeckVisual } from './LearnSlideDeckVisual'
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
import { learnNextSection, learnSectionPathId } from '../../data/learnCurriculumUz'
import { textbookSectionPage, gradeHasTextbook } from '../../data/learnTextbook'
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
  const [doneBanner, setDoneBanner] = useState(false)
  const [mobileTab, setMobileTab] = useState<'main' | '3d' | 'work' | 'assistant'>('main')
  const [presentationMode, setPresentationMode] = useState(false)
  const [expandedPanel, setExpandedPanel] = useState<'3d' | 'work' | 'assistant' | null>(null)
  const [hiddenPanels, setHiddenPanels] = useState<Set<OptionalPanel>>(
    () => new Set(readLearnPanelLayout().hidden),
  )

  const fgosMeta = useMemo(
    () => getLearnFgosMeta(section.gradeId, chapter.id, section.id),
    [section.gradeId, chapter.id, section.id],
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
  const { title: slideTitle } = slideText(slide, t)

  const finishSection = useCallback(() => {
    markSectionCompleted(pathId)
    clearLastPosition()
    onRefresh()
    setDoneBanner(true)
  }, [onRefresh, pathId])

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
  }, [grade.id, chapter.id, section.id, slideIndex])

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
      if (mobileTab === id) setMobileTab('main')
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

  const moleculeHubSection =
    section.defaultVisualId != null && hasCyberDashboard(section.defaultVisualId)

  const rosterSectionId =
    moleculeHubSection && section.defaultVisualId ? section.defaultVisualId : pathId

  const theoryCol = (
    <LearnLessonSidebar
      grade={grade}
      chapter={chapter}
      section={section}
      rosterSectionId={rosterSectionId}
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
                  ? `/learn/g/${grade.id}/book?chapter=${chapter.id}&section=${section.id}&page=${textbookSectionPage(grade.id, chapter.id, section.id)}`
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
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={finishSection}>
              {t('learn.finish')}
            </button>
            <Link className={styles.btn} to="/learn/tasks">
              {t('learn.grades.tasks')}
            </Link>
            {gradeHasTextbook(grade.id) ? (
              <Link
                className={styles.btn}
                to={`/learn/g/${grade.id}/book?chapter=${chapter.id}&section=${section.id}&page=${textbookSectionPage(grade.id, chapter.id, section.id)}`}
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
        {(['main', '3d', 'work', 'assistant'] as const)
          .filter((tab) => tab === 'main' || !isPanelHidden(tab))
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
              tab === 'main'
                ? 'learn.studentTest.title'
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
          className={`${styles.learnColTheory} ${mobileTab !== 'main' ? styles.learnColHideMobile : ''}`}
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
                  slideBody=""
                />
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  )
}
