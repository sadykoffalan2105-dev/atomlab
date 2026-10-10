import { useState } from 'react'
import type { ElementRealLifeCard } from '../../data/elementRealLife'
import { getElementNoPhotoReason, getElementPhoto, type ElementPhoto } from '../../data/elementPhotos'
import { publicAssetUrl } from '../../utils/publicAssetUrl'
import { useT } from '../../i18n/useT'
import type { MessageKey } from '../../i18n/messagesRu'
import styles from './ElementNatureHero.module.css'

/**
 * Что показываем в рамке:
 * photo — настоящее фото образца (миниатюра Wikimedia Commons) с подписью автора и лицензии;
 * local — стилизованный локальный рисунок (только запасной вариант: офлайн или ошибка загрузки);
 * symbol — ничего не загрузилось, просто символ элемента.
 */
type Stage = 'photo' | 'local' | 'symbol'

const NO_PHOTO_KEY: Record<ReturnType<typeof getElementNoPhotoReason>, MessageKey> = {
  accelerator: 'elementDetail.noPhotoAccelerator',
  traces: 'elementDetail.noPhotoTraces',
  gas: 'elementDetail.noPhotoGas',
  noFreePhoto: 'elementDetail.noPhotoFree',
}

function initialStage(photo: ElementPhoto | null): Stage {
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false
  return photo && !offline ? 'photo' : 'local'
}

/** Блок «В природе»: настоящее фото образца + подпись источника + краткое описание. */
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
  const photo = getElementPhoto(symbol)
  const localSrc = publicAssetUrl(life.image)
  /* Стадия хранится вместе с символом: при смене элемента начинаем заново без эффекта. */
  const [state, setState] = useState<{ symbol: string; stage: Stage }>(() => ({
    symbol,
    stage: initialStage(photo),
  }))
  const stage = state.symbol === symbol ? state.stage : initialStage(photo)
  const fallTo = (next: Stage) => setState({ symbol, stage: next })
  const alt = t('elementDetail.photoAlt', { name: displayName })

  return (
    <section className={styles.strip} aria-label={t('elementDetail.natureSection')}>
      <figure className={styles.figure}>
        {photo == null ? (
          <div className={`${styles.photoWrap} ${styles.noPhoto}`} role="img" aria-label={displayName}>
            <span className={styles.noPhotoSymbol}>{symbol}</span>
            <span className={styles.noPhotoZ}>{life.z}</span>
          </div>
        ) : (
          <div className={styles.photoWrap}>
            {stage === 'photo' ? (
              <img
                key={photo.thumb}
                src={photo.thumb}
                srcSet={photo.thumb2x ? `${photo.thumb} 500w, ${photo.thumb2x} 960w` : undefined}
                sizes={photo.thumb2x ? '(max-width: 640px) 92vw, 230px' : undefined}
                alt={alt}
                className={styles.photo}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                onError={() => fallTo('local')}
              />
            ) : stage === 'local' ? (
              <img
                key={localSrc}
                src={localSrc}
                alt={alt}
                className={styles.photo}
                loading="lazy"
                decoding="async"
                onError={() => fallTo('symbol')}
              />
            ) : (
              <div className={styles.photoFallback} aria-hidden>
                {symbol}
              </div>
            )}
          </div>
        )}

        <figcaption className={styles.credit}>
          {photo == null ? (
            <span className={styles.noPhotoNote}>
              {t(NO_PHOTO_KEY[getElementNoPhotoReason(symbol, life.z)])}
            </span>
          ) : stage === 'photo' ? (
            <>
              {t('elementDetail.photoBy')}: {photo.author},{' '}
              {photo.licenseUrl ? (
                <a
                  href={photo.licenseUrl}
                  target="_blank"
                  rel="noopener noreferrer license"
                  title={t('elementDetail.photoLicenseTitle')}
                >
                  {photo.license}
                </a>
              ) : (
                photo.license
              )}
              ,{' '}
              <a
                href={photo.page}
                target="_blank"
                rel="noopener noreferrer"
                title={t('elementDetail.photoSourceTitle')}
              >
                Wikimedia Commons
              </a>
            </>
          ) : (
            <span className={styles.noPhotoNote}>{t('elementDetail.photoIllustration')}</span>
          )}
        </figcaption>
      </figure>

      <div className={styles.textCol}>
        <p className={styles.stripTitle}>{t('elementDetail.natureSection')}</p>
        {caption ? <p className={styles.caption}>{caption}</p> : null}
        {appearance ? <p className={styles.appearance}>{appearance}</p> : null}
      </div>
    </section>
  )
}
