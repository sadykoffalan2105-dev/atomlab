/**
 * Бесплатный «мозг» ИИ-учителя через Puter.js (puter.ai.chat).
 *
 * Puter работает по модели «User Pays»: запросы к GPT-4o/Claude оплачивает
 * бесплатный аккаунт самого пользователя, разработчик не платит ничего и не
 * заводит API-ключей. Скрипт уже подгружается для озвучки (learnPuterTts),
 * поэтому переиспользуем ту же загрузку и авторизацию.
 */
import { ensurePuterSignedIn } from './learnPuterTts'
import { buildAssistantSystemPrompt, buildLiveAssistantSystemPrompt } from './learnAssistantPrompt'
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
const FAST_MODELS = ['gpt-4o-mini'] as const

const CHAT_TIMEOUT_MS = 30_000
const FAST_CHAT_TIMEOUT_MS = 6_500
const LIVE_CHAT_TIMEOUT_MS = 4_200

export type PuterChatOptions = {
  /** Жёсткий таймаут на одну модель (мс). Для голосового диалога — короче. */
  timeoutMs?: number
  /** Только быстрая модель (для live-диалога). */
  fast?: boolean
  /** Live-голос: короткий промпт + компактный RAG. */
  live?: boolean
  signal?: AbortSignal
}

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
  signalOrOpts?: AbortSignal | PuterChatOptions,
): Promise<string | null> {
  if (typeof window === 'undefined') return null

  const opts: PuterChatOptions =
    signalOrOpts instanceof AbortSignal || signalOrOpts === undefined
      ? { signal: signalOrOpts }
      : signalOrOpts
  const signal = opts.signal
  const live = Boolean(opts.live)
  const timeoutMs =
    opts.timeoutMs ??
    (opts.live ? LIVE_CHAT_TIMEOUT_MS : opts.fast ? FAST_CHAT_TIMEOUT_MS : CHAT_TIMEOUT_MS)
  const models = opts.live || opts.fast ? FAST_MODELS : PREFERRED_MODELS

  // Грузим Puter и (при возможности) авторизуемся. Если не вышло — уходим в null.
  try {
    await ensurePuterSignedIn(signal)
  } catch {
    /* продолжаем — chat может работать и в анонимном режиме */
  }

  const chat = puterChatFn()
  if (!chat) return null

  const q = lastUserText(messages)
  const pack = buildTeacherBrainPack(q.toLowerCase(), ctx, messages, {
    profile: live ? 'live' : 'full',
  })
  const promptInput = {
    ...ctx,
    knowledgeBlock: pack.catalogBlock,
    chemistryKnowledgeBlock: pack.chemistryKnowledgeBlock,
    sectionOutlineBlock: pack.sectionOutlineBlock,
    topicSceneId: pack.topicSceneId,
    conversationHints: pack.conversationHints,
  }
  const system = live
    ? buildLiveAssistantSystemPrompt(promptInput)
    : buildAssistantSystemPrompt(promptInput)

  const payload = [
    { role: 'system', content: system },
    ...messages.slice(live ? -6 : -8).map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    })),
  ]

  for (const model of models) {
    if (signal?.aborted) return null
    try {
      const resp = await withTimeout(
        chat(payload, {
          model,
          stream: false,
          // live: чуть ниже температура — точнее факты; меньше токенов — быстрее ответ
          temperature: live ? 0.32 : opts.fast ? 0.4 : 0.55,
          max_tokens: live ? 320 : opts.fast ? 520 : undefined,
        }),
        timeoutMs,
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
