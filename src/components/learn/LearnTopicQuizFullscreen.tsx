import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '../../i18n/useT'
import styles from './LearnTopicQuizFullscreen.module.css'

export function LearnTopicQuizFullscreen({
  title,
  meta,
  drawLabel,
  onDraw,
  onClose,
  children,
}: {
  title: string
  meta: string
  drawLabel: string
  onDraw: () => void
  onClose: () => void
  children: ReactNode
}) {
  const { t } = useT()

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return createPortal(
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="learn-topic-quiz-fs-title"
    >
      <header className={styles.toolbar}>
        <div className={styles.titleBlock}>
          <h2 id="learn-topic-quiz-fs-title" className={styles.title}>
            {title}
          </h2>
          <p className={styles.meta}>{meta}</p>
        </div>
        <div className={styles.toolbarActions}>
          <button type="button" className={styles.btnPrimary} onClick={onDraw}>
            {drawLabel}
          </button>
          <button type="button" className={styles.btn} onClick={onClose}>
            {t('learn.topicQuiz.fullscreenClose')}
          </button>
        </div>
      </header>
      <main className={styles.main}>
        <div className={styles.inner}>{children}</div>
      </main>
    </div>,
    document.body,
  )
}
