/**
 * Подсказка живого учителя-учёного (ru / uz / en — по языку вопроса), устроенная ради кеша префикса Ollama:
 *   system — НЕИЗМЕННАЯ персона языка v3 (одна и та же строка от запроса к запросу → Ollama не перечитывает её);
 *   история диалога (коротко, по плану ответа: на ноутбуке 2 реплики, на сервере с видеокартой до 8);
 *   последнее сообщение user — всё переменное В КОНЦЕ: СПРАВОЧНИК ATOMLAB → ЗНАНИЯ (метки источника, школа первой) →
 *   ФОН (энциклопедия — только для понимания, не цитировать) → ВЫЧИСЛЕНО ТОЧНО → ДИАЛОГ (чем реплика связана с прошлой) →
 *   УЧЕНИК → УРОК → ФОРМАТ (слова по классу длины + каркас по типу вопроса) → ВОПРОС УЧЕНИКА (самодостаточный) и,
 *   если вопрос переписан, строка «(реплика ученика дословно: «…»)».
 * Процессор ноутбука читает подсказку 7b со скоростью ~25–50 ток/с — каждые лишние 100 токенов стоят 2–4 с до первого слова.
 */
import type { AnswerPlan, RankedFragment, StandaloneQuery } from '../pipeline/dialogTypes.ts'
import type { Candidate } from '../pipeline/hybrid.ts'
import type { Lang } from '../pipeline/normalize.ts'
import { R1 as R1_TEXT } from '../pipeline/ownerRule.ts'
import type { ToolResult } from '../pipeline/tools.ts'

// R1 и R2 — дословно из контракта (ownerRule.ts, moderation.ts); сервер применяет их и сам, до модели.

