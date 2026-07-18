/**
 * Разбор голосовых команд управления диалогом. Явные команды («дай ещё вопрос»,
 * «следующая тема», «объясни…», «режим экзамена») распознаются по шаблонам,
 * всё остальное считается ответом/репликой ученика.
 */
import type { AssistantLang, VoiceIntent } from './dualModeTypes'

const RE = {
  nextQuestion:
    /\b(ещ[её]|друг|нов\w*)\s+вопрос|дай\s+вопрос|next\s+question|another\s+question|yana\s+savol|boshqa\s+savol/i,
  nextTopic:
    /следующ\w*\s+тем|перейд\w*|переход\w*\s+к|друг\w*\s+тем|next\s+topic|move\s+on|keyingi\s+mavzu|mavzuni\s+almashtir/i,
  explain:
    /^(объясни|расскаж\w*|поясни|что\s+так\w*|почему|как\s+работает|explain|tell\s+me|what\s+is|why|tushuntir|nima\s+uchun)/i,
  repeat: /повтор\w*|ещ[её]\s+раз|repeat|again|qayta|takrorla/i,
  stop: /\b(стоп|хватит|заверши\w*|законч\w*|stop|finish|enough|to[‘'`]?xta|tugat)/i,
  examMode: /режим\s+экзамен|экзамен\w*\s+режим|начать\s+экзамен|exam\s+mode|start\s+exam|imtihon\s+rejim/i,
  trainingMode:
    /режим\s+обучен|обучен\w*\s+режим|режим\s+консультац|training\s+mode|learning\s+mode|o[‘'`]?quv\s+rejim/i,
}

export function parseVoiceIntent(raw: string, _lang: AssistantLang): VoiceIntent {
  const text = raw.trim()
  if (!text) return { kind: 'answer', text: '' }

  if (RE.examMode.test(text)) return { kind: 'switch_mode', target: 'exam' }
  if (RE.trainingMode.test(text)) return { kind: 'switch_mode', target: 'training' }
  if (RE.stop.test(text)) return { kind: 'stop' }
  if (RE.nextTopic.test(text)) return { kind: 'next_topic' }
  if (RE.nextQuestion.test(text)) return { kind: 'next_question' }
  if (RE.repeat.test(text)) return { kind: 'repeat' }
  if (RE.explain.test(text)) return { kind: 'explain', text }

  return { kind: 'answer', text }
}
