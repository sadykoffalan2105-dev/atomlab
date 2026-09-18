import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
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
import { useMediaQuery } from './book/bookUi'
import { StudioEmptyState } from './studio/StudioKit'
import { StudioPanelSwitch, StudioPresetBar, StudioSheet } from './studio/StudioControls'
import { StudioShortcutsButton } from './studio/StudioShortcuts'
import { StudioResizer } from './studio/StudioResizer'
import { useStudioShortcuts } from './studio/useStudioShortcuts'
import {
  detectStudioPreset,
  readStudioPrefs,
  resizePair,
  STUDIO_DEFAULT_WIDTHS,
  STUDIO_PANEL_ICON,
  STUDIO_PANEL_LABEL as PANEL_LABEL,
  STUDIO_PANELS,
  STUDIO_PRESET_PANELS,
  studioGridTemplate,
  studioToneStyle,
  writeStudioPrefs,
  type StudioColumnId,
  type StudioPreset,
  type StudioWidths,
} from './studio/studioLayout'
import kit from './studio/StudioKit.module.css'
import shell from './studio/StudioShell.module.css'
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
  main: 'users',
  ...STUDIO_PANEL_ICON,
}

const PANEL_KEY_TO_ID: Record<'1' | '2' | '3', OptionalPanel> = { '1': '3d', '2': 'work', '3': 'assistant' }

const LEAVE_MS = 170

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

