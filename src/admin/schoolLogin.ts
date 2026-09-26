/**
 * Вход учителя или класса в ATOMLAB (POST class-login, docs/API.md §5).
 * Пароль уходит только на сервер платформы и нигде не сохраняется; сохраняется сессия (токены Supabase Auth)
 * и сведения об учётной записи — их использует агент устройства (accountId в пульсе и событиях).
 */
import type { ClassLoginErrorCode, ClassLoginResponse } from './protocol'
import { readAdminConfig } from './deviceAgentHost'
import { saveSchoolSession } from './schoolSession'

export type ClassLoginResult =
  | { ok: true; displayName: string }
  | { ok: false; error: ClassLoginErrorCode; opensAt?: string | null }

export async function classLogin(login: string, password: string, fetchImpl: typeof fetch = fetch): Promise<ClassLoginResult> {
  const config = readAdminConfig()
  if (!config) return { ok: false, error: 'not_configured' }
  const cleanLogin = login.trim().toLowerCase()
  if (!cleanLogin || !password) return { ok: false, error: 'bad_credentials' }
  const url = `${config.baseUrl.replace(/\/+$/, '')}/functions/v1/class-login`
  let res: Response
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ login: cleanLogin, password }),
    })
  } catch {
    return { ok: false, error: 'network' }
  }
  let json: Record<string, unknown> | null
  try {
    json = (await res.json()) as Record<string, unknown>
  } catch {
    json = null
  }
  if (res.ok && json && typeof json.accessToken === 'string' && json.account && typeof json.account === 'object') {
    const r = json as unknown as ClassLoginResponse
    saveSchoolSession({
      accountId: r.account.id,
      role: r.account.role,
      displayName: r.account.displayName,
      accessToken: r.accessToken,
      refreshToken: r.refreshToken,
      features: Array.isArray(r.features) ? r.features : [],
    })
    return { ok: true, displayName: r.account.displayName }
  }
  const err = typeof json?.error === 'string' ? json.error : ''
  if (res.status === 403 || err === 'access_closed') {
    return { ok: false, error: 'access_closed', opensAt: typeof json?.opensAt === 'string' ? json.opensAt : null }
  }
  if (res.status === 423 || err === 'suspended') return { ok: false, error: 'suspended' }
  if (res.status === 400 || res.status === 401 || res.status === 404) return { ok: false, error: 'bad_credentials' }
  return { ok: false, error: 'server' }
}
