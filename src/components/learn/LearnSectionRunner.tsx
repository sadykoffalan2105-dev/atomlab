import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { LearnSlideDeckVisual } from './LearnSlideDeckVisual'
import { LearnLessonSidebar } from './LearnLessonSidebar'
import { LearnWorkspace } from './LearnWorkspace'
import { LearnShellIcon } from './LearnShellIcon'
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
import { hasCyberDashboard } from '../../learn/learnCyberDashboard'
import { useMediaQuery } from './book/bookUi'
import { StudioResizer } from './studio/StudioResizer'
import { StudioWorkspaceChooser } from './studio/StudioWorkspaceChooser'
import { useStudioShortcuts } from './studio/useStudioShortcuts'
import {
  initialLessonWorkspace,
  readDefaultWorkspace,
  readFocusPanelPrefs,
  writeDefaultWorkspace,
  writeFocusPanelPrefs,
  writeLessonWorkspace,
  FOCUS_MODE_LABEL,
  FOCUS_STAGE,
  FOCUS_TOOLS,
  FOCUS_TOOL_ICON,
  FOCUS_TOOL_LABEL,
  STUDIO_WORKSPACES,
  STUDIO_WORKSPACE_BY_KEY,
  STUDIO_WORKSPACE_ICON,
  STUDIO_WORKSPACE_KEY,
  STUDIO_WORKSPACE_LABEL,
  type FocusPanelPrefs,
  type FocusTool,
  type StudioWorkspace,
} from './studio/studioWorkspaces'
import kit from './studio/StudioKit.module.css'
import shell from './studio/StudioShell.module.css'
import focus from './studio/FocusLesson.module.css'
import styles from '../../pages/LearnPage.module.css'

// Ленивая загрузка: LearnAssistantPanel тянет за собой learnKnowledgeRetrieval →
// весь mega-pack базы знаний учителя (~150 МБ JSON). Раньше это был обычный
// static import, и AppShell.prefetchAppRoutes() догружал его в idle сразу
// после ЛЮБОЙ страницы (включая лабораторию), из-за чего страница на несколько
// секунд «зависала» без видимой ошибки — главный поток был занят JSON.parse.
const LearnAssistantPanel = lazy(() =>
  import('./LearnAssistantPanel').then((m) => ({ default: m.LearnAssistantPanel })),
)

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


/** Ширина панели инструментов, px (десктоп). */
const PANEL_W_KEY = 'atomlab-learn-focus-panel-w-v1'
const PANEL_W_DEFAULT = 420
const PANEL_W_MIN = 320
const PANEL_W_MAX = 760

function readPanelWidth(): number {
  try {
    const v = Number(localStorage.getItem(PANEL_W_KEY))
    return Number.isFinite(v) && v >= PANEL_W_MIN && v <= PANEL_W_MAX ? v : PANEL_W_DEFAULT
  } catch {
    return PANEL_W_DEFAULT
  }
}

function writePanelWidth(w: number): void {
  try {
    localStorage.setItem(PANEL_W_KEY, String(Math.round(w)))
  } catch {
    /* приватный режим */
  }
}

