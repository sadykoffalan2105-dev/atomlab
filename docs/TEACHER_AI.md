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

## Голос учителя — клон из вашего MP3

**Порядок:** ElevenLabs клон (`male-voice-for-answering-machine.mp3`) → Edge Neural → OpenAI → браузер.

### Один раз: создать клон

```bash
ELEVENLABS_API_KEY=sk_... npm run clone:teacher-voice
```

Скрипт сохранит `voice_id` в `src/data/teacherElevenLabsVoice.json`.

### На сервере (Vercel)

```env
LEARN_TTS_PROVIDER=clone
ELEVENLABS_API_KEY=sk_...
ELEVENLABS_VOICE_ID=...   # из clone:teacher-voice
VITE_LEARN_CHAT_URL=https://your-project.vercel.app/api/learn/chat
```

- `POST /api/learn/tts` — `{ text, locale }` → `{ audioBase64, source: "clone"|"edge"|"openai" }`
- **GitHub Pages** сам по себе не может озвучивать клоном — нужен API на Vercel (или локально `npm run dev` с `.env`).
- Образец голоса: кнопка «Образец голоса» в панели учителя.

Без ElevenLabs ключа используется похожий мужской голос (Dmitry Neural), но не точная копия MP3.

```env
# fallback
LEARN_TTS_PROVIDER=auto
EDGE_TTS_VOICE_RU=ru-RU-DmitryNeural
OPENAI_TTS_VOICE_RU=onyx
```

Локально (`npm run dev`) TTS работает через middleware, если в `.env` задан `ELEVENLABS_API_KEY` или `OPENAI_API_KEY`.

## Безопасность

Учитель напоминает о очках, вытяжке и контроле учителя в лаборатории. Не заменяет инструктаж в реальной лаборатории.
