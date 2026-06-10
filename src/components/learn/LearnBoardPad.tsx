import { useCallback, useEffect, useRef, useState } from 'react'
import { useT } from '../../i18n/useT'
import { readWorkspaceInk, writeWorkspaceInk } from '../../learn/learnProgressStorage'
import styles from './LearnBoardPad.module.css'

export type BoardInputMode = 'touch' | 'keyboard'

const ZOOM_MIN = 0.65
const ZOOM_MAX = 2.25
const ZOOM_STEP = 0.15
const INK_CANVAS_H = 960
const INK_LINE = 2.8

type Props = {
  sectionPathId: string
  text: string
  onTextChange: (value: string) => void
  presentationMode?: boolean
}

function clampZoom(z: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100))
}

function defaultInputMode(): BoardInputMode {
  if (typeof window === 'undefined') return 'keyboard'
  return window.matchMedia('(pointer: coarse)').matches ? 'touch' : 'keyboard'
}

export function LearnBoardPad({ sectionPathId, text, onTextChange, presentationMode = false }: Props) {
  const { t } = useT()
  const [mode, setMode] = useState<BoardInputMode>(defaultInputMode)
  const [zoom, setZoom] = useState(() => (presentationMode ? 1.15 : 1))
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawingRef = useRef(false)
  const lastPtRef = useRef<{ x: number; y: number } | null>(null)
  const saveInkTimerRef = useRef(0)

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement
    if (!parent) return
    const w = Math.max(280, parent.clientWidth)
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.floor(w * dpr)
    canvas.height = Math.floor(INK_CANVAS_H * dpr)
    canvas.style.width = `${w}px`
    canvas.style.height = `${INK_CANVAS_H}px`
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = 'rgba(230, 240, 255, 0.95)'
    ctx.lineWidth = INK_LINE
  }, [])

  const paintInkFromStorage = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const data = readWorkspaceInk(sectionPathId)
    if (!data) return
    const img = new Image()
    img.onload = () => {
      const w = canvas.width / (window.devicePixelRatio || 1)
      const h = canvas.height / (window.devicePixelRatio || 1)
      ctx.clearRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0, w, h)
    }
    img.src = data
  }, [sectionPathId])

  useEffect(() => {
    resizeCanvas()
    paintInkFromStorage()
  }, [resizeCanvas, paintInkFromStorage, sectionPathId])

  useEffect(() => {
    const onResize = () => resizeCanvas()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [resizeCanvas])

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
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }, [])

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (mode !== 'touch') return
      e.currentTarget.setPointerCapture(e.pointerId)
      drawingRef.current = true
      const pt = canvasPoint(e)
      if (!pt) return
      lastPtRef.current = pt
      const ctx = canvasRef.current?.getContext('2d')
      if (!ctx) return
      ctx.beginPath()
      ctx.moveTo(pt.x, pt.y)
    },
    [canvasPoint, mode],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current || mode !== 'touch') return
      const pt = canvasPoint(e)
      const last = lastPtRef.current
      const ctx = canvasRef.current?.getContext('2d')
      if (!pt || !last || !ctx) return
      ctx.lineWidth = INK_LINE
      ctx.lineTo(pt.x, pt.y)
      ctx.stroke()
      lastPtRef.current = pt
    },
    [canvasPoint, mode, zoom],
  )

  const endStroke = useCallback(() => {
    if (!drawingRef.current) return
    drawingRef.current = false
    lastPtRef.current = null
    scheduleInkSave()
  }, [scheduleInkSave])

  const clearInk = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const w = canvas.width / (window.devicePixelRatio || 1)
    const h = canvas.height / (window.devicePixelRatio || 1)
    ctx.clearRect(0, 0, w, h)
    writeWorkspaceInk(sectionPathId, '')
  }, [sectionPathId])

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
              onPointerLeave={endStroke}
            />
          )}
        </div>
      </div>
      <p className={styles.hint}>{mode === 'touch' ? t('learn.board.touchHint') : t('learn.board.keyboardHint')}</p>
    </div>
  )
}
