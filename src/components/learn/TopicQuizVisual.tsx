import { useState } from 'react'
import { getQuizVisualSpec, hasQuizVisualAsset } from '../../learn/quizVisualManifest'
import styles from './TopicQuizVisual.module.css'

type Props = {
  visualId: string
  compact?: boolean
  /** Полноэкранный режим — крупнее и без обрезки */
  fullscreen?: boolean
}

export function TopicQuizVisual({ visualId, compact = false, fullscreen = false }: Props) {
  const spec = getQuizVisualSpec(visualId)
  const [failed, setFailed] = useState(false)

  if (!spec || !hasQuizVisualAsset(visualId)) return null

  return (
    <figure
      className={`${styles.topicQuizVisual} ${compact ? styles.compact : ''} ${fullscreen ? styles.fullscreenPhoto : ''}`}
    >
      {!failed ? (
        <img
          className={styles.photo}
          src={spec.src}
          alt={spec.alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className={styles.photoFallback} role="img" aria-label={spec.alt}>
          {spec.alt}
        </div>
      )}
      <figcaption className={styles.caption}>{spec.caption}</figcaption>
    </figure>
  )
}

export function hasTopicQuizVisual(visualId?: string): boolean {
  return hasQuizVisualAsset(visualId)
}
