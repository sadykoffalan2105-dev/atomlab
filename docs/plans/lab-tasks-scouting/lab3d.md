# 3D-лаборатория ATOMLAB (#/vr-lab): что нужно знать для промпта Opus

Корень: `C:/Users/Первый/Desktop/химия`. Все пути ниже даны от него.

**Главное:**
- **Опыт — это анимация шагов, а не симуляция.** Всё на экране зависит от одного числа «прогресс опыта» `p`. Количеств веществ (масса, объём, моли) в коде нет нигде.
- **Весы, плитка, мерный цилиндр есть только как неподвижный декор.** Весы всегда показывают «0.00 g». Бюретки, мерной колбы, газометра и 3D-термометра нет вообще.
- **Уровень жидкости задаётся в метрах высоты, а не в мл.** Перевода мл → высота нет.
- **Уже есть расхождение с текстом шага.** В опыте `co2` написано «2–3 мл известковой воды», а в 3D налито около 10,6 мл.

## 0. Карта файлов (число строк)

**Контракт и шина событий:**
- `src/components/lab3d/labContract.ts` — 140
- `src/components/lab3d/labEvents.ts` — 105

**Ядро опыта:**
- `experiments/ExperimentRig.tsx` — 346
- `experiments/rigCore.tsx` — 266
- `experiments/rigTargets.ts` — 335
- `experiments/rigGuides.tsx` — 148

**Доска:**
- `experiments/BoardPanel.tsx` — 290
- `experiments/BoardWidgets.tsx` — 341
- `experiments/BoardStory.tsx` — 328

**Детали установок (`parts/`):**
- `glassware.tsx` — 405
- `practicalware.tsx` — 839
- `effects.tsx` — 397
- `fire.tsx` — 444

**Установки (`rigs/`):**
- 10 установок `*Rig.tsx` (`Co2Rig` — 261, `MetalsAcidsRig` — 312)
- `worksKit.tsx` — 262
- `useGearStep.ts` — 36

**Данные опытов:** `src/data/labWorks/`
- `labExperiments.ts` — 722
- `labExperimentsPractical.ts` — 578
- `labExperimentsWorks.ts` — 557
- `labExperimentMatch.ts` — 65

**Рука и предметы:** `interaction/labHandStore.ts` (375), `interaction/labItems.ts` (225), `interaction/LabItemModels.tsx`

**Сцена:** `scene/Lab3DCanvas.tsx`, `scene/LabEquipment.tsx` (декор), `scene/labPerf.tsx`, `scene/BoardPlaceholder.tsx`

**Страница:** `src/pages/Lab3DPage.tsx`

**Тесты и проверки:**
- `scripts/test-lab3d-experiments.mts` (`npm run test:lab3d`, `package.json:69`)
- `.tmp/opus/gesture-v4.mjs` (последний прогон — `.tmp/opus/gesture-v8.txt`)

**Чего нет:**
- Отдельных документов `lab3d*` в `docs/plans` нет.
- `docs/QA_LAB_SYNTHESIS.md` относится к другой лаборатории (реактор), к этой не подходит.
- `test:lab3d-visibility` тоже проверяет реактор (`src/lab/lab3dVisibilityEngine`).

## 1. Как устроен один опыт

**Координаты (`labContract.ts`):**
- Метры, ось Y вверх.
- `BENCH_TOP_Y = 0.9`, `WORK_AREA_CENTER = (0, 0.9, 0)`, `WORK_AREA_SIZE = {w: 1.3, d: 0.6}` (строки 15–19).
- Вытяжной шкаф: `HOOD_WORK_CENTER (-2.05, 0.9, -0.86)`, `HOOD_WORK_SIZE {0.95 × 0.5}` (24–25).
- Доска: `BOARD_CENTER (0, 1.62, -1.15)`, HTML доски 1280×720 (31–34).

**Описание опыта `LabExperimentDef` (52–73):**
- `id, source, title, equation, steps, equipment, safety, conclusion` — тексты `LabText {ru, en, uz}`.
- `kind` — только `'exchange' | 'combustion' | 'substitution' | 'physical' | 'combination'`.
- `grade` — только `7 | 8 | 9`; `page` — страница учебника.
- `place?: 'bench' | 'hood'`, `gear?: ('goggles' | 'gloves' | 'coat')[]`.

