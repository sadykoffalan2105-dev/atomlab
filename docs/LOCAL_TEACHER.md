# Локальный AI-учитель (Python + Ollama + Edge TTS)

ATOMLAB может использовать **локальный Python-сервис** на ПК учителя вместо облачных API. Сервис даёт:

- **Чат** — Ollama (например `llama3.2`) + RAG по учебнику 7 класса (`g7TextbookKnowledge.json`)
- **Озвучка** — бесплатный Microsoft Edge Neural (`ru-RU-DmitryNeural` / `en-US-GuyNeural`)

## База знаний (offline RAG фронтенда)

Кроме учебников, ИИ-учитель отвечает по расширенной офлайн-базе (`src/learn/knowledge/`), которая
подмешивается в `learnKnowledgeRetrieval.ts`:

- **Элементы** — авто-генерация по всем 118 элементам (свойства, применение, получение) из таблицы и профилей `elementRealLifeProfiles.json`.
- **Вещества** — авто-генерация по всему каталогу неорганики и органическим молекулам (что такое вода, оксид меди, серная кислота, метан…).
- **Учёные** — Менделеев, Лавуазье, Авогадро, Ибн Сина, Беруни и др.
- **Формулы и задачи** — количество вещества, молярная масса, Vₘ=22,4, массовая доля, стехиометрия, выход, pH, термохимия.

Всё это бандлится во фронтенд и работает и в облачном `/api/learn/chat`, и в офлайн-синтезе.

Если сервис недоступен, фронтенд автоматически переключается на встроенный TS-учитель и browser/Ollama fallback — ничего не ломается.

---

## Требования

