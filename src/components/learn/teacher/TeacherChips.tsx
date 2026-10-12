/**
 * Общие «чипы» ИИ-учителя: источники ответа, какой «мозг» отвечает и индикатор мозга
 * (сервер ATOMLAB для всех учеников или мозг на этом компьютере). Используются и в чате урока,
 * и в онлайн-уроке.
 */
import { useSyncExternalStore } from 'react'
import { useT } from '../../../i18n/useT'
import { checkHealth, optInLocalBrain, useBrainInfo } from '../../../learn/brain/remote/brainClient'
import { currentBrowserVoiceProfile } from '../../../learn/brain/speech/browserProfile'
import { getVoiceDiag, subscribeVoiceDiag } from '../../../learn/brain/speech/voiceStatus'
import { IconBook, IconBrainSpark, IconDatabase } from './TeacherIcons'
import styles from './TeacherChips.module.css'

/** 'brain' — мозг ATOMLAB (сервер или ПК учителя); 'local' — база знаний в браузере; 'server' — сервер учителя. */
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
  const { kind } = useBrainInfo()
  const label =
    brain === 'brain'
      ? kind === 'remote'
        ? t('learn.teacherUi.brainRemoteAi')
        : t('learn.teacherUi.brainLocalAi')
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
 * Индикатор мозга: «Мозг ATOMLAB: подключён» (сервер) / «Локальный мозг: подключён» (этот ПК) /
 * «Мозг недоступен — отвечаю из базы браузера». Сервер в brain.json проверяется первым; к мозгу на этом ПК
 * сайт из интернета стучится только с разрешения браузера или после щелчка «Использовать мозг на этом
 * компьютере» (не в компактном виде) — иначе браузер показывал бы окно «Разрешить» каждому ученику.
 */
export function BrainStatusChip({ compact = false, className }: { compact?: boolean; className?: string }) {
  const { t } = useT()
  const info = useBrainInfo()
  const { status } = info
  const online = status === 'online'
  const remote = online && info.kind === 'remote'
  const busy = online && info.busy
  // ученик выбрал мозг на этом ПК: браузер спрашивает или запретил доступ — подсказываем, что нажать
  const askAccess = !online && info.localOptIn && (info.waitingPermission || info.access === 'prompt')
  const denied = !online && info.localOptIn && info.access === 'denied'
  const label = busy
    ? t('learn.teacherUi.brainBusy')
    : online
      ? remote
        ? t('learn.teacherUi.brainRemoteOnline')
        : t('learn.teacherUi.brainOnline')
      : denied
        ? t('learn.teacherUi.brainDenied')
        : askAccess
          ? t('learn.teacherUi.brainAllow')
          : status === 'checking'
            ? t('learn.teacherUi.brainChecking')
            : t('learn.teacherUi.brainUnavailable')
  const title = busy
    ? `${label}. ${t('learn.teacherUi.brainBusyHint')}`
    : online
      ? label
      : denied
        ? `${label}. ${t('learn.teacherUi.brainDeniedHint')}`
        : askAccess
          ? `${label}. ${t('learn.teacherUi.brainAllowHint')}`
          : info.remoteConfigured
            ? t('learn.teacherUi.brainRemoteHint')
            : `${t('learn.teacherUi.brainOffline')}. ${t('learn.teacherUi.brainHint')}`
  const Icon = online ? IconBrainSpark : IconDatabase
  const showOptIn = !compact && !online && info.canUseLocal && status !== 'checking'
  const chip = (
    <span
      className={`${styles.brain} ${showOptIn ? '' : (className ?? '')}`}
      data-brain={online && !busy ? 'brain' : 'local'}
      data-kind={online ? (remote ? 'remote' : 'local') : undefined}
      data-status={busy ? 'busy' : status}
      data-access={denied ? 'denied' : askAccess ? 'prompt' : undefined}
      data-compact={compact ? '1' : undefined}
      title={title}
      role="status"
      aria-live="polite"
      // не найден / окно разрешения закрыли — щелчок проверяет снова (и снова показывает окно браузера);
      // доступ запрещён — щелчок объясняет, где его включить (сам сайт снять запрет не может)
      onClick={online && !busy ? undefined : denied ? () => window.alert(t('learn.teacherUi.brainDeniedHint')) : () => void checkHealth(true)}
      style={online && !busy ? undefined : { cursor: 'pointer' }}
    >
      <Icon className={styles.brainIcon} />
      <span className={styles.brainLabel}>{label}</span>
    </span>
  )
  if (!showOptIn) return chip
  return (
    <span className={`${styles.brainGroup} ${className ?? ''}`}>
      {chip}
      <button
        type="button"
        className={styles.ctaInline}
        title={t('learn.teacherUi.brainUseLocalHint')}
        onClick={() => void optInLocalBrain()}
      >
        <IconBrainSpark className={styles.ctaIcon} />
        <span>{t('learn.teacherUi.brainUseLocal')}</span>
      </button>
    </span>
  )
}

/** Место в очереди сервера мозга — дописывается к «Думаю…» (ничего, если вопрос не в очереди). */
export function BrainQueueNote({ className }: { className?: string }) {
  const { t } = useT()
  const { queue } = useBrainInfo()
  if (!queue) return null
  return (
    <span className={`${styles.queue} ${className ?? ''}`} data-brain-queue={queue}>
      {' · '}
      {t('learn.teacherUi.brainQueue', { n: queue })}
    </span>
  )
}

/**
 * Путь распознавания речи: «Распознавание: сервер ATOMLAB / браузер (Google) / браузер (Microsoft) /
 * недоступно». data-testid="voice-path-chip" data-path — контракт e2e.
 */
export function SttPathChip({ className }: { className?: string }) {
  const { t } = useT()
  const diag = useSyncExternalStore(subscribeVoiceDiag, getVoiceDiag, getVoiceDiag)
  const vendor = currentBrowserVoiceProfile().vendor
  const name =
    diag.path === 'server'
      ? t('learn.voice.pathServer')
      : diag.path === 'web_speech'
        ? vendor === 'edge'
          ? t('learn.voice.pathMicrosoft')
          : vendor === 'chrome'
            ? t('learn.voice.pathGoogle')
            : vendor === 'safari'
              ? t('learn.voice.pathApple')
              : t('learn.voice.pathBrowser')
        : t('learn.voice.pathNone')
  const label = t('learn.voice.pathLabel', { path: name })
  return (
    <span
      className={`${styles.brain} ${className ?? ''}`}
      data-testid="voice-path-chip"
      data-path={diag.path}
      data-brain={diag.path === 'server' ? 'brain' : 'local'}
      data-compact="1"
      title={diag.path === 'server' ? `${label}. ${t('learn.voice.privacyServer')}` : label}
      role="status"
    >
      <span className={styles.brainLabel}>{label}</span>
    </span>
  )
}
