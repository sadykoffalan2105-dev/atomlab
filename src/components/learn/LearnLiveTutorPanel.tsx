import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import type { LearnChapter, LearnGrade, LearnSection } from '../../types/learn'
import { getActiveStudent } from '../../learn/learnClassRosterStorage'
import { warmupPuterFromUserGesture } from '../../learn/learnPuterTts'
import { useOralExamMedia } from '../../learn/useOralExamMedia'
import { isSpeechRecognitionSupported } from '../../learn/learnSpeech'
import { useDualModeTeacher } from '../../learn/brain'
import { prewarmLiveTeacher } from '../../learn/brain/dualMode'
import type { TutorMode } from '../../learn/brain'
import { useT, type MessageKey } from '../../i18n/useT'
import { IconClose, IconMic } from './LearnAiIcons'
import { BrainChip, SmartAiCta } from './teacher/TeacherChips'
import { TeacherAvatar, type AvatarState } from './teacher/TeacherAvatar'
import { LiveCaptions } from './teacher/LiveCaptions'
import { LiveTranscript, type QueuedTurn } from './teacher/LiveTranscript'
import { LiveTutorLobby } from './teacher/LiveTutorLobby'
import {
  IconHandStop,
  IconKeyboardSmall,
  IconMicOff,
  IconPhoneOff,
  IconVideo,
  IconVideoOff,
  IconWifiOff,
} from './teacher/TeacherIcons'
import { EMOTION_LABEL, ENGAGEMENT_LABEL, ENGAGEMENT_TONE, PACE_HINT, labelLocale } from './teacher/liveTutorLabels'
import { isSmartAiOptedIn, useSmartAi } from './teacher/smartAiStore'
import styles from './teacher/LiveTutor.module.css'

type Props = {
  grade: LearnGrade
  chapter: LearnChapter
  section: LearnSection
  rosterSectionId?: string
  disabled?: boolean
  embedded?: boolean
}

const INTERRUPTED_FLASH_MS = 1_400

function subscribeOnline(cb: () => void): () => void {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}
const readOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine)
const readOnlineServer = () => true

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || tag === 'A'
}

const CAMERA_ERROR_KEY: Record<string, MessageKey> = {
  not_supported: 'learn.teacherExam.cameraErrorUnsupported',
  denied: 'learn.teacherExam.cameraErrorDenied',
  not_found: 'learn.teacherExam.cameraErrorNotFound',
  in_use: 'learn.teacherExam.cameraErrorInUse',
  unknown: 'learn.teacherExam.cameraErrorUnknown',
}

const STATUS_KEY: Record<AvatarState | 'text', MessageKey> = {
  connecting: 'learn.teacherUi.statusConnecting',
  listening: 'learn.teacherUi.statusListening',
  hearing: 'learn.teacherUi.statusHearing',
  thinking: 'learn.teacherUi.statusThinking',
  speaking: 'learn.teacherUi.statusSpeaking',
  interrupted: 'learn.teacherUi.statusInterrupted',
  paused: 'learn.teacherUi.statusPaused',
  text: 'learn.teacherUi.statusTextMode',
}

type SessionProps = Props & {
  mode: TutorMode
  withVoice: boolean
  cameraOn: boolean
  onCameraChange: (on: boolean) => void
  onRetryMic: () => void
  onClose: () => void
}

