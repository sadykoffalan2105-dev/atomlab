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
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const dprRef = useRef(1)
  const drawingRef = useRef(false)
  const lastPtRef = useRef<{ x: number; y: number } | null>(null)
  const saveInkTimerRef = useRef(0)
  const activePointerRef = useRef<number | null>(null)
  const canvasReadyRef = useRef(false)

  const canvasLogicalSize = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return { w: 0, h: 0 }
    return {
      w: canvas.width / dprRef.current,
      h: canvas.height / dprRef.current,
    }
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
      const shell = canvas.parentElement
      if (!shell) return

      let inkRestore = readWorkspaceInk(sectionPathId)
      if (restoreInk && canvasReadyRef.current) {
        try {
          inkRestore = canvas.toDataURL('image/png') || inkRestore
        } catch {
          /* ignore */
        }
      }
      const w = Math.max(280, shell.clientWidth || shell.getBoundingClientRect().width)
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      dprRef.current = dpr

      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(INK_CANVAS_H * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${INK_CANVAS_H}px`

      const ctx = canvas.getContext('2d')
      if (!ctx) return
      prepareContext(ctx)

      if (restoreInk) {
        paintInkFromStorage(inkRestore)
      }
      canvasReadyRef.current = true
    },
    [paintInkFromStorage, prepareContext, sectionPathId],
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
    const onResize = () => resizeCanvas(true)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
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

  const canvasPoint = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return null
    const scaleX = canvasLogicalSize().w / rect.width
    const scaleY = canvasLogicalSize().h / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }, [canvasLogicalSize])

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (mode !== 'touch') return
      if (e.pointerType === 'mouse' && e.buttons !== 1) return

      e.preventDefault()
      e.stopPropagation()

      const canvas = canvasRef.current
      if (!canvas) return

      try {
        canvas.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }

      activePointerRef.current = e.pointerId
      drawingRef.current = true

      const pt = canvasPoint(e)
      if (!pt) return
      lastPtRef.current = pt

      const ctx = canvas.getContext('2d')
      if (!ctx) return
      prepareContext(ctx)
      ctx.beginPath()
      ctx.moveTo(pt.x, pt.y)
      ctx.lineTo(pt.x + 0.01, pt.y + 0.01)
      ctx.stroke()
    },
    [canvasPoint, mode, prepareContext],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current || mode !== 'touch') return
      if (activePointerRef.current !== e.pointerId) return

      e.preventDefault()

      const pt = canvasPoint(e)
      const ctx = canvasRef.current?.getContext('2d')
      if (!pt || !ctx) return

      prepareContext(ctx)
      const last = lastPtRef.current
      if (last) {
        ctx.beginPath()
        ctx.moveTo(last.x, last.y)
        ctx.lineTo(pt.x, pt.y)
        ctx.stroke()
      }
      lastPtRef.current = pt
    },
    [canvasPoint, mode, prepareContext],
  )

  const endStroke = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (activePointerRef.current !== e.pointerId) return
      if (!drawingRef.current) return

      e.preventDefault()
      drawingRef.current = false
      activePointerRef.current = null
      lastPtRef.current = null

      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }

      scheduleInkSave()
    },
    [scheduleInkSave],
  )

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

      <div className={styles.scrollViewport} aria-label={t('learn.board.scrollArea')}>
        <div
          className={styles.zoomShell}
          style={{
            transform: `scale(${zoom})`,
            width: `${100 / zoom}%`,
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
            />
          ) : (
            <canvas
              ref={canvasRef}
              className={styles.inkCanvas}
              aria-label={t('learn.board.inkAria')}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endStroke}
              onPointerCancel={endStroke}
            />
          )}
        </div>
      </div>
      <p className={styles.hint}>{mode === 'touch' ? t('learn.board.touchHint') : t('learn.board.keyboardHint')}</p>
    </div>
  )
}
