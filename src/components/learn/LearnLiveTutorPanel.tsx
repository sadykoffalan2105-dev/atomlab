import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { LearnChapter, LearnGrade, LearnSection } from '../../types/learn'
import { getActiveStudent } from '../../learn/learnClassRosterStorage'
import { ensureMicrophonePermission } from '../../learn/oralExamMic'
import { useOralExamMedia } from '../../learn/useOralExamMedia'
import { useDualModeTeacher } from '../../learn/brain'
import type { EmotionState, EngagementLevel, TutorMode } from '../../learn/brain'
import { useT } from '../../i18n/useT'
import styles from './TeacherExamShell.module.css'

type Props = {
  grade: LearnGrade
  chapter: LearnChapter
  section: LearnSection
  rosterSectionId?: string
  disabled?: boolean
  embedded?: boolean
}

const EMOTION_LABEL: Record<EmotionState, { ru: string; en: string; uz: string }> = {
  neutral: { ru: 'спокоен', en: 'calm', uz: 'xotirjam' },
  confused: { ru: 'в замешательстве', en: 'confused', uz: 'hayron' },
  frustrated: { ru: 'напряжён', en: 'tense', uz: 'zo‘riqqan' },
  confident: { ru: 'уверен', en: 'confident', uz: 'ishonchli' },
  bored: { ru: 'скучает', en: 'bored', uz: 'zerikkan' },
}

const ENGAGEMENT_LABEL: Record<EngagementLevel, { ru: string; en: string; uz: string }> = {
  focused: { ru: 'вовлечён', en: 'focused', uz: 'jalb bo‘lgan' },
  distracted: { ru: 'отвлекается', en: 'distracted', uz: 'chalg‘igan' },
  absent: { ru: 'нет в кадре', en: 'out of frame', uz: 'kadrda yo‘q' },
  suspicious: { ru: 'подозрительно', en: 'suspicious', uz: 'shubhali' },
}

const ENGAGEMENT_COLOR: Record<EngagementLevel, string> = {
  focused: '#5cffd4',
  distracted: '#ffd166',
  absent: '#9aa5b1',
  suspicious: '#ff6b6b',
}

