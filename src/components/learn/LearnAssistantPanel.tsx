import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type SetStateAction,
  type SVGProps,
} from 'react'
import { useT, type MessageKey } from '../../i18n/useT'
import type { LearnLocalAssistantContext } from '../../learn/learnLocalAssistant'
import { composeLocalTeacherReply, routeTeacherReply, type TeacherReplySource } from '../../learn/learnTeacherRouter'
import {
  isSpeechOutputSupported,
  isSpeechRecognitionSupported,
  LearnSpeechController,
  preloadSpeechVoices,
  type SpeechOutputMode,
} from '../../learn/learnSpeech'
import type { LearnChapter, LearnGrade, LearnSection } from '../../types/learn'
import { checkTeacherServiceHealth, requestTeacherChat } from '../../learn/teacherServiceClient'
import { preloadTeacherKnowledge } from '../../learn/teacherKnowledge'
import { filterAssistantReply } from '../../learn/learnAssistantGuard'
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
import { extractCitations } from './teacher/citations'
import { BrainChip, SmartAiCta, SourceChips, type TeacherBrain } from './teacher/TeacherChips'
import { IconCheck, IconChevronDown, IconCopy, IconRefresh, IconWifiOff } from './teacher/TeacherIcons'
import { StreamingReply } from './teacher/StreamingReply'
import { useSmartAi } from './teacher/smartAiStore'
import styles from './LearnAssistantPanel.module.css'

/**
 * Шлюз чата (сервер с LLM) — только если явно настроен. Пустая строка = не настроен
 * (раньше `??` пропускал ''). По умолчанию учитель бесплатный: база знаний + «умный ИИ» по согласию.
 */
const CHAT_URL = (import.meta.env.VITE_LEARN_CHAT_URL as string | undefined)?.trim() || ''
const CHAT_TIMEOUT_MS = 15_000

type ReplyResult = { text: string; source: AssistantSource; notice?: 'rate_limit' }

type AssistantSource = 'openai' | 'local' | 'ollama' | 'puter'

type ChatMessage = {
  role: 'user' | 'assistant'
  text: string
  at: number
  source?: AssistantSource
  /** Ответ на проверку ДЗ — «ответить заново» для него не показываем. */
  kind?: 'homework'
  /** Печать ответа остановлена учеником. */
  stopped?: boolean
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

function mapRoutedSource(s: TeacherReplySource): AssistantSource {
  return s === 'ollama' ? 'ollama' : s === 'puter' ? 'puter' : 'local'
}

function brainOf(source: AssistantSource | undefined): TeacherBrain {
  if (source === 'puter') return 'smart'
  if (source === 'openai') return 'server'
  if (source === 'ollama') return 'ollama'
  return 'local'
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const area = document.createElement('textarea')
      area.value = text
      area.setAttribute('readonly', '')
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      const ok = document.execCommand('copy')
      area.remove()
      return ok
    } catch {
      return false
    }
  }
}

