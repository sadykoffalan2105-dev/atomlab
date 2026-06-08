# Учитель ATOMLAB (бесплатно)

## Режимы

1. **Локальный** (по умолчанию) — FAQ, каталог, конспект §. Без интернета.
2. **Ollama** (опционально) — бесплатная модель на вашем ПК.

## Ollama

1. Установите [Ollama](https://ollama.com).
2. В терминале: `ollama pull llama3.2`
3. В `.env` проекта (или переменные сборки):

```env
VITE_OLLAMA_ENABLED=true
VITE_OLLAMA_URL=http://127.0.0.1:11434
VITE_OLLAMA_MODEL=llama3.2
```

4. В панели «ИИ-учитель» включите переключатель **Ollama**.

## Голос учителя (максимально «живой»)

**Порядок:** Microsoft Edge Neural (Dmitry/Jenny) → OpenAI marin/cedar → браузер.

```env
LEARN_TTS_PROVIDER=auto
# Женский RU: EDGE_TTS_VOICE_RU=ru-RU-SvetlanaNeural
OPENAI_TTS_MODEL=gpt-4o-mini-tts-2025-03-20
OPENAI_TTS_VOICE_RU=marin
VITE_LEARN_CHAT_URL=https://your-server.example/api/learn/chat
```

- `POST /api/learn/tts` — `{ text, locale }` → `{ audioBase64, source: "edge"|"openai" }`
- На Windows/Chrome часто есть **Microsoft Dmitry Online (Natural)** — используется автоматически, без API.

Локально (`npm run dev`) TTS работает через тот же middleware, если в `.env` задан `OPENAI_API_KEY`.

## Безопасность

Учитель напоминает о очках, вытяжке и контроле учителя в лаборатории. Не заменяет инструктаж в реальной лаборатории.
