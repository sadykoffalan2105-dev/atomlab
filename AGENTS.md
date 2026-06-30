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
- **`npm run dev` currently renders a black screen** due to a pre-existing circular-import bug in the source:
  `src/perf/graphicsSettings.ts` reads `SYNTHESIS_QUALITY_HIGH` at module top-level (line ~13) while
  `src/lab/synthesisQualityLadder.ts` imports `resolveDeviceSynthesisCap` back from it, triggering
  `Uncaught ReferenceError: Cannot access 'SYNTHESIS_QUALITY_HIGH' before initialization`. Vite's unbundled
  dev ESM hits the temporal-dead-zone; the bundled production build does not (the deployed site works).
  To actually view the app, use `npm run build` then `npm run preview`. A minimal fix is to break the cycle
  (e.g. move `resolveDeviceSynthesisCap` into `synthesisQualityLadder.ts`), but that is a product code change
  outside environment setup — leave it to a maintainer.
- The dev server / `vite.config.ts` warms up a Python Edge-TTS daemon (`scripts/teacher-tts-daemon.py`). Without the
  `edge_tts` Python package this prints a `ModuleNotFoundError` traceback — it is **non-fatal**; the JS `msedge-tts`
  fallback loads and the web app is unaffected.
- `npm run lint` runs but the repo currently has many pre-existing lint errors (300+); a clean exit is not expected.
- `npm run build` runs `tsc -b && vite build`; large-chunk size warnings are expected and harmless.
