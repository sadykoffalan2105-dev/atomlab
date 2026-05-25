import { useT, type MessageKey } from '../../i18n/useT'
import styles from '../../pages/LearnPage.module.css'

export function LearnTheoryRich({
  bulletsKey,
  calloutKey,
  diagramKey,
}: {
  bulletsKey?: MessageKey
  calloutKey?: MessageKey
  diagramKey?: MessageKey
}) {
  const { t } = useT()
  const bullets = bulletsKey
    ? t(bulletsKey)
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean)
    : []
  const diagram = diagramKey ? t(diagramKey).split('|').map((s) => s.trim()) : null

  if (!bullets.length && !calloutKey && !diagram) return null

  return (
    <div className={styles.learnRichBlocks}>
      {bullets.length > 0 ? (
        <ul className={styles.learnRichBullets}>
          {bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      ) : null}
      {diagram && diagram[0] ? (
        <figure className={styles.learnRichDiagram}>
          <div className={styles.learnRichDiagramArt} aria-hidden />
          <figcaption>
            <strong>{diagram[0]}</strong>
            {diagram[1] ? <span>{diagram[1]}</span> : null}
          </figcaption>
        </figure>
      ) : null}
      {calloutKey ? (
        <aside className={styles.learnRichCallout}>
          <span className={styles.learnRichCalloutIcon} aria-hidden>
            💡
          </span>
          <p>{t(calloutKey)}</p>
        </aside>
      ) : null}
    </div>
  )
}
