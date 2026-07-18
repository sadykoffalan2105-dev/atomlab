import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { LearnChapter, LearnGrade, LearnSection } from '../../types/learn'
import {
  getActiveStudent,
  recordStudentTestResult,
} from '../../learn/learnClassRosterStorage'
import { pickOralExamQuestions, oralExamPoolSize, type OralExamCount } from '../../learn/g7ExamPools'
import {
  examGradeLabelFromRatio,
  examPointsToTestScore,
  gradeExamAnswer,
  type ExamGradeResult,
} from '../../learn/learnExamGrader'
import { LearnSpeechController, isSpeechRecognitionSupported } from '../../learn/learnSpeech'
import { ensureMicrophonePermission, sleep } from '../../learn/oralExamMic'
import {
  ORAL_LISTEN_MAX_SECONDS,
  ORAL_LISTEN_MIN_SECONDS,
  ORAL_THINK_SECONDS,
} from '../../learn/oralExamListenConfig'
import { useOralExamMedia } from '../../learn/useOralExamMedia'
import type { OralExamItem } from '../../learn/topicQuizTypes'
import { useT, type MessageKey } from '../../i18n/useT'
import { speechLocaleFromApp } from '../../i18n/localeHelpers'
import { OralExamCameraPanel } from './OralExamCameraPanel'
import { BrainInsightPanel } from './BrainInsightPanel'
import styles from './TeacherExamShell.module.css'

type Props = {
  grade: LearnGrade
  chapter: LearnChapter
  section: LearnSection
  rosterSectionId?: string
  disabled?: boolean
  embedded?: boolean
}

type Phase = 'setup' | 'running' | 'results'
type OralStep = 'ask' | 'listen' | 'grading' | 'feedback'

type ListenError = 'unsupported' | 'denied' | 'capture' | 'start_failed' | 'unknown' | null

type AnswerPhase = 'think' | 'recording' | 'ready'

function ExamScoreRing({ score, max }: { score: number; max: number }) {
  const pct = max > 0 ? score / max : 0
  const offset = 283 * (1 - pct)
  return (
    <div className={styles.scoreRing}>
      <svg viewBox="0 0 100 100" aria-hidden>
        <defs>
          <linearGradient id="examScoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#5cffd4" />
            <stop offset="100%" stopColor="#3dd4b0" />
          </linearGradient>
        </defs>
        <circle className={styles.scoreRingBg} cx="50" cy="50" r="45" />
        <circle className={styles.scoreRingFill} cx="50" cy="50" r="45" style={{ strokeDashoffset: offset }} />
      </svg>
      <div className={styles.scoreValue}>
        <span className={styles.scoreNumber}>{score}</span>
        <span className={styles.scoreOf}>/ {max}</span>
      </div>
    </div>
  )
}

