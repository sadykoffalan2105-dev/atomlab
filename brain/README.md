# Мозг ИИ-учителя ATOMLAB (локальный сервер)

Свой «мозг» учителя на ПК владельца: HTTP-сервер `http://127.0.0.1:8787` (контракт v1), база знаний в папке
`C:\Users\Первый\Desktop\atomlab-brain-data`, LLM — через Ollama (qwen2.5 7b/3b + bge-m3). **Без Ollama всё тоже
работает**: поиск по учебникам и базе + точные расчёты + шаблоны рассуждения (без «нет в базе»); как только
Ollama появляется, сервер сам переключается на LLM (опрос `/api/tags` раз в 60 с) — перезапуск не нужен.

## Запуск

```powershell
cd C:\Users\Первый\Desktop\химия
npm run brain:corpus   # первый раз: собрать базу (≈ 2 мин; повторный запуск дописывает только новое)
npm run brain:embed    # эмбеддинги bge-m3 (нужна Ollama; без неё честно пропускается), можно прерывать
npm run brain:start    # сервер: «atomlab-brain http://127.0.0.1:8787, llm: …, kb: N docs»
```

Проверка: http://127.0.0.1:8787/health → `{"ok":true,…}`. Сайт (GitHub Pages) в чате учителя покажет
«Локальный мозг: подключён». Окно PowerShell оставить открытым (или задача в Планировщике «при входе»:
`cmd /k cd /d C:\Users\Первый\Desktop\химия && npm run brain:start`).

| команда | что делает |
|---|---|
| `npm run brain:start` | сервер (порт слушается сразу, знания догружаются в фоне ≈ 5 с; `/chat` ждёт загрузки) |
| `npm run brain:corpus` | учебники Kimyo 7–11, указатель, карточки ATOMLAB, qaBank, учёные, megaPack, химическая Википедия → журнал (`--only=…`, `--skip=wiki`, `--dry`) |
| `npm run brain:embed` | векторы bge-m3 в `derived/embeddings/` (`--only=school`, `--limit=N`); возобновляемо, печатает ETA |
| `npm run brain:eval` | 177 контрольных вопросов по 10 категориям (в т. ч. `obtain` — «как получить X» с проверкой уравнений) через HTTP; `-- --inproc` без сервера, `-- --mock-llm` с подменой Ollama, `-- --ids=ob01,tr12` выборочно, `-- --fails` / `--verbose` |
| `npm run brain:selftest` | юнит-проверки без LLM: тема найденного, способы получения, падежи названий, ложный мат |
| `npm run brain:probe -- "вопрос" --why` | что находит поиск: источники, баллы, уверенность; `--why` — что отброшено проверкой темы и почему |
| `npm run brain:smoke` | живая проверка контракта на временной папке: /health, CORS, SSE, R1/R2, /kb/append, появление «Ollama», эмбеддинги, обрыв клиента |

## Переменные среды

| переменная | по умолчанию | смысл |
|---|---|---|
| `BRAIN_PORT` | `8787` | порт сервера |
| `BRAIN_DATA_DIR` | `%USERPROFILE%\Desktop\atomlab-brain-data` | папка данных |
| `OLLAMA_URL` | `http://127.0.0.1:11434` | адрес Ollama |
| `BRAIN_OLLAMA_POLL_MS` | `60000` | как часто спрашивать Ollama о моделях |

Модели, пороги, таймауты, лимиты слов — `atomlab-brain-data\config.json` (создаётся с умолчаниями; правится вручную).

## Данные (append-only)

```
atomlab-brain-data\
  journal\kb-journal.jsonl   главная база — ТОЛЬКО дописывание
  journal\dialogs.jsonl      каждый ход: вопрос, ответ, intent, route, confidence, ms, studentId
  students\<id>.jsonl        события ученика (turn, error_tag, feedback, mood); снимок считается при чтении
  derived\                   пересобираемое: bm25-journal.json, embeddings\<model>\{vectors.f32, manifest.json}
  config.json
```