**Шаг `LabStepDef` (75–83):** `{ id, instruction, observation?, target? }`.

**Цепочка «данные → результат»:**

1. **Данные.** Пример — `labExperimentsWorks.ts:158–254`, опыт `co2`, 9 шагов. Шаг выглядит так:
   ```ts
   { id: 'limewater', target: 'outlet',
     instruction: t('Опустите конец трубки в пробирку с 2–3 мл известковой воды.', …),
     observation: t('Известковая вода мутнеет — выпадает белый CaCO₃↓. …', …) }
   ```
   Действие руками для каждого шага лежит в `LAB_WORKS_STEP_ACTIONS` (396–432): `{gesture: 'tap'|'drag'|'swipe', how: LabText, need?: LabItemId}`, например `drag(t('Возьмите склянку HCl…'), 'reagent:HCl')`. Всё сливается в `LAB_STEP_ACTIONS` (`labExperiments.ts:498–537`).

2. **Геометрия жестов (`rigTargets.ts`).**
   - `RIG_TARGETS` (15–26) — список имён целей установки.
   - `RIG_STEP_SECONDS` (29–40) — длительность анимации каждого шага.
   - `RIG_GESTURES` (56–196) — для каждого шага `tap` или `drag/swipe(from, to, lead)` в локальных метрах.
   - `RIG_FOCUS` (206–260) — крупный план камеры `{from, to, point, dist}` по значению `p`.
   - `RIG_LABELS` (271–335) — 3D-подписи наблюдений `{at: p, pos, text}`, исчезают через 3 с.

3. **Раннер (`ExperimentRig.tsx`).**
   - Таблица `RIGS: Record<LabExperimentId, ComponentType>` (32–43).
   - `p` — непрерывный прогресс: целая часть = число выполненных шагов.
   - `act(name)` засчитывает шаг, только если `def.steps[s].target === name` (161–170).
   - `play(s)` плавно ведёт `p` от s к s+1 за `RIG_STEP_SECONDS`, в конце вызывает `onAdvance()` (112–159).
   - При drag/swipe палец ведёт `p` до `s + k·lead`. Отпустил дальше половины пути (`RELEASE_OK = 0.5`) или дотянул до «магнита» (`MAGNET = 0.9`) — шаг засчитан (46–47, 188–237).
   - Если у шага есть `need`, раннер публикует `labEvents 'need'`; событие `picked/placed` этого предмета вызывает `act` (285–301).
   - Крупный план — через `labEvents 'focus'` (305–322).

4. **Детали установки (`rigCore.tsx`).**
   - Математика: `seg`, `ease`, `hill`, `mix`, `mixV` (47–62).
   - `<Pose pose={(p, t) => ({pos, rot, scale})}>` — положение группы считается из `p` каждый кадр (71–89).
   - `<Target name size center hintY ring>` — невидимая зона нажатия ≥ 7 см, подсветка и подпись «Нажмите / Перетащите / Проведите» (168–241).
   - Хелперы: `useAnimatedMaterial`, `useCrossing(threshold, fn)`, `useSoundAt(threshold, name, local, gain)` (244–266).

5. **Проверка шага.** Отдельной «проверки правильности» нет: шаг засчитывается, когда нажата или дотянута нужная цель. Тест проверяет только согласованность данных.

6. **Наблюдения.**
   - На доске (`BoardPanel.tsx:255–261`) показывается `observation` последнего выполненного шага.
   - Ниже — `<Instrument>` (`BoardWidgets.tsx:125–306`): ветки `if (experimentId === …)` с HTML-«приборами» (термометр, шкала pH, таблицы), зависят от `step` и `inStep` (секунды с начала шага).
   - После опыта: `ParticleStory` + `ScoreCard` (звёзды за ТБ и аккуратность) + `LabQuiz` (3 вопроса: sign/type/product).

**Пример установки (`Co2Rig.tsx`):**
- Уровни жидкости — функции `p`, например `pourLevel(2, 0.034)` (46). Муть известковой воды: `cloud = ease(p, 4.62, 4.98) * (1 − ease(p, 5.2, 5.92))` (49).
- Цель задаётся так: `<Target name="marble" …/>` внутри `<Pose>` (175).
- Склянка: `bottlePose(HCL, [[2, REACT_X, Z, R_TOP + 0.03]])` (134).
- Звуки: `useSoundAt(2.52, 'fizz', …)` (120–132).

