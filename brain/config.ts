/**
 * Настройки «мозга» ИИ-учителя ATOMLAB.
 *
 * Данные — BRAIN_DATA_DIR (по умолчанию %USERPROFILE%\Desktop\atomlab-brain-data):
 *   journal/   — главная база и диалоги, ТОЛЬКО дописывание в конец (brain/kb/storage.ts → appendLine);
 *   students/  — события учеников, только дописывание;
 *   derived/   — всё, что пересобирается (индексы, векторы) — единственная перезаписываемая папка;
 *   config.json — модели и пороги (создаётся с умолчаниями, если его нет; правится владельцем вручную).
 */
import fs from 'node:fs'
import path from 'node:path'

export const SERVICE = 'atomlab-brain'
export const VERSION = '1.0.0'
export const CONTRACT = 1

export const PORT = Number(process.env.BRAIN_PORT || 8787)

export function defaultDataDir(): string {
  const home = process.env.USERPROFILE || process.env.HOME || '.'
  return path.join(home, 'Desktop', 'atomlab-brain-data')
}

export const DATA_DIR = path.resolve(process.env.BRAIN_DATA_DIR || defaultDataDir())

export type BrainConfig = {
  /** Версия схемы умолчаний: старый config.json (без неё) мигрируется в памяти — см. CONFIG_MIGRATIONS. */
  configVersion: number
  ollamaUrl: string
  /** Модели для ответов — по порядку предпочтения (первая найденная в /api/tags). */
  chatModels: string[]
  /** Быстрые модели: live-режим и классификация спорных вопросов. */
  fastModels: string[]
  embedModel: string
  /** Как часто спрашивать Ollama /api/tags (мс). */
  pollMs: number
  thresholds: { high: number; medium: number; schoolMin: number }
  hybrid: { wBm: number; wVec: number; mmrLambda: number; topK: number; maxChars: number; vecPool: number }
  timeouts: { firstTokenMs: number; liveFirstTokenMs: number; totalMs: number; classifyMs: number; embedMs: number; translateMs: number }
  numPredict: { brief: number; more: number; live: number }
  wordLimits: { brief: number; more: number; live: number }
  temperature: { chat: number; calc: number }
  /** Отбор токенов: узкий top-k/top-p и лёгкий штраф повторов — меньше срывов qwen на китайский и зацикливаний. */
  sampling: { topK: number; topP: number; repeatPenalty: number }
  /** Одно окно для всех вызовов модели: другое num_ctx заставляет Ollama перезагрузить модель и теряет кеш префикса. */
  numCtx: number
  /** Сколько Ollama держит модели в памяти после запроса; сервер продлевает его, пока работает (keepAliveRefreshMs). */
  keepAlive: string
  keepAliveRefreshMs: number
  /**
   * Бюджет подсказки: найденное и история идут в конец (после неизменной персоны) и ограничены.
   * chatChars — длина переменной части в чате (справка + знания): меньше — быстрее первое слово (≈ 2,5 симв./ток., 25–50 ток/с).
   */
  prompt: { chatItems: number; chatChars: number; liveItems: number; liveChars: number; historyMessages: number; historyChars: number }
  /**
   * Прогрев чат-модели персонами языков (по очереди, в фоне, когда /health уже отвечает): первый вопрос на uz/en не
   * упирается в загрузку модели. ru — первым (самый частый язык готов раньше всех); при OLLAMA_NUM_PARALLEL ≥ 3 каждая
   * персона остаётся в своём слоте кеша, при одном слоте в кеше остаётся последняя (чужая персона — +5–10 с, не тайм-аут).
   */
  warmLangs: ('ru' | 'uz' | 'en')[]

  // ——— блок SERVER: публичный сервер (туннель Tailscale Funnel), очередь LLM, лимиты, CORS, админ, профиль ———
  /**
   * Профиль железа: 'laptop' — процессор без GPU (очередь 1, keep_alive с продлением); 'gpu' — ПК с видеокартой
   * (очередь 4, keep_alive навсегда, окно 8192). Профиль меняет только значения, равные умолчаниям (см. applyProfile);
   * env BRAIN_PROFILE важнее файла.
   */
  profile: 'laptop' | 'gpu'
  /**
   * Очередь к модели: parallel — сколько ответов генерируется одновременно (0 — по профилю: laptop 1, gpu 4);
   * queueCap — сколько учеников может ждать; queueWaitMs — дольше ждать нельзя → честный запасной путь (reason 'busy').
   */
  llm: { parallel: number; queueCap: number; queueWaitMs: number }
  /**
   * Ключ админа (заголовок X-Brain-Admin) для /kb/append, /kb/stats, /admin/*. Пусто — админ только с этого же ПК
   * напрямую (loopback без заголовков прокси). На сервере для всех — задать при установке; env BRAIN_ADMIN_TOKEN важнее.
   */
  adminToken: string
  server: {
    /** Разрешённые Origin сайта (CORS); чужой Origin → 403. */
    corsOrigins: string[]
    /** Разрешать http://localhost:* и http://127.0.0.1:* (разработка сайта). */
    corsLocalhost: boolean
    /** Читать адрес ученика из X-Forwarded-For — только если запрос пришёл с loopback (туннель на этом ПК). */
    trustProxy: boolean
    /** Лимиты запроса: тело (байт), сообщений в истории, символов в сообщении. */
    bodyLimitBytes: number
    maxMessages: number
    maxMessageChars: number
    /** Сколько потоков /chat один ученик держит одновременно. */
    chatStreamsPerClient: number
    /** Частота запросов на ученика (окна: минута и сутки). exemptLocal — владелец с этого ПК без прокси не ограничен. */
    rate: { chatPerMin: number; chatPerDay: number; healthPerMin: number; otherPerMin: number; exemptLocal: boolean }
    /** Журнал диалогов: 'all' — все; 'local' — только с этого ПК (ученики из интернета не пишутся); 'off' — никакие. */
    dialogLog: 'all' | 'local' | 'off'
  }
}

