import { useState } from 'react'
import { useT } from '../../i18n/useT'
import { getG7SectionQuizEnrichment } from '../../learn/g7SectionQuizEnrichments'
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
  /** Показать локализованный заголовок над фото (не на картинке) */
  titleAbove?: boolean
}

function localizedCaption(visualId: string, locale: string): string | null {
  const e = getG7SectionQuizEnrichment(visualId)
  if (e) {
    if (locale === 'en') return e.captionEn?.trim() || e.caption
    if (locale === 'uz') return e.captionUz?.trim() || e.captionEn?.trim() || e.caption
    return e.caption
  }
  const spec = getQuizVisualSpec(visualId)
  return spec?.caption ?? null
}

export function TopicQuizVisual({
  visualId,
  compact = false,
  fullscreen = false,
  split = false,
  titleAbove = true,
}: Props) {
  const { locale } = useT()
  const spec = getQuizVisualSpec(visualId)
  const [failed, setFailed] = useState(false)

  if (!spec || !hasQuizVisualAsset(visualId)) return null

  const src = publicAssetUrl(spec.src)
  const title = titleAbove ? localizedCaption(visualId, locale) : null

  return (
    <figure
      className={`${styles.topicQuizVisual} ${compact ? styles.compact : ''} ${fullscreen ? styles.fullscreenPhoto : ''} ${split ? styles.splitPhoto : ''}`}
    >
      {title ? <p className={styles.titleAbove}>{title}</p> : null}
      {!failed ? (
        <img
          className={styles.photo}
          src={src}
          alt={title || spec.alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className={styles.photoFallback} role="img" aria-label={title || spec.alt}>
          {title || spec.alt}
        </div>
      )}
    </figure>
  )
}

export function hasTopicQuizVisual(visualId?: string): boolean {
  return hasQuizVisualAsset(visualId)
}
