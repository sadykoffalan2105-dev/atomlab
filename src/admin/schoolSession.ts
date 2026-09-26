/**
 * Сессия входа учителя или класса (class-login). Пока хранит только то, что нужно агенту устройства:
 * id учётной записи для пульса и событий. Пароль здесь не хранится никогда.
 */
export const SCHOOL_SESSION_KEY = 'atomlab.schoolSession.v1'

export type SchoolSession = {
  accountId: string
  role: 'teacher' | 'class'
  displayName: string
  accessToken: string
  refreshToken: string
  features: string[]
}

const listeners = new Set<() => void>()

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

export function readSchoolSession(): SchoolSession | null {
  const s = storage()
  if (!s) return null
  try {
    const raw = s.getItem(SCHOOL_SESSION_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as Partial<SchoolSession>
    if (typeof v.accountId !== 'string' || typeof v.accessToken !== 'string') return null
    return v as SchoolSession
  } catch {
    return null
  }
}

export function getSchoolAccountId(): string | null {
  return readSchoolSession()?.accountId ?? null
}

export function saveSchoolSession(session: SchoolSession): void {
  try {
    storage()?.setItem(SCHOOL_SESSION_KEY, JSON.stringify(session))
  } catch {
    /* ignore */
  }
  for (const l of [...listeners]) l()
}

export function clearSchoolSession(): void {
  try {
    storage()?.removeItem(SCHOOL_SESSION_KEY)
  } catch {
    /* ignore */
  }
  for (const l of [...listeners]) l()
}

export function subscribeSchoolSession(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