Строка журнала: `{id:"j-<ulid>", at, kind, lang, title, text, tags[], source, meta, hash:sha1(норм. текст)}`.
`kind` ∈ fact | qa | correction | feedback | dialog | note | dup. Повтор (тот же hash) тоже дописывается — записью
`kind:"dup"` с `meta.ref` на первую запись; почти-дубликат при сборке (Жаккар стемов ≥ 0.9) — тоже `dup`
(`meta.near`). Теги: `program:school-uz|school-ru|a-level|ib|univ|olympiad`, `domain:…`, `topic:<slug>`, `grade:N`,
`type:…`. В поиск попадают fact / qa / correction / note; `correction` (правки учителя) весит ×1.25.

**Файлы в `journal\` и `students\` не удалять и не редактировать.** Папку `derived\` можно удалить — пересоберётся.
В коде записи на диск только две: `appendLine/appendLines` (флаг `'a'`) и `writeDerived` (только внутри `derived\`),
см. `brain/kb/storage.ts`.

## API (контракт v1, общий с сайтом)

- `GET /health` → `{ok, service:"atomlab-brain", version, contract:1, llm:{available, chatModel, fastModel, embedModel}, kb:{docs, journalLines, embedded}, uptimeMs}` (+ `loading:true`, пока знания догружаются).
- `POST /chat` → `text/event-stream`: `meta` {turnId, intent, route, moderated, lang} → `delta` {text}… → `done` {text, source, citations≤3, confidence, confidenceLabel, student, ms} | `error`.
- `POST /kb/append` {kind, lang, text, title?, tags?, source?, meta?} → `{ok, id, line}`; удаления/перезаписи нет.
- `GET /kb/stats` → `{journalLines, bytes, byKind, embedded, lastAt, dataDir}`.
- CORS: `https://sadykoffalan2105-dev.github.io`, `http://localhost:*`, `http://127.0.0.1:*`; чужой Origin → 403.
- **Фото задачи** (поле необязательное, старые клиенты/серверы работают как раньше): последняя реплика может нести
  `images: string[]` — base64 JPEG/PNG/WebP без «data:», ≤ 2 шт., каждое ≤ 1,5 МБ (сайт сжимает до 1280 px, JPEG 0,8,
  без EXIF). Тело с фото — до 4 МБ (без фото — 64 КБ), отдельный лимит фото `config.server.photo` (3/мин, 30/сутки) →
  429 `rule: photo_minute|photo_day`; ошибки 400 (больше 2 / не base64), 413 (`image_too_large`), 415 (`bad_image`, не та
  сигнатура). Картинки видит только модель со зрением (`/api/show` capabilities ∋ `vision`, в `/health` — `llm.vision`);
  без зрения — честная фраза «фото не читаю» и ответ на текст подписи (`reason: no_vision`). В журнал — только `hasImage`.
  Конвейер — `brain/pipeline/photo.ts`, проверки — `brain/http/photo.ts`, тест — `scripts/brain/photo.selftest.mts`.

## Конвейер `/chat` (brain/pipeline)

normalize (язык ru/uz/en, набор букв) → moderation (мат с маскировкой → R2 + ответ по сути) → ownerRule (R1) →
опасные инструкции → беседа → intent → tools (молярная масса, ω, моль↔масса↔объём, уравнивание, степени окисления,
растворы, разбавление, газы, ΔH, pH, элемент > 118, способы получения — проверенные уравнения каталога 200 / учебника /
200 основных реакций, `obtain.ts`) → retrieve (BM25F шардов + BM25 журнала + bge-m3, hybrid 0.55/0.45, бонусы,
проверка темы `relevance.ts`: понятия вопроса во фрагменте, совпадение по фамилии не в счёт, учёные — только для «кто»,
Kimyo/ATOMLAB выше Википедии; ничего по теме — модель отвечает от законов без «справки», MMR) → LLM (Ollama, поток, StreamGate: R3, язык, лимит слов) или запасной путь (fallback.ts) → postcheck
(R3, числа инструментов, длина) → журналы.

