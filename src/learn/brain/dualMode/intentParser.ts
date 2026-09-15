/**
 * Разбор голосовых команд управления диалогом. Явные команды («дай ещё вопрос»,
 * «следующая тема», «объясни…», «режим экзамена») распознаются по шаблонам,
 * всё остальное считается ответом/репликой ученика.
 *
 * Важно: `\b` в JS-регулярках работает только для латиницы, поэтому границы
 * слов для кириллицы задаём через `(?<!\p{L})` с флагом `u`.
 */
import type { AssistantLang, VoiceIntent } from './dualModeTypes'

const RE = {
  nextQuestion:
    /(?<!\p{L})(ещ[её]|друг\p{L}*|нов\p{L}*|следующ\p{L}*)\s+вопрос|дай\s+(мне\s+)?(ещ[её]\s+)?вопрос|next\s+question|another\s+question|yana\s+savol|boshqa\s+savol|keyingi\s+savol/iu,
  nextTopic:
    /следующ\p{L}*\s+тем|перейд\p{L}*\s+(к|на)\s+(следующ|друг|нов)|друг\p{L}*\s+тем|нов\p{L}*\s+тем|next\s+topic|move\s+on|keyingi\s+mavzu|mavzuni\s+almashtir/iu,
  explain:
    /^(объясни|расскаж\p{L}*|поясни|что\s+так\p{L}*|почему|как\s+работает|explain|tell\s+me|what\s+is|why|tushuntir|nima\s+uchun)/iu,
  repeat: /(?<!\p{L})(повтор\p{L}*|ещ[её]\s+раз)(?!\p{L})|(?<![a-z])(repeat|say\s+again)(?![a-z])|qayta\s+ayt|takrorla/iu,
  /** Завершить урок — только явная команда, а не слово внутри ответа. */
  stop: /^\s*(давай\s+)?((заверш|законч)\p{L}*\s+(урок|диалог|занятие|на\s+сегодня)|на\s+сегодня\s+(всё|все|хватит)|(end|finish)\s+(the\s+)?(lesson|session)|darsni\s+tugat\p{L}*)[\s.!]*$/iu,
  /** «Стоп», «подожди» — просто замолчать и слушать (барджин), урок продолжается. */
  hush: /^\s*(стоп|хватит|подожди|погоди|тихо|stop|wait|hold\s+on|enough|to[‘'`ʻ]?xta|kuting?)[\s.!,]*$/iu,
  examMode: /режим\p{L}*\s+экзамен|экзамен\p{L}*\s+режим|начн?\p{L}*\s+экзамен|exam\s+mode|start\s+(the\s+)?exam|imtihon\s+rejim/iu,
  trainingMode:
    /режим\p{L}*\s+обучен|обучен\p{L}*\s+режим|режим\p{L}*\s+консультац|training\s+mode|learning\s+mode|o[‘'`ʻ]?quv\s+rejim/iu,
}

export function parseVoiceIntent(raw: string, lang: AssistantLang): VoiceIntent {
  void lang // регулярки уже покрывают ru/en/uz
  const text = raw.trim()
  if (!text) return { kind: 'answer', text: '' }

  if (RE.examMode.test(text)) return { kind: 'switch_mode', target: 'exam' }
  if (RE.trainingMode.test(text)) return { kind: 'switch_mode', target: 'training' }
  if (RE.stop.test(text)) return { kind: 'stop' }
  if (RE.hush.test(text)) return { kind: 'hush' }
  if (RE.nextTopic.test(text)) return { kind: 'next_topic' }
  if (RE.nextQuestion.test(text)) return { kind: 'next_question' }
  if (RE.repeat.test(text) && text.split(/\s+/).length <= 4) return { kind: 'repeat' }
  if (RE.explain.test(text)) return { kind: 'explain', text }

  return { kind: 'answer', text }
}
