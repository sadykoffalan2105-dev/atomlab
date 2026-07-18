/**
 * Big Data Layer — долгосрочная память ИИ-преподавателя о конкретном ученике.
 *
 * Хранит:
 *  • rapport — характер общения (чувствительность, темп, отклик на похвалу);
 *  • mastery — динамический профиль владения темами (EWMA по попыткам);
 *  • misconceptions — устойчивые ошибки/заблуждения с частотой;
 *  • hooks — «зацепки» (интересы/формулировки ученика) для тёплого контакта;
 *  • sessions — история сессий с ключевыми моментами.
 *
 * Персистентность: IndexedDB (основной путь) → localStorage (фолбэк) →
 * in-memory (SSR/приватный режим). Весь публичный API — асинхронный.
 */
import type { EmotionState } from './brainTypes'

export interface TopicMastery {
  topic: string
  /** Владение темой 0..1 (экспоненциально сглаженное). */
  mastery: number
  attempts: number
  lastMs: number
}

export interface Misconception {
  id: string
  topic: string
  note: string
  count: number
  lastMs: number
}

export type PreferredPace = 'slow' | 'normal' | 'fast'

export interface RapportProfile {
  sessionCount: number
  avgEngagement: number
  avgAttention: number
  /** Насколько легко ученик расстраивается 0..1 — влияет на мягкость тона. */
  sensitivity: number
  /** Насколько похвала повышает вовлечённость 0..1. */
  encouragementResponsiveness: number
  preferredPace: PreferredPace
  /** Интересы/повторяющиеся формулировки — для персонализации. */
  hooks: string[]
}

export interface StudentProfile {
  studentId: string
  updatedMs: number
  rapport: RapportProfile
  mastery: Record<string, TopicMastery>
  misconceptions: Misconception[]
}

export interface SessionRecord {
  id: string
  studentId: string
  startedMs: number
  endedMs: number
  topic: string
  transcriptHighlights: string[]
  avgAttention: number
  dominantEmotion: EmotionState
  score: number | null
}

const DB_NAME = 'atomlab-brain'
const DB_VERSION = 1
const STORE_PROFILE = 'profiles'
const STORE_SESSION = 'sessions'
const LS_PREFIX = 'atomlab.brain.'

function nowMs(): number {
  return Date.now()
}

function defaultProfile(studentId: string): StudentProfile {
  return {
    studentId,
    updatedMs: nowMs(),
    rapport: {
      sessionCount: 0,
      avgEngagement: 0.7,
      avgAttention: 0.7,
      sensitivity: 0.4,
      encouragementResponsiveness: 0.5,
      preferredPace: 'normal',
      hooks: [],
    },
    mastery: {},
    misconceptions: [],
  }
}

/** Экспоненциальное скользящее среднее. */
function ewma(prev: number, next: number, alpha: number): number {
  const a = Math.min(1, Math.max(0, alpha))
  return prev * (1 - a) + next * a
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x))
}

function isIndexedDbAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null
  } catch {
    return false
  }
}

function idbRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'))
  })
}

export class StudentMemoryStore {
  private dbPromise: Promise<IDBDatabase | null> | null = null
  private readonly memProfiles = new Map<string, StudentProfile>()
  private readonly memSessions: SessionRecord[] = []

