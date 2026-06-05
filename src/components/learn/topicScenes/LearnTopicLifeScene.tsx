import { useMemo } from 'react'
import { getLifeScenePhotos } from '../../../learn/learnTopicLifePhotos'
import { useT } from '../../../i18n/useT'
import styles from './LearnTopicLifeScene.module.css'

export function LearnTopicLifeScene({
  sceneId,
  presentationMode = false,
}: {
  sceneId: string
  presentationMode?: boolean
}) {
  const { t } = useT()
  const scene = useMemo(() => getLifeScenePhotos(sceneId), [sceneId])
  if (!scene) return null

  const rootClass = [styles.root, presentationMode ? styles.present : ''].filter(Boolean).join(' ')

  return (
    <div
      className={rootClass}
      style={{ ['--life-accent' as string]: scene.accent }}
      role="img"
      aria-label={scene.hero.title}
    >
      <header
        className={styles.hero}
        style={{ backgroundImage: `url("${scene.hero.image}")` }}
      >
        <div className={styles.heroOverlay} aria-hidden />
        <div className={styles.heroContent}>
          <span className={styles.heroBadge}>{t('learn.visual.lifeBadge')}</span>
          <h2 className={styles.heroTitle}>{scene.hero.title}</h2>
        </div>
      </header>

      <div className={styles.grid}>
        {scene.cards.map((card) => (
          <article
            key={card.title}
            className={styles.card}
            style={{ backgroundImage: `url("${card.image}")` }}
          >
            <div className={styles.cardOverlay} aria-hidden />
            <div className={styles.cardBody}>
              <h3 className={styles.cardTitle}>{card.title}</h3>
              {card.chips.length > 0 ? (
                <div className={styles.chips}>
                  {card.chips.map((chip) => (
                    <span key={chip} className={styles.chip}>
                      {chip}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
