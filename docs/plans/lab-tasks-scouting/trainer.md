# Тренажёр задач, учитель и точки входа: что есть в коде для режима «Решить в лаборатории»

Главное:
- **Три независимых решателя задач.** Только тренажёр `/learn/tasks/:id` сохраняет результат. Задача в параграфе и учебные формулы ничего не записывают.
- **Учитель в параграфе не знает о задаче.** Пошаговые подсказки по задаче есть только в тренажёре.
- **3D-лаборатория читает из адреса только `exp` (и `q`, debug-флаги).** Результат опыта наружу не передаётся.
- **Допуск проверки — около 0,8 % от эталона.** Погрешность прибора он не покроет.
- **Найдены ошибки, которые стоит исправить до нового режима.** Две ошибки в подсказках, сломанная категория `formulas`, сохраняется только первая попытка, и, по чтению кода, хаб `/learn/tasks` может быть недоступен (п. 6).

Всё ниже прочитано в коде, в браузере не проверял.

## 0. Маршруты
- `src/App.tsx:85-86`: `learn/tasks` и `learn/tasks/:lessonId` → `LearnPage`. Лаборатория: `src/App.tsx:71` `vr-lab` → `Lab3DPage`, `:72` `vr-lab-classic` → старая `VrLabPage`.
- `src/pages/LearnPage.tsx:497-505`: `if (params.topicId === 'tasks')`, затем `LearnTaskRunner categoryId={params.lessonId}` или `LearnTasksHub`. Неизвестный id → `NotFound`, проверка по `LEARN_TASK_CATEGORY_IDS`.
- Хаб `src/pages/LearnTasksHub.tsx:34-41`: карточка ведёт на `/learn/tasks/${cat.id}`. Слева `LearnTasksClassPanel` (список класса).
- В уроке есть меню «Ещё» со ссылкой `/learn/tasks` (`src/components/learn/LearnSectionRunner.tsx:625-628`). Там же ссылка на органическую лабораторию, только для g10 (`:438-439`, `:635-639`).

## 1. Как ученик решает задачу сейчас

### 1a. Генератор задач: `src/learn/learnTaskProblems.ts`
Типы:
- `LearnTaskNumericProblem` (`:3-13`): `{kind:'numeric', categoryId, compoundId, questionKey, answerLabelKey, params, correct, decimals}`.
- `LearnTaskMcqProblem` (`:15-22`): задача с выбором ответа.
- `generateTaskProblem(categoryId)` (`:41-299`): числа случайные (`Math.random`), seed нет.

| категория | строки | условие (диапазоны) | эталон | знаков |
|---|---|---|---|---|
| solutions | 43-60 | mSol 150–280 (шаг 10) г, w 6–18 %, mWater 125–450 (шаг 5) г | mSol·w/(mSol+mWater) | 2 |
| stoichiometry | 61-75 | m(CaCO₃) 4–22 г, избыток HCl | m/100·22,4 л | 2 |
| limiting_reagent | 76-96 | mFe 12–56, mS 8–48 (шаг 4), Fe+S→FeS | min(nFe,nS)·88 | 2 |
| yield_impurities | 97-113 | известняк 800–4000 г, примеси 5–18 % | m·(1−p)·0,56 | 1 |
| metal_plate | 114-128 | Δm 8–48 (шаг 8) | Δm/8·64 | 2 |
| oge_prep | 253-294 | в 50 % случаев m(CaCO₃) 5–40 → V(CO₂); иначе вопрос с выбором «класс H₂SO₄» | m/100·22,4 | 2 |
| electron_balance, ionic_equations, transformation_chains, qualitative_id | 129-252 | только выбор ответа, 1–2 варианта, порядок ответов перемешивается | — | — |

Тексты условий: `src/i18n/learnPackRu.ts:122-140` (EN и UZ — в тех же строках `learnPackEn.ts` / `learnPackUz.ts`). ОГЭ — `src/i18n/learn/learnTeacherI18n.ts:83-89` (RU), `:172-179` (EN), `:263-270` (UZ). Пример условия:

> «{m} г вещества, принятого за чистый CaCO₃ (M = 100 г/моль), полностью реагируют с избытком HCl с выделением CO₂. Объём CO₂ при н.у. (22,4 л/моль), л:»

