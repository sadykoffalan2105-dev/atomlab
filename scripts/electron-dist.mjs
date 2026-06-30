/**
 * Сборка Electron для Windows с обходом EPERM на путях с кириллицей.
 * Артефакты копируются в ./release/
 */
import { spawnSync } from 'node:child_process'
import { cp, mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const releaseDir = join(root, 'release')
const stagingDir = process.env.ATOMLAB_ELECTRON_STAGING || 'C:/temp/atomlab-electron-out'

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: true, cwd: root })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

console.log('[electron-dist] staging →', stagingDir)

run('npm', ['run', 'build:electron'])
await rm(stagingDir, { recursive: true, force: true })
await mkdir(stagingDir, { recursive: true })

run('npx', [
  'electron-builder',
  '--win',
  '--x64',
  '--publish',
  'never',
  `--config.directories.output=${stagingDir.replace(/\\/g, '/')}`,
])

await mkdir(releaseDir, { recursive: true })

const { readdir } = await import('node:fs/promises')
const files = await readdir(stagingDir)
for (const name of files) {
  if (
    name.endsWith('.exe') ||
    name.endsWith('.yml') ||
    name.endsWith('.yaml') ||
    name.endsWith('.blockmap')
  ) {
    try {
      await cp(join(stagingDir, name), join(releaseDir, name))
      console.log('[electron-dist] copied', name)
    } catch (err) {
      console.warn('[electron-dist] skip locked file:', name, err instanceof Error ? err.message : err)
    }
  }
}

console.log('[electron-dist] ready →', releaseDir)
