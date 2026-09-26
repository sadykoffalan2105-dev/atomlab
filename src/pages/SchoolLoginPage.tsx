/**
 * /#/school-login — вход учителя или класса (логин и пароль выдаёт администратор школы).
 * Без адреса платформы страница пишет «Платформа школ пока не подключена» и ничего не отправляет.
 */
import { useCallback, useId, useState, useSyncExternalStore, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useT, type MessageKey } from '../i18n/useT'
import { readAdminConfig } from '../admin/deviceAgentHost'
import { classLogin } from '../admin/schoolLogin'
import { clearSchoolSession, readSchoolSession, subscribeSchoolSession } from '../admin/schoolSession'
import type { ClassLoginErrorCode } from '../admin/protocol'
import styles from '../admin/ui/SchoolLink.module.css'

let cachedRaw: string | null | undefined
let cachedSession: ReturnType<typeof readSchoolSession> = null
function sessionSnapshot() {
  const s = readSchoolSession()
  const raw = s ? `${s.accountId}|${s.displayName}` : null
  if (raw !== cachedRaw) {
    cachedRaw = raw
    cachedSession = s
  }
  return cachedSession
}

export function SchoolLoginPage() {
  const { t, locale } = useT()
  const configured = readAdminConfig() != null
  const session = useSyncExternalStore(subscribeSchoolSession, sessionSnapshot, sessionSnapshot)
  const loginId = useId()
  const passId = useId()
  // Карточка с QR из консоли ATOMLAB Admin открывает #/school-login?login=… — логин подставляется сам.
  const [searchParams] = useSearchParams()
  const [login, setLogin] = useState(() => (searchParams.get('login') ?? '').trim().slice(0, 64))
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ code: ClassLoginErrorCode; opensAt?: string | null } | null>(null)

  const submit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      if (busy) return
      setBusy(true)
      setError(null)
      const r = await classLogin(login, password)
      setBusy(false)
      setPassword('')
      if (!r.ok) setError({ code: r.error, opensAt: r.opensAt })
    },
    [busy, login, password],
  )

  let errorText: string | null = null
  if (error) {
    if (error.code === 'access_closed' && error.opensAt) {
      let when = error.opensAt
      try {
        when = new Date(error.opensAt).toLocaleString(locale === 'en' ? 'en-GB' : locale === 'uz' ? 'uz-Latn-UZ' : 'ru-RU', {
          weekday: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })
      } catch {
        /* оставляем как есть */
      }
      errorText = t('school.login.err.access_closed_until', { time: when })
    } else {
      errorText = t(`school.login.err.${error.code}` as MessageKey)
    }
  }

  return (
    <div
      style={{
        flex: 1,
        display: 'grid',
        placeItems: 'center',
        padding: '32px 16px',
        background: 'var(--app-shell-bg, var(--lt-bg))',
      }}
    >
      <section className={styles.panel} aria-labelledby={`${loginId}-title`} style={{ animation: 'none' }}>
        <div className={styles.panelHead}>
          <h1 id={`${loginId}-title`} className={styles.title}>
            {t('school.login.title')}
          </h1>
        </div>
        {!configured ? (
          <div className={styles.notice}>
            <p className={styles.noticeTitle}>{t('school.notConfigured')}</p>
            <p className={styles.noticeText}>{t('school.notConfiguredHint')}</p>
          </div>
        ) : session ? (
          <>
            <div className={styles.connected}>
              <div className={styles.connectedText}>
                <p className={styles.connectedTitle}>{t('school.login.signedIn', { name: session.displayName })}</p>
              </div>
            </div>
            <div className={styles.actions}>
              <button type="button" className={styles.btnGhost} onClick={() => clearSchoolSession()}>
                {t('school.login.logout')}
              </button>
            </div>
          </>
        ) : (
          <form className={styles.form} onSubmit={submit} noValidate>
            <p className={styles.lead}>{t('school.login.lead')}</p>
            <label className={styles.field} htmlFor={loginId}>
              <span className={styles.label}>{t('school.login.login')}</span>
              <input
                id={loginId}
                className={styles.input}
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder={t('school.login.loginPlaceholder')}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={64}
              />
            </label>
            <label className={styles.field} htmlFor={passId}>
              <span className={styles.label}>{t('school.login.password')}</span>
              <input
                id={passId}
                className={styles.input}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                maxLength={128}
              />
            </label>
            {errorText ? (
              <p className={styles.error} role="alert">
                {errorText}
              </p>
            ) : null}
            <div className={styles.actions}>
              <button type="submit" className={styles.btnPrimary} disabled={busy || !login.trim() || !password}>
                {busy ? t('school.login.submitting') : t('school.login.submit')}
              </button>
            </div>
          </form>
        )}
        <p className={styles.footer}>
          <Link to="/" className={styles.footerLink}>
            {t('school.login.back')}
          </Link>
        </p>
      </section>
    </div>
  )
}