Категории: `src/data/learnTaskCategories.ts:15-97`, 11 штук, группы `quant` и `qual`. Поле `gradeIds` (`:12`) нигде не используется.

### 1b. Тренажёр: `src/pages/LearnTaskRunner.tsx`
- **Состояние** (`:38-45`): `problem`, `userText`, `feedback` (`'idle'|'correct'|'wrong'`), `staticHints`, `aiHints`, `recordedRef`.
- **3D-молекула** (`:153-165`): `CatalogMoleculeHero compoundId` из задачи.
- **Ввод** (`:196-231`): текстовое поле `inputMode="decimal"`, Enter = проверка, кнопки «Проверить» и «Новая задача».
- **Разбор числа** (`:18-23`): `raw.trim().replace(',', '.')` → `Number`. Пробелы внутри и единицы («4,48 л») не принимаются: получается `null`, ответ считается неверным и сразу сохраняется (`:89-92`).
- **Проверка** (`:86-97`): `answersClose(u, problem.correct, problem.decimals)`. Для вопросов с выбором — `idx === correctIndex` (`:99-107`).
- **Отзыв** (`:258-269`): `learn.task.correct`, при ошибке `learn.task.wrong` + `learn.task.expected` («Эталон: {value}», `correct.toFixed(decimals)`). То есть эталон показывается сразу после первой ошибки.
- **Статичные подсказки**: `TaskTeacherHint` (`src/components/learn/TaskTeacherHint.tsx`) открывает шаги по одному из `buildTaskTeacherHints` (`src/learn/taskTeacherHints.ts:107-112`; шаги по категориям `:9-72`, для вопросов с выбором `:74-104`). Тексты: `learnPackRu.ts:187-206`.

### 1c. Задача внутри параграфа: `src/components/learn/LearnWorkspace.tsx`
- `taskCategoryId` берётся из слайда `practice` или из `section.taskCategoryId` (`LearnSectionRunner.tsx:197-200`). Передаётся в `LearnWorkspace` (`:483-487`, инструмент `'work'`).
- Задачу генерирует `generateTaskProblem` (`:51-55`). Проверка — та же `answersClose` (`:69-77`).
- **Ничего не сохраняет**: нет записи в roster, нет `markLessonCompleted`. Подсказок и ИИ-коуча нет.
- Черновик-тетрадь (`LearnBoardPad`) хранится в `workspaceDrafts`.
- Какие параграфы получают задачу (`src/data/learnCurriculumUz.ts`):
  - g7 c2 §8, §9, §11 → `stoichiometry` (`:257`);
  - g7 c6 §8 → `solutions` (`:266`);
  - g8 c5 s04, s05 → `stoichiometry` (`:339-340`);
  - g9 c7 s01–s05 → `oge_prep` (`:411-415`).

### 1d. Тренажёр формул 7 класса: `src/components/learn/ChemProblemTutor.tsx`
- Вкладки «формулы / примеры / практика» (`:212-225`). Данные в `src/learn/chemProblemEngine.ts`:
  - `CHEM_FORMULAS` (`:40-130`): Ar, Mr, ω, n=m/M, N=n·N_A, V=n·22,4, ρ=m/V;
  - `CHEM_WORKED_EXAMPLES` (`:132-200`), с шагами;
  - `CHEM_PRACTICE_TASKS` (`:202-263`): 6 фиксированных задач с **абсолютным** допуском `tolerance` и `unitKey`.
- Проверка: `parseNumericAnswer` (`:265-270`, убирает все пробелы, запятую меняет на точку) + `answersMatch(user, expected, tolerance)` = `|u−e| ≤ tol` (`:272-274`).
- Есть кнопка «Показать ответ» (`ChemProblemTutor.tsx:197-200`). Прогресс не сохраняется.
- Встроен только в `LearnStudentTestHub`, режим `'problems'` (`LearnStudentTestHub.tsx:29,112,648-650,847`). Хаб доступен из `LearnLessonSidebar`, `LearnBookTopicPanel`, `LearnClassRosterPanel`.
- Картинки: `src/learn/chemProblemVisuals.ts` (`/learn/problems/*.png`, `getProblemVisual` `:104`).

