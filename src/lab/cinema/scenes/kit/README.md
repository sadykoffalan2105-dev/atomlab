# ATOMLAB Cinema — общий набор для научных сцен (`scenes/kit`)

Набор, на котором собираются все сцены синтеза: `nacl`, `co2`, `h2o`, `nh3`, `so2`, …
Он снимает с автора сцены всё, что одинаково, и оставляет ему только химию и раскадровку.

**Эталон**: `scenes/nacl/*` — полностью построена на этом наборе.
**Шаблон для копирования**: `scenes/kit/template/` (минимальная рабочая сцена, ~30 строк рендера).

---

## Железные правила

1. **Ни одного числа химии в сцене.** Радиусы, длины связей, углы, параметры ячеек,
   энтальпии — только из `src/chemistry/data/*` через `cpkAtoms.ts` / `energyLadderData.ts` /
   `getCrystal()` / `BORN_HABER`. Правка числа делается ТАМ, иначе сцена, панель и тест разъедутся.
2. **Простые вещества в реальном состоянии при 25 °C / 1 атм.** H₂, N₂, O₂, F₂, Cl₂, Br₂, I₂ —
   ДВУХАТОМНЫЕ молекулы; металлы — атомы в металлической решётке; углерод — графит;
   сера — S₈; фосфор — P₄. Никаких одиночных атомов хлора «на старте».
3. **Размер частицы честный.** `speciesRadius(symbol, charge)`: катион МЕНЬШЕ атома,
   анион БОЛЬШЕ. Радиус меняется РОВНО в кадр прихода электрона — `octetSnap(tArrive, rBefore, rAfter)`
   из `valence.ts` с тем же `tArrive`, что у `sampleElectronJump` (старый `rampTrack` — плавное окно, для новых сцен не годится).
4. **Никаких выдуманных частиц** («Cl²⁻» не существует). Полуреакции сводятся по электронам И по заряду.
5. **В 3D — только формулы, заряды, числа и символы единиц.** Никаких фраз. Единицы и
   агрегатные состояния — в соглашении учебника текущего языка через токены (`{pm}` → «пм» на ru,
   «pm» на en/uz; `{g}` → «г.» / «g» / «gaz»), формулы и заряды (`Na⁺`, `Cl₂`, `ΔH°f`) не переводятся.
   Все словесные пояснения живут в `<id>MechanismText.{ts,en.ts,uz.ts}` и показываются панелью урока.
6. **Схематичное — назвать схематичным.** Светящаяся оболочка, «полёт» электрона, фрагмент
   решётки вместо 10²³ ионов: это идёт в поле `note` текста шага.

---

## Что нужно написать для новой сцены

```
src/lab/cinema/scenes/<id>/
  <Id>Steps.ts            — шаги, хронометраж, события (cue)
  <Id>Storyboard.ts       — чистая sampleFrame(t) на дорожках + validate<Id>Storyboard()
  <Id>CinemaScene.tsx     — R3F-рендер на SceneShell
  <Id>MechanismText.ts    — тексты ru (+ .en.ts, .uz.ts)
  <Id>Energetics.ts       — лестница энергии из thermoData
scripts/test-<id>-cinema.mts
```

Плюс ОДНА строка в `src/lab/scientificSynthesis/registry.ts` (id продукта из `compoundById`)
и ОДНА запись в `src/lab/cinema/scenes/lessons.ts` (тексты для панели шагов).

---

## (a) Шаги и события — `defineSceneTiming`

