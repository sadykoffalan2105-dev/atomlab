# ATOMLAB — Desktop (Electron)

Полноценное Windows-приложение на базе React + Vite + Three.js + VR-лаборатории.

**Скачать v1.1.5:** [GitHub Releases](https://github.com/sadykoffalan2105-dev/atomlab/releases/tag/v1.1.5)
- `ATOMLAB-1.1.5-portable.exe` — без установки
- `ATOMLAB-1.1.5-setup.exe` — установщик

## Возможности

- **Полноэкранный режим** по умолчанию (F11 / меню «Вид»)
- **Hardware acceleration + WebGPU** — GPU rasterization, без throttling в фоне
- **Высокое качество графики** — фиксированный пресет High для синтеза и VR
- **Адаптивный FPS governor** — только внутри синтеза, без ручных настроек
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
├── ATOMLAB-1.1.5-portable.exe      ← portable, без установки
├── ATOMLAB-1.1.5-setup.exe         ← NSIS-установщик
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