export const DEFAULT_CONFIG: BrainConfig = {
  configVersion: 3,
  ollamaUrl: 'http://127.0.0.1:11434',
  chatModels: ['qwen2.5:7b-instruct', 'qwen2.5:7b', 'qwen2.5:14b-instruct', 'qwen2.5:3b-instruct'],
  fastModels: ['qwen2.5:3b-instruct', 'qwen2.5:3b', 'qwen2.5:1.5b-instruct'],
  embedModel: 'bge-m3',
  pollMs: 60_000,
  thresholds: { high: 0.55, medium: 0.35, schoolMin: 6 },
  hybrid: { wBm: 0.55, wVec: 0.45, mmrLambda: 0.7, topK: 6, maxChars: 5000, vecPool: 200 },
  // Под Snapdragon X Elite / 16 ГБ без GPU (замер 11.10): qwen2.5 7b читает подсказку ~25–50 ток/с, пишет ~10 ток/с;
  // 3b — ~95 ток/с и ~20 ток/с. Первый токен чата после прогрева 5–15 с; 45 с — запас на холодную модель и длинную историю.
  timeouts: { firstTokenMs: 45_000, liveFirstTokenMs: 8000, totalMs: 120_000, classifyMs: 2500, embedMs: 1500, translateMs: 30_000 },
  numPredict: { brief: 300, more: 700, live: 140 },
  wordLimits: { brief: 150, more: 300, live: 70 },
  temperature: { chat: 0.2, calc: 0.1 },
  // штраф повторов > 1 толкает qwen с повторяющихся кириллических токенов на китайские — выключен (1.0)
  sampling: { topK: 20, topP: 0.8, repeatPenalty: 1.0 },
  numCtx: 4096,
  keepAlive: '2h',
  keepAliveRefreshMs: 15 * 60_000,
  // переменная часть подсказки читается заново каждый раз (~2,5 симв./ток., 25–50 ток/с): 600 симв. ≈ 240 ток. ≈ 5–10 с
  prompt: { chatItems: 3, chatChars: 600, liveItems: 1, liveChars: 300, historyMessages: 2, historyChars: 300 },
  warmLangs: ['ru', 'uz', 'en'],

  // ——— блок SERVER (см. тип выше) ———
  profile: 'laptop',
  // 0 — по профилю; ждать дольше 20 с нельзя: сайт ждёт первый кусок ответа 50 с, а модели ещё нужно время
  llm: { parallel: 0, queueCap: 40, queueWaitMs: 20_000 },
  adminToken: '',
  server: {
    corsOrigins: ['https://sadykoffalan2105-dev.github.io'],
    corsLocalhost: true,
    trustProxy: true,
    bodyLimitBytes: 64 * 1024,
    maxMessages: 12,
    maxMessageChars: 4000,
    chatStreamsPerClient: 2,
    rate: { chatPerMin: 8, chatPerDay: 120, healthPerMin: 120, otherPerMin: 60, exemptLocal: true },
    dialogLog: 'all',
  },
}

