/**
 * «Сообщить об ошибке» под ответом ИИ-учителя: причина + необязательный комментарий → POST /kb/feedback
 * (src/learn/brain/remote/feedbackClient.ts). Уходят только вопрос, ответ и комментарий — без имени и адреса.
 * Плюс строка «Ответ ИИ носит рекомендательный характер · Об ИИ-учителе» (AiAdvisoryNote) для подвала чата.
 */
import { useId, useState } from 'react'
import { useLocale } from '../../../i18n/useLocale'
import { FEEDBACK_LIMITS, reportBrainAnswer, type FeedbackReason, type FeedbackResult } from '../../../learn/brain/remote/feedbackClient'
import { aiNoticeText, type AiNoticeKey } from './aiNoticeI18n'
import styles from './AnswerReport.module.css'

const REASONS: { id: FeedbackReason; key: AiNoticeKey }[] = [
  { id: 'wrong', key: 'reasonWrong' },
  { id: 'unclear', key: 'reasonUnclear' },
  { id: 'unsafe', key: 'reasonUnsafe' },
  { id: 'language', key: 'reasonLanguage' },
  { id: 'other', key: 'reasonOther' },
]

export function AnswerReport({ question, answer, gradeId, route }: { question: string; answer: string; gradeId?: string; route?: string }) {
  const { locale } = useLocale()
  const tx = (k: AiNoticeKey) => aiNoticeText(locale, k)
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<FeedbackReason>('wrong')
  const [comment, setComment] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | FeedbackResult>('idle')
  const formId = useId()

  if (state === 'sent') {
    return (
      <p className={styles.done} role="status" data-answer-report="sent">
        {tx('sent')}
      </p>
    )
  }

  const submit = async () => {
    if (state === 'sending') return
    setState('sending')
    const r = await reportBrainAnswer({ question, answer, comment, reason, lang: locale, gradeId, route })
    setState(r)
  }

  return (
    <div className={styles.wrap} data-answer-report="">
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls={formId}
        onClick={() => setOpen((v) => !v)}
      >
        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.5 14V2.5M3.5 2.5h8l-1.6 3 1.6 3h-8" />
        </svg>
        {tx('report')}
      </button>
      {open ? (
        <form
          id={formId}
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <fieldset className={styles.reasons}>
            <legend className={styles.legend}>{tx('reportTitle')}</legend>
            {REASONS.map((r) => (
              <label key={r.id} className={styles.reason}>
                <input type="radio" name={`${formId}-reason`} value={r.id} checked={reason === r.id} onChange={() => setReason(r.id)} />
                {tx(r.key)}
              </label>
            ))}
          </fieldset>
          <label className={styles.commentLabel}>
            {tx('commentLabel')}
            <textarea
              className={styles.comment}
              value={comment}
              maxLength={FEEDBACK_LIMITS.comment}
              rows={2}
              onChange={(e) => setComment(e.target.value)}
            />
          </label>
          <p className={styles.hint}>{tx('commentHint')}</p>
          <div className={styles.row}>
            <button type="submit" className={styles.send} disabled={state === 'sending'}>
              {state === 'sending' ? tx('sending') : tx('send')}
            </button>
            <button type="button" className={styles.cancel} onClick={() => setOpen(false)}>
              {tx('cancel')}
            </button>
            {state === 'offline' || state === 'rate' || state === 'error' ? (
              <span className={styles.err} role="alert">
                {tx(state)}
              </span>
            ) : null}
          </div>
        </form>
      ) : null}
    </div>
  )
}

/** «Ответ ИИ носит рекомендательный характер · Об ИИ-учителе» — для подвала чата. */
export function AiAdvisoryNote() {
  const { locale } = useLocale()
  return (
    <span data-ai-advisory="">
      {aiNoticeText(locale, 'advisory')}{' '}
      <a className={styles.aboutLink} href="#/about-ai">
        {aiNoticeText(locale, 'aboutLink')}
      </a>{' '}
    </span>
  )
}
