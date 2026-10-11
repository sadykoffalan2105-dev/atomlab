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
