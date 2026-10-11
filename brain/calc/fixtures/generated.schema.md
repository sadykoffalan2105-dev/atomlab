# Фикстуры школьного калькулятора

- `golden.jsonl` — `{id, type, lang, statement, expect:[{value} | {text}]}`: 60 задач, ответы посчитаны вручную (школьные Ar).
  Селфтест требует: распознан именно `type`, каждое ожидаемое значение есть в `numbers` (допуск rel 0,01 / abs 0,01).
- `textbook.jsonl` — задачи учебников: `{id:'g8-§25-ex1', grade, kp, source:'example'|'exercise'|'labTask', lang, statement,
  expect:[{value, unit?, tol:{rel, abs}}], loose?, checked?, unsupported?, page?}`.
  `checked:true` — выверено вручную (условие поправлено от OCR, ответ пересчитан); `unsupported:true` — тип пока не решается,
  калькулятор обязан вернуть null или верный ответ; `checked:false` — сырьё из `npm run brain:calc-mine` (только отчёт).
- Генеративные задачи (селфтест, раздел «в») не хранятся: сид 20261011, 12 типов × N (по умолчанию 500), шаблоны ru/uz/en;
  ожидаемое значение считает генератор по школьным M, сравнение с напечатанным числом с допуском округления.
