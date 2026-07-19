import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { LearnChapter, LearnGrade, LearnSection } from '../../types/learn'
import { getActiveStudent } from '../../learn/learnClassRosterStorage'
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

type LocaleKey = 'ru' | 'en' | 'uz'

const EMOTION_LABEL: Record<EmotionState, Record<LocaleKey, string>> = {
  neutral: { ru: 'спокоен', en: 'calm', uz: 'xotirjam' },
  confused: { ru: 'в замешательстве', en: 'confused', uz: 'hayron' },
  frustrated: { ru: 'напряжён', en: 'tense', uz: 'zo‘riqqan' },
  confident: { ru: 'уверен', en: 'confident', uz: 'ishonchli' },
  bored: { ru: 'скучает', en: 'bored', uz: 'zerikkan' },
}

const ENGAGEMENT_LABEL: Record<EngagementLevel, Record<LocaleKey, string>> = {
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

// Рекомендация по темпу — что «мозг» делает с учётом мимики ученика.
const PACE_HINT: Record<EmotionState, Record<LocaleKey, string>> = {
  neutral: { ru: 'темп ровный', en: 'steady pace', uz: 'bir tekis sur’at' },
  confused: { ru: 'объясняю проще', en: 'simplifying', uz: 'soddalashtiryapman' },
  frustrated: { ru: 'сбавляю темп', en: 'slowing down', uz: 'sur’atni pasaytiraman' },
  confident: { ru: 'ускоряюсь', en: 'speeding up', uz: 'tezlashtiraman' },
  bored: { ru: 'делаю живее', en: 'making it livelier', uz: 'jonliroq qilaman' },
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

  // Диалог не ждёт камеру: как только камера определилась (или дала сбой) —
  // запускаем «мозг» и берём микрофон ПОСЛЕ камеры, чтобы не было гонки за
  // устройствами (главная причина, почему камера «плохо запускалась»).
  useEffect(() => {
    if (startedRef.current) return
    if (media.status === 'active' && videoEl) {
      startedRef.current = true
      void start()
    } else if (media.status === 'error') {
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
  const localeKey: LocaleKey = locale === 'en' ? 'en' : locale === 'uz' ? 'uz' : 'ru'

  const submitText = () => {
    const text = textInput.trim()
    if (!text) return
    setTextInput('')
    void sendText(text)
  }

  const modeIsExam = state.mode === 'exam'
  const reasoningView = useMemo(() => state.reasoning.slice(-6), [state.reasoning])

  return createPortal(
    <div className={`${styles.overlay} ${styles.liveOverlay}`} role="dialog" aria-modal="true">
      <div className={styles.liveStars} aria-hidden />
      <div className={styles.liveNebula} aria-hidden />

      <header className={`${styles.toolbar} ${styles.liveToolbar}`}>
        <span className={styles.liveBrandDot} aria-hidden />
        <h2 className={styles.toolbarTitle}>{t('learn.teacherExam.liveTitle')}</h2>
        <span className={`${styles.liveModeTag} ${modeIsExam ? styles.liveModeTagExam : ''}`}>
          {modeIsExam ? t('learn.teacherExam.liveModeExam') : t('learn.teacherExam.liveModeTraining')}
        </span>
        <button type="button" className={styles.closeBtn} onClick={onClose}>
          {t('learn.studentTest.close')}
        </button>
      </header>

      <main className={styles.main}>
        <div className={`${styles.body} ${styles.liveLayout}`}>
          {/* Большой экран — только диалог */}
          <div className={styles.liveStage}>
            <div className={styles.liveHero}>
              <div className={`${styles.liveOrb} ${orbClass}`} aria-hidden />
              <div className={styles.liveHeroText}>
                <p className={styles.liveStatusLabel}>{t(statusKey)}</p>
                <span className={styles.liveHeroTopic}>{sectionTitle}</span>
              </div>
            </div>

            <div className={styles.liveChat} aria-live="polite">
              {state.messages.length === 0 && !state.partial ? (
                <div className={styles.liveWelcome}>
                  <div className={`${styles.liveOrb} ${styles.liveOrbIdle} ${styles.liveWelcomeOrb}`} aria-hidden />
                  <p>{t('learn.teacherExam.liveGreetingWait')}</p>
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
              {state.partial ? (
                <div className={`${styles.liveMsg} ${styles.liveMsgYou} ${styles.livePartialMsg}`}>
                  <span className={styles.liveMsgRole}>{t('learn.teacherExam.liveYou')}</span>
                  {state.partial}
                  <span className={styles.liveCursor} aria-hidden />
                </div>
              ) : null}
              <div ref={chatEndRef} />
            </div>

            <div className={styles.liveComposer}>
              <div className={styles.liveControls}>
                <button type="button" className={styles.liveChip} onClick={() => void askAnother()}>
                  {t('learn.teacherExam.liveAskAnother')}
                </button>
                <button type="button" className={styles.liveChip} onClick={() => void nextTopic()}>
                  {t('learn.teacherExam.liveNextTopic')}
                </button>
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
              {!state.micActive && state.running ? (
                <p className={styles.liveMicHint}>{t('learn.teacherExam.liveNoMic')}</p>
              ) : null}
            </div>
          </div>

          {/* Небольшая колонка: камера + режим + вовлечённость */}
          <aside className={styles.liveSide}>
            <div className={styles.liveCameraCard}>
              <video ref={media.videoRef} className={styles.liveCamera} muted playsInline />
              <span className={styles.liveCameraBadge}>{t('learn.teacherExam.cameraBadge')}</span>
              {media.status === 'active' ? (
                <span className={styles.liveCameraLive} aria-hidden />
              ) : (
                <div className={styles.liveCameraOverlay}>
                  <p>
                    {media.status === 'error'
                      ? t('learn.teacherExam.cameraErrorUnknown')
                      : t('learn.teacherExam.liveConnecting')}
                  </p>
                  {media.status === 'error' ? (
                    <button type="button" className={styles.liveChip} onClick={() => void media.start()}>
                      {t('learn.teacherExam.cameraRetry')}
                    </button>
                  ) : null}
                </div>
              )}
            </div>

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
                <span style={{ color: ENGAGEMENT_COLOR[engagement] }}>
                  {ENGAGEMENT_LABEL[engagement][localeKey]}
                </span>
                <span>{EMOTION_LABEL[emotion][localeKey]}</span>
              </div>
              <div className={styles.livePaceRow}>{PACE_HINT[emotion][localeKey]}</div>
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

/**
 * Компактная кнопка запуска онлайн-диалога — встраивается в ИИ-преподавателя
 * (боковую панель урока). Открывает тот же космический оверлей.
 */
export function LiveDialogButton({
  grade,
  chapter,
  section,
  rosterSectionId,
  className,
}: Props & { className?: string }) {
  const { t } = useT()
  const [active, setActive] = useState(false)
  const [initialMode, setInitialMode] = useState<TutorMode>('training')

  const launch = (mode: TutorMode) => {
    setInitialMode(mode)
    setActive(true)
  }

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => launch('training')}
        title={t('learn.teacherExam.liveTitle')}
      >
        {t('learn.teacherExam.liveStart')}
      </button>
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
    </>
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

  // Микрофон не запрашиваем заранее: сначала запустится камера, затем «мозг»
  // сам возьмёт микрофон — так нет гонки камера/микрофон при старте.
  const launch = (mode: TutorMode) => {
    setInitialMode(mode)
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