type PendingRequest = { id: number; ctrl: AbortController }

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
  const smartAi = useSmartAi()
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
  const speechRef = useRef<LearnSpeechController | null>(null)
  const storeKey = storageKey(gradeId, chapterId, section.id)
  // Лента хранится вместе с ключом параграфа: асинхронный ответ дописывается только в чат того
  // параграфа, где задан вопрос (иначе ответ, пришедший в одном рендере со сменой параграфа,
  // попадал в чат нового параграфа и сохранялся под его ключом).
  const [chat, setChat] = useState<{ key: string; list: ChatMessage[] }>(() => ({
    key: storeKey,
    list: loadStored(storeKey),
  }))
  const messages = chat.list
  const setMessages = useCallback((next: SetStateAction<ChatMessage[]>) => {
    setChat((c) => ({ key: c.key, list: typeof next === 'function' ? next(c.list) : next }))
  }, [])
  const setMessagesFor = useCallback((key: string, update: (list: ChatMessage[]) => ChatMessage[]) => {
    setChat((c) => (c.key === key ? { key, list: update(c.list) } : c))
  }, [])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [streamingAt, setStreamingAt] = useState<number | null>(null)
  const [stopToken, setStopToken] = useState(0)
  const [copiedAt, setCopiedAt] = useState<number | null>(null)
  /** Лента прокручена к последнему сообщению (иначе показываем кнопку «вниз»). */
  const [atBottom, setAtBottom] = useState(true)
  // Смена параграфа: подгружаем его чат в том же рендере, иначе эффект сохранения
  // успевал записать сообщения прошлого параграфа под новым ключом.
  if (chat.key !== storeKey) {
    setChat({ key: storeKey, list: loadStored(storeKey) })
    setLoading(false)
    setStreamingAt(null)
    setError(null)
    setAtBottom(true)
  }
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
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const homeworkFileRef = useRef<HTMLInputElement>(null)
  const pendingRef = useRef<PendingRequest | null>(null)
  const requestSeqRef = useRef(0)
  const settingsId = useId()
  const inputHintId = useId()

  const speech = useCallback(() => {
    if (!speechRef.current) speechRef.current = new LearnSpeechController()
    return speechRef.current
  }, [])

  useEffect(() => {
    preloadSpeechVoices()
    return () => {
      speechRef.current?.stop()
      speechRef.current?.stopListening()
    }
  }, [])

  // База знаний класса (~0,7 МБ gzip, а следом фоном остальные классы) грузится лениво: прогреваем
  // по первому намерению ученика (курсор/касание/фокус на панели), а не по таймеру — просто открытый
  // урок не должен скачивать базу. Первый вопрос всё равно дождётся загрузки в роутере.
  const warmedGradeRef = useRef<string | null>(null)
  const warmKnowledge = useCallback(() => {
    if (warmedGradeRef.current === gradeId) return
    warmedGradeRef.current = gradeId
    preloadTeacherKnowledge({ gradeId })
  }, [gradeId])

  useEffect(() => {
    if (chat.list.length > 0) saveStored(chat.key, chat.list)
  }, [chat])

  // Смена параграфа или размонтирование: ответ на старый вопрос не попадёт в новый чат.
  // Layout-эффект отменяет запрос синхронно в коммите нового параграфа (обычный useEffect на
  // тяжёлом уроке срабатывал заметно позже). Сам ответ дополнительно привязан к ключу чата.
  useLayoutEffect(
    () => () => {
      pendingRef.current?.ctrl.abort()
      pendingRef.current = null
      // Озвучка и диктовка прошлого параграфа тоже останавливаются.
      speechRef.current?.stop()
      speechRef.current?.stopListening()
      setSpeakingId(null)
      setListening(false)
    },
    [storeKey],
  )

  // Держим ленту у последнего сообщения: новая реплика, индикатор «думаю», ошибка.
  useEffect(() => {
    // Пустой чат не прокручиваем — приветствие должно быть видно сверху.
    if (messages.length === 0 && !loading && !error) return
    const id = requestAnimationFrame(() => {
      const el = listRef.current
      if (!el) return
      el.scrollTo({ top: el.scrollHeight, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
    })
    return () => cancelAnimationFrame(id)
  }, [messages.length, loading, error, storeKey])

  // Во время «печати» ответа прокрутка следует за текстом, если ученик внизу ленты.
  useEffect(() => {
    if (streamingAt === null) return
    const el = listRef.current
    if (!el) return
    let raf = 0
    const follow = () => {
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 140) el.scrollTop = el.scrollHeight
      raf = requestAnimationFrame(follow)
    }
    raf = requestAnimationFrame(follow)
    return () => cancelAnimationFrame(raf)
  }, [streamingAt])

  const onBodyScroll = useCallback(() => {
    const el = listRef.current
    if (!el) return
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48
    setAtBottom((cur) => (cur === bottom ? cur : bottom))
  }, [])

  const scrollToLatest = useCallback(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }, [])

  // Поле ввода растёт по содержимому (до max-height из CSS, дальше — прокрутка).
  useLayoutEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [input])

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
    [locale, gradeId, chapterId, section, slideTitle, slideBody, mode, curriculumOnly, t],
  )

  const speechLocale = locale === 'en' ? 'en' : locale === 'uz' ? 'uz' : 'ru'

  const speakMessage = useCallback(
    async (text: string, messageId: number) => {
      if (!isSpeechOutputSupported()) return
      setVoiceError(false)
      setSpeakingId(messageId)
      try {
        const ok = await speech().speak(
          text,
          speechLocale,
          () => {
            setSpeakingId(null)
          },
          (m) => {
            setVoiceMode(m)
          },
          (code) => {
            if (code === 'unavailable') {
              setVoiceError(true)
            }
          },
        )
        if (!ok && !speech().isSpeaking()) {
          setSpeakingId(null)
        }
      } catch {
        setSpeakingId(null)
        setVoiceError(true)
      }
    },
    [speechLocale, speech],
  )

  const stopSpeaking = useCallback(() => {
    speechRef.current?.stop()
    setSpeakingId(null)
  }, [])

  const toggleMic = useCallback(() => {
    if (!isSpeechRecognitionSupported()) return
    if (listening) {
      speech().stopListening()
      setListening(false)
      return
    }
    const started = speech().startListening(
      speechLocale,
      (transcript) => {
        setListening(false)
        setInput((prev) => (prev.trim() ? `${prev.trimEnd()} ${transcript}` : transcript))
        inputRef.current?.focus()
      },
      () => setListening(false),
    )
    setListening(started)
  }, [listening, speechLocale, speech])

  useEffect(() => {
    void checkTeacherServiceHealth()
  }, [])

  const replyFromApi = useCallback(
    async (
      nextMessages: ChatMessage[],
      signal: AbortSignal,
      onDelta?: (fullText: string) => void,
    ): Promise<ReplyResult> => {
      const payload = {
        messages: nextMessages.map((m) => ({ role: m.role, content: m.text })),
        context: localCtx,
      }
      let notice: ReplyResult['notice']

      // 1) Локальный teacher_service (dev / свой ПК) — с таймаутом и отменой.
      const teacher = await requestTeacherChat(payload.messages, payload.context, { signal })
      if (teacher?.text) {
        return { text: filterAssistantReply(teacher.text, locale), source: 'ollama' }
      }

      // 2) Шлюз чата — только если явно настроен.
      if (CHAT_URL && !signal.aborted) {
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), CHAT_TIMEOUT_MS)
        const onAbort = () => ctrl.abort()
        signal.addEventListener('abort', onAbort, { once: true })
        try {
          const res = await fetch(CHAT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: ctrl.signal,
          })
          const contentType = res.headers.get('content-type') ?? ''
          const data = contentType.includes('json')
            ? ((await res.json()) as { reply?: string | null; source?: 'openai' | 'local' | 'error'; error?: string })
            : {}
          if (res.status === 429 || data.error === 'rate_limit') {
            notice = 'rate_limit'
          } else {
            const reply = data.reply?.trim()
            if (res.ok && reply) {
              return {
                text: filterAssistantReply(reply, locale),
                source: data.source === 'openai' ? 'openai' : 'local',
              }
            }
          }
        } catch {
          /* сеть, таймаут, отмена или статический хостинг без API — бесплатный маршрут */
        } finally {
          clearTimeout(timer)
          signal.removeEventListener('abort', onAbort)
        }
      }

      // 3) Бесплатный маршрут: база знаний → Ollama → «умный ИИ» (стриминг) → локальный ответ.
      const routed = await routeTeacherReply(
        nextMessages.map((m) => ({ role: m.role, content: m.text })),
        localCtx,
        { preferOllama, signal, onDelta },
      )
      return { text: filterAssistantReply(routed.text, locale), source: mapRoutedSource(routed.source), notice }
    },
    [localCtx, preferOllama, locale],
  )

  /** Запросить ответ на историю `history` (последнее сообщение — вопрос ученика). */
  const requestReply = useCallback(
    async (history: ChatMessage[]) => {
      pendingRef.current?.ctrl.abort()
      const request: PendingRequest = { id: ++requestSeqRef.current, ctrl: new AbortController() }
      pendingRef.current = request
      setError(null)
      setLoading(true)
      const isCurrent = () => pendingRef.current === request && !request.ctrl.signal.aborted
      const reqKey = storeKey
      // Стриминг «умного ИИ»: сообщение появляется сразу и дописывается на месте.
      let streamAt: number | null = null
      const onDelta = (fullText: string) => {
        if (!isCurrent() || !fullText.trim()) return
        if (streamAt === null) {
          const at = Date.now()
          streamAt = at
          setLoading(false)
          setMessagesFor(reqKey, (m) => [...m, { role: 'assistant', text: fullText, at, source: 'puter' }])
          setStreamingAt(at)
        } else {
          const at = streamAt
          setMessagesFor(reqKey, (m) => m.map((x) => (x.at === at ? { ...x, text: fullText } : x)))
        }
      }
      let result: ReplyResult
      try {
        result = await replyFromApi(history, request.ctrl.signal, onDelta)
      } catch {
        const local = await composeLocalTeacherReply(
          history.map((x) => ({ role: x.role, content: x.text })),
          localCtx,
          { signal: request.ctrl.signal },
        ).catch(() => null)
        result = { text: local?.text ?? '', source: 'local' }
      }
      // Остановлено, очищено или сменился параграф — ответ больше не нужен.
      if (!isCurrent()) return
      pendingRef.current = null
      setLoading(false)
      if (!result.text.trim()) return
      setLastSource(result.source)
      if (result.notice === 'rate_limit') setError(t('learn.assistant.rateLimit'))
      let at: number
      if (streamAt !== null) {
        at = streamAt
        const finalAt = at
        setMessagesFor(reqKey, (m) =>
          m.map((x) => (x.at === finalAt ? { ...x, text: result.text, source: result.source } : x)),
        )
      } else {
        const assistantMsg: ChatMessage = { role: 'assistant', text: result.text, at: Date.now(), source: result.source }
        at = assistantMsg.at
        setMessagesFor(reqKey, (m) => [...m, assistantMsg])
        setStreamingAt(assistantMsg.at)
      }
      if (autoRead && isSpeechOutputSupported()) {
        void speakMessage(extractCitations(result.text).text, at)
      }
    },
    [autoRead, localCtx, replyFromApi, setMessagesFor, speakMessage, storeKey, t],
  )

  const sendText = useCallback(
    (text: string) => {
      const clean = text.trim()
      if (!clean || loading) return
      if (smartAi.connected) warmupPuterFromUserGesture()
      const userMsg: ChatMessage = { role: 'user', text: clean, at: Date.now() }
      const history = [...messages, userMsg]
      setMessages(history)
      setStreamingAt(null)
      void requestReply(history)
    },
    [loading, messages, requestReply, setMessages, smartAi.connected],
  )

  const send = useCallback(() => {
    const text = input.trim()
    // Поле ввода не блокируется во время ответа — текст не теряется, пока ИИ думает.
    if (!text || loading) return
    setInput('')
    sendText(text)
    // На сенсорных экранах не поднимаем клавиатуру, если ученик нажимал кнопку.
    if (!prefersCoarsePointer() || document.activeElement === inputRef.current) {
      inputRef.current?.focus()
    }
  }, [input, loading, sendText])

  /** «Остановить»: отменяет ожидание ответа или замораживает печать и голос. */
  const stopGenerating = useCallback(() => {
    if (pendingRef.current) {
      pendingRef.current.ctrl.abort()
      pendingRef.current = null
      setLoading(false)
      setError(t('learn.teacherUi.stoppedNotice'))
    }
    if (streamingAt !== null) setStopToken((n) => n + 1)
    stopSpeaking()
  }, [stopSpeaking, streamingAt, t])

  /** Печать закончилась; если её остановили — оставляем только показанную часть. */
  const finishStreaming = useCallback((at: number, shownBody: string, fullBody: string) => {
    setStreamingAt((cur) => (cur === at ? null : cur))
    if (shownBody.length >= fullBody.length) return
    setMessages((list) =>
      list.map((m) => (m.at === at ? { ...m, text: `${shownBody.trimEnd()} …`, stopped: true } : m)),
    )
  }, [setMessages])

  const regenerate = useCallback(() => {
    if (loading) return
    let idx = -1
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]!.role === 'assistant') {
        idx = i
        break
      }
    }
    if (idx < 1) return
    const history = messages.slice(0, idx)
    if (history[history.length - 1]?.role !== 'user') return
    stopSpeaking()
    setStreamingAt(null)
    setMessages(history)
    void requestReply(history)
  }, [loading, messages, requestReply, setMessages, stopSpeaking])

  const copyMessage = useCallback(async (m: ChatMessage) => {
    const ok = await copyToClipboard(m.text)
    if (!ok) return
    setCopiedAt(m.at)
    window.setTimeout(() => setCopiedAt((cur) => (cur === m.at ? null : cur)), 1600)
  }, [])

  const clearChat = useCallback(() => {
    pendingRef.current?.ctrl.abort()
    pendingRef.current = null
    stopSpeaking()
    setLoading(false)
    setStreamingAt(null)
    setMessages([])
    setLastSource(null)
    setError(null)
    setAtBottom(true)
    try {
      sessionStorage.removeItem(storeKey)
    } catch {
      /* ignore */
    }
  }, [setMessages, stopSpeaking, storeKey])

  const runHomeworkReview = useCallback(
    async (rawText: string, fromScan: boolean, imageDataUrl?: string | null) => {
      const text = rawText.trim()
      if (text.length < 12) {
        setError(t('learn.assistant.homeworkNeedText'))
        return
      }
      if (smartAi.connected) warmupPuterFromUserGesture()
      // Та же отмена, что у обычного вопроса: «Остановить», очистка и смена параграфа
      // не должны дописывать отчёт в чужой чат или оставлять панель в «думаю».
      pendingRef.current?.ctrl.abort()
      const request: PendingRequest = { id: ++requestSeqRef.current, ctrl: new AbortController() }
      pendingRef.current = request
      const isCurrent = () => pendingRef.current === request && !request.ctrl.signal.aborted
      const reqKey = storeKey
      setError(null)
      setLoading(true)
      setInput('')
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
        if (!isCurrent()) return
        pendingRef.current = null
        saveHomeworkReviewToHistory(report)
        const reply = formatHomeworkReportForChat(report, locale)
        const assistantMsg: ChatMessage = {
          role: 'assistant',
          text: reply,
          at: Date.now(),
          source: 'local',
          kind: 'homework',
        }
        setLastSource('local')
        setMessagesFor(reqKey, (m) => [...m, assistantMsg])
        setStreamingAt(assistantMsg.at)
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
        if (isCurrent()) setError(t('learn.assistant.homeworkNeedText'))
      } finally {
        if (pendingRef.current === request) pendingRef.current = null
        // Остановленный/устаревший запрос уже сбросил loading сам; не трогаем новый.
        if (!request.ctrl.signal.aborted) setLoading(false)
      }
    },
    [
      autoRead,
      gradeId,
      locale,
      scanPreview,
      section.titleKey,
      setMessages,
      setMessagesFor,
      slideTitle,
      smartAi.connected,
      speakMessage,
      storeKey,
      t,
    ],
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

  // «Печать» считается только для сообщения, которое есть в ленте этого параграфа: устаревший
  // ответ другого параграфа не должен оставлять кнопку «Остановить» навсегда.
  const generating = loading || (streamingAt !== null && messages.some((m) => m.at === streamingAt))
  const headerBrain: TeacherBrain = lastSource ? brainOf(lastSource) : smartAi.connected ? 'smart' : 'local'

  const statusText = loading
    ? t('learn.assistant.thinking')
    : listening
      ? t('learn.teacherExam.liveStatusListening')
      : speakingId !== null
        ? t('learn.teacherExam.liveStatusSpeaking')
        : online
          ? t('learn.teacherExam.liveStatusIdle')
          : t('learn.teacherUi.offlineShort')

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
    t('learn.teacherUi.smartToggle'),
    t('learn.assistant.curriculumOnly'),
    t('learn.assistant.autoRead'),
    t('learn.assistant.ollamaToggle'),
  ]
  const settingsOnCount = [smartAi.connected, curriculumOnly, autoRead, preferOllama].filter(Boolean).length
  const infoNotices = new Set([
    t('learn.assistant.homeworkReading'),
    t('learn.teacherUi.stoppedNotice'),
    t('learn.assistant.rateLimit'),
  ])
  const isInfoNotice = error !== null && infoNotices.has(error)
  const canSpeak = isSpeechOutputSupported()
  const canListen = isSpeechRecognitionSupported()
  const hasMessages = messages.length > 0
  let lastAssistantIdx = -1
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]!.role === 'assistant') {
      lastAssistantIdx = i
      break
    }
  }
  const sectionTitle = t(section.titleKey)

  const quickChips = (variant: 'grid' | 'strip') => (
    <div
      className={variant === 'grid' ? styles.suggestGrid : styles.quickStrip}
      role="group"
      aria-label={t('learn.teacherUi.quickPrompts')}
      data-scroll-x=""
      onWheel={(e) => {
        // Низкая панель: подсказки в одну прокручиваемую строку — колесо мыши листает её вбок.
        const el = e.currentTarget
        if (el.scrollWidth > el.clientWidth + 1 && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
          el.scrollLeft += e.deltaY
        }
      }}
    >
      {QUICK_KEYS.map((key, i) => {
        const meta = QUICK_META[i]!
        const Icon = meta.Icon
        return (
          <button
            key={key}
            type="button"
            className={variant === 'grid' ? styles.suggest : styles.quickChip}
            data-tone={meta.tone}
            disabled={loading}
            onClick={() => sendText(t(key))}
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
    <aside
      className={styles.panel}
      aria-label={t('learn.assistant.title')}
      onPointerEnter={warmKnowledge}
      onFocus={warmKnowledge}
    >
      <header className={styles.head}>
        <span className={styles.avatar} aria-hidden>
          <IconAtom className={styles.avatarIcon} />
          <span className={styles.statusDot} data-state={statusState} />
        </span>
        <div className={styles.brandText}>
          <h3 className={styles.title}>{t('learn.assistant.title')}</h3>
          <p className={styles.statusLine} aria-live="polite">
            <span className={styles.statusText}>{statusText}</span>
            <BrainChip brain={headerBrain} compact />
          </p>
        </div>

        <div className={styles.controls}>
          <div className={styles.segmented} role="radiogroup" aria-label={t('learn.teacherUi.chatMode')}>
            <button
              type="button"
              role="radio"
              aria-checked={mode === 'teacher'}
              className={mode === 'teacher' ? styles.segBtnOn : styles.segBtn}
              onClick={() => setMode('teacher')}
            >
              {t('learn.assistant.modeTeacher')}
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={mode === 'helper'}
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

        <div className={styles.headTools}>
          <button
            type="button"
            className={styles.iconBtn}
            data-active={settingsOpen ? '1' : undefined}
            aria-expanded={settingsOpen}
            aria-controls={settingsId}
            aria-label={t('learn.teacherUi.settings')}
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
            disabled={!hasMessages && !loading}
            aria-label={t('learn.assistant.clear')}
            title={t('learn.assistant.clear')}
          >
            <IconTrash />
          </button>
        </div>
      </header>

      {settingsOpen ? (
        <div id={settingsId} className={styles.settings}>
          <label className={styles.switchRow}>
            <span className={styles.switchText}>
              {t('learn.teacherUi.smartToggle')}
              {smartAi.status === 'connecting' ? (
                <span className={styles.switchSub}>{t('learn.teacherUi.smartConnecting')}</span>
              ) : null}
            </span>
            <input
              type="checkbox"
              role="switch"
              className={styles.switchInput}
              checked={smartAi.connected || smartAi.status === 'connecting'}
              onChange={(e) => {
                if (e.target.checked) void smartAi.connect()
                else smartAi.disconnect()
              }}
            />
            <span className={styles.switchTrack} aria-hidden />
          </label>
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

      <div className={styles.bodyWrap}>
        <div
          className={styles.body}
          ref={listRef}
          onScroll={onBodyScroll}
          data-empty={hasMessages ? undefined : '1'}
        >
          {!online ? (
            <div className={styles.offline} role="status">
              <IconWifiOff className={styles.noticeIcon} />
              <span>{t('learn.teacherUi.offlineNotice')}</span>
            </div>
          ) : null}

          {!hasMessages ? (
            <div className={styles.welcome}>
              <div className={styles.welcomeArt} aria-hidden>
                <span className={styles.welcomeOrbit} />
                <span className={styles.welcomeCore}>
                  <IconAtom />
                </span>
              </div>
              <div className={styles.welcomeCopy}>
                <p className={styles.welcomeTitle}>{t('learn.teacherUi.emptyTitle', { topic: sectionTitle })}</p>
                <p className={styles.welcomeText}>{t('learn.assistant.welcome')}</p>
              </div>
              {quickChips('grid')}
              <SmartAiCta className={styles.welcomeCta} />
            </div>
          ) : null}

          <div className={styles.log} role="log" aria-live="polite" aria-relevant="additions">
            {messages.map((m, i) => {
              if (m.role === 'user') {
                return (
                  <div key={`${m.at}-${i}`} className={styles.rowUser}>
                    <div className={styles.bubbleUser}>
                      <span className={styles.srOnly}>{t('learn.assistant.you')}: </span>
                      <p className={styles.userText}>{m.text}</p>
                    </div>
                  </div>
                )
              }
              const { text: body, citations } = extractCitations(m.text)
              const isStreaming = streamingAt === m.at
              const isLast = i === lastAssistantIdx
              return (
                <div key={`${m.at}-${i}`} className={styles.rowBot}>
                  <span className={styles.botAvatar} aria-hidden>
                    <IconAtom />
                  </span>
                  <div className={styles.bubbleBot} data-streaming={isStreaming ? '1' : undefined}>
                    <span className={styles.srOnly}>{t('learn.assistant.ai')}: </span>
                    <StreamingReply
                      text={body}
                      streaming={isStreaming}
                      stopToken={isStreaming ? stopToken : 0}
                      onDone={(shown) => {
                        if (isStreaming) finishStreaming(m.at, body.slice(0, shown), body)
                      }}
                      className={styles.botMd}
                    />
                    {!isStreaming ? (
                      <div className={styles.bubbleMeta}>
                        <SourceChips citations={citations} />
                        <div className={styles.bubbleActions}>
                          <BrainChip brain={brainOf(m.source)} compact />
                          {m.stopped ? <span className={styles.stoppedTag}>{t('learn.teacherUi.stoppedTag')}</span> : null}
                          <span className={styles.actionGroup}>
                            {canSpeak ? (
                              <button
                                type="button"
                                className={styles.actionBtn}
                                data-active={speakingId === m.at ? '1' : undefined}
                                onClick={() =>
                                  speakingId === m.at ? stopSpeaking() : void speakMessage(body, m.at)
                                }
                                aria-label={
                                  speakingId === m.at ? t('learn.assistant.stopSpeak') : t('learn.assistant.speak')
                                }
                                title={speakingId === m.at ? t('learn.assistant.stopSpeak') : t('learn.assistant.speak')}
                              >
                                {speakingId === m.at ? <IconStop /> : <IconSpeaker />}
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className={styles.actionBtn}
                              data-active={copiedAt === m.at ? '1' : undefined}
                              onClick={() => void copyMessage(m)}
                              aria-label={copiedAt === m.at ? t('learn.teacherUi.copied') : t('learn.teacherUi.copy')}
                              title={copiedAt === m.at ? t('learn.teacherUi.copied') : t('learn.teacherUi.copy')}
                            >
                              {copiedAt === m.at ? <IconCheck /> : <IconCopy />}
                            </button>
                            {isLast && m.kind !== 'homework' ? (
                              <button
                                type="button"
                                className={styles.actionBtn}
                                onClick={regenerate}
                                disabled={generating}
                                aria-label={t('learn.teacherUi.regenerate')}
                                title={t('learn.teacherUi.regenerate')}
                              >
                                <IconRefresh />
                              </button>
                            ) : null}
                          </span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            })}
            {loading ? (
              <div className={styles.rowBot}>
                <span className={styles.botAvatar} aria-hidden>
                  <IconAtom />
                </span>
                <div className={styles.typing} role="status">
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
        {hasMessages && !atBottom ? (
          <button
            type="button"
            className={styles.jumpBtn}
            onClick={scrollToLatest}
            aria-label={t('learn.teacherUi.scrollLatest')}
            title={t('learn.teacherUi.scrollLatest')}
          >
            <IconChevronDown />
          </button>
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
          <div className={styles.field} data-listening={listening ? '1' : undefined}>
            <textarea
              ref={inputRef}
              rows={1}
              className={styles.input}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  send()
                }
              }}
              placeholder={listening ? t('learn.teacherExam.liveStatusListening') : t('learn.assistant.placeholder')}
              aria-label={t('learn.assistant.placeholder')}
              aria-describedby={inputHintId}
              enterKeyHint="send"
              maxLength={2000}
            />
            <div className={styles.fieldBar}>
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
              <button
                type="button"
                className={styles.hwBtn}
                disabled={loading || input.trim().length < 12}
                onClick={() => void runHomeworkReview(input, false)}
                title={t('learn.assistant.homework')}
                aria-label={t('learn.assistant.homework')}
              >
                <IconCheckCircle className={styles.btnIcon} />
                <span className={styles.hwLabel}>{t('learn.assistant.homework')}</span>
              </button>
              <span id={inputHintId} className={styles.inputHint}>
                {t('learn.teacherUi.inputHint')}
              </span>
              {generating ? (
                <button
                  type="button"
                  className={styles.stopBtn}
                  onClick={stopGenerating}
                  aria-label={t('learn.teacherUi.stop')}
                  title={t('learn.teacherUi.stop')}
                >
                  <span className={styles.stopSquare} aria-hidden />
                  <span className={styles.sendLabel}>{t('learn.teacherUi.stop')}</span>
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.sendBtn}
                  onClick={() => send()}
                  disabled={!input.trim()}
                  aria-label={t('learn.assistant.send')}
                  title={t('learn.assistant.send')}
                >
                  <span className={styles.sendLabel}>{t('learn.assistant.send')}</span>
                  <IconSend className={styles.btnIcon} />
                </button>
              )}
            </div>
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
                · {voiceMode === 'neural' ? t('learn.assistant.voiceNeural') : t('learn.assistant.voiceBrowser')}
              </span>
            ) : null}
          </span>
        </p>
      </div>
    </aside>
  )
}