/**
 * Миграция старого config.json (создан со старыми умолчаниями, без configVersion): значения, равные СТАРОМУ умолчанию,
 * заменяются новыми. Файл владельца не переписывается; его явные правки (не равные старому умолчанию) сохраняются.
 */
export const CONFIG_MIGRATIONS: { version: number; path: string; old: unknown }[] = [
  { version: 2, path: 'timeouts.firstTokenMs', old: 4000 },
  { version: 2, path: 'timeouts.liveFirstTokenMs', old: 2500 },
  { version: 2, path: 'timeouts.totalMs', old: 60_000 },
  { version: 2, path: 'timeouts.classifyMs', old: 1500 },
  { version: 2, path: 'timeouts.translateMs', old: 15_000 },
  { version: 2, path: 'numPredict.brief', old: 350 },
  { version: 2, path: 'numPredict.more', old: 800 },
  { version: 2, path: 'numPredict.live', old: 220 },
  { version: 2, path: 'numCtx', old: 8192 },
  { version: 2, path: 'temperature.chat', old: 0.3 },
  { version: 3, path: 'prompt.chatChars', old: 750 },
]

function getPath(o: unknown, p: string): unknown {
  return p.split('.').reduce<unknown>((a, k) => (a && typeof a === 'object' ? (a as Record<string, unknown>)[k] : undefined), o)
}

function setPath(o: Record<string, unknown>, p: string, v: unknown): void {
  const ks = p.split('.')
  let cur = o
  for (const k of ks.slice(0, -1)) {
    cur[k] = { ...(cur[k] as Record<string, unknown>) }
    cur = cur[k] as Record<string, unknown>
  }
  cur[ks[ks.length - 1]!] = v
}

/** Применить миграции к уже слитому конфигу; fileVersion — configVersion из файла (0, если его нет). */
export function migrateConfig(cfg: BrainConfig, fileVersion: number): { cfg: BrainConfig; changed: string[] } {
  const out = structuredClone(cfg) as unknown as Record<string, unknown>
  const changed: string[] = []
  for (const m of CONFIG_MIGRATIONS) {
    if (fileVersion >= m.version) continue
    if (getPath(out, m.path) === m.old) {
      const next = getPath(DEFAULT_CONFIG, m.path)
      setPath(out, m.path, next)
      changed.push(`${m.path}: ${String(m.old)} → ${String(next)}`)
    }
  }
  out.configVersion = DEFAULT_CONFIG.configVersion
  return { cfg: out as unknown as BrainConfig, changed }
}

export const DIRS = {
  root: DATA_DIR,
  journal: path.join(DATA_DIR, 'journal'),
  students: path.join(DATA_DIR, 'students'),
  derived: path.join(DATA_DIR, 'derived'),
}

export const FILES = {
  kbJournal: path.join(DIRS.journal, 'kb-journal.jsonl'),
  dialogs: path.join(DIRS.journal, 'dialogs.jsonl'),
  config: path.join(DATA_DIR, 'config.json'),
  bm25: path.join(DIRS.derived, 'bm25-journal.json'),
}

export function ensureDataDirs(): void {
  for (const d of [DIRS.root, DIRS.journal, DIRS.students, DIRS.derived, path.join(DIRS.derived, 'embeddings')]) {
    fs.mkdirSync(d, { recursive: true })
  }
}

