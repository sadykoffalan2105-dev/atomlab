import type { CyberGameDef } from '../../../../../learn/learnCyberGames'
import { CyberGamePlayer } from './CyberGamePlayer'
import styles from './CyberGameOverlay.module.css'

export function CyberGameOverlay({
  game,
  accent,
  onClose,
}: {
  game: CyberGameDef
  accent: string
  onClose: () => void
}) {
  return (
    <div className={styles.overlay} style={{ ['--game-accent' as string]: accent }}>
      <CyberGamePlayer game={game} accent={accent} onClose={onClose} />
    </div>
  )
}
