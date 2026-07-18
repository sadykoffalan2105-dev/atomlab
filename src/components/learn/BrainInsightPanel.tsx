import { useEffect, useRef, useState, type RefObject } from 'react'
import { useUnifiedBrainSession } from '../../learn/brain'
import type { AssistantLang, EmotionState, EngagementLevel } from '../../learn/brain'

/**
 * Живой HUD супер-мозга поверх голосового опроса. Работает в режиме «только
 * зрение»: анализирует камеру (внимание, эмоция, вовлечённость, риск списывания)
 * и не занимает микрофон — не конфликтует со штатным распознаванием речи опроса.
 */
type Props = {
  videoRef: RefObject<HTMLVideoElement | null>
  active: boolean
  studentId: string
  lang: AssistantLang
}

const EMOTION_RU: Record<EmotionState, string> = {
  neutral: 'спокоен',
  confused: 'в замешательстве',
  frustrated: 'напряжён',
  confident: 'уверен',
  bored: 'скучает',
}

const ENGAGEMENT_RU: Record<EngagementLevel, string> = {
  focused: 'вовлечён',
  distracted: 'отвлекается',
  absent: 'нет в кадре',
  suspicious: 'подозрительно',
}

const ENGAGEMENT_COLOR: Record<EngagementLevel, string> = {
  focused: '#5cffd4',
  distracted: '#ffd166',
  absent: '#9aa5b1',
  suspicious: '#ff6b6b',
}

export function BrainInsightPanel({ videoRef, active, studentId, lang }: Props) {
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null)
  const api = useUnifiedBrainSession({ studentId, lang, videoEl })
  const apiRef = useRef(api)
  apiRef.current = api

  useEffect(() => {
    setVideoEl(active ? videoRef.current : null)
  }, [active, videoRef])

  useEffect(() => {
    if (active && videoEl) {
      void apiRef.current.start()
      return () => apiRef.current.stop()
    }
    return
  }, [active, videoEl])

  const fused = api.state.fused
  const attentionPct = fused ? Math.round(fused.attention * 100) : null
  const engagement = fused?.engagement ?? 'focused'
  const emotion = fused?.emotion ?? 'neutral'
  const integrityPct = fused ? Math.round(fused.integrityRisk * 100) : 0

  const box: React.CSSProperties = {
    marginTop: 12,
    padding: '12px 14px',
    borderRadius: 14,
    background: 'linear-gradient(160deg, rgba(14,22,34,0.92), rgba(10,16,26,0.92))',
    border: '1px solid rgba(92,255,212,0.18)',
    color: '#dbe7f0',
    fontSize: 13,
    lineHeight: 1.5,
  }
  const rowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  }

  return (
    <section style={box} aria-label="ИИ-анализ по камере">
      <div style={{ ...rowStyle, marginBottom: 8 }}>
        <strong style={{ color: '#5cffd4', letterSpacing: 0.3 }}>Мозг-наблюдатель</strong>
        <span style={{ fontSize: 11, opacity: 0.7 }}>{api.state.running ? 'анализ…' : 'ожидание'}</span>
      </div>

      {fused ? (
        <>
          <div style={rowStyle}>
            <span>Внимание</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{attentionPct}%</span>
          </div>
          <div
            style={{
              height: 6,
              borderRadius: 6,
              margin: '4px 0 10px',
              background: 'rgba(255,255,255,0.08)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${attentionPct ?? 0}%`,
                height: '100%',
                background: ENGAGEMENT_COLOR[engagement],
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          <div style={rowStyle}>
            <span>Состояние</span>
            <span style={{ color: ENGAGEMENT_COLOR[engagement] }}>{ENGAGEMENT_RU[engagement]}</span>
          </div>
          <div style={rowStyle}>
            <span>Эмоция</span>
            <span>{EMOTION_RU[emotion]}</span>
          </div>
          {integrityPct > 40 ? (
            <div style={{ ...rowStyle, marginTop: 6, color: '#ff6b6b' }}>
              <span>Риск списывания</span>
              <span>{integrityPct}%</span>
            </div>
          ) : null}
        </>
      ) : (
        <p style={{ opacity: 0.65, margin: 0 }}>
          Наведите лицо в кадр — мозг оценит вовлечённость и эмоции.
        </p>
      )}
    </section>
  )
}
