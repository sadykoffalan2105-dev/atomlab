import { useCallback, useEffect, useRef, useState } from 'react'

export type OralMediaStatus = 'idle' | 'requesting' | 'active' | 'error'

export type OralMediaErrorCode = 'not_supported' | 'denied' | 'not_found' | 'unknown'

function mapMediaError(err: unknown): OralMediaErrorCode {
  if (!err || typeof err !== 'object') return 'unknown'
  const name = (err as DOMException).name
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return 'denied'
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'not_found'
  return 'unknown'
}

export function isOralMediaSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
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
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'user' },
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          frameRate: { ideal: 30, max: 30 },
        },
        audio: false,
      })

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