### 1e. Составление формул
`src/learn/formulaValencyEngine.ts`: `composeByValency` `:29`, `normalizeFormulaAnswer` `:43`, `formulasMatch` `:54` (сравнение строк). Используется в `FormulaLearningPanel.tsx`.

## 2. Как учитель получает контекст задачи

### ИИ-коуч тренажёра: `src/components/learn/TaskAiCoach.tsx`
- Черновик `scratchpad` и две кнопки: «Следующий шаг» и «Проверь рассуждение». Обе засчитываются как подсказка (`:144-154`). Ответ озвучивается (`:116`).
- Контекст — `buildTaskCoachContext` (`src/learn/learnTaskCoachTypes.ts:4-49`). Правильный ответ и номер верного варианта **намеренно не передаются**. Передаются: categoryId/Title, problemKind, questionText, answerLabel, params, choiceLabels, staticHintsRevealed, aiHintsGiven, feedback, userAttempt, scratchpad.
- Порядок источников ответа (`src/learn/learnTaskCoachClient.ts:18-94`):
  1. `requestTeacherChat`;
  2. `VITE_LEARN_CHAT_URL` (таймаут 12 с);
  3. `routeTaskCoachReply` (`learnTaskCoachRouter.ts:27-46`): Ollama, если `VITE_OLLAMA_ENABLED`, иначе локальный ответ.
- Базовый контекст жёстко задан (`learnTaskCoachClient.ts:96-111`): `gradeId:'g8', chapterId:'tasks', sectionId:'learn-tasks'`.
- Системный промпт `learnTaskCoachPrompt.ts:9-75` — сократический режим. Запрещено называть число, ответ или вариант; один шаг, 2–4 предложения, до 90 слов. Серверная ветка та же: `src/learn/learnChatCore.ts:175-210`.
- Локальный коуч `learnTaskCoachLocal.ts:75-110`. Шаблонные фразы по категориям (`:134-180`); английских текстов только 2 категории; для `uz` отвечает по-английски (`ru = locale==='ru'`).
- Фильтр утечки ответа: `filterTaskCoachReply` (`learnAssistantGuard.ts:40-60`), regex `TASK_ANSWER_LEAK`; сам `taskCoach` не используется (`void taskCoach`).

### Учитель в параграфе: `LearnAssistantPanel`
- Вызывается с `slideBody=""` (`LearnSectionRunner.tsx:506-515`). Контекст `localCtx` (`LearnAssistantPanel.tsx:409-424`) **без `taskCoach`**.
- `buildLearnAssistantContext` с `practice:${taskCategoryId}` (`src/learn/learnAssistantContext.ts:40-41`) нигде не вызывается.
- В `learnTeacherRouter.ts` и `src/learn/brain/**` нет маршрутизации к задачам: поиск по task / taskCategory / LearnTaskGenerated ничего не нашёл.

**Вывод:** чтобы учитель понимал задачу в лаборатории, нужно:
- расширить `LearnTaskCoachContext` полями измерений (например `labMeasurements`, `labExperimentId`);
- вывести эти поля в `buildTaskCoachSystemPrompt` и в `generateTaskCoachLocalReply`;
- в параграфе передать `taskCoach` в `LearnAssistantPanel`.

## 3. Где поставить кнопку «Решить в лаборатории» и как передать задачу

**Образец ссылки:**
- `src/data/labWorks/labExperimentMatch.ts:63-65`: `labExperimentHref(id)` → `/vr-lab?exp=${encodeURIComponent(id)}`. Реэкспорт: `src/components/lab3d/experiments/index.ts:3`.
- Кнопка-образец — «3D-опыт →» у реакции в учебнике: `src/components/learn/book/ReactionChip.tsx:39,84-94` (`findLabExperimentForEquation(rx.equation)`).

