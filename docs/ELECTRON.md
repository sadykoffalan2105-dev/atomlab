# ATOMLAB — Desktop (Electron)

Полноценное Windows-приложение на базе React + Vite + Three.js + VR-лаборатории.

**Скачать v1.3.10:** [GitHub Releases](https://github.com/sadykoffalan2105-dev/atomlab/releases/tag/v1.3.10)
- `ATOMLAB-1.3.10-portable.exe` — без установки
- `ATOMLAB-1.3.10-setup.exe` — установщик

### v1.3.10 — нет чёрного экрана до синтеза, атомы при +/-

- До кнопки «Синтез» — только атомы (отключён idle/hover GPU-prewarm)
- `preSynthesisReactor` lock в continuity — product GPU не монтируется
- Layout всегда sync при редактировании (K₂Cr₂O₇ без worker-lag)
- C++ `perf_guard.cpp`: лимиты 48 атомов, sync/worker политика
- Фоновая GPU-очередь в реакторе отключена (без конкуренции с превью)

### v1.3.9 — атомы не пропадают при +/- (K₂Cr₂O₇ и др.)

- `reactorCoeffEditing` — защита на весь период редактирования (не только burst)
- Сброс settled-продукта при изменении коэффициента — превью не размонтируется
- Sync layout без worker/debounce при любом редактировании
- GPU-prewarm заблокирован до editIdle
- Сброс productPainted при редактировании — превью не скрывается

### v1.3.8 — стабильность синтеза «раз и навсегда»

- Жёсткий override continuity при +/-: только атомы, без product GPU
- Burst layout всегда sync на main thread (worker не откладывает +/-)
- Worker timeout 1.8s + sync-fallback; shell hold 240 кадров
- GPU compile budget — одна compile-задача за раз (без storm)
- SessionStorage кэш скомпилированных продуктов
- Контракт сценариев `synthesisStabilityContract` + расширенные автотесты
- Frame-fallback productReveal не фakes prewarmReady (превью до paint)

### v1.3.7 — cold start синтеза (первый запуск без лагов)

- Idle GPU-prewarm продукта после баланса уравнения (не во время +/-)
- Hover intent на кнопку «Проверить и запустить» — ранний compile шейдеров
- Фоновая очередь GPU-compile популярных веществ (H₂O, NaCl, K₂Cr₂O₇…)
- Прогрев шейдеров Bohr-атомов при открытии реактора
- `compileAsync` при idle-prewarm — убирает hitch первого синтеза
- Расширенный WASM/worker warmup (тяжёлые уравнения)

### v1.3.6 — стабильность синтеза (Performance & Stability)

- Продукт не монтируется в GPU при +/- коэффициентов (`coeffEditBurst` блокирует mesh)
- Электроны анимируются при burst до 48 атомов; на Snapdragon — до 24 в обычном режиме
- Sync layout для ≤12 атомов без worker-задержки; тяжёлые уравнения — worker/WASM
- Постоянный масштаб атомов (коэффициент = число моделей, не размер)
- Восстановление canvas при схлопывании 0×0; WebGL remount после burst
- Автотесты: `npm run test:synthesis-stability`

### v1.3.5 — чёрный экран при расстановке коэффициентов

- GPU-prewarm продукта **отключён** при редактировании уравнения (только во время синтеза) — compile молекулы больше не блокирует WebGL
- Terms для 3D всегда immediate (без deferred-лаг)
- Shell атомов держится 180 кадров при burst; layout уходит в worker на каждый +/-
- Продукт не монтируется в сцену до запуска синтеза

### v1.3.4 — синтез без чёрного экрана, атомы не пропадают

- Превью атомов остаётся до **реальной** отрисовки молекулы (settled-handoff, paint ≥2 GPU-кадров)
- Стабильный DPR на всём сеансе реактора — settled больше не переключает `substanceView`/DPR
- Тяжёлый layout (>14 атомов) уходит в worker без sync-build на main thread при burst
- Shell-hold 120 кадров при +/-, visibility guard восстанавливает refs во время burst
- WASM layout валидируется по числу атомов — при расхождении TS fallback
- Убран лимит 12 анимированных атомов на Snapdragon (до 48)
- Debug ingest отключён в production-сборке

### v1.3.3 — белый/чёрный экран при +/- коэффициентов

- Синхронизация размера WebGL-canvas при редактировании реактора (раньше только в catalog/settled)
- Стабильный DPR/AA во время +/- — смена renderer больше не рвёт контекст
- Мгновенный sync layout атомов без `startTransition` при burst
- Тёмный fallback на контейнере Canvas; remount WebGL отложен во время burst

### v1.3.2 — конец синтеза без чёрного/белого экрана

- Молекула продукта отрисовывается до скрытия атомов (реальный paint callback, не счётчик кадров)
- Shell превью остаётся смонтированным во время синтеза — нет «пустого» кадра
- Атомарный переход settled (`flushSync`) и синхронный resize canvas (`useLayoutEffect`)
- Исправлена гонка `forceProductSlot` при завершении синтеза

### v1.3.1 — восстановление визуала атомов

- Орбитальные линии и анимация электронов снова всегда включены при редактировании коэффициентов
- Per-atom освещение и цвета Bohr-модели как до v1.3.0
- Ускорение сохранено: debounce layout, throttle invalidate, worker, anti-blink — без деградации графики
- Контракт `reactorVisualPreservation.ts` защищает визуал от случайных perf-регрессий

## Возможности

- **Полноэкранный режим** по умолчанию (F11 / меню «Вид»)
- **Hardware acceleration + WebGPU** — GPU rasterization, без throttling в фоне
- **Высокое качество графики** — High на мощных ПК; на слабых устройствах автоматически снижается нагрузка (DPR, FX), визуальный стиль сохраняется
- **Адаптивный FPS governor** — в синтезе и на слабых GPU при редактировании реактора
- **Crash recovery** — перезагрузка при падении render/GPU process
- **Portable `.exe`** — запуск без установки
- **NSIS-установщик** — ярлык на рабочем столе и в меню «Пуск»
- **Автообновление** через GitHub Releases (`electron-updater`)
- **WASM** — ускорение баланса уравнений (`atomlab_core.wasm`)

---

```bash
npm install
npm run dev:electron
```

Откроется Vite на `http://127.0.0.1:5173` и окно Electron с hot-reload.

Опции:

| Переменная | Эффект |
|---|---|
| `ATOMLAB_DEVTOOLS=1` | DevTools при старте |
| `ATOMLAB_DISABLE_HW_ACCEL=1` | Отключить GPU (отладка) |

---

## Сборка локально (Windows)

```bash
npm run dist:electron
```

Скрипт собирает приложение во временную папку `C:/temp/atomlab-electron-out` (обход EPERM на путях с кириллицей) и копирует `.exe` в `./release/`.

Переопределить staging:

```bash
set ATOMLAB_ELECTRON_STAGING=D:\build\atomlab
npm run dist:electron
```

Только portable:

```bash
npm run dist:electron:portable
```

### Готовые файлы в `release/`

После `npm run dist:electron`:

```
release/
├── ATOMLAB-1.3.3-portable.exe      ← portable, без установки
├── ATOMLAB-1.3.3-setup.exe         ← NSIS-установщик
├── win-unpacked/                   ← распакованное приложение (для отладки)
├── latest.yml                      ← манифест для electron-updater
└── builder-effective-config.yaml
```

**Portable:** скачайте `ATOMLAB-x.x.x-portable.exe`, положите куда угодно и запустите двойным щелчком.

**Установщик:** `ATOMLAB-x.x.x-setup.exe` — выберите папку, создаст ярлыки.

---

## Публикация на GitHub Releases

1. Поднимите версию в `package.json`:
   ```json
   "version": "1.0.1"
   ```

2. Создайте тег и запушьте:
   ```bash
   git add package.json
   git commit -m "chore: bump desktop version to 1.0.1"
   git tag v1.0.1
   git push origin main --tags
   ```

3. Workflow `.github/workflows/release-electron.yml` соберёт `.exe` и опубликует Release.

Локальная публикация (нужен `GH_TOKEN` с правами `repo`):

```bash
set GH_TOKEN=ghp_...
npm run publish:electron
```

---

## Обновления

### Автоматически

- При запуске собранного `.exe` через ~4 с проверяется GitHub Release.
- Если есть новая версия — скачивается в фоне.
- После загрузки — диалог «Перезапустить».

Работает для **NSIS-установки**. Portable-версию проще обновить, скачав новый `.exe` вручную.

### Вручную

- Меню **ATOMLAB → Проверить обновления…**
- Кнопка версии в шапке (например `v1.0.0`)

---

## Структура Electron

```
electron/
  main.cjs      — главный процесс (окно, GPU, автообновление)
  preload.cjs   — безопасный мост IPC
build/
  icon.svg      — исходник иконки
  icon.png      — 512×512 для electron-builder
src/
  electronBridge.types.ts
  components/desktop/DesktopUpdateBadge.tsx
```

---

## Производительность (3D / VR)

В `electron/main.cjs`:

- `enable-gpu-rasterization`, `ignore-gpu-blocklist`
- `backgroundThrottling: false` — рендер Three.js не замирает в фоне
- `powerPreference: high-performance` в WebGL (на стороне браузера)
- Один экземпляр приложения (`requestSingleInstanceLock`)

---

## Troubleshooting

| Проблема | Решение |
|---|---|
| Чёрный экран при `dev:electron` | Убедитесь, что Vite поднялся на порту 5173 |
| `dist/index.html not found` | Сначала `npm run build:electron` |
| Автообновление не работает | Нужен GitHub Release с `latest.yml` и NSIS `.exe` |
| WebGL недоступен | Обновите драйвер GPU; не ставьте `ATOMLAB_DISABLE_HW_ACCEL=1` |

---

## Скрипты npm

| Скрипт | Описание |
|---|---|
| `dev:electron` | Vite + Electron в dev-режиме |
| `build:icon` | SVG → PNG + favicon |
| `build:electron` | Production-сборка для desktop |
| `dist:electron` | Portable + NSIS в `release/` |
| `dist:electron:portable` | Только portable |
| `publish:electron` | Сборка + публикация на GitHub |