## Как добавить правило

- **Тема для разметки базы** — строка в `brain/kb/topicMap.ts` (`[регекс, domain, topic, программы, класс]`), затем `npm run brain:corpus` (новые записи получат теги).
- **Мат** — корень в `brain/pipeline/moderation.ts` (словари ru/uz/en; белый список там же), проверка: `npm run brain:eval -- --inproc --cat=profanity`.
- **Правило владельца / тексты R1–R3** — `brain/pipeline/ownerRule.ts`, `moderation.ts` (R2), `postcheck.ts` (R3); менять только вместе с сайтом (`src/learn/brain/policy/*`).
- **Понятие для запасного пути** (определение + «логика от законов» на 3 языках) — `brain/kb/concepts.ts`.
- **Способ получения вещества** — шаг в `src/data/catalog/catalogObtaining200.ts` (каталог) или дополнение `EXTRA` в `brain/pipeline/obtain.ts`; бытовое название — `ALIASES` там же; проверка: `npm run brain:selftest`.
- **Склонение названия** (исключение вроде «свинец → свинца») — `IRREGULAR` в `brain/pipeline/declension.ts`.
- **Факт или правка учителя** — без кода: `POST /kb/append {"kind":"correction","lang":"ru","text":"…"}`.
- **Контрольный вопрос** — строка в `brain/eval/questions.jsonl` (`{id, cat, lang, q, expect:{exact?, startsWith?, mustMatch?, mustNotMatch?, lang?, maxWords?, number?:{value,tol}, intent?}}`).

## Публичный сервер для всех учеников (туннель)

Сервер по-прежнему слушает только `127.0.0.1`; в интернет его выводит туннель (Tailscale Funnel:
`https://<имя>.ts.net` → `http://127.0.0.1:8787`). Код: `brain/http/*` (адрес, лимиты, CORS, админ), `brain/llm/queue.ts`.

- **Адрес ученика** — из `X-Forwarded-For` (правый адрес), `Forwarded`, `CF-Connecting-IP`, `X-Real-IP`, и **только**
  если сокет — loopback (туннель на этом ПК); из сети заголовки игнорируются. Funnel ставит `X-Forwarded-For` и
  `Tailscale-Funnel-Request: ?1` сам (подделку клиента стирает). Адрес нигде не хранится: в памяти — солёный хеш
  (соль случайная на запуск), IPv6 — по сети /64. В журнал диалогов адрес не пишется никогда.
- **Лимиты** (`config.server`): `/chat` 8 в минуту и 120 в сутки на ученика, `/health` 120 в минуту, прочее 60;
  не больше 2 потоков `/chat` одновременно. Превышение → `429 {ok:false, error:"rate", retryAfterSec}` + `Retry-After`.
  Тело ≤ 64 КБ (иначе 413), только `Content-Type: application/json` (иначе 415), сообщений ≤ 12, символов ≤ 4000 (400).
  Владелец с этого ПК напрямую (loopback, без заголовков прокси, Host localhost) не ограничен (`rate.exemptLocal`).
- **Очередь к модели** (`config.llm`): одновременно `parallel` ответов (0 — по профилю: ноутбук 1, GPU 4), ждут до
  `queueCap` (40) не дольше `queueWaitMs` (20 с; GPU 30 с). Пока ждут — SSE `event: queue` `{position, waiting, etaSec?}`
  (и `position: 0`, когда дошла очередь) + «сердцебиение». Очередь полна, по замерам (≥ 3 ответа) не дождаться за
  `queueWaitMs` или ждали дольше → честный запасной путь, `meta.reason = done.reason = "busy"`. Ожидание вычитается
  из срока первого токена (сайт ждёт первый кусок 50 с). На сервере с GPU в Ollama задать `OLLAMA_NUM_PARALLEL=4`.