function OralExamOverlay({
  grade,
  chapter,
  section,
  count,
  rosterSectionId,
  onClose,
}: Props & { count: OralExamCount; onClose: () => void }) {
  const { t, locale } = useT()
  const speechRef = useRef(new LearnSpeechController())
  const finalTranscriptRef = useRef('')
  const listenSessionRef = useRef({ committed: '' })
  const [phase, setPhase] = useState<Phase>('running')
  const [questions] = useState<OralExamItem[]>(() =>
    pickOralExamQuestions(grade.id, chapter.id, count, locale),
  )
  const [index, setIndex] = useState(0)
  const [step, setStep] = useState<OralStep>('ask')
  const [transcript, setTranscript] = useState('')
  const [committedTranscript, setCommittedTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [grades, setGrades] = useState<ExamGradeResult[]>([])
  const [lastFeedback, setLastFeedback] = useState<ExamGradeResult | null>(null)
  const [speaking, setSpeaking] = useState(false)
  const [listening, setListening] = useState(false)
  const [listenError, setListenError] = useState<ListenError>(null)
  const [answerPhase, setAnswerPhase] = useState<AnswerPhase>('think')
  const [thinkLeft, setThinkLeft] = useState(ORAL_THINK_SECONDS)
  const [recordElapsed, setRecordElapsed] = useState(0)
  const [saved, setSaved] = useState(false)

  const question = questions[index] ?? null
  const total = questions.length
  const totalPoints = grades.reduce((s, g) => s + g.score, 0)
  const maxPoints = total * 2
  const displayScore = examPointsToTestScore(totalPoints, maxPoints, count)
  const gradeKey = examGradeLabelFromRatio(maxPoints > 0 ? totalPoints / maxPoints : 0)
  const progressPct = total > 0 ? ((phase === 'results' ? total : index) / total) * 100 : 0

  const cameraActive = phase === 'running' && (step === 'listen' || step === 'grading')
  const { videoRef, status, errorCode, start: startMedia, stop: stopMedia } = useOralExamMedia(cameraActive)

  const speakQuestion = useCallback(
    async (q: OralExamItem) => {
      speechRef.current.stopOralListening()
      setListening(false)
      setListenError(null)
      setSpeaking(true)
      await speechRef.current.speak(q.questionSpeak, speechLocaleFromApp(locale), () => setSpeaking(false))
      await sleep(350)
      setSpeaking(false)
      setAnswerPhase('think')
      setThinkLeft(ORAL_THINK_SECONDS)
      setRecordElapsed(0)
      setInterimTranscript('')
      setStep('listen')
    },
    [locale],
  )

  useEffect(() => {
    if (!question || step !== 'ask') return
    void speakQuestion(question)
  }, [question, step, speakQuestion])

  const stopListening = useCallback(() => {
    speechRef.current.stopOralListening()
    setListening(false)
    setInterimTranscript('')
    setCommittedTranscript('')
    setTranscript((prev) => {
      const trimmed = prev.trim()
      finalTranscriptRef.current = trimmed
      return trimmed
    })
    setAnswerPhase('ready')
  }, [])

  const mergeTranscript = useCallback((prefix: string, committed: string, interim: string) => {
    const base = [prefix, committed].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
    if (!interim) return base
    return `${base}${base ? ' ' : ''}${interim}`.trim()
  }, [])

  const startListening = useCallback(async () => {
    if (!isSpeechRecognitionSupported()) {
      setListenError('unsupported')
      setAnswerPhase('ready')
      return
    }

    speechRef.current.stop()
    await sleep(400)

    const micOk = await ensureMicrophonePermission()
    if (!micOk) {
      setListenError('denied')
      setAnswerPhase('ready')
      return
    }

    setListenError(null)
    setListening(true)
    setAnswerPhase('recording')
    setRecordElapsed(0)
    setInterimTranscript('')
    setCommittedTranscript('')

    const prefix = finalTranscriptRef.current.trim()
    listenSessionRef.current = { committed: '' }

    const ok = speechRef.current.startOralListening(
      speechLocaleFromApp(locale),
      listenSessionRef.current,
      (committed, interim) => {
        const confirmed = mergeTranscript(prefix, committed, '')
        setCommittedTranscript(confirmed)
        setInterimTranscript(interim)
        const merged = mergeTranscript(prefix, committed, interim)
        setTranscript(merged)
        if (merged) setListenError(null)
      },
      (_code, fatal) => {
        if (fatal) {
          setListenError('denied')
          speechRef.current.stopOralListening()
          setListening(false)
          setInterimTranscript('')
          setAnswerPhase('ready')
        }
      },
    )

    if (!ok) {
      setListening(false)
      setListenError('start_failed')
      setAnswerPhase('ready')
    }
  }, [locale, mergeTranscript])

  const startAnswer = useCallback(() => {
    setThinkLeft(0)
    void startListening()
  }, [startListening])

  const finishRecording = useCallback(() => {
    stopListening()
  }, [stopListening])

  useEffect(() => {
    if (step !== 'listen' || answerPhase !== 'think' || thinkLeft <= 0) return
    const id = window.setInterval(() => {
      setThinkLeft((s) => Math.max(0, s - 1))
    }, 1000)
    return () => window.clearInterval(id)
  }, [step, answerPhase, thinkLeft])

  useEffect(() => {
    if (!listening || answerPhase !== 'recording') return
    const id = window.setInterval(() => {
      setRecordElapsed((e) => {
        const next = e + 1
        if (next >= ORAL_LISTEN_MAX_SECONDS) {
          window.setTimeout(() => stopListening(), 0)
        }
        return next
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [listening, answerPhase, stopListening])

  const listenErrorMessage = useMemo((): string | null => {
    if (!listenError) return null
    const key: Record<NonNullable<ListenError>, MessageKey> = {
      unsupported: 'learn.teacherExam.listenErrorUnsupported',
      denied: 'learn.teacherExam.listenErrorDenied',
      capture: 'learn.teacherExam.listenErrorCapture',
      start_failed: 'learn.teacherExam.listenErrorStart',
      unknown: 'learn.teacherExam.listenErrorUnknown',
    }
    return t(key[listenError])
  }, [listenError, t])

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
      speechRef.current.stop()
      speechRef.current.stopOralListening()
      stopMedia()
    }
  }, [onClose, stopMedia])

  const saveResult = useCallback(() => {
    if (saved || !rosterSectionId) return
    const student = getActiveStudent(rosterSectionId)
    if (!student) return
    recordStudentTestResult(rosterSectionId, student.id, {
      kind: 'oral',
      score: displayScore,
      total: count,
      correct: Math.round(totalPoints / 2),
    })
    setSaved(true)
  }, [count, displayScore, rosterSectionId, saved, totalPoints])

  const submitAnswer = useCallback(async () => {
    if (!question || !transcript.trim()) return
    stopListening()
    setStep('grading')
    const result = await gradeExamAnswer({
      question: question.questionDisplay ?? question.questionSpeak,
      rubric: question.rubric,
      sampleAnswer: question.sampleAnswer,
      studentAnswer: transcript,
      mode: 'oral',
      locale,
      gradeId: grade.id,
      chapterId: chapter.id,
      sectionTitle: section.titleKey,
    })
    setGrades((prev) => [...prev, result])
    setLastFeedback(result)
    setStep('feedback')
    setSpeaking(true)
    await speechRef.current.speak(result.feedback, speechLocaleFromApp(locale), () => setSpeaking(false))
    setSpeaking(false)
  }, [chapter.id, grade.id, locale, question, section.titleKey, stopListening, transcript])

  const handleNext = useCallback(() => {
    stopListening()
    if (index + 1 >= total) {
      saveResult()
      setPhase('results')
      return
    }
    setIndex((i) => i + 1)
    setTranscript('')
    finalTranscriptRef.current = ''
    setInterimTranscript('')
    setCommittedTranscript('')
    setLastFeedback(null)
    setListenError(null)
    setAnswerPhase('think')
    setThinkLeft(ORAL_THINK_SECONDS)
    setRecordElapsed(0)
    setStep('ask')
  }, [index, saveResult, stopListening, total])

  const restart = useCallback(() => {
    stopListening()
    setIndex(0)
    setGrades([])
    setTranscript('')
    finalTranscriptRef.current = ''
    setInterimTranscript('')
    setCommittedTranscript('')
    setLastFeedback(null)
    setListenError(null)
    setAnswerPhase('think')
    setThinkLeft(ORAL_THINK_SECONDS)
    setRecordElapsed(0)
    setStep('ask')
    setSaved(false)
    setPhase('running')
  }, [stopListening])

  const toggleMic = useCallback(() => {
    if (listening) {
      if (recordElapsed < ORAL_LISTEN_MIN_SECONDS && transcript.trim().length < 4) return
      finishRecording()
      return
    }
    void startListening()
  }, [finishRecording, listening, recordElapsed, startListening, transcript])

  const thinkComplete = thinkLeft <= 0
  const hasLiveText = committedTranscript.length > 0 || interimTranscript.length > 0

  const canFinishRecording =
    listening &&
    (recordElapsed >= ORAL_LISTEN_MIN_SECONDS || transcript.trim().length >= 4)

  const recordSecondsLeft = Math.max(0, ORAL_LISTEN_MAX_SECONDS - recordElapsed)

  const gradeClass =
    gradeKey === 'excellent'
      ? styles.gradeExcellent
      : gradeKey === 'good'
        ? styles.gradeGood
        : gradeKey === 'fair'
          ? styles.gradeFair
          : styles.gradeRetry

  const canSubmit = transcript.trim().length > 0 && step === 'listen' && !speaking

  return createPortal(
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <header className={styles.toolbar}>
        <h2 className={styles.toolbarTitle}>{t('learn.teacherExam.oralTitle')}</h2>
        {phase === 'running' ? (
          <>
            <div className={styles.progressWrap}>
              <div className={styles.progressBar} style={{ width: `${progressPct}%` }} />
            </div>
            <span className={styles.progressMeta}>
              {t('learn.studentTest.progress', { current: index + 1, total })}
            </span>
          </>
        ) : null}
        <button type="button" className={styles.closeBtn} onClick={onClose}>
          {t('learn.studentTest.close')}
        </button>
      </header>

      <main className={styles.main}>
        {phase === 'running' && question ? (
          <div className={`${styles.body} ${styles.oralLayout}`}>
            <div className={styles.oralMain}>
              <div className={styles.teacherBubble}>
                <span className={styles.teacherBadge}>{t('learn.teacherExam.teacherAsks')}</span>
                <p className={styles.question}>{question.questionDisplay ?? question.questionSpeak}</p>
                {speaking && step === 'ask' ? (
                  <p className={styles.speakingHint}>{t('learn.teacherExam.speaking')}</p>
                ) : null}
              </div>

              {step === 'listen' || step === 'grading' ? (
                <>
                  {step === 'listen' && answerPhase === 'think' ? (
                    <div className={`${styles.thinkBanner} ${thinkComplete ? styles.thinkBannerReady : ''}`}>
                      <div className={styles.thinkHeader}>
                        <p className={styles.thinkTitle}>{t('learn.teacherExam.thinkTitle')}</p>
                        {!thinkComplete ? (
                          <div className={styles.thinkRing} aria-hidden>
                            <svg viewBox="0 0 44 44">
                              <circle className={styles.thinkRingBg} cx="22" cy="22" r="18" />
                              <circle
                                className={styles.thinkRingFill}
                                cx="22"
                                cy="22"
                                r="18"
                                style={{
                                  strokeDashoffset: 113 * (1 - thinkLeft / ORAL_THINK_SECONDS),
                                }}
                              />
                            </svg>
                            <span className={styles.thinkRingNum}>{thinkLeft}</span>
                          </div>
                        ) : null}
                      </div>
                      <p className={styles.thinkTimer}>
                        {thinkComplete
                          ? t('learn.teacherExam.thinkReady')
                          : t('learn.teacherExam.thinkCountdown', { sec: String(thinkLeft) })}
                      </p>
                      <button
                        type="button"
                        className={thinkComplete ? styles.primaryBtn : styles.secondaryBtn}
                        onClick={startAnswer}
                      >
                        {t('learn.teacherExam.skipThink')}
                      </button>
                    </div>
                  ) : null}

                  {step === 'listen' && answerPhase === 'recording' ? (
                    <div className={styles.recordingBanner}>
                      <div className={styles.recordingHeader}>
                        <p className={styles.recordingLive}>{t('learn.teacherExam.recordingLive')}</p>
                        <div className={styles.waveBars} aria-hidden>
                          {[0, 1, 2, 3, 4].map((i) => (
                            <span key={i} className={styles.waveBar} style={{ animationDelay: `${i * 0.12}s` }} />
                          ))}
                        </div>
                      </div>
                      <p className={styles.recordingMeta}>
                        {t('learn.teacherExam.recordingMeta', {
                          elapsed: String(recordElapsed),
                          left: String(recordSecondsLeft),
                        })}
                      </p>
                    </div>
                  ) : null}

                  {step === 'listen' && answerPhase === 'ready' && !listening ? (
                    <p className={styles.listenHint}>{t('learn.teacherExam.recordingDone')}</p>
                  ) : null}

                  {(step === 'listen' && (listening || hasLiveText || answerPhase === 'ready')) ||
                  step === 'grading' ? (
                    <div
                      className={`${styles.liveTranscriptCard} ${listening ? styles.liveTranscriptActive : ''}`}
                      aria-live="polite"
                      aria-atomic="false"
                    >
                      <span className={styles.liveTranscriptBadge}>
                        {listening
                          ? t('learn.teacherExam.liveListening')
                          : t('learn.teacherExam.liveWritten')}
                      </span>
                      <div className={styles.liveTranscriptBody}>
                        {hasLiveText ? (
                          <>
                            <span className={styles.liveFinal}>{committedTranscript}</span>
                            {interimTranscript ? (
                              <span className={styles.liveInterim}>
                                {committedTranscript ? ' ' : ''}
                                {interimTranscript}
                                <span className={styles.liveCursor} aria-hidden />
                              </span>
                            ) : listening ? (
                              <span className={styles.liveCursor} aria-hidden />
                            ) : null}
                          </>
                        ) : listening ? (
                          <span className={styles.livePlaceholder}>{t('learn.teacherExam.liveWaiting')}</span>
                        ) : (
                          <span className={styles.livePlaceholder}>{t('learn.teacherExam.transcriptEmpty')}</span>
                        )}
                      </div>
                    </div>
                  ) : null}

                  <div className={styles.voiceRow}>
                    {answerPhase !== 'think' ? (
                      <button
                        type="button"
                        className={listening ? styles.micBtnActive : styles.micBtn}
                        onClick={toggleMic}
                        disabled={step === 'grading' || (listening && !canFinishRecording)}
                      >
                        {listening
                          ? t('learn.teacherExam.finishRecording')
                          : t('learn.teacherExam.recordAgain')}
                      </button>
                    ) : null}
                  </div>
                  {listening && !canFinishRecording ? (
                    <p className={styles.listenHint}>{t('learn.teacherExam.waitBeforeStop')}</p>
                  ) : null}
                  {listenErrorMessage && !listening ? (
                    <p className={styles.listenError}>{listenErrorMessage}</p>
                  ) : null}
                  <label className={styles.hint} htmlFor="oral-exam-answer">
                    {t('learn.teacherExam.transcriptEdit')}
                  </label>
                  <textarea
                    id="oral-exam-answer"
                    className={`${styles.transcriptInput} ${listening ? styles.transcriptInputLive : ''}`}
                    value={transcript}
                    onChange={(e) => {
                      const value = e.target.value
                      setTranscript(value)
                      setCommittedTranscript(value)
                      setInterimTranscript('')
                      finalTranscriptRef.current = value
                    }}
                    placeholder={t('learn.teacherExam.transcriptEmpty')}
                    disabled={step === 'grading'}
                    rows={5}
                  />
                  <div className={styles.actionRow}>
                    <button type="button" className={styles.primaryBtn} disabled={!canSubmit} onClick={() => void submitAnswer()}>
                      {step === 'grading' ? t('learn.teacherExam.grading') : t('learn.teacherExam.submitAnswer')}
                    </button>
                    <button type="button" className={styles.secondaryBtn} onClick={() => void speakQuestion(question)}>
                      {t('learn.teacherExam.repeatQuestion')}
                    </button>
                  </div>
                </>
              ) : null}

              {step === 'feedback' && lastFeedback ? (
                <>
                  <p
                    className={`${styles.feedback} ${
                      lastFeedback.verdict === 'correct'
                        ? styles.feedbackOk
                        : lastFeedback.verdict === 'partial'
                          ? styles.feedbackPartial
                          : styles.feedbackBad
                    }`}
                  >
                    {lastFeedback.feedback}
                  </p>
                  <p className={styles.hint}>
                    {t('learn.teacherExam.pointsEarned', {
                      score: lastFeedback.score,
                      max: lastFeedback.maxScore,
                    })}
                  </p>
                  <div className={styles.actionRow}>
                    <button type="button" className={styles.primaryBtn} onClick={handleNext}>
                      {index + 1 >= total ? t('learn.studentTest.seeResults') : t('learn.studentTest.next')}
                    </button>
                  </div>
                </>
              ) : null}
            </div>

            <aside className={styles.oralSide}>
              <OralExamCameraPanel
                videoRef={videoRef}
                status={status}
                errorCode={errorCode}
                listening={listening}
                onRetry={() => void startMedia()}
              />
              <BrainInsightPanel
                videoRef={videoRef}
                active={phase === 'running' && status === 'active'}
                studentId={rosterSectionId ? getActiveStudent(rosterSectionId)?.id ?? 'guest' : 'guest'}
                lang={locale}
              />
            </aside>
          </div>
        ) : null}

        {phase === 'results' ? (
          <div className={`${styles.results} ${styles.body}`}>
            <ExamScoreRing score={displayScore} max={count} />
            <h3 className={styles.resultsTitle}>{t('learn.studentTest.resultsTitle')}</h3>
            <p className={`${styles.resultsGrade} ${gradeClass}`}>
              {t(`learn.studentTest.grade.${gradeKey}` as MessageKey)}
            </p>
            {rosterSectionId && saved ? (
              <p className={styles.savedHint}>{t('learn.studentStats.saved')}</p>
            ) : null}
            <div className={styles.statsRow}>
              <div>
                <div className={styles.statValue}>{totalPoints}</div>
                <div className={styles.statLabel}>{t('learn.teacherExam.totalPoints')}</div>
              </div>
              <div>
                <div className={styles.statValue}>{maxPoints}</div>
                <div className={styles.statLabel}>{t('learn.teacherExam.maxPoints')}</div>
              </div>
            </div>
            <div className={styles.actionRow} style={{ justifyContent: 'center' }}>
              <button type="button" className={styles.secondaryBtn} onClick={restart}>
                {t('learn.studentTest.retry')}
              </button>
              <button type="button" className={styles.primaryBtn} onClick={onClose}>
                {t('learn.studentTest.done')}
              </button>
            </div>
          </div>
        ) : null}
      </main>
    </div>,
    document.body,
  )
}

export function LearnOralExamPanel({
  grade,
  chapter,
  section,
  rosterSectionId,
  disabled = false,
}: Props) {
  const { t } = useT()
  const poolSize = oralExamPoolSize(grade.id, chapter.id)
  const [count, setCount] = useState<OralExamCount>(10)
  const [active, setActive] = useState(false)

  const canStart = poolSize >= 5 && !disabled
  const effectiveCount = useMemo(
    () => (count === 10 && poolSize < 10 ? (5 as OralExamCount) : count),
    [count, poolSize],
  )

  return (
    <section className={styles.panel}>
      <div className={styles.setupRow}>
        <div className={styles.countPicker} role="group" aria-label={t('learn.studentTest.pickCount')}>
          <button
            type="button"
            className={count === 5 ? styles.countBtnActive : styles.countBtn}
            onClick={() => setCount(5)}
          >
            {t('learn.studentTest.questions5')}
          </button>
          <button
            type="button"
            className={count === 10 ? styles.countBtnActive : styles.countBtn}
            onClick={() => setCount(10)}
            disabled={poolSize < 10}
          >
            {t('learn.studentTest.questions10')}
          </button>
        </div>
        <button
          type="button"
          className={styles.primaryBtn}
          disabled={!canStart}
          onClick={() => {
            void ensureMicrophonePermission()
            setActive(true)
          }}
        >
          {t('learn.teacherExam.startOral')}
        </button>
      </div>
      <p className={styles.hint}>
        {disabled
          ? t('learn.molecules.structure.testNoStudent')
          : canStart
            ? t('learn.teacherExam.oralPoolHint', { n: poolSize })
            : t('learn.studentTest.notEnough')}
      </p>
      {active ? (
        <OralExamOverlay
          grade={grade}
          chapter={chapter}
          section={section}
          rosterSectionId={rosterSectionId}
          count={effectiveCount}
          onClose={() => setActive(false)}
        />
      ) : null}
    </section>
  )
}
