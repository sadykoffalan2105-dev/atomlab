/**
 * Композер живых реплик преподавателя. Превращает решение стратегии
 * (тон + действие + уровень подсказки) в естественную устную фразу.
 * Текст — «речевой»: без разметки и без формул-символов (их произносим словами).
 */
import type { AssistantLang, StrategyDecision, TutorTone } from './brainTypes'

export interface PhraseContext {
  lang: AssistantLang
  question: string
  /** Ключевые пункты рубрики, которые ученик НЕ раскрыл. */
  missingPoints: string[]
  /** Короткая опорная выжимка из базы знаний (для объяснения). */
  knowledgeSnippet: string | null
  /** Обращение по имени, если известно. */
  studentName: string | null
  /** Тема/пробел для адресной подсказки. */
  topic: string
}

function pick<T>(list: readonly T[], seed: number): T {
  return list[Math.abs(seed) % list.length]!
}

function seedFrom(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

const OPEN_RU: Record<TutorTone, readonly string[]> = {
  strict: ['Слушаю внимательно.', 'Отвечайте по существу.', 'Итак, вопрос такой.'],
  neutral: ['Хорошо.', 'Идём дальше.', 'Продолжим.'],
  warm: ['Ничего страшного.', 'Давайте вместе.', 'Спокойно, разберёмся.'],
  encouraging: ['Уже неплохо!', 'Вы на верном пути.', 'Отлично, что пробуете!'],
}

const OPEN_EN: Record<TutorTone, readonly string[]> = {
  strict: ['Listen carefully.', 'Answer to the point.', 'Here is the question.'],
  neutral: ['Good.', 'Let us continue.', 'Moving on.'],
  warm: ['No worries.', 'Let us do it together.', 'Relax, we will figure it out.'],
  encouraging: ['Nice try!', 'You are on the right track.', 'Great that you are trying!'],
}

const OPEN_UZ: Record<TutorTone, readonly string[]> = {
  strict: ['Diqqat bilan tinglang.', 'Mavzu bo‘yicha javob bering.', 'Mana savol.'],
  neutral: ['Yaxshi.', 'Davom etamiz.', 'Keyingisiga o‘tamiz.'],
  warm: ['Xavotir olmang.', 'Birga hal qilamiz.', 'Xotirjam, tushunib olamiz.'],
  encouraging: ['Yaxshi urinish!', 'To‘g‘ri yo‘ldasiz.', 'Harakat qilayotganingiz zo‘r!'],
}

function opener(lang: AssistantLang, tone: TutorTone, seed: number): string {
  const table = lang === 'en' ? OPEN_EN : lang === 'uz' ? OPEN_UZ : OPEN_RU
  return pick(table[tone], seed)
}

function withName(line: string, name: string | null): string {
  if (!name) return line
  return `${name}, ${line.charAt(0).toLowerCase()}${line.slice(1)}`
}

/** Мягко «переспросить»/подсказать, опираясь на пропущенный пункт рубрики. */
function hintBody(ctx: PhraseContext, level: number): string {
  const point = ctx.missingPoints[0]?.trim()
  const lang = ctx.lang
  if (!point) {
    if (lang === 'en') return 'Add a bit more detail — what is the key idea here?'
    if (lang === 'uz') return 'Biroz batafsilroq ayting — bu yerda asosiy g‘oya nima?'
    return 'Добавьте деталей — в чём здесь главная мысль?'
  }
  if (level >= 3) {
    if (lang === 'en') return `The key point you are missing is: ${point}. Explain it in your own words.`
    if (lang === 'uz') return `Yetishmayotgan asosiy nuqta: ${point}. Buni o‘z so‘zingiz bilan tushuntiring.`
    return `Ключевой момент, которого не хватает: ${point}. Объясните его своими словами.`
  }
  if (level === 2) {
    if (lang === 'en') return `Think about this aspect: ${point}. How does it work?`
    if (lang === 'uz') return `Mana bu jihatga e’tibor bering: ${point}. U qanday ishlaydi?`
    return `Подумайте вот об этом: ${point}. Как это работает?`
  }
  if (lang === 'en') return 'You are close. One important part is still missing — what could it be?'
  if (lang === 'uz') return 'Yaqin qoldingiz. Bitta muhim qism yetishmayapti — bu nima bo‘lishi mumkin?'
  return 'Вы близко. Не хватает одной важной части — как думаете, какой?'
}

function explainBody(ctx: PhraseContext): string {
  const lang = ctx.lang
  if (ctx.knowledgeSnippet) return ctx.knowledgeSnippet
  if (lang === 'en') return `Let us break the topic "${ctx.topic}" into simple steps and go through them.`
  if (lang === 'uz') return `"${ctx.topic}" mavzusini oddiy qadamlarga bo‘lib ko‘rib chiqamiz.`
  return `Разложим тему «${ctx.topic}» на простые шаги и пройдём их по порядку.`
}

function reengageBody(lang: AssistantLang): string {
  if (lang === 'en') return 'Look back at the screen — I need you here to continue.'
  if (lang === 'uz') return 'Ekranga qarang — davom etish uchun diqqatingiz kerak.'
  return 'Вернитесь, пожалуйста, к экрану — продолжим, когда вы готовы.'
}

function integrityBody(lang: AssistantLang): string {
  if (lang === 'en') {
    return 'Let us keep it honest — answer from what you understand, mistakes are fine here.'
  }
  if (lang === 'uz') {
    return 'Halol ishlaymiz — o‘zingiz tushunganingizni ayting, xato bo‘lsa ham qo‘rqmang.'
  }
  return 'Давайте честно — отвечайте своими словами, ошибиться здесь абсолютно нормально.'
}

function encourageBody(lang: AssistantLang): string {
  if (lang === 'en') return 'Take a breath. You know more than you think — let us try again gently.'
  if (lang === 'uz') return 'Chuqur nafas oling. O‘zingiz o‘ylaganingizdan ko‘proq bilasiz — yana urinamiz.'
  return 'Выдохните. Вы знаете больше, чем кажется — давайте попробуем ещё раз, спокойно.'
}

function praiseAdvance(lang: AssistantLang, raise: boolean): string {
  if (lang === 'en') {
    return raise ? 'Excellent — let us take a harder one.' : 'Well done. Next question.'
  }
  if (lang === 'uz') {
    return raise ? 'Ajoyib — endi qiyinroq savol.' : 'Barakalla. Keyingi savol.'
  }
  return raise ? 'Отлично — теперь вопрос посложнее.' : 'Молодец. Следующий вопрос.'
}

/** Собрать финальную устную реплику из решения стратегии и контекста. */
export function composeTutorLine(decision: StrategyDecision, ctx: PhraseContext): string {
  const seed = seedFrom(ctx.question + decision.action + decision.tone)
  const lang = ctx.lang
  const head = opener(lang, decision.tone, seed)

  let body: string
  switch (decision.action) {
    case 'integrity_nudge':
      body = integrityBody(lang)
      break
    case 're_engage':
      body = reengageBody(lang)
      break
    case 'encourage':
      body = encourageBody(lang)
      break
    case 'give_hint':
      body = hintBody(ctx, decision.hintLevel)
      break
    case 'explain':
      body = explainBody(ctx)
      break
    case 'advance':
      body = praiseAdvance(lang, decision.difficultyDelta > 0)
      break
    case 'ask_question':
    case 'wait':
    default:
      body = ctx.question
      break
  }

  const line = decision.action === 'ask_question' ? body : `${head} ${body}`
  return withName(line.trim(), ctx.studentName)
}
