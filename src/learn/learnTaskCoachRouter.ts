import type { LearnLocalAssistantContext } from './learnLocalAssistant'
import type { LearnTaskGenerated } from './learnTaskProblems'
import { buildTaskCoachSystemPrompt } from './learnTaskCoachPrompt'
import { generateTaskCoachLocalReply } from './learnTaskCoachLocal'
import { filterTaskCoachReply } from './learnAssistantGuard'
import { retrieveChemistryKnowledge, buildRetrievedKnowledgeBlock } from './learnKnowledgeRetrieval'

export type TaskCoachReplySource = 'local' | 'ollama'

type RouterOptions = {
  preferOllama?: boolean
  ollamaUrl?: string
  ollamaModel?: string
}

const DEFAULT_OLLAMA = 'http://127.0.0.1:11434'
const DEFAULT_MODEL = 'llama3.2'

function ollamaEnabled(opts?: RouterOptions): boolean {
  if (opts?.preferOllama === false) return false
  const flag = import.meta.env.VITE_OLLAMA_ENABLED
  if (flag === '0' || flag === 'false') return false
  return opts?.preferOllama === true || flag === '1' || flag === 'true'
}

export async function routeTaskCoachReply(
  messages: { role: string; content: string }[],
  ctx: LearnLocalAssistantContext,
  problem: LearnTaskGenerated,
  opts?: RouterOptions,
): Promise<{ text: string; source: TaskCoachReplySource }> {
  const tc = ctx.taskCoach
  if (!tc) {
    return { text: '', source: 'local' }
  }

  const local = generateTaskCoachLocalReply(messages, tc, problem, ctx.locale)

  if (ollamaEnabled(opts)) {
    const ollama = await tryOllamaTaskCoach(messages, ctx, opts)
    if (ollama) return { text: ollama, source: 'ollama' }
  }

  return { text: local, source: 'local' }
}

async function tryOllamaTaskCoach(
  messages: { role: string; content: string }[],
  ctx: LearnLocalAssistantContext,
  opts?: RouterOptions,
): Promise<string | null> {
  const tc = ctx.taskCoach
  if (!tc) return null

  const base = (opts?.ollamaUrl ?? import.meta.env.VITE_OLLAMA_URL ?? DEFAULT_OLLAMA).replace(/\/$/, '')
  const model = opts?.ollamaModel ?? import.meta.env.VITE_OLLAMA_MODEL ?? DEFAULT_MODEL
  const speechLocale = ctx.locale === 'ru' ? 'ru' : 'en'
  const q = messages.filter((m) => m.role === 'user').pop()?.content ?? tc.questionText
  const retrieved = retrieveChemistryKnowledge(q, {
    maxChunks: 2,
    minScore: 1,
    gradeId: ctx.gradeId,
    sectionTitle: tc.categoryTitle,
  })
  const knowledgeBlock = buildRetrievedKnowledgeBlock(q, speechLocale, {
    maxChars: 1500,
    gradeId: ctx.gradeId,
    sectionTitle: tc.categoryTitle,
    preloaded: retrieved,
  })

  const system = buildTaskCoachSystemPrompt({ ...ctx, taskCoach: tc, knowledgeBlock })

  try {
    const res = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          { role: 'system', content: system },
          ...messages.slice(-6).map((m) => ({
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
    const filtered = text ? filterTaskCoachReply(text, tc, ctx.locale) : ''
    return filtered.length > 2 ? filtered : null
  } catch {
    return null
  }
}
