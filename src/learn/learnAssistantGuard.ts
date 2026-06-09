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

export function filterAssistantReply(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return trimmed
  for (const p of BLOCKED_PATTERNS) {
    if (p.test(trimmed)) {
      return 'Я не могу давать инструкции по опасным или вредным веществам. Задайте вопрос по школьной химии, лабораторной безопасности или расчётам — помогу в рамках учебной программы.'
    }
  }
  return trimmed
}

/** Дополнительная фильтрация подсказок коуча — без готового ответа. */
export function filterTaskCoachReply(text: string, _taskCoach?: LearnTaskCoachContext): string {
  let out = filterAssistantReply(text)
  for (const p of TASK_ANSWER_LEAK) {
    if (p.test(out)) {
      out = out.replace(p, '').trim()
    }
  }
  if (!out || out.length < 12) {
    return 'Запиши в черновик «Дано» и «Найти», затем спроси следующий шаг — я подскажу направление, не ответ.'
  }
  return out
}