**Пример `MetalsAcidsRig.tsx`:**
- Окна нагрева внутри одного шага: `HEAT2 = [9.04 … 9.57]` (42–43).
- Скорость пузырьков: `rateMg`, `rateZn` (49–51).
- Пламя спиртовки: `lampFlame` (52).

**Шаг «надеть защиту»** (`useGearStep.ts`): публикует `'needGear'`, ждёт события `'safety'`; если всё уже надето — засчитывает шаг через 700 мс.

**События шины (`labEvents.ts:47–66`):** `picked`, `placed{zone: work|bench|shelf}`, `focus`, `focusReset`, `need`, `hint`, `safety`, `needGear`, `sound{name}`, `fire{on, at}`.

**Звуки (`labAudio.ts:199–276`):** `glass-place`, `glass-clink`, `pour`, `fizz`, `bubble`, `flame-on`, `flame-loop`, `pop`, `door-open/close`, `drawer`, `click`, `hood-fan`, `splash`, `sizzle`, `success`, `error`. Все синтезируются через WebAudio.

## 2. Какие предметы и приборы есть, и чего нет

**Предметы на полках и в шкафах** (`labEvents.ts:12–39`, каталог `labItems.ts:78–108`):
- Реактивы (13): `HCl, H2SO4, BaCl2, Zn, NaOH, CaO, CuO, CuSO4, Fe, Al, NaCl, C2H5OH, CaOH2` (с префиксом `reagent:`).
- Посуда: `glass:testTube, beaker, conicalFlask, roundFlask, cylinder (мерный цилиндр, r 0.035, h 0.26), funnel, porcelainDish, watchGlass`.
- Инструменты: `tool:spiritLamp, splint, matches`.
- Mg, Cu, CaCO₃ в каталоге нет: они нарисованы прямо в установках (`Shavings`, `MarblePieces`).

**Детали для установок (`parts/`, `worksKit`):**
- `glassware.tsx`: `TestTube` (Ø18×150 мм), `Beaker` («100 мл», `BEAKER_R 0.026`, `H 0.072`, 4 белые риски без цифр), `ReagentBottle`, `TubeRack`, `LabStand` (лапка), `WatchGlass`, `GlassPlate`, `ZnGranule`, `TubeTag`.
- `practicalware.tsx`: `RingStand`, `Funnel`, `FilterPaper`, `PorcelainDish`, `Mortar`, `Pestle`, `GlassRod`, `Pipette`, `DropperBottle`, `ColorTube`, `LitmusStrip`, `PpeTray`, `GlassPath`, `Puffs`, `Falling`, `LiquidColumn`, `WaftHand`, `GripHand`, `WhiteCard`.
- `effects.tsx`: `Bubbles`, `Precipitate`, `Droplets`, `PourStream`, `PopFlash`, `StopperWithTube`, `HeatHaze`, `GasFill` (газ в перевёрнутой пробирке, `fill` 0…1, 365–397).
- `fire.tsx`: `Flame`, `FlameLight`, `SpiritLamp`, `GasBurner`, `GasTap`, `Hose`, `Match`, `Matchbox`.
- `worksKit.tsx`: `MilkFill`, `bottlePose`, `pourShow`, `pourLevel`, `pipettePose`, `Shavings`, `MarblePieces`, `PowderHeap`, `Spatula`, `RubberHose`.

**Декор сцены (`scene/LabEquipment.tsx`)** — без интерактива, вне рабочего места, на столешнице у мойки:
- `Scales` (320–337): дисплей — статичная текстура `scalesDisplayTexture()` с надписью «0.00 g» (`labTextures.ts:399–409`).
- `HotPlate` (301–318).
- `GraduatedCylinder` (192–204): вода фиксированного уровня, делений нет.
- Риски на мерной посуде в руке — `Marks` в `LabItemModels.tsx:161–171` (у `glass:cylinder` 11 рисок, у `glass:beaker` 5, без цифр).

**Чего нет для расчётных задач:**