/** Телефон: что сейчас на экране — сцена или один инструмент. */
type MobileView = 'stage' | FocusTool

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
  // Режим урока: «Урок» · «Доска» · «ИИ-учитель». null — ещё не выбран, показываем окно выбора.
  const [workspace, setWorkspace] = useState<StudioWorkspace | null>(() =>
    initialLessonWorkspace(learnSectionPathId(section)),
  )
  const [rememberedWs, setRememberedWs] = useState<StudioWorkspace | null>(() => readDefaultWorkspace())
  const [chooserOpen, setChooserOpen] = useState(false)
  // Открытая вкладка панели инструментов для каждого режима (null — панель скрыта).
  const [panelPrefs, setPanelPrefs] = useState<FocusPanelPrefs>(() => readFocusPanelPrefs())
  const [panelW, setPanelW] = useState<number>(() => readPanelWidth())
  const [mobileView, setMobileView] = useState<MobileView>('stage')
  const [expandedTool, setExpandedTool] = useState<FocusTool | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const dragStartW = useRef<number | null>(null)

  const isDesktop = useMediaQuery('(min-width: 1024px)')

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

  /**
   * Смена урока без размонтирования компонента — восстанавливаем режим
   * этого урока прямо в рендере (паттерн React «adjusting state when props change»).
   */
  const [seenPathId, setSeenPathId] = useState(pathId)
  if (seenPathId !== pathId) {
    setSeenPathId(pathId)
    setWorkspace(initialLessonWorkspace(pathId))
    setChooserOpen(false)
    setExpandedTool(null)
    setMobileView('stage')
  }

  const activeWs: StudioWorkspace = workspace ?? 'teach'
  const presentationMode = activeWs === 'board'
  const showChooser = workspace == null || chooserOpen
  const stageTool = FOCUS_STAGE[activeWs]
  const tools = FOCUS_TOOLS[activeWs]
  const openTool = panelPrefs[activeWs]
  /** Инструмент, который сейчас смонтирован в панели (телефон — выбранная вкладка). */
  const panelTool: FocusTool | null = isDesktop ? openTool : mobileView === 'stage' ? null : mobileView

  const updatePanel = useCallback((ws: StudioWorkspace, tool: FocusTool | null) => {
    setPanelPrefs((prev) => {
      if (prev[ws] === tool) return prev
      const next = { ...prev, [ws]: tool }
      writeFocusPanelPrefs(next)
      return next
    })
  }, [])

  /** Переход в режим: сцена меняется, панель помнит свою вкладку для режима. */
  const pickWorkspace = useCallback(
    (ws: StudioWorkspace) => {
      setWorkspace(ws)
      writeLessonWorkspace(pathId, ws)
      setChooserOpen(false)
      setExpandedTool(null)
      setMobileView('stage')
    },
    [pathId],
  )

  const pickFromChooser = useCallback(
    (ws: StudioWorkspace, remember: boolean) => {
      writeDefaultWorkspace(remember ? ws : null)
      setRememberedWs(remember ? ws : null)
      pickWorkspace(ws)
    },
    [pickWorkspace],
  )

  const toggleAskMode = useCallback(() => {
    const next = rememberedWs ? null : activeWs
    writeDefaultWorkspace(next)
    setRememberedWs(next)
  }, [activeWs, rememberedWs])

  /** Вкладка на рейке: открыть инструмент; повторный клик по открытому — спрятать панель. */
  const pickTool = useCallback(
    (tool: FocusTool) => {
      setExpandedTool(null)
      updatePanel(activeWs, openTool === tool ? null : tool)
    },
    [activeWs, openTool, updatePanel],
  )

  const togglePanel = useCallback(() => {
    setExpandedTool(null)
    updatePanel(activeWs, openTool ? null : (tools[0] ?? null))
  }, [activeWs, openTool, tools, updatePanel])

  const toggleBoard = useCallback(() => {
    pickWorkspace(workspace === 'board' ? 'teach' : 'board')
  }, [pickWorkspace, workspace])

  /* ——— Ширина панели ——— */

  const onPanelDelta = useCallback(
    (d: number, phase: 'move' | 'end') => {
      if (dragStartW.current == null) dragStartW.current = panelW
      const w = Math.min(PANEL_W_MAX, Math.max(PANEL_W_MIN, dragStartW.current - d))
      setPanelW(w)
      if (phase === 'end') {
        dragStartW.current = null
        writePanelWidth(w)
      }
    },
    [panelW],
  )

  const onPanelReset = useCallback(() => {
    dragStartW.current = null
    setPanelW(PANEL_W_DEFAULT)
    writePanelWidth(PANEL_W_DEFAULT)
  }, [])

  const onDragState = useCallback((on: boolean) => {
    setDragging(on)
    if (!on) dragStartW.current = null
  }, [])

  /* ——— Горячие клавиши: 1·2·3 режимы, B доска, F инструмент на весь экран, ? меню, Esc ——— */

  const onPanelKey = useCallback(
    (key: '1' | '2' | '3') => {
      pickWorkspace(STUDIO_WORKSPACE_BY_KEY[key])
    },
    [pickWorkspace],
  )

  const onFullscreenKey = useCallback(() => {
    if (expandedTool) {
      setExpandedTool(null)
      return
    }
    if (panelTool) setExpandedTool(panelTool)
  }, [expandedTool, panelTool])

  const onHelpKey = useCallback(() => setMenuOpen((v) => !v), [])
  const onEscapeKey = useCallback(() => setMenuOpen(false), [])

  useStudioShortcuts({
    onPanelKey,
    onBoard: toggleBoard,
    onFullscreen: onFullscreenKey,
    onHelp: onHelpKey,
    onEscape: onEscapeKey,
    enabled: !doneBanner && !showChooser,
  })

  useEffect(() => {
    if (!expandedTool) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpandedTool(null)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [expandedTool])

  /** Цвет класса (g7…g11) из дизайн-системы — для экрана «Параграф завершён». */
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

  const bookHref = `/learn/g/${grade.id}/book?chapter=${chapter.id}&section=${section.id}&page=${textbookSectionPage(grade.id, chapter.id, section.id)}`
  const backHref = fromBook && gradeHasTextbook(grade.id) ? bookHref : `/learn/g/${grade.id}/c/${chapter.id}`
  const backLabel = stripLeadingArrow(fromBook ? t('learn.bookTopic.backToBook') : t('learn.backChapters'))
  const fgosLabel = t('learn.fgos.badge', { block: fgosMeta.programBlock })
  const chapterTitle = t(chapter.titleKey)
  const hasLab = grade.id === 'g10'
  const labHref = `/organic?chapter=${chapter.id.replace(/\D/g, '') || '1'}&section=${section.id.replace(/\D/g, '') || '1'}`

  const sectionIndex = Math.max(0, chapter.sections.findIndex((s) => s.id === section.id))
  const sectionTotal = Math.max(1, chapter.sections.length)
  const progressLabel = t('learn.focus.progress', { n: sectionIndex + 1, total: sectionTotal })

  /** Содержимое инструмента. `onStage` — главная сцена режима. */
  const renderTool = (tool: FocusTool, onStage: boolean) => {
    switch (tool) {
      case 'cockpit':
        return (
          <div className={`${styles.learnColTheory} ${focus.plain}`} data-studio-col="main">
            <LearnLessonSidebar
              grade={grade}
              chapter={chapter}
              section={section}
              rosterSectionId={rosterSectionId}
              fromBook={fromBook}
            />
          </div>
        )
      case '3d':
        return (
          <div
            className={`${styles.learnCol3d} ${focus.plain}`}
            data-studio-col="3d"
            data-studio-fs={expandedTool === '3d' ? '1' : undefined}
          >
            <LearnSlideDeckVisual
              slide={slide}
              visualId={visualId}
              sectionSceneId={section.defaultVisualId}
              accent={accent}
              presentationMode={onStage ? false : expandedTool === '3d'}
            />
          </div>
        )
      case 'work':
        return (
          <div
            className={`${styles.learnColWork} ${focus.plain}`}
            data-studio-col="work"
            data-studio-fs={expandedTool === 'work' ? '1' : undefined}
          >
            <LearnWorkspace
              sectionPathId={pathId}
              taskCategoryId={taskCategoryId}
              presentationMode={onStage && presentationMode}
            />
          </div>
        )
      case 'assistant':
        return (
          <div
            className={`${styles.learnColAssistant} ${focus.plain}`}
            data-studio-col="assistant"
            data-studio-fs={expandedTool === 'assistant' ? '1' : undefined}
          >
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
        )
    }
  }

  const stageNavLabel = activeWs === 'board' ? t(FOCUS_MODE_LABEL.board) : t(FOCUS_TOOL_LABEL[stageTool])
  const stageNavIcon = activeWs === 'board' ? STUDIO_WORKSPACE_ICON.board : FOCUS_TOOL_ICON[stageTool]

  const panelClass = [
    focus.panel,
    expandedTool && expandedTool === panelTool ? styles.learnColFullscreen : '',
  ]
    .filter(Boolean)
    .join(' ')

  const bodyStyle = { '--focus-panel-w': `${panelW}px` } as CSSProperties

  return (
    <div
      className={`${styles.page} ${styles.learnLessonOneScreen} ${focus.root}`}
      data-studio-ws={activeWs}
      data-focus-lesson="1"
      style={gradeToneStyle}
    >
      <header className={focus.bar}>
        <Link className={focus.back} to={backHref} title={backLabel} aria-label={backLabel}>
          <LearnShellIcon name="arrowLeft" size={18} />
          <span className={focus.backLabel}>{backLabel}</span>
        </Link>
        <div className={focus.titleBlock}>
          <h1 className={focus.title} title={lessonTitle}>
            {titleParts.badge ? <span className={focus.para}>{titleParts.badge}</span> : null}
            <span className={focus.titleText}>{titleParts.text}</span>
          </h1>
          <p className={focus.progress} title={`${chapterTitle} · ${progressLabel}`}>
            <span className={focus.progressTrack} aria-hidden="true">
              <span
                className={focus.progressFill}
                style={{ width: `${Math.round(((sectionIndex + 1) / sectionTotal) * 100)}%` }}
              />
            </span>
            <span className={focus.progressText}>
              {chapterTitle} · {progressLabel}
            </span>
          </p>
        </div>

        <div className={focus.modes} role="group" aria-label={t('learn.focus.modes')}>
          {STUDIO_WORKSPACES.map((ws) => {
            const on = activeWs === ws
            return (
              <button
                key={ws}
                type="button"
                className={on ? `${focus.modeItem} ${focus.modeItemOn}` : focus.modeItem}
                onClick={() => pickWorkspace(ws)}
                aria-pressed={on}
                title={`${t(STUDIO_WORKSPACE_LABEL[ws])} (${STUDIO_WORKSPACE_KEY[ws]})`}
                data-studio-ws={ws}
              >
                <LearnShellIcon name={STUDIO_WORKSPACE_ICON[ws]} size={16} />
                <span className={focus.modeLabel}>{t(FOCUS_MODE_LABEL[ws])}</span>
              </button>
            )
          })}
        </div>

        <button type="button" className={focus.finish} onClick={finishSection} title={t('learn.finish')}>
          <LearnShellIcon name="check" size={18} strokeWidth={2.4} />
          <span className={focus.finishLabel}>{t('learn.finish')}</span>
        </button>

        <div className={focus.moreWrap}>
          <button
            type="button"
            className={focus.iconBtn}
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title={t('learn.studio.more')}
            aria-label={t('learn.studio.more')}
            data-studio-more="1"
          >
            <LearnShellIcon name="more" size={20} strokeWidth={3} />
          </button>
          {menuOpen ? (
            <>
              <button
                type="button"
                className={focus.menuBackdrop}
                aria-label={t('learn.studio.close')}
                onClick={() => setMenuOpen(false)}
              />
              <div className={focus.menu} role="menu" aria-label={t('learn.studio.moreTitle')} data-studio-sheet="1">
                <div className={focus.menuSection}>
                  <p className={focus.menuLabel}>{t('learn.focus.more.lesson')}</p>
                  <p className={focus.menuInfo}>
                    <LearnShellIcon name="clock" size={16} />
                    <span>{t('learn.estimatedMin', { n: section.estimatedMin })}</span>
                  </p>
                  <p className={focus.menuInfo}>
                    <LearnShellIcon name="award" size={16} />
                    <span>{fgosLabel}</span>
                  </p>
                </div>
                <div className={focus.menuSection}>
                  <p className={focus.menuLabel}>{t('learn.studio.links')}</p>
                  <Link className={focus.menuItem} to="/learn/tasks" role="menuitem">
                    <LearnShellIcon name="tasks" size={18} />
                    <span className={focus.menuItemText}>{t('learn.grades.tasks')}</span>
                  </Link>
                  {gradeHasTextbook(grade.id) ? (
                    <Link className={focus.menuItem} to={bookHref} role="menuitem">
                      <LearnShellIcon name="book" size={18} />
                      <span className={focus.menuItemText}>{t('learn.textbook.openSection')}</span>
                    </Link>
                  ) : null}
                  {hasLab ? (
                    <Link className={focus.menuItem} to={labHref} role="menuitem">
                      <LearnShellIcon name="flask" size={18} />
                      <span className={focus.menuItemText}>{t('organicLab.openInLab')}</span>
                    </Link>
                  ) : null}
                </div>
                <div className={focus.menuSection}>
                  <p className={focus.menuLabel}>{t('learn.focus.more.mode')}</p>
                  <button
                    type="button"
                    className={focus.menuItem}
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false)
                      setChooserOpen(true)
                    }}
                    data-studio-ws-change="1"
                  >
                    <LearnShellIcon name="layers" size={18} />
                    <span className={focus.menuItemText}>{t('learn.focus.more.chooseMode')}</span>
                  </button>
                  <button
                    type="button"
                    className={focus.menuItem}
                    role="menuitemcheckbox"
                    aria-checked={!rememberedWs}
                    onClick={toggleAskMode}
                  >
                    <LearnShellIcon name="list" size={18} />
                    <span className={focus.menuItemText}>{t('learn.focus.more.askMode')}</span>
                    <input type="checkbox" className={focus.menuCheck} checked={!rememberedWs} readOnly tabIndex={-1} aria-hidden="true" />
                  </button>
                  {isDesktop ? (
                    <button
                      type="button"
                      className={focus.menuItem}
                      role="menuitemcheckbox"
                      aria-checked={openTool != null}
                      onClick={() => {
                        togglePanel()
                        setMenuOpen(false)
                      }}
                    >
                      <LearnShellIcon name="layout" size={18} />
                      <span className={focus.menuItemText}>{t('learn.focus.tools.show')}</span>
                      <input type="checkbox" className={focus.menuCheck} checked={openTool != null} readOnly tabIndex={-1} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
                {isDesktop ? (
                  <div className={focus.menuSection}>
                    <p className={focus.menuLabel}>{t('learn.studio.shortcuts')}</p>
                    <div className={focus.keyRow}>
                      <span>{t('learn.focus.key.modes')}</span>
                      <span className={focus.kbds}>
                        <kbd className={focus.kbd}>1</kbd>
                        <kbd className={focus.kbd}>2</kbd>
                        <kbd className={focus.kbd}>3</kbd>
                      </span>
                    </div>
                    <div className={focus.keyRow}>
                      <span>{t('learn.focus.key.board')}</span>
                      <kbd className={focus.kbd}>B</kbd>
                    </div>
                    <div className={focus.keyRow}>
                      <span>{t('learn.focus.key.fullscreen')}</span>
                      <kbd className={focus.kbd}>F</kbd>
                    </div>
                    <div className={focus.keyRow}>
                      <span>{t('learn.focus.key.escape')}</span>
                      <kbd className={focus.kbd}>Esc</kbd>
                    </div>
                    <div className={focus.keyRow}>
                      <span>{t('learn.focus.key.help')}</span>
                      <kbd className={focus.kbd}>?</kbd>
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </header>

      {expandedTool ? (
        <button
          type="button"
          className={styles.learnFsBackdrop}
          aria-label={t('learn.panel.collapse')}
          onClick={() => setExpandedTool(null)}
        />
      ) : null}

      {workspace ? (
        <div
          className={dragging ? `${focus.body} ${shell.layoutDragging}` : focus.body}
          style={bodyStyle}
          data-focus-body="1"
        >
          <section
            className={!isDesktop && mobileView !== 'stage' ? `${focus.stage} ${focus.hideMobile}` : focus.stage}
            aria-label={stageNavLabel}
            data-focus-stage={stageTool}
          >
            {renderTool(stageTool, true)}
          </section>

          {panelTool ? (
            <>
              {isDesktop && !expandedTool ? (
                <div className={focus.resizer}>
                  <StudioResizer
                    label={t('learn.studio.resize', { a: stageNavLabel, b: t(FOCUS_TOOL_LABEL[panelTool]) })}
                    hint={t('learn.studio.resizeHint')}
                    onDelta={onPanelDelta}
                    onReset={onPanelReset}
                    onDragState={onDragState}
                  />
                </div>
              ) : null}
              <aside
                className={panelClass}
                aria-label={t(FOCUS_TOOL_LABEL[panelTool])}
                data-focus-panel={panelTool}
              >
                <div className={focus.panelHead}>
                  <h2 className={focus.panelTitle}>{t(FOCUS_TOOL_LABEL[panelTool])}</h2>
                  <button
                    type="button"
                    className={`${focus.iconBtn} ${focus.panelExpand}`}
                    onClick={() => setExpandedTool((cur) => (cur ? null : panelTool))}
                    aria-pressed={expandedTool === panelTool}
                    title={expandedTool ? `${t('learn.panel.collapse')} (Esc)` : `${t('learn.panel.fullscreen')} (F)`}
                    aria-label={expandedTool ? t('learn.panel.collapse') : t('learn.panel.fullscreen')}
                    data-studio-expand="1"
                  >
                    <LearnShellIcon name={expandedTool ? 'minimize' : 'maximize'} size={16} />
                  </button>
                  {isDesktop ? (
                    <button
                      type="button"
                      className={focus.iconBtn}
                      onClick={() => {
                        setExpandedTool(null)
                        updatePanel(activeWs, null)
                      }}
                      title={t('learn.focus.tools.hide')}
                      aria-label={t('learn.focus.tools.hide')}
                      data-studio-hide="1"
                    >
                      <LearnShellIcon name="close" size={16} />
                    </button>
                  ) : null}
                </div>
                <div className={focus.panelBody}>{renderTool(panelTool, false)}</div>
              </aside>
            </>
          ) : null}

          <nav className={focus.rail} aria-label={t('learn.focus.tools')}>
            {tools.map((tool) => {
              const on = openTool === tool
              const label = t(FOCUS_TOOL_LABEL[tool])
              return (
                <button
                  key={tool}
                  type="button"
                  className={on ? `${focus.railItem} ${focus.railItemOn}` : focus.railItem}
                  onClick={() => pickTool(tool)}
                  aria-pressed={on}
                  title={on ? `${label} · ${t('learn.focus.tools.hide')}` : label}
                  data-focus-tool={tool}
                >
                  <LearnShellIcon name={FOCUS_TOOL_ICON[tool]} size={20} />
                  <span className={focus.railLabel}>{label}</span>
                </button>
              )
            })}
          </nav>
        </div>
      ) : null}

      {workspace ? (
        <nav className={focus.nav} aria-label={t('learn.focus.tools')} data-studio-dock="1">
          <button
            type="button"
            className={mobileView === 'stage' ? `${focus.navItem} ${focus.navItemOn}` : focus.navItem}
            onClick={() => setMobileView('stage')}
            aria-pressed={mobileView === 'stage'}
            data-focus-nav="stage"
          >
            <LearnShellIcon name={stageNavIcon} size={20} />
            <span className={focus.navLabel}>{stageNavLabel}</span>
          </button>
          {tools.map((tool) => (
            <button
              key={tool}
              type="button"
              className={mobileView === tool ? `${focus.navItem} ${focus.navItemOn}` : focus.navItem}
              onClick={() => setMobileView(tool)}
              aria-pressed={mobileView === tool}
              data-focus-nav={tool}
            >
              <LearnShellIcon name={FOCUS_TOOL_ICON[tool]} size={20} />
              <span className={focus.navLabel}>{t(FOCUS_TOOL_LABEL[tool])}</span>
            </button>
          ))}
        </nav>
      ) : null}

      {showChooser ? (
        <StudioWorkspaceChooser
          lessonTitle={titleParts.text}
          badge={titleParts.badge}
          current={workspace}
          remembered={rememberedWs != null}
          onPick={pickFromChooser}
          onClose={workspace ? () => setChooserOpen(false) : undefined}
        />
      ) : null}
    </div>
  )
}
