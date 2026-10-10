/**
 * Подсказка живого учителя-учёного (ru / uz / en — по языку вопроса), устроенная ради кеша префикса Ollama:
 *   system — НЕИЗМЕННАЯ персона языка (одна и та же строка от запроса к запросу → Ollama не перечитывает её);
 *   история диалога (коротко);
 *   последнее сообщение user — всё переменное В КОНЦЕ: СПРАВОЧНИК ATOMLAB, ЗНАНИЯ (top-3 с меткой источника, ≤ ~1300 симв.),
 *   ВЫЧИСЛЕНО ТОЧНО (инструменты), УЧЕНИК (адаптация), урок и формат, затем сам вопрос.
 * Процессор этого ПК читает подсказку 7b со скоростью ~25–50 ток/с — каждые лишние 100 токенов стоят 2–4 с до первого слова.
 */
import type { Candidate } from '../pipeline/hybrid.ts'
import type { Lang } from '../pipeline/normalize.ts'
import { R1 as R1_TEXT } from '../pipeline/ownerRule.ts'
import type { ToolResult } from '../pipeline/tools.ts'

// R1 и R2 — дословно из контракта (ownerRule.ts, moderation.ts); сервер применяет их и сам, до модели.

export const PERSONA: Record<Lang, string> = {
  ru: `Ты — живой учитель химии и учёный: говоришь тепло, по-человечески, думаешь строго. Знаешь химию от школы до университета и олимпиад.
Правила:
1. Весь ответ — только на русском языке, каждое слово кириллицей; формулы — латиницей с индексами (H₂O).
2. Первая фраза — прямой ответ на вопрос. Дальше коротко: почему так (строение атома, сохранение массы и заряда, электроотрицательность, энергия, равновесие) и один пример.
3. Опирайся на справку из сообщения, но только на то, что относится к вопросу. Если справки мало — рассуждай от законов и честно оцени уверенность словами («почти наверняка», «скорее всего»). Не выдумывай точные числа, годы и авторов. Не говори «не знаю» и «нет в базе».
4. Числа и уравнения из блока «ВЫЧИСЛЕНО ТОЧНО» переписывай без изменений.
5. Если в вопросе есть мат — начни с фразы «Пожалуйста, выражайтесь корректно, использование ненормативной лексики в этом чате недопустимо.», затем ответь по сути.
6. Если спрашивают именно о разнице между органической и неорганической химией — ответь только дословно: «${R1_TEXT}»
7. Не пиши ссылки на источники — их добавит сервер. Не повторяй вопрос.`,
  uz: `Sen — tirik kimyo oʻqituvchisi va olimsan: iliq, samimiy gapirasan, qatʼiy fikrlaysan. Kimyoni maktabdan universitet va olimpiadalargacha bilasan.
Qoidalar:
1. Butun javob — faqat oʻzbek tilida, lotin yozuvida (oʻ, gʻ harflari bilan); formulalar indekslar bilan (H₂O).
2. Birinchi jumla — savolga toʻgʻridan-toʻgʻri javob. Keyin qisqa: nega shunday (atom tuzilishi, massa va zaryadning saqlanishi, elektromanfiylik, energiya, muvozanat) va bitta misol.
3. Xabardagi maʼlumotnomaga tayan, lekin faqat savolga tegishlisiga. Maʼlumot kam boʻlsa — qonunlardan mulohaza qil va ishonchni soʻz bilan ayt («deyarli aniq», «ehtimol»). Aniq sonlar, yillar, mualliflarni oʻylab topma. «Bilmayman» va «bazada yoʻq» dema.
4. «VERILGAN ANIQ HISOB» blokidagi sonlar va tenglamalarni oʻzgartirmasdan yoz.
5. Savolda soʻkinish boʻlsa — «Iltimos, odob bilan yozing, bu chatda haqoratli so‘zlar ishlatish mumkin emas.» jumlasi bilan boshla, keyin mazmunan javob ber.
6. Aynan organik va anorganik kimyo orasidagi farq soʻralsa — faqat soʻzma-soʻz javob ber: «${R1_TEXT}»
7. Manbalarga havola yozma — ularni server qoʻshadi. Savolni takrorlama.`,
  en: `You are a living chemistry teacher and scientist: you speak warmly, like a real person, and think rigorously. You know chemistry from school to university and olympiads.
Rules:
1. The whole answer is in English only, every word; formulas with subscripts (H₂O).
2. The first sentence directly answers the question. Then briefly: why (atomic structure, conservation of mass and charge, electronegativity, energy, equilibrium) and one example.
3. Rely on the reference in the message, but only on what is relevant to the question. If it is thin, reason from the laws and state your confidence in words ("almost certainly", "most likely"). Never invent exact numbers, years or authors. Never say "I don't know" or "not in my database".
4. Copy numbers and equations from the "CALCULATED EXACTLY" block unchanged.
5. If the question contains profanity, start with "Please keep it polite — profanity is not allowed in this chat." and then answer the substance.
6. If asked specifically about the difference between organic and inorganic chemistry, reply only verbatim: «${R1_TEXT}»
7. Do not write source references — the server adds them. Do not repeat the question.`,
}

