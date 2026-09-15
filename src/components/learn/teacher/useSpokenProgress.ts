/**
 * Какое предложение учитель произносит прямо сейчас.
 *
 * Движок озвучки не сообщает прогресс по фрагментам, поэтому оцениваем его по
 * времени фактического звучания (пока играет neural-аудио или браузерный голос)
 * и средней скорости речи. Если движок начнёт отдавать точный индекс —
 * передайте его в `exactIndex`, оценка отключится.
 */
import { useEffect, useMemo, useState } from 'react'
import { isNeuralPlaybackActive } from '../../../learn/learnSpeechPlayback'
import { isBrowserSpeechActive } from '../../../learn/learnSpeechBrowser'
import { splitIntoSentences } from '../../../learn/brain/voice/sentenceStream'

/** Символов в секунду у голоса учителя (rate −10 %…+2 %). */
const CHARS_PER_SEC: Record<string, number> = { ru: 13.5, en: 14.5, uz: 13 }
/** Длинная реплика озвучивается сжатой (liveSpeechCondense ≈ 520 симв.). */
const SPOKEN_MAX_CHARS = 520
const TICK_MS = 120

function isAudioPlaying(): boolean {
  try {
    return isNeuralPlaybackActive() || isBrowserSpeechActive()
  } catch {
    return false
  }
}

export function useSentences(text: string): string[] {
  return useMemo(() => {
    const plain = text
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/[#>*_`|]/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    const parts = splitIntoSentences(plain, { minChars: 1, maxChars: 220, firstMaxChars: 220 })
    return parts.length > 0 ? parts : plain.trim() ? [plain.trim()] : []
  }, [text])
}

/** Индекс произносимого предложения; -1 — ещё не начал звучать. */
export function useSpokenProgress(
  sentences: readonly string[],
  speaking: boolean,
  lang: string,
  exactIndex?: number,
): number {
  const [index, setIndex] = useState(-1)
  const [trackedKey, setTrackedKey] = useState('')
  const key = `${speaking ? 1 : 0}|${sentences.join('').length}|${sentences[0] ?? ''}`
  if (key !== trackedKey) {
    setTrackedKey(key)
    setIndex(-1)
  }

  useEffect(() => {
    if (!speaking || exactIndex !== undefined || sentences.length === 0) return
    const cps = CHARS_PER_SEC[lang] ?? 13.5
    const total = sentences.reduce((n, s) => n + s.length + 1, 0)
    const scale = total > SPOKEN_MAX_CHARS ? total / SPOKEN_MAX_CHARS : 1
    const ends: number[] = []
    let acc = 0
    for (const s of sentences) {
      acc += s.length + 1
      ends.push(acc)
    }
    let playedMs = 0
    let last = performance.now()
    const timer = window.setInterval(() => {
      const now = performance.now()
      if (isAudioPlaying()) playedMs += now - last
      last = now
      if (playedMs <= 0) return
      const spokenChars = (playedMs / 1000) * cps * scale
      let i = ends.findIndex((end) => spokenChars < end)
      if (i < 0) i = sentences.length - 1
      setIndex((prev) => (i > prev ? i : prev))
    }, TICK_MS)
    return () => window.clearInterval(timer)
  }, [speaking, sentences, lang, exactIndex])

  if (exactIndex !== undefined) return exactIndex
  return speaking ? index : -1
}
