import { buildAssistantKnowledgeBlock } from './learnAssistantKnowledge'
import { buildSectionOutlineBlock } from './learnSectionKnowledge'
import { matchFaqEntry, offlineNeedsApiMessage } from './learnChemistryFaq'
import { buildRetrievedKnowledgeBlock, retrieveChemistryKnowledge } from './learnKnowledgeRetrieval'

/** Локальные ответы ИИ-учителя без внешнего API (офлайн / без ключа). */
export type LearnLocalAssistantContext = {
  locale: 'ru' | 'en' | 'uz'
  gradeId: string
  chapterId: string
  sectionId: string
  sectionTitle: string
  slideTitle: string
  slideBody: string
  mode: 'teacher' | 'helper'
  kpNumber: number
  curriculumOnly?: boolean
}

function isRu(locale: string): boolean {
  return locale !== 'en'
}

function lastUserMessage(messages: { role: string; content: string }[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === 'user') return messages[i].content.trim()
  }
  return ''
}

function matchAny(text: string, parts: string[]): boolean {
  return parts.some((p) => text.includes(p))
}

function dichromateAnswer(ru: boolean): string {
  return ru
    ? `Дихромат калия K₂Cr₂O₇ — сильный окислитель на основе хрома (+6).

Где применяют:
• кожевенное производство (дубление кожи);
• травление и печать по металлу;
• очистка лабораторной посуды от органики;
• в органической химии — окисление спиртов до альдегидов/кетонов.

Важно: соединения Cr(VI) токсичны и канцерогенны. В школьной лаборатории работают только по инструкции учителя, в перчатках и очках, с вытяжкой. Не сливать в канализацию.

Связь с темой урока: как и другие вещества, K₂Cr₂O₇ — чистое вещество (не смесь), его свойства определяют состав и строение.`
    : `Potassium dichromate K₂Cr₂O₇ is a strong chromium(VI) oxidizer used in tanning, metal etching, lab glassware cleaning, and selective organic oxidations. Cr(VI) compounds are toxic — school labs use them only under teacher supervision with PPE and ventilation.`
}

function mixturesAnswer(ctx: LearnLocalAssistantContext, ru: boolean): string {
  return ru
    ? `По параграфу «${ctx.sectionTitle}» — примеры из жизни:

• Воздух — смесь газов (≈78% N₂, ≈21% O₂, Ar, CO₂).
• Молоко — смесь воды, жиров, белков, сахаров.
• Гранит — смесь разных минералов.
• Морская вода — смесь воды и солей.

Чистое вещество — одно вещество (например, дистиллированная вода, медь, сахар). Смесь можно разделить физическими способами: фильтрация, выпаривание, магнит, дистилляция — см. §6.

Сейчас на слайде: ${ctx.slideTitle}. ${ctx.slideBody.slice(0, 200)}`
    : `For "${ctx.sectionTitle}": air, milk, granite, and seawater are mixtures; distilled water or copper wire are pure substances. Separation methods: filtration, evaporation, magnet, distillation.`
}

function speechLocale(ctx: LearnLocalAssistantContext): 'ru' | 'en' {
  return ctx.locale === 'en' ? 'en' : 'ru'
}

function knowledgeBlockReply(query: string, ctx: LearnLocalAssistantContext, ru: boolean): string | null {
  const loc = speechLocale(ctx)
  const retrieved = retrieveChemistryKnowledge(query, { maxChunks: 4, minScore: 2 })
  const block = buildRetrievedKnowledgeBlock(query, loc, 2800)
  if (!block || retrieved.chunks.length === 0) return null

  const topics = retrieved.chunks.map((c) => c.topic).join(', ')
  return ru
    ? `**${topics}**

${block}

${ctx.sectionTitle ? `Контекст урока: §${ctx.kpNumber} «${ctx.sectionTitle}».` : ''} Спросите подробнее или попросите пример / задачу.`
    : `**${topics}**

${block}

Lesson context: §${ctx.kpNumber} "${ctx.sectionTitle}". Ask for examples or practice.`
}

function explainTopic(ctx: LearnLocalAssistantContext, ru: boolean, query?: string): string {
  const q = query ?? ctx.sectionTitle
  const fromKb = knowledgeBlockReply(q, ctx, ru)
  if (fromKb) return fromKb

  const body = ctx.slideBody.slice(0, 400)
  return ru
    ? `§${ctx.kpNumber}. ${ctx.sectionTitle}

Слайд: «${ctx.slideTitle}»

${body || 'Откройте вкладку «Теория» и пройдите слайды по порядку.'}

Совет: включите 3D-модель справа и сформулируйте определение своими словами — так тема запоминается лучше.`
    : `§${ctx.kpNumber}. ${ctx.sectionTitle} — slide: "${ctx.slideTitle}". ${body}`
}

