/** Подготовка текста ответа учителя для озвучивания. */

export function stripMarkdownForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/#{1,6}\s+/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[📖✦•·▪]/g, ' ')
    .replace(/:\s*/g, ': ')
    .replace(/;\s*/g, '; ')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

const CHUNK_MAX = 1400

export function splitTextForTts(text: string, max = CHUNK_MAX): string[] {
  const clean = stripMarkdownForSpeech(text)
  if (!clean) return []
  if (clean.length <= max) return [clean]

  const parts: string[] = []
  let buf = ''
  for (const sentence of clean.split(/(?<=[.!?…])\s+/)) {
    const next = buf ? `${buf} ${sentence}` : sentence
    if (next.length > max) {
      if (buf) parts.push(buf)
      if (sentence.length > max) {
        for (let i = 0; i < sentence.length; i += max) {
          parts.push(sentence.slice(i, i + max))
        }
        buf = ''
      } else {
        buf = sentence
      }
    } else {
      buf = next
    }
  }
  if (buf) parts.push(buf)
  return parts
}
