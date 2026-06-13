import type { ChemistryKnowledgeChunk } from './learnChemistryKnowledgeBase'
import type { FaqEntry } from './learnChemistryFaq'
import type { LearnLocalAssistantContext } from './learnLocalAssistant'

const OPENERS_RU = [
  'Смотрите,',
  'Коротко:',
  'Интересный момент —',
  'По сути,',
]

const OPENERS_EN = ['Quick answer:', 'In short:', 'Key point:', 'So,']

function pickOpener(ru: boolean, seed: string): string {
  const list = ru ? OPENERS_RU : OPENERS_EN
  return list[seed.length % list.length] ?? list[0]!
}

function firstParagraph(text: string, maxLen = 280): string {
  const parts = text.split(/\n\n+/).map((p) => p.replace(/\*\*/g, '').trim()).filter(Boolean)
  let out = parts[0] ?? text.replace(/\*\*/g, '').trim()
  if (out.length > maxLen) {
    const cut = out.slice(0, maxLen)
    const lastDot = cut.lastIndexOf('.')
    out = lastDot > 80 ? cut.slice(0, lastDot + 1) : `${cut}…`
  }
  return out
}

/** Краткий живой ответ без лишних блоков. */
export function synthesizeKnowledgeAnswer(
  query: string,
  chunks: ChemistryKnowledgeChunk[],
  faq: FaqEntry | null,
  ctx: LearnLocalAssistantContext,
): string {
  const ru = ctx.locale !== 'en'
  const opener = pickOpener(ru, query)

  if (faq) {
    const core = firstParagraph(ru ? faq.ru : faq.en, 320)
    return `${opener} ${core}`
  }

  if (chunks.length === 0) {
    return ru
      ? `${opener} уточните вопрос — по формуле, реакции или теме §${ctx.kpNumber}.`
      : `${opener} narrow it down — formula, reaction, or §${ctx.kpNumber} topic?`
  }

  const main = chunks[0]!
  const mainText = ru ? main.ru : main.en
  const wantsFull =
    /полност|подроб|по учебник|объясни тем|объясни §|расскажи|что такое|explain fully|in detail|tell me about/i.test(
      query,
    )
  const lead = firstParagraph(mainText, main.textbook && wantsFull ? 900 : main.textbook ? 360 : 260)

  const parts: string[] = [`${opener} **${main.topic}** — ${lead}`]

  if (main.textbook && wantsFull) {
    const remember = ru ? main.textbook.rememberRu : main.textbook.rememberEn
    parts.push('', ru ? '**Запомнить:**' : '**Remember:**', remember)
    const extra = chunks.slice(1, 3)
    for (const c of extra) {
      if (c.textbook && c.id !== main.id) {
        parts.push('', `**${c.topic}**`, firstParagraph(ru ? c.ru : c.en, 420))
      }
    }
  }

  if (!wantsFull) {
    parts.push(
      '',
      ru ? 'Нужно пример или задача по этой теме?' : 'Want an example or a practice problem?',
    )
  }

  return parts.join('\n')
}

export function buildConversationHints(
  messages: { role: string; content: string }[],
  ru: boolean,
): string {
  const recent = messages.slice(-4)
  if (recent.length < 2) return ''

  const userTurns = recent.filter((m) => m.role === 'user').map((m) => m.content.trim())
  if (userTurns.length === 0) return ''

  return ru
    ? `\nДИАЛОГ (вопрос → ответ): ученик спрашивал: «${userTurns.join('» → «')}». Дай прямой ответ на последний вопрос, короче, без повторов.`
    : `\nQ&A DIALOGUE: student asked: "${userTurns.join('" → "')}". Answer the latest question directly, stay concise.`
}
