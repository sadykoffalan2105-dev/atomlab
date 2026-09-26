/**
 * Интерфейс связи с платформой школ:
 *   • SchoolLinkButton — кнопка «Школа» в шапке + окно «Подключение к школе» (код, статус, отключение);
 *   • DeviceAgentHost — запускает агента, показывает экран блокировки поверх всего и сообщения администратора.
 * Без адреса платформы окно честно пишет «Платформа школ пока не подключена», а агент не делает запросов.
 */
import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'
import { useT, type MessageKey } from '../../i18n/useT'
import type { EnrollErrorCode } from '../protocol'
import { getDeviceAgent, lessonTargetFromPath, startDeviceAgent, trackUsage, useDeviceAgentState } from '../deviceAgentHost'
import styles from './SchoolLink.module.css'

function IconSchool({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M10 2.8 17.2 7H2.8L10 2.8z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M4 7.2v8.3M8 7.2v8.3M12 7.2v8.3M16 7.2v8.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M2.5 16.5h15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function IconLock({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden>
      <rect x="10" y="21" width="28" height="20" rx="5" stroke="currentColor" strokeWidth="2.4" />
      <path d="M16 21v-5.5a8 8 0 0 1 16 0V21" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="24" cy="30" r="2.6" fill="currentColor" />
      <path d="M24 32.5v3.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

function formatTime(ms: number, locale: string): string {
  try {
    return new Date(ms).toLocaleTimeString(locale === 'uz' ? 'uz-Latn-UZ' : locale === 'en' ? 'en-GB' : 'ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return new Date(ms).toISOString().slice(11, 16)
  }
}

// ─── окно «Подключение к школе» ─────────────────────────────────────────────

function SchoolLinkDialog({ onClose }: { onClose: () => void }) {
  const { t, locale } = useT()
  const state = useDeviceAgentState()
  const titleId = useId()
  const codeId = useId()
  const nameId = useId()
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<EnrollErrorCode | null>(null)
  const [confirmOff, setConfirmOff] = useState(false)
  const [checking, setChecking] = useState(false)
  const panelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const first = panelRef.current?.querySelector<HTMLElement>('input, button[data-autofocus]')
    first?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      if (busy) return
      setBusy(true)
      setError(null)
      const r = await getDeviceAgent().enroll(code, name)
      setBusy(false)
      if (!r.ok) setError(r.error)
      else {
        setCode('')
        setName('')
        getDeviceAgent().start()
      }
    },
    [busy, code, name],
  )

  const check = useCallback(async () => {
    setChecking(true)
    await getDeviceAgent().heartbeatNow()
    setChecking(false)
  }, [])

  let body: ReactNode
  if (!state.configured) {
    body = (
      <div className={styles.notice} data-kind="muted">
        <p className={styles.noticeTitle}>{t('school.notConfigured')}</p>
        <p className={styles.noticeText}>{t('school.notConfiguredHint')}</p>
      </div>
    )
  } else if (state.enrolled) {
    const status =
      state.online === true && state.lastSeenAt
        ? t('school.statusOnline', { time: formatTime(state.lastSeenAt, locale) })
        : state.online === false
          ? t('school.statusOffline')
          : t('school.statusPending')
    body = (
      <>
        <div className={styles.connected}>
          <span className={styles.connectedMark} aria-hidden>
            <IconSchool className={styles.connectedIcon} />
          </span>
          <div className={styles.connectedText}>
            <p className={styles.connectedTitle}>
              {state.schoolName ? t('school.connectedTo', { school: state.schoolName }) : t('school.connectedToUnknown')}
            </p>
            {state.className ? <p className={styles.meta}>{t('school.classLine', { name: state.className })}</p> : null}
            <p className={styles.meta}>{t('school.deviceLine', { id: (state.deviceId ?? '').slice(0, 8) })}</p>
            <p className={styles.status} data-online={state.online === true ? 'yes' : state.online === false ? 'no' : 'wait'}>
              <span className={styles.dot} aria-hidden />
              {status}
            </p>
          </div>
        </div>
        {confirmOff ? (
          <div className={styles.confirm} role="alert">
            <p>{t('school.disconnectConfirm')}</p>
            <div className={styles.actions}>
              <button type="button" className={styles.btnGhost} onClick={() => setConfirmOff(false)} data-autofocus>
                {t('school.cancel')}
              </button>
              <button
                type="button"
                className={styles.btnDanger}
                onClick={() => {
                  getDeviceAgent().disconnect()
                  setConfirmOff(false)
                }}
              >
                {t('school.disconnectYes')}
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.actions}>
            <button type="button" className={styles.btnGhost} onClick={() => setConfirmOff(true)}>
              {t('school.disconnect')}
            </button>
            <button type="button" className={styles.btnPrimary} onClick={check} disabled={checking} data-autofocus>
              {checking ? t('school.statusPending') : t('school.check')}
            </button>
          </div>
        )}
      </>
    )
  } else {
    body = (
      <form className={styles.form} onSubmit={submit} noValidate>
        {state.revoked ? (
          <p className={styles.notice} data-kind="warn" role="status">
            {t('school.revoked')}
          </p>
        ) : null}
        <p className={styles.lead}>{t('school.intro')}</p>
        <label className={styles.field} htmlFor={codeId}>
          <span className={styles.label}>{t('school.codeLabel')}</span>
          <input
            id={codeId}
            className={`${styles.input} ${styles.codeInput}`}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder={t('school.codePlaceholder')}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            inputMode="text"
            maxLength={12}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${codeId}-err` : undefined}
          />
        </label>
        <label className={styles.field} htmlFor={nameId}>
          <span className={styles.label}>{t('school.nameLabel')}</span>
          <input
            id={nameId}
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('school.namePlaceholder')}
            autoComplete="off"
            maxLength={60}
          />
        </label>
        {error ? (
          <p id={`${codeId}-err`} className={styles.error} role="alert">
            {t(`school.err.${error}` as MessageKey)}
          </p>
        ) : null}
        <div className={styles.actions}>
          <button type="submit" className={styles.btnPrimary} disabled={busy || !code.trim()}>
            {busy ? t('school.connecting') : t('school.connect')}
          </button>
        </div>
      </form>
    )
  }

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className={styles.panel} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={panelRef}>
        <div className={styles.panelHead}>
          <span className={styles.headMark} aria-hidden>
            <IconSchool className={styles.headIcon} />
          </span>
          <h2 id={titleId} className={styles.title}>
            {t('school.dialogTitle')}
          </h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label={t('school.close')}>
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden>
              <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {body}
        {state.configured ? (
          <p className={styles.footer}>
            <Link to="/school-login" onClick={onClose} className={styles.footerLink}>
              {t('school.login.link')}
            </Link>
          </p>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}

export function SchoolLinkButton({ className }: { className?: string }) {
  const { t } = useT()
  const state = useDeviceAgentState()
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const connected = state.configured && state.enrolled
  return (
    <>
      <button
        type="button"
        className={`${styles.headerBtn} ${className ?? ''}`}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={connected ? t('school.buttonConnectedAria') : t('school.buttonAria')}
        title={connected ? t('school.buttonConnectedAria') : t('school.buttonAria')}
        data-connected={connected ? 'yes' : 'no'}
      >
        <IconSchool className={styles.headerIcon} />
        {connected ? <span className={styles.headerDot} aria-hidden /> : null}
      </button>
      {/* Под экраном блокировки окно не нужно (и не должно ловить фокус). */}
      {open && !state.locked ? <SchoolLinkDialog onClose={close} /> : null}
    </>
  )
}

// ─── экран блокировки и сообщения ───────────────────────────────────────────

const TOAST_MS = 30_000

function DeviceLockScreen({ message, school }: { message: string | null; school: string | null }) {
  const { t } = useT()
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    // Всё приложение под экраном — недоступно ни мышью, ни клавиатурой, ни экранному диктору.
    const root = document.getElementById('root')
    const prevOverflow = document.body.style.overflow
    root?.setAttribute('inert', '')
    root?.setAttribute('aria-hidden', 'true')
    document.body.style.overflow = 'hidden'
    ref.current?.focus()
    return () => {
      root?.removeAttribute('inert')
      root?.removeAttribute('aria-hidden')
      document.body.style.overflow = prevOverflow
    }
  }, [])

  return createPortal(
    <div className={styles.lock} role="alertdialog" aria-modal="true" aria-labelledby="atomlab-lock-title" tabIndex={-1} ref={ref}>
      <div className={styles.lockCard}>
        <span className={styles.lockMark}>
          <IconLock className={styles.lockIcon} />
        </span>
        <h1 id="atomlab-lock-title" className={styles.lockTitle}>
          {t('school.lockTitle')}
        </h1>
        {message ? (
          <div className={styles.lockMessage}>
            <p className={styles.lockFrom}>{t('school.lockFrom')}</p>
            <p className={styles.lockText}>{message}</p>
          </div>
        ) : (
          <p className={styles.lockLead}>{t('school.lockDefault')}</p>
        )}
        <p className={styles.lockHint}>{t('school.lockHint')}</p>
        {school ? <p className={styles.lockSchool}>{school}</p> : null}
      </div>
    </div>,
    document.body,
  )
}

function Toast({ id, title, text, onClose }: { id: string; title: string; text: string; onClose: (id: string) => void }) {
  const { t } = useT()
  useEffect(() => {
    const timer = window.setTimeout(() => onClose(id), TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [id, onClose])
  return (
    <div className={styles.toast} role="status">
      <span className={styles.toastMark} aria-hidden>
        <IconSchool className={styles.toastIcon} />
      </span>
      <div className={styles.toastBody}>
        <p className={styles.toastTitle}>{title}</p>
        <p className={styles.toastText}>{text}</p>
      </div>
      <button type="button" className={styles.toastClose} onClick={() => onClose(id)} aria-label={t('school.toastClose')}>
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden>
          <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}

/** Запускает агента устройства и рисует всё, что приходит от администратора. Монтируется один раз в AppShell. */
export function DeviceAgentHost() {
  const { t } = useT()
  const state = useDeviceAgentState()

  const { pathname } = useLocation()

  useEffect(() => {
    startDeviceAgent()
  }, [])

  // Какие разделы открывают — только маршрут, без параметров и данных учеников.
  useEffect(() => {
    trackUsage('route_view', pathname)
    const lesson = lessonTargetFromPath(pathname)
    if (lesson) trackUsage('lesson_open', lesson)
  }, [pathname])

  const dismiss = useCallback((id: string) => getDeviceAgent().dismissMessage(id), [])
  const dismissRevoked = useCallback(() => getDeviceAgent().clearRevoked(), [])

  if (!state.configured) return null

  return (
    <>
      {state.locked ? <DeviceLockScreen message={state.lockMessage} school={state.schoolName} /> : null}
      {state.messages.length || state.revoked
        ? createPortal(
            <div className={styles.toasts} aria-live="polite">
              {state.revoked ? (
                <Toast id="revoked" title={t('school.toastTitle')} text={t('school.revoked')} onClose={dismissRevoked} />
              ) : null}
              {state.messages.map((m) => (
                <Toast key={m.id} id={m.id} title={t('school.toastTitle')} text={m.text} onClose={dismiss} />
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
