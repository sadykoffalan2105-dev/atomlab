import { compoundById } from '../../../data/compounds'
import { useT, type MessageKey } from '../../../i18n/useT'
import {
  CURATED_REACTIONS,
  type CuratedReactionId,
} from '../../../vrLab/reactions/curatedReactions'
import { VR_LAB_LESSONS } from '../../../vrLab/lessons/vrLabLessonModules'
import { isReactionCompleted } from '../../../vrLab/lessons/vrLabLessonProgress'
import styles from '../../../pages/VrLabPage.module.css'

type Props = {
  onTryReaction: (lessonId: string, compoundA: string, compoundB: string) => void
}

export function VrLabReactionCatalog({ onTryReaction }: Props) {
  const { t } = useT()

  const grouped = VR_LAB_LESSONS.map((lesson) => ({
    lesson,
    reactions: CURATED_REACTIONS.filter((r) => r.lessonId === lesson.id),
  })).filter((g) => g.reactions.length > 0)

  return (
    <div className={styles.reactionCatalog}>
      <p className={styles.catalogKicker}>{t('vrLab.catalog.kicker')}</p>
      <h3 className={styles.catalogTitle}>{t('vrLab.catalog.title')}</h3>
      <p className={styles.catalogLead}>{t('vrLab.catalog.lead')}</p>

      {grouped.map(({ lesson, reactions }) => (
        <section key={lesson.id} className={styles.catalogSection}>
          <h4 className={styles.catalogSectionTitle}>{t(lesson.titleKey as MessageKey)}</h4>
          <ul className={styles.catalogList}>
            {reactions.map((r) => {
              const done = isReactionCompleted(lesson.id, r.id)
              const formulaA =
                compoundById[r.a]?.formulaUnicode ?? r.a
              const formulaB =
                compoundById[r.b]?.formulaUnicode ?? r.b

              return (
                <li key={r.id} className={styles.catalogItem}>
                  <div className={styles.catalogItemHead}>
                    <span className={styles.catalogFormula}>
                      {formulaA} + {formulaB}
                    </span>
                    {done ? (
                      <span className={styles.catalogBadge}>{t('vrLab.catalog.done')}</span>
                    ) : null}
                  </div>
                  <p className={styles.catalogObs}>{t(r.practice.observationKey as MessageKey)}</p>
                  <button
                    type="button"
                    className={styles.btn}
                    onClick={() => onTryReaction(lesson.id, r.a, r.b)}
                  >
                    {t('vrLab.catalog.try')}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

export function reactionIdFromPair(a: string, b: string): CuratedReactionId | null {
  const key = a < b ? `${a}|${b}` : `${b}|${a}`
  const hit = CURATED_REACTIONS.find((r) => {
    const k = r.a < r.b ? `${r.a}|${r.b}` : `${r.b}|${r.a}`
    return k === key
  })
  return hit?.id ?? null
}
