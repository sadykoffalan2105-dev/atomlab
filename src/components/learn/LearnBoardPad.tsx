import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type SVGProps,
} from 'react'
import { useT, type MessageKey } from '../../i18n/useT'
import { readWorkspaceInk, writeWorkspaceInk } from '../../learn/learnProgressStorage'
import { IconEraser, IconHand, IconInfo, IconKeyboard, IconMinus, IconPlus, IconSparkle, IconTrash } from './LearnAiIcons'
import { LearnShellIcon } from './LearnShellIcon'
import { Kbd } from './studio/StudioKit'
import kit from './studio/StudioKit.module.css'
import styles from './LearnBoardPad.module.css'
import {
  countTextStats,
  formatChemistryInRange,
  insertAtRange,
  insertBlockAtRange,
  type CaretRange,
} from './LearnBoardPadFormat'

export type BoardInputMode = 'touch' | 'keyboard'
export type BoardSaveState = 'idle' | 'pending' | 'saved'

const ZOOM_MIN = 0.65
const ZOOM_MAX = 2.25
const ZOOM_STEP = 0.15
const INK_CANVAS_H = 960
const ERASER_WIDTH = 22
const TEXT_HISTORY_MAX = 80
const TEXT_HISTORY_COALESCE_MS = 700
const INK_HISTORY_MAX = 15
const NOTICE_MS = 1800
const CONFIRM_MS = 5000
const PREFS_KEY = 'atomlab-learn-work-v1'

type Props = {
  sectionPathId: string
  text: string
  onTextChange: (value: string) => void
  presentationMode?: boolean
  /** Статус автосохранения текста (ведёт родитель, который пишет черновик). */
  saveState?: BoardSaveState
  savedAt?: number | null
}

type Point = { x: number; y: number }
type PaperKind = 'dots' | 'lines' | 'grid' | 'blank'
type PenColorId = 'chalk' | 'amber' | 'cyan' | 'pink' | 'green'
type PenWidthId = 'thin' | 'mid' | 'thick'
type Prefs = { palette: boolean; paper: PaperKind; pen: PenColorId; width: PenWidthId }
type TextHistory = { id: string; past: string[]; future: string[] }
type InkHistory = { id: string; states: string[]; future: string[] }
type Notice = { text: string; tone: 'ok' | 'warn' }

const PAPERS: readonly PaperKind[] = ['dots', 'lines', 'grid', 'blank']
const PAPER_LABEL: Record<PaperKind, MessageKey> = {
  dots: 'learn.studio.work.paperDots',
  lines: 'learn.studio.work.paperLines',
  grid: 'learn.studio.work.paperGrid',
  blank: 'learn.studio.work.paperBlank',
}

const PEN_COLORS: readonly { id: PenColorId; cssVar: string; fallback: string; labelKey: MessageKey }[] = [
  { id: 'chalk', cssVar: '--lt-text', fallback: '#e8edff', labelKey: 'learn.studio.work.colorChalk' },
  { id: 'amber', cssVar: '--lt-accent-amber', fallback: '#fbbf24', labelKey: 'learn.studio.work.colorAmber' },
  { id: 'cyan', cssVar: '--lt-accent-cyan', fallback: '#22d3ee', labelKey: 'learn.studio.work.colorCyan' },
  { id: 'pink', cssVar: '--lt-accent-pink', fallback: '#f472b6', labelKey: 'learn.studio.work.colorPink' },
  { id: 'green', cssVar: '--lt-success', fallback: '#34d399', labelKey: 'learn.studio.work.colorGreen' },
]

const PEN_WIDTHS: readonly { id: PenWidthId; px: number; labelKey: MessageKey }[] = [
  { id: 'thin', px: 2, labelKey: 'learn.studio.work.widthThin' },
  { id: 'mid', px: 3.5, labelKey: 'learn.studio.work.widthMid' },
  { id: 'thick', px: 6, labelKey: 'learn.studio.work.widthThick' },
]

const PALETTE: readonly { id: string; labelKey: MessageKey; items: readonly string[] }[] = [
  { id: 'sub', labelKey: 'learn.studio.work.palSub', items: ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'] },
  { id: 'sup', labelKey: 'learn.studio.work.palSup', items: ['⁺', '⁻', '²⁺', '³⁺', '²⁻', '³⁻'] },
  { id: 'arrows', labelKey: 'learn.studio.work.palArrows', items: ['→', '⇄', '↑', '↓'] },
  { id: 'signs', labelKey: 'learn.studio.work.palSigns', items: ['Δ', '°C', '·', 'ē'] },
  { id: 'groups', labelKey: 'learn.studio.work.palGroups', items: ['OH', 'SO₄', 'NO₃', 'CO₃', 'PO₄', 'NH₄'] },
]

const TEMPLATES: readonly { id: string; glyph: string; labelKey: MessageKey; bodyKey: MessageKey }[] = [
  { id: 'given', glyph: '?', labelKey: 'learn.studio.work.tplGiven', bodyKey: 'learn.studio.work.tplGivenBody' },
  { id: 'equation', glyph: '→', labelKey: 'learn.studio.work.tplEquation', bodyKey: 'learn.studio.work.tplEquationBody' },
  { id: 'table', glyph: '▦', labelKey: 'learn.studio.work.tplTable', bodyKey: 'learn.studio.work.tplTableBody' },
  { id: 'balance', glyph: 'ē', labelKey: 'learn.studio.work.tplBalance', bodyKey: 'learn.studio.work.tplBalanceBody' },
]

const DEFAULT_PREFS: Prefs = { palette: true, paper: 'dots', pen: 'chalk', width: 'mid' }

function readPrefs(): Prefs {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY)
    if (!raw) return DEFAULT_PREFS
    const p = JSON.parse(raw) as Partial<Prefs>
    return {
      palette: typeof p.palette === 'boolean' ? p.palette : DEFAULT_PREFS.palette,
      paper: PAPERS.includes(p.paper as PaperKind) ? (p.paper as PaperKind) : DEFAULT_PREFS.paper,
      pen: PEN_COLORS.some((c) => c.id === p.pen) ? (p.pen as PenColorId) : DEFAULT_PREFS.pen,
      width: PEN_WIDTHS.some((w) => w.id === p.width) ? (p.width as PenWidthId) : DEFAULT_PREFS.width,
    }
  } catch {
    return DEFAULT_PREFS
  }
}

