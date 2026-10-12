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
import { DEFAULT_TEACHER_CONFIG, type TeacherConfig } from './teacher/config.ts' // блок TEACHER (brain/teacher/**)
import type { FeedbackConfig } from './http/feedback.ts'

export const SERVICE = 'atomlab-brain'
export const VERSION = '1.0.0'
export const CONTRACT = 1

export const PORT = Number(process.env.BRAIN_PORT || 8787)

export function defaultDataDir(): string {
  const home = process.env.USERPROFILE || process.env.HOME || '.'
  return path.join(home, 'Desktop', 'atomlab-brain-data')
}

export const DATA_DIR = path.resolve(process.env.BRAIN_DATA_DIR || defaultDataDir())

/** Потолок на один адрес (config.server.rate.perIp): школьный NAT — много учеников за одним адресом. */
export type RatePerIp = {
  chatPerMin: number
  chatPerDay: number
  chatStreams: number
  photoPerMin: number
  photoPerDay: number
  imagePerMin: number
  imagePerDay: number
  healthPerMin: number
  otherPerMin: number
  preflightPerMin: number
}

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
    /**
     * Частота запросов на ученика (окна: минута и сутки). Ученик — адрес + сессия сайта (заголовок X-Brain-Session,
     * brain/http/clientIp.ts); без заголовка ученик = адрес. exemptLocal — владелец с этого ПК без прокси не ограничен.
     * perIp — щедрый потолок на ОДИН адрес (школьный NAT: весь класс за одним адресом), чтобы смена сессий не обходила
     * защиту: chat/photo/image — запросы в минуту и сутки, chatStreams — одновременных потоков /chat с адреса,
     * health/other — запросы в минуту, preflight — CORS-запросы OPTIONS в минуту (только по адресу: в них нет сессии).
     */
    rate: {
      chatPerMin: number
      chatPerDay: number
      healthPerMin: number
      otherPerMin: number
      exemptLocal: boolean
      perIp: RatePerIp
    }
    /**
     * Журнал диалогов: 'all' — все; 'local' — только с этого ПК (ученики из интернета не пишутся); 'off' — никакие.
     * Умолчание — 'local' (с configVersion 4, docs/COMPLIANCE.md: тексты учеников из интернета не хранятся без решения школы).
     */
    dialogLog: 'all' | 'local' | 'off'
    /** «Сообщить об ошибке» (POST /kb/feedback, brain/http/feedback.ts): лимиты и длины; нет блока — FEEDBACK_DEFAULTS. */
    feedback?: Partial<FeedbackConfig>
    /**
     * Сроки хранения (brain/kb/retention.ts): dialogDays — записи из диалогов (события учеников, записи журнала с
     * пометкой диалога) старше N дней не участвуют в поиске и модели ученика; rotateLogs — журналы dialogs.jsonl и
     * images.jsonl раз в месяц переименовываются в journal/archive/ (журнал знаний kb-journal.jsonl — никогда).
     */
    retention?: { dialogDays?: number; rotateLogs?: boolean }
    /**
     * «Сфотографируй задачу» (brain/http/photo.ts): maxImages — фото в одном сообщении; maxImageBytes — одно фото
     * после декодирования base64; bodyLimitBytes — лимит тела ТОЛЬКО для запросов с фото (без фото — bodyLimitBytes выше);
     * perMin/perDay — отдельный лимит фото-запросов на ученика (модель со зрением дороже текста).
     */
    photo: { maxImages: number; maxImageBytes: number; bodyLimitBytes: number; perMin: number; perDay: number }
  }
  // — блок SOURCES (агент B) —
  /**
   * Поиск «сначала школа» (мозг v2, brain/pipeline/retrieve.ts → retrieveV2). Ярусы: учебник класса ученика (grade) →
   * соседний класс (near, Δ = 1) → дальние классы (far) / ATOMLAB / журнал → энциклопедия (в школьном вопросе — только фон).
   *   tierBoost — множители балла после проверки темы; encyclopediaSchool — Википедия в школьном вопросе, encyclopediaBroad — в широком;
   *   maxEncyclopediaSchool — сколько фрагментов энциклопедии/указателя допускается в школьном ответе (и не выше 3-го места);
   *   weakTermMinTf — в коротком вопросе совпавший терм должен встретиться в тексте ≥ N раз или в заголовке;
   *   topicWeight / formulaWeight / glossaryWeight — веса темы диалога, формул-сущностей и русских термов глоссария (uz/en) в поиске журнала;
   *   minMmrChars — нижняя граница бюджета MMR (символы), чтобы при маленькой подсказке ноутбука осталось ≥ 3 фрагментов для цитат и запасного пути.
   */
  retrievalV2: {
    tierBoost: { grade: number; near: number; far: number; atomlab: number; journal: number; encyclopediaSchool: number; encyclopediaBroad: number; index: number }
    maxEncyclopediaSchool: number
    weakTermMinTf: number
    topicWeight: number
    formulaWeight: number
    glossaryWeight: number
    minMmrChars: number
    /** учебник класса ученика ставится первым, только если его балл ≥ этой доли от лучшего фрагмента */
    tier1MinShare: number
  }
  // — конец блока SOURCES —
  // — блок DIALOG (агент A) —
  /**
   * Мозг v2, диалог: профиль железа (laptop — CPU, gpu — сервер с видеокартой; auto — по /api/ps size_vram),
   * классы длины ответа и бюджеты подсказки по профилю. Профили различаются только числами.
   */
  dialog: DialogConfig
  // — блок IMAGE (картинки, brain/image/**) —
  /** «Нарисовать»: ComfyUI на той же видеокарте, что Gemma (окно GPU — brain/llm/gpuArbiter.ts). По умолчанию выключено. */
  image: ImageConfig
  // — блок STT (распознавание речи, brain/stt/**) —
  /** Голос ученика → текст: сайдкар Python на 127.0.0.1:8788 (GigaAM ru/uz, whisper en). Нет сайдкара — /stt честно 503. */
  stt: SttConfig
  // — блок TEACHER (автоматизация учителя v1, brain/teacher/**): план урока, тест СОР/СОЧ, проверка работ (рекомендация) —
  teacher?: TeacherConfig
}

