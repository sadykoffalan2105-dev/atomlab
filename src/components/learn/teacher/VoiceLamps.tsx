/**
 * Две лампы голоса — честный ответ на «микрофон включён, а меня не слышат»:
 *  • «Микрофон слышит» — громкость выше порога речи за последнюю секунду (зелёная), тишина (серая),
 *    дорожка пропала/запрещена (красная, 'lost');
 *  • «Распознаю» — путь распознавания жив (сервер /stt отвечал ≤ 10 с назад или сессия браузера
 *    запущена); жёлтая ('warn'), если 8 с слышна речь, а текста нет — с кнопками действий.
 * data-testid / data-state — контракт e2e (voice-lamp-mic, voice-lamp-stt: on|off|warn|lost).
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useT } from '../../../i18n/useT'
import { getVoiceDiag, subscribeVoiceDiag, type VoiceDiag } from '../../../learn/brain/speech/voiceStatus'
import styles from './LiveTutor.module.css'

export type LampState = 'on' | 'off' | 'warn' | 'lost'

/** Сколько слышна речь без текста до жёлтой лампы. */
export const STALL_MS = 8_000

/** Чистая логика ламп (тестируется без DOM). unansweredSince — с какого момента речь без текста. */
export function lampStates(
  d: Pick<VoiceDiag, 'mic' | 'path' | 'lastHeardAt' | 'lastTextAt' | 'lastServerOkAt' | 'sttBusy'>,
  now: number,
  unansweredSince: number | null,
  muted: boolean,
): { mic: LampState; stt: LampState } {
  const mic: LampState =
    d.mic === 'lost' || d.mic === 'denied' || d.mic === 'error'
      ? 'lost'
      : !muted && d.mic === 'live' && now - d.lastHeardAt <= 1_000
        ? 'on'
        : 'off'
  let stt: LampState = 'off'
  if (!muted && d.path !== 'none' && d.sttBusy) {
    const stalled = unansweredSince !== null && now - unansweredSince >= STALL_MS && now - d.lastHeardAt < 2_500
    stt = stalled ? 'warn' : 'on'
  }
  return { mic, stt }
}

export function VoiceLamps({
  muted,
  aiSpeaking = false,
  onCheck,
  onPushToTalk,
  onType,
}: {
  muted: boolean
  /** Учитель говорит: громкость — его эхо или речь поверх (в hard_pause не распознаётся) — не «молчание распознавания». */
  aiSpeaking?: boolean
  onCheck: () => void
  onPushToTalk: () => void
  onType: () => void
}) {
  const { t } = useT()
  // Редкие поля (путь, состояние микрофона) — по подписке; частые (lastHeardAt) — по таймеру.
  const diag = useSyncExternalStore(subscribeVoiceDiag, getVoiceDiag, getVoiceDiag)
  const [tick, setTick] = useState<{ now: number; d: VoiceDiag; unanswered: number | null }>(() => ({
    now: Date.now(),
    d: getVoiceDiag(),
    unanswered: null,
  }))
  const mutedRef = useRef(muted)
  const aiRef = useRef(aiSpeaking)
  useEffect(() => {
    mutedRef.current = muted
    aiRef.current = aiSpeaking
  }, [muted, aiSpeaking])

  useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now()
      const d = getVoiceDiag()
      setTick((prev) => {
        let unanswered = prev.unanswered
        // Текст пришёл после последней речи (или микрофон на паузе) — счётчик «без текста» сбрасываем.
        if (mutedRef.current || aiRef.current || d.lastTextAt >= d.lastHeardAt - 1_500) unanswered = null
        else if (unanswered === null && d.lastHeardAt > 0 && now - d.lastHeardAt < 1_000) unanswered = now
        return { now, d, unanswered }
      })
    }, 250)
    return () => window.clearInterval(id)
  }, [])

  const lamps = lampStates({ ...tick.d, mic: diag.mic, path: diag.path, sttBusy: diag.sttBusy }, tick.now, tick.unanswered, muted)

  return (
    <div className={styles.voiceLamps} role="group" aria-label={t('learn.voice.lampsAria')}>
      <span className={styles.voiceLamp} data-testid="voice-lamp-mic" data-state={lamps.mic}>
        <span className={styles.voiceLampDot} aria-hidden />
        {lamps.mic === 'lost' ? t('learn.voice.lampMicLost') : t('learn.voice.lampMic')}
      </span>
      <span className={styles.voiceLamp} data-testid="voice-lamp-stt" data-state={lamps.stt}>
        <span className={styles.voiceLampDot} aria-hidden />
        {t('learn.voice.lampStt')}
      </span>
      {lamps.stt === 'warn' ? (
        <div className={styles.voiceStall} role="status">
          <span>{t('learn.voice.stalled')}</span>
          <button type="button" className={styles.bannerBtn} onClick={onCheck}>
            {t('learn.voice.actionCheck')}
          </button>
          <button type="button" className={styles.bannerBtn} onClick={onPushToTalk}>
            {t('learn.voice.actionPtt')}
          </button>
          <button type="button" className={styles.bannerBtn} onClick={onType}>
            {t('learn.voice.actionType')}
          </button>
        </div>
      ) : null}
    </div>
  )
}
