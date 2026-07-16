import { buildAssistantKnowledgeBlock } from './learnAssistantKnowledge'
import { buildSectionOutlineBlock } from './learnSectionKnowledge'
import { matchFaqEntry, offlineNeedsApiMessage } from './learnChemistryFaq'
import { retrieveChemistryKnowledge } from './learnKnowledgeRetrieval'
import { composeExpertLocalReply } from './learnExpertLocalReply'
import { synthesizeKnowledgeAnswer } from './learnConversationalSynthesis'
import { isAssistantRu, pickFaqText } from './learnAssistantLocale'
import { normalizeTeacherReplyText, paragraphLabel } from './learnTeacherTextNormalize'
import type { LearnTaskCoachContext } from './learnTaskCoachTypes'

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
  /** Режим сократического коуча по задаче — без выдачи ответа */
  taskCoach?: LearnTaskCoachContext
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

function dichromateAnswer(locale: LearnLocalAssistantContext['locale']): string {
  if (locale === 'uz') {
    return `Kaliy dixromat K₂Cr₂O₇ — xrom (+6) asosidagi kuchli oksidlovchi.

Qayerda ishlatiladi: charm ishlab chiqarish, metallarni ishlash, laboratoriya idishlarini tozalash, organik sintezda.

Muhim: Cr(VI) birikmalari zaharli. Maktab laboratoriyasida faqat o‘qituvchi ko‘rsatmasiga binoan, himoya vositalari bilan.`
  }
  if (locale === 'en') {
    return `Potassium dichromate K₂Cr₂O₇ is a strong chromium(VI) oxidizer used in tanning, metal etching, lab glassware cleaning, and selective organic oxidations. Cr(VI) compounds are toxic — school labs use them only under teacher supervision with PPE and ventilation.`
  }
  return `Дихромат калия K₂Cr₂O₇ — сильный окислитель на основе хрома (+6).

Где применяют:
• кожевенное производство (дубление кожи);
• травление и печать по металлу;
• очистка лабораторной посуды от органики;
• в органической химии — окисление спиртов до альдегидов/кетонов.

Важно: соединения Cr(VI) токсичны и канцерогенны. В школьной лаборатории работают только по инструкции учителя, в перчатках и очках, с вытяжкой. Не сливать в канализацию.

Связь с темой урока: как и другие вещества, K₂Cr₂O₇ — чистое вещество (не смесь), его свойства определяют состав и строение.`
}

function mixturesAnswer(ctx: LearnLocalAssistantContext): string {
  const locale = ctx.locale
  if (locale === 'uz') {
    return `«${ctx.sectionTitle}» paragrafi — hayotdan misollar:

• Havo — gazlar aralashmasi (≈78% N₂, ≈21% O₂).
• Sut — suv, yog‘, oqsil, shakar aralashmasi.
• Granit — turli minerallar aralashmasi.
• Dengiz suvi — suv va tuzlar aralashmasi.

Sof modda — bitta modda (masalan, distillangan suv, mis). Aralashmani fizik usullar bilan ajratish mumkin.

Hozirgi slayd: ${ctx.slideTitle}. ${ctx.slideBody.slice(0, 200)}`
  }
  if (locale === 'en') {
    return `For "${ctx.sectionTitle}": air, milk, granite, and seawater are mixtures; distilled water or copper wire are pure substances. Separation methods: filtration, evaporation, magnet, distillation.`
  }
  return `По параграфу «${ctx.sectionTitle}» — примеры из жизни:

• Воздух — смесь газов (≈78% N₂, ≈21% O₂, Ar, CO₂).
• Молоко — смесь воды, жиров, белков, сахаров.
• Гранит — смесь разных минералов.
• Морская вода — смесь воды и солей.

Чистое вещество — одно вещество (например, дистиллированная вода, медь, сахар). Смесь можно разделить физическими способами: фильтрация, выпаривание, магнит, дистилляция — см. параграф 6.

Сейчас на слайде: ${ctx.slideTitle}. ${ctx.slideBody.slice(0, 200)}`
}