// — блок STT (распознавание речи) —
/**
 * /stt (brain/stt/route.ts): sidecarUrl — сайдкар atomlab-stt (env BRAIN_STT_URL важнее файла); maxSeconds — длина
 * аудио; maxBodyBytes — тело запроса; rate — лимиты на сессию сайта (финальные и partial раздельно) и потолок на адрес;
 * timeoutMs — сколько ждать сайдкар (дальше 503 stt_unavailable).
 */
export type SttConfig = {
  enabled: boolean
  sidecarUrl: string
  maxSeconds: number
  maxBodyBytes: number
  rate: { sessionPerMin: number; sessionPerDay: number; partialPerMin: number; ipPerMin: number }
  timeoutMs: number
}

// — блок IMAGE (картинки) —
export type ImageEngine = 'z-image-turbo' | 'flux2-klein-4b'
export type ImageVariant = 'int8' | 'bf16' | 'nvfp4' | 'fp8'
/**
 * Картинки (brain/README.md, раздел «Картинки»). Установщик сервера пишет enabled, engine, variant, comfyUrl,
 * comfyOutputDir, students.enabled, teacherTokens; остальное — умолчания ниже (владелец правит config.json).
 */
export type ImageConfig = {
  enabled: boolean
  engine: ImageEngine
  /** z-image-turbo: int8 | bf16 | nvfp4; flux2-klein-4b: fp8 */
  variant: ImageVariant
  /** адрес ComfyUI (env BRAIN_COMFY_URL важнее) и как часто проверять его готовность */
  comfyUrl: string
  comfyPollMs: number
  /**
   * папка вывода ComfyUI (C:\ATOMLAB\comfy-out) — для сведения: мозг файлы НЕ удаляет (в brain/** нет удалений,
   * проверка brain:smoke), старые PNG чистит задача установщика «ATOMLAB Comfy»
   */
  comfyOutputDir: string
  /** 0 — по движку (z-image 8, klein 4) */
  steps: number
  sizes: { square: [number, number]; wide: [number, number]; tall: [number, number] }
  /**
   * ученики: выключены по умолчанию; только пресеты своего класса ±gradeWindow (решение владельца: свой текст ученикам
   * нельзя никогда — presetsOnly оставлен для совместимости, roles.ts его не ослабляет); свой порог классификатора;
   * perHour/perDay — свои лимиты картинок на ученика (адрес + сессия), строже общих rate.perMin/perDay; 0 — без своего лимита
   */
  /** freeText — ученикам (и всем без ключа) можно свой текст: обязательна проверка Gemma (llmCheck) и строгий порог классификатора */
  students: { enabled: boolean; presetsOnly: boolean; freeText?: boolean; schoolOnly?: boolean; nsfwThreshold: number; gradeWindow: number; perHour?: number; perDay?: number }
  /** ключи учителя (поле teacherKey в теле запроса), каждый ≥ 16 символов */
  teacherTokens: string[]
  freeText: { owner: boolean; teacher: boolean }
  /** проверка/перевод свободного запроса Gemma (строгий JSON) */
  llmCheck: boolean
  rate: { perMin: number; perDay: number; globalPerMin: number; queueCap: number; perClientQueued: number }
  jobTimeoutMs: number
  /** окно GPU: сколько картинок за одно переключение, сколько ждать текст, когда снова пускать картинки */
  window: { maxJobs: number; maxMs: number; drainMaxMs: number; maxStarvationMs: number; cooldownMs: number; reloadWaitMs: number; unloadWaitMs: number }
  /** классификатор готовой картинки (узел ATOMLABSafetyCheck): обязателен; порог для владельца и учителя */
  safety: { required: boolean; nsfwThreshold: number }
  result: { quality: number; cacheTtlMs: number; cacheMaxBytes: number }
  /** сколько видеопамяти (ГБ) нужно движку — ключ «engine:variant» */
  vramNeedGB: Record<string, number>
}