function merge<T extends Record<string, unknown>>(base: T, over: unknown): T {
  if (!over || typeof over !== 'object') return base
  const out: Record<string, unknown> = { ...base }
  for (const [k, v] of Object.entries(over as Record<string, unknown>)) {
    const b = (base as Record<string, unknown>)[k]
    if (b && typeof b === 'object' && !Array.isArray(b) && v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = merge(b as Record<string, unknown>, v)
    } else if (v !== undefined && (b === undefined || typeof v === typeof b)) out[k] = v
  }
  return out as T
}

/** config.json: создаётся с умолчаниями, если его нет; env OLLAMA_URL / BRAIN_OLLAMA_POLL_MS важнее файла. */
export function loadConfig(): BrainConfig {
  ensureDataDirs()
  let cfg = DEFAULT_CONFIG
  if (fs.existsSync(FILES.config)) {
    try {
      const raw = JSON.parse(fs.readFileSync(FILES.config, 'utf8')) as Record<string, unknown>
      const fileVersion = typeof raw.configVersion === 'number' ? raw.configVersion : 0
      const mig = migrateConfig(merge(DEFAULT_CONFIG, raw), fileVersion)
      cfg = mig.cfg
      if (mig.changed.length) console.log(`[brain] config.json v${fileVersion} → умолчания v${DEFAULT_CONFIG.configVersion} (в памяти, файл не меняется): ${mig.changed.join(', ')}`)
    } catch (err) {
      console.warn('[brain] config.json не читается, беру умолчания:', (err as Error).message)
    }
  } else {
    fs.writeFileSync(FILES.config, JSON.stringify(DEFAULT_CONFIG, null, 2) + '\n', { flag: 'wx' })
  }
  if (process.env.OLLAMA_URL) cfg = { ...cfg, ollamaUrl: process.env.OLLAMA_URL }
  if (process.env.BRAIN_OLLAMA_POLL_MS) cfg = { ...cfg, pollMs: Number(process.env.BRAIN_OLLAMA_POLL_MS) || cfg.pollMs }
  return cfg
}

// ——— блок SERVER: профиль железа ———

/** Что меняет профиль 'gpu' (только там, где в конфиге стоит умолчание 'laptop' — явные правки владельца важнее). */
export const GPU_PROFILE: { path: string; value: unknown }[] = [
  // модель живёт в видеопамяти всегда: продлевать keep_alive не нужно ('-1m' — отрицательная длительность = навсегда)
  { path: 'keepAlive', value: '-1m' },
  { path: 'keepAliveRefreshMs', value: 0 },
  { path: 'numCtx', value: 8192 },
  { path: 'llm.queueWaitMs', value: 30_000 },
  // на сервере для всех запрос «без прокси» не считается владельцем: туннель без X-Forwarded-For не снимет лимиты
  { path: 'server.rate.exemptLocal', value: false },
]

/**
 * Итоговый конфиг с учётом профиля (env BRAIN_PROFILE важнее файла) и env BRAIN_ADMIN_TOKEN.
 * llm.parallel = 0 → по профилю (laptop 1, gpu 4). Идемпотентно: повторный вызов ничего не меняет.
 */
export function applyProfile(cfg: BrainConfig): BrainConfig {
  const env = process.env.BRAIN_PROFILE
  const profile: BrainConfig['profile'] = env === 'gpu' || env === 'laptop' ? env : cfg.profile === 'gpu' ? 'gpu' : 'laptop'
  const out = structuredClone(cfg) as unknown as Record<string, unknown>
  out.profile = profile
  if (profile === 'gpu') {
    for (const p of GPU_PROFILE) if (getPath(out, p.path) === getPath(DEFAULT_CONFIG, p.path)) setPath(out, p.path, p.value)
  }
  const res = out as unknown as BrainConfig
  const par = Math.floor(Number(res.llm?.parallel) || 0)
  res.llm = { ...DEFAULT_CONFIG.llm, ...res.llm, parallel: par >= 1 ? Math.min(par, 32) : profile === 'gpu' ? 4 : 1 }
  if (process.env.BRAIN_ADMIN_TOKEN) res.adminToken = process.env.BRAIN_ADMIN_TOKEN
  if (typeof res.adminToken !== 'string') res.adminToken = ''
  const dl = res.server?.dialogLog
  res.server = { ...DEFAULT_CONFIG.server, ...res.server, dialogLog: dl === 'local' || dl === 'off' ? dl : 'all' }
  return res
}
