# CHANGELOG v1.2.0 — Cinematic synthesis rewrite

## Highlights

- **CINEMATIC synthesis** on all devices: ignite → approach → converge → bond burst → product
- **Instanced atoms** (`ReactorInstancedAtoms`) — constant scale, coeff → instance count
- **Coeff badges** (×N) for lite/cluster tiers
- **Layout worker** off main thread for heavy equations
- **VisualCoverageController** — micro-prewarm no longer counts as visible during coeff edit
- **Approach spread** 2.35 — atoms start far apart, fly with GSAP arcs (no scale tween)
- **SynthesisBondBurst** — sparkles + point light pulse at bond formation
- **Bond mapping** — term-aware index matching

## Migration from v1.1.x

- Instant synthesis profile removed from default path
- `reactorPreviewAtomScale()` now returns constant `PREVIEW_ATOM_SCALE`
- QA: see `docs/QA_LAB_SYNTHESIS.md`

## Build

```bash
npm run build
node scripts/smoke-reactor-preview.mjs
node scripts/smoke-synthesis-cinematic.mjs
npm run dist:electron
```
