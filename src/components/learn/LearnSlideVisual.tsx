import { useEffect, useMemo, useState } from 'react'
import { publicAssetUrl } from '../../utils/publicAssetUrl'
import { useT, type MessageKey } from '../../i18n/useT'
import styles from '../../pages/LearnPage.module.css'

export type LearnKenBurns = 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right'

export function LearnSlideVisual({
  titleKey,
  bodyKey,
  image,
  kenBurns = 'zoom-in',
  fullscreen = false,
}: {
  titleKey: MessageKey
  bodyKey?: MessageKey
  image: string
  kenBurns?: LearnKenBurns
  fullscreen?: boolean
}) {
  const { t } = useT()
  const src = image.startsWith('http') ? image : publicAssetUrl(image)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setLoaded(false)
    const img = new Image()
    img.decoding = 'async'
    img.loading = 'lazy'
    img.src = src
    const onLoad = () => setLoaded(true)
    img.addEventListener('load', onLoad)
    if (img.complete) onLoad()
    return () => img.removeEventListener('load', onLoad)
  }, [src])

  const kenClass =
    kenBurns === 'zoom-out'
      ? styles.learnSlideVisualKenZoomOut
      : kenBurns === 'pan-left'
        ? styles.learnSlideVisualKenPanLeft
        : kenBurns === 'pan-right'
          ? styles.learnSlideVisualKenPanRight
          : styles.learnSlideVisualKenZoomIn

  const wrapClass = fullscreen
    ? `${styles.learnSlideDeckPresentVisual} ${styles.learnSlideVisual}`
    : styles.learnSlideVisual

  const style = useMemo(
    () => ({
      backgroundImage: loaded ? `url("${src}")` : undefined,
      opacity: loaded ? 1 : 0.35,
    }),
    [loaded, src],
  )

  return (
    <div className={wrapClass}>
      <div
        className={`${styles.learnSlideVisualBg} ${kenClass}`}
        style={style}
        role="img"
        aria-hidden
      />
      <div className={styles.learnSlideVisualShade} aria-hidden />
      <div className={styles.learnSlideVisualCaption}>
        <h3 className={styles.learnSlideVisualTitle}>{t(titleKey)}</h3>
        {bodyKey ? <p className={styles.learnSlideVisualBody}>{t(bodyKey)}</p> : null}
      </div>
    </div>
  )
}

/** Предзагрузка постера / слайда */
export function prefetchLearnImage(path: string): void {
  const img = new Image()
  img.decoding = 'async'
  img.src = path.startsWith('http') ? path : publicAssetUrl(path)
}
