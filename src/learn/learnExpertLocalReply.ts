import { matchFaqEntry } from './learnChemistryFaq'
import { buildRetrievedKnowledgeBlock, retrieveChemistryKnowledge } from './learnKnowledgeRetrieval'
import { buildSectionOutlineBlock } from './learnSectionKnowledge'
import type { LearnLocalAssistantContext } from './learnLocalAssistant'

function isRu(locale: string): boolean {
  return locale !== 'en'
}

/** Человечный офлайн-ответ из FAQ + базы + конспекта §. */
export function composeExpertLocalReply(
  query: string,
  ctx: LearnLocalAssistantContext,
): string | null {
  const ru = isRu(ctx.locale)
  const loc = ctx.locale === 'en' ? 'en' : 'ru'
  const faq = matchFaqEntry(query)
  const retrieved = retrieveChemistryKnowledge(query, { maxChunks: 5, minScore: 1 })
  const kbBlock = buildRetrievedKnowledgeBlock(query, loc, 4500)

  if (!faq && retrieved.chunks.length === 0 && !kbBlock) {
    return null
  }

  const topics = retrieved.chunks.map((c) => c.topic)
  const topicLine =
    topics.length > 0
      ? ru
        ? topics.length > 1
          ? `Разберём тему «${topics[0]}» и связанное.`
          : `Разберём тему «${topics[0]}».`
        : topics.length > 1
          ? `Let's unpack "${topics[0]}" and related ideas.`
          : `Let's unpack "${topics[0]}".`
      : ru
        ? 'Хороший вопрос — разберём по шагам.'
        : 'Good question — we will break it down step by step.'

  const parts: string[] = [topicLine, '']

  if (faq) {
    parts.push(ru ? faq.ru : faq.en)
  } else if (kbBlock) {
    parts.push(kbBlock)
  }

  if (retrieved.chunks.length > 1 && faq) {
    const extra = retrieved.chunks
      .slice(1, 3)
      .map((c) => (ru ? c.ru : c.en))
      .join('\n\n')
    if (extra.trim()) {
      parts.push('', ru ? '**Связанное:**' : '**Related:**', extra)
    }
  }

  const sectionBlock = buildSectionOutlineBlock(ctx, 600)
  if (sectionBlock.includes(ctx.sectionTitle) || query.toLowerCase().includes('урок') || query.toLowerCase().includes('параграф')) {
    parts.push(
      '',
      ru
        ? `📖 Сейчас вы в §${ctx.kpNumber} «${ctx.sectionTitle}» — сверьте с учебником на этой странице.`
        : `📖 You are in §${ctx.kpNumber} "${ctx.sectionTitle}" — check the textbook page.`,
    )
  }

  parts.push(
    '',
    ru
      ? 'Если что-то осталось непонятным — уточните: «приведи пример» или «объясни проще».'
      : 'If something is still unclear — ask for an example or a simpler explanation.',
  )

  return parts.join('\n')
}
