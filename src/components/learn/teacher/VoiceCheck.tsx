/**
 * Экран «Проверить микрофон» (#/voice-check) — работает и без урока.
 *
 * Шаги: разрешение (с понятным объяснением NotAllowed / NotFound / NotReadable) → выбор устройства →
 * живой уровень и шум комнаты → запись 3 с («кислород / kislorod / oxygen») → прослушать свою запись →
 * отправить в текущий путь распознавания (сервер ATOMLAB /stt или Web Speech браузера) и показать:
 * текст, язык, время, путь, размер. «Скопировать отчёт» — JSON без аудио:
 * {ua, path, brainUrl, levels:{floor,peak}, errors[], sttMs, text, lang}.
 * data-testid: voice-check-record, voice-check-result, voice-check-copy (контракт e2e).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useT, type MessageKey } from '../../../i18n/useT'
import { LearnSpeechController, isSpeechRecognitionSupported } from '../../../learn/learnSpeech'
import { brainSessionId, checkHealth, getBrainStatus, getBrainUrl } from '../../../learn/brain/remote/brainClient'
import { currentBrowserVoiceProfile } from '../../../learn/brain/speech/browserProfile'
import { postStt, SttHttpError } from '../../../learn/brain/speech/serverStt'
import { getVoiceDiag, noteVoiceError, voiceLog, type SttPath } from '../../../learn/brain/speech/voiceStatus'
import { MicCapture, micErrorCode, openMicOnGesture } from '../../../learn/brain/voice/micCapture'
import { chooseSttPath, sharedSttHealth, sttOverride } from '../../../learn/brain/voice/sttEngine'
import { concatPcm16, encodeWavPcm16, STT_SAMPLE_RATE } from '../../../learn/brain/voice/wavEncode'
import styles from './VoiceCheck.module.css'

const RECORD_MS = 3_000
/** Web Speech: сколько ждать финал после конца записи. */
const WEB_FINAL_WAIT_MS = 1_500

type Phase = 'idle' | 'opening' | 'ready' | 'recording' | 'recognizing' | 'done'

interface CheckResult {
  text: string
  lang: string | null
  ms: number | null
  bytes: number
  path: SttPath
}

const ERROR_KEYS: Record<ReturnType<typeof micErrorCode>, MessageKey> = {
  not_allowed: 'learn.voice.check.errNotAllowed',
  not_found: 'learn.voice.check.errNotFound',
  in_use: 'learn.voice.check.errInUse',
  not_supported: 'learn.voice.check.errNotSupported',
  unknown: 'learn.voice.check.errUnknown',
}

function pathName(path: SttPath, t: (k: MessageKey) => string): string {
  if (path === 'server') return t('learn.voice.pathServer')
  if (path === 'none') return t('learn.voice.pathNone')
  const vendor = currentBrowserVoiceProfile().vendor
  if (vendor === 'edge') return t('learn.voice.pathMicrosoft')
  if (vendor === 'chrome') return t('learn.voice.pathGoogle')
  if (vendor === 'safari') return t('learn.voice.pathApple')
  return t('learn.voice.pathBrowser')
}

/** Выбрать путь распознавания так же, как урок (мозг online + /stt/health → сервер). */
async function resolvePath(): Promise<SttPath> {
  const online = await checkHealth().catch(() => false)
  const serverAvailable = online ? await sharedSttHealth(getBrainUrl).check().catch(() => false) : false
  return chooseSttPath({
    override: sttOverride(),
    brainOnline: online || getBrainStatus() === 'online',
    serverAvailable,
    hasWebSpeech: isSpeechRecognitionSupported(),
    hasCapture: true,
  })
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Старые браузеры / нет разрешения на буфер — через выделение.
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    let ok: boolean
    try {
      ok = document.execCommand('copy')
    } catch {
      ok = false
    }
    ta.remove()
    return ok
  }
}

