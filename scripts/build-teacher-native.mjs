#!/usr/bin/env node
/** Build teacher_service/native/rag_scan for fast RAG keyword scan (Windows MSVC / clang). */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const srcDir = path.join(root, 'teacher_service/native/rag_scan')
const src = path.join(srcDir, 'rag_scan.c')
const outDir = srcDir

function tryBuild() {
  const isWin = process.platform === 'win32'
  const outFile = isWin ? path.join(outDir, 'rag_scan.dll') : path.join(outDir, 'rag_scan.so')

  if (isWin) {
    const cl = process.env.CC || 'cl'
    execSync(
      `"${cl}" /nologo /LD /O2 "${src}" /Fe:"${outFile}"`,
      { stdio: 'inherit', shell: true, cwd: outDir },
    )
  } else {
    const cc = process.env.CC || 'cc'
    execSync(
      `"${cc}" -shared -fPIC -O3 "${src}" -o "${outFile}"`,
      { stdio: 'inherit', shell: true, cwd: outDir },
    )
  }
  console.log('Built', outFile)
}

try {
  if (!fs.existsSync(src)) {
    console.warn('rag_scan.c not found — skipped.')
    process.exit(0)
  }
  tryBuild()
} catch {
  console.warn('Native rag_scan build failed — Python RAG fallback remains active.')
  process.exit(0)
}
