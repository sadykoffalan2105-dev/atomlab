import type { ChemistryKnowledgeChunk } from './learnChemistryKnowledgeBase'
import type { FaqEntry } from './learnChemistryFaq'
import type { LearnLocalAssistantContext } from './learnLocalAssistant'

const OPENERS_RU = [
  'Отличный вопрос!',
  'Хорошо, что спросили!',
  'Давайте разберём это спокойно.',
  'Интересная тема — сейчас объясню.',
]

const OPENERS_EN = [
  'Great question!',
  'Glad you asked!',
  "Let's break this down step by step.",
  'Interesting topic — here is how I would explain it in class.',
]

function pickOpener(ru: boolean, seed: string): string {
  const list = ru ? OPENERS_RU : OPENERS_EN
  const idx = seed.length % list.length
  return list[idx] ?? list[0]!
}

function firstParagraph(text: string, maxLen = 420): string {
  const parts = text.split(/\n\n+/).map((p) => p.replace(/\*\*/g, '').trim()).filter(Boolean)
  let out = parts[0] ?? text.replace(/\*\*/g, '').trim()
  if (out.length > maxLen) {
    const cut = out.slice(0, maxLen)
    const lastDot = cut.lastIndexOf('.')
    out = lastDot > 120 ? cut.slice(0, lastDot + 1) : `${cut}…`
  }
  return out
}

function secondInsight(text: string, maxLen = 280): string | null {
  const parts = text.split(/\n\n+/).map((p) => p.replace(/\*\*/g, '').trim()).filter(Boolean)
  const second = parts[1]
  if (!second) return null
  if (second.length <= maxLen) return second
  const cut = second.slice(0, maxLen)
  const lastDot = cut.lastIndexOf('.')
  return lastDot > 80 ? cut.slice(0, lastDot + 1) : `${cut}…`
}

/** Переписывает фрагменты базы в живой ответ учителя, без «простыни» из справочника. */
export function synthesizeKnowledgeAnswer(
  query: string,
  chunks: ChemistryKnowledgeChunk[],
  faq: FaqEntry | null,
  ctx: LearnLocalAssistantContext,
): string {
  const ru = ctx.locale !== 'en'
  const opener = pickOpener(ru, query)

  if (faq) {
    const core = firstParagraph(ru ? faq.ru : faq.en, 520)
    const follow = ru
      ? `Если хотите — могу привести пример из §${ctx.kpNumber} «${ctx.sectionTitle}» или задать пару вопросов для самопроверки.`
      : `Want an example from §${ctx.kpNumber} "${ctx.sectionTitle}" or a quick self-check?`
    return `${opener}\n\n${core}\n\n${follow}`
  }

  if (chunks.length === 0) {
    return ru
      ? `${opener} Сформулируйте вопрос чуть конкретнее — по формуле, реакции или теме §${ctx.kpNumber}.`
      : `${opener} Could you narrow the question — formula, reaction, or §${ctx.kpNumber} topic?`
  }

  const main = chunks[0]!
  const mainText = ru ? main.ru : main.en
  const lead = firstParagraph(mainText, main.textbook ? 680 : 420)
  const extra = chunks.length > 1 ? secondInsight(ru ? chunks[1]!.ru : chunks[1]!.en) : secondInsight(mainText)

  const parts: string[] = [
    `${opener} **${main.topic}** — ${ru ? 'вот как я объясняю это ученикам' : 'here is how I teach this in class'}:\n`,
    lead,
  ]

  if (main.textbook) {
    const remember = ru ? main.textbook.rememberRu : main.textbook.rememberEn
    parts.push('', ru ? '**Запомнить по учебнику:**' : '**Remember from the textbook:**', remember)
  }

  if (extra) {
    parts.push('', ru ? '**Важный нюанс:**' : '**Key nuance:**', extra)
  }

  if (chunks.length > 2) {
    const names = chunks
      .slice(1, 3)
      .map((c) => c.topic)
      .join(ru ? ' и ' : ' and ')
    parts.push('', ru ? `Связано также с: ${names}.` : `Also related: ${names}.`)
  }

  parts.push(
    '',
    ru
      ? `Сейчас вы в §${ctx.kpNumber} «${ctx.sectionTitle}». Сверьте с учебником и 3D-моделью — так тема «сядет» надёжнее. Что уточнить: пример, задачу или объяснение проще?`
      : `You are in §${ctx.kpNumber} "${ctx.sectionTitle}". Check the textbook and 3D model. Need an example, a problem, or a simpler explanation?`,
  )

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
    ? `\nДИАЛОГ: ученик уже спрашивал: «${userTurns.join('» → «')}». Не повторяй дословно прошлый ответ — развивай мысль или уточняй.`
    : `\nDIALOGUE: student already asked: "${userTurns.join('" → "')}". Do not repeat verbatim — extend or clarify.`
}
