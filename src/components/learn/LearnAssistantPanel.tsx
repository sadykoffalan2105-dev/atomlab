import { useCallback, useRef, useState } from 'react'
import { useT, type MessageKey } from '../../i18n/useT'
import {
  buildLearnAssistantContext,
  buildSystemPrompt,
  type LearnAssistantContextPayload,
} from '../../learn/learnAssistantContext'
import type { LearnSection } from '../../types/learn'
import styles from '../../pages/LearnPage.module.css'

type ChatMessage = { role: 'user' | 'assistant'; text: string; at: number }

const QUICK_KEYS = [
  'learn.assistant.quick1',
  'learn.assistant.quick2',
  'learn.assistant.quick3',
  'learn.assistant.quick4',
] as const satisfies readonly MessageKey[]

export function LearnAssistantPanel({
  gradeId,
  chapterId,
  section,
  slideIndex,
  slideTitle,
  slideBody,
}: {
  gradeId: string
  chapterId: string
  section: LearnSection
  slideIndex: number
  slideTitle: string
  slideBody: string
}) {
  const { t, locale } = useT()
  const [mode, setMode] = useState<'teacher' | 'helper'>('teacher')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const ctx: LearnAssistantContextPayload = buildLearnAssistantContext({
    locale,
    gradeId,
    chapterId,
    section,
    slideIndex,
    t: (k) => t(k as MessageKey),
    mode,
  })
  ctx.slideTitle = slideTitle
  ctx.slideBody = slideBody

  const sendText = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return
      setError(null)
      const userMsg: ChatMessage = { role: 'user', text: text.trim(), at: Date.now() }
      const nextMessages = [...messages, userMsg]
      setMessages(nextMessages)
      setLoading(true)
      try {
        const res = await fetch('/api/learn/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system: buildSystemPrompt(ctx),
            messages: nextMessages.map((m) => ({ role: m.role, content: m.text })),
          }),
        })
        if (!res.ok) throw new Error('api')
        const data = (await res.json()) as { reply?: string }
        const reply = data.reply?.trim() || t('learn.assistant.hintDefault')
        setMessages((m) => [...m, { role: 'assistant', text: reply, at: Date.now() }])
      } catch {
        setError(t('learn.assistant.error'))
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            text: `${t('learn.assistant.offline')} ${t('learn.assistant.hintDefault')}`,
            at: Date.now(),
          },
        ])
      } finally {
        setLoading(false)
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
      }
    },
    [loading, messages, ctx, t],
  )

  const send = useCallback(() => {
    const text = input.trim()
    if (!text) return
    setInput('')
    void sendText(text)
  }, [input, sendText])

  return (
    <aside className={styles.learnAssistant} aria-label={t('learn.assistant.title')}>
      <div className={styles.learnAssistantHead}>
        <div className={styles.learnAssistantBrand}>
          <span className={styles.learnAssistantAvatar} aria-hidden>
            ✦
          </span>
          <h3 className={styles.learnAssistantH}>{t('learn.assistant.title')}</h3>
        </div>
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
                {m.role === 'user' ? 'Вы' : 'ИИ'}
              </span>
              <p>{m.text}</p>
            </div>
          ))
        )}
        {loading ? <p className={styles.learnAssistantThinking}>{t('learn.assistant.thinking')}</p> : null}
        {error ? <p className={styles.learnAssistantError}>{error}</p> : null}
      </div>

      <p className={styles.learnAssistantDisclaimer}>{t('learn.assistant.disclaimer')}</p>

      <div className={styles.learnAssistantInputRow}>
        <input
          type="text"
          className={styles.learnAssistantInput}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void send()}
          placeholder={t('learn.assistant.placeholder')}
          disabled={loading}
        />
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
