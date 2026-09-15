/**
 * Quiz questions are both evaluation queries and (translated) parallel text for the automatic
 * uz/en → ru term alignment. To keep the evaluation honest, a deterministic half of the quiz items
 * is held out: alignment never sees them, and uz/en evaluation only uses them.
 */
export function fnv1a(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

export function isEvalHoldout(questionId: string): boolean {
  return fnv1a(questionId) % 2 === 0
}
