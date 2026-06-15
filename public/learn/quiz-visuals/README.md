# Иллюстрации к вопросам (quiz)

Фотореалистичные PNG для блока «Описание темы» в тестировании (вкладка «Инструменты»).

- Имена: `{templateKey}.png`, напр. `c2-t03.png`
- Манифест: `src/learn/quizVisualManifest.ts` (из `g7QuizVisualCatalog.ts`)
- Тексты: `src/learn/g7QuizVisualCatalog.ts` + `g7C1S01QuizEnrichments.ts` (глава I)

## Генерация (7 класс, 61 вопрос)

```bash
npm run learn:quiz-visual-placeholders   # градиент-плейсхолдеры для отсутствующих PNG
npm run learn:generate-quiz-visuals      # DALL-E 3 (нужен OPENAI_API_KEY в .env)
npm run learn:generate-quiz-visuals -- --limit=10
npm run learn:generate-quiz-visuals -- --id=c2-t01 --force
```
