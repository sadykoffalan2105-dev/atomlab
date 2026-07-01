#!/usr/bin/env node
/** Сборка atomlab_core.wasm через emcc (если установлен). */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const srcDir = path.join(root, 'native/atomlab_core/src')
const sources = [
  'reactor_balance.cpp',
  'catalog_match.cpp',
  'reactor_preview_layout.cpp',
  'perf_guard.cpp',
].map((f) => path.join(srcDir, f).replace(/\\/g, '/'))
const outDir = path.join(root, 'public/wasm')
const outWasm = path.join(outDir, 'atomlab_core.wasm')

fs.mkdirSync(outDir, { recursive: true })

const exports = [
  '_reactor_balance',
  '_reactor_expand_z_slots',
  '_catalog_match',
  '_reactor_preview_layout',
  '_atomlab_max_preview_atoms',
  '_atomlab_max_preview_terms',
  '_atomlab_sync_build_atom_cap',
  '_atomlab_force_sync_layout',
  '_atomlab_allow_worker_layout',
  '_atomlab_defer_heavy_layout_rebuild',
  '_atomlab_layout_build_budget_ms',
  '_atomlab_allow_product_gpu_mount',
  '_atomlab_assert_preview_coverage',
  '_atomlab_validate_preview_terms',
].join(',')

try {
  execSync(
    `emcc ${sources.map((s) => `"${s}"`).join(' ')} -O3 -s WASM=1 -s EXPORTED_FUNCTIONS='[${exports}]' -s EXPORTED_RUNTIME_METHODS='["cwrap"]' -o "${outWasm.replace(/\\/g, '/')}"`,
    { stdio: 'inherit', shell: true },
  )
  console.log('Built', outWasm)
} catch {
  console.warn('emcc not found — WASM skipped; worker fallback active.')
  process.exit(0)
}