export function VoiceCheck() {
  const { t, locale } = useT()
  const [phase, setPhase] = useState<Phase>('idle')
  const [micError, setMicError] = useState<ReturnType<typeof micErrorCode> | null>(null)
  const [devices, setDevices] = useState<{ id: string; label: string }[]>([])
  const [deviceId, setDeviceId] = useState('')
  const [level, setLevel] = useState({ value: 0, floor: 0, start: 0 })
  const [path, setPath] = useState<SttPath>('none')
  const [result, setResult] = useState<CheckResult | null>(null)
  const [playUrl, setPlayUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [noPath, setNoPath] = useState(false)

  const captureRef = useRef<MicCapture | null>(null)
  const controllerRef = useRef<LearnSpeechController | null>(null)
  const peakRef = useRef(0)
  const errorsRef = useRef<string[]>([])
  const levelRef = useRef(0)
  const offLevelRef = useRef<(() => void) | null>(null)

  const noteError = useCallback((code: string) => {
    errorsRef.current = [...errorsRef.current, code].slice(-20)
    noteVoiceError(code)
  }, [])

  // Путь распознавания — сразу (сервер проверяется в фоне).
  useEffect(() => {
    let alive = true
    void resolvePath().then((p) => {
      if (alive) setPath(p)
    })
    return () => {
      alive = false
    }
  }, [])

  // Уровень — по таймеру (кадры идут 50 раз в секунду, перерисовка 10 раз).
  useEffect(() => {
    const id = window.setInterval(() => {
      const cap = captureRef.current
      if (!cap) return
      const noise = cap.vad.noise
      setLevel({ value: levelRef.current, floor: noise.floor, start: noise.startThreshold })
    }, 100)
    return () => window.clearInterval(id)
  }, [])

  useEffect(
    () => () => {
      offLevelRef.current?.()
      captureRef.current?.stop()
      controllerRef.current?.stopOralListening()
    },
    [],
  )

  useEffect(
    () => () => {
      if (playUrl) URL.revokeObjectURL(playUrl)
    },
    [playUrl],
  )

  /** Открыть микрофон — СИНХРОННО в обработчике клика (iOS: AudioContext и getUserMedia по жесту). */
  const openMic = useCallback(
    (id: string) => {
      offLevelRef.current?.()
      captureRef.current?.stop()
      setMicError(null)
      setPhase('opening')
      const cap = new MicCapture(openMicOnGesture(id || undefined))
      captureRef.current = cap
      offLevelRef.current = cap.subscribe({
        frame: (_pcm, rms) => {
          levelRef.current = rms
          if (rms > peakRef.current) peakRef.current = rms
        },
      })
      void cap.start().then(async (ok) => {
        if (captureRef.current !== cap) return
        if (!ok) {
          const code = micErrorCode(cap.getError())
          noteError(`mic_${code}`)
          setMicError(code)
          setPhase('idle')
          return
        }
        setPhase('ready')
        // Названия устройств доступны только после разрешения.
        try {
          const list = await navigator.mediaDevices.enumerateDevices()
          setDevices(
            list
              .filter((d) => d.kind === 'audioinput')
              .map((d, i) => ({ id: d.deviceId, label: d.label || `${t('learn.voice.check.device')} ${i + 1}` })),
          )
        } catch {
          setDevices([])
        }
      })
    },
    [noteError, t],
  )

  const record = useCallback(() => {
    const cap = captureRef.current
    if (!cap || phase === 'recording' || phase === 'recognizing') return
    if (path === 'none') {
      setNoPath(true)
      noteError('stt_none')
    } else setNoPath(false)
    setResult(null)
    setCopied(false)
    peakRef.current = 0
    const frames: Int16Array[] = cap.preRoll(400).map((f) => f.pcm)
    const off = cap.subscribe({ frame: (pcm) => frames.push(pcm) })
    const usedPath = path

    // Web Speech слушает вживую, параллельно с записью (запись нужна для прослушивания).
    let webText = ''
    if (usedPath === 'web_speech') {
      const controller = controllerRef.current ?? new LearnSpeechController()
      controllerRef.current = controller
      const session = { committed: '' }
      controller.startOralListening(
        locale,
        session,
        (full, interim) => {
          webText = `${full} ${interim}`.trim()
        },
        (code) => noteError(`web_${code}`),
      )
    }
    setPhase('recording')
    voiceLog('check_record', { path: usedPath })

    window.setTimeout(() => {
      off()
      const pcm = concatPcm16(frames)
      const wav = encodeWavPcm16(pcm)
      const blob = new Blob([wav.slice().buffer as ArrayBuffer], { type: 'audio/wav' })
      setPlayUrl(URL.createObjectURL(blob))
      setPhase('recognizing')
      const t0 = performance.now()

      if (usedPath === 'server') {
        const baseUrl = getBrainUrl()
        if (!baseUrl) {
          noteError('brain_offline')
          setResult({ text: '', lang: null, ms: null, bytes: wav.length, path: usedPath })
          setPhase('done')
          return
        }
        void postStt({ baseUrl, wav, lang: locale, session: brainSessionId(), partial: false })
          .then((res) => {
            setResult({ text: res.text.trim(), lang: res.lang, ms: Math.round(performance.now() - t0), bytes: wav.length, path: usedPath })
          })
          .catch((e) => {
            const code = e instanceof SttHttpError ? `${e.status}_${e.code}` : 'network'
            noteError(`stt_${code}`)
            setResult({ text: '', lang: null, ms: Math.round(performance.now() - t0), bytes: wav.length, path: usedPath })
          })
          .finally(() => setPhase('done'))
        return
      }

      if (usedPath === 'web_speech') {
        window.setTimeout(() => {
          controllerRef.current?.stopOralListening()
          setResult({ text: webText, lang: locale, ms: Math.round(performance.now() - t0), bytes: wav.length, path: usedPath })
          setPhase('done')
        }, WEB_FINAL_WAIT_MS)
        return
      }

      setResult({ text: '', lang: null, ms: null, bytes: wav.length, path: usedPath })
      setPhase('done')
    }, RECORD_MS)
  }, [locale, noteError, path, phase])

  const copyReport = useCallback(() => {
    const cap = captureRef.current
    const report = {
      ua: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      path,
      brainUrl: getBrainUrl(),
      levels: {
        floor: Number((cap?.vad.noise.floor ?? 0).toFixed(4)),
        peak: Number(peakRef.current.toFixed(4)),
        start: Number((cap?.vad.noise.startThreshold ?? 0).toFixed(4)),
      },
      mic: cap?.getState() ?? 'off',
      sampleRate: cap?.getContext()?.sampleRate ?? null,
      targetRate: STT_SAMPLE_RATE,
      errors: [...errorsRef.current, ...getVoiceDiag().errors.filter((e) => !errorsRef.current.includes(e))].slice(-20),
      sttMs: result?.ms ?? null,
      bytes: result?.bytes ?? null,
      text: result?.text ?? '',
      lang: result?.lang ?? null,
    }
    void copyText(JSON.stringify(report, null, 2)).then(setCopied)
  }, [path, result])

  const goBack = useCallback(() => {
    if (window.history.length > 1) window.history.back()
    else window.location.hash = '#/learn'
  }, [])

  const micOpen = phase === 'ready' || phase === 'recording' || phase === 'recognizing' || phase === 'done'
  const pct = level.start > 0 ? Math.min(100, Math.round((level.value / (level.start * 2.5)) * 100)) : Math.min(100, Math.round(level.value * 800))
  const thresholdPct = level.start > 0 ? Math.round((1 / 2.5) * 100) : 0
  const loud = level.start > 0 && level.value >= level.start

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="voice-check-title">
        <header className={styles.head}>
          <h1 id="voice-check-title" className={styles.title}>
            {t('learn.voice.check.title')}
          </h1>
          <span className={styles.chip} data-testid="voice-path-chip" data-path={path}>
            {t('learn.voice.pathLabel', { path: pathName(path, t) })}
          </span>
        </header>
        <p className={styles.lead}>{t('learn.voice.check.lead')}</p>

        {/* 1. Разрешение */}
        {!micOpen ? (
          <div className={styles.step}>
            <button
              type="button"
              className={styles.primary}
              onClick={() => openMic(deviceId)}
              disabled={phase === 'opening'}
              data-testid="voice-check-allow"
            >
              {t('learn.voice.check.allow')}
            </button>
            {micError ? (
              <p className={styles.error} role="alert" data-code={micError}>
                {t(ERROR_KEYS[micError])}
              </p>
            ) : null}
          </div>
        ) : null}

        {micOpen ? (
          <>
            {/* 2. Устройство */}
            {devices.length > 1 ? (
              <label className={styles.row}>
                <span className={styles.label}>{t('learn.voice.check.device')}</span>
                <select
                  className={styles.select}
                  value={deviceId}
                  onChange={(e) => {
                    setDeviceId(e.target.value)
                    openMic(e.target.value)
                  }}
                >
                  <option value="">{t('learn.voice.check.deviceDefault')}</option>
                  {devices
                    .filter((d) => d.id && d.id !== 'default')
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.label}
                      </option>
                    ))}
                </select>
              </label>
            ) : null}

            {/* 3. Уровень */}
            <div className={styles.row}>
              <span className={styles.label}>{t('learn.voice.check.level')}</span>
              <div
                className={styles.meter}
                role="meter"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
                data-loud={loud ? '1' : '0'}
                data-testid="voice-check-level"
              >
                <span className={styles.meterFill} style={{ width: `${pct}%` }} />
                {thresholdPct ? <span className={styles.meterMark} style={{ left: `${thresholdPct}%` }} /> : null}
              </div>
            </div>
            <p className={styles.hint}>
              {t('learn.voice.check.floor', { floor: level.floor.toFixed(3), start: level.start.toFixed(3) })}
            </p>

            {/* 4. Запись */}
            <div className={styles.step}>
              <p className={styles.say}>{t('learn.voice.check.say')}</p>
              <button
                type="button"
                className={styles.primary}
                onClick={record}
                disabled={phase === 'recording' || phase === 'recognizing'}
                data-testid="voice-check-record"
                data-phase={phase}
              >
                {phase === 'recording'
                  ? t('learn.voice.check.recording')
                  : phase === 'recognizing'
                    ? t('learn.voice.check.recognizing')
                    : t('learn.voice.check.record')}
              </button>
              {noPath ? (
                <p className={styles.error} role="alert">
                  {t('learn.voice.check.errNoPath')}
                </p>
              ) : null}
            </div>

            {/* 5. Прослушивание и результат */}
            {playUrl ? (
              <div className={styles.row}>
                <span className={styles.label}>{t('learn.voice.check.playback')}</span>
                <audio className={styles.audio} controls src={playUrl} preload="auto" />
              </div>
            ) : null}

            {result ? (
              <div className={styles.result}>
                <span className={styles.label}>{t('learn.voice.check.result')}</span>
                <p className={styles.resultText} data-testid="voice-check-result" data-empty={result.text ? '0' : '1'}>
                  {result.text || t('learn.voice.check.empty')}
                </p>
                <p className={styles.hint}>
                  {t('learn.voice.check.meta', {
                    path: pathName(result.path, t),
                    lang: result.lang ?? '—',
                    ms: result.ms ?? '—',
                    kb: (result.bytes / 1024).toFixed(1),
                  })}
                </p>
              </div>
            ) : null}
          </>
        ) : null}

        <footer className={styles.foot}>
          <button type="button" className={styles.secondary} onClick={goBack}>
            {t('learn.voice.check.back')}
          </button>
          <button type="button" className={styles.secondary} onClick={copyReport} data-testid="voice-check-copy">
            {copied ? t('learn.voice.check.copied') : t('learn.voice.check.copy')}
          </button>
        </footer>
      </section>
    </main>
  )
}

export default VoiceCheck
