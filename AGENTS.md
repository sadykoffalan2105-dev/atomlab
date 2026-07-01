# AGENTS.md

## Cursor Cloud specific instructions

### What this is
ATOMLAB is an interactive chemistry web app (React 19 + TypeScript + Vite) — virtual lab, element catalog,
periodic table, and 7–11 grade learning content. The UI is in Russian. It is deployed as a static site
(GitHub Pages / Netlify) and also packaged as an Electron desktop app.

### Services
- **Web app (primary):** the Vite frontend. This is the only service required to develop/test core functionality.
  Standard commands live in `package.json` (`dev`, `build`, `preview`, `lint`).
- **AI teacher (optional):** chat + TTS. In dev it is served by a Vite middleware (`server/learnChatMiddleware.ts`)
  and needs `OPENAI_API_KEY` (or a local Ollama) plus voice keys (see `.env.example`). Not needed for the lab,
  catalog, periodic table, or learning UI to work.
- **`teacher_service/` (optional):** a Python (Ollama + RAG + Edge TTS) alternative backend (`npm run teacher:dev`,
  port 8765). Requires `pip install -r teacher_service/requirements.txt` + Ollama; not part of core setup.
- **`api/`, `netlify/`, `worker/` (deploy only):** serverless targets for the hosted AI teacher; not run locally for dev.

### Running / non-obvious caveats
- `npm run dev` works. (A prior circular-import bug — `graphicsSettings.ts` ↔ `synthesisQualityLadder.ts` — used
  to blank the dev build with `Cannot access 'SYNTHESIS_QUALITY_HIGH' before initialization`; it is fixed:
  `resolveDeviceSynthesisCap`/`FIXED_SYNTHESIS_CAP` now live in `synthesisQualityLadder.ts`. Keep that direction
  one-way to avoid reintroducing the cycle.)
- **This VM renders WebGL in software (SwiftShader), not on a real GPU.** Consequences when testing the 3D lab/reactor:
  - Heavy scenes (many animated atoms) are CPU-bound and can visibly stutter here even though they are smooth on a
    real GPU. Treat absolute smoothness on this VM as pessimistic; use relative before/after frame-time metrics.
  - The console shows `Automatic fallback to software WebGL` and a shader-compile error for the atom "nebula"
    (`AtomElementNebula`, `modelMatrix` used in a fragment shader) — SwiftShader is stricter than real drivers.
    This is pre-existing and does not blank the app.
  - The synthesis reactor's default view is a **dark space backdrop** — a dark canvas with no atoms is NOT a black-screen
    bug. Open it via the "Синтез" button (Laboratory / `/`), then generate an equation to see atoms: click the
    "⚗ Уравнение" button → pick a product (e.g. search "дихромат" → K₂Cr₂O₇). Reagent badges (Cr, K, O₂) with
    `−`/`+` coefficient steppers then appear on the left and 3D atoms render. Coefficients also change via mouse-wheel
    over a badge. Editing coefficients / running synthesis needs a generated equation first.
- The dev server / `vite.config.ts` warms up a Python Edge-TTS daemon (`scripts/teacher-tts-daemon.py`). Without the
  `edge_tts` Python package this prints a `ModuleNotFoundError` traceback — it is **non-fatal**; the JS `msedge-tts`
  fallback loads and the web app is unaffected.
- `npm run lint` runs but the repo currently has many pre-existing lint errors (300+); a clean exit is not expected.
- `npm run build` runs `tsc -b && vite build`; large-chunk size warnings are expected and harmless.