function hintMode(ctx: LearnLocalAssistantContext, ru: boolean): string {
  return ru
    ? `Режим «Помощник»: не дам готовый ответ, но подскажу ход мыслей.

1) Выпишите из § определения «чистое вещество» и «смесь».
2) Найдите в примере, сколько разных веществ (компонентов).
3) Можно ли разделить без химической реакции? Если да — это смесь.

Текущий слайд: «${ctx.slideTitle}». Задайте конкретный пример — разберём вместе.`
    : `Helper mode: list definitions, count components, check if separation is physical-only. Current slide: "${ctx.slideTitle}".`
}

function checkUnderstanding(ctx: LearnLocalAssistantContext, ru: boolean): string {
  return ru
    ? `Проверьте себя по §${ctx.kpNumber}:

1) Чем чистое вещество отличается от смеси?
2) Назовите 2 способа разделения смесей.
3) Воздух — чистое вещество или смесь? Почему?

Ответы сверьте со слайдом «${ctx.slideTitle}» и 3D-моделью. Если ошибётесь — напишите свой вариант, разберём.`
    : `Self-check: pure vs mixture, two separation methods, is air a mixture? Use slide "${ctx.slideTitle}".`
}

function mainIdea(ctx: LearnLocalAssistantContext, ru: boolean): string {
  return ru
    ? `Главное по «${ctx.sectionTitle}»:

${ctx.slideBody.slice(0, 350) || '• Чистые вещества и смеси различают по составу.\n• Смеси можно разделять физическими методами.\n• В природе чаще встречаются смеси (воздух, вода в реках).'}

Откройте слайд «Главное запомнить» и повторите вслух.`
    : `Key ideas for "${ctx.sectionTitle}": ${ctx.slideBody.slice(0, 300)}`
}