  private openDb(): Promise<IDBDatabase | null> {
    if (this.dbPromise) return this.dbPromise
    if (!isIndexedDbAvailable()) {
      this.dbPromise = Promise.resolve(null)
      return this.dbPromise
    }
    this.dbPromise = new Promise<IDBDatabase | null>((resolve) => {
      let req: IDBOpenDBRequest
      try {
        req = indexedDB.open(DB_NAME, DB_VERSION)
      } catch {
        resolve(null)
        return
      }
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE_PROFILE)) {
          db.createObjectStore(STORE_PROFILE, { keyPath: 'studentId' })
        }
        if (!db.objectStoreNames.contains(STORE_SESSION)) {
          const s = db.createObjectStore(STORE_SESSION, { keyPath: 'id' })
          s.createIndex('byStudent', 'studentId', { unique: false })
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    })
    return this.dbPromise
  }

  private lsKey(studentId: string): string {
    return `${LS_PREFIX}profile.${studentId}`
  }

  private readLocalStorage(studentId: string): StudentProfile | null {
    try {
      if (typeof localStorage === 'undefined') return null
      const raw = localStorage.getItem(this.lsKey(studentId))
      return raw ? (JSON.parse(raw) as StudentProfile) : null
    } catch {
      return null
    }
  }

  private writeLocalStorage(profile: StudentProfile): void {
    try {
      if (typeof localStorage === 'undefined') return
      localStorage.setItem(this.lsKey(profile.studentId), JSON.stringify(profile))
    } catch {
      /* quota / private mode — тихо игнорируем, остаётся in-memory */
    }
  }

  async loadProfile(studentId: string): Promise<StudentProfile> {
    const db = await this.openDb()
    if (db) {
      try {
        const tx = db.transaction(STORE_PROFILE, 'readonly')
        const found = await idbRequest<StudentProfile | undefined>(
          tx.objectStore(STORE_PROFILE).get(studentId),
        )
        if (found) {
          this.memProfiles.set(studentId, found)
          return found
        }
      } catch {
        /* fall through */
      }
    }

    const mem = this.memProfiles.get(studentId)
    if (mem) return mem

    const ls = this.readLocalStorage(studentId)
    if (ls) {
      this.memProfiles.set(studentId, ls)
      return ls
    }

    const fresh = defaultProfile(studentId)
    this.memProfiles.set(studentId, fresh)
    return fresh
  }

  async saveProfile(profile: StudentProfile): Promise<void> {
    profile.updatedMs = nowMs()
    this.memProfiles.set(profile.studentId, profile)
    this.writeLocalStorage(profile)

    const db = await this.openDb()
    if (!db) return
    try {
      const tx = db.transaction(STORE_PROFILE, 'readwrite')
      tx.objectStore(STORE_PROFILE).put(profile)
      await idbRequest(tx.objectStore(STORE_PROFILE).get(profile.studentId))
    } catch {
      /* остаётся localStorage / in-memory */
    }
  }

  /** Обновить владение темой по доле верного (0..1). */
  async updateMastery(studentId: string, topic: string, correctnessRatio: number): Promise<void> {
    const profile = await this.loadProfile(studentId)
    const key = topic.trim().toLowerCase()
    if (!key) return
    const prev = profile.mastery[key]
    const value = clamp01(correctnessRatio)
    profile.mastery[key] = {
      topic,
      mastery: prev ? ewma(prev.mastery, value, 0.4) : value,
      attempts: (prev?.attempts ?? 0) + 1,
      lastMs: nowMs(),
    }
    await this.saveProfile(profile)
  }

  /** Зафиксировать устойчивое заблуждение (или увеличить его счётчик). */
  async addMisconception(studentId: string, topic: string, note: string): Promise<void> {
    const profile = await this.loadProfile(studentId)
    const id = `${topic}::${note}`.toLowerCase().slice(0, 120)
    const existing = profile.misconceptions.find((m) => m.id === id)
    if (existing) {
      existing.count += 1
      existing.lastMs = nowMs()
    } else {
      profile.misconceptions.push({ id, topic, note, count: 1, lastMs: nowMs() })
    }
    // Держим список ограниченным — самые частые и свежие.
    profile.misconceptions.sort((a, b) => b.count - a.count || b.lastMs - a.lastMs)
    profile.misconceptions = profile.misconceptions.slice(0, 40)
    await this.saveProfile(profile)
  }

  /** Запомнить «зацепку» — интерес или характерную формулировку ученика. */
  async noteHook(studentId: string, hook: string): Promise<void> {
    const clean = hook.trim()
    if (clean.length < 3) return
    const profile = await this.loadProfile(studentId)
    if (!profile.rapport.hooks.includes(clean)) {
      profile.rapport.hooks.unshift(clean)
      profile.rapport.hooks = profile.rapport.hooks.slice(0, 12)
      await this.saveProfile(profile)
    }
  }

  /** Обновить характер общения по итогам живого сигнала. */
  async updateRapport(
    studentId: string,
    patch: {
      engagement?: number
      attention?: number
      frustrationSpike?: boolean
      encouragementHelped?: boolean
      pace?: PreferredPace
    },
  ): Promise<void> {
    const profile = await this.loadProfile(studentId)
    const r = profile.rapport
    if (patch.engagement != null) r.avgEngagement = ewma(r.avgEngagement, clamp01(patch.engagement), 0.2)
    if (patch.attention != null) r.avgAttention = ewma(r.avgAttention, clamp01(patch.attention), 0.2)
    if (patch.frustrationSpike) r.sensitivity = ewma(r.sensitivity, 1, 0.25)
    else if (patch.frustrationSpike === false) r.sensitivity = ewma(r.sensitivity, 0, 0.05)
    if (patch.encouragementHelped != null) {
      r.encouragementResponsiveness = ewma(r.encouragementResponsiveness, patch.encouragementHelped ? 1 : 0, 0.2)
    }
    if (patch.pace) r.preferredPace = patch.pace
    await this.saveProfile(profile)
  }

  async recordSession(record: SessionRecord): Promise<void> {
    this.memSessions.push(record)

    const profile = await this.loadProfile(record.studentId)
    profile.rapport.sessionCount += 1
    profile.rapport.avgAttention = ewma(profile.rapport.avgAttention, clamp01(record.avgAttention), 0.3)
    await this.saveProfile(profile)

    const db = await this.openDb()
    if (!db) return
    try {
      const tx = db.transaction(STORE_SESSION, 'readwrite')
      tx.objectStore(STORE_SESSION).put(record)
      await idbRequest(tx.objectStore(STORE_SESSION).get(record.id))
    } catch {
      /* in-memory только */
    }
  }

  async recentSessions(studentId: string, limit = 10): Promise<SessionRecord[]> {
    const db = await this.openDb()
    if (db) {
      try {
        const tx = db.transaction(STORE_SESSION, 'readonly')
        const idx = tx.objectStore(STORE_SESSION).index('byStudent')
        const all = await idbRequest<SessionRecord[]>(idx.getAll(studentId))
        return all.sort((a, b) => b.startedMs - a.startedMs).slice(0, limit)
      } catch {
        /* fall through */
      }
    }
    return this.memSessions
      .filter((s) => s.studentId === studentId)
      .sort((a, b) => b.startedMs - a.startedMs)
      .slice(0, limit)
  }

  /** Слабые темы (mastery ниже порога) — для адресного повторения. */
  async weakTopics(studentId: string, threshold = 0.5, limit = 5): Promise<TopicMastery[]> {
    const profile = await this.loadProfile(studentId)
    return Object.values(profile.mastery)
      .filter((m) => m.mastery < threshold)
      .sort((a, b) => a.mastery - b.mastery)
      .slice(0, limit)
  }
}

/** Единый экземпляр памяти на приложение. */
export const studentMemory = new StudentMemoryStore()
