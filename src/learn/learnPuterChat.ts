/**
 * Бесплатный «мозг» ИИ-учителя через Puter.js (puter.ai.chat).
 *
 * Puter работает по модели «User Pays»: запросы к GPT-4o/Claude оплачивает
 * бесплатный аккаунт самого пользователя, разработчик не платит ничего и не
 * заводит API-ключей. Скрипт уже подгружается для озвучки (learnPuterTts),
 * поэтому переиспользуем ту же загрузку и авторизацию.
 */
import { ensurePuterSignedIn } from './learnPuterTts'
import { buildAssistantSystemPrompt } from './learnAssistantPrompt'
import { buildTeacherBrainPack } from './learnTeacherBrain'
import { filterAssistantReply } from './learnAssistantGuard'
import type { LearnLocalAssistantContext } from './learnLocalAssistant'

type ChatMessage = { role: string; content: string }

type PuterChatFn = (
  messages: Array<{ role: string; content: string }>,
  options?: { model?: string; stream?: boolean; temperature?: number; max_tokens?: number },
) => Promise<unknown>

type PuterWithChat = { ai?: { chat?: PuterChatFn } }

/** Порядок предпочтения моделей — все бесплатны в Puter. */
const PREFERRED_MODELS = ['gpt-4o-mini', 'gpt-4.1-mini', 'gpt-4o'] as const

const CHAT_TIMEOUT_MS = 30_000

function puterChatFn(): PuterChatFn | null {
  if (typeof window === 'undefined') return null
  const puter = (window as unknown as { puter?: PuterWithChat }).puter
  return puter?.ai?.chat ?? null
}

export function isPuterChatLoaded(): boolean {
  return puterChatFn() !== null
}

function withTimeout<T>(promise: Promise<T>, ms: number, signal?: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const timer = setTimeout(() => reject(new Error('timeout')), ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    promise.then(
      (v) => {
        clearTimeout(timer)
        signal?.removeEventListener('abort', onAbort)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        signal?.removeEventListener('abort', onAbort)
        reject(e)
      },
    )
  })
}

/** Достаёт текст из ответа Puter — форматы GPT/Claude отличаются. */
function extractText(resp: unknown): string {
  if (resp == null) return ''
  if (typeof resp === 'string') return resp
  const r = resp as Record<string, unknown>

  // OpenAI-подобный: { message: { content: string | [{text}] } }
  const message = r.message as Record<string, unknown> | undefined
  if (message) {
    const c = message.content
    if (typeof c === 'string') return c
    if (Array.isArray(c)) {
      return c
        .map((part) =>
          typeof part === 'string'
            ? part
            : ((part as Record<string, unknown>)?.text as string) ?? '',
        )
        .join('')
    }
  }

  if (typeof r.text === 'string') return r.text
  if (typeof r.content === 'string') return r.content

  // { choices: [{ message: { content } }] }
  const choices = r.choices as Array<Record<string, unknown>> | undefined
  if (Array.isArray(choices) && choices[0]) {
    const cm = choices[0].message as Record<string, unknown> | undefined
    if (cm && typeof cm.content === 'string') return cm.content
  }
  return ''
}

function lastUserText(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === 'user') return messages[i]!.content.trim()
  }
  return ''
}

/**
 * Спрашивает бесплатный облачный LLM (Puter) с системным промптом учителя и
 * базой знаний урока. Возвращает готовый ответ или null (тогда сработает
 * офлайн-база).
 */
export async function requestPuterChat(
  messages: ChatMessage[],
  ctx: LearnLocalAssistantContext,
  signal?: AbortSignal,
): Promise<string | null> {
  if (typeof window === 'undefined') return null

  // Грузим Puter и (при возможности) авторизуемся. Если не вышло — уходим в null.
  try {
    await ensurePuterSignedIn(signal)
  } catch {
    /* продолжаем — chat может работать и в анонимном режиме */
  }

  const chat = puterChatFn()
  if (!chat) return null

  const q = lastUserText(messages)
  const pack = buildTeacherBrainPack(q.toLowerCase(), ctx, messages)
  const system = buildAssistantSystemPrompt({
    ...ctx,
    knowledgeBlock: pack.catalogBlock,
    chemistryKnowledgeBlock: pack.chemistryKnowledgeBlock,
    sectionOutlineBlock: pack.sectionOutlineBlock,
    topicSceneId: pack.topicSceneId,
    conversationHints: pack.conversationHints,
  })

  const payload = [
    { role: 'system', content: system },
    ...messages.slice(-8).map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    })),
  ]

  for (const model of PREFERRED_MODELS) {
    if (signal?.aborted) return null
    try {
      const resp = await withTimeout(
        chat(payload, { model, stream: false, temperature: 0.6 }),
        CHAT_TIMEOUT_MS,
        signal,
      )
      const text = extractText(resp).trim()
      if (text.length > 2) {
        const filtered = filterAssistantReply(text, ctx.locale)
        if (filtered.trim().length > 2) return filtered.trim()
      }
    } catch {
      /* пробуем следующую модель */
    }
  }
  return null
}
