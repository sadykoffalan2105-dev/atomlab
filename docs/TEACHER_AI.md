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

## Ваш сервер (позже)

```env
VITE_LEARN_CHAT_URL=https://your-server.example/api/learn/chat
```

Сервер должен принимать POST JSON `{ messages, context }` и возвращать `{ reply, source }`.

## Безопасность

Учитель напоминает о очках, вытяжке и контроле учителя в лаборатории. Не заменяет инструктаж в реальной лаборатории.