| Компонент | Версия / примечание |
|-----------|---------------------|
| Python | 3.10+ |
| Ollama | [ollama.com](https://ollama.com) |
| Node.js | как для ATOMLAB (`npm run dev`) |
| MSVC (опционально) | для C-ускорения RAG на Windows |

---

## Быстрый старт (Windows)

### 1. Ollama

```powershell
ollama pull llama3.2
ollama serve
```

Проверка: откройте `http://127.0.0.1:11434` — API должен отвечать.

### 2. Python-зависимости

Из корня репозитория:

```powershell
pip install -r teacher_service/requirements.txt
```

### 3. Запуск сервиса учителя

```powershell
npm run teacher:dev
```

Сервис слушает **`http://127.0.0.1:8765`**.

Проверка:

```powershell
curl http://127.0.0.1:8765/health
```

Ожидается JSON с `"status": "ok"`, `"ollama": true`, `"textbookLoaded": true`.

### 4. Запуск ATOMLAB

```powershell
npm run dev
```

В dev-режиме Vite проксирует **`/teacher-api`** → `:8765`, поэтому переменная окружения необязательна.

Опционально в `.env`:

```env
VITE_TEACHER_SERVICE_URL=http://127.0.0.1:8765 
TEACHER_SERVICE_PORT=8765
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.2
```

### 5. Проверка в интерфейсе

1. Откройте раздел «Обучение» → панель **ИИ-учитель**
2. Задайте вопрос по §7 — ответ на русском
3. Включите озвучку — голос **Dmitry Neural**
4. **Task Coach** — сократическая подсказка без финального ответа

---

## API

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/health` | Статус Ollama и учебника |
| POST | `/v1/chat` | Чат (тело как у `/api/learn/chat`) |
| POST | `/v1/tts` | `{ "text": "...", "locale": "ru" }` → `{ "audioBase64", "source": "edge" }` |

---

## C-ускорение RAG (опционально)

Поиск по учебнику ускоряется нативным модулем `teacher_service/native/rag_scan/`:

```powershell
npm run teacher:native
```

При успешной сборке появится `rag_scan.dll` (Windows) или `rag_scan.so` (Linux/macOS).  
Если сборка не удалась — используется чистый Python (функционально то же).

**Windows:** нужен [Build Tools for Visual Studio](https://visualstudio.microsoft.com/visual-cpp-build-tools/) с компонентом «Desktop development with C++», чтобы в PATH был `cl`.

---

## Переменные окружения

| Переменная | По умолчанию | Назначение |
|------------|--------------|------------|
| `TEACHER_SERVICE_PORT` | `8765` | Порт FastAPI |
| `OLLAMA_URL` | `http://127.0.0.1:11434` | URL Ollama |
| `OLLAMA_MODEL` | `llama3.2` | Модель чата |
| `EDGE_TTS_VOICE_RU` | `ru-RU-DmitryNeural` | Русский голос |
| `EDGE_TTS_VOICE_EN` | `en-US-GuyNeural` | Английский голос |
| `EDGE_TTS_RATE` | `-4%` | Скорость речи |
| `VITE_TEACHER_SERVICE_URL` | (dev: `/teacher-api`) | URL для фронтенда |

---

## Troubleshooting (Windows)

### `ollama: false` в `/health`
  
- Запустите `ollama serve` в отдельном терминале
- Проверьте брандмауэр для порта 11434
- Убедитесь, что модель скачана: `ollama list`

### Чат возвращает `error: ollama_unreachable`

- Ollama не запущен или другой порт — задайте `OLLAMA_URL`
- Первая генерация может занять 30–60 с (загрузка модели в RAM)

### Нет озвучки / TTS error

- Нужен доступ в интернет (Edge TTS обращается к Microsoft)
- Проверьте `POST /v1/tts` через curl с коротким текстом
- При ошибке ATOMLAB переключится на browser SpeechSynthesis

### CORS в dev

Используйте прокси `/teacher-api` или задайте `VITE_TEACHER_SERVICE_URL=http://127.0.0.1:8765` и убедитесь, что `TEACHER_CORS_ORIGINS` включает ваш origin.

### `textbookLoaded: false`

Файл `src/data/g7TextbookKnowledge.json` отсутствует. Соберите:

```powershell
npm run build:g7-textbook-knowledge
```

### pip / python не найден

Установите Python с [python.org](https://www.python.org/downloads/) и отметьте «Add to PATH». Затем:

```powershell
python -m pip install -r teacher_service/requirements.txt
python -m teacher_service
```

---

## Архитектура

```
ATOMLAB (React)
  → POST /v1/chat, /v1/tts
teacher_service (FastAPI :8765)
  → RAG (Python + optional C rag_scan)
  → Ollama llama3.2
  → edge-tts Dmitry/Guy
```

Подробный план реализации — в `.cursor/plans/local_python_ai_teacher_*.plan.md`.

---

## Super-Brain: голосовой опрос в реальном времени + зрение по камере

Мультимодальное ядро ИИ-преподавателя живёт в `src/learn/brain/` и объединяет
три потока сигналов (камера / аудио+STT / лаборатория) в единый контекст.

```
src/learn/brain/
  brainTypes.ts            типы сигналов и решений
  reasoningTrace.ts        журнал скрытых мыслей (Reasoning Log)
  studentMemoryStore.ts    Big Data Layer (IndexedDB): память об ученике
  contextGraph.ts          сведение 3 потоков в FusedContext (граф активаций)
  pedagogicalStrategy.ts   выбор тона/действия/подсказки
  brainPhrasing.ts         генерация живых реплик учителя
  unifiedBrain.ts          ядро: ingest → reasoning → strategy → ответ
  vision/engagementTracker.ts   CV: внимание, взгляд, эмоция, второй экран
  voice/audioActivityDetector.ts  VAD (Web Audio RMS)
  voice/interruptionController.ts барджин (перебивание ИИ)
  voice/realtimeTransport.ts      duplex-канал (WebSocket | локальный контур)
  voice/duplexVoiceSession.ts     движок непрерывного голосового диалога
  voice/voiceExamOrchestrator.ts  голосовой опрос с корректирующими вопросами
  useUnifiedBrainSession.ts       React-хук интеграции с UI
```

Мыслительный путь на каждый ход фиксируется в порядке:
`[оценка ответа] → [сверка с эмоцией] → [вовлечённость] → [лаборатория] →
[долгосрочная память] → [выбор стратегии] → [генерация реплики]`.

Интеграция в UI: `src/components/learn/BrainInsightPanel.tsx` (HUD внимания и
эмоций поверх голосового опроса, режим «только зрение» — микрофон не занимает).
Для полного голосового опроса передайте `questions` в `useUnifiedBrainSession`.
Транспорт реального времени: без `websocketUrl` работает локальный контур
(браузерный STT/TTS + UnifiedBrain), с URL — двусторонний WebSocket-стриминг.
