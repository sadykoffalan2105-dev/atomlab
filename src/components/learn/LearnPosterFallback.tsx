import styles from '../../pages/LearnPage.module.css'

/** Статичный постер §, если WebGL/Three.js не отрисовался. */
export function LearnPosterFallback({ sceneId, label }: { sceneId: string; label?: string }) {
  const src = `/learn/posters/${sceneId}.png`
  return (
    <div className={styles.learnPosterFallback}>
      <img src={src} alt={label ?? sceneId} loading="lazy" />
    </div>
  )
}