```ts
import { defineSceneTiming, type SceneFinish, type SceneStep } from '../kit/sceneKit'

export const CO2_STEP_IDS = ['reactants', 'collide', 'bonds', 'product', 'energy', 'summary'] as const
export type Co2StepId = (typeof CO2_STEP_IDS)[number]

const STEPS: readonly SceneStep<Co2StepId>[] = [
  { id: 'reactants', from: 0, to: 4, wall: 4.6, ease: 'power1.inOut' },
  // …  from следующего шага ОБЯЗАН равняться to предыдущего
]
export const CO2_FINISH: SceneFinish = { from: 24, to: 24.8, wall: 1.2, ease: 'power2.in' }

export const CO2_TIMING = defineSceneTiming<Co2StepId, Co2CueId>({
  steps: STEPS,
  finish: CO2_FINISH,
  cues: [
    { at: 6.0, id: 'collide' },
    // …
    { at: 24.2, id: 'embryo' },   // ← контракт лаборатории
    { at: 24.5, id: 'birth' },    // ← без них лаборатория ЗАВИСНЕТ
    { at: 24.8, id: 'complete' }, // ←
  ],
})
```

* `from`/`to` — **время сюжета**, `wall` — **экранные секунды** (wall > to − from = slow-motion).
* На границе `to` пошаговый режим встаёт на паузу — границы шагов совпадают с сегментами.
* Требования: 6 ± 1 шаг, суммарный `wallDuration` **26–34 с**.
* `CO2_TIMING.validate()` проверяет непрерывность шагов, порядок cue и наличие
  `embryo → birth → complete`. Зовите его в тесте (и `SceneShell` зовёт сам в dev).

## (b) Дорожки — `<Id>Storyboard.ts`

Движение — ОДНА дорожка на объект на всю сцену, а не «если фаза 2, то…»:
разрывов на границах шагов не бывает по построению.

```ts
import { sampleScalar, sampleVec3, windowFade, type Vec3Track } from '../../core/tracks'
import { appearTrack, fadeTrack, rampTrack, validateTracks } from '../kit/sceneKit'
import { speciesRadius, bondLength, pmToScene } from '../kit/cpkAtoms'

const POS: Record<AtomId, Vec3Track> = {
  o1: [
    { t: 0, v: [2.4, 0.6, 0] },
    { t: 6, v: [0.7, 0.2, 0], ease: 'smooth', arc: 0.2 }, // arc — баллистическая дуга
  ],
}

// Радиус меняется ровно в момент перехода электрона:
const RADIUS_NA = rampTrack(tLeave, speciesRadius('Na', 0), tArrive + 0.2, speciesRadius('Na', 1))

export function sampleCo2Frame(t: number, frame: Co2Frame): Co2Frame { /* пишет в frame, без аллокаций */ }
export function validateCo2Storyboard(): void {
  validateTracks({ ...POS, RADIUS_NA })      // ключи строго по возрастанию t
  // + свои проверки химии (чередование зарядов, отношения радиусов, число рёбер)
}
```

Скорость: между соседними кадрами 1/30 с видимый атом не должен смещаться больше чем на
**0.09** мировых единиц — это проверяет `assertNoPositionJumps()` в тесте. Практика:
`ease: 'smooth'` вместо `outCubic` на быстрых перелётах, длительность ≥ 1.2 с на 1 единицу пути.

## (c) Частицы и электроны

```ts
import { speciesRadius, cpkHex, bondLength, writeAtom, writeBond, commitPool, speciesLabel } from '../kit/cpkAtoms'
import { createElectronJump, sampleElectronJump, drawElectron, drawElectronShell, drawFieldLine } from '../kit/electronFx'

speciesRadius('Na', 0)   // металлический 186 пм → мировые единицы
speciesRadius('Na', 1)   // ионный 102 пм  (катион МЕНЬШЕ)
speciesRadius('Cl', -1)  // ионный 181 пм  (анион БОЛЬШЕ, в 1.78 раза крупнее Na⁺)
bondLength('Cl-Cl')      // 198.8 пм → мировые единицы
pmToScene(564.02)        // любое расстояние из справочника

// в кадре:
writeAtom(world.atoms, i, { pos, radius, colorHex: cpkHex('Cl'), charge, emissive, opacity })
writeBond(world.bonds, j, { a, b, radius: 0.05, colorA, colorB, stress, thinning, split: 0 /* гомолиз */ })
commitPool(world.atoms, n)

// электрон: внутри gp.begin() … gp.end()
sampleElectronJump(el, t, { donor, acceptor, shellRadius, acceptorRadius, leave, arrive, arcSign: 1 })
drawValenceCloud(gp, donorPos, shellR, 1, amount, elapsed) // валентные электроны точками (valence.ts)
drawElectron(gp, el, elapsed)                             // электрон со следом
drawFieldLines(gp, plusIon, minusIon, amount, elapsed)    // дуги поля (bondVisual.ts, закон Кулона)
// устарели, оставлены для существующих сцен: drawElectronShell (кольцо), drawFieldLine (прямой отрезок)
```

