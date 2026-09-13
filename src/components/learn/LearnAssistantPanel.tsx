import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type SVGProps,
} from 'react'
import { useT, type MessageKey } from '../../i18n/useT'
import { generateLocalLearnReply, type LearnLocalAssistantContext } from '../../learn/learnLocalAssistant'
import { routeTeacherReply, type TeacherReplySource } from '../../learn/learnTeacherRouter'
import {
  isSpeechOutputSupported,
  isSpeechRecognitionSupported,
  LearnSpeechController,
  preloadSpeechVoices,
  type SpeechOutputMode,
} from '../../learn/learnSpeech'
import type { LearnChapter, LearnGrade, LearnSection } from '../../types/learn'
import { checkTeacherServiceHealth, requestTeacherChat } from '../../learn/teacherServiceClient'
import { filterAssistantReply } from '../../learn/learnAssistantGuard'
import { LearnAssistantMarkdown } from './LearnAssistantMarkdown'
import { LiveDialogButton } from './LearnLiveTutorPanel'
import { warmupPuterFromUserGesture } from '../../learn/learnPuterTts'
import {
  formatHomeworkReportForChat,
  homeworkUserLabel,
  loadHomeworkImageFile,
  reviewHomework,
  saveHomeworkReviewToHistory,
} from '../../learn/homework'
import {
  IconAlert,
  IconAtom,
  IconBookmark,
  IconBroadcast,
  IconBulb,
  IconCamera,
  IconCheckCircle,
  IconClose,
  IconGlobe,
  IconInfo,
  IconLink,
  IconMic,
  IconSend,
  IconSliders,
  IconSpeaker,
  IconSteps,
  IconStop,
  IconTrash,
} from './LearnAiIcons'
import styles from './LearnAssistantPanel.module.css'

const CHAT_URL = import.meta.env.VITE_LEARN_CHAT_URL ?? '/api/learn/chat'

type AssistantSource = 'openai' | 'local' | 'ollama' | 'puter'

type ChatMessage = {
  role: 'user' | 'assistant'
  text: string
  at: number
  source?: AssistantSource
}

const QUICK_KEYS = [
  'learn.assistant.quick1',
  'learn.assistant.quick2',
  'learn.assistant.quick3',
  'learn.assistant.quick4',
  'learn.assistant.quick5',
  'learn.assistant.quick6',
] as const satisfies readonly MessageKey[]

/** Иконка и акцент для каждой быстрой подсказки (порядок как в QUICK_KEYS). */
const QUICK_META: readonly { Icon: ComponentType<SVGProps<SVGSVGElement>>; tone: string }[] = [
  { Icon: IconBulb, tone: 'amber' },
  { Icon: IconGlobe, tone: 'teal' },
  { Icon: IconBookmark, tone: 'pink' },
  { Icon: IconCheckCircle, tone: 'green' },
  { Icon: IconSteps, tone: 'violet' },
  { Icon: IconLink, tone: 'cyan' },
]

function storageKey(gradeId: string, chapterId: string, sectionId: string): string {
  return `atomlab-learn-chat-${gradeId}-${chapterId}-${sectionId}`
}

function loadStored(key: string): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ChatMessage[]
    return Array.isArray(parsed) ? parsed.slice(-24) : []
  } catch {
    return []
  }
}

function saveStored(key: string, messages: ChatMessage[]): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(messages.slice(-24)))
  } catch {
    /* quota */
  }
}

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

