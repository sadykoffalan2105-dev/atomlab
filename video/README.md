# Записи экрана и настройка синтеза

В этой папке — видео с проверкой UI (дашборд §1, синтез, электроны).

Отчёт автопроверки каталога: [`lab-synthesis-audit.json`](lab-synthesis-audit.json) (`npm run validate:lab`).

## Коэффициенты и tier-анимация

| Параметр | Значение | Файл |
|----------|----------|------|
| Макс. коэффициент (UI) | 9999 | [`reactorLimits.ts`](../src/chemistry/reactorLimits.ts) |
| Full 3D fly | ≤24 preview atoms | `REACTOR_VISUAL_FULL_ATOMS` |
| Lite (шары CPK) | 25–64 | `REACTOR_VISUAL_LITE_ATOMS` |
| Cluster (лучи + 1 модель/слагаемое) | >64 | [`SynthesisConvergeStreams.tsx`](../src/components/lab/SynthesisConvergeStreams.tsx) |

Уравнение **не блокируется** по числу атомов — ограничение только на визуал.

## Электроны и frameloop

| Где | Решение |
|-----|---------|
| Обучение §1, задача 5 | SVG SMIL — [`CyberAtomOrbitSvg.tsx`](../src/components/learn/topicScenes/cyber/native/CyberAtomOrbitSvg.tsx) |
| Обучение → «Рассмотреть» | 3D + `frameloop="always"` |
| Лаборатория → реактор (превью) | `electronAnimate` до 24 атомов — [`ReactorTermsPreview.tsx`](../src/components/lab/ReactorTermsPreview.tsx) |
| Лаборатория → canvas | `frameloop="always"` вне реактора (декоративный атом / элемент); в реакторе — `demand` в idle, `always` при синтезе и превью |

## Производительность синтеза

Пресет: [`synthesisPerfPreset.ts`](../src/lab/synthesisPerfPreset.ts) → [`synthesisLaunchTiming.ts`](../src/lab/synthesisLaunchTiming.ts).

| Фаза | ~длительность |
|------|----------------|
| Полёт | 0.15 с + stagger |
| Вспышка | 0.07 с |
| Продукт | 0.09 + 0.05 с hold |
| Cluster mode | ~0.12 с / term |

### Handoff без чёрного кадра

1. Один пул атомов — без remount.
2. Pre-warm продукта за 300 ms после баланса уравнения.
3. Overlap превью ↔ продукт синхронизирован с `productEntranceDur`.
4. `synthesisVisualGuard` — recover после **2** пустых кадров.
5. `poseLocked` на merge; settled → кнопка «Показать реагенты».

### Чеклист синтеза (ручной)

1. **Ctrl+F5** → каталог → MgO: слева `2Mg + O₂`, атомы видны.
2. **2Mg + O₂ → синтез** — цикл < 0.5 с, без чёрного кадра.
3. **Повтор ×5** — без мигания.
4. **(NH₄)₃PO₄** — coeff 12+, tier lite/cluster, запуск OK.
5. **Win10 / доска** — ≥30 FPS в синтезе.
6. `npm run validate:lab` + `npm run build` — OK.

### Автопроверка

```bash
npm run validate:lab   # 214 веществ каталога
npm run build
```

После изменений пресета: **Ctrl+F5** на странице лаборатории.