## (c1) Единый визуальный язык — какой модуль когда

Всё ниже опционально: сцена, которая этого не зовёт, выглядит как раньше.

| Что показать | Модуль | Как |
|---|---|---|
| Материал вещества | `materials.ts` | `writeAtom(pool, i, { …, surface: materialFor('metal' \| 'ion' \| 'covalent' \| 'polar' \| 'gas') })`. Металл в решётке — `metal`, ион в кристалле — `ion`, молекула — `covalent`, каркас δ+/δ− (SiO₂) — `polar`, реагент-газ (H₂, O₂, Cl₂) — `gas`. Материал меняется в тот же кадр, что и заряд (Na → Na⁺: `metal` → `ion`), шейдер один. |
| Валентные электроны | `valence.ts` | `drawValenceCloud(gp, center, r, count, amount, elapsed, { skip })` — N точек по Льюису (Na 1, O 6 = 2 пары + 2 неспаренных, Cl 7). `count` сцена считает сама: `ATOMIC_DATA[el].valenceElectrons − charge`. Вместо `drawElectronShell` (кольцо 28 точек — устарело). |
| Перенос электрона | `electronFx.ts` + `valence.ts` | `sampleElectronJump(el, t, { …, view })` возвращает `arrived`; в тот же кадр: облако донора `amount = 0`, облако акцептора — октет, радиусы — `octetSnap(arrive, …)`. `view` — направление к зрителю в системе рига: дуга всегда в плоскости экрана. |
| σ / π / ионная / водородная / металлическая | `bondVisual.ts` | В начале кадра `resetBondVisuals(world)`, затем `writeBondVisual(world, i, a, b, kind, order, amount, planeNormal?, { colorA, colorB, gp, elapsed })`. `double`/`triple` — σ-трубка + π-лепестки над и под осью (`world.lobes`, рисует SceneShell); `ionic` — дуги поля точками (нужен `gp`, звать внутри `gp.begin()…end()`), трубки нет; `hbond` — нейтральный неподвижный пунктир. Ёмкость лепестков — `buildSceneWorld({ lobes })`, по `bondVisualLobeCount(kind)`. |
| Камера | `camera.ts` | `const CAM = shotTrack([{ t, zoom, yaw, pitch, target }, …, ...orbitTrack(t0, t1, yaw0, yaw1, pitch)])`, в кадре `sampleShot(CAM, ctx.t, ctx.camera)`. В тесте — `assertCameraContinuity((t) => sampleShot(CAM, t, cam), end)`. |
| Геометрия молекул | `core/vsepr.ts` | `writeTrigonalPlanar` (SO₃), `writeDihedral` (H₂O₂: a=H, b=O, c=O, d=H), `writeBridged` (Mn₂O₇, Cl₂O₇, SiO₄–O–SiO₄). Длины и углы — только аргументами из `bondData`. |
| Прогрев | `useSceneWarmup.ts` | Включён в SceneShell по умолчанию (`warmup`): compileAsync рига до шага 0. Новый слой R3F в `children` монтируйте `visible`, а «пусто» выражайте нулём отрисовки (instanceCount 0 / drawRange 0). |
| Подписи | `CinemaDomLabels` | SceneShell сам зажимает подписи в свободную область (не под панель) и разводит пересечения (`labelLayout`). |

Сцена микромира тёмная в обеих темах приложения (как поле микроскопа) — цвета элементов и
подписей рассчитаны на тёмный фон; панели и карточки вне Canvas обязаны читаться в обеих темах.

## (c2) Подписи в 3D — ОБЯЗАТЕЛЬНО через токены (ru/en/uz)

