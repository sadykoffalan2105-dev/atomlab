/**
 * Состояние беседы ИИ-учителя на этом устройстве (sessionStorage + память модуля).
 *
 *  • стек тем — последние 5 тем/сущностей, о которых шла речь (для «а почему?», «а он?»);
 *  • режим: chat | quiz | homework; текущий вопрос викторины, счёт, серия верных;
 *  • ожидание уточнения (например, «показать решение?»);
 *  • последние 3 реплики учителя — чтобы не повторять формулировки подряд.
 *
 * Чистый модуль без DOM-зависимостей: в тестах — setDialogBackend(memory).
 */

export type DialogMode = 'chat' | 'quiz' | 'homework'

export interface QuizQuestionState {
  id: string
  /** Текст вопроса на языке ученика. */
  question: string
  /** Опорные слова эталона (на языке ученика, если есть перевод). */
  rubric: string[]
  sampleAnswer: string
  /** Для «после 3 ошибок подряд по теме — разобрать тему заново». */
  topicKey: string
  /** Уже дали подсказку по этому вопросу. */
  hinted: boolean
}

export interface QuizState {
  /** Ключ пула (класс+глава), чтобы не повторять вопросы. */
  poolKey: string
  askedIds: string[]
  current: QuizQuestionState | null
  asked: number
  correct: number
  partial: number
  wrong: number
  streak: number
  /** Подряд неверных по одной теме: [topicKey, count]. */
  wrongTopic: [string, number] | null
  /** Что повторить (темы неверных ответов). */
  toReview: string[]
  /** Ожидаем ответ на «ещё?» (после разбора ответа). */
  awaitingMore: boolean
  /** Викторина «из N вопросов» — завершить сами после N. */
  planned: number | null
}

export interface HomeworkState {
  /** Условие задачи со слов ученика (пусто — ещё не прислал). */
  problem: string
  /** Номер шага наводящих вопросов. */
  step: number
  revealed: boolean
}

export interface DialogState {
  v: 1
  mode: DialogMode
  topics: string[]
  quiz: QuizState | null
  homework: HomeworkState | null
  /** Ожидаем уточнение ученика: ключ предложенного шага. */
  pending: 'offer-step' | 'homework-problem' | null
  lastTeacher: string[]
  /** Порядковый номер хода (для детерминированного выбора фраз). */
  turn: number
  updatedAt: number
}

export function emptyDialogState(): DialogState {
  return { v: 1, mode: 'chat', topics: [], quiz: null, homework: null, pending: null, lastTeacher: [], turn: 0, updatedAt: 0 }
}

export interface DialogBackend {
  read(): string | null
  write(value: string): void
  clear(): void
}

const KEY = 'atomlab-teacher-dialog-v1'

let memoryValue: string | null = null
export const memoryDialogBackend: DialogBackend = {
  read: () => memoryValue,
  write: (v) => {
    memoryValue = v
  },
  clear: () => {
    memoryValue = null
  },
}

const sessionBackend: DialogBackend = {
  read: () => {
    try {
      return typeof sessionStorage === 'undefined' ? memoryValue : sessionStorage.getItem(KEY)
    } catch {
      return memoryValue
    }
  },
  write: (v) => {
    memoryValue = v
    try {
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(KEY, v)
    } catch {
      /* приватный режим — остаётся память вкладки */
    }
  },
  clear: () => {
    memoryValue = null
    try {
      if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(KEY)
    } catch {
      /* ignore */
    }
  },
}

let backend: DialogBackend = sessionBackend
let cache: DialogState | null = null

/** Для тестов: хранить состояние в памяти процесса (или своё хранилище). */
export function setDialogBackend(next: DialogBackend | 'memory' | 'session'): void {
  backend = next === 'memory' ? memoryDialogBackend : next === 'session' ? sessionBackend : next
  cache = null
}

export function loadDialog(): DialogState {
  if (cache) return cache
  let parsed: DialogState | null = null
  try {
    const raw = backend.read()
    if (raw) {
      const p = JSON.parse(raw) as Partial<DialogState>
      if (p && p.v === 1) parsed = { ...emptyDialogState(), ...p, topics: p.topics ?? [], lastTeacher: p.lastTeacher ?? [] }
    }
  } catch {
    parsed = null
  }
  cache = parsed ?? emptyDialogState()
  return cache
}

export function saveDialog(next: DialogState): DialogState {
  const trimmed: DialogState = { ...next, topics: next.topics.slice(-5), lastTeacher: next.lastTeacher.slice(-3), updatedAt: Date.now() }
  cache = trimmed
  try {
    backend.write(JSON.stringify(trimmed))
  } catch {
    /* ignore */
  }
  return trimmed
}

export function updateDialog(patch: (d: DialogState) => Partial<DialogState>): DialogState {
  const cur = loadDialog()
  return saveDialog({ ...cur, ...patch(cur) })
}

export function resetDialog(): DialogState {
  backend.clear()
  cache = emptyDialogState()
  return cache
}

/** Запомнить тему разговора (последние 5, без дублей). */
export function pushTopic(topic: string): void {
  const t = topic.trim()
  if (!t) return
  updateDialog((d) => ({ topics: [...d.topics.filter((x) => x.toLowerCase() !== t.toLowerCase()), t].slice(-5) }))
}

export function currentTopic(): string | null {
  const d = loadDialog()
  return d.topics[d.topics.length - 1] ?? null
}

/** Запомнить реплику учителя (чтобы не повторять формулировку подряд). */
export function rememberTeacherLine(text: string): void {
  updateDialog((d) => ({ lastTeacher: [...d.lastTeacher, text].slice(-3), turn: d.turn + 1 }))
}

/**
 * Выбрать вариант фразы, не совпадающий с последними репликами учителя.
 * Детерминирован по номеру хода: тесты воспроизводимы, а подряд фразы разные.
 */
export function pickFresh(pool: readonly string[], salt = 0): string {
  if (!pool.length) return ''
  const d = loadDialog()
  const recent = d.lastTeacher
  const start = (d.turn + salt) % pool.length
  for (let i = 0; i < pool.length; i++) {
    const candidate = pool[(start + i) % pool.length]!
    if (!recent.some((r) => r.startsWith(candidate.slice(0, 24)))) return candidate
  }
  return pool[start]!
}
