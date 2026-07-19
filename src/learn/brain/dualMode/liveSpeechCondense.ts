/**
 * Сжатие длинного ответа учителя для озвучки в live-диалоге:
 * в чат — полный текст, в голос — коротко и по делу (быстрее цикл вопрос→ответ).
 */
import type { AssistantLang } from './dualModeTypes'

const FOOTER_RE =
  /\n\s*(\*\*)?(Обязательно запомнить|Совет учителя|Проверь себя|Must remember|Teacher tip|Check yourself|Eslab qoling|O'qituvchi maslahati|O‘zingizni tekshiring)[\s\S]*$/i

function stripMd(s: string): string {
  return s
    .replace(/\*\*/g, '')
    .replace(/^#+\s*/gm, '')
    .replace(/^\s*[-•*]\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12)
}

/**
 * Голос: до ~maxChars, целыми предложениями, без блока «запомнить/проверь себя»
 * (он остаётся в тексте чата).
 */
export function condenseForLiveSpeech(
  fullText: string,
  lang: AssistantLang,
  maxChars = 520,
): string {
  let body = fullText.replace(FOOTER_RE, '').trim()
  body = stripMd(body)
  if (body.length <= maxChars) return body

  const sentences = splitSentences(body)
  if (sentences.length === 0) return body.slice(0, maxChars)

  let out = ''
  for (const s of sentences) {
    if (out.length + s.length + 1 > maxChars && out.length > 80) break
    out = out ? `${out} ${s}` : s
  }

  const closer =
    lang === 'en'
      ? ' More detail is in the chat.'
      : lang === 'uz'
        ? ' Batafsil matn chatda.'
        : ' Подробнее — в тексте чата.'

  if (out.length < body.length * 0.85) {
    out = `${out}${closer}`
  }
  return out.trim()
}
