import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import styles from '../../pages/LearnPage.module.css'

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
  const listRef = useRef<HTMLDivElement>(null)
  const homeworkFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setMessages(loadStored(storeKey))
  }, [storeKey])

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
        requestAnimationFrame(() => {
          listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
        })
      }
    },
    [loading, messages, replyFromApi, localCtx, t, autoRead, speakMessage],
  )

  const send = useCallback(() => {
    const text = input.trim()
    if (!text) return
    // Прогреваем бесплатный облачный мозг в рамках жеста клика (без блокировки popup).
    warmupPuterFromUserGesture()
    setInput('')
    void sendText(text)
  }, [input, sendText])

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
    async (rawText: string, fromScan: boolean) => {
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
        requestAnimationFrame(() => {
          listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
        })
      }
    },
    [autoRead, gradeId, locale, section.titleKey, slideTitle, speakMessage, t],
  )

  const onHomeworkFile = useCallback(
    async (file: File | null) => {
      if (!file) return
      setLoading(true)
      setError(null)
      try {
        const scan = await loadHomeworkImageFile(file)
        const text = (scan.ocrText || input).trim()
        if (scan.ocrText) setInput(scan.ocrText)
        if (text.length >= 12) {
          await runHomeworkReview(text, true)
        } else {
          setError(t('learn.assistant.homeworkNeedText'))
          setLoading(false)
        }
      } catch {
        setError(t('learn.assistant.homeworkNeedText'))
        setLoading(false)
      }
    },
    [input, runHomeworkReview, t],
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

  return (
    <aside className={styles.learnAssistant} aria-label={t('learn.assistant.title')}>
      <div className={styles.learnAssistantHead}>
        <div className={styles.learnAssistantBrand}>
          <span className={styles.learnAssistantAvatar} aria-hidden>
            ✦
          </span>
          <div>
            <h3 className={styles.learnAssistantH}>{t('learn.assistant.title')}</h3>
            {sourceLabel ? (
              <span
                className={
                  lastSource === 'openai'
                    ? styles.learnAssistantSourceOpenai
                    : styles.learnAssistantSourceLocal
                }
              >
                {sourceLabel}
              </span>
            ) : null}
          </div>
        </div>
        <div className={styles.learnAssistantHeadActions}>
          {grade && chapter ? (
            <LiveDialogButton
              grade={grade}
              chapter={chapter}
              section={section}
              rosterSectionId={rosterSectionId}
              className={styles.learnAssistantLive}
            />
          ) : null}
          <button type="button" className={styles.learnAssistantClear} onClick={clearChat}>
            {t('learn.assistant.clear')}
          </button>
          <div className={styles.learnAssistantModes} role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'teacher'}
              className={mode === 'teacher' ? styles.learnAssistantModeOn : styles.learnAssistantMode}
              onClick={() => setMode('teacher')}
            >
              {t('learn.assistant.modeTeacher')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'helper'}
              className={mode === 'helper' ? styles.learnAssistantModeOn : styles.learnAssistantMode}
              onClick={() => setMode('helper')}
            >
              {t('learn.assistant.modeHelper')}
            </button>
          </div>
          <label className={styles.learnAssistantCurriculumToggle}>
            <input
              type="checkbox"
              checked={curriculumOnly}
              onChange={(e) => setCurriculumOnly(e.target.checked)}
            />
            {t('learn.assistant.curriculumOnly')}
          </label>
          <label className={styles.learnAssistantCurriculumToggle}>
            <input
              type="checkbox"
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
            {t('learn.assistant.autoRead')}
          </label>
          <label className={styles.learnAssistantCurriculumToggle}>
            <input
              type="checkbox"
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
            {t('learn.assistant.ollamaToggle')}
          </label>
        </div>
      </div>

      <div className={styles.learnAssistantQuick} role="group" aria-label={t('learn.assistant.placeholder')}>
        {QUICK_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            className={styles.learnAssistantChip}
            disabled={loading}
            onClick={() => void sendText(t(key))}
          >
            {t(key)}
          </button>
        ))}
      </div>

      <div className={styles.learnAssistantMessages} ref={listRef}>
        {messages.length === 0 ? (
          <p className={styles.learnAssistantWelcome}>{t('learn.assistant.welcome')}</p>
        ) : (
          messages.map((m) => (
            <div
              key={m.at}
              className={m.role === 'user' ? styles.learnAssistantBubbleUser : styles.learnAssistantBubbleBot}
            >
              <span className={styles.learnAssistantBubbleRole}>
                {m.role === 'user' ? t('learn.assistant.you') : t('learn.assistant.ai')}
              </span>
              {m.role === 'assistant' ? (
                <>
                  <LearnAssistantMarkdown text={m.text} />
                  {isSpeechOutputSupported() ? (
                    <div className={styles.learnAssistantBubbleActions}>
                      <button
                        type="button"
                        className={styles.learnAssistantVoiceBtn}
                        onClick={() =>
                          speakingId === m.at ? stopSpeaking() : void speakMessage(m.text, m.at)
                        }
                        aria-label={
                          speakingId === m.at
                            ? t('learn.assistant.stopSpeak')
                            : t('learn.assistant.speak')
                        }
                      >
                        {speakingId === m.at
                          ? t('learn.assistant.stopSpeak')
                          : t('learn.assistant.speak')}
                      </button>
                    </div>
                  ) : null}
                </>
              ) : (
                <p>{m.text}</p>
              )}
            </div>
          ))
        )}
        {loading ? (
          <p className={styles.learnAssistantThinking}>
            {t('learn.assistant.thinking')}
          </p>
        ) : null}
        {error ? <p className={styles.learnAssistantError}>{error}</p> : null}
      </div>

      <p className={styles.learnAssistantDisclaimer}>
        {t('learn.assistant.disclaimer')}
        {voiceError ? (
          <span className={styles.learnAssistantError}> · {t('learn.assistant.voiceUnavailable')}</span>
        ) : speakingId !== null ? (
          <span className={styles.learnAssistantVoiceHint}>
            {' '}
            ·{' '}
            {voiceMode === 'neural'
              ? t('learn.assistant.voiceNeural')
              : t('learn.assistant.voiceBrowser')}
          </span>
        ) : null}
      </p>

      <div className={styles.learnAssistantInputRow}>
        {isSpeechRecognitionSupported() ? (
          <button
            type="button"
            className={
              listening ? styles.learnAssistantMicOn : styles.learnAssistantMic
            }
            onClick={toggleMic}
            disabled={loading}
            aria-label={
              listening ? t('learn.assistant.micStop') : t('learn.assistant.micStart')
            }
            title={
              listening ? t('learn.assistant.micStop') : t('learn.assistant.micStart')
            }
          >
            {listening ? '■' : '🎤'}
          </button>
        ) : null}
        <input
          ref={homeworkFileRef}
          type="file"
          accept="image/*"
          className={styles.homeworkFileHidden}
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null
            void onHomeworkFile(f)
            e.target.value = ''
          }}
        />
        <button
          type="button"
          className={styles.learnAssistantMic}
          disabled={loading}
          onClick={() => homeworkFileRef.current?.click()}
          title={t('learn.assistant.homeworkScan')}
          aria-label={t('learn.assistant.homeworkScan')}
        >
          📷
        </button>
        <input
          type="text"
          className={styles.learnAssistantInput}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void send()}
          placeholder={t('learn.assistant.placeholder')}
          disabled={loading}
          maxLength={2000}
        />
        <button
          type="button"
          className={styles.learnAssistantHomeworkBtn}
          disabled={loading || !input.trim()}
          onClick={() => void runHomeworkReview(input, false)}
          title={t('learn.assistant.homework')}
        >
          {loading ? '…' : t('learn.assistant.homework')}
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary} ${styles.learnAssistantSend}`}
          onClick={() => void send()}
          disabled={loading || !input.trim()}
        >
          {t('learn.assistant.send')}
        </button>
      </div>
    </aside>
  )
}