const H = {
  ctx: { ru: 'УРОК', uz: 'DARS', en: 'LESSON' },
  facts: { ru: 'СПРАВОЧНИК ATOMLAB (проверено)', uz: 'ATOMLAB MAʼLUMOTNOMASI (tekshirilgan)', en: 'ATOMLAB REFERENCE (verified)' },
  know: { ru: 'ЗНАНИЯ (из учебников и энциклопедии; бери только относящееся к вопросу)', uz: 'BILIMLAR (darslik va ensiklopediyadan; faqat savolga tegishlisini ol)', en: 'KNOWLEDGE (textbooks and encyclopedia; use only what is relevant)' },
  student: { ru: 'УЧЕНИК', uz: 'OʻQUVCHI', en: 'STUDENT' },
  exact: { ru: 'ВЫЧИСЛЕНО ТОЧНО (не менять)', uz: 'VERILGAN ANIQ HISOB (oʻzgartirma)', en: 'CALCULATED EXACTLY (do not change)' },
  format: { ru: 'ФОРМАТ', uz: 'FORMAT', en: 'FORMAT' },
  question: { ru: 'ВОПРОС УЧЕНИКА', uz: 'OʻQUVCHI SAVOLI', en: 'STUDENT QUESTION' },
  reasoned: {
    ru: 'Найденного мало: начни с «Разберём от основ:» и рассуждай от законов, без выдуманных чисел.',
    uz: 'Topilgani kam: «Asoslardan boshlaymiz:» deb boshla va qonunlardan mulohaza qil, oʻylab topilgan sonlarsiz.',
    en: 'Little was found: start with “Let us reason from the basics:” and argue from the laws, with no invented numbers.',
  },
}

const FORMAT: Record<'brief' | 'more' | 'live', Record<Lang, string>> = {
  brief: { ru: '60–120 слов, по-русски.', uz: '60–120 soʻz, oʻzbekcha.', en: '60–120 words, in English.' },
  more: { ru: 'подробно, до 250 слов, по шагам, по-русски.', uz: 'batafsil, 250 soʻzgacha, bosqichma-bosqich, oʻzbekcha.', en: 'detailed, up to 250 words, step by step, in English.' },
  live: {
    ru: 'живой голос: 2–3 коротких предложения, 30–50 слов, формулы словами, по-русски.',
    uz: 'jonli ovoz: 2–3 qisqa jumla, 30–50 soʻz, formulalar soʻz bilan, oʻzbekcha.',
    en: 'live voice: 2–3 short sentences, 30–50 words, formulas spelled out, in English.',
  },
}

/** Повтор для второй попытки, если модель сорвалась на чужие символы (короткий хвост — кеш префикса цел). */
export const LANG_REMINDER: Record<Lang, string> = {
  ru: '(Отвечай строго на русском языке.)',
  uz: '(Faqat oʻzbek tilida, lotin yozuvida javob ber.)',
  en: '(Answer strictly in English.)',
}

export type PromptInput = {
  lang: Lang
  mode: 'chat' | 'live'
  detail: 'brief' | 'more'
  gradeId: string
  sectionTitle?: string
  chapterId?: string
  sectionId?: string
  knowledge: Candidate[]
  tools: ToolResult[]
  studentBlock: string
  reasoned: boolean
  /** точные справочные факты ATOMLAB (понятия, вещества, элементы) на языке вопроса */
  facts?: string[]
  /** сам вопрос (очищенный) — идёт последним */
  question: string
  /** бюджет найденного: число фрагментов и символов */
  maxItems: number
  maxChars: number
}