- **Админ** — `POST /kb/append`, `GET /kb/stats`, `GET /admin/status` (очередь, лимиты, профиль). `config.adminToken`
  (или env `BRAIN_ADMIN_TOKEN`) задан → нужен заголовок `X-Brain-Admin: <ключ>`; пуст → только с этого ПК напрямую.
  Иначе 403. Ключ: `npm run brain:admin-token` (печатает, ничего не пишет).
- **CORS** — `config.server.corsOrigins` (по умолчанию GitHub Pages) + `corsLocalhost` (`http://localhost:*`,
  `http://127.0.0.1:*`); `Access-Control-Allow-Private-Network` для сайта → ноутбук остаётся.
- **Журнал диалогов** — `config.server.dialogLog`: `all` (как раньше) | `local` (ученики из интернета не пишутся) | `off`.
- **Профиль** — `config.profile` или env `BRAIN_PROFILE`: `laptop` | `gpu`. `gpu` меняет только значения, равные
  умолчаниям: `keepAlive "-1m"` (модель в видеопамяти навсегда), без периодического продления, `numCtx 8192`,
  очередь 4, ожидание 30 с, «без прокси» не считается владельцем. Модели — по-прежнему `chatModels`/`fastModels`.
- **`/health`** публичный и быстрый: без путей, ключей и адресов; есть `queue {parallel, running, waiting}`.
- Проверка: `npm run brain:server-selftest` (порт 8790, подмена модели, временная папка).

## Мозг v2: поиск «сначала школа» (SOURCES)

Контракт с DIALOG — `brain/pipeline/dialogTypes.ts` (StandaloneQuery, RankedFragment, RetrievalResultV2). Поиск —
`retrieveV2(opts, deps)` в `brain/pipeline/retrieve.ts` (старый `retrieve()` — обёртка над ним):

- ярусы источников: 1 — учебник Kimyo класса ученика; 2 — соседний класс (или класс неизвестен), ATOMLAB того же класса;
  3 — дальние классы, ATOMLAB, журнал; 4 — энциклопедия и указатель. Множители — `config.retrievalV2.tierBoost`;
- школьный вопрос (`scope: 'school'`): Википедия не ищется, пока школа находит ответ; если нашлась — не больше одного
  фрагмента, не выше 3-го места, и только когда нет учебника своего/соседнего класса по теме; DIALOG кладёт её в «ФОН»,
  не в цитаты. Нет учебника — уверенность не выше «medium»; школа пуста, а энциклопедия сильная — `scopeUsed: 'broad'`;
- проверка темы (`relevance.ts`): «слабый терм» — в коротком вопросе термин должен встречаться по существу (не «1 моль»,
  «г/моль») — «What is a mole?» больше не тянет «Угольную кислоту»; персоналии на «кто/история» не требуют фамилии
  в заголовке; на «кто открыл X» — только учёные, энциклопедия и фрагменты с X в заголовке;
- классификаторы (`intent.ts`): `questionKind` (definition/why/howto_obtain/…/test_style/confirm/repeat),
  `classifyScope` (school/broad/offtopic + причина), `GRADE_HINT_RE` (класс в реплике, группа 1).

Проверки: `npm run brain:selftest` (relevance + `brain:selftest:retrieve`), `npx tsx scripts/brain/probe-retrieve.mts
--grade=g7 --topic=валентность --entities=Na "Какая валентность у натрия?" --why` (ярус и тип источника каждого фрагмента).

