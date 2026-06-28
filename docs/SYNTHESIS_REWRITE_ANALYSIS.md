# ATOMLAB — анализ системы синтеза (v1.2.0 rewrite)

Дата: 2026-06. Версия до переработки: **1.1.9**.

## Архитектура (до v1.2.0)

```
LaboratoryPage → LabCanvas/LabScene
  ├─ ReactorTermsPreview (N× AtomStructureModel)
  ├─ SynthesisOnLabScene (только если !instantSynthesis)
  │    ├─ SynthesisConvergeStreams (GSAP)
  │    └─ SynthesisNeonBondFormation
  └─ LabProductHeroSlot (product GPU prewarm)
```

| Слой | Файлы | Роль |
|------|-------|------|
| Оркестрация | `src/pages/LaboratoryPage.tsx` | runId, phase UI, coeff burst, prewarm |
| Сцена | `src/components/lab/LabScene.tsx` | continuity, guards, mount |
| Превью | `src/components/lab/ReactorTermsPreview.tsx` | атомы реагентов |
| Layout | `src/components/lab/reactorPreviewLayout.ts` | кластеры, global scale shrink |
| Tier | `src/chemistry/reactorVisualTier.ts` | full/lite/cluster caps |
| Анимация | `src/components/lab/SynthesisOnLabScene.tsx` | FSM фаз |
| Anti-blink | `src/lab/synthesisAntiBlink.ts` | preview/product overlap |
| Timing | `src/lab/synthesisTimingProfile.ts` | **INSTANT по умолчанию** |
| WASM | `src/wasm/reactorBalanceWasm.ts` | только баланс |
| VR | `src/vrLab/mixEngine.ts` | отдельный pipeline |

## P1 — Анимация отключена

`getSynthesisTimingProfile()` возвращал `SYNTHESIS_TIMING_INSTANT`. `SynthesisOnLabScene` не монтировался. QA (`docs/QA_LAB_SYNTHESIS.md`) ожидал полёт → вспышка → молекула.

## P2 — Неверная визуализация коэффициентов

- `reactorPreviewAtomScale(n)` уменьшал размер при росте N.
- `previewModelsForTerm` скрывал атомы (cluster cap 3).
- GSAP converge масштабировал атомы ×1.1.
- `buildSynthesisApproachAtoms` не использовался.

## P3 — Чёрные экраны и лаги

| Причина | Механизм |
|---------|----------|
| Пустой центр при +/- | `groupVisible=false` на кадр |
| micro-prewarm | невидим, считался coverage |
| GPU compile | hitch на Intel UHD |
| N× React trees | полный AtomStructureModel на атом |
| INSTANT synth | drift атомов при появлении продукта |

Guards v1.1.9 — симптоматическое лечение.

## P4 — Неполная кинематографичность

- Cluster: летит 1 представитель на term.
- Bond mapping greedy по символу (K₂Cr₂O₇).
- Beams отключены; mergeFlash без particle burst уровня VR.

## P5 — VR / mixEngine

Отдельный reactionEngine. Lab synthesis не переиспользует VR instancing (до v1.2.0).

## Целевая архитектура (v1.2.0)

```
ReactorPreviewLayoutWorker (off-thread layout)
  → ReactorInstancedAtoms (constant scale, InstancedMesh)
  → VisualCoverageController (atoms | product | mergeFx)
SynthesisOnLabScene (CINEMATIC)
  → buildSynthesisApproachAtoms (spread 2.2+)
  → SynthesisConvergeStreams (no scale tween)
  → SynthesisBondBurst (particles + glow)
```

## File map (ключевые)

| Файл | v1.2.0 |
|------|--------|
| `ReactorInstancedAtoms.tsx` | instanced renderer |
| `ReactorCoeffBadge.tsx` | ×N badge |
| `visualCoverageController.ts` | unified coverage |
| `reactorPreviewLayout.worker.ts` | layout worker |
| `reactorPreviewWasm.ts` | WASM layout (optional) |
| `SynthesisBondBurst.tsx` | energy burst FX |
| `synthesisBondMapping.ts` | term-aware mapping |
| `synthesisTimingProfile.ts` | CINEMATIC default |
