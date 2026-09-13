import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { LearnSlideDeckVisual } from './LearnSlideDeckVisual'
import { LearnColumnPanelTools } from './LearnColumnPanelTools'
import { LearnLessonSidebar } from './LearnLessonSidebar'
import { LearnWorkspace } from './LearnWorkspace'
import { LearnShellIcon, type LearnShellIconName } from './LearnShellIcon'
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

// Ленивая загрузка: LearnAssistantPanel тянет за собой learnKnowledgeRetrieval →
// весь mega-pack базы знаний учителя (~150 МБ JSON). Раньше это был обычный
// static import, и AppShell.prefetchAppRoutes() догружал его в idle сразу
// после ЛЮБОЙ страницы (включая лабораторию), из-за чего страница на несколько
// секунд «зависала» без видимой ошибки — главный поток был занят JSON.parse.
const LearnAssistantPanel = lazy(() =>
  import('./LearnAssistantPanel').then((m) => ({ default: m.LearnAssistantPanel })),
)

type OptionalPanel = LearnPanelId
type MobileTab = 'main' | '3d' | 'work' | 'assistant'

const PANEL_ICON: Record<MobileTab, LearnShellIconName> = {
  main: 'book',
  '3d': 'cube',
  work: 'pencil',
  assistant: 'sparkles',
}

/** Подписи из словаря начинаются со стрелки «← …» — в шапке стрелку рисует иконка. */
function stripLeadingArrow(label: string): string {
  return label.replace(/^\s*←\s*/, '')
}

