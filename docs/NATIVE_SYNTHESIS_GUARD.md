# ATOMLAB — C++ synthesis guard (WASM)

Библиотека `native/atomlab_core/src/perf_guard.cpp` — лимиты и инварианты continuity для превью реактора на слабых ПК.

## Сборка

```bash
npm run wasm:build
```

Требуется [Emscripten](https://emscripten.org/) (`emcc`). Без него — TS fallback в `src/lab/atomlabSynthesisGuard.ts`.

## Экспорт (WASM)

| Функция | Назначение |
|---------|------------|
| `atomlab_max_preview_atoms()` | Лимит 48 атомов |
| `atomlab_sync_build_atom_cap()` | Sync layout до 12 атомов |
| `atomlab_defer_heavy_layout_rebuild(n, editing)` | 1 = держать shell, rebuild в idle |
| `atomlab_layout_build_budget_ms(n)` | Бюджет ms для sync-build |
| `atomlab_allow_product_gpu_mount(...)` | GPU продукта только в live-синтезе |
| `atomlab_assert_preview_coverage(...)` | 0=ok, -1=not mounted, -2=root hidden |

## TypeScript

`src/lab/atomlabSynthesisGuard.ts` — зеркало с fallback без WASM.

Используется в:
- `useReactorPreviewLayout.ts` — defer heavy rebuild
- `reactorPreviewContinuityGuard.ts` — восстановление `root.visible`
