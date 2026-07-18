import { useCallback, useEffect, useRef, useState } from 'react'

export type OralMediaStatus = 'idle' | 'requesting' | 'active' | 'error'

export type OralMediaErrorCode = 'not_supported' | 'denied' | 'not_found' | 'in_use' | 'unknown'

function mapMediaError(err: unknown): OralMediaErrorCode {
  if (!err || typeof err !== 'object') return 'unknown'
  const name = (err as DOMException).name
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
    return 'denied'
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'not_found'
  // Камера физически занята другим приложением (Zoom/Skype/другая вкладка).
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') {
    return 'in_use'
  }
  return 'unknown'
}

export function isOralMediaSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
}

/**
 * Тиры ограничений камеры от «желаемых» к «любой камере». Жёсткие min-ограничения
 * (width.min / height.min) вызывают OverconstrainedError на многих веб-камерах,
 * даже когда доступ уже разрешён — поэтому пробуем по очереди и падаем до video:true.
 */
const VIDEO_CONSTRAINT_TIERS: MediaStreamConstraints[] = [
  {
    video: { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  },
  { video: { facingMode: 'user' }, audio: false },
  { video: true, audio: false },
]

async function acquireCameraStream(): Promise<MediaStream> {
  let lastErr: unknown = null
  for (const constraints of VIDEO_CONSTRAINT_TIERS) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints)
    } catch (err) {
      lastErr = err
      // Отказ в доступе, отсутствие камеры или занятость другим приложением —
      // повторять с другими параметрами бессмысленно, сразу выходим.
      const code = mapMediaError(err)
      if (code === 'denied' || code === 'not_found' || code === 'in_use') throw err
    }
  }
  throw lastErr
}

export function useOralExamMedia(active: boolean) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState<OralMediaStatus>('idle')
  const [errorCode, setErrorCode] = useState<OralMediaErrorCode | null>(null)

  const attachStream = useCallback(async (stream: MediaStream) => {
    const video = videoRef.current
    if (!video) return
    video.srcObject = stream
    video.muted = true
    video.playsInline = true
    try {
      await video.play()
    } catch {
      /* autoplay policy — user gesture usually satisfied by exam start */
    }
  }, [])

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    const video = videoRef.current
    if (video) {
      video.srcObject = null
    }
    setStatus('idle')
    setErrorCode(null)
  }, [])

  const start = useCallback(async () => {
    if (!isOralMediaSupported()) {
      setStatus('error')
      setErrorCode('not_supported')
      return false
    }

    stop()
    setStatus('requesting')
    setErrorCode(null)

    try {
      let stream: MediaStream
      try {
        stream = await acquireCameraStream()
      } catch (err) {
        // Камера могла быть кратко занята (переключение с микрофона/другой
        // вкладки) — даём устройству освободиться и пробуем ещё один раз.
        if (mapMediaError(err) === 'in_use') {
          await new Promise((r) => window.setTimeout(r, 700))
          stream = await acquireCameraStream()
        } else {
          throw err
        }
      }

      streamRef.current = stream
      await attachStream(stream)
      setStatus('active')
      return true
    } catch (err) {
      setStatus('error')
      setErrorCode(mapMediaError(err))
      return false
    }
  }, [attachStream, stop])

  useEffect(() => {
    if (!active) {
      stop()
      return
    }
    void start()
    return stop
  }, [active, start, stop])

  useEffect(() => {
    if (status === 'active' && streamRef.current) {
      void attachStream(streamRef.current)
    }
  }, [attachStream, status])

  return {
    videoRef,
    status,
    errorCode,
    start,
    stop,
    isActive: status === 'active',
  }
}
