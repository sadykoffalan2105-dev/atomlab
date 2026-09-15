/**
 * Живые субтитры под аватаром: реплика учителя с подсветкой произносимого
 * предложения или «черновик» речи ученика с кареткой.
 */
import { useEffect, useRef } from 'react'
import { useT } from '../../../i18n/useT'
import { extractCitations } from './citations'
import { useSentences, useSpokenProgress } from './useSpokenProgress'
import styles from './LiveTutor.module.css'

function norm(text: string): string {
  return text.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, '')
}

/**
 * Какая из показанных фраз сейчас звучит: сначала по тексту от TTS
 * (озвучка может сокращать или делить фразы иначе), затем по индексу.
 * undefined — точных данных нет, работает оценка по времени.
 */
function matchSpokenSentence(sentences: readonly string[], spokenText: string, spokenIndex: number): number | undefined {
  if (sentences.length === 0) return undefined
  const probe = norm(spokenText)
  if (probe.length >= 4) {
    const head = probe.slice(0, 24)
    const normed = sentences.map(norm)
    let hit = normed.findIndex((s) => s.includes(head) || (s.length >= 8 && head.startsWith(s.slice(0, 24))))
    if (hit < 0) {
      // Длинную фразу TTS мог разрезать — ищем по началу склейки всех фраз.
      const joined = normed.join('')
      const at = joined.indexOf(head)
      if (at >= 0) {
        let acc = 0
        hit = normed.findIndex((s) => (acc += s.length) > at)
      }
    }
    if (hit >= 0) return hit
  }
  if (spokenIndex >= 0 && spokenIndex < sentences.length) return spokenIndex
  return undefined
}

export function LiveCaptions({
  teacherText,
  speaking,
  partial,
  lastStudentText,
  thinking,
  lang,
  spokenIndex = -1,
  spokenText = '',
}: {
  teacherText: string
  speaking: boolean
  partial: string
  lastStudentText: string
  thinking: boolean
  lang: string
  /** Индекс фразы от движка озвучки (-1 — неизвестно). */
  spokenIndex?: number
  /** Текст фразы от движка озвучки — точнее индекса (TTS может резать иначе). */
  spokenText?: string
}) {
  const { t } = useT()
  const body = extractCitations(teacherText).text
  const sentences = useSentences(body)
  const exact = speaking ? matchSpokenSentence(sentences, spokenText, spokenIndex) : undefined
  const spoken = useSpokenProgress(sentences, speaking, lang, exact)
  const listRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    // Прокручиваем только сами субтитры (scrollIntoView сдвигал бы весь оверлей).
    const box = listRef.current
    const el = box?.querySelector<HTMLElement>('[data-now="1"]')
    if (!box || !el) return
    box.scrollTo({ top: Math.max(0, el.offsetTop - 6), behavior: 'smooth' })
  }, [spoken])

  if (partial) {
    return (
      <div className={styles.captions} data-kind="you" aria-live="off">
        <span className={styles.captionWho}>{t('learn.teacherExam.liveYou')}</span>
        <p className={styles.captionYou}>
          {partial}
          <span className={styles.caret} aria-hidden />
        </p>
      </div>
    )
  }

  if (thinking && lastStudentText) {
    return (
      <div className={styles.captions} data-kind="thinking" aria-live="off">
        <span className={styles.captionWho}>{t('learn.teacherExam.liveYou')}</span>
        <p className={styles.captionEcho}>«{lastStudentText}»</p>
      </div>
    )
  }

  if (!body) return <div className={styles.captions} data-kind="empty" aria-hidden />

  return (
    <div className={styles.captions} data-kind="teacher" data-speaking={speaking ? '1' : undefined} aria-live="off">
      <span className={styles.captionWho}>{t('learn.teacherExam.liveTeacher')}</span>
      <p ref={listRef} className={styles.captionTeacher}>
        {sentences.map((s, i) => (
          <span
            key={`${i}-${s.slice(0, 12)}`}
            className={styles.sentence}
            data-now={speaking && i === Math.max(0, spoken) ? '1' : undefined}
            data-done={speaking && i < spoken ? '1' : undefined}
          >
            {s}{' '}
          </span>
        ))}
      </p>
    </div>
  )
}
