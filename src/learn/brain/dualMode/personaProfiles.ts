/**
 * Персоны преподавателя. При переключении режима «личность» ИИ меняется:
 * дружелюбный ментор ↔ сфокусированный строгий экзаменатор.
 */
import type { AssistantLang, TutorMode, TutorPersona } from './dualModeTypes'

export const TRAINING_PERSONA: TutorPersona = {
  mode: 'training',
  answerPolicy: 'full_answers',
  baseTone: 'warm',
  proactiveClarify: true,
  revealsSolutions: true,
  nameRu: 'Профессор-наставник',
  nameEn: 'Professor-Mentor',
  nameUz: 'Professor-murabbiy',
}

export const EXAM_PERSONA: TutorPersona = {
  mode: 'exam',
  answerPolicy: 'no_answers',
  baseTone: 'strict',
  proactiveClarify: false,
  revealsSolutions: false,
  nameRu: 'Строгий экзаменатор',
  nameEn: 'Strict Examiner',
  nameUz: 'Qattiqqo‘l imtihonchi',
}

export function personaForMode(mode: TutorMode): TutorPersona {
  return mode === 'exam' ? EXAM_PERSONA : TRAINING_PERSONA
}

/** Фраза-объявление при смене режима — задаёт новую «личность» вслух. */
export function switchAnnouncement(lang: AssistantLang, to: TutorMode): string {
  if (to === 'exam') {
    if (lang === 'en') {
      return 'Switching to exam mode. From now on I will not give answers — only questions. Think and answer yourself.'
    }
    if (lang === 'uz') {
      return 'Imtihon rejimiga o‘tamiz. Endi men javob bermayman — faqat savol beraman. O‘zingiz o‘ylab javob bering.'
    }
    return 'Переходим в режим экзамена. Теперь я не даю ответов — только вопросы. Думайте и отвечайте сами.'
  }
  if (lang === 'en') {
    return 'We are in training mode now. Ask me anything — I will explain it fully, with examples.'
  }
  if (lang === 'uz') {
    return 'Endi o‘quv rejimidamiz. Xohlagan narsangizni so‘rang — to‘liq, misollar bilan tushuntiraman.'
  }
  return 'Теперь мы в режиме обучения. Спрашивайте что угодно — объясню подробно и с примерами.'
}

/** Проактивный вопрос при замешательстве (только режим обучения). */
export function clarifyPrompt(lang: AssistantLang): string {
  const seed = Date.now()
  const ru = [
    'Тебе понятно это объяснение или зайти с другой стороны?',
    'Если что-то поплыло — скажи, разберём проще.',
    'Хочешь, я повторю короче и на примере?',
  ]
  const en = [
    'Is this explanation clear, or should I approach it from another angle?',
    'If anything feels fuzzy — say so, we will simplify.',
    'Want a shorter version with an example?',
  ]
  const uz = [
    'Bu tushuntirish tushunarlimi yoki boshqa tomondan yondashaymi?',
    'Biror narsa noaniq bo‘lsa — ayting, soddalashtiramiz.',
    'Qisqaroq va misol bilan takrorlaymi?',
  ]
  const list = lang === 'en' ? en : lang === 'uz' ? uz : ru
  return list[seed % list.length]!
}

/** Напоминание о вопросе, если ученик отвлёкся. */
export function reengagePrompt(lang: AssistantLang, mode: TutorMode): string {
  const seed = Date.now()
  if (mode === 'exam') {
    const ru = [
      'Соберитесь, пожалуйста — вопрос всё ещё ждёт вашего ответа.',
      'Экзамен идёт. Взгляд на экран — и отвечайте.',
      'Фокус: вопрос на столе. Ваш устный ответ?',
    ]
    const en = [
      'Focus, please — the question is still waiting for your answer.',
      'Exam mode. Eyes on screen — answer now.',
      'Focus: the question is waiting. Your oral answer?',
    ]
    const uz = [
      'Diqqat qiling — savol hali javobingizni kutyapti.',
      'Imtihon davom etmoqda. Ekranga qarang — javob bering.',
      'Diqqat: savol stol ustida. Og‘zaki javobingiz?',
    ]
    const list = lang === 'en' ? en : lang === 'uz' ? uz : ru
    return list[seed % list.length]!
  }
  const ru = [
    'Вы ещё со мной? Продолжим, когда будете готовы.',
    'Я здесь. Вернитесь к экрану — и пойдём дальше.',
    'Кажется, отвлеклись. Скажите «дальше», когда готовы.',
  ]
  const en = [
    'Are you still with me? We can continue whenever you are ready.',
    'I am here. Come back to the screen and we continue.',
    'Looks like a distraction. Say “next” when ready.',
  ]
  const uz = [
    'Men bilan birgamisiz? Tayyor bo‘lsangiz davom etamiz.',
    'Men shu yerdaman. Ekranga qayting — davom.',
    'Chalg‘iganga o‘xshaysiz. Tayyor bo‘lsangiz “davom” deng.',
  ]
  const list = lang === 'en' ? en : lang === 'uz' ? uz : ru
  return list[seed % list.length]!
}