function writePrefs(patch: Partial<Prefs>) {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify({ ...readPrefs(), ...patch }))
  } catch {
    /* private mode / quota */
  }
}

function clampZoom(z: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100))
}

function prefersTouchInput(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(pointer: coarse)').matches) return true
  return navigator.maxTouchPoints > 0
}

function defaultInputMode(): BoardInputMode {
  return prefersTouchInput() ? 'touch' : 'keyboard'
}

function formatClock(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  } catch {
    const d = new Date(ts)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
}

function fileSlug(sectionPathId: string): string {
  return sectionPathId.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'draft'
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}

function normTextHistory(h: TextHistory, id: string): TextHistory {
  return h.id === id ? h : { id, past: [], future: [] }
}

function normInkHistory(h: InkHistory, id: string): InkHistory {
  return h.id === id ? h : { id, states: [readWorkspaceInk(id) || ''], future: [] }
}

/* ——— Маленькие иконки, которых нет в общих наборах ——— */

function svgBase(props: SVGProps<SVGSVGElement>) {
  return {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
    ...props,
  }
}

function IconUndo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...svgBase(props)}>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </svg>
  )
}

function IconRedo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...svgBase(props)}>
      <path d="m15 14 5-5-5-5" />
      <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
    </svg>
  )
}

function IconCopy(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...svgBase(props)}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V6a2 2 0 0 1 2-2h9" />
    </svg>
  )
}

function IconDownload(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...svgBase(props)}>
      <path d="M12 4v11" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 20h14" />
    </svg>
  )
}

function IconPaper({ kind, ...props }: SVGProps<SVGSVGElement> & { kind: PaperKind }) {
  return (
    <svg {...svgBase(props)}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      {kind === 'dots' ? (
        <>
          <circle cx="9" cy="9" r="0.9" fill="currentColor" />
          <circle cx="15" cy="9" r="0.9" fill="currentColor" />
          <circle cx="9" cy="15" r="0.9" fill="currentColor" />
          <circle cx="15" cy="15" r="0.9" fill="currentColor" />
        </>
      ) : kind === 'lines' ? (
        <>
          <path d="M7 9.5h10" />
          <path d="M7 14.5h10" />
        </>
      ) : kind === 'grid' ? (
        <>
          <path d="M12 4v16" />
          <path d="M4 12h16" />
        </>
      ) : null}
    </svg>
  )
}

