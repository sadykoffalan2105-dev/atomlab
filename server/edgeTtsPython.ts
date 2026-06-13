import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SCRIPT = join(ROOT, 'scripts', 'teacher-tts-synth.py')
const TIMEOUT_MS = 45_000

export async function synthesizeEdgeViaPython(
  text: string,
  locale: 'ru' | 'en',
  voice?: string,
  prepared = true,
): Promise<{ audioBase64: string; mimeType: string } | null> {
  if (!text.trim()) return null

  return new Promise((resolve) => {
    const py = process.platform === 'win32' ? 'python' : 'python3'
    let child: ReturnType<typeof spawn>
    try {
      child = spawn(py, [SCRIPT], { stdio: ['pipe', 'pipe', 'pipe'] })
    } catch {
      resolve(null)
      return
    }

    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill()
      resolve(null)
    }, TIMEOUT_MS)

    if (!child.stdout || !child.stderr || !child.stdin) {
      clearTimeout(timer)
      resolve(null)
      return
    }

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8')
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
    })

    child.on('error', () => {
      clearTimeout(timer)
      resolve(null)
    })

    child.on('close', (code) => {
      clearTimeout(timer)
      if (code !== 0) {
        if (stderr.trim()) console.warn('[edge-tts-python]', stderr.trim())
        resolve(null)
        return
      }
      try {
        const data = JSON.parse(stdout) as {
          audioBase64?: string
          mimeType?: string
          error?: string
        }
        if (data.audioBase64 && data.audioBase64.length > 128) {
          resolve({ audioBase64: data.audioBase64, mimeType: data.mimeType ?? 'audio/mpeg' })
          return
        }
      } catch {
        /* invalid json */
      }
      resolve(null)
    })

    child.stdin.write(JSON.stringify({ text, locale, voice, prepared }))
    child.stdin.end()
  })
}
