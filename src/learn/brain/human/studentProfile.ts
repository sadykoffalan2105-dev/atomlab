/**
 * Память учителя об ученике на этом устройстве (localStorage): имя, класс, любимые темы,
 * заметки со слов ученика, прошлые ошибки и предпочтения стиля (👍/👎).
 * Заметки хранятся с пометкой, проверены ли они по данным проекта: слова ученика
 * никогда не выдаются за проверенный факт. «Забыть всё» стирает запись целиком.
 */
export type NoteStatus = 'checked' | 'contradicted' | 'unverified'

export interface StudentNote {
  text: string
  at: number
  /** Откуда: «запомни: …» или поправка «нет, правильно …». */
  kind: 'remember' | 'correction'
  status: NoteStatus
  /** Что показали данные проекта (для спорной заметки). */
  checkedWith?: string
}

export interface TalkEntity {
  kind: 'element' | 'compound' | 'formula'
  /** Символ элемента или формула (ASCII). */
  key: string
  label: string
}

export interface StudentProfile {
  v: 1
  name: string | null
  grade: number | null
  likes: string[]
  notes: StudentNote[]
  mistakes: string[]
  /** −2 … +2: отрицательное — короче, положительное — подробнее. */
  detail: number
  /** −2 … +2: больше примеров. */
  examples: number
  likesCount: number
  dislikesCount: number
  lastEntity: TalkEntity | null
  lastProperty: string | null
  /** Индексы последних выбранных вариантов по намерению (чтобы не повторяться подряд). */
  recent: Record<string, number[]>
  turns: number
  updatedAt: number
}

const KEY = 'atomlab-teacher-human-v1'

export function emptyProfile(): StudentProfile {
  return {
    v: 1,
    name: null,
    grade: null,
    likes: [],
    notes: [],
    mistakes: [],
    detail: 0,
    examples: 0,
    likesCount: 0,
    dislikesCount: 0,
    lastEntity: null,
    lastProperty: null,
    recent: {},
    turns: 0,
    updatedAt: 0,
  }
}

/** Хранилище: localStorage в браузере, память процесса в тестах/приватном режиме. */
export interface ProfileBackend {
  read(): string | null
  write(value: string): void
  clear(): void
}

let memoryValue: string | null = null
const memoryBackend: ProfileBackend = {
  read: () => memoryValue,
  write: (v) => {
    memoryValue = v
  },
  clear: () => {
    memoryValue = null
  },
}

const localBackend: ProfileBackend = {
  read: () => {
    try {
      return typeof localStorage === 'undefined' ? memoryValue : localStorage.getItem(KEY)
    } catch {
      return memoryValue
    }
  },
  write: (v) => {
    memoryValue = v
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, v)
    } catch {
      /* приватный режим — остаётся память вкладки */
    }
  },
  clear: () => {
    memoryValue = null
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(KEY)
    } catch {
      /* ignore */
    }
  },
}

let backend: ProfileBackend = localBackend
let cache: StudentProfile | null = null
const listeners = new Set<(p: StudentProfile) => void>()

/** Для тестов: хранить профиль в памяти процесса. */
export function setMemoryProfileBackend(): void {
  backend = memoryBackend
  cache = null
}

export function loadProfile(): StudentProfile {
  if (cache) return cache
  let parsed: StudentProfile | null = null
  try {
    const raw = backend.read()
    if (raw) {
      const p = JSON.parse(raw) as Partial<StudentProfile>
      if (p && p.v === 1) parsed = { ...emptyProfile(), ...p, recent: p.recent ?? {} } as StudentProfile
    }
  } catch {
    parsed = null
  }
  cache = parsed ?? emptyProfile()
  return cache
}

export function saveProfile(next: StudentProfile): StudentProfile {
  const trimmed: StudentProfile = {
    ...next,
    likes: next.likes.slice(-12),
    notes: next.notes.slice(-40),
    mistakes: next.mistakes.slice(-20),
    updatedAt: Date.now(),
  }
  cache = trimmed
  try {
    backend.write(JSON.stringify(trimmed))
  } catch {
    /* ignore */
  }
  for (const l of listeners) l(trimmed)
  return trimmed
}

export function updateProfile(patch: (p: StudentProfile) => Partial<StudentProfile>): StudentProfile {
  const cur = loadProfile()
  return saveProfile({ ...cur, ...patch(cur) })
}

/** «Забыть всё»: стереть память ученика на этом устройстве. */
export function forgetEverything(): StudentProfile {
  backend.clear()
  cache = emptyProfile()
  for (const l of listeners) l(cache)
  return cache
}

export function subscribeProfile(cb: (p: StudentProfile) => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** Отзыв ученика на ответ: 👍 закрепляет стиль, 👎 сдвигает длину/примеры. */
export function applyFeedback(answer: string, positive: boolean): StudentProfile {
  const words = answer.split(/\s+/).filter(Boolean).length
  const hasExample = /(например|пример|for example|e\.g\.|masalan|misol)/iu.test(answer)
  const clamp = (n: number) => Math.max(-2, Math.min(2, n))
  return updateProfile((p) => {
    if (positive) {
      // Понравился длинный ответ — чуть подробнее; короткий — держим краткость.
      const detail = words > 90 ? clamp(p.detail + 0.5) : words < 45 ? clamp(p.detail - 0.5) : p.detail
      return { likesCount: p.likesCount + 1, detail, examples: hasExample ? clamp(p.examples + 0.5) : p.examples }
    }
    const detail = words > 70 ? clamp(p.detail - 1) : clamp(p.detail + 1)
    return { dislikesCount: p.dislikesCount + 1, detail, examples: hasExample ? p.examples : clamp(p.examples + 1) }
  })
}

/** Предпочтительная подробность ответа по отзывам. */
export function preferredDetail(p: StudentProfile = loadProfile()): 'brief' | 'more' | null {
  if (p.detail >= 1) return 'more'
  if (p.detail <= -1) return 'brief'
  return null
}