Раскадровка чистая и про язык не знает, поэтому **состояния вещества и единицы пишутся
токенами**, а сцена подставляет язык один раз за кадр. Зашивать `(s)`, `pm`, `kJ/mol`
в текст подписи нельзя — тест сцены это ловит.

Доступные токены: `{s}` `{g}` `{l}` `{aq}` `{pm}` `{nm}` `{kJmol}` `{kJ}`
(словарь — `SCENE_LABEL_TOKENS` в `sceneKit.ts`; формулы вроде `NaCl`, `Cl₂`, `Na⁺`
интернациональны и НЕ переводятся).

```ts
// <Id>Storyboard.ts — только токены:
{ id: 'nacl', kind: 'species', anchor: 'cube', dy: -2.1,
  keys: [{ t: 0, text: 'NaCl ({s})' }], windows: [[18.4, 24.6]] },
{ id: 'cell', kind: 'delta', anchor: 'cube', dy: 2.7,
  keys: [{ t: 0, text: `a = ${CELL_PM} {pm}` }], windows: [[18.2, 24.4]] },
```

```tsx
// <Id>CinemaScene.tsx — перевод НА МЕСТЕ, сразу после выборки кадра:
import { localizeSceneLabels, toSceneLocale } from '../kit/sceneKit'
import { useLocale } from '../../../../i18n/useLocale'

const sceneLocale = toSceneLocale(useLocale().locale)

const onFrame = (ctx: SceneFrameCtx) => {
  sampleCo2Frame(ctx.t, frame)
  localizeSceneLabels(frame.labels, sceneLocale)   // ← строго здесь
  …
}
```

**Почему именно так:** `frame.labels` — один и тот же массив, который мутируется каждый
кадр; `CinemaDomLabels` держит на него ссылку. Если перевести через `.map()` в теле
компонента, получится НОВЫЙ массив, и подписи замрут на первом кадре.

Развести подписи по высоте: у соседних подписей одного якоря `dy` должны отличаться
минимум на ~0.5, иначе они налезают друг на друга (у NaCl `a = …` и КЧ).

## (d) Лестница энергии

```ts
// <Id>Energetics.ts — чистый TS, читается в Node
import { buildBornHaberLadder, assertLadderMatchesFormation } from '../kit/energyLadderData'

export const CAO_LADDER = buildBornHaberLadder('cao', {
  sublimation: 2.4, dissociation: 6.0, ionization1: 9.0, ionization2: 9.6,
  affinity1: 11.0, affinity2: 11.4, lattice: 19.0,     // время сюжета каждой ступени
})
export function validateCaoEnergetics() { assertLadderMatchesFormation(CAO_LADDER, 5) }
```

```tsx
// панель урока
<EnergyLadder ladder={CAO_LADDER} text={{ unit, stages, total, caption, sources, summary }} compact={isMobile} />
```

Ступень подсвечивается сама, когда сюжет доходит до её `at` (через `cinemaPlayhead`).
Знаки приходят из `thermoData` и не подправляются: ΔH_суб > 0, ½D > 0, IE > 0,
EA₁ < 0 (EA₂ кислорода > 0), U_реш < 0.

## (e) Контракт лаборатории — `SceneShell`

`SceneShell` сам держит часы по шагам, мост к панели урока и cue'ы. Обязательно:
cue `embryo` → `onEmbryoReady()`, `birth` → `onBirthReady()`, `complete` → `onComplete()`.

## (f) Тест `scripts/test-<id>-cinema.mts`

Минимум, который обязан пройти (`npx tsx scripts/test-<id>-cinema.mts`, запись в `package.json`):

