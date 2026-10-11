/**
 * Общие «чипы» ИИ-учителя: источники ответа, какой «мозг» отвечает и индикатор
 * локального мозга. Используются и в чате урока, и в онлайн-уроке.
 */
import { useT } from '../../../i18n/useT'
import { checkHealth, useBrainAccess, useBrainStatus } from '../../../learn/brain/remote/brainClient'
import { IconBook, IconBrainSpark, IconDatabase } from './TeacherIcons'
import styles from './TeacherChips.module.css'

/** 'brain' — локальный мозг на ПК учителя; 'local' — база знаний в браузере; 'server' — сервер учителя. */
export type TeacherBrain = 'brain' | 'local' | 'server'

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
    brain === 'brain'
      ? t('learn.teacherUi.brainLocalAi')
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
 * Индикатор локального мозга: «Локальный мозг: подключён» / «Локальный мозг: не найден»;
 * подсказка — как запустить мозг (`npm run brain:start`). Проверка /health ≤ 800 мс, опрос раз в 30 с.
 */
export function BrainStatusChip({ compact = false, className }: { compact?: boolean; className?: string }) {
  const { t } = useT()
  const status = useBrainStatus()
  const access = useBrainAccess()
  const online = status === 'online'
  // браузер спрашивает или запретил доступ сайта к программе на этом ПК — подсказываем, что нажать
  const askAccess = !online && access === 'prompt'
  const denied = !online && access === 'denied'
  const label = online
    ? t('learn.teacherUi.brainOnline')
    : denied
      ? t('learn.teacherUi.brainDenied')
      : askAccess
        ? t('learn.teacherUi.brainAllow')
        : status === 'checking'
          ? t('learn.teacherUi.brainChecking')
          : t('learn.teacherUi.brainOfflineShort')
  const title = online
    ? label
    : denied
      ? `${label}. ${t('learn.teacherUi.brainDeniedHint')}`
      : askAccess
        ? `${label}. ${t('learn.teacherUi.brainAllowHint')}`
        : `${t('learn.teacherUi.brainOffline')}. ${t('learn.teacherUi.brainHint')}`
  const Icon = online ? IconBrainSpark : IconDatabase
  return (
    <span
      className={`${styles.brain} ${className ?? ''}`}
      data-brain={online ? 'brain' : 'local'}
      data-status={status}
      data-access={denied ? 'denied' : askAccess ? 'prompt' : undefined}
      data-compact={compact ? '1' : undefined}
      title={title}
      role="status"
      aria-live="polite"
      // не найден / окно разрешения закрыли — щелчок проверяет снова (и снова показывает окно браузера);
      // доступ запрещён — щелчок объясняет, где его включить (сам сайт снять запрет не может)
      onClick={online ? undefined : denied ? () => window.alert(t('learn.teacherUi.brainDeniedHint')) : () => void checkHealth(true)}
      style={online ? undefined : { cursor: 'pointer' }}
    >
      <Icon className={styles.brainIcon} />
      <span className={styles.brainLabel}>{label}</span>
    </span>
  )
}
