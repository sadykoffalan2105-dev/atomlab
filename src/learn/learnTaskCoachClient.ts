import type { LearnLocalAssistantContext } from './learnLocalAssistant'
import type { LearnTaskCoachContext } from './learnTaskCoachTypes'
import type { LearnTaskGenerated } from './learnTaskProblems'
import { filterTaskCoachReply } from './learnAssistantGuard'
import { routeTaskCoachReply } from './learnTaskCoachRouter'
import { requestTeacherChat } from './teacherServiceClient'

const CHAT_URL = import.meta.env.VITE_LEARN_CHAT_URL ?? '/api/learn/chat'

export type TaskCoachMessage = { role: 'user' | 'assistant'; content: string }

export async function requestTaskCoachReply(
  messages: TaskCoachMessage[],
  baseContext: Omit<LearnLocalAssistantContext, 'mode'>,
  taskCoach: LearnTaskCoachContext,
  problem: LearnTaskGenerated,
): Promise<{ text: string; source: 'openai' | 'local' | 'ollama' }> {
  const context: LearnLocalAssistantContext = {
    ...baseContext,
    mode: 'helper',
    taskCoach,
  }

  const payload = { messages, context }

  const teacher = await requestTeacherChat(messages, context)
  if (teacher?.text) {
    return {
      text: filterTaskCoachReply(teacher.text, taskCoach),
      source: 'ollama',
    }
  }

  try {
    const res = await fetch(CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = (await res.json()) as {
      reply?: string | null
      source?: 'openai' | 'local' | 'error'
    }
    const reply = data.reply?.trim()
    if (reply) {
      return {
        text: filterTaskCoachReply(reply, taskCoach),
        source: data.source === 'openai' ? 'openai' : 'local',
      }
    }
  } catch {
    /* fallback */
  }

  const routed = await routeTaskCoachReply(messages, context, problem)
  return {
    text: filterTaskCoachReply(routed.text, taskCoach),
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