/** Сгенерировать ответ без OpenAI. */
export function generateLocalLearnReply(
  messages: { role: string; content: string }[],
  ctx: LearnLocalAssistantContext,
): string {
  const ru = isRu(ctx.locale)
  const q = lastUserMessage(messages).toLowerCase()

  if (!q) {
    return ru
      ? 'Задайте вопрос по текущему параграфу — отвечу по теме урока.'
      : 'Ask a question about the current section.'
  }

  if (ctx.mode === 'helper' && matchAny(q, ['подсказ', 'hint', 'помог', 'help', 'не понима', "don't understand"])) {
    return hintMode(ctx, ru)
  }

  if (
    matchAny(q, [
      'дихромат',
      'k2cr2o7',
      'k₂cr₂o₇',
      'dichromate',
      'хромат',
      'cr2o7',
    ])
  ) {
    return dichromateAnswer(ru)
  }

  if (
    matchAny(q, [
      'пример из жизни',
      'из жизни',
      'пример',
      'real-life',
      'daily life',
      'example from life',
    ])
  ) {
    if (matchAny(ctx.sectionTitle.toLowerCase(), ['смес', 'чист', 'mixture', 'pure'])) {
      return mixturesAnswer(ctx, ru)
    }
    return ru
      ? `Пример по теме «${ctx.sectionTitle}»: подумайте, что вокруг вас относится к этому §. ${ctx.slideBody.slice(0, 250)}`
      : `Life example for "${ctx.sectionTitle}": ${ctx.slideBody.slice(0, 250)}`
  }

  if (matchAny(q, ['объясни проще', 'explain simply', 'проще', 'simpler'])) {
    const simple = ru
      ? `Простыми словами про «${ctx.sectionTitle}»:\n\n${ctx.slideBody.slice(0, 300) || 'Чистое вещество — один компонент. Смесь — несколько, их можно разделить без новой химической реакции.'}\n\nСпросите, если нужен ещё один пример.`
      : `In simple words: ${ctx.slideBody.slice(0, 300)}`
    return simple
  }

  if (matchAny(q, ['что запомнить', 'key takeaway', 'главное'])) {
    return mainIdea(ctx, ru)
  }

  if (matchAny(q, ['проверь мой', 'check my', 'мой ответ', 'my answer'])) {
    return ru
      ? `Напишите ваш ответ в чат — сравню с темой §${ctx.kpNumber}. Пока ориентир: ${ctx.slideTitle}. ${ctx.slideBody.slice(0, 180)}`
      : `Paste your answer here — I will compare it to §${ctx.kpNumber}.`
  }

  if (matchAny(q, ['объясни', 'explain', 'расскаж', 'tell me', 'что такое', 'what is'])) {
    return explainTopic(ctx, ru, q)
  }

  if (matchAny(q, ['проверь', 'check', 'пониман', 'understand', 'тест'])) {
    return checkUnderstanding(ctx, ru)
  }

  if (matchAny(q, ['главное', 'запомнить', 'итог', 'main', 'summary', 'key'])) {
    return mainIdea(ctx, ru)
  }

  if (matchAny(q, ['смес', 'чист', 'разделен', 'фильтр', 'mixture', 'pure', 'separat'])) {
    return mixturesAnswer(ctx, ru)
  }

  if (matchAny(q, ['3d', 'модел', 'model', 'atomlab'])) {
    return ru
      ? 'Вкладка «3D» показывает модель по теме параграфа. Вращайте мышью, приближайте колёсиком. Сравните модель с текстом слайда — так легче понять строение.'
      : 'Use the 3D tab: rotate and zoom the model and compare it with the theory slide.'
  }

  if (matchAny(q, ['формул', 'уравнен', 'equation', 'formula'])) {
    return ru
      ? `Запишите формулу в рабочей зоне (вкладка «Решение»). Текущая тема: ${ctx.sectionTitle}. Если нужна конкретная формула — напишите название вещества.`
      : `Write formulas in the workspace tab. Topic: ${ctx.sectionTitle}.`
  }

  if (matchAny(q, ['связь с уроком', 'lesson link', 'тема урока', 'параграф'])) {
    return explainTopic(ctx, ru)
  }

  if (
    matchAny(q, [
      'реши задач',
      'по шагам',
      'step by step',
      'solve',
      'задач',
      'расчёт',
      'вычисли',
    ])
  ) {
    return ru
      ? `**Решение задач по шагам:**
1) Запишите условие и данные (масса, объём, n).
2) Напишите уравнение реакции и расставьте коэффициенты.
3) Переведите данные в моли: n = m/M или n = V/Vm.
4) По уравнению найдите n искомого вещества.
5) Пересчитайте в граммы/литры. Проверьте размерность.

Тема §: ${ctx.sectionTitle}. Вставьте числа из вашей задачи — разберём в режиме OpenAI или уточните условие.`
      : `Problem steps: write equation → moles → stoichiometry → convert to requested units. Topic: ${ctx.sectionTitle}.`
  }

  if (
    matchAny(q, [
      'математик',
      'истори',
      'географ',
      'физик',
      'биолог',
      'игр',
      'programming',
      'history',
    ]) &&
    !matchAny(q, ['хими', 'chem', 'реакц', 'веществ', 'молекул', 'атом', 'элемент'])
  ) {
    return ru
      ? 'Я специализируюсь на **химии**. Задайте вопрос по веществам, реакциям, расчётам, периодической таблице или лабораторной безопасности.'
      : 'I specialize in **chemistry**. Ask about substances, reactions, calculations, or lab safety.'
  }

  const faq = matchFaqEntry(q)
  if (faq) {
    return ru ? faq.ru : faq.en
  }

  const kbReply = knowledgeBlockReply(q, ctx, ru)
  if (kbReply) return kbReply

  const { block: catalogBlock } = buildAssistantKnowledgeBlock(q, ctx)
  const sectionBlock = buildSectionOutlineBlock(ctx, 1600)
  const hasCatalog =
    catalogBlock.includes('Matching compounds') || catalogBlock.includes('Relevant elements')

  if (hasCatalog) {
    return ru
      ? `По вашему вопросу в каталоге ATOMLAB:\n\n${catalogBlock}\n\nКонтекст §: ${ctx.sectionTitle}. Откройте вкладку «3D» для модели. Для сложных вопросов включите Ollama в панели учителя.`
      : `From the ATOMLAB catalog:\n\n${catalogBlock}\n\n§ context: ${ctx.sectionTitle}. Open the 3D tab for the model.`
  }

  if (sectionBlock.length > 80) {
    return ru
      ? `**${ctx.sectionTitle}** (офлайн-режим)\n\n${sectionBlock.slice(0, 900)}\n\nУточните вопрос или включите Ollama (бесплатно на ПК).`
      : `**${ctx.sectionTitle}** (offline)\n\n${sectionBlock.slice(0, 900)}`
  }

  return offlineNeedsApiMessage(ru)
}