function isOptionalPanel(v: string | null | undefined): v is OptionalPanel {
  return v === '3d' || v === 'work' || v === 'assistant'
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
  // Lesson Studio: ширины колонок, уходящие панели, подсказка, шторка, перетаскивание
  const [widths, setWidths] = useState<StudioWidths>(() => readStudioPrefs().widths)
  const [leaving, setLeaving] = useState<Set<OptionalPanel>>(() => new Set())
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const leaveTimers = useRef(new Map<OptionalPanel, number>())
  const layoutRef = useRef<HTMLDivElement>(null)
  const lastPointerPanel = useRef<OptionalPanel | null>(null)
  const dragSnap = useRef<{ widths: StudioWidths; leftPx: number; rightPx: number } | null>(null)

  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const isWide = useMediaQuery('(min-width: 1440px)')
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

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

  useEffect(() => {
    const timers = leaveTimers.current
    return () => {
      timers.forEach((id) => window.clearTimeout(id))
      timers.clear()
    }
  }, [])

  const isPanelHidden = useCallback((id: OptionalPanel) => hiddenPanels.has(id), [hiddenPanels])

  const persistHidden = useCallback((next: Set<OptionalPanel>) => {
    writeLearnPanelLayout({ hidden: [...next] })
  }, [])

  const commitHide = useCallback(
    (id: OptionalPanel) => {
      setHiddenPanels((prev) => {
        if (prev.has(id)) return prev
        const next = new Set(prev)
        next.add(id)
        persistHidden(next)
        return next
      })
      setExpandedPanel((cur) => (cur === id ? null : cur))
      setMobileTab((cur) => (cur === id ? 'main' : cur))
    },
    [persistHidden],
  )

  /** Скрыть панель: на десктопе — с коротким исчезновением, иначе сразу. */
  const hidePanel = useCallback(
    (id: OptionalPanel) => {
      if (!isDesktop || reduceMotion || leaveTimers.current.has(id)) {
        commitHide(id)
        return
      }
      setLeaving((prev) => new Set(prev).add(id))
      const timer = window.setTimeout(() => {
        leaveTimers.current.delete(id)
        setLeaving((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        commitHide(id)
      }, LEAVE_MS)
      leaveTimers.current.set(id, timer)
    },
    [commitHide, isDesktop, reduceMotion],
  )

  const showPanel = useCallback(
    (id: OptionalPanel) => {
      const pending = leaveTimers.current.get(id)
      if (pending != null) {
        window.clearTimeout(pending)
        leaveTimers.current.delete(id)
        setLeaving((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      }
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
      if (hiddenPanels.has(id) || leaveTimers.current.has(id)) showPanel(id)
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

  const toggleBoard = useCallback(() => {
    setPresentationMode((v) => {
      const next = !v
      if (next) {
        if (hiddenPanels.has('3d')) showPanel('3d')
        if (hiddenPanels.has('work')) showPanel('work')
        writeStudioPrefs({ preset: 'board' })
      }
      return next
    })
  }, [hiddenPanels, showPanel])

  /** Раскладки поверх существующего состояния панелей (без нового глобального стейта). */
  const applyPreset = useCallback(
    (p: StudioPreset) => {
      if (p === 'board') {
        toggleBoard()
        return
      }
      const want = STUDIO_PRESET_PANELS[p]
      leaveTimers.current.forEach((timer) => window.clearTimeout(timer))
      leaveTimers.current.clear()
      setLeaving(new Set())
      setPresentationMode(false)
      const next = new Set<OptionalPanel>(STUDIO_PANELS.filter((id) => !want.includes(id)))
      setHiddenPanels(next)
      persistHidden(next)
      setExpandedPanel((cur) => (cur && next.has(cur) ? null : cur))
      setMobileTab((cur) => (cur !== 'main' && next.has(cur) ? 'main' : cur))
      writeStudioPrefs({ preset: p })
    },
    [persistHidden, toggleBoard],
  )

  const activePreset = useMemo(
    () => detectStudioPreset(hiddenPanels, presentationMode),
    [hiddenPanels, presentationMode],
  )

  const visibleCols = useMemo<StudioColumnId[]>(() => {
    const cols: StudioColumnId[] = ['main']
    if (!hiddenPanels.has('3d')) cols.push('3d')
    if (!hiddenPanels.has('work')) cols.push('work')
    if (!presentationMode && !hiddenPanels.has('assistant')) cols.push('assistant')
    return cols
  }, [hiddenPanels, presentationMode])

  const visiblePanelCount = visibleCols.length
  const onlyCockpit = visiblePanelCount === 1 && !presentationMode && !expandedPanel
  const showResizers =
    isDesktop && !presentationMode && !expandedPanel && visiblePanelCount > 1 && (isWide || visiblePanelCount < 4)

  const gridTemplateColumns = useMemo(() => {
    if (presentationMode || expandedPanel) return undefined
    if (visibleCols.length === 1) return 'minmax(250px, 1fr) minmax(0, 1.6fr)'
    if (showResizers) return studioGridTemplate(visibleCols, widths)
    return visibleCols.map((c) => `minmax(0, ${widths[c]}fr)`).join(' ')
  }, [visibleCols, widths, presentationMode, expandedPanel, showResizers])

  /* ——— Изменение ширины колонок ——— */

  const columnPx = useCallback((id: StudioColumnId): number => {
    const el = layoutRef.current?.querySelector<HTMLElement>(`[data-studio-col="${id}"]`)
    return el ? el.getBoundingClientRect().width : 0
  }, [])

  const persistWidths = useCallback((w: StudioWidths) => writeStudioPrefs({ widths: w }), [])

  const resizeBetween = useCallback(
    (left: StudioColumnId, right: StudioColumnId, deltaPx: number, phase: 'move' | 'end') => {
      if (!dragSnap.current) {
        dragSnap.current = { widths, leftPx: columnPx(left), rightPx: columnPx(right) }
      }
      const snap = dragSnap.current
      const next = resizePair(snap.widths, left, right, snap.leftPx, snap.rightPx, deltaPx)
      setWidths(next)
      if (phase === 'end') {
        dragSnap.current = null
        persistWidths(next)
      }
    },
    [columnPx, persistWidths, widths],
  )

  const resetBetween = useCallback(
    (left: StudioColumnId, right: StudioColumnId) => {
      dragSnap.current = null
      setWidths((prev) => {
        const next = { ...prev, [left]: STUDIO_DEFAULT_WIDTHS[left], [right]: STUDIO_DEFAULT_WIDTHS[right] }
        persistWidths(next)
        return next
      })
    },
    [persistWidths],
  )

  const onDragState = useCallback((on: boolean) => {
    setDragging(on)
    if (!on) dragSnap.current = null
  }, [])

  /* ——— Горячие клавиши ——— */

  const onPanelKey = useCallback(
    (key: '1' | '2' | '3') => {
      const id = PANEL_KEY_TO_ID[key]
      if (presentationMode && id === 'assistant') return
      togglePanelVisibility(id)
    },
    [presentationMode, togglePanelVisibility],
  )

  const onFullscreenKey = useCallback(() => {
    if (expandedPanel) {
      setExpandedPanel(null)
      return
    }
    const focused = document.activeElement?.closest<HTMLElement>('[data-studio-col]')?.dataset.studioCol
    const id = isOptionalPanel(focused) ? focused : lastPointerPanel.current
    if (id && !hiddenPanels.has(id) && !(presentationMode && id === 'assistant')) toggleExpanded(id)
  }, [expandedPanel, hiddenPanels, presentationMode, toggleExpanded])

  const onHelpKey = useCallback(() => setShortcutsOpen((v) => !v), [])
  const closeShortcuts = useCallback(() => setShortcutsOpen(false), [])
  const onEscapeKey = useCallback(() => {
    setShortcutsOpen(false)
    setSheetOpen(false)
  }, [])

  useStudioShortcuts({
    onPanelKey,
    onBoard: toggleBoard,
    onFullscreen: onFullscreenKey,
    onHelp: onHelpKey,
    onEscape: onEscapeKey,
    enabled: !doneBanner,
  })

  const rememberPointerPanel = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const id = (e.target as HTMLElement).closest<HTMLElement>('[data-studio-col]')?.dataset.studioCol
    lastPointerPanel.current = isOptionalPanel(id) ? id : null
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
          <Link className={`${kit.btnGhost} ${styles.learnDoneBack}`} to={`/learn/g/${grade.id}/c/${chapter.id}`}>
            <LearnShellIcon name="arrowLeft" size={16} />
            <span>{stripLeadingArrow(t('learn.backChapters'))}</span>
          </Link>
          <div className={styles.learnDoneBadge} aria-hidden="true">
            <span className={styles.learnDoneBadgeRing} />
            <LearnShellIcon name="check" size={44} strokeWidth={2.6} />
          </div>
          <p className={styles.learnDoneSection}>
            {titleParts.badge ? <span className={shell.paraBadge}>{titleParts.badge}</span> : null}
            <span>{titleParts.text}</span>
          </p>
          <h1 className={styles.learnDoneTitle}>{t('learn.sectionDone')}</h1>
          <p className={styles.learnDoneLead}>{t('learn.sectionDoneLead')}</p>
          <div className={styles.learnDoneActions}>
            <button
              type="button"
              className={kit.btn}
              onClick={() => navigate(`/learn/g/${grade.id}/c/${chapter.id}`)}
            >
              <LearnShellIcon name="list" size={17} />
              <span>{t('learn.sectionsTitle')}</span>
            </button>
            {nextSec ? (
              <Link
                className={kit.btnPrimary}
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
    dragging ? shell.layoutDragging : '',
  ]
    .filter(Boolean)
    .join(' ')

  const colClass = (id: OptionalPanel, base: string) =>
    [
      base,
      shell.col,
      mobileTab !== id && !expandedPanel ? styles.learnColHideMobile : '',
      expandedPanel === id ? styles.learnColFullscreen : '',
      leaving.has(id) ? shell.colLeaving : '',
    ]
      .filter(Boolean)
      .join(' ')

  const bookHref = `/learn/g/${grade.id}/book?chapter=${chapter.id}&section=${section.id}&page=${textbookSectionPage(grade.id, chapter.id, section.id)}`
  const backHref = fromBook && gradeHasTextbook(grade.id) ? bookHref : `/learn/g/${grade.id}/c/${chapter.id}`
  const backLabel = stripLeadingArrow(fromBook ? t('learn.bookTopic.backToBook') : t('learn.backChapters'))
  const fgosLabel = t('learn.fgos.badge', { block: fgosMeta.programBlock })
  const chapterTitle = t(chapter.titleKey)
  const hasLab = grade.id === 'g10'
  const labHref = `/organic?chapter=${chapter.id.replace(/\D/g, '') || '1'}&section=${section.id.replace(/\D/g, '') || '1'}`

  // Сетка колонок: на десктопе берётся из CSS-переменной (в мобильной раскладке
  // одна колонка — inline grid-template-columns больше не ломает телефон).
  const layoutStyle = gridTemplateColumns
    ? ({ '--learn-cols': gridTemplateColumns } as CSSProperties)
    : undefined

  const colLabel = (id: StudioColumnId) => (id === 'main' ? t('learn.studio.cockpit') : t(PANEL_LABEL[id]))

  /** Ручка между соседними видимыми колонками. */
  const resizerAfter = (id: StudioColumnId) => {
    if (!showResizers) return null
    const i = visibleCols.indexOf(id)
    const right = visibleCols[i + 1]
    if (i < 0 || !right) return null
    return (
      <StudioResizer
        key={`rz-${id}-${right}`}
        label={t('learn.studio.resize', { a: colLabel(id), b: colLabel(right) })}
        hint={t('learn.studio.resizeHint')}
        onDelta={(d, phase) => resizeBetween(id, right, d, phase)}
        onReset={() => resetBetween(id, right)}
        onDragState={onDragState}
      />
    )
  }

  const linkButtons = (labelClass: string) => (
    <>
      <Link className={`${kit.btn} ${shell.linkBtn}`} to="/learn/tasks" title={t('learn.grades.tasks')}>
        <LearnShellIcon name="tasks" size={16} />
        <span className={labelClass}>{t('learn.grades.tasks')}</span>
      </Link>
      {gradeHasTextbook(grade.id) ? (
        <Link className={`${kit.btn} ${shell.linkBtn}`} to={bookHref} title={t('learn.textbook.openSection')}>
          <LearnShellIcon name="book" size={16} />
          <span className={labelClass}>{t('learn.textbook.openSection')}</span>
        </Link>
      ) : null}
      {hasLab ? (
        <Link className={`${kit.btn} ${shell.linkBtn}`} to={labHref} title={t('organicLab.openInLab')}>
          <LearnShellIcon name="flask" size={16} />
          <span className={labelClass}>{t('organicLab.openInLab')}</span>
        </Link>
      ) : null}
    </>
  )

  return (
    <div
      className={`${styles.page} ${styles.learnLessonOneScreen} ${presentationMode ? styles.learnPagePresent : ''}`}
      style={gradeToneStyle}
    >
      <header className={presentationMode ? `${shell.bar} ${shell.barPresent}` : shell.bar}>
        <div className={shell.lead}>
          <Link className={`${kit.btn} ${shell.back}`} to={backHref} title={backLabel} aria-label={backLabel}>
            <LearnShellIcon name="arrowLeft" size={16} />
            <span className={shell.backLabel}>{backLabel}</span>
          </Link>
          <div className={shell.titleBlock}>
            <h1 className={shell.title} title={lessonTitle}>
              {titleParts.badge ? <span className={shell.paraBadge}>{titleParts.badge}</span> : null}
              <span className={shell.titleText}>{titleParts.text}</span>
            </h1>
            <p className={shell.meta}>
              <span className={kit.chip}>
                <LearnShellIcon name="clock" size={13} />
                {t('learn.estimatedMin', { n: section.estimatedMin })}
              </span>
              <span className={`${kit.chip} ${shell.metaWide}`} title={fgosLabel}>
                <LearnShellIcon name="award" size={13} />
                <span className={shell.metaText}>{fgosLabel}</span>
              </span>
            </p>
          </div>
        </div>
        <div className={shell.actions}>
          <button
            type="button"
            className={`${kit.btnPrimary} ${shell.primaryBtn}`}
            onClick={finishSection}
            title={t('learn.finish')}
          >
            <LearnShellIcon name="check" size={16} strokeWidth={2.4} />
            <span className={shell.linkLabel}>{t('learn.finish')}</span>
          </button>
          <div className={shell.actionGroup}>{linkButtons(shell.linkLabel)}</div>
          <span className={shell.vDivider} aria-hidden="true" />
          <div className={shell.actionGroup}>
            <StudioPresetBar active={activePreset} onPick={applyPreset} />
            <StudioPanelSwitch
              hidden={hiddenPanels}
              expanded={expandedPanel}
              presentationMode={presentationMode}
              onToggle={togglePanelVisibility}
            />
          </div>
          <StudioShortcutsButton open={shortcutsOpen} onToggle={onHelpKey} onClose={closeShortcuts} />
          <button
            type="button"
            className={`${kit.iconBtn} ${shell.moreBtn}`}
            onClick={() => setSheetOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={sheetOpen}
            title={t('learn.studio.more')}
            aria-label={t('learn.studio.more')}
            data-studio-more="1"
          >
            <LearnShellIcon name="more" size={18} strokeWidth={3} />
          </button>
        </div>
      </header>

      <StudioSheet open={sheetOpen} title={t('learn.studio.moreTitle')} onClose={() => setSheetOpen(false)}>
        <div className={shell.sheetSection}>
          <p className={shell.sheetLabel}>{t('learn.studio.links')}</p>
          <div className={shell.sheetRow}>{linkButtons(kit.btnLabel)}</div>
        </div>
        <div className={shell.sheetSection}>
          <p className={shell.sheetLabel}>{t('learn.studio.presets')}</p>
          <StudioPresetBar
            active={activePreset}
            onPick={(p) => {
              applyPreset(p)
              setSheetOpen(false)
            }}
            wrap
          />
        </div>
        <div className={shell.sheetSection}>
          <p className={shell.sheetLabel}>{t('learn.panel.menu')}</p>
          <div className={shell.sheetRow}>
            {STUDIO_PANELS.filter((id) => !(presentationMode && id === 'assistant')).map((id) => (
              <button
                key={id}
                type="button"
                className={isPanelHidden(id) ? kit.btn : `${kit.btn} ${kit.chipOn}`}
                style={studioToneStyle(id)}
                onClick={() => togglePanelVisibility(id)}
                aria-pressed={!isPanelHidden(id)}
              >
                <LearnShellIcon name={isPanelHidden(id) ? 'plus' : 'check'} size={16} />
                <span className={kit.btnLabel}>{t(PANEL_LABEL[id])}</span>
              </button>
            ))}
          </div>
        </div>
      </StudioSheet>

      {expandedPanel ? (
        <button
          type="button"
          className={styles.learnFsBackdrop}
          aria-label={t('learn.panel.collapse')}
          onClick={() => setExpandedPanel(null)}
        />
      ) : null}

      <div className={shell.dock} role="tablist" aria-label={t('learn.panel.menu')} data-studio-dock="1">
        {(['main', '3d', 'work', 'assistant'] as const)
          .filter((tab) => tab === 'main' || (!isPanelHidden(tab) && !(presentationMode && tab === 'assistant')))
          .map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={mobileTab === tab}
              className={mobileTab === tab ? shell.dockTabOn : shell.dockTab}
              style={studioToneStyle(tab)}
              onClick={() => setMobileTab(tab)}
            >
              <span className={shell.dockIcon}>
                <LearnShellIcon name={PANEL_ICON[tab]} size={17} strokeWidth={2.2} />
              </span>
              <span className={shell.dockLabel}>
                {t(
                  tab === 'main'
                    ? 'learn.studio.dockCockpit'
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

      <div
        ref={layoutRef}
        className={layoutClass}
        style={layoutStyle}
        data-panels={visiblePanelCount}
        data-resizable={showResizers ? '1' : undefined}
        onPointerDownCapture={rememberPointerPanel}
      >
        <div
          className={`${styles.learnColTheory} ${mobileTab !== 'main' ? styles.learnColHideMobile : ''}`}
          data-studio-col="main"
        >
          <LearnColumnPanelTools label={t('learn.studio.cockpit')} subtitle={chapterTitle} icon="users" />
          {theoryCol}
        </div>
        {resizerAfter('main')}
        {onlyCockpit && isDesktop ? (
          <div className={shell.emptyCol}>
            <StudioEmptyState
              className={shell.emptyCard}
              title={t('learn.studio.emptyTitle')}
              lead={t('learn.studio.emptyLead')}
              actions={
                <>
                  {STUDIO_PANELS.map((id) => (
                    <button
                      key={id}
                      type="button"
                      className={`${kit.btn} ${shell.emptyBtn}`}
                      style={studioToneStyle(id)}
                      onClick={() => showPanel(id)}
                    >
                      <LearnShellIcon name="plus" size={14} strokeWidth={2.4} />
                      <span>{t(PANEL_LABEL[id])}</span>
                    </button>
                  ))}
                  <StudioPresetBar className={shell.emptyPresets} active={activePreset} onPick={applyPreset} wrap />
                </>
              }
            />
          </div>
        ) : null}
        {!isPanelHidden('3d') ? (
          <div
            className={colClass('3d', styles.learnCol3d)}
            data-studio-col="3d"
            data-studio-fs={expandedPanel === '3d' ? '1' : undefined}
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
        {!isPanelHidden('3d') ? resizerAfter('3d') : null}
        {!isPanelHidden('work') ? (
          <div
            className={colClass('work', styles.learnColWork)}
            data-studio-col="work"
            data-studio-fs={expandedPanel === 'work' ? '1' : undefined}
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
        {!isPanelHidden('work') ? resizerAfter('work') : null}
        {!presentationMode ? (
          <>
            {!isPanelHidden('assistant') ? (
              <div
                className={colClass('assistant', styles.learnColAssistant)}
                data-studio-col="assistant"
                data-studio-fs={expandedPanel === 'assistant' ? '1' : undefined}
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
                      <span className={kit.skeleton} />
                      <span className={kit.skeleton} />
                      <span className={kit.skeleton} />
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