| Прибор | Состояние |
|---|---|
| Весы | только декор, «0.00 g», не связаны с опытом |
| Мензурка / мерный цилиндр с цифрами и отсчётом объёма | нет (риски без цифр, уровни не в мл) |
| Мерная колба | нет |
| Бюретка | нет |
| Газометр, мерная трубка над водой, ванна для сбора газа | нет (есть только `GasFill` в пробирке — доля 0…1) |
| 3D-термометр | нет (только HTML на доске: `salt-purify` — `BoardWidgets.tsx:126–155`; формула t °C у `water-oxides` — 233) |
| Плитка | только декор |

## 3. Как рисуется жидкость

- **`TestTube` (`glassware.tsx:80–135`):**
  - `level: PFn` — высота от дна в метрах.
  - Геометрия: полусфера радиуса `ri = TUBE_R · 0.86 = 7.74 мм` плюс цилиндр, растянутый по `scale.y`, плюс тор-мениск.
  - `liquidColor`; `cloud: PFn` 0…1 — цвет плавно уходит к `#dde3ea`, растут непрозрачность (0.62 → 0.94) и матовость.
- **`ColorTube` (`practicalware.tsx:439–513`):** этапы `[pStart, pEnd, color]` — новый цвет растекается сверху вниз.
- **`LiquidColumn` (729–752):** цилиндр радиуса `r`, `level`, `color`, `cloud` → `cloudColor` (для стаканов).
- **`ReagentBottle`:** `level` — доля 0…1 от столбика 0.058 м.
- **Пузыри — `Bubbles` (`effects.tsx:24–69`):** `level`, `rate(p)` 0…1, `fromY`, `spread`; instanced 70 шт. на высоком качестве и 26 на низком.
- **Осадок:** `Precipitate (level, appear, settle, layer)`. Муть: `MilkFill`. Капли и крупинки: `Falling`.

**Можно ли задать уровень в мл:** напрямую нет. Пересчёт для пробирки:

V(мл) ≈ 0,97 + 0,1882 · (h_мм − 9), где 0,1882 мл/мм = π·ri².

| Где | Высота в коде | Объём в 3D | Текст шага |
|---|---|---|---|
| `co2`, известковая вода | `LEVEL = 0.06` м | ≈ 10,6 мл | «2–3 мл» |
| `metals-acids` | `LEVEL = 0.044` м | ≈ 7,6 мл | — |

Для стакана примерно 2,1 мм на 1 мл (внутренний r ≈ 0.0255).

Новому режиму нужна функция «мл → высота» для каждой формы сосуда и цифровые шкалы.

## 4. Чек-лист добавления нового опыта

TypeScript требует запись во всех таблицах вида `Record<LabExperimentId, …>`, поэтому пропущенное место — ошибка компиляции.

1. `labContract.ts:39–50` — добавить id в `LabExperimentId`. При необходимости расширить `kind` и `grade` (сейчас только 7|8|9).
2. `src/data/labWorks/` — новый файл по образцу `labExperimentsWorks.ts`: описание опыта, `*_STEP_ACTIONS`, `*_SIDE_EQUATIONS`, `*_STORY`, `*_QUIZ`. Подключить в `labExperiments.ts`:
   - `LAB_EXPERIMENTS` (449–451);
   - `LAB_EXPERIMENT_GROUPS` (455–462) — тест требует, чтобы каждый опыт был в группах ровно один раз;
   - `LAB_SIDE_EQUATIONS`, `LAB_STEP_ACTIONS`, `LAB_PARTICLE_STORY`, `LAB_QUIZ`.
