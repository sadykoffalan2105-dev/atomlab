# Иллюстрации к вопросам (quiz)

Фото к вопросам тестирования во вкладке **Инструменты** (блок «Описание темы»).

## Per-question (7 класс)

- Имена: `g7-c{глава}-s{§}-q{NN}.png`, напр. `g7-c1-s02-q01.png`
- Описания: [`src/data/g7SectionQuizEnrichments.json`](../../../src/data/g7SectionQuizEnrichments.json)
- Ручной эталон §1: [`src/learn/g7C1S01SectionQuizEnrichments.ts`](../../../src/learn/g7C1S01SectionQuizEnrichments.ts)
- Манифест: [`src/learn/quizVisualManifest.ts`](../../../src/learn/quizVisualManifest.ts)

## Сборка

```bash
npm run build:g7-section-quizzes       # банк MCQ по всем §
npm run build:g7-section-enrichments   # description + imagePrompt на каждый вопрос
npm run learn:render-quiz-visuals      # уникальные фото из постеров/слайдов §
npm run learn:generate-quiz-visuals    # опционально DALL·E 3 (нужен валидный OPENAI_API_KEY)
npm run learn:generate-quiz-visuals -- --prefix=g7-c2-
```

Эталонные PNG §1 (`g7-c1-s01-q01`…`q08`) при render не перезаписываются (размер ≥ 250 KB).