function knowledgeBlockReply(
  query: string,
  ctx: LearnLocalAssistantContext,
  messages: { role: string; content: string }[] = [],
): string | null {
  const faq = matchFaqEntry(query)
  const wantsFull =
    /полност|подроб|по учебник|по книг|из книг|объясни|расскаж|что такое|что нибудь|что-нибудь|explain|tell me about|tushuntir|gapir/i.test(
      query,
    )

  const retrieved = retrieveChemistryKnowledge(query, {
    maxChunks: wantsFull ? 10 : 6,
    minScore: 1,
    gradeId: ctx.gradeId,
    sectionTitle: ctx.sectionTitle,
    chapterId: ctx.chapterId,
    sectionId: ctx.sectionId,
  })
  if (!faq && retrieved.chunks.length === 0) return null

  return synthesizeKnowledgeAnswer(query, retrieved.chunks, faq, ctx, messages)
}

function explainTopic(
  ctx: LearnLocalAssistantContext,
  query?: string,
  messages: { role: string; content: string }[] = [],
): string {
  const q = query ?? ctx.sectionTitle
  const fromKb = knowledgeBlockReply(q, ctx, messages)
  if (fromKb) return fromKb

  const body = ctx.slideBody.slice(0, 400)
  const para = paragraphLabel(ctx.locale, ctx.kpNumber)
  if (ctx.locale === 'uz') {
    return `${para}. ${ctx.sectionTitle}

Slayd: «${ctx.slideTitle}»

${body || '«Nazariya» yorlig‘ini oching va slaydlarni ketma-ket o‘qing.'}

Maslahat: o‘ngdagi 3D modelni yoqing va ta’rifni o‘z so‘zingiz bilan ayting.`
  }
  if (ctx.locale === 'en') {
    return `${para}. ${ctx.sectionTitle} — slide: "${ctx.slideTitle}". ${body}`
  }
  return `${para}. ${ctx.sectionTitle}

Слайд: «${ctx.slideTitle}»

${body || 'Откройте вкладку «Теория» и пройдите слайды по порядку.'}

Совет: включите 3D-модель справа и сформулируйте определение своими словами — так тема запоминается лучше.`
}

function hintMode(ctx: LearnLocalAssistantContext): string {
  if (ctx.locale === 'uz') {
    return `«Yordamchi» rejimi: tayyor javob bermayman, lekin fikrlash yo‘lini ko‘rsataman.

1) Paragrafdan «sof modda» va «aralashma» ta’riflarini yozing.
2) Misolda nechta turli modda borligini toping.
3) Kimyoviy reaksiyasiz ajratish mumkinmi? Ha bo‘lsa — bu aralashma.

Hozirgi slayd: «${ctx.slideTitle}». Aniq misol yozing — birga ko‘rib chiqamiz.`
  }
  if (ctx.locale === 'en') {
    return `Helper mode: list definitions, count components, check if separation is physical-only. Current slide: "${ctx.slideTitle}".`
  }
  return `Режим «Помощник»: не дам готовый ответ, но подскажу ход мыслей.

1) Выпишите из параграфа определения «чистое вещество» и «смесь».
2) Найдите в примере, сколько разных веществ (компонентов).
3) Можно ли разделить без химической реакции? Если да — это смесь.

Текущий слайд: «${ctx.slideTitle}». Задайте конкретный пример — разберём вместе.`
}

