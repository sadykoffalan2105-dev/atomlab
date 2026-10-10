/**
 * Системный промпт учителя + история диалога (для любой подключаемой модели).
 * Промпт собирается из buildAssistantSystemPrompt / buildLiveAssistantSystemPrompt с базой знаний урока.
 * Локальный мозг (src/learn/brain/remote/brainClient.ts) строит свой промпт на сервере —
 * сюда обращаются только встроенные в браузер модели.
 */
import { buildAssistantSystemPrompt, buildLiveAssistantSystemPrompt } from './learnAssistantPrompt'
import type { LearnLocalAssistantContext } from './learnLocalAssistant'
import { buildAssistantKnowledgeBlock } from './learnAssistantKnowledge'
import { buildSectionOutlineBlock } from './learnSectionKnowledge'
import { retrieveForTeacher, type TeacherKnowledgeResult } from './teacherKnowledge'

export type ChatMessage = { role: string; content: string }

function lastUserText(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === 'user') return messages[i]!.content.trim()
  }
  return ''
}

/** Системный промпт + последние 8 реплик (live — короткий промпт и компактная база). */
export async function buildTeacherChatPayload(
  messages: ChatMessage[],
  ctx: LearnLocalAssistantContext,
  opts: { live?: boolean; knowledge?: TeacherKnowledgeResult; signal?: AbortSignal } = {},
): Promise<{ payload: ChatMessage[]; knowledge: TeacherKnowledgeResult }> {
  const live = Boolean(opts.live)
  const q = lastUserText(messages)
  const knowledge =
    opts.knowledge ??
    (await retrieveForTeacher(q, {
      locale: ctx.locale,
      gradeId: ctx.gradeId,
      chapterId: ctx.chapterId,
      sectionId: ctx.sectionId,
      sectionTitle: ctx.sectionTitle,
      limit: live ? 5 : 8,
      maxChars: live ? 3_600 : 12_000,
      timeoutMs: 2_500,
      signal: opts.signal,
    }))
  const catalog = buildAssistantKnowledgeBlock(q, ctx)
  const promptInput = {
    ...ctx,
    knowledgeBlock: live && catalog.block.length > 1_200 ? `${catalog.block.slice(0, 1_200)}…` : catalog.block,
    chemistryKnowledgeBlock: knowledge.text,
    sectionOutlineBlock: buildSectionOutlineBlock(ctx, live ? 600 : 1_200),
    topicSceneId: catalog.topicSceneId,
  }
  const system = live ? buildLiveAssistantSystemPrompt(promptInput) : buildAssistantSystemPrompt(promptInput)
  const payload: ChatMessage[] = [
    { role: 'system', content: system },
    ...messages.slice(-8).map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
  ]
  return { payload, knowledge }
}
