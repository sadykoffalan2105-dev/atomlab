import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { useUnifiedBrainSession } from '../../learn/brain'
import type { AssistantLang } from '../../learn/brain'
import { useT } from '../../i18n/useT'
import { EMOTION_LABEL, ENGAGEMENT_LABEL, ENGAGEMENT_TONE, labelLocale } from './teacher/liveTutorLabels'
import styles from './teacher/BrainInsightPanel.module.css'

/**
 * Живой HUD «мозга» поверх голосового опроса. Работает в режиме «только
 * зрение»: анализирует камеру (внимание, эмоция, вовлечённость, риск списывания)
 * и не занимает микрофон — не конфликтует со штатным распознаванием речи опроса.
 * Видео обрабатывается локально.
 */
type Props = {
  videoRef: RefObject<HTMLVideoElement | null>
  active: boolean
  studentId: string
  lang: AssistantLang
}

export function BrainInsightPanel({ videoRef, active, studentId, lang }: Props) {
  const { t } = useT()
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null)
  const api = useUnifiedBrainSession({ studentId, lang, videoEl })
  const apiRef = useRef(api)
  useEffect(() => {
    apiRef.current = api
  })

  // ref.current не реактивен: ждём, пока <video> появится в DOM (раньше videoEl мог остаться null).
  useEffect(() => {
    let raf = 0
    const check = () => {
      const el = active ? videoRef.current : null
      setVideoEl((prev) => (prev === el ? prev : el))
      if (active && !el) raf = requestAnimationFrame(check)
    }
    raf = requestAnimationFrame(check)
    return () => cancelAnimationFrame(raf)
  }, [active, videoRef])

  useEffect(() => {
    if (active && videoEl) {
      void apiRef.current.start()
      return () => apiRef.current.stop()
    }
    return
  }, [active, videoEl])

  const loc = labelLocale(lang)
  const fused = api.state.fused
  const attentionPct = fused ? Math.round(fused.attention * 100) : null
  const engagement = fused?.engagement ?? 'focused'
  const emotion = fused?.emotion ?? 'neutral'
  const integrityPct = fused ? Math.round(fused.integrityRisk * 100) : 0

  return (
    <section className={styles.panel} aria-label={t('learn.teacherUi.insightTitle')}>
      <div className={styles.head}>
        <strong className={styles.title}>{t('learn.teacherUi.insightTitle')}</strong>
        <span className={styles.state} data-running={api.state.running ? '1' : undefined}>
          {api.state.running ? t('learn.teacherUi.insightRunning') : t('learn.teacherUi.insightIdle')}
        </span>
      </div>

      {fused && attentionPct !== null ? (
        <>
          <div className={styles.row}>
            <span>{t('learn.teacherUi.attention')}</span>
            <span className={styles.value}>{attentionPct}%</span>
          </div>
          <div className={styles.bar} data-tone={ENGAGEMENT_TONE[engagement]}>
            <span style={{ '--pct': `${attentionPct}%` } as CSSProperties} />
          </div>
          <div className={styles.row}>
            <span>{t('learn.teacherUi.insightState')}</span>
            <span className={styles.tone} data-tone={ENGAGEMENT_TONE[engagement]}>
              {ENGAGEMENT_LABEL[engagement][loc]}
            </span>
          </div>
          <div className={styles.row}>
            <span>{t('learn.teacherUi.insightEmotion')}</span>
            <span>{EMOTION_LABEL[emotion][loc]}</span>
          </div>
          {integrityPct > 40 ? (
            <div className={`${styles.row} ${styles.risk}`}>
              <span>{t('learn.teacherUi.insightIntegrity')}</span>
              <span className={styles.value}>{integrityPct}%</span>
            </div>
          ) : null}
        </>
      ) : (
        <p className={styles.hint}>{t('learn.teacherUi.insightHint')}</p>
      )}
    </section>
  )
}
