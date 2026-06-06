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

## Ваш сервер (OpenAI + нейроголос)

```env
OPENAI_API_KEY=sk-...
OPENAI_TTS_MODEL=tts-1-hd
OPENAI_TTS_VOICE=shimmer
VITE_LEARN_CHAT_URL=https://your-server.example/api/learn/chat
```

- `POST /api/learn/chat` — `{ messages, context }` → `{ reply, source }`
- `POST /api/learn/tts` — `{ text, locale }` → `{ audioBase64, mimeType, source: "openai" }`

Голос **tts-1-hd** (как у ChatGPT/Gemini): естественная интонация, чёткое произношение формул. Без API-ключа — запасной голос браузера.

Локально (`npm run dev`) TTS работает через тот же middleware, если в `.env` задан `OPENAI_API_KEY`.

## Безопасность

Учитель напоминает о очках, вытяжке и контроле учителя в лаборатории. Не заменяет инструктаж в реальной лаборатории.
