/**
 * Общие «чипы» ИИ-учителя: источники ответа, какой «мозг» отвечает,
 * призыв подключить умный ИИ. Используются и в чате урока, и в онлайн-уроке.
 */
import { useT } from '../../../i18n/useT'
import { IconBook, IconBrainSpark, IconDatabase } from './TeacherIcons'
import { useSmartAi } from './smartAiStore'
import styles from './TeacherChips.module.css'

export type TeacherBrain = 'smart' | 'local' | 'ollama' | 'server'

export function SourceChips({ citations, className }: { citations: readonly string[]; className?: string }) {
  const { t } = useT()
  if (citations.length === 0) return null
  return (
    <ul className={`${styles.sources} ${className ?? ''}`} aria-label={t('learn.teacherUi.sources')}>
      {citations.map((c) => (
        <li key={c} className={styles.source} title={c}>
          <IconBook className={styles.sourceIcon} />
          <span>{c}</span>
        </li>
      ))}
    </ul>
  )
}

export function BrainChip({
  brain,
  compact = false,
  className,
}: {
  brain: TeacherBrain
  compact?: boolean
  className?: string
}) {
  const { t } = useT()
  const label =
    brain === 'smart'
      ? t('learn.teacherUi.brainSmart')
      : brain === 'ollama'
        ? t('learn.assistant.sourceOllama')
        : brain === 'server'
          ? t('learn.teacherUi.brainServer')
          : t('learn.teacherUi.brainLocal')
  const Icon = brain === 'local' ? IconDatabase : IconBrainSpark
  return (
    <span
      className={`${styles.brain} ${className ?? ''}`}
      data-brain={brain}
      data-compact={compact ? '1' : undefined}
      title={t('learn.teacherUi.brainAnswers', { brain: label })}
    >
      <Icon className={styles.brainIcon} />
      <span className={styles.brainLabel} data-has-short={brain === 'local' ? '1' : undefined}>
        {label}
      </span>
      {brain === 'local' ? (
        <span className={styles.brainLabelShort} aria-hidden>
          {t('learn.teacherUi.brainLocalShort')}
        </span>
      ) : null}
    </span>
  )
}

/**
 * «Подключить умный ИИ (бесплатно)» + однострочное пояснение.
 * `layout="inline"` — кнопка-ссылка для тесных мест.
 */
export function SmartAiCta({ layout = 'card', className }: { layout?: 'card' | 'inline'; className?: string }) {
  const { t } = useT()
  const { status, connect } = useSmartAi()
  if (status === 'on') return null
  const busy = status === 'connecting'
  const button = (
    <button
      type="button"
      className={layout === 'inline' ? styles.ctaInline : styles.ctaBtn}
      onClick={() => void connect()}
      disabled={busy}
      aria-busy={busy}
      title={layout === 'inline' ? t('learn.teacherUi.smartExplain') : undefined}
    >
      <IconBrainSpark className={styles.ctaIcon} />
      <span>{busy ? t('learn.teacherUi.smartConnecting') : t('learn.teacherUi.smartConnect')}</span>
    </button>
  )
  if (layout === 'inline') return <span className={className}>{button}</span>
  return (
    <div className={`${styles.cta} ${className ?? ''}`} data-status={status}>
      {button}
      <p className={styles.ctaText}>
        {status === 'error' ? t('learn.teacherUi.smartError') : t('learn.teacherUi.smartExplain')}
      </p>
    </div>
  )
}
