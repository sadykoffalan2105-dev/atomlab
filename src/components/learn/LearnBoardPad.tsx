import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useT } from '../../i18n/useT'
import { readWorkspaceInk, writeWorkspaceInk } from '../../learn/learnProgressStorage'
import styles from './LearnBoardPad.module.css'

export type BoardInputMode = 'touch' | 'keyboard'

const ZOOM_MIN = 0.65
const ZOOM_MAX = 2.25
const ZOOM_STEP = 0.15
const INK_CANVAS_H = 960
const INK_LINE = 3

type Props = {
  sectionPathId: string
  text: string
  onTextChange: (value: string) => void
  presentationMode?: boolean
}

type Point = { x: number; y: number }

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

export function LearnBoardPad({ sectionPathId, text, onTextChange, presentationMode = false }: Props) {
  const { t } = useT()
  const [mode, setMode] = useState<BoardInputMode>(defaultInputMode)
  const [zoom, setZoom] = useState(() => (presentationMode ? 1.15 : 1))
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const dprRef = useRef(1)
  const drawingRef = useRef(false)
  const lastPtRef = useRef<Point | null>(null)
  const saveInkTimerRef = useRef(0)
  const activePointerRef = useRef<number | null>(null)
  const canvasReadyRef = useRef(false)
  const modeRef = useRef(mode)
  modeRef.current = mode

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

  const prepareContext = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.setTransform(dprRef.current, 0, 0, dprRef.current, 0, 0)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = 'rgba(230, 240, 255, 0.95)'
    ctx.lineWidth = INK_LINE
  }, [])

  const paintInkFromStorage = useCallback(
    (dataUrl?: string) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const data = dataUrl ?? readWorkspaceInk(sectionPathId)
      const { w, h } = canvasLogicalSize()
      if (!data) {
        ctx.clearRect(0, 0, w, h)
        prepareContext(ctx)
        return
      }
      const img = new Image()
      img.onload = () => {
        const c = canvasRef.current
        const cctx = c?.getContext('2d')
        if (!c || !cctx) return
        const size = canvasLogicalSize()
        cctx.clearRect(0, 0, size.w, size.h)
        prepareContext(cctx)
        cctx.drawImage(img, 0, 0, size.w, size.h)
      }
      img.src = data
    },
    [canvasLogicalSize, prepareContext, sectionPathId],
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
      prepareContext(ctx)

      if (restoreInk) {
        paintInkFromStorage(inkRestore)
      }
      canvasReadyRef.current = true
    },
    [measureCanvasWidth, paintInkFromStorage, prepareContext, sectionPathId],
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

  const scheduleInkSave = useCallback(() => {
    window.clearTimeout(saveInkTimerRef.current)
    saveInkTimerRef.current = window.setTimeout(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      try {
        writeWorkspaceInk(sectionPathId, canvas.toDataURL('image/png'))
      } catch {
        /* quota */
      }
    }, 350)
  }, [sectionPathId])

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
      prepareContext(ctx)
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
    [prepareContext],
  )

  const beginStroke = useCallback(
    (pt: Point) => {
      drawingRef.current = true
      lastPtRef.current = pt
      plotPoint(pt, true)
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
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { w, h } = canvasLogicalSize()
    ctx.clearRect(0, 0, w, h)
    prepareContext(ctx)
    writeWorkspaceInk(sectionPathId, '')
  }, [canvasLogicalSize, prepareContext, sectionPathId])

  const zoomLabel = `${Math.round(zoom * 100)}%`
  const scrollContentHeight = Math.ceil(INK_CANVAS_H * zoom)

  return (
    <div
      className={`${styles.root} ${presentationMode ? styles.rootPresent : ''}`}
      data-mode={mode}
    >
      <div className={styles.toolbar} role="toolbar" aria-label={t('learn.board.toolbar')}>
        <div className={styles.modeGroup} role="group" aria-label={t('learn.board.inputMode')}>
          <button
            type="button"
            className={mode === 'touch' ? styles.toolOn : styles.tool}
            onClick={() => setMode('touch')}
            aria-pressed={mode === 'touch'}
          >
            {t('learn.board.modeTouch')}
          </button>
          <button
            type="button"
            className={mode === 'keyboard' ? styles.toolOn : styles.tool}
            onClick={() => setMode('keyboard')}
            aria-pressed={mode === 'keyboard'}
          >
            {t('learn.board.modeKeyboard')}
          </button>
        </div>
        <div className={styles.zoomGroup} role="group" aria-label={t('learn.board.zoom')}>
          <button
            type="button"
            className={styles.tool}
            onClick={() => setZoom((z) => clampZoom(z - ZOOM_STEP))}
            aria-label={t('learn.board.zoomOut')}
            title={t('learn.board.zoomOut')}
          >
            −
          </button>
          <span className={styles.zoomLabel} aria-live="polite">
            {zoomLabel}
          </span>
          <button
            type="button"
            className={styles.tool}
            onClick={() => setZoom((z) => clampZoom(z + ZOOM_STEP))}
            aria-label={t('learn.board.zoomIn')}
            title={t('learn.board.zoomIn')}
          >
            +
          </button>
          <button
            type="button"
            className={styles.tool}
            onClick={() => setZoom(1)}
            aria-label={t('learn.board.zoomReset')}
            title={t('learn.board.zoomReset')}
          >
            100%
          </button>
        </div>
        {mode === 'touch' ? (
          <button type="button" className={styles.tool} onClick={clearInk}>
            {t('learn.board.clearInk')}
          </button>
        ) : null}
      </div>

      <div ref={viewportRef} className={styles.scrollViewport} aria-label={t('learn.board.scrollArea')}>
        <div className={styles.scrollContent} style={{ height: scrollContentHeight }}>
          <div
            className={styles.zoomShell}
            style={{
              transform: `scale(${zoom})`,
              height: INK_CANVAS_H,
            }}
          >
            {mode === 'keyboard' ? (
              <textarea
                className={styles.textarea}
                value={text}
                onChange={(e) => onTextChange(e.target.value)}
                placeholder={t('learn.workspace.scratchpad')}
                spellCheck
                rows={presentationMode ? 14 : 10}
                style={{ fontSize: `${0.88 * zoom}rem` }}
              />
            ) : (
              <canvas ref={canvasRef} className={styles.inkCanvas} aria-label={t('learn.board.inkAria')} />
            )}
          </div>
        </div>
      </div>
      <p className={styles.hint}>{mode === 'touch' ? t('learn.board.touchHint') : t('learn.board.keyboardHint')}</p>
    </div>
  )
}