**Что читает `Lab3DPage`** (`src/pages/Lab3DPage.tsx`):
- `useSearchParams` → `params.get('exp')`. Если id неизвестен, открывается `'baso4'` (`:85-87`). Список `EXPERIMENT_IDS` (`:22`), проверка `isExperimentId` (`:56-58`).
- `q=low|high` (`:60-72`). Флаги `debugLab`, `debugHand`, `debugPerf` читаются регуляркой из `location.hash` в компонентах lab3d.
- Состояние опыта `run = {experimentId, step}` (`:89-91`); смена `exp` в адресе сбрасывает опыт на шаг 0.
- `selectExperiment` переписывает `exp` с `replace:true`, остальные параметры сохраняет (`:144-152`, `new URLSearchParams(params)`). Значит, дополнительные параметры вроде `task=…` переживут смену опыта.
- `finished = run.step >= totalSteps` (`:138`). На это реагирует только звук (`:139-141`). **Колбэка наружу нет**, ссылки «назад к задаче» нет. Есть только ссылка на `/vr-lab-classic` (`:340`).
- Мост сцены `src/components/lab3d/scene/labBridge.ts`: `boardPanEnabled`, `panBoard`, `shiftBoard`, `zoomTo` — измерений нет.

**Устаревший адрес:** `src/vrLab/lessons/vrLabLearnBridge.ts:13-19` строит `/#/vr-lab?lesson=…&reaction=…&from=learn` (используется в `src/data/learnPathways.ts:70`). Новая `Lab3DPage` эти параметры **игнорирует**, они остались от классической лаборатории.

**Где поставить кнопку:**
- тренажёр — `LearnTaskRunner.tsx` блок `taskActions` (`:219-231`), рядом с «Проверить»;
- параграф — `LearnWorkspace.tsx:142-159`;
- при желании — карточка хаба `LearnTasksHub.tsx:33-42`.

**Как передать задачу.** Задача случайная и seed нет, поэтому параметры нужно класть в адрес явно, например:

`/vr-lab?exp=co2&task=stoichiometry&m=10&from=/learn/tasks/stoichiometry`

Либо добавить seed в `generateTaskProblem`.

**Какие опыты подходят к задачам** (`Lab3DPage.tsx:22-35`):

| задача | опыт | уравнение |
|---|---|---|
| stoichiometry, oge_prep | `co2` | CaCO₃ + 2HCl → CaCl₂ + H₂O + CO₂↑ — точное совпадение |
| нет задачи на H₂ | `zn-hcl`, `h2-practical` | Zn + 2HCl → H₂ |
| нет задачи на H₂ | `metals-acids` | Mg + H₂SO₄ → H₂ |
| нет задачи на осадок | `baso4` | осадок BaSO₄ |
| ближе всего к solutions (масса соли) | `salt-purify` | очистка NaCl |

Для limiting_reagent (Fe+S), yield_impurities (разложение CaCO₃) и metal_plate (Fe + Cu²⁺) опытов нет.

Метаданные опытов (grade/page): `src/data/labWorks/labExperiments*.ts`, например `labExperimentsWorks.ts:168-169` — grade 9, page 191. Поиск по lab3d не нашёл весов или мерной посуды с числовыми показаниями; есть только шкала pH (`BoardWidgets.tsx:164`).

Масштаб: в задачах 4–22 г CaCO₃, это 0,9–4,9 л CO₂ — для школьной пробирки много. Для реалистичного режима нужны свои диапазоны.

## 4. Как засчитать результат опыта

**Прогресс ученика класса** (то, что видит учитель):
- `src/learn/learnClassRosterStorage.ts`, ключ `atomlab.moleculeClass.${sectionId}` (`:44`).
- Для тренажёра `TASKS_ROSTER_SECTION_ID = 'learn-tasks-global'` (`:6`).
- `recordStudentTaskResult(sectionId, studentId, {taskCategoryId, correct, hintsUsed, score, total})` (`:167-186`) → `kind:'task'`. Новый вид, например `'lab'`, нужно добавить в `StudentTestKind` (`:8`) и `normalizeAttempt` (`:46-68`). После записи отправляется событие `atomlab:classRosterChanged` (`:3,123`).
- Балл: `computeTaskScore` (`src/learn/learnTaskScoring.ts:3-11`) — 5 минус 1 за подсказку, не меньше 1 при верном ответе; при неверном 0.
- Нужен активный ученик (`getActiveStudent`, `:144-148`), иначе ничего не пишется (`LearnTaskRunner.tsx:61-62`).
- Графики: `src/learn/learnStudentStats.ts:49-56` (`label: a.taskCategoryId`).

