/**
 * Воспроизведение MP3 — HTML Audio (надёжнее Web Audio для Edge Neural MP3).
 *
 * Autoplay: браузер разрешает звук только если элемент «активирован» жестом
 * пользователя. Между кликом и play() есть await (загрузка neural-MP3), поэтому
 * мы держим ОДИН переиспользуемый <audio> и разблокируем его тихим клипом прямо
 * в момент клика (unlockAudioPlayback). Дальше тот же элемент играет MP3 без
 * блокировки — иначе play() падает и озвучка молча скатывается на робота.
 */

let player: HTMLAudioElement | null = null
let playing = false
let unlocked = false

function getPlayer(): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null
  if (!player) {
    player = new Audio()
    player.preload = 'auto'
  }
  return player
}

/** ~10 мс тишины (8-bit PCM WAV) — гарантированно проигрывается для разблокировки. */
function silentWavUrl(): string {
  const sampleRate = 8000
  const samples = 80
  const buffer = new ArrayBuffer(44 + samples)
  const view = new DataView(buffer)
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i))
  }
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + samples, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate, true)
  view.setUint16(32, 1, true)
  view.setUint16(34, 8, true)
  writeStr(36, 'data')
  view.setUint32(40, samples, true)
  for (let i = 0; i < samples; i++) view.setUint8(44 + i, 128)
  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }))
}

export function stopNeuralPlayback(): void {
  playing = false
  if (player) {
    player.pause()
    try {
      player.removeAttribute('src')
      player.load()
    } catch {
      /* ignore */
    }
  }
}

export function isNeuralPlaybackActive(): boolean {
  return playing && !!player && !player.paused && !player.ended
}

function base64ToBlob(b64: string, mimeType: string): Blob {
  const binary = atob(b64)
  const buffer = new ArrayBuffer(binary.length)
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([buffer], { type: mimeType })
}

/**
 * Разблокировка звука — ВЫЗЫВАТЬ синхронно в обработчике клика (до await),
 * чтобы play() произошёл внутри пользовательского жеста.
 */
export async function unlockAudioPlayback(): Promise<void> {
  const audio = getPlayer()
  if (!audio || unlocked) return

  const url = silentWavUrl()
  try {
    audio.muted = true
    audio.src = url
    await audio.play()
    audio.pause()
    audio.currentTime = 0
    unlocked = true
  } catch {
    /* реальный play() ещё может сработать */
  } finally {
    audio.muted = false
    URL.revokeObjectURL(url)
  }
}

export async function playNeuralAudioBase64(
  audioBase64: string,
  mimeType: string,
  signal?: AbortSignal,
): Promise<void> {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  const audio = getPlayer()
  if (!audio) throw new Error('no_audio_element')

  const url = URL.createObjectURL(base64ToBlob(audioBase64, mimeType))

  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      audio.onended = null
      audio.onerror = null
      signal?.removeEventListener('abort', onAbort)
      URL.revokeObjectURL(url)
      playing = false
    }
    const onAbort = () => {
      audio.pause()
      cleanup()
      reject(new DOMException('Aborted', 'AbortError'))
    }

    audio.onended = () => {
      cleanup()
      resolve()
    }
    audio.onerror = () => {
      cleanup()
      reject(new Error('audio_playback'))
    }
    if (signal) signal.addEventListener('abort', onAbort, { once: true })

    audio.muted = false
    audio.volume = 1.0
    audio.src = url
    audio.currentTime = 0
    playing = true

    void audio.play().catch((err) => {
      cleanup()
      reject(err)
    })
  })
}