// — блок DIALOG (агент A) —
export type DialogProfileConfig = { historyMessages: number; historyChars: number; knowledgeChars: number; knowledgeItems: number; numPredictLong: number; numCtx?: number }
export type DialogConfig = {
  profile: 'auto' | 'laptop' | 'gpu'
  /** false — слать Ollama think:false моделям с «мышлением» (qwen3) — без скрытых рассуждений и задержки */
  think: boolean
  /** бюджет переписывания реплики быстрой моделью и проверочного прохода (только gpu), мс */
  rewriteMs: number
  verifyMs: number
  /** классы длины: [мин, макс] слов */
  lengthWords: { tiny: [number, number]; short: [number, number]; normal: [number, number]; long: [number, number] }
  numPredictByClass: { tiny: number; short: number; normal: number; long: number }
  gpu: DialogProfileConfig
  laptop: DialogProfileConfig
  /** длина блока ДИАЛОГ в подсказке */
  dialogBlockChars: number
  /** после скольких реплик строить сжатую сводку истории */
  summaryAfterTurns: number
}

export const DEFAULT_CONFIG: BrainConfig = {
  configVersion: 4,
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
    // на ученика (адрес + сессия сайта); perIp — потолок адреса: класс из 30 учеников за одним адресом школы проходит
    rate: {
      chatPerMin: 8,
      chatPerDay: 120,
      healthPerMin: 120,
      otherPerMin: 60,
      exemptLocal: true,
      perIp: { chatPerMin: 240, chatPerDay: 4000, chatStreams: 60, photoPerMin: 60, photoPerDay: 900, imagePerMin: 20, imagePerDay: 400, healthPerMin: 1200, otherPerMin: 600, preflightPerMin: 600 },
    },
    // 'local' — ученики из интернета в журнал диалогов не пишутся (ЗРУ-547, ЗРУ-444; docs/COMPLIANCE.md)
    dialogLog: 'local',
    retention: { dialogDays: 90, rotateLogs: true },
    // фото сжимает сайт (≤ 1280 px, JPEG 0,8 — обычно 150–400 КБ); 1,5 МБ — запас на чужие клиенты
    photo: { maxImages: 2, maxImageBytes: 1_572_864, bodyLimitBytes: 4 * 1024 * 1024, perMin: 3, perDay: 30 },
  },
  // — блок SOURCES (агент B) —
  retrievalV2: {
    tierBoost: { grade: 1.3, near: 1.0, far: 0.9, atomlab: 1.05, journal: 1.0, encyclopediaSchool: 0.55, encyclopediaBroad: 1.0, index: 0.7 },
    maxEncyclopediaSchool: 1,
    weakTermMinTf: 2,
    topicWeight: 0.6,
    formulaWeight: 1.5,
    glossaryWeight: 0.75,
    minMmrChars: 3600,
    tier1MinShare: 0.6,
  },
  // — конец блока SOURCES —
  // — блок DIALOG (агент A) —
  dialog: {
    profile: 'auto',
    think: false,
    rewriteMs: 2500,
    verifyMs: 4000,
    lengthWords: { tiny: [15, 40], short: [40, 90], normal: [90, 160], long: [160, 300] },
    numPredictByClass: { tiny: 80, short: 180, normal: 320, long: 650 },
    gpu: { historyMessages: 8, historyChars: 900, knowledgeChars: 2400, knowledgeItems: 6, numPredictLong: 900, numCtx: 8192 },
    laptop: { historyMessages: 2, historyChars: 300, knowledgeChars: 600, knowledgeItems: 3, numPredictLong: 650 },
    dialogBlockChars: 220,
    summaryAfterTurns: 6,
  },
  // — блок IMAGE (картинки): выключено; сервер с видеокартой включает через config.json (установщик) —
  image: {
    enabled: false,
    engine: 'z-image-turbo',
    variant: 'int8',
    comfyUrl: 'http://127.0.0.1:8188',
    comfyPollMs: 60_000,
    comfyOutputDir: '',
    steps: 0,
    sizes: { square: [1024, 1024], wide: [1216, 832], tall: [832, 1216] },
    students: { enabled: false, presetsOnly: true, freeText: false, nsfwThreshold: 0.3, gradeWindow: 1, perHour: 5, perDay: 12 },
    teacherTokens: [],
    freeText: { owner: true, teacher: true },
    llmCheck: true,
    rate: { perMin: 2, perDay: 20, globalPerMin: 6, queueCap: 8, perClientQueued: 1 },
    jobTimeoutMs: 120_000,
    window: { maxJobs: 2, maxMs: 30_000, drainMaxMs: 45_000, maxStarvationMs: 60_000, cooldownMs: 8000, reloadWaitMs: 15_000, unloadWaitMs: 10_000 },
    safety: { required: true, nsfwThreshold: 0.5 },
    result: { quality: 85, cacheTtlMs: 600_000, cacheMaxBytes: 64 * 1024 * 1024 },
    vramNeedGB: { 'z-image-turbo:int8': 10.5, 'z-image-turbo:bf16': 13, 'z-image-turbo:nvfp4': 8, 'flux2-klein-4b:fp8': 10 },
  },
  // — блок STT (распознавание речи): без сайдкара /stt отвечает 503 за миллисекунды, сайт уходит на Web Speech —
  stt: {
    enabled: true,
    sidecarUrl: 'http://127.0.0.1:8788',
    maxSeconds: 25,
    maxBodyBytes: 1_048_576,
    // школьный NAT: 30 учеников за одним адресом — потолок по адресу щедрый, основной лимит — по сессии сайта
    rate: { sessionPerMin: 30, sessionPerDay: 600, partialPerMin: 60, ipPerMin: 300 },
    timeoutMs: 15_000,
  },
  // — блок TEACHER (brain/teacher/config.ts): ключи учителей, свои лимиты, шлифовка LLM —
  teacher: DEFAULT_TEACHER_CONFIG,
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
  // v4: журнал диалогов по умолчанию 'local' (соответствие, docs/COMPLIANCE.md). Владелец, которому нужен 'all',
  // пишет в config.json "configVersion": 4 и "server": { "dialogLog": "all" } — явная правка после v4 не мигрирует.
  { version: 4, path: 'server.dialogLog', old: 'all' },
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
  res.server = { ...DEFAULT_CONFIG.server, ...res.server, dialogLog: dl === 'all' || dl === 'off' ? dl : 'local' }
  return res
}