function LiveTutorOverlay({
  grade,
  chapter,
  section,
  rosterSectionId,
  initialMode,
  onClose,
}: Props & { initialMode: TutorMode; onClose: () => void }) {
  const { t, locale } = useT()
  const media = useOralExamMedia(true)
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null)
  const [textInput, setTextInput] = useState('')
  const startedRef = useRef(false)
  const chatEndRef = useRef<HTMLDivElement | null>(null)

  const studentId = rosterSectionId ? getActiveStudent(rosterSectionId)?.id ?? 'guest' : 'guest'
  const sectionTitle = t(section.titleKey)

  const { state, start, stop, setMode, sendText, askAnother, nextTopic } = useDualModeTeacher({
    studentId,
    lang: locale,
    gradeId: grade.id,
    chapterId: chapter.id,
    sectionTitle,
    sectionId: section.id,
    topics: [sectionTitle],
    initialMode,
    voice: true,
    videoEl,
  })

  useEffect(() => {
    if (media.status === 'active') setVideoEl(media.videoRef.current)
  }, [media.status, media.videoRef])

  // Стартуем разум, когда камера определилась (активна или ошибка → голос всё равно).
  useEffect(() => {
    if (startedRef.current) return
    if (media.status === 'error') {
      startedRef.current = true
      void start()
    } else if (media.status === 'active' && videoEl) {
      startedRef.current = true
      void start()
    }
  }, [media.status, videoEl, start])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
      stop()
      media.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [state.messages, state.partial])

  const statusKey = state.aiSpeaking
    ? 'learn.teacherExam.liveStatusSpeaking'
    : state.turn === 'user_speaking'
      ? 'learn.teacherExam.liveStatusListening'
      : state.turn === 'thinking'
        ? 'learn.teacherExam.liveStatusThinking'
        : 'learn.teacherExam.liveStatusIdle'

  const orbClass = state.aiSpeaking
    ? styles.liveOrbSpeaking
    : state.turn === 'user_speaking'
      ? styles.liveOrbListening
      : state.turn === 'thinking'
        ? styles.liveOrbThinking
        : styles.liveOrbIdle

  const fused = state.fused
  const attentionPct = fused ? Math.round(fused.attention * 100) : 0
  const engagement = fused?.engagement ?? 'focused'
  const emotion = fused?.emotion ?? 'neutral'
  const localeKey = (locale === 'en' ? 'en' : locale === 'uz' ? 'uz' : 'ru') as 'ru' | 'en' | 'uz'

  const submitText = () => {
    const text = textInput.trim()
    if (!text) return
    setTextInput('')
    void sendText(text)
  }

  const modeIsExam = state.mode === 'exam'

  const reasoningView = useMemo(() => state.reasoning.slice(-6), [state.reasoning])

  return createPortal(
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <header className={styles.toolbar}>
        <h2 className={styles.toolbarTitle}>{t('learn.teacherExam.liveTitle')}</h2>
        <button type="button" className={styles.closeBtn} onClick={onClose}>
          {t('learn.studentTest.close')}
        </button>
      </header>

      <main className={styles.main}>
        <div className={`${styles.body} ${styles.liveLayout}`}>
          <div className={styles.liveStage}>
            <div className={styles.liveHero}>
              <div className={`${styles.liveOrb} ${orbClass}`} aria-hidden />
              <div className={styles.liveHeroText}>
                <p className={styles.liveStatusLabel}>{t(statusKey)}</p>
                <span
                  className={`${styles.liveModeTag} ${modeIsExam ? styles.liveModeTagExam : ''}`}
                >
                  {modeIsExam
                    ? t('learn.teacherExam.liveModeExam')
                    : t('learn.teacherExam.liveModeTraining')}
                </span>
              </div>
            </div>

            <div className={styles.liveVideoWrap}>
              <video ref={media.videoRef} className={styles.liveVideo} muted playsInline />
              <span className={styles.liveVideoBadge}>{t('learn.teacherExam.cameraBadge')}</span>
              {media.status !== 'active' ? (
                <div className={styles.liveVideoWaiting}>
                  {media.status === 'error'
                    ? t('learn.teacherExam.cameraErrorUnknown')
                    : t('learn.teacherExam.liveConnecting')}
                </div>
              ) : null}
            </div>

            <div className={styles.liveChat} aria-live="polite">
              {state.messages.length === 0 && !state.partial ? (
                <div className={`${styles.liveMsg} ${styles.liveMsgTeacher}`}>
                  <span className={styles.liveMsgRole}>{t('learn.teacherExam.liveTeacher')}</span>
                  {t('learn.teacherExam.liveGreetingWait')}
                </div>
              ) : null}
              {state.messages.map((m) => (
                <div
                  key={m.id}
                  className={`${styles.liveMsg} ${m.role === 'teacher' ? styles.liveMsgTeacher : styles.liveMsgYou}`}
                >
                  <span className={styles.liveMsgRole}>
                    {m.role === 'teacher'
                      ? t('learn.teacherExam.liveTeacher')
                      : t('learn.teacherExam.liveYou')}
                  </span>
                  {m.text}
                </div>
              ))}
              {state.partial ? <div className={styles.livePartial}>{state.partial}…</div> : null}
              <div ref={chatEndRef} />
            </div>

            <div className={styles.liveControls}>
              <button type="button" className={styles.secondaryBtn} onClick={() => void askAnother()}>
                {t('learn.teacherExam.liveAskAnother')}
              </button>
              <button type="button" className={styles.secondaryBtn} onClick={() => void nextTopic()}>
                {t('learn.teacherExam.liveNextTopic')}
              </button>
              {!state.micActive ? (
                <span className={styles.hint}>{t('learn.teacherExam.liveNoMic')}</span>
              ) : null}
            </div>

            <div className={styles.liveTextRow}>
              <input
                className={styles.liveTextInput}
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitText()
                }}
                placeholder={t('learn.teacherExam.liveTypePlaceholder')}
              />
              <button type="button" className={styles.primaryBtn} onClick={submitText}>
                {t('learn.teacherExam.liveSend')}
              </button>
            </div>
          </div>

          <aside className={styles.liveSide}>
            <div className={styles.liveCard}>
              <p className={styles.liveCardTitle}>{t('learn.teacherExam.modeLabel')}</p>
              <div className={styles.liveModeToggle}>
                <button
                  type="button"
                  className={!modeIsExam ? styles.liveModeBtnActive : styles.liveModeBtn}
                  onClick={() => void setMode('training')}
                >
                  {t('learn.teacherExam.liveModeTraining')}
                </button>
                <button
                  type="button"
                  className={modeIsExam ? styles.liveModeBtnActive : styles.liveModeBtn}
                  onClick={() => void setMode('exam')}
                >
                  {t('learn.teacherExam.liveModeExam')}
                </button>
              </div>
              <p className={styles.liveModeDesc}>
                {modeIsExam
                  ? t('learn.teacherExam.liveModeExamDesc')
                  : t('learn.teacherExam.liveModeTrainingDesc')}
              </p>
            </div>

            <div className={styles.liveCard}>
              <p className={styles.liveCardTitle}>{t('learn.teacherExam.liveEngagement')}</p>
              <div className={styles.liveMetric}>
                <span>{t('learn.teacherExam.liveEngagement')}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{attentionPct}%</span>
              </div>
              <div className={styles.liveBar}>
                <div
                  className={styles.liveBarFill}
                  style={{ width: `${attentionPct}%`, background: ENGAGEMENT_COLOR[engagement] }}
                />
              </div>
              <div className={styles.liveMetric}>
                <span>{ENGAGEMENT_LABEL[engagement][localeKey]}</span>
                <span style={{ color: ENGAGEMENT_COLOR[engagement] }}>
                  {EMOTION_LABEL[emotion][localeKey]}
                </span>
              </div>
            </div>

            {reasoningView.length > 0 ? (
              <div className={styles.liveCard}>
                <p className={styles.liveCardTitle}>{t('learn.teacherExam.liveReasoning')}</p>
                <div className={styles.liveReasoning}>
                  {reasoningView.map((step, i) => (
                    <div key={`${step.atMs}-${i}`} className={styles.liveReasoningStep}>
                      <b>{step.observation}</b> → {step.inference}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      </main>
    </div>,
    document.body,
  )
}

export function LearnLiveTutorPanel({
  grade,
  chapter,
  section,
  rosterSectionId,
  disabled = false,
}: Props) {
  const { t } = useT()
  const [active, setActive] = useState(false)
  const [initialMode, setInitialMode] = useState<TutorMode>('training')

  const launch = (mode: TutorMode) => {
    setInitialMode(mode)
    void ensureMicrophonePermission()
    setActive(true)
  }

  return (
    <section className={styles.panel}>
      <div className={styles.liveSetup}>
        <div className={styles.setupRow}>
          <button
            type="button"
            className={styles.primaryBtn}
            disabled={disabled}
            onClick={() => launch('training')}
          >
            {t('learn.teacherExam.liveStart')}
          </button>
          <button
            type="button"
            className={styles.secondaryBtn}
            disabled={disabled}
            onClick={() => launch('exam')}
          >
            {t('learn.teacherExam.liveModeExam')}
          </button>
        </div>
        <p className={styles.liveTip}>{t('learn.teacherExam.liveTip')}</p>
      </div>
      {active ? (
        <LiveTutorOverlay
          grade={grade}
          chapter={chapter}
          section={section}
          rosterSectionId={rosterSectionId}
          initialMode={initialMode}
          onClose={() => setActive(false)}
        />
      ) : null}
    </section>
  )
}
