import { generateLocalLearnReply, type LearnLocalAssistantContext } from './learnLocalAssistant'
import { matchFaqEntry } from './learnChemistryFaq'

export type TeacherReplySource = 'faq' | 'local' | 'ollama' | 'api'

export type TeacherRouterOptions = {
  preferOllama?: boolean
  ollamaUrl?: string
  ollamaModel?: string
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
  const system = `You are a school chemistry teacher (grades 7-11). Answer in ${
    ctx.locale === 'en' ? 'English' : 'Russian'
  }. Topic: ${ctx.sectionTitle}. Be accurate, concise, safe in lab.`
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
    return text && text.length > 2 ? text : null
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

/** Бесплатный маршрут: FAQ → локальная база → Ollama (если включено) → fallback. */
export async function routeTeacherReply(
  messages: { role: string; content: string }[],
  ctx: LearnLocalAssistantContext,
  opts?: TeacherRouterOptions,
): Promise<{ text: string; source: TeacherReplySource }> {
  const q = lastUserText(messages)
  const local = generateLocalLearnReply(messages, ctx)

  if (matchFaqEntry(q)) {
    return { text: local, source: 'faq' }
  }

  if (!isOfflineFallback(local)) {
    return { text: local, source: 'local' }
  }

  if (ollamaEnabled(opts)) {
    const ollama = await tryOllamaReply(messages, ctx, opts)
    if (ollama) return { text: ollama, source: 'ollama' }
  }

  return { text: local, source: 'faq' }
}
