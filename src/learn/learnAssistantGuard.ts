const BLOCKED_PATTERNS = [
  /взрывчат/i,
  /\bexplosive\b/i,
  /наркотик/i,
  /\bdrug\s+synth/i,
  /отравить\s+человек/i,
  /poison\s+someone/i,
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
