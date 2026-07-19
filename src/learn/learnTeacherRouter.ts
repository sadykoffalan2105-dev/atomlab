import { generateLocalLearnReply, type LearnLocalAssistantContext } from './learnLocalAssistant'
import { matchFaqEntry } from './learnChemistryFaq'
import { buildAssistantSystemPrompt } from './learnAssistantPrompt'
import { filterAssistantReply } from './learnAssistantGuard'
import { buildTeacherBrainPack } from './learnTeacherBrain'
import { requestPuterChat } from './learnPuterChat'

export type TeacherReplySource = 'faq' | 'local' | 'ollama' | 'api' | 'puter'

export type TeacherRouterOptions = {
  preferOllama?: boolean
  ollamaUrl?: string
  ollamaModel?: string
  /** Отключить бесплатный облачный мозг (Puter). По умолчанию включён. */
  disablePuter?: boolean
}

function puterEnabled(opts?: TeacherRouterOptions): boolean {
  if (opts?.disablePuter) return false
  const flag = import.meta.env.VITE_PUTER_ENABLED
  if (flag === '0' || flag === 'false') return false
  return true
}

const DEFAULT_OLLAMA = 'http://127.0.0.1:11434'
const DEFAULT_MODEL = 'llama3.2'

function ollamaEnabled(opts?: TeacherRouterOptions): boolean {
  if (opts?.preferOllama === false) return false
  const flag = import.meta.env.VITE_OLLAMA_ENABLED
  if (flag === '0' || flag === 'false') return false
  return opts?.preferOllama === true || flag === '1' || flag === 'true'
}

async function tryOllamaReply(
  messages: { role: string; content: string }[],
  ctx: LearnLocalAssistantContext,
  opts?: TeacherRouterOptions,
): Promise<string | null> {
  if (!ollamaEnabled(opts)) return null
  const base = (opts?.ollamaUrl ?? import.meta.env.VITE_OLLAMA_URL ?? DEFAULT_OLLAMA).replace(
    /\/$/,
    '',
  )
  const model = opts?.ollamaModel ?? import.meta.env.VITE_OLLAMA_MODEL ?? DEFAULT_MODEL
  const q = lastUserText(messages)
  const pack = buildTeacherBrainPack(q, ctx, messages)
  const system = buildAssistantSystemPrompt({
    ...ctx,
    knowledgeBlock: pack.catalogBlock,
    chemistryKnowledgeBlock: pack.chemistryKnowledgeBlock,
    sectionOutlineBlock: pack.sectionOutlineBlock,
    topicSceneId: pack.topicSceneId,
    conversationHints: pack.conversationHints,
  })
  try {
    const res = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          { role: 'system', content: system },
          ...messages.slice(-8).map((m) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content,
          })),
        ],
      }),
      signal: AbortSignal.timeout(25_000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { message?: { content?: string } }
    const text = data.message?.content?.trim()
    const filtered = text ? filterAssistantReply(text, ctx.locale) : ''
    return filtered.length > 2 ? filtered : null
  } catch {
    return null
  }
}

function lastUserText(messages: { role: string; content: string }[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === 'user') return messages[i].content.trim().toLowerCase()
  }
  return ''
}

function isOfflineFallback(text: string): boolean {
  return (
    text.includes('OpenAI') ||
    text.includes('онлайн-учителя') ||
    text.includes('free-form') ||
    text.includes('VITE_LEARN_CHAT_URL')
  )
}

function isOpenEndedQuestion(query: string): boolean {
  return /расскаж|объясни|по книг|из книг|что нибудь|что-нибудь|подроб|полност|explain|tell me|what is|textbook|tushuntir|gapir|aytib|misol|eslab|tekshir|yech|bog'liqlik|bog‘liqlik|dars bilan/i.test(
    query,
  )
}

/**
 * Бесплатный маршрут (без платежей и ключей):
 * FAQ (короткие RU) → Ollama (если локально запущен) → Puter (облачный GPT,
 * бесплатно, user-pays) → локальная база знаний → fallback.
 */
export async function routeTeacherReply(
  messages: { role: string; content: string }[],
  ctx: LearnLocalAssistantContext,
  opts?: TeacherRouterOptions,
): Promise<{ text: string; source: TeacherReplySource }> {
  const q = lastUserText(messages)
  const preferLlmLanguage = ctx.locale === 'en' || ctx.locale === 'uz'
  const wantsSmart = preferLlmLanguage || isOpenEndedQuestion(q)

  // Короткие FAQ на RU; для EN/UZ сначала модель (перевод/язык UI).
  if (!preferLlmLanguage && matchFaqEntry(q)) {
    return { text: generateLocalLearnReply(messages, ctx), source: 'faq' }
  }

  // 1) Локальная Ollama — если пользователь её поднял (максимальная приватность).
  if (ollamaEnabled(opts) && wantsSmart) {
    const ollama = await tryOllamaReply(messages, ctx, opts)
    if (ollama) return { text: ollama, source: 'ollama' }
  }

  // 2) Бесплатный облачный мозг Puter (GPT-4o-mini). Ключи и оплата не нужны.
  if (puterEnabled(opts)) {
    const puter = await requestPuterChat(messages, ctx).catch(() => null)
    if (puter) return { text: puter, source: 'puter' }
  }

  const local = generateLocalLearnReply(messages, ctx)

  if (!isOfflineFallback(local)) {
    return { text: local, source: 'local' }
  }

  if (ollamaEnabled(opts)) {
    const ollama = await tryOllamaReply(messages, ctx, opts)
    if (ollama) return { text: ollama, source: 'ollama' }
  }

  return { text: local, source: 'faq' }
}
