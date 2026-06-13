import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DAEMON = join(ROOT, 'scripts', 'teacher-tts-daemon.py')
const ONESHOT = join(ROOT, 'scripts', 'teacher-tts-synth.py')
const TIMEOUT_MS = 45_000
const PY = process.platform === 'win32' ? 'python' : 'python3'

type TtsResult = { audioBase64: string; mimeType: string } | null

type Pending = {
  resolve: (value: TtsResult) => void
  timer: ReturnType<typeof setTimeout>
}

/** Долгоживущий Python-процесс — без холодного старта на каждую фразу. */
class EdgeTtsDaemon {
  private child: ChildProcessWithoutNullStreams | null = null
  private buffer = ''
  private pending: Pending | null = null
  private queue: Array<{ payload: object; resolve: (v: TtsResult) => void }> = []

  private spawn(): ChildProcessWithoutNullStreams | null {
    try {
      const child = spawn(PY, [DAEMON], {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      }) as ChildProcessWithoutNullStreams

      child.stdout.on('data', (chunk: Buffer) => {
        this.buffer += chunk.toString('utf8')
        this.flushResponses()
      })

      child.stderr.on('data', (chunk: Buffer) => {
        const msg = chunk.toString('utf8').trim()
        if (msg) console.warn('[edge-tts-daemon]', msg)
      })

      child.on('error', () => this.reset())
      child.on('close', () => this.reset())

      return child
    } catch {
      return null
    }
  }

  private reset(): void {
    if (this.pending) {
      clearTimeout(this.pending.timer)
      this.pending.resolve(null)
      this.pending = null
    }
    this.child = null
    this.buffer = ''
    while (this.queue.length > 0) {
      const item = this.queue.shift()!
      item.resolve(null)
    }
  }

  private flushResponses(): void {
    for (;;) {
      const nl = this.buffer.indexOf('\n')
      if (nl < 0) break
      const line = this.buffer.slice(0, nl).trim()
      this.buffer = this.buffer.slice(nl + 1)
      if (!line) continue

      const pending = this.pending
      this.pending = null
      if (!pending) continue

      clearTimeout(pending.timer)
      try {
        const data = JSON.parse(line) as { audioBase64?: string; mimeType?: string; error?: string }
        if (data.audioBase64 && data.audioBase64.length > 128) {
          pending.resolve({ audioBase64: data.audioBase64, mimeType: data.mimeType ?? 'audio/mpeg' })
        } else {
          pending.resolve(null)
        }
      } catch {
        pending.resolve(null)
      }

      this.pump()
    }
  }

  private pump(): void {
    if (this.pending || this.queue.length === 0) return

    if (!this.child) {
      this.child = this.spawn()
      if (!this.child?.stdin) {
        this.reset()
        return
      }
    }

    const item = this.queue.shift()!
    const timer = setTimeout(() => {
      this.pending?.resolve(null)
      this.pending = null
      try {
        this.child?.kill()
      } catch {
        /* ignore */
      }
      this.child = null
      this.pump()
    }, TIMEOUT_MS)

    this.pending = { resolve: item.resolve, timer }

    try {
      this.child.stdin.write(`${JSON.stringify(item.payload)}\n`)
    } catch {
      clearTimeout(timer)
      this.pending = null
      item.resolve(null)
      this.reset()
    }
  }

  synth(text: string, locale: 'ru' | 'en', voice?: string, prepared = true): Promise<TtsResult> {
    if (!text.trim()) return Promise.resolve(null)
    return new Promise((resolve) => {
      this.queue.push({
        payload: { text, locale, voice, prepared },
        resolve,
      })
      this.pump()
    })
  }

  warmup(text = 'Готов к уроку.', locale: 'ru' | 'en' = 'ru'): Promise<TtsResult> {
    return this.synth(text, locale, undefined, true)
  }
}

const daemon = new EdgeTtsDaemon()

function synthesizeOneShot(
  text: string,
  locale: 'ru' | 'en',
  voice?: string,
  prepared = true,
): Promise<TtsResult> {
  return new Promise((resolve) => {
    let child: ReturnType<typeof spawn>
    try {
      child = spawn(PY, [ONESHOT], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
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
        const data = JSON.parse(stdout) as { audioBase64?: string; mimeType?: string }
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

export async function synthesizeEdgeViaPython(
  text: string,
  locale: 'ru' | 'en',
  voice?: string,
  prepared = true,
): Promise<TtsResult> {
  const fromDaemon = await daemon.synth(text, locale, voice, prepared)
  if (fromDaemon) return fromDaemon
  return synthesizeOneShot(text, locale, voice, prepared)
}

export function warmupEdgeTtsDaemon(): Promise<TtsResult> {
  return daemon.warmup()
}
