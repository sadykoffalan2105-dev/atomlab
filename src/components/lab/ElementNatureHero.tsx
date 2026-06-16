import { useEffect, useState } from 'react'
import type { ElementRealLifeCard } from '../../data/elementRealLife'
import { getElementWikiPhotoUrl } from '../../data/elementWikiPhotos'
import { useT } from '../../i18n/useT'
import styles from './ElementNatureHero.module.css'

/** Компактная полоска: реальное фото (Wikimedia) + краткое описание. */
export function ElementNatureHero({
  symbol,
  displayName,
  life,
  caption,
  appearance,
}: {
  symbol: string
  displayName: string
  life: ElementRealLifeCard
  caption: string
  appearance: string | null
}) {
  const { t } = useT()
  const wikiUrl = getElementWikiPhotoUrl(symbol)
  const [src, setSrc] = useState(wikiUrl ?? life.image)

  useEffect(() => {
    setSrc(wikiUrl ?? life.image)
  }, [symbol, wikiUrl, life.image])

  return (
    <section className={styles.strip} aria-label={t('elementDetail.natureSection')}>
      <div className={styles.photoWrap}>
        <img
          src={src}
          alt={t('elementDetail.photoAlt', { name: displayName })}
          className={styles.photo}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => {
            if (src !== life.image) setSrc(life.image)
          }}
        />
      </div>
      <div className={styles.textCol}>
        <p className={styles.stripTitle}>{t('elementDetail.natureSection')}</p>
        {caption ? <p className={styles.caption}>{caption}</p> : null}
        {appearance ? <p className={styles.appearance}>{appearance}</p> : null}
      </div>
    </section>
  )
}
