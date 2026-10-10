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
| `npm run brain:eval` | 164 контрольных вопроса по 9 категориям через HTTP; `-- --inproc` без сервера, `-- --mock-llm` с подменой Ollama, `-- --fails` / `--verbose` |
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
растворы, разбавление, газы, ΔH, pH, элемент > 118) → retrieve (BM25F шардов + BM25 журнала + bge-m3, hybrid 0.55/0.45,
бонусы, MMR) → LLM (Ollama, поток, StreamGate: R3, язык, лимит слов) или запасной путь (fallback.ts) → postcheck
(R3, числа инструментов, длина) → журналы.

## Как добавить правило

- **Тема для разметки базы** — строка в `brain/kb/topicMap.ts` (`[регекс, domain, topic, программы, класс]`), затем `npm run brain:corpus` (новые записи получат теги).
- **Мат** — корень в `brain/pipeline/moderation.ts` (словари ru/uz/en; белый список там же), проверка: `npm run brain:eval -- --inproc --cat=profanity`.
- **Правило владельца / тексты R1–R3** — `brain/pipeline/ownerRule.ts`, `moderation.ts` (R2), `postcheck.ts` (R3); менять только вместе с сайтом (`src/learn/brain/policy/*`).
- **Понятие для запасного пути** (определение + «логика от законов» на 3 языках) — `brain/kb/concepts.ts`.
- **Факт или правка учителя** — без кода: `POST /kb/append {"kind":"correction","lang":"ru","text":"…"}`.
- **Контрольный вопрос** — строка в `brain/eval/questions.jsonl` (`{id, cat, lang, q, expect:{exact?, startsWith?, mustMatch?, mustNotMatch?, lang?, maxWords?, number?:{value,tol}, intent?}}`).
