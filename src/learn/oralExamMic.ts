/** Разрешение на микрофон для Web Speech API (отдельно от камеры). */

export async function ensureMicrophonePermission(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return false
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    })
    stream.getTracks().forEach((track) => track.stop())
    return true
  } catch (err) {
    const name = (err as DOMException | null)?.name
    // Явный отказ пользователя или блокировка — повтор бессмыслен.
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
      return false
    }
    // Иначе аудио-ограничения могли не подойти микрофону — пробуем без них.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((track) => track.stop())
      return true
    } catch {
      return false
    }
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}