**Общий прогресс:**
- `src/learn/learnProgressStorage.ts`, ключ `atomlab-learn-progress-v3` (`:3`): `completedSectionIds`, `completedLessonIds`.
- `markLessonCompleted(lessonId)` (`:131-138`).
- Образец моста: `vrLabLearnBridge.ts:4-11` (`vr-lab:${id}` → `markLessonCompleted`). Для задач можно так же использовать `lab-task:<categoryId>`.
- Отдельного счётчика решённых задач в v3 нет.

**Ловушка:** `recordedRef` сохраняет только **первую** проверку (`LearnTaskRunner.tsx:58-74`). Если ученик ошибся, а потом решил верно, засчитается ошибка.

## 5. Единицы, округление, допуски
- **Тренажёр и параграф** — `answersClose` (`learnTaskProblems.ts:35-39`):
  ```ts
  const tol = Math.max(10 ** -decimals / 2, Math.abs(expected) * 0.008 + 1e-9)
  ```
  То есть фактически ±0,8 % от эталона (минимум ±0,005 при 2 знаках). Примеры:
  - V(CO₂)=2,24 л → ±0,018 л;
  - FeS 44 г → ±0,35 г;
  - CaO ~403 г → ±3,2 г.
- Эталон округляется `roundTo` (`:30-33`) до `decimals` и показывается как `toFixed(decimals)`.
- Единицы не вводятся и не проверяются: они только в подписи поля `answerLabelKey` («Ответ (объём, л)»).
- **ChemProblemTutor**: абсолютный `tolerance` на каждую задачу — 0,02 моль; 0,5 для N, V и %; **0** для Mr (`chemProblemEngine.ts:209-259`).

**Вывод:** погрешность реального прибора (мерный цилиндр ±1 мл на 50 мл = 2 %, весы ±0,01 г на 0,5 г = 2 %) в допуск 0,8 % не уложится. Для опыта нужна отдельная функция:
- допуск = погрешность прибора + погрешность метода (или относительный 3–5 %);
- сверять расчёт ученика с **измеренным** значением, а не только с идеальным эталоном.

## 6. Ошибки и риски
1. **Хаб задач, вероятно, недоступен.** Маршруты `learn/tasks` и `learn/tasks/:lessonId` статические (`App.tsx:85-86`), поэтому `params.topicId` будет `undefined`. Проверка `params.topicId === 'tasks'` (`LearnPage.tsx:497`) не сработает, и откроется `GradesIndex` (`:513-515`). Вывод сделан по чтению кода (react-router-dom ^7.14.2), нужно проверить в браузере.
2. **Категория `formulas` выдаёт задачи на растворы.** В `generateTaskProblem` нет ветки `formulas`, срабатывает `default` → `solutions` (`learnTaskProblems.ts:295-297`). Заголовок «Составление формул», а условие про раствор; в roster пишется `taskCategoryId:'formulas'`.
3. **Ошибка в подсказке к стехиометрии** (`learnPackRu.ts:191`): «Масса CO₂ {m} г. Молярная масса CO₂ = 44 г/моль». В условии и в коде это масса CaCO₃ с M = 100.
4. **Ошибки в подсказках про пластинку** (`learnPackRu.ts:202-203`): «Масса Cu = (Δm / 56) × 64», а в коде Δm/8·64 (`learnTaskProblems.ts:116`). Шаг s2 про Кулоны к задаче не относится.
5. Задача в параграфе (`LearnWorkspace`) и `ChemProblemTutor` прогресс не сохраняют. Учитель в параграфе задачу не видит.
6. Эталон показывается сразу после первой ошибки (`LearnTaskRunner.tsx:264-268`). В режиме опыта это подсказка «до измерения».
7. Для задачи на избыток 3D-молекула `compoundId:'fe3o4'` вместо FeS (`learnTaskProblems.ts:89`).
8. Новые ключи i18n: тип `MessageKey = keyof typeof messagesRu` (`src/i18n/messagesRu.ts:1186`), поэтому каждый ключ нужно добавить в RU, EN и UZ. Задачи — `learnPackRu/En/Uz.ts`, ОГЭ — `learn/learnTeacherI18n.ts`, рабочая зона — `learn/assistantI18n.ts`, 3D-лаборатория — `messagesRu.ts:1084+` (`lab3d.*`).