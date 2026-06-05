# Cyber-дашборд (§1) — нативный интерактив

## Идея

Шесть карточек «ЗАДАЧА» в CSS Grid, фон лаборатории (анимация), внутри каждой — **SVG-схема** как на референсе. Клик по **подсвеченному объекту** открывает **режим рассмотрения** (Three.js: вращение, масштаб, сброс вида). Клик по рамке карточки — текст задачи.

Режим **`composite`** (только отладка): `visualMode: 'composite'` в данных + webp-референс.

## Файлы

| Компонент | Путь |
|-----------|------|
| Оболочка + панель | [`LearnCyberDashboard.tsx`](../src/components/learn/topicScenes/LearnCyberDashboard.tsx) |
| Сетка + карточки | [`cyber/native/CyberDashboardGrid.tsx`](../src/components/learn/topicScenes/cyber/native/CyberDashboardGrid.tsx) |
| Мини-сцены | [`cyber/native/CyberMiniScene.tsx`](../src/components/learn/topicScenes/cyber/native/CyberMiniScene.tsx) |
| Данные | [`learnCyberDashboard.ts`](../src/learn/learnCyberDashboard.ts) (`gridArea`) |
| i18n | [`learnCyberG7C1S01Ru.ts`](../src/i18n/learn/learnCyberG7C1S01Ru.ts) |

## Макет grid

```
task5 | task1 | task2
task5 | task3 | task2
task5 | task4 | task6
```

## QA

- §1 → **3D**: 6 карточек, заголовок «ХИМИЯ: НАУКА И ЕЁ ЗАДАЧИ»
- Клик по карточке → текст справа (desktop) / снизу (mobile)
- `?cyberDebug=1` — подсветка границ карточек
- `prefers-reduced-motion` — статичные сцены, клик работает

## Сборка

`npm run build` · `npm run validate:learn`

Обновить референс: положить PNG в `topic_g7_c1_s01_source.png` → `npm run learn:prepare-cyber`.

Подгонка кликов: `reference.gridInset` в [`learnCyberDashboard.ts`](../src/learn/learnCyberDashboard.ts) или `?cyberDebug=1`.