/** Неизменная системная часть (персона языка) — ключ кеша префикса Ollama. */
export function buildSystemPrompt(lang: Lang): string {
  return PERSONA[lang]
}

/** Отрезать по границе предложения/слова, не длиннее n. */
function clip(s: string, n: number): string {
  const t = s.replace(/\s+/g, ' ').trim()
  if (t.length <= n) return t
  const cut = t.slice(0, n)
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '))
  return (end > n * 0.5 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, '')) + (end > n * 0.5 ? '' : '…')
}

/** Переменная часть: справка, знания, расчёт, ученик, урок, формат и вопрос — последним сообщением user. */
export function buildUserTurn(p: PromptInput): string {
  const L = p.lang
  const parts: string[] = []
  let budget = p.maxChars
  if (p.facts?.length) {
    const lines = p.facts.slice(0, 2).map((f) => `• ${clip(f, Math.min(320, Math.floor(p.maxChars / 2)))}`)
    budget -= lines.join('\n').length
    parts.push(`${H.facts[L]}:\n${lines.join('\n')}`)
  }
  if (p.knowledge.length && budget > 150) {
    const lines: string[] = []
    for (const k of p.knowledge.slice(0, p.maxItems)) {
      if (budget < 150) break
      const per = Math.min(budget, Math.max(220, Math.floor(p.maxChars / Math.max(1, Math.min(p.maxItems, p.knowledge.length)))))
      const line = `[${lines.length + 1}] ${k.title.replace(/\s+/g, ' ').slice(0, 80)}: ${clip(k.text, per)}`
      lines.push(line)
      budget -= line.length
    }
    if (lines.length) parts.push(`${H.know[L]}:\n${lines.join('\n')}`)
  }
  if (p.tools.length) parts.push(`${H.exact[L]}:\n${p.tools.map((t) => t.text).join('\n')}`)
  if (p.reasoned) parts.push(H.reasoned[L])
  if (p.studentBlock) parts.push(`${H.student[L]}:\n${p.studentBlock}`)
  const ctx = [
    p.gradeId ? `${L === 'ru' ? 'класс' : L === 'uz' ? 'sinf' : 'grade'} ${p.gradeId.replace('g', '')}` : '',
    p.sectionTitle ? `${L === 'ru' ? 'тема' : L === 'uz' ? 'mavzu' : 'topic'}: ${p.sectionTitle.slice(0, 120)}` : '',
  ].filter(Boolean)
  if (ctx.length) parts.push(`${H.ctx[L]}:\n${ctx.join('; ')}`)
  parts.push(`${H.format[L]}:\n${FORMAT[p.mode === 'live' ? 'live' : p.detail][L]}`)
  parts.push(`${H.question[L]}:\n${p.question}`)
  return parts.join('\n\n')
}

/** Вопрос из последнего сообщения user, собранного buildUserTurn (для mock и журнала). */
export function questionOf(userTurn: string): string {
  const m = userTurn.match(/\n?(?:ВОПРОС УЧЕНИКА|OʻQUVCHI SAVOLI|STUDENT QUESTION):\n([\s\S]*)$/)
  return (m ? m[1]! : userTurn).trim()
}

/** Короткий промпт для классификации спорного намерения (быстрая модель). */
export const CLASSIFY_PROMPT =
  'Classify the student message into exactly one label: smalltalk, chemistry, calc, homework, offtopic. calc = needs a numeric/equation calculation; homework = asks to check a solution; offtopic = not about chemistry or science. Answer with the label only.'

export function translatePrompt(lang: Lang): string {
  return lang === 'ru'
    ? 'Переведи текст на русский язык. Сохрани формулы, числа и уравнения без изменений. Выведи только перевод.'
    : lang === 'uz'
      ? 'Matnni oʻzbek tiliga (lotin yozuvi, oʻ va gʻ harflari bilan) tarjima qil. Formulalar, sonlar va tenglamalarni oʻzgartirma. Faqat tarjimani chiqar.'
      : 'Translate the text into English. Keep formulas, numbers and equations unchanged. Output only the translation.'
}
