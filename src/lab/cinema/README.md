# ATOMLAB Cinema

Библиотека кинематографичных и научно честных 3D-анимаций реакций для ATOMLAB
(three.js + @react-three/fiber). Реакция описывается **данными** — чистой
функцией времени сюжета, а рендер только раскладывает результат по GPU.

## Принципы

1. **Раскадровка — чистая функция.** `sampleXxxFrame(t, frame)` пишет мир в
   заранее созданный объект без аллокаций. Тот же сэмплер проверяют тесты в Node:
   что показано на экране, то и проверено.
2. **Один draw call на тип объектов.** Атомы, связи, орбитали, электроны —
   инстансные пулы (`core/pools.ts`), сцена пишет typed arrays раз в кадр.
3. **Никаких точечных источников света и смены числа источников.** Атомы
   освещает «софтбокс» сферическими гармониками (`core/envLighting.ts`), поэтому
   шейдеры не пересобираются посреди урока.
4. **Химия не рисуется «на глаз».** Длины связей и углы — экспериментальные,
   частоты колебаний — настоящие (со замедлением), орбитали — из модели ЛКАО,
   цвет раствора — из спектра поглощения. Всё, что упрощено, помечено в тексте урока.
5. **Слабые устройства — отдельный путь, а не урезанный кадр.** `resolveCinemaQuality`
   выбирает уровень один раз на урок; адаптируется только разрешение.

## Слои

| Слой | Модули |
|---|---|
| Время | `core/storyTime`, `core/storyClock`, `core/steppedStoryClock` (по шагам), `core/cues`, `react/CinemaTime` (визуальное время, заморозка кадра, reduced motion) |
| Движение | `core/tracks` (eased / hermite, дуги), `core/easing`, `core/spring` (точные пружины, `damp` без зависимости от FPS) |
| Химия | `core/atoms` (радиусы, длины, углы), `core/vsepr`, `core/chem/vibration` (ν и формы мод), `core/chem/orbitals` (π-система ClO₂, слейтеровские орбитали), `core/chem/bondOrder` (порядок, полярность) |
| Данные рендера | `core/pools` — `AtomPool`, `BondPool`, `LobePool` |
| Рендер | `react/InstancedAtoms` (импостеры / инстансные сферы), `react/InstancedBonds` (полосы порядка связи, полярность, гомолиз ↔ гетеролиз), `react/OrbitalLobes` (изоповерхности p-лепестков, цвет = фаза), `react/OrbitalRaymarch` (сумма ЛКАО, только полный уровень), `react/CinemaGlowPoints` (электроны, стрелки), `react/CinemaDomLabels` (формулы и степени окисления) |
| Среда и пост | `react/CinemaStage` (риг камеры, фон), `react/CinemaPuffVolume`, `react/CinemaFx`, `react/CinemaVfx`, `react/CinemaPostFx` (bloom, AgX/neutral тонмаппинг) |

## Сцена за 5 шагов

```tsx
// 1. Данные: дорожки и события (см. scenes/clo2/storyboard.ts)
const frame = createMyFrame()
sampleMyFrame(t, frame)

// 2. Пулы — один раз на урок
const atoms = createAtomPool(12)
const bonds = createBondPool(12)
const lobes = createLobePool(16)

// 3. Каждый кадр (useFrame с приоритетом -1): пишем пулы и поднимаем version
writeVec3(atoms.position, i, x, y, z)
writeHexLinear(atoms.color, i, CPK.O)
atoms.count = n
atoms.version++

// 4. Рендер
<InstancedBonds pool={bonds} time={visualTime} lite={lite} />
<InstancedAtoms pool={atoms} mode={quality.impostorAtoms ? 'impostor' : 'mesh'} />
<OrbitalLobes pool={lobes} time={visualTime} />

// 5. Колебания поверх равновесия — после сэмплера, до записи пулов
applyBentTriatomicModes(cl, o1, o2, visualT, amp, CLO2_VIB_CM1)
```

## Урок ClO₂ как образец

`scenes/clo2/` — механизм 2 NaClO₂ + Cl₂ → 2 ClO₂ + 2 NaCl в растворе по шагам:
перенос Cl⁺ (неподелённая пара O → пустая σ*(Cl–Cl)), ClOClO, комплекс
[ClOCl(O)OClO]⁻, гетеролиз и гомолиз, радикалы с π* 2b1, энергетический профиль,
баланс электронов. Проверки: `npx tsx scripts/test-clo2-cinema.mts`,
`scripts/test-cinema-engine.mts`, `scripts/test-clo2-energetics.mts`.

## Производительность

- Стенд: `node scripts/perf-clo2-cinema.mjs --label=x --tier=normal|low`
  (время кадра p50/p95/p99, draw calls, программы) — открывает сборку с `?perf=1`.
- Заморозка кадра для скриншотов и замеров: `window.__clo2Freeze(t)` (dev или `?perf=1`).
- Демо рендереров (dev-сервер, консоль):
  `(await import('/src/lab/cinema/react/__demo__/mountOrbitalsDemo.ts')).mountOrbitalsDemo()`,
  `/src/lab/cinema/react/__demo__/instancedBondsDemo.html`.
