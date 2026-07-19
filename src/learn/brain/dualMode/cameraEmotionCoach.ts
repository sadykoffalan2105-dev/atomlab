/**
 * Живые реплики учителя в ответ на эмоции с камеры —
 * как внимательный человек, а не один и тот же шаблон.
 */
import type { EmotionState } from '../brainTypes'
import type { AssistantLang, TutorMode } from './dualModeTypes'

function pick(lines: readonly string[], seed: number): string {
  return lines[Math.abs(seed) % lines.length]!
}

const CLARIFY: Record<AssistantLang, readonly string[]> = {
  ru: [
    'Смотри, если что-то поплыло — скажи, я зайду с другой стороны.',
    'Тебе сейчас понятно или лучше разобрать на простом примере?',
    'Я вижу, что мысль застряла. Давай вместе найдём, где именно.',
    'Нормально не сразу понять. Хочешь, объясню короче и по-другому?',
  ],
  en: [
    'If something feels fuzzy, say so — I will try another angle.',
    'Is this clear, or should we take a simpler example?',
    'Looks like the idea stuck. Let us find where together.',
    'It is fine not to get it instantly. Want a shorter version?',
  ],
  uz: [
    'Biror narsa noaniq bo‘lsa — ayting, boshqa tomondan tushuntiraman.',
    'Hozir tushunarlimi yoki oddiyroq misol kerakmi?',
    'Fikr qotib qolganga o‘xshaydi. Keling, birga topamiz.',
    'Darhol tushunmaslik oddiy. Qisqaroq qilib aytaymi?',
  ],
}

const FRUSTRATED: Record<AssistantLang, readonly string[]> = {
  ru: [
    'Стоп, выдохни. Это сложно, но мы разложим по полочкам — без спешки.',
    'Чувствую напряжение. Давай упростим: одна мысль, один шаг.',
    'Не ругай себя. Ошибка — часть обучения. Сейчас мягко продолжим.',
  ],
  en: [
    'Pause and breathe. It is hard, but we will break it into small steps.',
    'I sense tension. Let us simplify: one idea, one step.',
    'Do not blame yourself. Mistakes are part of learning. Softly onward.',
  ],
  uz: [
    'To‘xtang, nafas oling. Qiyin, lekin bosqichma-bosqich yechamiz.',
    'Zo‘riqish seziladi. Oddiylashtiramiz: bitta fikr, bitta qadam.',
    'O‘zingizni ayblamang. Xato — o‘qishning qismi. Sekin davom.',
  ],
}

const BORED: Record<AssistantLang, readonly string[]> = {
  ru: [
    'Кажется, скучновато. Давай оживим: маленький вызов — ответь одним предложением.',
    'Подкрутим темп. Скажи сам: что здесь самое неожиданное?',
    'Хватит теории на минуту — придумай пример из жизни за пять секунд.',
  ],
  en: [
    'Looks a bit dull. Quick challenge: answer in one sentence.',
    'Let us spice it up — what is the most surprising part here?',
    'Pause the theory: give a real-life example in five seconds.',
  ],
  uz: [
    'Biroz zerikarli tuyuladi. Tez vazifa: bitta gapda javob bering.',
    'Sur’atni oshiramiz — eng kutilmagan narsa nima?',
    'Nazariyani to‘xtatamiz: hayotdan misol, besh soniyada.',
  ],
}

const TIRED: Record<AssistantLang, readonly string[]> = {
  ru: [
    'Похоже, ты устал. Сделаем коротко: три ключа — и можно передохнуть вопросом.',
    'Энергии мало — я упрощаю. Скажи только главное своими словами.',
    'Не будем грузить. Одна ясная мысль, потом пауза.',
  ],
  en: [
    'You look tired. Short mode: three keys, then an easy check.',
    'Low energy — I will simplify. Say only the main idea.',
    'No overload. One clear thought, then a pause.',
  ],
  uz: [
    'Charchaganga o‘xshaysiz. Qisqa: uchta kalit, keyin oson savol.',
    'Energiya kam — soddalashtiraman. Faqat asosiyni ayting.',
    'Yuklamaymiz. Bitta aniq fikr, keyin pauza.',
  ],
}

const CURIOUS: Record<AssistantLang, readonly string[]> = {
  ru: [
    'О, вижу интерес — давай копнём чуть глубже, раз уж зацепило.',
    'Любопытство — лучший момент для «почему». Сейчас раскрою механизм.',
    'Раз глаза горят — добавлю неочевидную деталь, которая обычно нравится.',
  ],
  en: [
    'I see curiosity — let us go a bit deeper while it sticks.',
    'Curiosity is the best moment for “why”. Here is the mechanism.',
    'Since you lean in — one non-obvious detail students love.',
  ],
  uz: [
    'Qiziqish seziladi — chuqurroq kiramiz, hozir “yopishib” turibdi.',
    'Qiziqish — “nima uchun” uchun eng yaxshi payt. Mexanizmni ochaman.',
    'Qiziqqaningiz uchun — odatda yoqadigan yashirin detal.',
  ],
}

