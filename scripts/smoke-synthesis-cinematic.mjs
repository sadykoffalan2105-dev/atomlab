#!/usr/bin/env node
/** Smoke: cinematic synthesis modules and timing profile. */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const checks = [
  'src/lab/synthesisTimingProfile.ts',
  'src/lab/visualCoverageController.ts',
  'src/lab/reactorPreviewLayoutWorkerClient.ts',
  'src/workers/reactorPreviewLayout.worker.ts',
  'src/components/lab/ReactorInstancedAtoms.tsx',
  'src/components/lab/ReactorCoeffBadge.tsx',
  'src/components/lab/SynthesisBondBurst.tsx',
  'src/components/lab/SynthesisConvergeStreams.tsx',
  'docs/SYNTHESIS_REWRITE_ANALYSIS.md',
]

let ok = true
for (const rel of checks) {
  const p = path.join(root, rel)
  if (!fs.existsSync(p)) {
    console.error('missing:', rel)
    ok = false
  } else {
    console.log('ok:', rel)
  }
}

const timing = fs.readFileSync(path.join(root, 'src/lab/synthesisTimingProfile.ts'), 'utf8')
if (!timing.includes('SYNTHESIS_TIMING_CINEMATIC')) {
  console.error('timing profile missing CINEMATIC')
  ok = false
}
const fnBody = timing.slice(timing.indexOf('export function getSynthesisTimingProfile'))
if (!fnBody.includes('return SYNTHESIS_TIMING_CINEMATIC')) {
  console.error('getSynthesisTimingProfile must return CINEMATIC')
  ok = false
}

const layout = fs.readFileSync(path.join(root, 'src/components/lab/reactorPreviewLayout.ts'), 'utf8')
if (!layout.includes('PREVIEW_ATOM_SCALE')) {
  console.error('PREVIEW_ATOM_SCALE missing')
  ok = false
}

if (!ok) process.exit(1)
console.log('smoke-synthesis-cinematic: pass')
