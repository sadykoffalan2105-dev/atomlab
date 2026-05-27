import { messagesRu } from '../i18n/messagesRu'
import type { LearnLocalAssistantContext } from './learnLocalAssistant'

function sectionMessagePrefix(ctx: LearnLocalAssistantContext): string {
  return `learn.${ctx.gradeId}.${ctx.chapterId}.${ctx.sectionId}`
}

/** Тексты параграфа из i18n (слайды, подсказки) для RAG офлайн/онлайн. */
export function buildSectionOutlineBlock(ctx: LearnLocalAssistantContext, maxChars = 2200): string {
  const prefix = sectionMessagePrefix(ctx)
  const lines: string[] = [
    `§${ctx.kpNumber} ${ctx.sectionTitle}`,
    `Current slide: ${ctx.slideTitle}`,
  ]
  if (ctx.slideBody.trim()) lines.push(`Slide excerpt: ${ctx.slideBody.slice(0, 500)}`)

  for (const [key, val] of Object.entries(messagesRu)) {
    if (!key.startsWith(prefix) || key.endsWith('.title')) continue
    if (typeof val !== 'string' || val.length < 8) continue
    lines.push(`${key.replace(prefix, '').replace(/^\./, '')}: ${val.slice(0, 280)}`)
  }

  let block = lines.join('\n')
  if (block.length > maxChars) block = block.slice(0, maxChars) + '…'
  return block
}