Eval v2 (`brain/eval/questions.jsonl`): многоходовые кейсы (`messages` до вопроса, `context {gradeId, detail, mode}`),
категории dialog-ru/uz/en, scope, length, logic; поля `meta.standalone/followUp/scope/kind/lengthClass` и `done.sources`
проверяются точно. Пороги: поля — 100 % в `--inproc`/`--mock-llm`, текст диалогов ≥ 90 %, scope ≥ 95 %, length ≥ 90 %,
logic ≥ 85 %, wikiLeak = 0; общий без LLM — 80 % после сборки DIALOG. Живая подвыборка:
`npm run brain:eval -- --sample=12 --cat=dialog-ru,dialog-uz,dialog-en,length` — ≥ 80 %. Пока chat.ts не шлёт
`meta.standalone`, поля «ждут DIALOG» и v2-категории не входят в общий порог; при слиянии — `DIALOG_MERGED = true`
в `scripts/brain/eval.mts` (или `--strict-dialog`). `--profile=laptop|gpu` подменяет `config.dialog.profile` в процессе.

## Картинки (`/image`, brain/image/**)

Кнопка «Нарисовать» сайта рисует учебную картинку на сервере с видеокартой (ComfyUI `127.0.0.1:8188`, движок
Z-Image-Turbo int8 по умолчанию, запасной — FLUX.2 klein 4B fp8). **По умолчанию выключено** (`config.image.enabled=false`);
на сервере включает установщик (deploy/brain-pc) через `config.json → image`.

**API.**
- `POST /image` (JSON ≤ 16 КБ): `{sessionId, studentId?, lang, presetId?, prompt? (≤ 500), size: square|wide|tall,
  style?: illustration|diagram|photo|poster, seed?, overlay?: {formula ≤ 80, caption ≤ 120} (только эхо), context?: {gradeId,
  sectionTitle, place}, teacherKey?}`. Ответ SSE: `accepted → queue* → progress* → done | error` («: hb» каждые 5 с);
  `?wait=1` или `Accept: application/json` — один JSON `{ok:true, …done}` / `{ok:false, error:{code, message}}` (статус 200,
  пока ждём — пробелы, JSON их допускает). Ошибки до потока (disabled/forbidden/not_ready/bad_request/busy) — JSON со
  статусом, если клиент не просил `text/event-stream`; лимиты — 429 `{rule: image_minute|image_day|image_streams|image_global}`.
- `done`: `{jobId, dataUrl (data:image/webp;base64), mime, width, height, seed, engine, variant, ms, timings{queueMs, drainMs,
  unloadMs, loadMs, genMs, safetyMs, reloadMs}, prompt{final, translated, presetId?}, safety{nsfw, normal}, overlay?, url}`.
  `reloadMs` — последний замер: Gemma возвращается ПОСЛЕ выдачи картинки. Формулы и подписи модель не рисует — их
  накладывает сайт (SVG-слой).
- `GET /image/presets?grade=g8&lang=ru` — 48 тем (`brain/image/presets.ts`), публично, кэш 5 мин; `GET /image/<jobId>` —
  WebP из памяти (`result.cacheTtlMs`), потом 404; `/health → image {enabled, ready, engine, students, queue, lastMs}`.
- Админ (`X-Brain-Admin`): `GET /admin/image/status` (арбитр, счётчики, видеопамять, `/api/ps`, строк журнала, последние
  задания без текстов), `GET /admin/image/verify` (граф ↔ `/object_info` живого ComfyUI), `POST /admin/image/test
  {presetId?, size?}` (синхронно, работает и при `enabled=false` — проверка до включения).

**Роли.** Владелец — `X-Brain-Admin`; учитель — `teacherKey` в теле (ключи `image.teacherTokens`, ≥ 16 символов); остальные —
ученики: выключены (`image.students.enabled=false`), при включении — только темы своего класса ±`gradeWindow`, без текста.