/** Идущий урок: аватар, субтитры, расшифровка, панель управления. */
function LiveTutorSession({
  grade,
  chapter,
  section,
  rosterSectionId,
  mode: initialMode,
  withVoice,
  cameraOn,
  onCameraChange,
  onRetryMic,
  onClose,
}: SessionProps) {
  const { t, locale } = useT()
  const {
    videoRef: cameraRef,
    status: cameraStatus,
    errorCode: cameraError,
    start: startCamera,
    stop: stopCamera,
  } = useOralExamMedia(cameraOn)
  const smartAi = useSmartAi()
  const online = useSyncExternalStore(subscribeOnline, readOnline, readOnlineServer)
  const [videoNode, setVideoNode] = useState<HTMLVideoElement | null>(null)
  const [flashUntil, setFlashUntil] = useState<number | null>(null)
  const homeworkFileRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Ученик из списка класса; иначе движок сам выдаст стабильный анонимный id (не 'guest').
  const studentId = rosterSectionId ? getActiveStudent(rosterSectionId)?.id : undefined
  const sectionTitle = t(section.titleKey)
  const videoEl = cameraOn && cameraStatus === 'active' ? videoNode : null
  const attachVideo = useCallback(
    (el: HTMLVideoElement | null) => {
      cameraRef.current = el
      setVideoNode(el)
    },
    [cameraRef],
  )

  const teacher = useDualModeTeacher({
    studentId,
    lang: locale,
    gradeId: grade.id,
    chapterId: chapter.id,
    sectionTitle,
    sectionId: section.id,
    topics: [sectionTitle],
    initialMode,
    voice: withVoice,
    videoEl,
  })
  const { state, start, stop, setMode, sendText, askAnother, nextTopic, checkHomework, setMicMuted, interrupt } =
    teacher

  // Старт/стоп сессии в одном эффекте: в StrictMode (dev) эффект монтируется дважды —
  // stop() гасит первую сессию, повторный start() создаёт новую (start сам защищён от дубля).
  useEffect(() => {
    void start()
    return () => {
      stop()
      stopCamera()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ——— Производное состояние ———
  const messages = state.messages
  const lastStudent = [...messages].reverse().find((m) => m.role === 'you')
  const lastTeacher = [...messages].reverse().find((m) => m.role === 'teacher')
  // «Думаю» показывает сам движок: он снимает флаг в finally каждого хода.
  const awaitingReply = state.thinking && !state.aiSpeaking

  // Вспышка «Перебили» (голосом, кнопкой или новым сообщением).
  const [seenInterruptAt, setSeenInterruptAt] = useState<number | null>(null)
  if (state.interruptedAt !== seenInterruptAt) {
    setSeenInterruptAt(state.interruptedAt)
    if (state.interruptedAt !== null) setFlashUntil(state.interruptedAt + INTERRUPTED_FLASH_MS)
  }
  const interrupted = flashUntil !== null
  useEffect(() => {
    if (flashUntil === null) return
    const timer = window.setTimeout(() => setFlashUntil(null), Math.max(0, flashUntil - Date.now()))
    return () => window.clearTimeout(timer)
  }, [flashUntil])

  const micUsable = withVoice && state.micActive && state.sttError !== 'not-allowed'
  // Новый ответ важнее вспышки «Перебили»: после перебивания учитель часто уже думает над новым вопросом.
  const avatarState: AvatarState = !state.running
    ? 'connecting'
    : state.aiSpeaking
      ? 'speaking'
      : awaitingReply
        ? 'thinking'
        : interrupted
          ? 'interrupted'
          : !micUsable || state.micMuted
            ? 'paused'
            : state.partial || state.turn === 'user_speaking'
              ? 'hearing'
              : 'listening'
  // Движок здоровается только после ответа на запрос микрофона: пока реплик учителя нет
  // и микрофона нет — браузер ещё показывает окно разрешения.
  const teacherStarted = messages.some((m) => m.role === 'teacher') || state.aiSpeaking
  const micWaiting = withVoice && state.running && !state.micActive && !teacherStarted && !state.sttError
  const micDenied =
    withVoice && state.running && (state.sttError === 'not-allowed' || (!state.micActive && teacherStarted))
  const sttBlocked = state.sttError === 'service-not-allowed' || state.sttError === 'language-not-supported'
  const statusKey: MessageKey =
    avatarState === 'paused' && micWaiting
      ? 'learn.teacherUi.statusMicWaiting'
      : avatarState === 'paused' && (!micUsable || sttBlocked)
        ? STATUS_KEY.text
        : STATUS_KEY[avatarState]

  // ——— Реплики ученика: движок держит FIFO-очередь, ничего не теряется ———
  // Текст/команда во время речи учителя сразу прерывает его и обрабатывается по порядку.
  const queue: QueuedTurn[] = useMemo(
    () =>
      state.queued.map((q) => ({
        id: q.id,
        kind: q.kind === 'command' ? 'command' : 'text',
        text: q.text,
        label: q.label,
      })),
    [state.queued],
  )

  const submitText = (text: string) => {
    void sendText(text)
  }
  const runCommand = (cmd: 'ask_another' | 'next_topic') => {
    const label = cmd === 'ask_another' ? t('learn.teacherExam.liveAskAnother') : t('learn.teacherExam.liveNextTopic')
    if (cmd === 'ask_another') void askAnother(label)
    else void nextTopic(label)
  }

  const toggleMic = useCallback(() => {
    if (!micUsable) {
      inputRef.current?.focus()
      return
    }
    setMicMuted(!state.micMuted)
  }, [micUsable, setMicMuted, state.micMuted])

  const doInterrupt = useCallback(() => {
    interrupt()
  }, [interrupt])

  // Пробел — микрофон, Esc — выйти.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if ((e.code === 'Space' || e.key === ' ') && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (isTypingTarget(e.target)) return
        e.preventDefault()
        toggleMic()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, toggleMic])

  const modeIsExam = state.mode === 'exam'
  const fused = state.fused
  const loc = labelLocale(locale)
  const cameraLive = cameraOn && cameraStatus === 'active'
  const brain = smartAi.connected ? 'smart' : 'local'
  const speakingMessageId = state.aiSpeaking ? (state.speakingMessageId ?? lastTeacher?.id ?? null) : null

  return (
    <>
      <header className={styles.topbar}>
        <div className={styles.topTitle}>
          <span className={styles.liveDot} data-on={state.running ? '1' : undefined} aria-hidden />
          <div className={styles.topTitleText}>
            <h2 className={styles.title}>{t('learn.teacherUi.liveTitle')}</h2>
            <p className={styles.topic} title={sectionTitle}>
              {sectionTitle}
            </p>
          </div>
        </div>

        <div className={styles.topMeta}>
          <BrainChip brain={brain} />
          {!smartAi.connected ? (
            <SmartAiCta layout="inline" className={styles.topCta} />
          ) : (
            <button type="button" className={styles.topLink} onClick={smartAi.disconnect}>
              {t('learn.teacherUi.smartDisconnect')}
            </button>
          )}
          <div className={styles.segmented} role="radiogroup" aria-label={t('learn.teacherUi.modeAria')}>
            {(['training', 'exam'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={state.mode === m}
                className={styles.segBtn}
                data-on={state.mode === m ? '1' : undefined}
                data-mode={m}
                onClick={() => void setMode(m)}
                title={m === 'exam' ? t('learn.teacherExam.liveModeExamDesc') : t('learn.teacherExam.liveModeTrainingDesc')}
              >
                {m === 'exam' ? t('learn.teacherExam.liveModeExam') : t('learn.teacherExam.liveModeTraining')}
              </button>
            ))}
          </div>
        </div>

        <button type="button" className={styles.closeBtn} onClick={onClose} aria-label={t('learn.studentTest.close')}>
          <IconClose />
          <span className={styles.closeLabel}>{t('learn.studentTest.close')}</span>
        </button>
      </header>

      <div className={styles.main}>
        <section className={styles.stage} data-mode={modeIsExam ? 'exam' : 'training'}>
          <div className={styles.banners}>
            {!online ? (
              <p className={styles.banner} data-tone="warn" role="status">
                <IconWifiOff className={styles.bannerIcon} />
                <span>{t('learn.teacherUi.offline')}</span>
              </p>
            ) : null}
            {micWaiting ? (
              <p className={styles.banner} data-tone="info" role="note">
                <IconMic className={styles.bannerIcon} />
                <span>{t('learn.teacherUi.micWaiting')}</span>
              </p>
            ) : null}
            {sttBlocked && !micDenied ? (
              <p className={styles.banner} data-tone="warn" role="alert">
                <IconKeyboardSmall className={styles.bannerIcon} />
                <span>
                  {state.sttError === 'language-not-supported'
                    ? t('learn.teacherUi.sttLanguage')
                    : t('learn.teacherUi.sttServiceBlocked')}
                </span>
              </p>
            ) : null}
            {micDenied ? (
              <div className={styles.banner} data-tone="danger" role="alert">
                <IconMicOff className={styles.bannerIcon} />
                <span>{t('learn.teacherUi.micDenied')}</span>
                <button type="button" className={styles.bannerBtn} onClick={onRetryMic}>
                  {t('learn.teacherUi.retry')}
                </button>
              </div>
            ) : null}
          </div>

          <div className={styles.avatarWrap}>
            <TeacherAvatar
              state={avatarState}
              subscribeLevel={micUsable && !state.micMuted ? teacher.subscribeMicLevel : undefined}
              className={styles.avatar}
            />
            <p className={styles.status} data-state={avatarState} role="status" aria-live="polite">
              {t(statusKey)}
            </p>
          </div>

          <LiveCaptions
            teacherText={lastTeacher?.text ?? ''}
            speaking={state.aiSpeaking}
            partial={state.partial}
            lastStudentText={lastStudent?.text ?? ''}
            thinking={awaitingReply}
            lang={loc}
            spokenIndex={speakingMessageId !== null && speakingMessageId === lastTeacher?.id ? state.spokenSentenceIndex : -1}
            spokenText={speakingMessageId !== null && speakingMessageId === lastTeacher?.id ? state.spokenSentenceText : ''}
          />

          {state.question && modeIsExam ? (
            <div className={styles.questionCard}>
              <span className={styles.questionTag}>{t('learn.teacherUi.examQuestion')}</span>
              <p>{state.question.display}</p>
            </div>
          ) : null}

          {cameraOn ? (
            <div className={styles.pip} data-live={cameraLive ? '1' : undefined}>
              <video ref={attachVideo} className={styles.pipVideo} muted playsInline />
              {!cameraLive ? (
                <div className={styles.pipOverlay}>
                  <p>
                    {cameraStatus === 'error'
                      ? t(CAMERA_ERROR_KEY[cameraError ?? 'unknown'] ?? 'learn.teacherExam.cameraErrorUnknown')
                      : t('learn.teacherUi.cameraStarting')}
                  </p>
                  {cameraStatus === 'error' ? (
                    <button type="button" className={styles.bannerBtn} onClick={() => void startCamera()}>
                      {t('learn.teacherExam.cameraRetry')}
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className={styles.pipInsight}>
                  {fused ? (
                    <>
                      <span className={styles.insightMain} data-tone={ENGAGEMENT_TONE[fused.engagement]}>
                        {t('learn.teacherUi.attention')} {Math.round(fused.attention * 100)}% ·{' '}
                        {ENGAGEMENT_LABEL[fused.engagement][loc]}
                      </span>
                      <span className={styles.insightSub}>
                        {EMOTION_LABEL[fused.emotion][loc]} · {PACE_HINT[fused.emotion][loc]}
                      </span>
                    </>
                  ) : (
                    <span className={styles.insightSub}>{t('learn.teacherUi.attentionAnalyzing')}</span>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </section>

        <LiveTranscript
          messages={messages}
          partial={state.partial}
          queued={queue}
          speakingMessageId={speakingMessageId}
          reasoning={state.reasoning}
          inputRef={inputRef}
          onSend={submitText}
          onAskAnother={() => runCommand('ask_another')}
          onNextTopic={() => runCommand('next_topic')}
          onHomeworkPhoto={() => homeworkFileRef.current?.click()}
          onHomeworkText={(text) => void checkHomework(text)}
        />
        <input
          ref={homeworkFileRef}
          type="file"
          accept="image/*"
          className={styles.fileHidden}
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (!file) return
            void (async () => {
              try {
                const { loadHomeworkImageFile } = await import('../../learn/homework')
                const scan = await loadHomeworkImageFile(file, { locale })
                const text = (scan.ocrText ?? '').trim()
                if (text.length >= 12) await checkHomework(text)
              } catch {
                /* ученик может ввести текст ДЗ вручную */
              }
            })()
          }}
        />
      </div>

      <footer className={styles.dock}>
        <p className={styles.keysHint}>{t('learn.teacherUi.keysHint')}</p>
        <div className={styles.dockCenter}>
          <button
            type="button"
            className={styles.roundBtn}
            data-on={cameraOn ? '1' : undefined}
            onClick={() => onCameraChange(!cameraOn)}
            aria-pressed={cameraOn}
            aria-label={cameraOn ? t('learn.teacherUi.camOff') : t('learn.teacherUi.camOn')}
            title={cameraOn ? t('learn.teacherUi.camOff') : t('learn.teacherUi.camOn')}
          >
            {cameraOn ? <IconVideo /> : <IconVideoOff />}
          </button>

          <button
            type="button"
            className={styles.micBtn}
            data-state={!micUsable ? 'off' : state.micMuted ? 'muted' : 'on'}
            onClick={toggleMic}
            aria-pressed={micUsable && !state.micMuted}
            aria-label={
              !micUsable
                ? t('learn.teacherUi.micUnavailable')
                : state.micMuted
                  ? t('learn.teacherUi.micTurnOn')
                  : t('learn.teacherUi.micTurnOff')
            }
            title={`${!micUsable ? t('learn.teacherUi.micUnavailable') : state.micMuted ? t('learn.teacherUi.micTurnOn') : t('learn.teacherUi.micTurnOff')} (${t('learn.teacherUi.spaceKey')})`}
          >
            <MicLevelRing subscribe={micUsable && !state.micMuted ? teacher.subscribeMicLevel : undefined}>
              {micUsable && !state.micMuted ? <IconMic /> : <IconMicOff />}
            </MicLevelRing>
            <span className={styles.micLabel}>
              {!micUsable
                ? t('learn.teacherUi.micUnavailableShort')
                : state.micMuted
                  ? t('learn.teacherUi.micOff')
                  : t('learn.teacherUi.micOn')}
            </span>
          </button>

          <button
            type="button"
            className={styles.pillBtn}
            onClick={doInterrupt}
            disabled={!state.aiSpeaking && !state.thinking}
            title={t('learn.teacherUi.interrupt')}
          >
            <IconHandStop className={styles.btnIcon} />
            <span>{t('learn.teacherUi.interrupt')}</span>
          </button>

          <button type="button" className={styles.endBtn} onClick={onClose} title={t('learn.teacherUi.endCall')}>
            <IconPhoneOff className={styles.btnIcon} />
            <span>{t('learn.teacherUi.endCall')}</span>
          </button>
        </div>
        <span className={styles.dockSpacer} aria-hidden />
      </footer>
    </>
  )
}

/** Кольцо уровня микрофона вокруг иконки (CSS-переменная, без перерисовок). */
function MicLevelRing({
  subscribe,
  children,
}: {
  subscribe?: (listener: (rms: number) => void) => () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !subscribe) return
    let target = 0
    let current = 0
    let raf = 0
    const off = subscribe((rms) => {
      target = Math.min(1, Math.max(0, (rms - 0.008) * 7))
    })
    const tick = () => {
      current += (target - current) * (target > current ? 0.5 : 0.15)
      target *= 0.92
      el.style.setProperty('--mic-level', current.toFixed(3))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      off()
      cancelAnimationFrame(raf)
      el.style.setProperty('--mic-level', '0')
    }
  }, [subscribe])
  return (
    <span ref={ref} className={styles.micCore}>
      {children}
    </span>
  )
}

/**
 * Полноэкранный онлайн-урок («видеозвонок с учителем»):
 * сначала экран разрешений, затем сессия. Esc — закрыть.
 */
function LiveTutorOverlay({
  grade,
  chapter,
  section,
  rosterSectionId,
  initialMode,
  onClose,
}: Props & { initialMode: TutorMode; onClose: () => void }) {
  const { t, locale } = useT()
  const online = useSyncExternalStore(subscribeOnline, readOnline, readOnlineServer)
  const [phase, setPhase] = useState<'lobby' | 'session'>('lobby')

  // Пока ученик в лобби — прогреваем базу знаний, голоса и экзаменационный пул.
  useEffect(() => {
    prewarmLiveTeacher({ gradeId: grade.id, chapterId: chapter.id, lang: locale })
  }, [grade.id, chapter.id, locale])
  const [mode, setMode] = useState<TutorMode>(initialMode)
  const [cameraOn, setCameraOn] = useState(false)
  const [withVoice, setWithVoice] = useState(true)
  const [sessionKey, setSessionKey] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const speechSupported = useMemo(() => isSpeechRecognitionSupported(), [])
  const sectionTitle = t(section.titleKey)

  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    const prevFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
      prevFocus?.focus?.({ preventScroll: true })
    }
  }, [])

  // Esc в лобби (в сессии обрабатывает сама сессия) + удержание фокуса внутри диалога.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && phase === 'lobby') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'Tab' || !rootRef.current) return
      const focusables = rootRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), textarea, input:not([type="file"]):not([tabindex="-1"]), [href], [tabindex="0"]',
      )
      if (focusables.length === 0) return
      const first = focusables[0]!
      const last = focusables[focusables.length - 1]!
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, phase])

  return createPortal(
    <div
      ref={rootRef}
      className={styles.overlay}
      data-phase={phase}
      role="dialog"
      aria-modal="true"
      aria-label={t('learn.teacherUi.liveTitle')}
    >
      <div className={styles.backdrop} aria-hidden />
      {phase === 'lobby' ? (
        <>
          <header className={styles.topbar}>
            <div className={styles.topTitle}>
              <span className={styles.liveDot} aria-hidden />
              <div className={styles.topTitleText}>
                <h2 className={styles.title}>{t('learn.teacherUi.liveTitle')}</h2>
                <p className={styles.topic}>{sectionTitle}</p>
              </div>
            </div>
            <span className={styles.topMeta} />
            <button type="button" className={styles.closeBtn} onClick={onClose} aria-label={t('learn.studentTest.close')}>
              <IconClose />
              <span className={styles.closeLabel}>{t('learn.studentTest.close')}</span>
            </button>
          </header>
          <LiveTutorLobby
            topic={sectionTitle}
            mode={mode}
            onModeChange={setMode}
            cameraOn={cameraOn}
            onCameraChange={setCameraOn}
            speechSupported={speechSupported}
            online={online}
            onStart={(voice) => {
              if (isSmartAiOptedIn()) warmupPuterFromUserGesture()
              setWithVoice(voice)
              setPhase('session')
            }}
          />
        </>
      ) : (
        <LiveTutorSession
          key={sessionKey}
          grade={grade}
          chapter={chapter}
          section={section}
          rosterSectionId={rosterSectionId}
          mode={mode}
          withVoice={withVoice}
          cameraOn={cameraOn}
          onCameraChange={setCameraOn}
          onRetryMic={() => setSessionKey((k) => k + 1)}
          onClose={onClose}
        />
      )}
    </div>,
    document.body,
  )
}

