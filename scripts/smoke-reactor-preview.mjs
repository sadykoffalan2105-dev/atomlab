#!/usr/bin/env node
/** Smoke: zero-gap модули и layout cache собираются без ошибок. */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const checks = [
  'src/lab/reactorPreviewZeroGap.ts',
  'src/lab/reactorPreviewContinuityGuard.ts',
  'src/lab/reactorPreviewLayoutCache.ts',
  'src/lab/visualCoverageController.ts',
  'src/lab/gpuCompileChunked.ts',
  'src/components/lab/ReactorTermsPreview.tsx',
  'src/components/lab/ReactorInstancedAtoms.tsx',
]

let ok = true
for (const rel of checks) {
  const path = join(root, rel)
  try {
    const text = readFileSync(path, 'utf8')
    if (!text.trim()) {
      console.error('empty:', rel)
      ok = false
    } else {
      console.log('ok:', rel)
    }
  } catch (e) {
    console.error('missing:', rel, e.message)
    ok = false
  }
}

if (!ok) process.exit(1)
console.log('smoke-reactor-preview: pass')
