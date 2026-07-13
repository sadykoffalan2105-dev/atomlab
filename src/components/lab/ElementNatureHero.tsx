import { useEffect, useState } from 'react'
import type { ElementRealLifeCard } from '../../data/elementRealLife'
import { getElementWikiPhotoUrl } from '../../data/elementWikiPhotos'
import { publicAssetUrl } from '../../utils/publicAssetUrl'
import { useT } from '../../i18n/useT'
import styles from './ElementNatureHero.module.css'

/** Компактная полоска: фото образца (локальный webp) + краткое описание. */
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
  const localSrc = publicAssetUrl(life.image)
  const wikiSrc = getElementWikiPhotoUrl(symbol)
  const [src, setSrc] = useState(localSrc)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setSrc(publicAssetUrl(life.image))
    setFailed(false)
  }, [life.image, symbol])

  return (
    <section className={styles.strip} aria-label={t('elementDetail.natureSection')}>
      <div className={styles.photoWrap}>
        {!failed ? (
          <img
            key={src}
            src={src}
            alt={t('elementDetail.photoAlt', { name: displayName })}
            className={styles.photo}
            loading="lazy"
            decoding="async"
            onError={() => {
              if (wikiSrc && src !== wikiSrc) {
                setSrc(wikiSrc)
                return
              }
              setFailed(true)
            }}
          />
        ) : (
          <div className={styles.photoFallback} aria-hidden>
            {symbol}
          </div>
        )}
      </div>
      <div className={styles.textCol}>
        <p className={styles.stripTitle}>{t('elementDetail.natureSection')}</p>
        {caption ? <p className={styles.caption}>{caption}</p> : null}
        {appearance ? <p className={styles.appearance}>{appearance}</p> : null}
      </div>
    </section>
  )
}