function checkUnderstanding(ctx: LearnLocalAssistantContext): string {
  const para = paragraphLabel(ctx.locale, ctx.kpNumber)
  if (ctx.locale === 'uz') {
    return `${para} bo‘yicha o‘zingizni tekshiring:

1) Sof modda aralashmadan qanday farq qiladi?
2) Aralashmalarni ajratishning 2 usulini ayting.
3) Havo — sof modda yoki aralashma? Nega?

Javoblarni «${ctx.slideTitle}» slaydi va 3D model bilan solishtiring.`
  }
  if (ctx.locale === 'en') {
    return `Self-check for ${para}: pure vs mixture, two separation methods, is air a mixture? Use slide "${ctx.slideTitle}".`
  }
  return `Проверьте себя по ${para}:

1) Чем чистое вещество отличается от смеси?
2) Назовите 2 способа разделения смесей.
3) Воздух — чистое вещество или смесь? Почему?

Ответы сверьте со слайдом «${ctx.slideTitle}» и 3D-моделью. Если ошибётесь — напишите свой вариант, разберём.`
}

function mainIdea(ctx: LearnLocalAssistantContext): string {
  if (ctx.locale === 'uz') {
    return `«${ctx.sectionTitle}» bo‘yicha asosiysi:

${ctx.slideBody.slice(0, 350) || '• Sof moddalar va aralashmalar tarkibi bilan farq qiladi.\n• Aralashmalarni fizik usullar bilan ajratish mumkin.\n• Tabiatda ko‘proq aralashmalar uchraydi.'}

«Eslab qoling» slaydini oching va ovoz chiqarib takrorlang.`
  }
  if (ctx.locale === 'en') {
    return `Key ideas for "${ctx.sectionTitle}": ${ctx.slideBody.slice(0, 300)}`
  }
  return `Главное по «${ctx.sectionTitle}»:

${ctx.slideBody.slice(0, 350) || '• Чистые вещества и смеси различают по составу.\n• Смеси можно разделять физическими методами.\n• В природе чаще встречаются смеси (воздух, вода в реках).'}

Откройте слайд «Главное запомнить» и повторите вслух.`
}

/** Сгенерировать ответ без OpenAI. */
export function generateLocalLearnReply(
  messages: { role: string; content: string }[],
  ctx: LearnLocalAssistantContext,
): string {
  return normalizeTeacherReplyText(generateLocalLearnReplyRaw(messages, ctx), ctx.locale)
}

