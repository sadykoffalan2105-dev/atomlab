import { useState } from 'react'
import type { BalancePhotoSpec } from '../../learn/balanceLessonVisuals'
import { useT, type MessageKey } from '../../i18n/useT'
import { publicAssetUrl } from '../../utils/publicAssetUrl'
import styles from './ValencyBalanceTutor.module.css'

type Props = {
  spec: BalancePhotoSpec
  variant?: 'hero' | 'step'
}

export function BalanceLessonPhoto({ spec, variant = 'step' }: Props) {
  const { t } = useT()
  const [failed, setFailed] = useState(false)
  const src = publicAssetUrl(spec.src)

  return (
    <figure className={variant === 'hero' ? styles.photoHero : styles.photoStep}>
      {!failed ? (
        <img
          className={styles.photoImg}
          src={src}
          alt={t(spec.altKey as MessageKey)}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className={styles.photoFallback} role="img" aria-label={t(spec.altKey as MessageKey)}>
          {t(spec.altKey as MessageKey)}
        </div>
      )}
      <figcaption className={styles.photoCaption}>{t(spec.captionKey as MessageKey)}</figcaption>
    </figure>
  )
}