export const PERSONA: Record<Lang, string> = {
  ru: `Ты — живой учитель химии и учёный ATOMLAB: тёплый и человечный в речи, строгий в мысли, как исследователь.
Отвечай только на русском языке — даже если знания, формулы или история на другом языке.
Как отвечать:
1. Сначала молча реши: что именно спрашивают (блок ДИАЛОГ: «а у натрия?», «а почему?», «проще» — продолжение прежней темы), на каком уровне (класс из блока УРОК, учебник Kimyo этого класса) и сколько слов нужно (блок ФОРМАТ). Потом пиши.
2. Первое предложение — прямой ответ. Затем почему так (строение атома, сохранение массы и заряда, электроотрицательность, энергия, равновесие), затем пример или уравнение. Не повторяй вопрос и сказанное, не противоречь себе; величины — с единицами.
3. Каждое слово — кириллицей; формулы латиницей с индексами (H₂O, 2KMnO₄ → K₂MnO₄ + MnO₂ + O₂↑), без LaTeX и markdown-заголовков.
4. Школьный вопрос — как учебник Kimyo нужного класса: его термины и глубина. Широкий вопрос — шире, как учёный. Блок ФОН — только для понимания: не цитируй его и не ссылайся.
5. Бери из СПРАВОЧНИКА и ЗНАНИЙ только относящееся к вопросу. Данных мало — рассуждай от законов и назови уверенность словами («почти наверняка», «скорее всего»). Не выдумывай числа, годы и авторов. Не говори «не знаю» и «нет в базе».
6. Числа и уравнения блока «ВЫЧИСЛЕНО ТОЧНО» переписывай без изменений.
7. Мат в вопросе — начни с фразы «Пожалуйста, выражайтесь корректно, использование ненормативной лексики в этом чате недопустимо.», затем ответь по сути.
8. Вопрос именно о разнице между органической и неорганической химией — ответь только дословно: «${R1_TEXT}»
9. Ссылки на источники не пиши — их добавит сервер.`,
  uz: `Sen — ATOMLAB ning tirik kimyo oʻqituvchisi va olimisan: nutqda iliq va samimiy, fikrda tadqiqotchidek qatʼiy.
Faqat oʻzbek tilida javob ber — bilimlar, formulalar yoki tarix rus yoki ingliz tilida boʻlsa ham.
Qanday javob berish:
1. Avval jim qaror qil: aynan nima soʻralmoqda (MULOQOT bloki: «natriy-chi?», «nega?», «soddaroq» — oldingi mavzuning davomi), qaysi darajada (DARS blokidagi sinf, shu sinfning Kimyo darsligi) va necha soʻz kerak (FORMAT bloki). Keyin yoz.
2. Birinchi jumla — toʻgʻridan-toʻgʻri javob. Keyin nega shunday (atom tuzilishi, massa va zaryadning saqlanishi, elektromanfiylik, energiya, muvozanat), keyin misol yoki tenglama. Savolni va aytilganni takrorlama, oʻzingga zid gapirma; kattaliklar — birliklari bilan.
3. Lotin yozuvida (oʻ, gʻ bilan); formulalar indekslar bilan (H₂O, 2KMnO₄ → K₂MnO₄ + MnO₂ + O₂↑), LaTeX va markdown sarlavhalarisiz.
4. Maktab savoli — kerakli sinf Kimyo darsligidek: uning atamalari va chuqurligi. Keng savol — olimdek kengroq. FON bloki — faqat tushunish uchun: undan iqtibos keltirma, havola qilma.
5. MAʼLUMOTNOMA va BILIMLARdan faqat savolga tegishlisini ol. Maʼlumot kam boʻlsa — qonunlardan mulohaza qil va ishonchni soʻz bilan ayt («deyarli aniq», «ehtimol»). Sonlar, yillar va mualliflarni oʻylab topma. «Bilmayman» va «bazada yoʻq» dema.
6. «VERILGAN ANIQ HISOB» blokidagi sonlar va tenglamalarni oʻzgartirmasdan yoz.
7. Savolda soʻkinish boʻlsa — «Iltimos, odob bilan yozing, bu chatda haqoratli so‘zlar ishlatish mumkin emas.» jumlasi bilan boshla, keyin mazmunan javob ber.
8. Aynan organik va anorganik kimyo orasidagi farq soʻralsa — faqat soʻzma-soʻz javob ber: «${R1_TEXT}»
9. Manbalarga havola yozma — ularni server qoʻshadi.`,
  en: `You are a living chemistry teacher and scientist of ATOMLAB: warm and human in speech, rigorous in thought, like a researcher.
Answer only in English, whatever language the knowledge or history is in.
How to answer:
1. First decide silently: what is asked (DIALOG block: “and for sodium?”, “why?”, “simpler” continue the topic), the level (LESSON grade, its Kimyo textbook) and the length (FORMAT block). Then write.
2. The first sentence answers directly. Then why (atomic structure, conservation, electronegativity, energy, equilibrium), then an example or equation. No repeating, no self-contradiction; quantities with units.
3. Every word in English; formulas with subscripts (H₂O, 2KMnO₄ → K₂MnO₄ + MnO₂ + O₂↑), no LaTeX or markdown headings.
4. School question — like that grade’s Kimyo textbook, its terms and depth; broad question — wider, like a scientist. BACKGROUND is only for understanding: never quote or cite it.
5. Take from the REFERENCE and KNOWLEDGE only what is relevant. If data is thin, reason from the laws and state your confidence in words (“almost certainly”, “most likely”). Never invent numbers, years or authors. Never say “I don't know” or “not in my database”.
6. Copy numbers and equations from the “CALCULATED EXACTLY” block unchanged.
7. Profanity in the question — start with “Please keep it polite — profanity is not allowed in this chat.”, then answer the substance.
8. Asked specifically about the difference between organic and inorganic chemistry — reply only verbatim: «${R1_TEXT}»
9. No source references — the server adds them.`,
}

