/** Воспроизведение MP3 — HTML Audio (надёжнее Web Audio для Edge Neural MP3). */

let activeAudio: HTMLAudioElement | null = null

export function stopNeuralPlayback(): void {
  if (activeAudio) {
    activeAudio.pause()
    activeAudio.src = ''
    activeAudio = null
  }
}

export function isNeuralPlaybackActive(): boolean {
  return activeAudio !== null && !activeAudio.paused && !activeAudio.ended
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export async function playNeuralAudioBase64(
  audioBase64: string,
  mimeType: string,
  signal?: AbortSignal,
): Promise<void> {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  const bytes = base64ToBytes(audioBase64)

  await new Promise<void>((resolve, reject) => {
    stopNeuralPlayback()
    const copy = new Uint8Array(bytes)
    const blob = new Blob([copy], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    audio.volume = 1.0
    activeAudio = audio

    const onAbort = () => {
      audio.pause()
      URL.revokeObjectURL(url)
      if (activeAudio === audio) activeAudio = null
      reject(new DOMException('Aborted', 'AbortError'))
    }

    if (signal) signal.addEventListener('abort', onAbort, { once: true })

    audio.onended = () => {
      signal?.removeEventListener('abort', onAbort)
      URL.revokeObjectURL(url)
      if (activeAudio === audio) activeAudio = null
      resolve()
    }
    audio.onerror = () => {
      signal?.removeEventListener('abort', onAbort)
      URL.revokeObjectURL(url)
      if (activeAudio === audio) activeAudio = null
      reject(new Error('audio_playback'))
    }
    void audio.play().catch((err) => {
      signal?.removeEventListener('abort', onAbort)
      URL.revokeObjectURL(url)
      if (activeAudio === audio) activeAudio = null
      reject(err)
    })
  })
}

export async function unlockAudioPlayback(): Promise<void> {
  /* HTML Audio unlocks on user gesture when speak() is called from click */
}