1. `TIMING.validate()` — шаги непрерывны, cue упорядочены, есть embryo → birth → complete;
2. `wallDuration` в диапазоне 26–34 с, шагов 6 ± 1;
3. `validate<Id>Storyboard()` — дорожки монотонны, химия фрагмента верна;
4. `assertNoPositionJumps()` — нет скачка > 0.09 между выборками 1/30 с;
5. тексты есть в ru/en/uz для каждого шага (title, body, equation, speak);
6. уравнение показанной реакции сбалансировано по атомам И по заряду;
7. `assertLadderMatchesFormation()` — сумма цикла = табличная ΔH°f;
8. подписи локализуются: все токены из `labelTokensUsed(LABELS)` есть в
   `SCENE_LABEL_TOKENS.ru`, а после `localizeSceneLabels(createLabelStates(LABELS), locale)`
   для ru/en/uz не остаётся `{…}` и ru ≠ en.

```ts
for (const locale of ['ru', 'en', 'uz'] as const) {
  const states = createLabelStates(CO2_LABELS)
  localizeSceneLabels(states, locale)
  for (const st of states) assert(!/\{\w+\}/.test(st.text), `${locale}: ${st.id}`)
}
```

---

## Минимальная сцена (полный рендер — 30 строк)

```tsx
import { buildSceneWorld, setGlow, useSceneRuntime } from '../kit/sceneKit'
import { SceneShell, type SceneFrameCtx } from '../kit/SceneShell'
import { commitPool, cpkHex, writeAtom } from '../kit/cpkAtoms'
import type { ScientificSynthesisFxProps } from '../../../scientificSynthesis/types'
import { ATOMS, createFrame, sampleFrame, TIMING, validateStoryboard } from './demoStoryboard'

export function DemoCinemaScene(props: ScientificSynthesisFxProps) {
  const { world, frame } = useSceneRuntime(() => ({
    world: buildSceneWorld({ atoms: ATOMS.length, bonds: 8, glows: [{ id: 'exo', color: 0xffb264, radius: 0.9 }] }),
    frame: createFrame(),
  }))

  const onFrame = (ctx: SceneFrameCtx) => {
    sampleFrame(ctx.t, frame)
    for (let i = 0; i < ATOMS.length; i++) {
      const a = ATOMS[i]!
      writeAtom(world.atoms, i, { pos: frame.atoms[a.id], radius: frame.radius[a.id], colorHex: cpkHex(a.el) })
    }
    commitPool(world.atoms, ATOMS.length)
    setGlow(world, 'exo', frame.center, frame.exo)
    ctx.camera.zoom = frame.camera.zoom
  }

  return (
    <SceneShell
      {...props}
      lesson="demo"
      timing={TIMING}
      world={world}
      labels={frame.labels}
      onFrame={onFrame}
      validate={validateStoryboard}
    />
  )
}
```

`lesson` — id урока для панели шагов: добавьте запись в `scenes/lessons.ts`
(тип `CinemaLessonId` — обычная строка, union расширять не нужно).

Рабочий пример целиком — `kit/template/DemoCinemaScene.tsx` + `kit/template/demoStoryboard.ts`.

---

## Три правила, на которых падает сборка

ESLint проекта включает `react-hooks/immutability` и `react-hooks/refs`. Мир сцены
и буфер кадра ИЗМЕНЯЕМЫЕ (пишем 60 раз в секунду), поэтому:

1. **Не `useMemo`** для `world` / `frame` / карт времени событий — «значение из хука
   менять нельзя». Берите `useSceneRuntime(() => ({ … }))`: ленивый `useState`,
   создаётся один раз, читается в рендере без нареканий.
2. **Не `useRef`** для того же: `.current` нельзя читать во время рендера, а
   `world` и `labels` нужны как пропсы `SceneShell`.
3. **Не присваивайте поля напрямую**: вместо `world.glows.exo.amount = v` —
   `setGlow(world, 'exo', center, v)`, `setWave(...)`, `setPuff(...)`.
   Запись в пулы через `writeAtom` / `writeBond` / `commitPool` уже безопасна:
   правило не заглядывает внутрь вызова функции.

По той же причине `onFrame` и `onCue` пишутся ОБЫЧНЫМИ функциями, без `useCallback`:
`SceneShell` зовёт их из `useFrame`, в зависимостях эффектов они не участвуют.
`useCallback` оставьте для `validate` — он живёт в `useEffect`.
