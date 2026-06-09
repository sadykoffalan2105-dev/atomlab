import { generateLocalLearnReply, type LearnLocalAssistantContext } from './learnLocalAssistant'
import { filterAssistantReply, filterTaskCoachReply } from './learnAssistantGuard'
import { buildAssistantSystemPrompt } from './learnAssistantPrompt'
import { buildTaskCoachSystemPrompt } from './learnTaskCoachPrompt'
import { generateTaskCoachLocalReply } from './learnTaskCoachLocal'
import { buildTeacherBrainPack } from './learnTeacherBrain'
import { retrieveChemistryKnowledge, buildRetrievedKnowledgeBlock } from './learnKnowledgeRetrieval'

export type LearnChatMessage = { role: 'user' | 'assistant'; content: string }

export type LearnChatRequestBody = {
  messages?: LearnChatMessage[]
  context?: LearnLocalAssistantContext
}

export type LearnChatResult = {
  status: number
  reply: string | null
  source: 'openai' | 'local' | 'error'
  error?: string
  headers?: Record<string, string>
}

const MAX_USER_CHARS = 2000
const MAX_HISTORY = 12
const MAX_TOKENS = 900

const rateBuckets = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 30
const RATE_WINDOW_MS = 60_000

export type LearnChatRuntimeConfig = {
  openaiApiKey?: string
  openaiBaseUrl: string
  openaiModel: string
  allowedOrigins: string[]
}

export function learnChatRuntimeFromEnv(
  env: Record<string, string | undefined> = {},
): LearnChatRuntimeConfig {
  return {
    openaiApiKey: env.OPENAI_API_KEY ?? env.VITE_OPENAI_API_KEY,
    openaiBaseUrl: env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
    openaiModel: env.OPENAI_MODEL ?? 'gpt-4o-mini',
    allowedOrigins: (env.ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  }
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const bucket = rateBuckets.get(ip)
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  if (bucket.count >= RATE_LIMIT) return false
  bucket.count++
  return true
}

function lastUserText(messages: LearnChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === 'user') return messages[i].content.trim()
  }
  return ''
}

function trimMessages(messages: LearnChatMessage[]): LearnChatMessage[] {
  const trimmed = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role,
      content: m.content.slice(0, MAX_USER_CHARS),
    }))
  return trimmed.slice(-MAX_HISTORY)
}

function corsHeaders(origin: string | undefined, allowedOrigins: string[]): Record<string, string> {
  const devOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173']
  const all = [...allowedOrigins, ...devOrigins]
  const ok = origin && all.some((o) => origin === o || origin.startsWith(o))
  return {
    'Access-Control-Allow-Origin': ok && origin ? origin : (all[0] ?? '*'),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

export function learnChatOptionsResponse(
  origin: string | undefined,
  runtime: LearnChatRuntimeConfig,
): LearnChatResult {
  return {
    status: 204,
    reply: null,
    source: 'error',
    headers: corsHeaders(origin, runtime.allowedOrigins),
  }
}

async function callOpenAI(
  system: string,
  messages: LearnChatMessage[],
  runtime: LearnChatRuntimeConfig,
): Promise<string> {
  const apiKey = runtime.openaiApiKey
  if (!apiKey) throw new Error('no_api_key')

  const upstream = await fetch(`${runtime.openaiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
        model: runtime.openaiModel,
      messages: [{ role: 'system', content: system }, ...messages],
      max_tokens: MAX_TOKENS,
      temperature: 0.42,
    }),
  })

  if (!upstream.ok) {
    throw new Error(`upstream_${upstream.status}`)
  }

  const data = (await upstream.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  return data.choices?.[0]?.message?.content?.trim() ?? ''
}

export async function processLearnChat(
  body: LearnChatRequestBody,
  meta: { origin?: string; clientIp?: string; runtime: LearnChatRuntimeConfig },
): Promise<LearnChatResult> {
  const headers = {
    'Content-Type': 'application/json',
    ...corsHeaders(meta.origin, meta.runtime.allowedOrigins),
  }

  const ip = meta?.clientIp ?? 'local'
  if (!checkRateLimit(ip)) {
    return {
      status: 429,
      reply: null,
      source: 'error',
      error: 'rate_limit',
      headers,
    }
  }

  const messages = trimMessages(body.messages ?? [])
  const ctx = body.context

  if (!ctx) {
    return {
      status: 400,
      reply: null,
      source: 'error',
      error: 'missing_context',
      headers,
    }
  }

  const userQuery = lastUserText(messages)
  if (!userQuery) {
    return {
      status: 400,
      reply: null,
      source: 'error',
      error: 'empty_message',
      headers,
    }
  }

  if (ctx.taskCoach) {
    const speechLocale = ctx.locale === 'en' ? 'en' : 'ru'
    const retrieved = retrieveChemistryKnowledge(userQuery, {
      maxChunks: 2,
      minScore: 1,
      gradeId: ctx.gradeId,
      sectionTitle: ctx.taskCoach.categoryTitle,
    })
    const knowledgeBlock = buildRetrievedKnowledgeBlock(userQuery, speechLocale, {
      maxChars: 1500,
      gradeId: ctx.gradeId,
      sectionTitle: ctx.taskCoach.categoryTitle,
      preloaded: retrieved,
    })
    const system = buildTaskCoachSystemPrompt({ ...ctx, taskCoach: ctx.taskCoach, knowledgeBlock })

    try {
      const raw = await callOpenAI(system, messages, meta.runtime)
      const reply = raw ? filterTaskCoachReply(raw, ctx.taskCoach) : ''
      if (reply) {
        return { status: 200, reply, source: 'openai', headers }
      }
    } catch {
      /* fallback */
    }

    const reply = filterTaskCoachReply(
      generateTaskCoachLocalReply(
        messages.map((m) => ({ role: m.role, content: m.content })),
        ctx.taskCoach,
        null,
        ctx.locale,
      ),
      ctx.taskCoach,
    )
    return { status: 200, reply, source: 'local', headers }
  }

  const { catalogBlock, topicSceneId, chemistryKnowledgeBlock, sectionOutlineBlock, conversationHints } =
    buildTeacherBrainPack(userQuery, ctx, messages)
  const system = buildAssistantSystemPrompt({
    ...ctx,
    knowledgeBlock: catalogBlock,
    chemistryKnowledgeBlock,
    sectionOutlineBlock,
    topicSceneId,
    conversationHints,
  })

  try {
    const raw = await callOpenAI(system, messages, meta.runtime)
    const reply = raw ? filterAssistantReply(raw) : ''
    if (reply) {
      return { status: 200, reply, source: 'openai', headers }
    }
  } catch {
    /* fallback below */
  }

  const reply = filterAssistantReply(
    generateLocalLearnReply(
      messages.map((m) => ({ role: m.role, content: m.content })),
      ctx,
    ),
  )
  return { status: 200, reply, source: 'local', headers }
}