function generateLocalLearnReplyRaw(
  messages: { role: string; content: string }[],
  ctx: LearnLocalAssistantContext,
): string {
  const locale = ctx.locale
  const ru = isAssistantRu(locale)
  const q = lastUserMessage(messages).toLowerCase()

  if (!q) {
    if (locale === 'uz') return 'Joriy paragraf bo‘yicha savol bering — dars mavzusiga javob beraman.'
    if (locale === 'en') return 'Ask a question about the current section.'
    return 'Задайте вопрос по текущему параграфу — отвечу по теме урока.'
  }

  if (
    ctx.mode === 'helper' &&
    matchAny(q, ['подсказ', 'hint', 'помог', 'help', 'не понима', "don't understand", 'yordam', 'tushunmadim'])
  ) {
    return hintMode(ctx)
  }

  if (
    matchAny(q, [
      'дихромат',
      'k2cr2o7',
      'k₂cr₂o₇',
      'dichromate',
      'хромат',
      'cr2o7',
      'dixromat',
    ])
  ) {
    return dichromateAnswer(locale)
  }

  if (
    matchAny(q, [
      'пример из жизни',
      'из жизни',
      'пример',
      'real-life',
      'daily life',
      'example from life',
      'hayotdan',
      'misol',
    ])
  ) {
    if (matchAny(ctx.sectionTitle.toLowerCase(), ['смес', 'чист', 'mixture', 'pure', 'aralash', 'sof'])) {
      return mixturesAnswer(ctx)
    }
    if (locale === 'uz') {
      return `«${ctx.sectionTitle}» mavzusiga misol: atrofingizda shu § ga tegishli nimalar bor? ${ctx.slideBody.slice(0, 250)}`
    }
    return ru
      ? `Пример по теме «${ctx.sectionTitle}»: подумайте, что вокруг вас относится к этому §. ${ctx.slideBody.slice(0, 250)}`
      : `Life example for "${ctx.sectionTitle}": ${ctx.slideBody.slice(0, 250)}`
  }

  if (
    matchAny(q, [
      'объясни проще',
      'explain simply',
      'проще',
      'simpler',
      'oddiyroq',
      'tushuntir',
    ])
  ) {
    if (locale === 'uz') {
      return `«${ctx.sectionTitle}» haqida oddiyroq:\n\n${ctx.slideBody.slice(0, 300) || 'Sof modda — bitta komponent. Aralashma — bir nechta, ularni yangi kimyoviy reaksiyasiz ajratish mumkin.'}\n\nYana misol kerak bo‘lsa — yozing.`
    }
    return ru
      ? `Простыми словами про «${ctx.sectionTitle}»:\n\n${ctx.slideBody.slice(0, 300) || 'Чистое вещество — один компонент. Смесь — несколько, их можно разделить без новой химической реакции.'}\n\nСпросите, если нужен ещё один пример.`
      : `In simple words: ${ctx.slideBody.slice(0, 300)}`
  }

  if (matchAny(q, ['что запомнить', 'key takeaway', 'главное', 'eslab', 'nimani eslab'])) {
    return mainIdea(ctx)
  }

  if (matchAny(q, ['проверь мой', 'check my', 'мой ответ', 'my answer', 'javobimni', 'tekshir'])) {
    if (locale === 'uz') {
      return `Javobingizni chatga yozing — ${paragraphLabel(locale, ctx.kpNumber)} mavzusi bilan solishtiraman. Hozircha mo‘ljal: ${ctx.slideTitle}.`
    }
    return ru
      ? `Напишите ваш ответ в чат — сравню с темой ${paragraphLabel(locale, ctx.kpNumber)}. Пока ориентир: ${ctx.slideTitle}. ${ctx.slideBody.slice(0, 180)}`
      : `Paste your answer here — I will compare it to ${paragraphLabel(locale, ctx.kpNumber)}.`
  }

  if (
    matchAny(q, [
      'объясни',
      'explain',
      'расскаж',
      'tell me',
      'что такое',
      'what is',
      'по книг',
      'из книг',
      'что нибудь',
      'что-нибудь',
      'интересн',
      'tushuntir',
      'gapir',
    ])
  ) {
    return explainTopic(ctx, q, messages)
  }

  if (matchAny(q, ['проверь', 'check', 'пониман', 'understand', 'тест', 'tekshir'])) {
    return checkUnderstanding(ctx)
  }

  if (matchAny(q, ['главное', 'запомнить', 'итог', 'main', 'summary', 'key', 'eslab'])) {
    return mainIdea(ctx)
  }

  if (matchAny(q, ['смес', 'чист', 'разделен', 'фильтр', 'mixture', 'pure', 'separat', 'aralash', 'sof modda'])) {
    return mixturesAnswer(ctx)
  }

  if (matchAny(q, ['3d', 'модел', 'model', 'atomlab'])) {
    if (locale === 'uz') {
      return '«3D» yorlig‘i paragraf modelini ko‘rsatadi. Sichqoncha bilan aylantiring, g‘ildirak bilan yaqinlashtiring. Modelni slayd matni bilan solishtiring.'
    }
    return ru
      ? 'Вкладка «3D» показывает модель по теме параграфа. Вращайте мышью, приближайте колёсиком. Сравните модель с текстом слайда — так легче понять строение.'
      : 'Use the 3D tab: rotate and zoom the model and compare it with the theory slide.'
  }

  if (matchAny(q, ['формул', 'уравнен', 'equation', 'formula', 'formula', 'tenglama'])) {
    if (locale === 'uz') {
      return `Formulani ishchi zonaga («Yechim» yorlig‘i) yozing. Mavzu: ${ctx.sectionTitle}. Aniq formula kerak bo‘lsa — modda nomini yozing.`
    }
    return ru
      ? `Запишите формулу в рабочей зоне (вкладка «Решение»). Текущая тема: ${ctx.sectionTitle}. Если нужна конкретная формула — напишите название вещества.`
      : `Write formulas in the workspace tab. Topic: ${ctx.sectionTitle}.`
  }

  if (
    matchAny(q, [
      'связь с уроком',
      'lesson link',
      'тема урока',
      'параграф',
      "bog'liqlik",
      'bog‘liqlik',
      'dars bilan',
    ])
  ) {
    return explainTopic(ctx, q, messages)
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
      'yech',
      'bosqichma',
    ])
  ) {
    if (locale === 'uz') {
      return `**Masalani bosqichma-bosqich yechish:**
1) Shart va ma’lumotlarni yozing (massa, hajm, n).
2) Reaksiya tenglamasini yozing va koeffitsientlarni qo‘ying.
3) Mollarga o‘tkazing: n = m/M yoki n = V/Vm.
4) Tenglama bo‘yicha kerakli modda n sini toping.
5) Gram/litrga qayta hisoblang.

§ mavzu: ${ctx.sectionTitle}. Masalangizdagi sonlarni yozing — birga yechamiz.`
    }
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
      'matematik',
      'tarix',
    ]) &&
    !matchAny(q, ['хими', 'chem', 'реакц', 'веществ', 'молекул', 'атом', 'элемент', 'kimyo', 'reaksiya'])
  ) {
    if (locale === 'uz') {
      return 'Men **kimyo** bo‘yicha ixtisoslashganman. Moddalar, reaksiyalar, hisoblar, jadval yoki laboratoriya xavfsizligi haqida so‘rang.'
    }
    return ru
      ? 'Я специализируюсь на **химии**. Задайте вопрос по веществам, реакциям, расчётам, периодической таблице или лабораторной безопасности.'
      : 'I specialize in **chemistry**. Ask about substances, reactions, calculations, or lab safety.'
  }

  const faq = matchFaqEntry(q)
  if (faq) {
    return pickFaqText(faq, locale)
  }

  const kbReply = knowledgeBlockReply(q, ctx, messages)
  if (kbReply) return kbReply

  const { block: catalogBlock } = buildAssistantKnowledgeBlock(q, ctx)
  const sectionBlock = buildSectionOutlineBlock(ctx, 1600)
  const hasCatalog =
    catalogBlock.includes('Matching compounds') || catalogBlock.includes('Relevant elements')

  if (hasCatalog) {
    if (locale === 'uz') {
      return `Savolingiz bo‘yicha ATOMLAB katalogida:\n\n${catalogBlock}\n\n§ kontekst: ${ctx.sectionTitle}. Model uchun «3D» yorlig‘ini oching.`
    }
    return ru
      ? `По вашему вопросу в каталоге ATOMLAB:\n\n${catalogBlock}\n\nКонтекст §: ${ctx.sectionTitle}. Откройте вкладку «3D» для модели.`
      : `From the ATOMLAB catalog:\n\n${catalogBlock}\n\n§ context: ${ctx.sectionTitle}. Open the 3D tab for the model.`
  }

  const expert = composeExpertLocalReply(q, ctx, messages)
  if (expert) return expert

  if (sectionBlock.length > 80 && locale === 'ru') {
    return `**${ctx.sectionTitle}** (офлайн-режим)\n\n${sectionBlock.slice(0, 900)}\n\nУточните вопрос или включите Ollama (бесплатно на ПК).`
  }

  if (sectionBlock.length > 80 && locale === 'en') {
    return `**${ctx.sectionTitle}** (offline)\n\nOpen Theory slides for this paragraph, or enable Ollama for a full English explanation.`
  }

  if (sectionBlock.length > 80 && locale === 'uz') {
    return `**${ctx.sectionTitle}** (oflayn)\n\n«Nazariya» slaydlarini oching yoki Ollama ni yoqing — to‘liq o‘zbekcha tushuntirish uchun.`
  }

  return offlineNeedsApiMessage(locale)
}
