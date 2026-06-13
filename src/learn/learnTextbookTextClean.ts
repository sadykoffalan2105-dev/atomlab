/** Убирает переносы из PDF: «свой- ства» → «свойства». */
export function cleanPdfHyphenation(text: string): string {
  return text
    .replace(/(\p{Ll})-\s+(\p{Ll})/gu, '$1$2')
    .replace(/(\p{Ll})-\s*\n\s*(\p{Ll})/gu, '$1$2')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function cleanRememberBlock(text: string): string {
  return cleanPdfHyphenation(
    text
      .replace(/\*\*Изучаемые понятия:\*\*[^•\n]*/gi, '')
      .replace(/\*\*Key terms:\*\*[^•\n]*/gi, '')
      .replace(/•\s*Источник:[^\n]*/gi, '')
      .replace(/•\s*Source:[^\n]*/gi, '')
      .replace(/\*\*/g, '')
      .trim(),
  )
}

/** 2–4 коротких пункта «обязательно запомнить». */
export function extractRememberBullets(text: string, max = 4): string[] {
  const clean = cleanRememberBlock(text)
  const junk =
    /^(изучаемые понятия|key terms|источник|source|практическое занятие\.?\s*знакомство)/i

  const bullets = clean
    .split(/•|\n/)
    .map((s) => s.replace(/^[-–]\s*/, '').trim())
    .filter((s) => s.length >= 20 && s.length <= 200 && !junk.test(s))

  if (bullets.length >= 2) return bullets.slice(0, max)

  const sentences = clean
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 30 && s.length <= 180 && !junk.test(s))

  return sentences.slice(0, max)
}