3. `rigTargets.ts` — записи в `RIG_TARGETS`, `RIG_STEP_SECONDS`, `RIG_GESTURES`, `RIG_FOCUS`, `RIG_LABELS`.
4. `experiments/rigs/<Name>Rig.tsx` — каждая цель как `name="…"` (тест ищет её регэкспом `(name|target)="…"`). Добавить в `RIGS` в `ExperimentRig.tsx:21–43`.
5. `BoardWidgets.tsx` → ветка в `Instrument` (по желанию).
6. `scene/BoardPlaceholder.tsx` → `NAMES` и `EQUATIONS` (9–33).
7. `src/pages/Lab3DPage.tsx` → `EXPERIMENT_IDS` (22, проверки типов нет — легко забыть), `FALLBACK_EQUATION` (24–35), `KIND` (36–47).
8. По желанию: `labExperimentMatch.ts` → `CHIP_EQUATIONS` (кнопка «3D-опыт →»); i18n `lab3d.exp.<id>.source/title` в `messagesRu/En/Uz.ts` (сейчас только для 4 старых опытов, `messagesRu.ts:1086–1093`; это запасной вариант, если данных опыта нет).
9. `scripts/test-lab3d-experiments.mts` — **списки жёстко прописаны**, их надо дополнять:
   - `ids` (38), `PAGES` (41), `KINDS` (42–53), `GRADES` (54), `HOOD` (56);
   - `typeWant` (151), `order` (192–199), `RIG_FILES` (236–247).

   Что проверяет тест:
   - тексты на 3 языках, русский ≠ английский;
   - уравнения уравнены (`equationImbalance`);
   - 4–11 шагов, у каждого цель из `RIG_TARGETS`, каждая цель используется;
   - число длительностей, действий и жестов = числу шагов; жест в данных = жесту установки;
   - путь жеста ≥ 0,05 м, `lead ∈ (0, 1]`, точки внутри рабочего места (|x| ≤ w/2, |z| ≤ d/2, 0 ≤ y ≤ 0,5);
   - не меньше 2 жестов drag/swipe;
   - есть хотя бы один крупный план и одна подпись, все в пределах опыта;
   - викторина ровно `sign, type, product`, у каждого вопроса ≥ 3 варианта;
   - `need` — существующий id предмета.
10. `.tmp/opus/gesture-v4.mjs` — список опытов прописан в строке 11, `SHOTS` — в строке 10.
11. Новый реактив или посуда на полках: `LAB_REAGENT_IDS / LAB_GLASS_IDS` (`labEvents.ts`) + каталог `REAGENTS / GLASS` (`labItems.ts`) + модель в `LabItemModels.tsx`.

## 5. Производительность и проверки

**Свет (`Lab3DCanvas.tsx:147–172`):**
- Постоянные источники: hemisphere, sun, directional, `hoodSpot` (только на высоком качестве), `FlameLightPool`.
- Пул пламени — `FLAME_LIGHT_SLOTS = 2` (`fire.tsx:169–205`). `FlameLight` только занимает слот и свой источник не создаёт (207–243).
- Причина: новый источник меняет ключ шейдеров, и пересобираются все программы сцены.

**RenderGate (`labPerf.tsx:35–83`):**
- Ключ `${experimentId}:${quality}`; используется `gl.compileAsync(scene, camera)`, тайм-аут 6000 мс.
- Пока шейдеры собираются, кадр не рисуется (на Windows/ANGLE сборка одной программы — сотни мс).
- Контактные тени «запекаются» на 45 кадров, а не рисуются каждый кадр (`ContactShadowBake`, 86–103).

**Замер:** `#/vr-lab?debugPerf=1` → `window.__labPerf.info()` возвращает `{geometries, textures, programs, calls, triangles, dpr}` (105–125). Цифру «programs ≤ ~50» в репозитории не нашёл — это ваша договорённость, её стоит указать в промпте явно.

**Правила экономии из кода:**
- Одно общее стекло `sharedGlass(q)` и один общий шейдер контура `sharedGlassEdge()` на всю установку (`glassware.tsx:11–44`).
- Instanced-меши для частиц.
- Качество `low` — без преломления (transmission 0), меньше сегментов и частиц.
- Надписи — `CanvasTexture`, без сетевых шрифтов.

**Отладка в браузере:**
- `?debugLab=1`: `window.__labGesture()` — экранные точки текущего жеста; `window.__labRig` — `setP(v)`, `audit()` (`rigAudit`: «сквозь стекло» / «висит»), `selfTest()`, `view(pos, target)` (`ExperimentRig.tsx:241–282`).
- `?debugHand=1`: `window.__labHand` (`labHandStore.ts:372–375`).

**Скрипты:**
- `npm run test:lab3d` — данные и согласованность.
- `node .tmp/opus/gesture-check.mjs <port> [id]` (то же в `gesture-v4.mjs`): Playwright с `--use-angle=d3d11`, окно 1280×800, открывает `#/vr-lab?exp=<id>&debugLab=1&debugHand=1` и проходит все шаги как ученик. Нужен запущенный dev-сервер.
- Последний прогон `gesture-v8.txt`: все 10 опытов прошли все шаги без единого «✗».