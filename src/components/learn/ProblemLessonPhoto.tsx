import { useState } from 'react'
import type { ProblemPhotoSpec } from '../../learn/chemProblemVisuals'
import { useT, type MessageKey } from '../../i18n/useT'
import { publicAssetUrl } from '../../utils/publicAssetUrl'
import styles from './ChemProblemTutor.module.css'

type Props = {
  spec: ProblemPhotoSpec
  variant?: 'hero' | 'inline'
}

export function ProblemLessonPhoto({ spec, variant = 'inline' }: Props) {
  const { t } = useT()
  const [failed, setFailed] = useState(false)
  const src = publicAssetUrl(spec.src)

  return (
    <figure className={variant === 'hero' ? styles.photoHero : styles.photoInline}>
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
