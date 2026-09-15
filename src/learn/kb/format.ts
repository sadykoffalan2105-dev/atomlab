import type { KbHit } from './types'

function pages(hit: KbHit): string {
  if (hit.pageStart == null) return ''
  if (hit.pageEnd != null && hit.pageEnd !== hit.pageStart) return `стр. ${hit.pageStart}–${hit.pageEnd}`
  return `стр. ${hit.pageStart}`
}

/**
 * Short source reference for a hit.
 * Textbook chunks: "[Kimyo 8, §23, стр. 95]" ("§2.3" = chapter 2, topic 3 in books that restart numbering per chapter).
 * Cards / FAQ: "[ATOMLAB: вещества — Серная кислота (H₂SO₄)]".
 */
export function citationFor(hit: KbHit): string {
  if (hit.grade != null && /^Kimyo\b/.test(hit.source)) {
    const parts = [hit.source]
    if (hit.kp) parts.push(`§${hit.kp}`)
    const p = pages(hit)
    if (p) parts.push(p)
    return `[${parts.join(', ')}]`
  }
  return `[${hit.source} — ${hit.title}]`
}

function cutAtSentence(text: string, max: number): string {
  if (text.length <= max) return text
  const slice = text.slice(0, max)
  const stop = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('.\n'), slice.lastIndexOf('! '), slice.lastIndexOf('? '))
  if (stop > max * 0.5) return slice.slice(0, stop + 1)
  const space = slice.lastIndexOf(' ')
  return `${slice.slice(0, space > 0 ? space : max)}…`
}

/**
 * Knowledge block for an LLM prompt: one block per hit with its citation and title, separated by "---",
 * never longer than `maxChars`. The last block is shortened at a sentence boundary; blocks that would
 * get fewer than ~160 characters are dropped.
 */
export function formatKnowledgeForPrompt(hits: KbHit[], maxChars: number): string {
  const sep = '\n---\n'
  const blocks: string[] = []
  let used = 0
  for (const hit of hits) {
    const header = `${citationFor(hit)} ${hit.title}`.trim()
    const body = hit.text.replace(/\n{3,}/g, '\n\n').trim()
    const overhead = header.length + 1 + (blocks.length ? sep.length : 0)
    const room = maxChars - used - overhead
    if (room < 160) break
    const text = cutAtSentence(body, room)
    const block = `${header}\n${text}`
    blocks.push(block)
    used += block.length + (blocks.length > 1 ? sep.length : 0)
  }
  return blocks.join(sep)
}
