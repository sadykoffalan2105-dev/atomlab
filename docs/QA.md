# Чеклист качества ATOMLAB (релиз)

## Автоматически

```bash
npm run build
npm run validate:learn
```

При изменении слайдов обучения:

```bash
npm run learn:prepare-slides
npm run learn:fetch-placeholders
```

## Лаборатория

См. [QA_LAB_SYNTHESIS.md](./QA_LAB_SYNTHESIS.md):

- коэффициенты без 3D-продукта до запуска;
- синтез K₂Cr₂O₇ ×3 без чёрного экрана.

## Обучение

- [ ] У каждого § есть poster + `s02`–`s04` (разные кадры после `learn:prepare-slides`).
- [ ] Слайды с фактами/буллетами, не пустой шаблон.
- [ ] `validate:learn` без ошибок.

## Учитель

- [ ] Офлайн ответы на типовые темы (кислоты, ОВР, моль…).
- [ ] Ollama (опционально): см. [TEACHER_AI.md](./TEACHER_AI.md).

## Деплой

- Статика: `npm run build` → `dist/`.
- API учителя (опционально): `VITE_LEARN_CHAT_URL`.
- Ollama только на клиенте пользователя (`VITE_OLLAMA_*`).