function prefersCoarsePointer(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function LearnAssistantPanel({
  gradeId,
  chapterId,
  section,
  slideIndex,
  slideTitle,
  slideBody,
  grade,
  chapter,
  rosterSectionId,
}: {
  gradeId: string
  chapterId: string
  section: LearnSection
  slideIndex: number
  slideTitle: string
  slideBody: string
  grade?: LearnGrade
  chapter?: LearnChapter
  rosterSectionId?: string
}) {
  void slideIndex
  const { t, locale } = useT()
  const [mode, setMode] = useState<'teacher' | 'helper'>('teacher')
  const [curriculumOnly, setCurriculumOnly] = useState(false)
  const [autoRead, setAutoRead] = useState(() => {
    try {
      return localStorage.getItem('atomlab-learn-autoread') === '1'
    } catch {
      return false
    }
  })
  const [listening, setListening] = useState(false)
  const [speakingId, setSpeakingId] = useState<number | null>(null)
  const [voiceMode, setVoiceMode] = useState<SpeechOutputMode>('neural')
  const [voiceError, setVoiceError] = useState(false)
  const speechRef = useRef(new LearnSpeechController())
  const storeKey = storageKey(gradeId, chapterId, section.id)
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadStored(storeKey))
  // Смена параграфа: подгружаем его чат в том же рендере, иначе эффект сохранения
  // успевал записать сообщения прошлого параграфа под новым ключом.
  const [loadedKey, setLoadedKey] = useState(storeKey)
  if (loadedKey !== storeKey) {
    setLoadedKey(storeKey)
    setMessages(loadStored(storeKey))
  }
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preferOllama, setPreferOllama] = useState(() => {
    try {
      return localStorage.getItem('atomlab-learn-ollama') === '1'
    } catch {
      return false
    }
  })
  const [lastSource, setLastSource] = useState<AssistantSource | null>(null)
  const [scanPreview, setScanPreview] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const online = useSyncExternalStore(subscribeOnline, readOnline, readOnlineServer)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const homeworkFileRef = useRef<HTMLInputElement>(null)
  const settingsId = useId()

  useEffect(() => {
    preloadSpeechVoices()
    return () => {
      speechRef.current.stop()
      speechRef.current.stopListening()
    }
  }, [])

  useEffect(() => {
    if (messages.length > 0) saveStored(storeKey, messages)
  }, [messages, storeKey])

  // Держим ленту у последнего сообщения: новая реплика, индикатор «думаю», ошибка.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const el = listRef.current
      if (!el) return
      el.scrollTo({ top: el.scrollHeight, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
    })
    return () => cancelAnimationFrame(id)
  }, [messages.length, loading, error, storeKey])

  const localCtx: LearnLocalAssistantContext = useMemo(
    () => ({
      locale,
      gradeId,
      chapterId,
      sectionId: section.id,
      sectionTitle: t(section.titleKey),
      slideTitle,
      slideBody,
      mode,
      kpNumber: section.kpNumber,
      curriculumOnly,
    }),
    [
      locale,
      gradeId,
      chapterId,
      section,
      slideTitle,
      slideBody,
      mode,
      curriculumOnly,
      t,
    ],
  )

  const mapRoutedSource = (s: TeacherReplySource): AssistantSource =>
    s === 'ollama' ? 'ollama' : s === 'puter' ? 'puter' : 'local'

  const speechLocale = locale === 'en' ? 'en' : locale === 'uz' ? 'uz' : 'ru'

  const speakMessage = useCallback(
    async (text: string, messageId: number) => {
      if (!isSpeechOutputSupported()) return
      setVoiceError(false)
      setSpeakingId(messageId)
      try {
        const ok = await speechRef.current.speak(
          text,
          speechLocale,
          () => {
            setSpeakingId(null)
          },
          (mode) => {
            setVoiceMode(mode)
          },
          (code) => {
            if (code === 'unavailable') {
              setVoiceError(true)
            }
          },
        )
        if (!ok && !speechRef.current.isSpeaking()) {
          setSpeakingId(null)
        }
      } catch {
        setSpeakingId(null)
        setVoiceError(true)
      }
    },
    [speechLocale],
  )

  const stopSpeaking = useCallback(() => {
    speechRef.current.stop()
    setSpeakingId(null)
  }, [])

  const toggleMic = useCallback(() => {
    if (!isSpeechRecognitionSupported()) return
    if (listening) {
      speechRef.current.stopListening()
      setListening(false)
      return
    }
    const started = speechRef.current.startListening(
      speechLocale,
      (transcript) => {
        setListening(false)
        setInput(transcript)
      },
      () => setListening(false),
    )
    setListening(started)
  }, [listening, speechLocale])

  useEffect(() => {
    void checkTeacherServiceHealth()
  }, [])

  const replyFromApi = useCallback(
    async (nextMessages: ChatMessage[]): Promise<{ text: string; source: AssistantSource }> => {
      const payload = {
        messages: nextMessages.map((m) => ({ role: m.role, content: m.text })),
        context: localCtx,
      }

      const teacher = await requestTeacherChat(payload.messages, payload.context)
      if (teacher?.text) {
        return { text: filterAssistantReply(teacher.text, locale), source: 'ollama' }
      }

      const apiUrl = import.meta.env.VITE_LEARN_CHAT_URL
      if (apiUrl) {
        try {
          const res = await fetch(CHAT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
          const data = (await res.json()) as {
            reply?: string | null
            source?: 'openai' | 'local' | 'error'
          }
          const reply = data.reply?.trim()
          if (reply) {
            return {
              text: filterAssistantReply(reply, locale),
              source: data.source === 'openai' ? 'openai' : 'local',
            }
          }
          if (res.status === 429) {
            /* fall through to free router */
          }
        } catch {
          /* network or static host without API */
        }
      }

      const routed = await routeTeacherReply(
        nextMessages.map((m) => ({ role: m.role, content: m.text })),
        localCtx,
        { preferOllama },
      )
      return { text: filterAssistantReply(routed.text, locale), source: mapRoutedSource(routed.source) }
    },
    [localCtx, preferOllama, locale],
  )

  const sendText = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return
      warmupPuterFromUserGesture()
      setError(null)
      const userMsg: ChatMessage = { role: 'user', text: text.trim(), at: Date.now() }
      const nextMessages = [...messages, userMsg]
      setMessages(nextMessages)
      setLoading(true)
      try {
        const { text: reply, source } = await replyFromApi(nextMessages)
        setLastSource(source)
        const assistantMsg: ChatMessage = {
          role: 'assistant',
          text: reply,
          at: Date.now(),
          source,
        }
        setMessages((m) => [...m, assistantMsg])
        if (autoRead && isSpeechOutputSupported()) {
          void speakMessage(reply, assistantMsg.at)
        }
      } catch (err) {
        const localText = generateLocalLearnReply(
          nextMessages.map((x) => ({ role: x.role, content: x.text })),
          localCtx,
        )
        setLastSource('local')
        setMessages((m) => [
          ...m,
          { role: 'assistant', text: localText, at: Date.now(), source: 'local' },
        ])
        if (err instanceof Error && err.message === 'rate_limit') {
          setError(t('learn.assistant.rateLimit'))
        }
      } finally {
        setLoading(false)
      }
    },
    [loading, messages, replyFromApi, localCtx, t, autoRead, speakMessage],
  )

  const send = useCallback(() => {
    const text = input.trim()
    // Поле ввода больше не блокируется во время ответа — не теряем текст, пока ИИ думает.
    if (!text || loading) return
    // Прогреваем бесплатный облачный мозг в рамках жеста клика (без блокировки popup).
    warmupPuterFromUserGesture()
    setInput('')
    void sendText(text)
    // Возвращаем фокус в поле (кнопка «Отправить» становится disabled и фокус терялся).
    // На сенсорных экранах не поднимаем клавиатуру, если ученик нажимал кнопку.
    if (!prefersCoarsePointer() || document.activeElement === inputRef.current) {
      inputRef.current?.focus()
    }
  }, [input, loading, sendText])

  const clearChat = useCallback(() => {
    setMessages([])
    setLastSource(null)
    setError(null)
    try {
      sessionStorage.removeItem(storeKey)
    } catch {
      /* ignore */
    }
  }, [storeKey])

  const runHomeworkReview = useCallback(
    async (rawText: string, fromScan: boolean, imageDataUrl?: string | null) => {
      const text = rawText.trim()
      if (text.length < 12) {
        setError(t('learn.assistant.homeworkNeedText'))
        return
      }
      warmupPuterFromUserGesture()
      setError(null)
      setLoading(true)
      const userMsg: ChatMessage = {
        role: 'user',
        text: homeworkUserLabel(locale, text, fromScan),
        at: Date.now(),
      }
      setMessages((m) => [...m, userMsg])
      try {
        const report = await reviewHomework({
          text,
          imageDataUrl: fromScan ? (imageDataUrl ?? scanPreview) : null,
          source: fromScan ? 'upload' : 'paste',
          topicHint: slideTitle || section.titleKey,
          gradeId,
          locale,
        })
        saveHomeworkReviewToHistory(report)
        const reply = formatHomeworkReportForChat(report, locale)
        const assistantMsg: ChatMessage = {
          role: 'assistant',
          text: reply,
          at: Date.now(),
          source: 'local',
        }
        setLastSource('local')
        setMessages((m) => [...m, assistantMsg])
        if (autoRead && isSpeechOutputSupported()) {
          void speakMessage(
            locale === 'en'
              ? `Chemistry score ${report.chemistry.score}. Authorship ${report.authorship.authorship}.`
              : locale === 'uz'
                ? `Kimyo ${report.chemistry.score}. Mualliflik ${report.authorship.authorship}.`
                : `Химия ${report.chemistry.score}. Авторство ${report.authorship.authorship}. ${report.studentFeedback}`,
            assistantMsg.at,
          )
        }
      } catch {
        setError(t('learn.assistant.homeworkNeedText'))
      } finally {
        setLoading(false)
      }
    },
    [autoRead, gradeId, locale, scanPreview, section.titleKey, slideTitle, speakMessage, t],
  )

  const onHomeworkFile = useCallback(
    async (file: File | null) => {
      if (!file) return
      setLoading(true)
      setError(t('learn.assistant.homeworkReading'))
      try {
        const scan = await loadHomeworkImageFile(file, { locale })
        setScanPreview(scan.dataUrl)
        const text = (scan.ocrText || input).trim()
        if (scan.ocrText) setInput(scan.ocrText)
        if (text.length >= 12) {
          setError(null)
          await runHomeworkReview(text, true, scan.dataUrl)
        } else {
          setError(t('learn.assistant.homeworkOcrFailed'))
          setLoading(false)
        }
      } catch {
        setScanPreview(null)
        setError(t('learn.assistant.homeworkBadImage'))
        setLoading(false)
      }
    },
    [input, locale, runHomeworkReview, t],
  )

  const sourceLabel =
    lastSource === 'openai'
      ? t('learn.assistant.sourceOpenai')
      : lastSource === 'ollama'
        ? t('learn.assistant.sourceOllama')
        : lastSource === 'puter'
          ? t('learn.assistant.sourcePuter')
          : lastSource === 'local'
            ? t('learn.assistant.sourceLocal')
            : null

  const statusText = loading
    ? t('learn.assistant.thinking')
    : listening
      ? t('learn.teacherExam.liveStatusListening')
      : speakingId !== null
        ? t('learn.teacherExam.liveStatusSpeaking')
        : t('learn.teacherExam.liveStatusIdle')

  const statusState = loading
    ? 'busy'
    : listening
      ? 'listening'
      : speakingId !== null
        ? 'speaking'
        : online
          ? 'online'
          : 'offline'

  const settingLabels = [
    t('learn.assistant.curriculumOnly'),
    t('learn.assistant.autoRead'),
    t('learn.assistant.ollamaToggle'),
  ]
  const settingsOnCount = [curriculumOnly, autoRead, preferOllama].filter(Boolean).length
  const isInfoNotice = error === t('learn.assistant.homeworkReading')
  const canSpeak = isSpeechOutputSupported()
  const canListen = isSpeechRecognitionSupported()
  const hasMessages = messages.length > 0

  const quickChips = (variant: 'grid' | 'strip') => (
    <div
      className={variant === 'grid' ? styles.suggestGrid : styles.quickStrip}
      role="group"
      aria-label={t('learn.assistant.placeholder')}
    >
      {QUICK_KEYS.map((key, i) => {
        const meta = QUICK_META[i]
        const Icon = meta.Icon
        return (
          <button
            key={key}
            type="button"
            className={variant === 'grid' ? styles.suggest : styles.quickChip}
            data-tone={meta.tone}
            disabled={loading}
            onClick={() => void sendText(t(key))}
          >
            <span className={styles.suggestIcon} aria-hidden>
              <Icon />
            </span>
            <span className={styles.suggestText}>{t(key)}</span>
          </button>
        )
      })}
    </div>
  )

  return (
    <aside className={styles.panel} aria-label={t('learn.assistant.title')}>
      <header className={styles.head}>
        <div className={styles.brand}>
          <span className={styles.avatar} aria-hidden>
            <IconAtom className={styles.avatarIcon} />
            <span className={styles.statusDot} data-state={statusState} />
          </span>
          <div className={styles.brandText}>
            <h3 className={styles.title}>{t('learn.assistant.title')}</h3>
            <p className={styles.statusLine}>
              <span className={styles.statusText}>{statusText}</span>
              {sourceLabel ? (
                <span
                  className={styles.sourceChip}
                  data-source={lastSource === 'openai' ? 'cloud' : 'local'}
                >
                  {sourceLabel}
                </span>
              ) : null}
            </p>
          </div>
        </div>
        <div className={styles.headTools}>
          <button
            type="button"
            className={styles.iconBtn}
            data-active={settingsOpen ? '1' : undefined}
            aria-expanded={settingsOpen}
            aria-controls={settingsId}
            aria-label={settingLabels.join(', ')}
            title={settingLabels.join(' · ')}
            onClick={() => setSettingsOpen((v) => !v)}
          >
            <IconSliders />
            {settingsOnCount > 0 ? (
              <span className={styles.iconBadge} aria-hidden>
                {settingsOnCount}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={clearChat}
            aria-label={t('learn.assistant.clear')}
            title={t('learn.assistant.clear')}
          >
            <IconTrash />
          </button>
        </div>
      </header>

      <div className={styles.controls}>
        <div className={styles.segmented} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'teacher'}
            className={mode === 'teacher' ? styles.segBtnOn : styles.segBtn}
            onClick={() => setMode('teacher')}
          >
            {t('learn.assistant.modeTeacher')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'helper'}
            className={mode === 'helper' ? styles.segBtnOn : styles.segBtn}
            onClick={() => setMode('helper')}
          >
            {t('learn.assistant.modeHelper')}
          </button>
        </div>
        {grade && chapter ? (
          <LiveDialogButton
            grade={grade}
            chapter={chapter}
            section={section}
            rosterSectionId={rosterSectionId}
            className={styles.liveBtn}
            icon={<IconBroadcast className={styles.liveIcon} />}
          />
        ) : null}
      </div>

      {settingsOpen ? (
        <div id={settingsId} className={styles.settings}>
          <label className={styles.switchRow}>
            <span className={styles.switchText}>{t('learn.assistant.curriculumOnly')}</span>
            <input
              type="checkbox"
              role="switch"
              className={styles.switchInput}
              checked={curriculumOnly}
              onChange={(e) => setCurriculumOnly(e.target.checked)}
            />
            <span className={styles.switchTrack} aria-hidden />
          </label>
          <label className={styles.switchRow}>
            <span className={styles.switchText}>{t('learn.assistant.autoRead')}</span>
            <input
              type="checkbox"
              role="switch"
              className={styles.switchInput}
              checked={autoRead}
              onChange={(e) => {
                const on = e.target.checked
                setAutoRead(on)
                if (!on) stopSpeaking()
                try {
                  localStorage.setItem('atomlab-learn-autoread', on ? '1' : '0')
                } catch {
                  /* ignore */
                }
              }}
            />
            <span className={styles.switchTrack} aria-hidden />
          </label>
          <label className={styles.switchRow}>
            <span className={styles.switchText}>{t('learn.assistant.ollamaToggle')}</span>
            <input
              type="checkbox"
              role="switch"
              className={styles.switchInput}
              checked={preferOllama}
              onChange={(e) => {
                const on = e.target.checked
                setPreferOllama(on)
                try {
                  localStorage.setItem('atomlab-learn-ollama', on ? '1' : '0')
                } catch {
                  /* ignore */
                }
              }}
            />
            <span className={styles.switchTrack} aria-hidden />
          </label>
        </div>
      ) : null}

      <div className={styles.body} ref={listRef} data-empty={hasMessages ? undefined : '1'}>
        {!hasMessages ? (
          <div className={styles.welcome}>
            <div className={styles.welcomeArt} aria-hidden>
              <span className={styles.welcomeOrbit} />
              <span className={styles.welcomeCore}>
                <IconAtom />
              </span>
            </div>
            <p className={styles.welcomeText}>{t('learn.assistant.welcome')}</p>
            {quickChips('grid')}
          </div>
        ) : null}

        <div className={styles.log} role="log" aria-live="polite" aria-relevant="additions">
          {messages.map((m, i) =>
            m.role === 'user' ? (
              <div key={`${m.at}-${i}`} className={styles.rowUser}>
                <div className={styles.bubbleUser}>
                  <span className={styles.srOnly}>{t('learn.assistant.you')}: </span>
                  <p className={styles.userText}>{m.text}</p>
                </div>
              </div>
            ) : (
              <div key={`${m.at}-${i}`} className={styles.rowBot}>
                <span className={styles.botAvatar} aria-hidden>
                  <IconAtom />
                </span>
                <div className={styles.bubbleBot}>
                  <span className={styles.srOnly}>{t('learn.assistant.ai')}: </span>
                  <LearnAssistantMarkdown text={m.text} className={styles.botMd} />
                  {canSpeak ? (
                    <div className={styles.bubbleActions}>
                      <button
                        type="button"
                        className={styles.voiceBtn}
                        data-active={speakingId === m.at ? '1' : undefined}
                        onClick={() =>
                          speakingId === m.at ? stopSpeaking() : void speakMessage(m.text, m.at)
                        }
                        aria-label={
                          speakingId === m.at
                            ? t('learn.assistant.stopSpeak')
                            : t('learn.assistant.speak')
                        }
                      >
                        {speakingId === m.at ? <IconStop /> : <IconSpeaker />}
                        <span>
                          {speakingId === m.at
                            ? t('learn.assistant.stopSpeak')
                            : t('learn.assistant.speak')}
                        </span>
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ),
          )}
          {loading ? (
            <div className={styles.rowBot}>
              <span className={styles.botAvatar} aria-hidden>
                <IconAtom />
              </span>
              <div className={styles.typing}>
                <span className={styles.typingDots} aria-hidden>
                  <i />
                  <i />
                  <i />
                </span>
                <span className={styles.typingText}>{t('learn.assistant.thinking')}</span>
              </div>
            </div>
          ) : null}
        </div>

        {error ? (
          <div
            className={isInfoNotice ? styles.notice : styles.alert}
            role={isInfoNotice ? 'status' : 'alert'}
          >
            {isInfoNotice ? <IconInfo className={styles.noticeIcon} /> : <IconAlert className={styles.noticeIcon} />}
            <span>{error}</span>
          </div>
        ) : null}
      </div>

      <div className={styles.footer}>
        {hasMessages ? quickChips('strip') : null}

        <div className={styles.composer}>
          {scanPreview ? (
            <div className={styles.scanPreview}>
              <img src={scanPreview} alt="" />
              <button
                type="button"
                className={styles.scanClear}
                onClick={() => setScanPreview(null)}
                aria-label={t('learn.assistant.clear')}
              >
                <IconClose />
              </button>
            </div>
          ) : null}
          <input
            ref={homeworkFileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/bmp,.jpg,.jpeg,.png,.webp"
            className={styles.fileHidden}
            tabIndex={-1}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null
              void onHomeworkFile(f)
              e.target.value = ''
            }}
          />
          <div className={styles.field}>
            {canListen ? (
              <button
                type="button"
                className={listening ? styles.fieldBtnRec : styles.fieldBtn}
                onClick={toggleMic}
                disabled={loading}
                aria-pressed={listening}
                aria-label={listening ? t('learn.assistant.micStop') : t('learn.assistant.micStart')}
                title={listening ? t('learn.assistant.micStop') : t('learn.assistant.micStart')}
              >
                {listening ? <IconStop /> : <IconMic />}
              </button>
            ) : null}
            <button
              type="button"
              className={styles.fieldBtn}
              disabled={loading}
              onClick={() => homeworkFileRef.current?.click()}
              title={t('learn.assistant.homeworkScan')}
              aria-label={t('learn.assistant.homeworkScan')}
            >
              <IconCamera />
            </button>
            <input
              ref={inputRef}
              type="text"
              className={styles.input}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  send()
                }
              }}
              placeholder={t('learn.assistant.placeholder')}
              aria-label={t('learn.assistant.placeholder')}
              maxLength={2000}
            />
          </div>
          <div className={styles.composerActions}>
            <button
              type="button"
              className={styles.secondaryBtn}
              disabled={loading || !input.trim()}
              onClick={() => void runHomeworkReview(input, false)}
              title={t('learn.assistant.homework')}
            >
              <IconCheckCircle className={styles.btnIcon} />
              <span>{t('learn.assistant.homework')}</span>
            </button>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => send()}
              disabled={loading || !input.trim()}
            >
              <span>{t('learn.assistant.send')}</span>
              <IconSend className={styles.btnIcon} />
            </button>
          </div>
        </div>

        <p className={styles.disclaimer}>
          <IconInfo className={styles.disclaimerIcon} />
          <span>
            {t('learn.assistant.disclaimer')}
            {voiceError ? (
              <span className={styles.disclaimerError}> · {t('learn.assistant.voiceUnavailable')}</span>
            ) : speakingId !== null ? (
              <span className={styles.voiceHint}>
                {' '}
                ·{' '}
                {voiceMode === 'neural'
                  ? t('learn.assistant.voiceNeural')
                  : t('learn.assistant.voiceBrowser')}
              </span>
            ) : null}
          </span>
        </p>
      </div>
    </aside>
  )
}