**Безопасность (ЗРУ-444, ст. 16).** Свободный текст (владелец/учитель): мат → R2; опасные инструкции → DANGER_REPLY;
фильтр категорий `brain/image/filter.ts` (sexual, gore, selfharm, drugs, extremism, persons, weapons, horror; корни с начала
слова, «спирт», «кислота», «qonun» не задеваются); проверка и перевод Gemma строгим JSON (`IMAGE_CHECK`, до окна GPU);
готовая картинка — узел ComfyUI `ATOMLABSafetyCheck` (Falconsai NSFW ViT): нет ответа узла — картинка не отдаётся никому;
порог 0.5 (владелец/учитель), 0.3 (ученики). Журнал `journal/images.jsonl` — только дописывание, без адресов и без текстов
учеников; подчиняется `server.dialogLog`. Файлы картинок на диск не сохраняются (PNG ComfyUI удаляется после выдачи).

**Протокол окна GPU** (`brain/llm/gpuArbiter.ts`; Gemma и модель картинок вместе в 16 ГБ не помещаются):
1. ComfyUI не готов (нет `/system_stats` или узла безопасности) → `not_ready`;
2. `queue.pause('image')` → дренаж: идущие ответы дописываются (текст не прерывается никогда), новые ждут в очереди —
   их сроки продлеваются на время паузы, «занят» из-за картинки не получает никто;
3. Ollama `keep_alive: 0` для чат- и быстрой модели → `/api/ps` пусто → проверка `vram_free ≥ vramNeedGB` (bge-m3 остаётся);
4. задания по одному: `/prompt` → опрос `/history` 250 мс → `atomlab_safety` → `/view?preview=webp;85` → удалить PNG;
   в окно добираются следующие, пока их < `window.maxJobs` и прошло < `window.maxMs`;
5. `/free` в ComfyUI → `/api/generate {model, keep_alive, options:{num_ctx}}` (тот же `num_ctx`, что у ответов) → `resume()`;
   при любой ошибке — то же в `finally`.

Следующее окно — не раньше `window.cooldownMs`, если во время окна приходил текст; задание, ждущее дольше
`maxStarvationMs`, открывает окно сразу. Если живые замеры хуже порогов — уменьшить `window.maxJobs` до 1 и `maxMs` до 20 с.

**Конфиг** (`config.json → image`, умолчания в `brain/config.ts`): `enabled, engine, variant, comfyUrl` (env `BRAIN_COMFY_URL`
важнее), `comfyPollMs, comfyOutputDir, steps (0 — по движку), sizes, students{enabled, presetsOnly, nsfwThreshold,
gradeWindow}, teacherTokens, freeText, llmCheck, rate{perMin, perDay, globalPerMin, queueCap, perClientQueued}, jobTimeoutMs,
window{…}, safety{required, nsfwThreshold}, result{quality, cacheTtlMs, cacheMaxBytes}, vramNeedGB`.
Лимиты `rate.globalPerMin` и `perClientQueued` не действуют на владельца с ключом (как лимиты `/chat`).

**Как добавить тему.** Строка в `ROWS` файла `brain/image/presets.ts`: id `gN-тема` (уникальный), классы, заголовки
ru/uz/en (термины uz — по `brain/persona/uzGlossary.ts`), тема, стиль, размер, `prompt_en` (ASCII, без людей и надписей,
без слов фильтра) → `npm run brain:image-selftest`.

**Проверки.** `npm run brain:image-selftest` — без сети и моделей (поддельные ComfyUI и Ollama на 8798, мозг на 8797):
роли, фильтр, перевод, классификатор, порядок окна, текст в окне без busy, лимиты, пресеты, TTL, журнал.
Живая приёмка на сервере: `npm run brain:image-live -- --url=https://<сервер>.ts.net --admin=<ключ> --verify-graph`
(12 тем парами + 6 текстовых вопросов; пороги: e2e p50 ≤ 15 с, p95 ≤ 30 с, вторая в окне ≤ 8 с, nsfw < 0.1, первое слово
текста p95 ≤ 25 с без busy, Gemma в видеопамяти ≤ 20 с после окна); итог и картинки — в `.tmp/image-live`.
