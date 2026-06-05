#!/usr/bin/env node
/** Сборка atomlab_core.wasm через emcc (если установлен). */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const src = path.join(root, 'native/atomlab_core/src/catalog_match.cpp')
const outDir = path.join(root, 'public/wasm')
const outWasm = path.join(outDir, 'atomlab_core.wasm')

fs.mkdirSync(outDir, { recursive: true })

try {
  execSync(`emcc "${src}" -O3 -s WASM=1 -s EXPORTED_FUNCTIONS='["_catalog_match"]' -s EXPORTED_RUNTIME_METHODS='["cwrap"]' -o "${outWasm}"`, {
    stdio: 'inherit',
    shell: true,
  })
  console.log('Built', outWasm)
} catch {
  console.warn('emcc not found — WASM skipped; worker fallback active.')
  process.exit(0)
}