export function LearnBoardPad({
  sectionPathId,
  text,
  onTextChange,
  presentationMode = false,
  saveState = 'idle',
  savedAt = null,
}: Props) {
  const { t } = useT()
  const uid = useId()
  const [mode, setMode] = useState<BoardInputMode>(defaultInputMode)
  const [zoom, setZoom] = useState(() => (presentationMode ? 1.15 : 1))
  const [prefs, setPrefs] = useState<Prefs>(readPrefs)
  const [eraser, setEraser] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [menuLeft, setMenuLeft] = useState(0)
  const [confirmClear, setConfirmClear] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [textHist, setTextHist] = useState<TextHistory>({ id: sectionPathId, past: [], future: [] })
  const [inkHist, setInkHist] = useState<InkHistory>(() => normInkHistory({ id: '', states: [], future: [] }, sectionPathId))
  const [inkSavedAt, setInkSavedAt] = useState<number | null>(null)
  // Есть ли рукописные записи — чтобы показать подсказку на пустом листе.
  const [hasInk, setHasInk] = useState(() => Boolean(readWorkspaceInk(sectionPathId)))
  const [inkPathId, setInkPathId] = useState(sectionPathId)
  if (inkPathId !== sectionPathId) {
    setInkPathId(sectionPathId)
    setHasInk(Boolean(readWorkspaceInk(sectionPathId)))
    setConfirmClear(false)
    setTemplatesOpen(false)
  }

  const rootRef = useRef<HTMLDivElement | null>(null)
  const barRef = useRef<HTMLDivElement | null>(null)
  const templatesBtnRef = useRef<HTMLButtonElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const dprRef = useRef(1)
  const drawingRef = useRef(false)
  const lastPtRef = useRef<Point | null>(null)
  const saveInkTimerRef = useRef(0)
  const noticeTimerRef = useRef(0)
  const confirmTimerRef = useRef(0)
  const lastTypeAtRef = useRef(0)
  const pendingCaretRef = useRef<CaretRange | null>(null)
  const activePointerRef = useRef<number | null>(null)
  const canvasReadyRef = useRef(false)
  // Зеркала для обработчиков указателя (они читают актуальные значения вне React-рендера).
  const modeRef = useRef(mode)
  const penRef = useRef({ pen: prefs.pen, width: prefs.width, eraser })
  useEffect(() => {
    modeRef.current = mode
    penRef.current = { pen: prefs.pen, width: prefs.width, eraser }
  }, [mode, prefs.pen, prefs.width, eraser])

  const curTextHist = normTextHistory(textHist, sectionPathId)
  const curInkHist = normInkHistory(inkHist, sectionPathId)

  useEffect(
    () => () => {
      window.clearTimeout(noticeTimerRef.current)
      window.clearTimeout(confirmTimerRef.current)
    },
    [],
  )

  const showNotice = useCallback((text: string, tone: Notice['tone'] = 'ok') => {
    window.clearTimeout(noticeTimerRef.current)
    setNotice({ text, tone })
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), NOTICE_MS)
  }, [])

  const updatePrefs = useCallback((patch: Partial<Prefs>) => {
    setPrefs((p) => ({ ...p, ...patch }))
    writePrefs(patch)
  }, [])

  /* ——— Текст: история, вставка, оформление ——— */

  const currentRange = useCallback((): CaretRange => {
    const ta = textareaRef.current
    if (!ta) return { start: text.length, end: text.length }
    return { start: ta.selectionStart ?? text.length, end: ta.selectionEnd ?? text.length }
  }, [text])

  const commitText = useCallback(
    (next: string, caret: CaretRange | null, coalesce: boolean) => {
      if (next === text) return
      const now = Date.now()
      const skipPush = coalesce && now - lastTypeAtRef.current < TEXT_HISTORY_COALESCE_MS && curTextHist.past.length > 0
      lastTypeAtRef.current = coalesce ? now : 0
      if (!skipPush) {
        const past = [...curTextHist.past, text].slice(-TEXT_HISTORY_MAX)
        setTextHist({ id: sectionPathId, past, future: [] })
      } else if (curTextHist.future.length > 0) {
        setTextHist({ id: sectionPathId, past: curTextHist.past, future: [] })
      }
      pendingCaretRef.current = caret
      onTextChange(next)
    },
    [curTextHist, onTextChange, sectionPathId, text],
  )

  useLayoutEffect(() => {
    const caret = pendingCaretRef.current
    const ta = textareaRef.current
    if (!caret || !ta) return
    pendingCaretRef.current = null
    const start = Math.min(caret.start, ta.value.length)
    const end = Math.min(caret.end, ta.value.length)
    ta.focus({ preventScroll: true })
    try {
      ta.setSelectionRange(start, end)
    } catch {
      /* ignore */
    }
  }, [text])

  const undoText = useCallback(() => {
    const past = curTextHist.past
    if (past.length === 0) return
    const prev = past[past.length - 1]
    setTextHist({ id: sectionPathId, past: past.slice(0, -1), future: [...curTextHist.future, text] })
    lastTypeAtRef.current = 0
    pendingCaretRef.current = { start: prev.length, end: prev.length }
    onTextChange(prev)
  }, [curTextHist, onTextChange, sectionPathId, text])

  const redoText = useCallback(() => {
    const future = curTextHist.future
    if (future.length === 0) return
    const next = future[future.length - 1]
    setTextHist({ id: sectionPathId, past: [...curTextHist.past, text], future: future.slice(0, -1) })
    lastTypeAtRef.current = 0
    pendingCaretRef.current = { start: next.length, end: next.length }
    onTextChange(next)
  }, [curTextHist, onTextChange, sectionPathId, text])

  const insertSymbol = useCallback(
    (symbol: string) => {
      const r = insertAtRange(text, currentRange(), symbol)
      commitText(r.text, { start: r.caret, end: r.caret }, false)
    },
    [commitText, currentRange, text],
  )

  const insertTemplate = useCallback(
    (bodyKey: MessageKey) => {
      const r = insertBlockAtRange(text, currentRange(), t(bodyKey))
      commitText(r.text, { start: r.caret, end: r.caret }, false)
      setTemplatesOpen(false)
      showNotice(t('learn.studio.work.inserted'))
    },
    [commitText, currentRange, showNotice, t, text],
  )

  const formatNow = useCallback(() => {
    const r = formatChemistryInRange(text, currentRange())
    if (!r.changed) {
      showNotice(t('learn.studio.work.formatNone'), 'warn')
      textareaRef.current?.focus({ preventScroll: true })
      return
    }
    commitText(r.text, r.range, false)
    showNotice(t('learn.studio.work.formatDone'))
  }, [commitText, currentRange, showNotice, t, text])

  const onTextareaKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      const mod = e.ctrlKey || e.metaKey
      if (!mod || e.altKey) return
      const k = e.key.toLowerCase()
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault()
        undoText()
      } else if (k === 'y' || (k === 'z' && e.shiftKey)) {
        e.preventDefault()
        redoText()
      }
    },
    [redoText, undoText],
  )

  /* ——— Меню шаблонов ——— */

  const openTemplates = useCallback(() => {
    const btn = templatesBtnRef.current
    const bar = barRef.current
    if (btn && bar) {
      const b = btn.getBoundingClientRect()
      const r = bar.getBoundingClientRect()
      setMenuLeft(Math.max(0, Math.min(b.left - r.left, Math.max(0, r.width - 300))))
    }
    setTemplatesOpen(true)
  }, [])

  useEffect(() => {
    if (!templatesOpen) return
    const onDown = (e: PointerEvent) => {
      const root = barRef.current
      if (root && e.target instanceof Node && root.contains(e.target)) return
      setTemplatesOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setTemplatesOpen(false)
        templatesBtnRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [templatesOpen])

  /* ——— Холст ——— */

  const canvasLogicalSize = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return { w: 0, h: 0 }
    return {
      w: canvas.width / dprRef.current,
      h: canvas.height / dprRef.current,
    }
  }, [])

  const measureCanvasWidth = useCallback(() => {
    const vp = viewportRef.current
    if (!vp) return 280
    return Math.max(280, Math.floor(vp.clientWidth))
  }, [])

  const resolvePenColor = useCallback((id: PenColorId): string => {
    const def = PEN_COLORS.find((c) => c.id === id) ?? PEN_COLORS[0]
    const el = rootRef.current
    if (!el) return def.fallback
    const v = getComputedStyle(el).getPropertyValue(def.cssVar).trim()
    return v || def.fallback
  }, [])

  /** Базовые настройки контекста (без пера) — для восстановления картинки. */
  const resetContext = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.setTransform(dprRef.current, 0, 0, dprRef.current, 0, 0)
    ctx.globalCompositeOperation = 'source-over'
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  /** Настройки пера для текущего штриха: цвет/толщина из токенов или ластик. */
  const applyPen = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      resetContext(ctx)
      const { pen, width, eraser: erase } = penRef.current
      if (erase) {
        ctx.globalCompositeOperation = 'destination-out'
        ctx.strokeStyle = 'rgba(0,0,0,1)'
        ctx.lineWidth = ERASER_WIDTH
        return
      }
      ctx.strokeStyle = resolvePenColor(pen)
      ctx.lineWidth = PEN_WIDTHS.find((w) => w.id === width)?.px ?? 3.5
    },
    [resetContext, resolvePenColor],
  )

  const paintInk = useCallback(
    (data: string) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const { w, h } = canvasLogicalSize()
      resetContext(ctx)
      ctx.clearRect(0, 0, w, h)
      if (!data) return
      const img = new Image()
      img.onload = () => {
        const c = canvasRef.current
        const cctx = c?.getContext('2d')
        if (!c || !cctx) return
        const size = canvasLogicalSize()
        resetContext(cctx)
        cctx.clearRect(0, 0, size.w, size.h)
        cctx.drawImage(img, 0, 0, size.w, size.h)
      }
      img.src = data
    },
    [canvasLogicalSize, resetContext],
  )

  const paintInkFromStorage = useCallback(
    (dataUrl?: string) => {
      paintInk(dataUrl ?? readWorkspaceInk(sectionPathId))
    },
    [paintInk, sectionPathId],
  )

  const resizeCanvas = useCallback(
    (restoreInk = true) => {
      const canvas = canvasRef.current
      if (!canvas) return

      let inkRestore = readWorkspaceInk(sectionPathId)
      if (restoreInk && canvasReadyRef.current) {
        try {
          inkRestore = canvas.toDataURL('image/png') || inkRestore
        } catch {
          /* ignore */
        }
      }

      const w = measureCanvasWidth()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      dprRef.current = dpr

      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(INK_CANVAS_H * dpr)
      canvas.style.width = '100%'
      canvas.style.height = `${INK_CANVAS_H}px`

      const ctx = canvas.getContext('2d')
      if (!ctx) return
      resetContext(ctx)

      if (restoreInk) {
        paintInkFromStorage(inkRestore)
      }
      canvasReadyRef.current = true
    },
    [measureCanvasWidth, paintInkFromStorage, resetContext, sectionPathId],
  )

  useLayoutEffect(() => {
    canvasReadyRef.current = false
  }, [sectionPathId])

  useLayoutEffect(() => {
    if (mode !== 'touch') return
    resizeCanvas(true)
  }, [mode, sectionPathId, resizeCanvas])

  useEffect(() => {
    if (mode !== 'touch') return
    const vp = viewportRef.current
    if (!vp) return

    const ro = new ResizeObserver(() => resizeCanvas(true))
    ro.observe(vp)
    return () => ro.disconnect()
  }, [mode, resizeCanvas])

  /** Сохранить холст и зафиксировать состояние в истории (быстрые штрихи объединяются). */
  const scheduleInkSave = useCallback(() => {
    window.clearTimeout(saveInkTimerRef.current)
    saveInkTimerRef.current = window.setTimeout(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      try {
        const data = canvas.toDataURL('image/png')
        writeWorkspaceInk(sectionPathId, data)
        setInkSavedAt(Date.now())
        setInkHist((h) => {
          const cur = normInkHistory(h, sectionPathId)
          return { id: sectionPathId, states: [...cur.states, data].slice(-INK_HISTORY_MAX), future: [] }
        })
      } catch {
        /* quota */
      }
    }, 350)
  }, [sectionPathId])

  const restoreInkState = useCallback(
    (data: string) => {
      window.clearTimeout(saveInkTimerRef.current)
      paintInk(data)
      writeWorkspaceInk(sectionPathId, data)
      setHasInk(Boolean(data))
      setInkSavedAt(Date.now())
    },
    [paintInk, sectionPathId],
  )

  const undoInk = useCallback(() => {
    const { states, future } = curInkHist
    if (states.length < 2) return
    const cur = states[states.length - 1]
    const prev = states[states.length - 2]
    setInkHist({ id: sectionPathId, states: states.slice(0, -1), future: [...future, cur] })
    restoreInkState(prev)
  }, [curInkHist, restoreInkState, sectionPathId])

  const redoInk = useCallback(() => {
    const { states, future } = curInkHist
    if (future.length === 0) return
    const next = future[future.length - 1]
    setInkHist({ id: sectionPathId, states: [...states, next].slice(-INK_HISTORY_MAX), future: future.slice(0, -1) })
    restoreInkState(next)
  }, [curInkHist, restoreInkState, sectionPathId])

  const pointFromClient = useCallback(
    (clientX: number, clientY: number): Point | null => {
      const canvas = canvasRef.current
      if (!canvas) return null
      const rect = canvas.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return null
      const { w, h } = canvasLogicalSize()
      return {
        x: ((clientX - rect.left) / rect.width) * w,
        y: ((clientY - rect.top) / rect.height) * h,
      }
    },
    [canvasLogicalSize],
  )

  const plotPoint = useCallback(
    (pt: Point, start: boolean) => {
      const ctx = canvasRef.current?.getContext('2d')
      if (!ctx) return
      applyPen(ctx)
      if (start) {
        ctx.beginPath()
        ctx.moveTo(pt.x, pt.y)
        ctx.lineTo(pt.x + 0.05, pt.y + 0.05)
        ctx.stroke()
        return
      }
      const last = lastPtRef.current
      if (!last) return
      ctx.beginPath()
      ctx.moveTo(last.x, last.y)
      ctx.lineTo(pt.x, pt.y)
      ctx.stroke()
    },
    [applyPen],
  )

  const beginStroke = useCallback(
    (pt: Point) => {
      drawingRef.current = true
      lastPtRef.current = pt
      plotPoint(pt, true)
      if (!penRef.current.eraser) setHasInk(true)
    },
    [plotPoint],
  )

  const extendStroke = useCallback(
    (pt: Point) => {
      if (!drawingRef.current) return
      plotPoint(pt, false)
      lastPtRef.current = pt
    },
    [plotPoint],
  )

  const finishStroke = useCallback(() => {
    if (!drawingRef.current) return
    drawingRef.current = false
    activePointerRef.current = null
    lastPtRef.current = null
    scheduleInkSave()
  }, [scheduleInkSave])

  useEffect(() => {
    if (mode !== 'touch') return
    const canvas = canvasRef.current
    if (!canvas) return

    const isDrawPointer = (type: string) => type === 'touch' || type === 'pen' || type === 'mouse'

    const onPointerDown = (e: PointerEvent) => {
      if (modeRef.current !== 'touch') return
      if (e.pointerType === 'touch') return
      if (!isDrawPointer(e.pointerType)) return
      if (e.pointerType === 'mouse' && e.button !== 0) return

      e.preventDefault()
      e.stopPropagation()

      try {
        canvas.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }

      activePointerRef.current = e.pointerId
      const pt = pointFromClient(e.clientX, e.clientY)
      if (!pt) return
      beginStroke(pt)
    }

    const onPointerMove = (e: PointerEvent) => {
      if (modeRef.current !== 'touch') return
      if (e.pointerType === 'touch') return
      if (!drawingRef.current) return
      if (activePointerRef.current !== e.pointerId) return
      e.preventDefault()
      const pt = pointFromClient(e.clientX, e.clientY)
      if (!pt) return
      extendStroke(pt)
    }

    const onPointerUp = (e: PointerEvent) => {
      if (activePointerRef.current !== e.pointerId) return
      e.preventDefault()
      try {
        canvas.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      finishStroke()
    }

    const onTouchStart = (e: TouchEvent) => {
      if (modeRef.current !== 'touch') return
      if (e.touches.length !== 1) return
      e.preventDefault()
      e.stopPropagation()
      const touch = e.touches[0]
      if (!touch) return
      activePointerRef.current = touch.identifier
      const pt = pointFromClient(touch.clientX, touch.clientY)
      if (!pt) return
      beginStroke(pt)
    }

    const onTouchMove = (e: TouchEvent) => {
      if (modeRef.current !== 'touch') return
      if (!drawingRef.current) return
      e.preventDefault()
      const touch = [...e.touches].find((t) => t.identifier === activePointerRef.current) ?? e.touches[0]
      if (!touch) return
      const pt = pointFromClient(touch.clientX, touch.clientY)
      if (!pt) return
      extendStroke(pt)
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (!drawingRef.current) return
      const ended = [...e.changedTouches].some((t) => t.identifier === activePointerRef.current)
      if (!ended && e.touches.length > 0) return
      e.preventDefault()
      finishStroke()
    }

    const opts = { passive: false } as const
    canvas.addEventListener('pointerdown', onPointerDown, opts)
    canvas.addEventListener('pointermove', onPointerMove, opts)
    canvas.addEventListener('pointerup', onPointerUp, opts)
    canvas.addEventListener('pointercancel', onPointerUp, opts)
    canvas.addEventListener('touchstart', onTouchStart, opts)
    canvas.addEventListener('touchmove', onTouchMove, opts)
    canvas.addEventListener('touchend', onTouchEnd, opts)
    canvas.addEventListener('touchcancel', onTouchEnd, opts)

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('touchend', onTouchEnd)
      canvas.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [mode, beginStroke, extendStroke, finishStroke, pointFromClient])

  const clearInk = useCallback(() => {
    const { states } = curInkHist
    const cur = states[states.length - 1] ?? ''
    setInkHist({ id: sectionPathId, states: [...states, ''].slice(-INK_HISTORY_MAX), future: [] })
    void cur
    restoreInkState('')
  }, [curInkHist, restoreInkState, sectionPathId])

  /** PNG холста поверх цвета «листа» — чтобы светлые штрихи были видны в любом просмотрщике. */
  const composeInkBlob = useCallback(async (): Promise<Blob | null> => {
    const canvas = canvasRef.current
    const vp = viewportRef.current
    if (!canvas) return null
    const out = document.createElement('canvas')
    out.width = canvas.width
    out.height = canvas.height
    const ctx = out.getContext('2d')
    if (!ctx) return null
    const paper = vp ? getComputedStyle(vp).backgroundColor : ''
    const bg = rootRef.current ? getComputedStyle(rootRef.current).getPropertyValue('--lt-bg').trim() : ''
    ctx.fillStyle = bg || '#0b1020'
    ctx.fillRect(0, 0, out.width, out.height)
    if (paper && paper !== 'rgba(0, 0, 0, 0)' && paper !== 'transparent') {
      ctx.fillStyle = paper
      ctx.fillRect(0, 0, out.width, out.height)
    }
    ctx.drawImage(canvas, 0, 0)
    return new Promise((resolve) => out.toBlob((b) => resolve(b), 'image/png'))
  }, [])

  /* ——— Общие действия: копировать, скачать, очистить ——— */

  const isTouch = mode === 'touch'
  const isEmpty = isTouch ? !hasInk : text.length === 0

  const copyNow = useCallback(async () => {
    try {
      if (isTouch) {
        const blob = await composeInkBlob()
        if (!blob || typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) throw new Error('unsupported')
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      } else {
        if (!navigator.clipboard?.writeText) throw new Error('unsupported')
        await navigator.clipboard.writeText(text)
      }
      showNotice(t('learn.studio.work.copied'))
    } catch {
      showNotice(t('learn.studio.work.copyFail'), 'warn')
    }
  }, [composeInkBlob, isTouch, showNotice, t, text])

  const exportNow = useCallback(async () => {
    const slug = fileSlug(sectionPathId)
    try {
      if (isTouch) {
        const blob = await composeInkBlob()
        if (!blob) throw new Error('no canvas')
        downloadBlob(blob, `atomlab-${slug}.png`)
      } else {
        downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), `atomlab-${slug}.txt`)
      }
      showNotice(t('learn.studio.work.exported'))
    } catch {
      showNotice(t('learn.studio.work.copyFail'), 'warn')
    }
  }, [composeInkBlob, isTouch, sectionPathId, showNotice, t, text])

  const askClear = useCallback(() => {
    window.clearTimeout(confirmTimerRef.current)
    setConfirmClear(true)
    confirmTimerRef.current = window.setTimeout(() => setConfirmClear(false), CONFIRM_MS)
  }, [])

  const cancelClear = useCallback(() => {
    window.clearTimeout(confirmTimerRef.current)
    setConfirmClear(false)
  }, [])

  const doClear = useCallback(() => {
    cancelClear()
    if (isTouch) {
      clearInk()
    } else {
      commitText('', { start: 0, end: 0 }, false)
    }
  }, [cancelClear, clearInk, commitText, isTouch])

  const onRootKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (!isTouch) return
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      const mod = e.ctrlKey || e.metaKey
      if (!mod || e.altKey) return
      const k = e.key.toLowerCase()
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault()
        undoInk()
      } else if (k === 'y' || (k === 'z' && e.shiftKey)) {
        e.preventDefault()
        redoInk()
      }
    },
    [isTouch, redoInk, undoInk],
  )

  /* ——— Производные значения ——— */

  const zoomLabel = `${Math.round(zoom * 100)}%`
  const scrollContentHeight = Math.ceil(INK_CANVAS_H * zoom)
  const canZoomOut = zoom > ZOOM_MIN
  const canZoomIn = zoom < ZOOM_MAX
  const canUndo = isTouch ? curInkHist.states.length > 1 : curTextHist.past.length > 0
  const canRedo = isTouch ? curInkHist.future.length > 0 : curTextHist.future.length > 0
  const stats = countTextStats(text)
  const paletteId = `${uid}-palette`
  const menuId = `${uid}-templates`
  const preventFocusSteal = (e: { preventDefault: () => void }) => e.preventDefault()

  let statusText: string
  let statusCls = styles.status
  let statusIcon: 'saved' | 'pending' | 'empty' | 'notice' | 'warn' = 'empty'
  if (notice) {
    statusText = notice.text
    statusCls = `${styles.status} ${notice.tone === 'warn' ? styles.statusWarn : styles.statusNotice}`
    statusIcon = notice.tone === 'warn' ? 'warn' : 'notice'
  } else if (isTouch) {
    if (!hasInk) statusText = t('learn.studio.work.draftEmpty')
    else if (inkSavedAt) {
      statusText = t('learn.studio.work.savedAt', { time: formatClock(inkSavedAt) })
      statusCls = `${styles.status} ${styles.statusSaved}`
      statusIcon = 'saved'
    } else {
      statusText = t('learn.studio.work.savedLocal')
      statusCls = `${styles.status} ${styles.statusSaved}`
      statusIcon = 'saved'
    }
  } else if (saveState === 'pending') {
    statusText = t('learn.studio.work.saving')
    statusIcon = 'pending'
  } else if (text.length === 0) {
    statusText = t('learn.studio.work.draftEmpty')
  } else if (savedAt) {
    statusText = t('learn.studio.work.savedAt', { time: formatClock(savedAt) })
    statusCls = `${styles.status} ${styles.statusSaved}`
    statusIcon = 'saved'
  } else {
    statusText = t('learn.studio.work.savedLocal')
    statusCls = `${styles.status} ${styles.statusSaved}`
    statusIcon = 'saved'
  }

  const segItem = (on: boolean) => (on ? `${kit.segmentedItem} ${kit.segmentedItemActive}` : kit.segmentedItem)
  const segItemSoft = (on: boolean) => (on ? `${kit.segmentedItem} ${kit.segmentedItemOn}` : kit.segmentedItem)

  return (
    <div
      ref={rootRef}
      className={`${styles.root} ${presentationMode ? styles.rootPresent : ''}`}
      data-mode={mode}
      data-paper={prefs.paper}
      data-eraser={isTouch && eraser ? '1' : undefined}
      data-work-pad="1"
      onKeyDown={onRootKeyDown}
    >
      {/* Ряд 1: способ ввода · масштаб · история · статус */}
      <div className={styles.bar} role="toolbar" aria-label={t('learn.board.toolbar')}>
        <div className={styles.barScroll}>
          <div className={kit.segmented} role="group" aria-label={t('learn.board.inputMode')}>
            <button
              type="button"
              className={segItem(isTouch)}
              onClick={() => setMode('touch')}
              data-work-mode="touch"
              aria-pressed={isTouch}
              title={t('learn.board.touchHint')}
            >
              <IconHand width={15} height={15} />
              <span className={styles.barLabel}>{t('learn.board.modeTouch')}</span>
            </button>
            <button
              type="button"
              className={segItem(!isTouch)}
              onClick={() => setMode('keyboard')}
              data-work-mode="keyboard"
              aria-pressed={!isTouch}
              title={t('learn.board.keyboardHint')}
            >
              <IconKeyboard width={15} height={15} />
              <span className={styles.barLabel}>{t('learn.board.modeKeyboard')}</span>
            </button>
          </div>

          <div className={styles.zoomGroup} role="group" aria-label={t('learn.board.zoom')}>
            <button
              type="button"
              className={`${kit.iconBtn} ${styles.zoomBtn}`}
              onClick={() => setZoom((z) => clampZoom(z - ZOOM_STEP))}
              data-work-zoom="out"
              disabled={!canZoomOut}
              aria-label={t('learn.board.zoomOut')}
              title={t('learn.board.zoomOut')}
            >
              <IconMinus width={16} height={16} />
            </button>
            <button
              type="button"
              className={`${styles.zoomValue} ${zoom !== 1 ? styles.zoomValueHot : ''}`}
              onClick={() => setZoom(1)}
              data-work-zoom="reset"
              aria-label={`${t('learn.board.zoomReset')} (${zoomLabel})`}
              title={t('learn.board.zoomReset')}
            >
              <span aria-live="polite">{zoomLabel}</span>
            </button>
            <button
              type="button"
              className={`${kit.iconBtn} ${styles.zoomBtn}`}
              onClick={() => setZoom((z) => clampZoom(z + ZOOM_STEP))}
              data-work-zoom="in"
              disabled={!canZoomIn}
              aria-label={t('learn.board.zoomIn')}
              title={t('learn.board.zoomIn')}
            >
              <IconPlus width={16} height={16} />
            </button>
          </div>

          <button
            type="button"
            className={kit.iconBtn}
            onPointerDown={preventFocusSteal}
            onClick={isTouch ? undoInk : undoText}
            disabled={!canUndo}
            aria-label={t('learn.studio.work.undo')}
            title={`${t('learn.studio.work.undo')} · Ctrl+Z`}
            data-work-undo="1"
          >
            <IconUndo width={17} height={17} />
          </button>
          <button
            type="button"
            className={kit.iconBtn}
            onPointerDown={preventFocusSteal}
            onClick={isTouch ? redoInk : redoText}
            disabled={!canRedo}
            aria-label={t('learn.studio.work.redo')}
            title={`${t('learn.studio.work.redo')} · Ctrl+Y`}
            data-work-redo="1"
          >
            <IconRedo width={17} height={17} />
          </button>

          <span className={styles.spacer} aria-hidden="true" />

          <span className={statusCls} role="status" aria-live="polite" data-work-status={statusIcon}>
            {statusIcon === 'pending' ? (
              <span className={styles.statusDot} aria-hidden="true" />
            ) : statusIcon === 'saved' ? (
              <LearnShellIcon name="check" size={13} strokeWidth={2.6} />
            ) : statusIcon === 'warn' ? (
              <LearnShellIcon name="close" size={13} strokeWidth={2.6} />
            ) : statusIcon === 'notice' ? (
              <IconSparkle width={13} height={13} />
            ) : (
              <LearnShellIcon name="save" size={13} />
            )}
            <span className={styles.barLabel}>{statusText}</span>
          </span>
        </div>
      </div>

      {/* Ряд 2: инструменты режима · фон листа · копировать / скачать / очистить */}
      <div
        ref={barRef}
        className={styles.bar}
        role="toolbar"
        aria-label={isTouch ? t('learn.studio.work.inkTools') : t('learn.studio.work.textTools')}
      >
        <div className={styles.barScroll}>
          {isTouch ? (
            <>
              <div className={styles.swatches} role="group" aria-label={t('learn.studio.work.penColor')}>
                {PEN_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={styles.swatch}
                    style={{ ['--swatch' as string]: `var(${c.cssVar}, ${c.fallback})` }}
                    aria-pressed={!eraser && prefs.pen === c.id}
                    aria-label={t(c.labelKey)}
                    title={t(c.labelKey)}
                    onClick={() => {
                      setEraser(false)
                      updatePrefs({ pen: c.id })
                    }}
                  />
                ))}
              </div>
              <div className={kit.segmented} role="group" aria-label={t('learn.studio.work.width')}>
                {PEN_WIDTHS.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    className={`${segItemSoft(!eraser && prefs.width === w.id)} ${styles.widthItem}`}
                    aria-pressed={!eraser && prefs.width === w.id}
                    aria-label={t(w.labelKey)}
                    title={t(w.labelKey)}
                    onClick={() => {
                      setEraser(false)
                      updatePrefs({ width: w.id })
                    }}
                  >
                    <span className={styles.widthDot} style={{ ['--dot' as string]: `${Math.round(w.px * 2.2)}px` }} />
                  </button>
                ))}
              </div>
              <button
                type="button"
                className={`${kit.btnGhost} ${styles.toolBtn}`}
                aria-pressed={eraser}
                onClick={() => setEraser((v) => !v)}
                title={t('learn.studio.work.eraser')}
              >
                <IconEraser width={16} height={16} />
                <span className={styles.barLabel}>{t('learn.studio.work.eraser')}</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={`${kit.btnGhost} ${styles.toolBtn}`}
                aria-pressed={prefs.palette}
                aria-controls={paletteId}
                aria-expanded={prefs.palette}
                onPointerDown={preventFocusSteal}
                onClick={() => updatePrefs({ palette: !prefs.palette })}
                title={t('learn.studio.work.symbolsHint')}
                data-work-symbols="1"
              >
                <span className={styles.toolGlyph} aria-hidden="true">
                  H₂O
                </span>
                <span className={styles.barLabel}>{t('learn.studio.work.symbols')}</span>
              </button>
              <button
                type="button"
                className={`${kit.btnGhost} ${styles.toolBtn}`}
                onPointerDown={preventFocusSteal}
                onClick={formatNow}
                disabled={text.length === 0}
                title={t('learn.studio.work.formatHint')}
                data-work-format="1"
              >
                <IconSparkle width={16} height={16} />
                <span className={styles.barLabel}>{t('learn.studio.work.format')}</span>
              </button>
              <button
                ref={templatesBtnRef}
                type="button"
                className={`${kit.btnGhost} ${styles.toolBtn}`}
                aria-haspopup="menu"
                aria-expanded={templatesOpen}
                aria-controls={templatesOpen ? menuId : undefined}
                onClick={() => (templatesOpen ? setTemplatesOpen(false) : openTemplates())}
                title={t('learn.studio.work.templatesHint')}
                data-work-templates="1"
              >
                <LearnShellIcon name="list" size={16} strokeWidth={2.2} />
                <span className={styles.barLabel}>{t('learn.studio.work.templates')}</span>
              </button>
            </>
          )}

          <span className={styles.divider} aria-hidden="true" />

          <div className={kit.segmented} role="group" aria-label={t('learn.studio.work.paper')}>
            {PAPERS.map((p) => (
              <button
                key={p}
                type="button"
                className={`${segItemSoft(prefs.paper === p)} ${styles.paperItem}`}
                aria-pressed={prefs.paper === p}
                aria-label={t(PAPER_LABEL[p])}
                title={`${t('learn.studio.work.paper')}: ${t(PAPER_LABEL[p])}`}
                onClick={() => updatePrefs({ paper: p })}
              >
                <IconPaper kind={p} width={16} height={16} />
              </button>
            ))}
          </div>

          <span className={styles.spacer} aria-hidden="true" />

          <button
            type="button"
            className={kit.iconBtn}
            onClick={() => void copyNow()}
            disabled={isEmpty}
            aria-label={t('learn.studio.work.copy')}
            title={t('learn.studio.work.copy')}
            data-work-copy="1"
          >
            <IconCopy width={16} height={16} />
          </button>
          <button
            type="button"
            className={kit.iconBtn}
            onClick={() => void exportNow()}
            disabled={isEmpty}
            aria-label={isTouch ? t('learn.studio.work.exportPng') : t('learn.studio.work.exportTxt')}
            title={isTouch ? t('learn.studio.work.exportPng') : t('learn.studio.work.exportTxt')}
            data-work-export="1"
          >
            <IconDownload width={16} height={16} />
          </button>
          {confirmClear ? (
            <span className={styles.confirm} role="group" aria-label={t('learn.studio.work.clearAsk')}>
              <span>{t('learn.studio.work.clearAsk')}</span>
              <button
                type="button"
                className={`${kit.btnDanger} ${styles.confirmBtn}`}
                onClick={doClear}
                data-work-clear-yes="1"
              >
                {t('learn.studio.work.clearYes')}
              </button>
              <button type="button" className={`${kit.btnGhost} ${styles.confirmBtn}`} onClick={cancelClear} autoFocus>
                {t('learn.studio.work.clearNo')}
              </button>
            </span>
          ) : (
            <button
              type="button"
              className={`${kit.iconBtn} ${kit.iconBtnDanger}`}
              onClick={askClear}
              disabled={isEmpty}
              aria-label={isTouch ? t('learn.board.clearInk') : t('learn.studio.work.clear')}
              title={isTouch ? t('learn.board.clearInk') : t('learn.studio.work.clear')}
              data-work-clear="1"
            >
              <IconTrash width={16} height={16} />
            </button>
          )}
        </div>

        {!isTouch && templatesOpen ? (
          <div
            id={menuId}
            className={styles.menu}
            role="menu"
            aria-label={t('learn.studio.work.templates')}
            style={{ ['--menu-left' as string]: `${menuLeft}px` }}
            data-work-templates-menu="1"
          >
            <span className={styles.menuTitle}>{t('learn.studio.work.templates')}</span>
            {TEMPLATES.map((tpl, i) => (
              <button
                key={tpl.id}
                type="button"
                role="menuitem"
                className={styles.menuItem}
                onPointerDown={preventFocusSteal}
                onClick={() => insertTemplate(tpl.bodyKey)}
                autoFocus={i === 0}
                data-work-template={tpl.id}
              >
                <span className={styles.menuKey} aria-hidden="true">
                  {tpl.glyph}
                </span>
                <span>{t(tpl.labelKey)}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Палитра химических символов (только клавиатура) */}
      {!isTouch && prefs.palette ? (
        <div id={paletteId} className={styles.palette} role="toolbar" aria-label={t('learn.studio.work.symbols')} data-work-palette="1">
          {PALETTE.map((group) => (
            <div key={group.id} className={styles.palGroup} role="group" aria-label={t(group.labelKey)}>
              <span className={styles.palLabel}>{t(group.labelKey)}</span>
              <div className={styles.palKeys}>
                {group.items.map((symbol) => (
                  <button
                    key={symbol}
                    type="button"
                    className={styles.palKey}
                    onPointerDown={preventFocusSteal}
                    onClick={() => insertSymbol(symbol)}
                    aria-label={t('learn.studio.work.insert', { symbol })}
                    data-work-symbol={symbol}
                  >
                    {symbol}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Лист */}
      <div
        ref={viewportRef}
        className={styles.scrollViewport}
        role="region"
        aria-label={t('learn.board.scrollArea')}
        style={{ ['--bp-zoom' as string]: zoom }}
      >
        {isTouch ? (
          <div className={styles.scrollContent} style={{ height: scrollContentHeight }}>
            <div
              className={styles.zoomShell}
              style={{
                transform: `scale(${zoom})`,
                height: INK_CANVAS_H,
              }}
            >
              <canvas ref={canvasRef} className={styles.inkCanvas} aria-label={t('learn.board.inkAria')} />
            </div>
            {!hasInk ? (
              <div className={styles.emptyHint} aria-hidden>
                <span className={styles.emptyHintIcon}>
                  <IconHand />
                </span>
                <span>{t('learn.board.inkAria')}</span>
              </div>
            ) : null}
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            value={text}
            onChange={(e) => commitText(e.target.value, null, true)}
            onKeyDown={onTextareaKeyDown}
            placeholder={t('learn.workspace.scratchpad')}
            aria-label={t('learn.workspace.scratchpad')}
            spellCheck
            rows={presentationMode ? 14 : 10}
            data-work-text="1"
          />
        )}
      </div>

      <div className={styles.footer}>
        <p className={styles.hint}>
          <IconInfo className={styles.hintIcon} />
          <span>{isTouch ? t('learn.board.touchHint') : t('learn.board.keyboardHint')}</span>
        </p>
        <span className={styles.meta}>
          {!isTouch && text.length > 0 ? (
            <span data-work-stats="1">{t('learn.studio.work.stats', { chars: stats.chars, lines: stats.lines })}</span>
          ) : null}
          <span className={styles.kbdHint} title={t('learn.studio.work.shortcuts')} aria-hidden="true">
            <Kbd>Ctrl</Kbd>
            <Kbd>Z</Kbd>
          </span>
        </span>
      </div>
    </div>
  )
}
