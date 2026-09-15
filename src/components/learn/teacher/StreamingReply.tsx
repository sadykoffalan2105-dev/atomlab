/**
 * Ответ учителя с «печатью» текста и мигающей кареткой.
 *
 * Сейчас движки отдают ответ целиком, поэтому поток имитируется плавным
 * раскрытием по словам (≤ 2.4 с). Когда шлюз начнёт стримить токены, достаточно
 * передавать растущий `text` со `streaming` — компонент догоняет его сам.
 * При prefers-reduced-motion текст показывается сразу.
 */
import { useEffect, useRef, useState } from 'react'
import { LearnAssistantMarkdown } from '../LearnAssistantMarkdown'
import styles from './StreamingReply.module.css'

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Ближайшая граница слова не раньше `index`. */
function snapToWord(text: string, index: number): number {
  if (index >= text.length) return text.length
  const next = text.slice(index).search(/\s/)
  return next < 0 ? text.length : index + next
}

export function StreamingReply({
  text,
  streaming,
  stopToken = 0,
  onDone,
  className,
}: {
  text: string
  /** Раскрывать постепенно (новое сообщение). */
  streaming: boolean
  /** Смена значения во время печати = «Остановить»: фиксируем показанную часть. */
  stopToken?: number
  /** Печать закончилась или остановлена; `shownChars` — сколько символов показано. */
  onDone?: (shownChars: number) => void
  className?: string
}) {
  const animate = streaming && !reducedMotion()
  const [shown, setShown] = useState(() => (animate ? 0 : text.length))
  const shownRef = useRef(shown)
  const onDoneRef = useRef(onDone)
  const doneRef = useRef(!animate)
  const stopRef = useRef(stopToken)

  useEffect(() => {
    onDoneRef.current = onDone
  })

  useEffect(() => {
    if (!animate) {
      if (!doneRef.current) {
        doneRef.current = true
        onDoneRef.current?.(text.length)
      }
      return
    }
    doneRef.current = false
    const total = text.length
    const durationMs = Math.min(2400, Math.max(380, total * 9))
    const startShown = shownRef.current
    const start = performance.now()
    let raf = 0
    let lastPaint = 0
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs)
      const eased = 1 - (1 - progress) ** 1.6
      const target = progress >= 1 ? total : snapToWord(text, Math.floor(startShown + (total - startShown) * eased))
      if (target !== shownRef.current && (now - lastPaint > 45 || target >= total)) {
        lastPaint = now
        shownRef.current = target
        setShown(target)
      }
      if (target >= total) {
        doneRef.current = true
        onDoneRef.current?.(total)
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [animate, text])

  // «Остановить»: замораживаем то, что уже напечатано.
  useEffect(() => {
    if (stopToken === stopRef.current) return
    stopRef.current = stopToken
    if (doneRef.current) return
    doneRef.current = true
    onDoneRef.current?.(shownRef.current)
  }, [stopToken])

  const visible = animate ? text.slice(0, shown) : text
  const typing = animate && shown < text.length
  return (
    <LearnAssistantMarkdown
      text={visible}
      className={`${className ?? ''} ${typing ? styles.typing : ''}`.trim()}
    />
  )
}
