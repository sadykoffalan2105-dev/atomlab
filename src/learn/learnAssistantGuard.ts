import type { AssistantLocale } from './learnAssistantLocale'
import { normalizeTeacherReplyText } from './learnTeacherTextNormalize'
import type { LearnTaskCoachContext } from './learnTaskCoachTypes'

const BLOCKED_PATTERNS = [
  /взрывчат/i,
  /\bexplosive\b/i,
  /наркотик/i,
  /\bdrug\s+synth/i,
  /отравить\s+человек/i,
  /poison\s+someone/i,
]

const TASK_ANSWER_LEAK = [
  /\bответ\s*[:=—-]\s*[\d,.]+/i,
  /\bитого\s*[:=—-]\s*[\d,.]+/i,
  /\bполучается\s+[\d,.]+\s*(г|кг|моль|л|мл|%)/i,
  /\bthe answer is\s+[\d,.]+/i,
  /\bвариант\s+[а-гa-d]\s*—?\s*верн/i,
  /\bcorrect (option|answer)\s*(is|:)\s*/i,
]

export function filterAssistantReply(text: string, locale: AssistantLocale = 'ru'): string {
  const trimmed = text.trim()
  if (!trimmed) return trimmed
  for (const p of BLOCKED_PATTERNS) {
    if (p.test(trimmed)) {
      if (locale === 'uz') {
        return 'Xavfli yoki zararli moddalar bo‘yicha ko‘rsatmalar bera olmayman. Maktab kimyosi, laboratoriya xavfsizligi yoki hisoblar haqida so‘rang.'
      }
      if (locale === 'en') {
        return 'I cannot give instructions on dangerous or harmful substances. Ask about school chemistry, lab safety, or calculations.'
      }
      return 'Я не могу давать инструкции по опасным или вредным веществам. Задайте вопрос по школьной химии, лабораторной безопасности или расчётам — помогу в рамках учебной программы.'
    }
  }
  return normalizeTeacherReplyText(trimmed, locale)
}

export function filterTaskCoachReply(
  text: string,
  taskCoach?: LearnTaskCoachContext,
  locale: AssistantLocale = 'ru',
): string {
  void taskCoach
  let out = filterAssistantReply(text, locale)
  for (const p of TASK_ANSWER_LEAK) {
    if (p.test(out)) {
      out = out.replace(p, '').trim()
    }
  }
  if (!out || out.length < 12) {
    if (locale === 'uz') {
      return 'Qoralama da «Berilgan» va «Topish» ni yozing, keyin keyingi qadamni so‘rang — yo‘nalishni aytaman, javobni emas.'
    }
    if (locale === 'en') {
      return 'Write “Given” and “Find” in your notes, then ask for the next step — I will guide, not give the answer.'
    }
    return 'Запиши в черновик «Дано» и «Найти», затем спроси следующий шаг — я подскажу направление, не ответ.'
  }
  return out
}