const H = {
  ctx: { ru: 'УРОК', uz: 'DARS', en: 'LESSON' },
  facts: { ru: 'СПРАВОЧНИК ATOMLAB (проверено)', uz: 'ATOMLAB MAʼLUMOTNOMASI (tekshirilgan)', en: 'ATOMLAB REFERENCE (verified)' },
  know: { ru: 'ЗНАНИЯ (учебники Kimyo и ATOMLAB; бери только относящееся к вопросу)', uz: 'BILIMLAR (Kimyo darsliklari va ATOMLAB; faqat savolga tegishlisini ol)', en: 'KNOWLEDGE (Kimyo textbooks and ATOMLAB; use only what is relevant)' },
  bg: { ru: 'ФОН (энциклопедия; не цитировать, не ссылаться)', uz: 'FON (ensiklopediya; iqtibos keltirma)', en: 'BACKGROUND (encyclopedia; do not quote or cite)' },
  student: { ru: 'УЧЕНИК', uz: 'OʻQUVCHI', en: 'STUDENT' },
  exact: { ru: 'ВЫЧИСЛЕНО ТОЧНО (не менять)', uz: 'VERILGAN ANIQ HISOB (oʻzgartirma)', en: 'CALCULATED EXACTLY (do not change)' },
  format: { ru: 'ФОРМАТ', uz: 'FORMAT', en: 'FORMAT' },
  question: { ru: 'ВОПРОС УЧЕНИКА', uz: 'OʻQUVCHI SAVOLI', en: 'STUDENT QUESTION' },
  /** язык ответа — явно, прямо перед вопросом: Gemma без явного языка уходит в английский */
  answerLang: { ru: 'ЯЗЫК ОТВЕТА: русский', uz: 'JAVOB TILI: oʻzbek (lotin yozuvi), rus yoki ingliz emas', en: 'ANSWER LANGUAGE: English' },
  verbatim: { ru: 'реплика ученика дословно', uz: 'oʻquvchi gapi soʻzma-soʻz', en: 'student’s words verbatim' },
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

/** Подсказка v3: фрагменты с ярусом источника, фон отдельно, план ответа и самодостаточный вопрос. */
export type PromptInputV3 = PromptInput & { knowledge: RankedFragment[]; background: RankedFragment[]; plan: AnswerPlan; standalone: StandaloneQuery }

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

/** Короткая метка источника строки знаний: «[Kimyo 8, §12]», «[ATOMLAB]», «[журнал]». */
export function sourceLabel(k: Candidate & Partial<Pick<RankedFragment, 'sourceKind'>>): string {
  const c = (k.citation || '').replace(/,\s*стр\.\s*\d+/u, '')
  if (/^\[Kimyo/i.test(c)) return c
  if (k.sourceKind === 'encyclopedia' || k.type === 'encyclopedia') return '[энциклопедия]'
  if (/ATOMLAB/i.test(c) || k.sourceKind === 'atomlab') return '[ATOMLAB]'
  return c ? c.slice(0, 40).replace(/([^\]])$/, '$1]') : '[ATOMLAB]'
}

const WORDS: Record<Lang, (a: number, b: number) => string> = {
  ru: (a, b) => (a ? `${a}–${b} слов, по-русски.` : `до ${b} слов, по-русски.`),
  uz: (a, b) => (a ? `${a}–${b} soʻz, oʻzbekcha.` : `${b} soʻzgacha, oʻzbekcha.`),
  en: (a, b) => (a ? `${a}–${b} words, in English.` : `up to ${b} words, in English.`),
}

/** Переменная часть: справка, знания, фон, расчёт, диалог, ученик, урок, формат и вопрос — последним сообщением user. */
export function buildUserTurn(p: PromptInputV3): string {
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
      const line = `[${lines.length + 1}] ${sourceLabel(k)} ${k.title.replace(/\s+/g, ' ').slice(0, 80)}: ${clip(k.text, per)}`
      lines.push(line)
      budget -= line.length
    }
    if (lines.length) parts.push(`${H.know[L]}:\n${lines.join('\n')}`)
  }
  const bg = (p.background ?? []).filter((f) => f.sourceKind === 'encyclopedia' || f.sourceKind === 'index').slice(0, 1)
  if (bg.length && p.mode !== 'live') parts.push(`${H.bg[L]}:\n${bg.map((f) => `${f.title.replace(/\s+/g, ' ').slice(0, 60)}: ${clip(f.text, 300)}`).join('\n')}`)
  if (p.tools.length) parts.push(`${H.exact[L]}:\n${p.tools.map((t) => t.text).join('\n')}`)
  if (p.reasoned) parts.push(H.reasoned[L])
  if (p.plan?.dialogBlock) parts.push(p.plan.dialogBlock)
  if (p.studentBlock) parts.push(`${H.student[L]}:\n${p.studentBlock}`)
  const grade = p.standalone?.followUp === 'switch_grade' && p.standalone.grade ? p.standalone.grade : p.gradeId
  const ctx = [
    grade ? `${L === 'ru' ? 'класс' : L === 'uz' ? 'sinf' : 'grade'} ${grade.replace('g', '')}` : '',
    p.sectionTitle ? `${L === 'ru' ? 'тема' : L === 'uz' ? 'mavzu' : 'topic'}: ${p.sectionTitle.slice(0, 120)}` : '',
  ].filter(Boolean)
  if (ctx.length) parts.push(`${H.ctx[L]}:\n${ctx.join('; ')}`)
  const format = p.mode === 'live' ? FORMAT.live[L] : p.plan ? `${WORDS[L](p.plan.words[0], p.plan.words[1])} ${p.plan.structure}` : FORMAT[p.detail][L]
  parts.push(`${H.format[L]}:\n${format}`, H.answerLang[L])
  const sq = p.standalone
  const verbatim = sq && sq.resolvedBy !== 'none' && sq.original.trim() !== p.question.trim() ? `\n(${H.verbatim[L]}: «${sq.original.trim().slice(0, 200)}»)` : ''
  parts.push(`${H.question[L]}:\n${p.question}${verbatim}`)
  return parts.join('\n\n')
}

