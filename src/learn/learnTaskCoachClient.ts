import type { LearnLocalAssistantContext } from './learnLocalAssistant'
import type { LearnTaskCoachContext } from './learnTaskCoachTypes'
import type { LearnTaskGenerated } from './learnTaskProblems'
import { filterTaskCoachReply } from './learnAssistantGuard'
import { routeTaskCoachReply } from './learnTaskCoachRouter'
import { requestTeacherChat } from './teacherServiceClient'
import { retrieveForTeacher } from './teacherKnowledge'

/**
 * Шлюз чата — только если явно настроен (VITE_LEARN_CHAT_URL). Пустая строка = не настроен
 * (раньше `??` пропускал '' и fetch уходил в никуда). Без шлюза коуч работает бесплатно и локально.
 */
const CHAT_URL = (import.meta.env.VITE_LEARN_CHAT_URL as string | undefined)?.trim() || ''
const CHAT_TIMEOUT_MS = 12_000

export type TaskCoachMessage = { role: 'user' | 'assistant'; content: string }

export async function requestTaskCoachReply(
  messages: TaskCoachMessage[],
  baseContext: Omit<LearnLocalAssistantContext, 'mode'>,
  taskCoach: LearnTaskCoachContext,
  problem: LearnTaskGenerated,
  opts: { signal?: AbortSignal } = {},
): Promise<{ text: string; source: 'openai' | 'local' | 'ollama' }> {
  const context: LearnLocalAssistantContext = {
    ...baseContext,
    mode: 'helper',
    taskCoach,
  }
  const signal = opts.signal

  // Знания для коуча — через общий адаптер (вне критического пути, с кешем).
  const question = [...messages].reverse().find((m) => m.role === 'user')?.content ?? taskCoach.questionText
  const knowledge = await retrieveForTeacher(question, {
    locale: baseContext.locale,
    gradeId: baseContext.gradeId,
    chapterId: baseContext.chapterId,
    sectionId: baseContext.sectionId,
    sectionTitle: baseContext.sectionTitle,
    limit: 3,
    maxChars: 2_500,
    timeoutMs: 1_500,
    signal,
  })
  const payloadContext = { ...context, knowledgeBlock: knowledge.text, citations: knowledge.citations }

  const teacher = await requestTeacherChat(messages, payloadContext, { signal })
  if (teacher?.text) {
    return {
      text: filterTaskCoachReply(teacher.text, taskCoach, baseContext.locale),
      source: 'ollama',
    }
  }

  if (CHAT_URL && !signal?.aborted) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), CHAT_TIMEOUT_MS)
    const onAbort = () => ctrl.abort()
    signal?.addEventListener('abort', onAbort, { once: true })
    try {
      const res = await fetch(CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, context: payloadContext }),
        signal: ctrl.signal,
      })
      const contentType = res.headers.get('content-type') ?? ''
      if (res.ok && contentType.includes('json')) {
        const data = (await res.json()) as {
          reply?: string | null
          source?: 'openai' | 'local' | 'error'
        }
        const reply = data.reply?.trim()
        if (reply) {
          return {
            text: filterTaskCoachReply(reply, taskCoach, baseContext.locale),
            source: data.source === 'openai' ? 'openai' : 'local',
          }
        }
      }
    } catch {
      /* статический хостинг без API, таймаут или отмена — локальный коуч */
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    }
  }

  const routed = await routeTaskCoachReply(messages, context, problem, { knowledgeBlock: knowledge.text })
  return {
    text: filterTaskCoachReply(routed.text, taskCoach, baseContext.locale),
    source: routed.source === 'ollama' ? 'ollama' : 'local',
  }
}

export function buildTaskCoachBaseContext(
  locale: 'ru' | 'en' | 'uz',
  categoryTitle: string,
): Omit<LearnLocalAssistantContext, 'mode'> {
  return {
    locale,
    gradeId: 'g8',
    chapterId: 'tasks',
    sectionId: 'learn-tasks',
    sectionTitle: categoryTitle,
    slideTitle: 'Задача',
    slideBody: '',
    kpNumber: 0,
    curriculumOnly: true,
  }
}