/**
 * Компактная кнопка запуска онлайн-урока — встраивается в ИИ-учителя
 * (боковую панель урока). `icon` — необязательная inline-SVG иконка перед подписью.
 */
export function LiveDialogButton({
  grade,
  chapter,
  section,
  rosterSectionId,
  className,
  icon,
  disabled = false,
}: Props & { className?: string; icon?: ReactNode }) {
  const { t } = useT()
  const [active, setActive] = useState(false)

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => setActive(true)}
        title={t('learn.teacherUi.liveTitle')}
        aria-label={t('learn.teacherExam.liveStart')}
        disabled={disabled}
        aria-haspopup="dialog"
      >
        {icon}
        <span>{t('learn.teacherExam.liveStart')}</span>
      </button>
      {active ? (
        <LiveTutorOverlay
          grade={grade}
          chapter={chapter}
          section={section}
          rosterSectionId={rosterSectionId}
          initialMode="training"
          onClose={() => setActive(false)}
        />
      ) : null}
    </>
  )
}

/** Отдельная карточка запуска (обучение / экзамен) — для страниц без чата. */
export function LearnLiveTutorPanel({ grade, chapter, section, rosterSectionId, disabled = false }: Props) {
  const { t } = useT()
  const [active, setActive] = useState(false)
  const [initialMode, setInitialMode] = useState<TutorMode>('training')

  const launch = (mode: TutorMode) => {
    setInitialMode(mode)
    setActive(true)
  }

  return (
    <section className={styles.launchCard}>
      <div className={styles.launchRow}>
        <button type="button" className={styles.startBtn} disabled={disabled} onClick={() => launch('training')}>
          <IconMic className={styles.btnIcon} />
          <span>{t('learn.teacherExam.liveStart')}</span>
        </button>
        <button type="button" className={styles.ghostBtn} disabled={disabled} onClick={() => launch('exam')}>
          {t('learn.teacherExam.liveModeExam')}
        </button>
      </div>
      <p className={styles.launchTip}>{t('learn.teacherUi.launchTip')}</p>
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