const CONFIDENT: Record<AssistantLang, readonly string[]> = {
  ru: [
    'Вижу уверенность — отлично. Тогда чуть сложнее, проверим на прочность.',
    'Идёшь уверенно. Держи вопрос на шаг выше.',
    'Хороший темп. Сам сформулируй правило одной фразой.',
  ],
  en: [
    'You look confident — great. A slightly harder check then.',
    'Steady and sure. Here is a step-up question.',
    'Nice pace. State the rule in one sentence yourself.',
  ],
  uz: [
    'Ishonch seziladi — zo‘r. Endi biroz qiyinroq tekshiramiz.',
    'Ishonchli ketyapsiz. Bir pog‘ona yuqori savol.',
    'Yaxshi sur’at. Qoidani bitta gapda ayting.',
  ],
}

const REENGAGE_TRAIN: Record<AssistantLang, readonly string[]> = {
  ru: [
    'Эй, я здесь. Вернись к экрану — продолжим, как только будешь рядом.',
    'Потерял тебя взглядом. Когда готов — кивни вопросом или скажи «дальше».',
    'Кажется, отвлёкся. Я подожду, но тема важная — давай соберёмся.',
  ],
  en: [
    'Hey, I am here. Come back to the screen and we continue.',
    'I lost your gaze. When ready, ask or say “next”.',
    'Looks like a distraction. I will wait — this topic matters.',
  ],
  uz: [
    'Men shu yerdaman. Ekranga qayting — yonma-yon davom etamiz.',
    'Nigohingiz yo‘qoldi. Tayyor bo‘lsangiz — “davom” deng.',
    'Chalg‘iganga o‘xshaysiz. Kutaman, lekin mavzu muhim.',
  ],
}

const REENGAGE_EXAM: Record<AssistantLang, readonly string[]> = {
  ru: [
    'Соберитесь: вопрос всё ещё на столе. Ответьте своими словами.',
    'Экзамен идёт. Взгляд на экран — и продолжаем ответ.',
    'Фокус, пожалуйста. Я жду ваш устный ответ по теме.',
  ],
  en: [
    'Focus: the question is still waiting. Answer in your own words.',
    'Exam mode. Eyes on screen — continue your answer.',
    'Please focus. I am waiting for your oral answer.',
  ],
  uz: [
    'Diqqat: savol hali stol ustida. O‘z so‘zingiz bilan javob bering.',
    'Imtihon davom etmoqda. Ekranga qarang — javobni davom eting.',
    'Iltimos, diqqat. Og‘zaki javobingizni kutaman.',
  ],
}

export function emotionReactiveLine(
  lang: AssistantLang,
  emotion: EmotionState,
  seed = Date.now(),
): string | null {
  switch (emotion) {
    case 'confused':
      return pick(CLARIFY[lang], seed)
    case 'frustrated':
      return pick(FRUSTRATED[lang], seed)
    case 'bored':
      return pick(BORED[lang], seed)
    case 'tired':
      return pick(TIRED[lang], seed)
    case 'curious':
      return pick(CURIOUS[lang], seed)
    case 'confident':
      return pick(CONFIDENT[lang], seed)
    default:
      return null
  }
}

export function reengageReactiveLine(lang: AssistantLang, mode: TutorMode, seed = Date.now()): string {
  const table = mode === 'exam' ? REENGAGE_EXAM : REENGAGE_TRAIN
  return pick(table[lang], seed)
}

/** Подсказка для LLM: как говорить с учётом камеры. */
export function emotionPromptHint(lang: AssistantLang, emotion: EmotionState): string {
  if (lang === 'en') {
    const map: Record<EmotionState, string> = {
      neutral: 'Student looks calm — natural conversational pace.',
      confused: 'Student looks confused — simplify, shorter sentences, one idea at a time.',
      frustrated: 'Student looks tense — warm tone, encourage, lower difficulty.',
      confident: 'Student looks confident — can go slightly deeper or ask a sharper question.',
      bored: 'Student looks bored — livelier hook, shorter answer, curiosity spark.',
      curious: 'Student looks curious — lean into “why” and mechanism.',
      tired: 'Student looks tired — ultra-short, gentle, no overload.',
    }
    return map[emotion]
  }
  if (lang === 'uz') {
    const map: Record<EmotionState, string> = {
      neutral: 'O‘quvchi xotirjam — oddiy suhbat sur’ati.',
      confused: 'Hayron — soddalashtiring, qisqa gaplar, bir fikr.',
      frustrated: 'Zo‘riqqan — iliq ohang, dalda, osonroq.',
      confident: 'Ishonchli — biroz chuqurroq yoki o‘tkirroq savol.',
      bored: 'Zerikkan — jonliroq, qisqa, qiziqish uyg‘oting.',
      curious: 'Qiziqqan — “nima uchun” va mexanizmga urg‘u.',
      tired: 'Charchagan — juda qisqa, yumshoq, yuklamang.',
    }
    return map[emotion]
  }
  const map: Record<EmotionState, string> = {
    neutral: 'Ученик спокоен — говори естественно, как в живом разговоре.',
    confused: 'Ученик в замешательстве — упрости, короткие фразы, одна мысль за раз.',
    frustrated: 'Ученик напряжён — тёплый тон, поддержка, чуть проще.',
    confident: 'Ученик уверен — можно чуть глубже или острее спросить.',
    bored: 'Ученик скучает — живее, короче, зацепи интерес.',
    curious: 'Ученик любопытен — акцент на «почему» и механизме.',
    tired: 'Ученик устал — совсем коротко, мягко, без перегрузки.',
  }
  return map[emotion]
}
