import { messagesRu } from '../i18n/messagesRu'
import { getLearnFgosMeta } from '../data/learnFgosMatrix'
import type { LearnLocalAssistantContext } from './learnLocalAssistant'
import type { LearnGradeId } from '../types/learn'

function sectionMessagePrefix(ctx: LearnLocalAssistantContext): string {
  return `learn.${ctx.gradeId}.${ctx.chapterId}.${ctx.sectionId}`
}

/** Тексты параграфа из i18n (слайды, подсказки) для RAG офлайн/онлайн. */
export function buildSectionOutlineBlock(ctx: LearnLocalAssistantContext, maxChars = 2200): string {
  const prefix = sectionMessagePrefix(ctx)
  const fgos = getLearnFgosMeta(ctx.gradeId as LearnGradeId, ctx.chapterId, ctx.sectionId)
  const lines: string[] = [
    `§${ctx.kpNumber} ${ctx.sectionTitle}`,
    `Program (FGOS): ${fgos.programBlock}`,
    `Skills: ${fgos.skills.join('; ')}`,
    `Content tier in app: ${fgos.contentTier}`,
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