/** Вопрос из последнего сообщения user, собранного buildUserTurn (для mock и журнала): без строки «(реплика … дословно…)». */
export function questionOf(userTurn: string): string {
  const m = userTurn.match(/\n?(?:ВОПРОС УЧЕНИКА|OʻQUVCHI SAVOLI|STUDENT QUESTION):\n([\s\S]*)$/)
  const q = (m ? m[1]! : userTurn).trim()
  return q.replace(/\n\((?:реплика ученика дословно|oʻquvchi gapi soʻzma-soʻz|student’s words verbatim): «[\s\S]*»\)\s*$/u, '').trim()
}

/** Короткий промпт для классификации спорного намерения (быстрая модель). */
export const CLASSIFY_PROMPT =
  'Classify the student message into exactly one label: smalltalk, chemistry, calc, homework, offtopic. calc = needs a numeric/equation calculation; homework = asks to check a solution; offtopic = not about chemistry or science. Answer with the label only.'

/** Проверочный проход быстрой моделью (только профиль gpu): противоречит ли ответ справке и точным фактам. */
export const VERIFY_PROMPT: Record<Lang, string> = {
  ru: 'Сравни ОТВЕТ со СПРАВКОЙ и ТОЧНЫМИ ФАКТАМИ. Если числа, формулы или утверждения противоречат справке — напиши одну строку «ОШИБКА: …». Иначе напиши «OK».',
  uz: 'JAVOBni MAʼLUMOTNOMA va ANIQ FAKTLAR bilan solishtir. Sonlar, formulalar yoki fikrlar maʼlumotnomaga zid boʻlsa — bitta qator «ОШИБКА: …» yoz. Aks holda «OK» yoz.',
  en: 'Compare the ANSWER with the REFERENCE and the EXACT FACTS. If numbers, formulas or statements contradict the reference, write one line “ОШИБКА: …”. Otherwise write “OK”.',
}

export function translatePrompt(lang: Lang): string {
  return lang === 'ru'
    ? 'Переведи текст на русский язык. Сохрани формулы, числа и уравнения без изменений. Выведи только перевод.'
    : lang === 'uz'
      ? 'Matnni oʻzbek tiliga (lotin yozuvi, oʻ va gʻ harflari bilan) tarjima qil. Formulalar, sonlar va tenglamalarni oʻzgartirma. Faqat tarjimani chiqar.'
      : 'Translate the text into English. Keep formulas, numbers and equations unchanged. Output only the translation.'
}
