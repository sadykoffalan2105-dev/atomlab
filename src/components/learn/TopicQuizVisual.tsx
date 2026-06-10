import { useState } from 'react'
import { getQuizVisualSpec, hasQuizVisualAsset } from '../../learn/quizVisualManifest'
import { publicAssetUrl } from '../../utils/publicAssetUrl'
import styles from './TopicQuizVisual.module.css'

type Props = {
  visualId: string
  compact?: boolean
  /** Полноэкранный режим — крупнее и без обрезки */
  fullscreen?: boolean
  /** Правая панель split-режима (электронная доска) */
  split?: boolean
}

export function TopicQuizVisual({ visualId, compact = false, fullscreen = false, split = false }: Props) {
  const spec = getQuizVisualSpec(visualId)
  const [failed, setFailed] = useState(false)

  if (!spec || !hasQuizVisualAsset(visualId)) return null

  const src = publicAssetUrl(spec.src)

  return (
    <figure
      className={`${styles.topicQuizVisual} ${compact ? styles.compact : ''} ${fullscreen ? styles.fullscreenPhoto : ''} ${split ? styles.splitPhoto : ''}`}
    >
      {!failed ? (
        <img
          className={styles.photo}
          src={src}
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
