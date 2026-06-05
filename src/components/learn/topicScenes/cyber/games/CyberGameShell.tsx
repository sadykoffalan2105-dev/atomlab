import type { ReactNode } from 'react'
import { useT } from '../../../../../i18n/useT'
import styles from './CyberGameShell.module.css'

export function CyberGameShell({
  title,
  intro,
  score,
  total,
  feedback,
  accent,
  onClose,
  onReset,
  children,
}: {
  title: string
  intro: string
  score: number
  total: number
  feedback?: string | null
  accent: string
  onClose: () => void
  onReset: () => void
  children: ReactNode
}) {
  const { t } = useT()

  return (
    <div
      className={styles.shell}
      role="dialog"
      aria-labelledby="cyber-game-title"
      style={{ ['--game-accent' as string]: accent }}
    >
      <header className={styles.head}>
        <div>
          <h3 id="cyber-game-title" className={styles.title}>
            {title}
          </h3>
          <p className={styles.intro}>{intro}</p>
        </div>
        <div className={styles.score}>
          {t('learn.g7.c1.s01.game.score', { score, total })}
        </div>
      </header>
      {feedback ? (
        <p className={styles.feedback} role="status">
          {feedback}
        </p>
      ) : null}
      <div className={styles.body}>{children}</div>
      <footer className={styles.foot}>
        <button type="button" className={styles.btn} onClick={onReset}>
          {t('learn.g7.c1.s01.cyber.explore.reset')}
        </button>
        <button type="button" className={styles.btnPrimary} onClick={onClose}>
          {t('learn.g7.c1.s01.cyber.explore.back')}
        </button>
      </footer>
    </div>
  )
}
