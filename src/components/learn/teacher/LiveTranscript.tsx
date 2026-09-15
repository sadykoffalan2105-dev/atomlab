/**
 * Правая колонка онлайн-урока: расшифровка диалога (пузыри + источники),
 * «ход мыслей» учителя и текстовый ввод (многострочный) с быстрыми командами.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { useT } from '../../../i18n/useT'
import type { LiveMessage } from '../../../learn/brain/dualMode/useDualModeTeacher'
import type { ReasoningStepSnapshot } from '../../../learn/brain'
import { LearnAssistantMarkdown } from '../LearnAssistantMarkdown'
import { IconCheckCircle, IconSend } from '../LearnAiIcons'
import { extractCitations } from './citations'
import { SourceChips } from './TeacherChips'
import { IconArrowNext, IconMessage, IconPhoto, IconQuestion } from './TeacherIcons'
import styles from './LiveTutor.module.css'

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export type QueuedTurn = { id: number; kind: 'text' | 'command'; text: string; label: string }

export function LiveTranscript({
  messages,
  partial,
  queued,
  speakingMessageId,
  reasoning,
  onSend,
  onAskAnother,
  onNextTopic,
  onHomeworkPhoto,
  onHomeworkText,
  inputRef,
}: {
  messages: readonly LiveMessage[]
  partial: string
  queued: readonly QueuedTurn[]
  speakingMessageId: number | null
  reasoning: readonly ReasoningStepSnapshot[]
  onSend: (text: string) => void
  onAskAnother: () => void
  onNextTopic: () => void
  onHomeworkPhoto: () => void
  onHomeworkText: (text: string) => void
  inputRef: RefObject<HTMLTextAreaElement | null>
}) {
  const { t } = useT()
  const [tab, setTab] = useState<'dialog' | 'reasoning'>('dialog')
  const [text, setText] = useState('')
  const logRef = useRef<HTMLDivElement>(null)
  const hintId = useId()
  const tabsId = useId()

  useEffect(() => {
    const el = logRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 220
    if (!nearBottom) return
    el.scrollTo({ top: el.scrollHeight, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }, [messages.length, partial, queued.length, tab])

  useLayoutEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [text, inputRef])

  const submit = () => {
    const clean = text.trim()
    if (!clean) return
    setText('')
    onSend(clean)
  }

  const empty = messages.length === 0 && !partial && queued.length === 0

  return (
    <section className={styles.transcript} aria-label={t('learn.teacherUi.transcript')}>
      <div className={styles.tabs} role="tablist" id={tabsId}>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'dialog'}
          className={styles.tab}
          data-on={tab === 'dialog' ? '1' : undefined}
          onClick={() => setTab('dialog')}
        >
          <IconMessage className={styles.tabIcon} />
          {t('learn.teacherUi.transcript')}
          {messages.length > 0 ? <span className={styles.tabCount}>{messages.length}</span> : null}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'reasoning'}
          className={styles.tab}
          data-on={tab === 'reasoning' ? '1' : undefined}
          onClick={() => setTab('reasoning')}
        >
          <IconQuestion className={styles.tabIcon} />
          {t('learn.teacherExam.liveReasoning')}
          {reasoning.length > 0 ? <span className={styles.tabCount}>{reasoning.length}</span> : null}
        </button>
      </div>

      <div ref={logRef} className={styles.log} role="log" aria-live="polite" aria-relevant="additions">
        {tab === 'reasoning' ? (
          reasoning.length === 0 ? (
            <p className={styles.logEmpty}>{t('learn.teacherUi.reasoningEmpty')}</p>
          ) : (
            <ol className={styles.reasoningList}>
              {reasoning.slice(-8).map((step, i) => (
                <li key={`${step.atMs}-${i}`} className={styles.reasoningStep}>
                  <span className={styles.reasoningObs}>{step.observation}</span>
                  <span className={styles.reasoningInf}>{step.inference}</span>
                </li>
              ))}
            </ol>
          )
        ) : (
          <>
            {empty ? <p className={styles.logEmpty}>{t('learn.teacherUi.emptyTranscript')}</p> : null}
            {messages.map((m) => {
              if (m.role === 'you') {
                return (
                  <div key={m.id} className={styles.msgYou}>
                    <span className={styles.srOnly}>{t('learn.teacherExam.liveYou')}: </span>
                    <p>{m.text}</p>
                  </div>
                )
              }
              const { text: body, citations } = extractCitations(m.text)
              const speaking = speakingMessageId === m.id
              return (
                <div
                  key={m.id}
                  className={styles.msgTeacher}
                  data-speaking={speaking ? '1' : undefined}
                  data-interrupted={m.interrupted && !speaking ? '1' : undefined}
                >
                  <span className={styles.msgRole}>
                    {t('learn.teacherExam.liveTeacher')}
                    {speaking ? <span className={styles.msgSpeaking}>{t('learn.teacherUi.statusSpeaking')}</span> : null}
                    {m.interrupted && !speaking ? (
                      <span className={styles.msgInterrupted}>{t('learn.teacherUi.stoppedTag')}</span>
                    ) : null}
                  </span>
                  <LearnAssistantMarkdown text={body} className={styles.msgMd} />
                  <SourceChips citations={citations} className={styles.msgSources} />
                </div>
              )
            })}
            {partial ? (
              <div className={`${styles.msgYou} ${styles.msgPartial}`}>
                <p>
                  {partial}
                  <span className={styles.caret} aria-hidden />
                </p>
              </div>
            ) : null}
            {queued.map((q) => (
              <div key={q.id} className={`${styles.msgYou} ${styles.msgQueued}`}>
                <p>{q.label}</p>
                <span className={styles.queuedTag}>{t('learn.teacherUi.queued')}</span>
              </div>
            ))}
          </>
        )}
      </div>

      <div className={styles.composer}>
        <div className={styles.quickRow}>
          <button type="button" className={styles.quickBtn} onClick={onAskAnother}>
            <IconQuestion className={styles.quickIcon} />
            {t('learn.teacherExam.liveAskAnother')}
          </button>
          <button type="button" className={styles.quickBtn} onClick={onNextTopic}>
            <IconArrowNext className={styles.quickIcon} />
            {t('learn.teacherExam.liveNextTopic')}
          </button>
          <button type="button" className={styles.quickBtn} onClick={onHomeworkPhoto}>
            <IconPhoto className={styles.quickIcon} />
            {t('learn.assistant.homeworkScan')}
          </button>
          {/* «Проверить ДЗ» имеет смысл только для набранного текста — не занимаем место зря. */}
          {text.trim().length >= 12 ? (
            <button
              type="button"
              className={styles.quickBtn}
              onClick={() => {
                const clean = text.trim()
                if (clean.length < 12) return
                setText('')
                onHomeworkText(clean)
              }}
            >
              <IconCheckCircle className={styles.quickIcon} />
              {t('learn.assistant.homework')}
            </button>
          ) : null}
        </div>
        <div className={styles.field}>
          <textarea
            ref={inputRef}
            rows={1}
            className={styles.input}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                submit()
              }
            }}
            placeholder={t('learn.teacherExam.liveTypePlaceholder')}
            aria-label={t('learn.teacherExam.liveTypePlaceholder')}
            aria-describedby={hintId}
            enterKeyHint="send"
            maxLength={2000}
          />
          <button
            type="button"
            className={styles.sendBtn}
            onClick={submit}
            disabled={!text.trim()}
            aria-label={t('learn.teacherExam.liveSend')}
            title={t('learn.teacherExam.liveSend')}
          >
            <IconSend />
          </button>
        </div>
        <p id={hintId} className={styles.inputHint}>
          {t('learn.teacherUi.inputHint')}
        </p>
      </div>
    </section>
  )
}
