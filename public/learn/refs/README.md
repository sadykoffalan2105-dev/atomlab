# Референсы Nano Banana для 3D-уроков

Положите сюда картинки, сгенерированные в **Nano Banana** / **Gemini → Создать изображения**.

## Имя файла (Nano Banana)

```
topic_{класс}_{глава}_{параграф}.nanobanana.png
```

Примеры:

- `topic_g7_c1_s01.nanobanana.webp`
- `topic_g8_c2_s05.nanobanana.png`

Поддерживаются `.webp`, `.png`, `.jpg`.

Автопостеры 3D (130 §): `public/learn/posters/` — `npm run learn:capture-refs`.

## Как получить промпты

```bash
npm run learn:nanobanana-prompts
```

Откройте `docs/nano-banana-prompts.md`, скопируйте промпт для нужного § в Nano Banana.

## В приложении

Если файл есть — в обучении показывается **ваша инфографика** (как на референсе).  
Если нет — показывается **встроенная 3D-сцена** с подписями.