/** «§1. Химия и её задачи» → бейдж «§1» + текст заголовка. */
function splitParagraphTitle(title: string): { badge: string | null; text: string } {
  const m = /^\s*§\s*(\d+(?:\.\d+)*)\.?\s+(.+)$/u.exec(title)
  if (!m) return { badge: null, text: title }
  return { badge: `§${m[1]}`, text: m[2]! }
}

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
  const [mobileTab, setMobileTab] = useState<MobileTab>('main')
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

  // Хуки ниже раньше вызывались после раннего return экрана «Параграф завершён»,
  // из-за чего «Завершить урок» ронял React («Rendered fewer hooks than expected»).
  const toggleExpanded = useCallback((panel: '3d' | 'work' | 'assistant') => {
    if (hiddenPanels.has(panel)) {
      showPanel(panel)
      return
    }
    setExpandedPanel((prev) => (prev === panel ? null : panel))
    setMobileTab(panel === '3d' ? '3d' : panel === 'work' ? 'work' : 'assistant')
  }, [hiddenPanels, showPanel])

  const visiblePanelCount = useMemo(() => {
    let n = 1
    if (!hiddenPanels.has('3d')) n += 1
    if (!hiddenPanels.has('work')) n += 1
    if (!presentationMode && !hiddenPanels.has('assistant')) n += 1
    return n
  }, [hiddenPanels, presentationMode])

  const gridTemplateColumns = useMemo(() => {
    if (presentationMode || expandedPanel) return undefined
    const cols = ['minmax(0, 1.05fr)']
    if (!hiddenPanels.has('3d')) cols.push('minmax(0, 1.3fr)')
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

  /** Цвет класса (g7…g11) из дизайн-системы — для бейджа § и акцентов шапки. */
  const gradeToneStyle = useMemo(
    () =>
      ({
        '--lesson-a': `var(--lt-${grade.id}-a, var(--lt-primary))`,
        '--lesson-b': `var(--lt-${grade.id}-b, var(--lt-primary-2))`,
      }) as CSSProperties,
    [grade.id],
  )

  const lessonTitle = t(section.titleKey)
  const titleParts = splitParagraphTitle(lessonTitle)

  if (doneBanner) {
    return (
      <div className={`${styles.page} ${styles.learnDonePage}`} style={gradeToneStyle}>
        <div className={styles.learnDoneCard}>
          <Link className={styles.learnDoneBack} to={`/learn/g/${grade.id}/c/${chapter.id}`}>
            <LearnShellIcon name="arrowLeft" size={16} />
            <span>{stripLeadingArrow(t('learn.backChapters'))}</span>
          </Link>
          <div className={styles.learnDoneBadge} aria-hidden="true">
            <span className={styles.learnDoneBadgeRing} />
            <LearnShellIcon name="check" size={44} strokeWidth={2.6} />
          </div>
          <p className={styles.learnDoneSection}>
            {titleParts.badge ? <span className={styles.lessonParaBadge}>{titleParts.badge}</span> : null}
            <span>{titleParts.text}</span>
          </p>
          <h1 className={styles.learnDoneTitle}>{t('learn.sectionDone')}</h1>
          <p className={styles.learnDoneLead}>{t('learn.sectionDoneLead')}</p>
          <div className={styles.learnDoneActions}>
            <button
              type="button"
              className={styles.shellBtn}
              onClick={() => navigate(`/learn/g/${grade.id}/c/${chapter.id}`)}
            >
              <LearnShellIcon name="list" size={17} />
              <span>{t('learn.sectionsTitle')}</span>
            </button>
            {nextSec ? (
              <Link
                className={`${styles.shellBtn} ${styles.shellBtnPrimary}`}
                to={`/learn/g/${nextSec.gradeId}/c/${nextSec.chapterId}/s/${nextSec.sectionId}`}
              >
                <span>{t('learn.path.nextSection')}</span>
                <LearnShellIcon name="arrowRight" size={17} />
              </Link>
            ) : null}
          </div>
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

  const layoutClass = [
    styles.learnLessonLayout,
    presentationMode ? styles.learnLessonLayoutPresent : '',
    expandedPanel ? styles.learnLessonLayoutFs : '',
  ]
    .filter(Boolean)
    .join(' ')

  const colFs = (id: '3d' | 'work' | 'assistant') =>
    expandedPanel === id ? styles.learnColFullscreen : ''

  const bookHref = `/learn/g/${grade.id}/book?chapter=${chapter.id}&section=${section.id}&page=${textbookSectionPage(grade.id, chapter.id, section.id)}`
  const fgosLabel = t('learn.fgos.badge', { block: fgosMeta.programBlock })

  const panelMenuClass = (id: OptionalPanel) =>
    isPanelHidden(id)
      ? styles.learnPanelMenuOff
      : expandedPanel === id
        ? styles.learnPanelMenuOn
        : styles.learnPanelMenuBtn

  // Сетка колонок: на десктопе берётся из CSS-переменной (в мобильной раскладке
  // одна колонка — inline grid-template-columns больше не ломает телефон).
  const layoutStyle = gridTemplateColumns
    ? ({ '--learn-cols': gridTemplateColumns } as CSSProperties)
    : undefined

  return (
    <div
      className={`${styles.page} ${styles.learnLessonOneScreen} ${presentationMode ? styles.learnPagePresent : ''}`}
      style={gradeToneStyle}
    >
      <header className={`${styles.lessonHeader} ${styles.lessonHeaderCompact}`}>
        <div className={styles.lessonHeaderRow}>
          <div className={styles.lessonHeaderMain}>
            <Link
              className={styles.backLinkInline}
              to={
                fromBook && gradeHasTextbook(grade.id)
                  ? bookHref
                  : `/learn/g/${grade.id}/c/${chapter.id}`
              }
            >
              <LearnShellIcon name="arrowLeft" size={15} />
              <span>
                {stripLeadingArrow(fromBook ? t('learn.bookTopic.backToBook') : t('learn.backChapters'))}
              </span>
            </Link>
            <div className={styles.lessonTitleBlock}>
              <h1 className={styles.lessonTitle} title={lessonTitle}>
                {titleParts.badge ? (
                  <span className={styles.lessonParaBadge}>{titleParts.badge}</span>
                ) : null}
                <span className={styles.lessonTitleText}>{titleParts.text}</span>
              </h1>
              <p className={styles.lessonMetaInline}>
                <span className={styles.lessonMetaChip}>
                  <LearnShellIcon name="clock" size={13} />
                  {t('learn.estimatedMin', { n: section.estimatedMin })}
                </span>
                <span className={`${styles.lessonMetaChip} ${styles.lessonMetaChipWide}`} title={fgosLabel}>
                  <LearnShellIcon name="award" size={13} />
                  <span className={styles.lessonMetaChipText}>{fgosLabel}</span>
                </span>
              </p>
            </div>
          </div>
          <div className={styles.learnHeaderActions}>
            <button
              type="button"
              className={`${styles.shellBtn} ${styles.shellBtnPrimary}`}
              onClick={finishSection}
            >
              <LearnShellIcon name="check" size={16} strokeWidth={2.4} />
              <span>{t('learn.finish')}</span>
            </button>
            <Link className={styles.shellBtn} to="/learn/tasks" title={t('learn.grades.tasks')}>
              <LearnShellIcon name="tasks" size={16} />
              <span className={styles.shellBtnLabel}>{t('learn.grades.tasks')}</span>
            </Link>
            {gradeHasTextbook(grade.id) ? (
              <Link className={styles.shellBtn} to={bookHref} title={t('learn.textbook.openSection')}>
                <LearnShellIcon name="book" size={16} />
                <span className={styles.shellBtnLabel}>{t('learn.textbook.openSection')}</span>
              </Link>
            ) : null}
            {grade.id === 'g10' ? (
              <Link
                className={styles.shellBtn}
                to={`/organic?chapter=${chapter.id.replace(/\D/g, '') || '1'}&section=${section.id.replace(/\D/g, '') || '1'}`}
                title={t('organicLab.openInLab')}
              >
                <LearnShellIcon name="flask" size={16} />
                <span className={styles.shellBtnLabel}>{t('organicLab.openInLab')}</span>
              </Link>
            ) : null}
            <div className={styles.learnPanelMenu} role="group" aria-label={t('learn.panel.menu')}>
              <button
                type="button"
                className={panelMenuClass('3d')}
                onClick={() => togglePanelVisibility('3d')}
                aria-pressed={!isPanelHidden('3d')}
                title={isPanelHidden('3d') ? t('learn.panel.show') : t('learn.panel.hide')}
              >
                <LearnShellIcon name="cube" size={15} />
                <span>{t('learn.panel.open3d')}</span>
              </button>
              <button
                type="button"
                className={panelMenuClass('work')}
                onClick={() => togglePanelVisibility('work')}
                aria-pressed={!isPanelHidden('work')}
                title={isPanelHidden('work') ? t('learn.panel.show') : t('learn.panel.hide')}
              >
                <LearnShellIcon name="pencil" size={15} />
                <span>{t('learn.panel.openWork')}</span>
              </button>
              {!presentationMode ? (
                <button
                  type="button"
                  className={panelMenuClass('assistant')}
                  onClick={() => togglePanelVisibility('assistant')}
                  aria-pressed={!isPanelHidden('assistant')}
                  title={
                    isPanelHidden('assistant') ? t('learn.panel.show') : t('learn.panel.hide')
                  }
                >
                  <LearnShellIcon name="sparkles" size={15} />
                  <span>{t('learn.panel.openAssistant')}</span>
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
              <LearnShellIcon name={presentationMode ? 'layers' : 'board'} size={16} />
              <span className={styles.shellBtnLabel}>
                {presentationMode ? t('learn.present.off') : t('learn.present.on')}
              </span>
            </button>
          </div>
        </div>
      </header>

      {hiddenPanels.size > 0 ? (
        <div className={styles.learnHiddenPanelsBar} role="region" aria-label={t('learn.panel.hiddenBar')}>
          <span className={styles.learnHiddenPanelsLabel}>
            <LearnShellIcon name="eyeOff" size={14} />
            {t('learn.panel.hiddenBar')}:
          </span>
          {isPanelHidden('3d') ? (
            <button type="button" className={styles.learnHiddenPanelsBtn} onClick={() => showPanel('3d')}>
              <LearnShellIcon name="plus" size={13} strokeWidth={2.4} />
              {t('learn.panel.open3d')}
            </button>
          ) : null}
          {isPanelHidden('work') ? (
            <button type="button" className={styles.learnHiddenPanelsBtn} onClick={() => showPanel('work')}>
              <LearnShellIcon name="plus" size={13} strokeWidth={2.4} />
              {t('learn.panel.openWork')}
            </button>
          ) : null}
          {!presentationMode && isPanelHidden('assistant') ? (
            <button
              type="button"
              className={styles.learnHiddenPanelsBtn}
              onClick={() => showPanel('assistant')}
            >
              <LearnShellIcon name="plus" size={13} strokeWidth={2.4} />
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
            <LearnShellIcon name={PANEL_ICON[tab]} size={18} />
            <span className={styles.learnMobileTabLabel}>
              {t(
                tab === 'main'
                  ? 'learn.studentTest.title'
                  : tab === '3d'
                    ? 'learn.lesson.tab3d'
                    : tab === 'work'
                      ? 'learn.lesson.tabWork'
                      : 'learn.lesson.tabAssistant',
              )}
            </span>
          </button>
        ))}
      </div>

      <div className={layoutClass} style={layoutStyle} data-panels={visiblePanelCount}>
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
              label={t('learn.panel.open3d')}
              icon="cube"
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
              label={t('learn.panel.openWork')}
              icon="pencil"
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
                  label={t('learn.panel.openAssistant')}
                  icon="sparkles"
                  onExpand={() => toggleExpanded('assistant')}
                  onHide={() => hidePanel('assistant')}
                />
                <Suspense
                  fallback={
                    <div className={styles.learnColLoading} aria-hidden="true">
                      <span className={styles.learnColLoadingLine} />
                      <span className={styles.learnColLoadingLine} />
                      <span className={styles.learnColLoadingLine} />
                    </div>
                  }
                >
                  <LearnAssistantPanel
                    gradeId={grade.id}
                    chapterId={chapter.id}
                    section={section}
                    slideIndex={slideIndex}
                    slideTitle={slideTitle}
                    slideBody=""
                    grade={grade}
                    chapter={chapter}
                  />
                </Suspense>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  )
}
