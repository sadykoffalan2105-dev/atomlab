# Showcase — кинематографический слой «Как образуется»

Для избранных веществ (H₂O, CO₂, SiO₂) обычный показ дополняется сценой showcase: электронные облака настоящих форм,
светящиеся электроны, энергия связи, 3D-подписи (угол, длина, δ±, диполь), живая камера, окружение в финале.
Остальные вещества показываются как раньше (сцены нет — ничего не меняется).

## Как устроено
- `FormationCanvas.tsx`: если `showcaseSceneFor(id)` есть — рисует `Backdrop`, а сцену — **внутри** `FormationMoleculeView`
  (children группы атомов: та же система координат, что у шаров; вид по-прежнему рисует атомы и палочки, итог в конце
  показа = модель карточки → аудит B/C/E проходят автоматически). Жёлтые точки-электроны вида скрыты (`hideElectrons`),
  сцена рисует свои (`Electron` из kit) по тем же данным `story.electrons`.
- Время — только `clock.current.t` (внутри сцены — `useClockCtx()`), всё — функции t: перемотка ползунком назад
  и скорость 0,5×/1,5× работают сами собой. Положения атомов — `atomPosAt(story, i, t, out)` (formationStory.ts).
- Камера: сцена пишет `cam.current = { active, yaw, pitch, zoom, userUntil }` (types.ts), CameraRig плавно ведёт
  камеру; если пользователь крутит мышью — 3 с сцена не вмешивается.
- Длительности этапов — `durations.ts` (множители/абсолют по этапам); тексты панели и HUD-карточки фактов —
  `texts/<id>.ts` + строка в `texts/index.ts` (RU/EN/UZ: `Tri = [ru, en, uz]`).

## Добавить вещество
1. `scenes/<id>.tsx` — компонент `ShowcaseScene` (`ShowcaseProps`), статическое поле `hideElectrons` (по умолчанию true).
2. `texts/<id>.ts` — `ShowcaseTexts` (подписи этапов `stages`, карточки `hud` с окнами в долях этапа).
3. Одна строка в `registry.ts` и одна в `texts/index.ts`; при необходимости — строка в `durations.ts`.
4. Свои примитивы — новыми файлами `kit/<имя>.tsx`; общие в `kit/core.tsx` не ломать.
5. Проверки: tsc, `npx tsx scripts/audit-formation-200.mts`, `npm run test:formation-plan`, кадры всех этапов
   (`.tmp/opus/form-all.mts` с `ALL=1`), ПК и телефон, перемотка назад.

## Kit (kit/core.tsx)
`useClockCtx`, `win/seg/pulse`, `Glow`, `Lobe` (s / p / lone), `Electron` (с хвостом), `Tag`, `AngleArc`,
`MeasureLine`, `DipoleArrow`, `Burst`, `Backdrop`, `ShowcaseClock` (провайдер времени — ставит FormationCanvas).
Электроны `story.electrons`: `home`, `homeOff`, `tIn`, `tOut`, `move` (к атому `toAtom`/`toOff` или к середине связи
`bond`); положение считайте как в FormationMoleculeView (строки ~524–570) или проще — по своему сценарию, главное —
число электронов и моменты совпадают с аудитом (он проверяет данные story, не пиксели).
