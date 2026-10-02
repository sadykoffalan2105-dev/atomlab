/**
 * Живая речь учителя поверх любого локального ответа (RU/EN/UZ).
 *
 * speakLikeHuman НЕ меняет фактов: все предложения исходного ответа сохраняются (кроме точных дублей),
 * подписи источников «[Kimyo 8, §…]», «[ATOMLAB — …]» и маркдаун остаются как есть. Разрешено только:
 *  • вступление по типу вопроса (определение / почему / учёный / история / быт / расчёт / «не знаю»);
 *  • эмоциональная реакция на «круто», «сложно», «спасибо»;
 *  • обращение по имени (не чаще раза в 3 ответа), одна короткая концовка-зацепка;
 *  • снятие канцелярита: «Данное вещество» → «Это вещество», «Следует отметить, что …» → «…».
 * Варианты не повторяются подряд (previousOpeners / seed / память модуля), прирост длины ≤ 25 слов.
 * Стиль берётся из профиля ученика (loadProfile: имя, detail, examples) — схема профиля не меняется.
 */
import { loadProfile } from './studentProfile'

export type VoiceLang = 'ru' | 'en' | 'uz'
export type VoiceKind = 'book' | 'fact' | 'encyclopedia' | 'smalltalk' | 'noAnswer'
export type VoiceIntent = 'definition' | 'why' | 'scientist' | 'history' | 'everyday' | 'calc' | 'how' | 'general'
export type VoiceMood = 'cool' | 'hard' | 'thanks' | 'neutral'

export interface SpeakOptions {
  lang: VoiceLang
  kind: VoiceKind
  seed: number
  intent?: VoiceIntent
  mood?: VoiceMood
  /** Имя ученика (иначе — из профиля). */
  studentName?: string | null
  /** Уже использованные вступления (не повторять). */
  previousOpeners?: readonly string[]
  /** Вопрос ученика — чтобы угадать тип (определение/почему/учёный…), если intent не задан. */
  query?: string
  /** Близкие темы для честного «не знаю» (заголовки найденных фрагментов, тема урока). */
  nearTopics?: readonly string[]
  /** Без концовки-вопроса (например, когда ответ сам кончается вопросом или идёт в озвучку). */
  noHook?: boolean
}

/** Максимальный прирост длины ответа (в словах). */
export const MAX_ADDED_WORDS = 25

type Bank = Record<VoiceLang, readonly string[]>

/* ------------------------------------------------------------ банки фраз (≥ 8 вариантов) */

const OPENERS: Record<VoiceIntent, Bank> = {
  definition: {
    ru: ['Смотри, если по-простому.', 'Коротко и по делу.', 'Давай разберём.', 'Тут всё проще, чем кажется.', 'Объясню на пальцах.', 'Хороший вопрос, отвечаю.', 'Начнём с главного.', 'Если в двух словах.', 'Вот суть.'],
    en: ['Let me put it simply.', 'Short and to the point.', 'Let us break it down.', 'It is simpler than it looks.', 'Here is the gist.', 'Good question, here goes.', 'Start with the main idea.', 'In a nutshell.', 'Here is the core of it.'],
    uz: ['Oddiy qilib aytsam.', 'Qisqa va aniq.', 'Keling, tahlil qilamiz.', 'Bu koʻringanidan osonroq.', 'Mohiyati shunday.', 'Yaxshi savol, javob beraman.', 'Asosiysidan boshlaymiz.', 'Ikki ogʻiz soʻz bilan.', 'Mana gap nimada.'],
  },
  why: {
    ru: ['Хороший «почему».', 'Смотри, в чём причина.', 'Тут логика такая.', 'Давай подумаем вместе.', 'Причина простая.', 'Объясню, откуда это берётся.', 'Вот как это работает.', 'Разберёмся по шагам.', 'Честно говоря, тут всё закономерно.'],
    en: ['Good “why”.', 'Here is the reason.', 'The logic goes like this.', 'Let us think it through.', 'The reason is simple.', 'Here is where it comes from.', 'This is how it works.', 'Step by step.', 'Honestly, it all follows a pattern.'],
    uz: ['Yaxshi «nega».', 'Sababi mana bunda.', 'Mantiq shunday.', 'Keling, birga oʻylaymiz.', 'Sababi oddiy.', 'Bu qayerdan kelishini tushuntiraman.', 'Mana bu qanday ishlaydi.', 'Bosqichma-bosqich koʻramiz.', 'Rostini aytsam, hammasi qonuniy.'],
  },
  scientist: {
    ru: ['О, про него стоит знать.', 'Интересный человек.', 'Расскажу коротко.', 'Это имя точно пригодится.', 'Люблю такие вопросы.', 'Вот что о нём важно.', 'Смотри, кто это был.', 'Хорошо, что спросил.', 'Знакомься.'],
    en: ['Oh, worth knowing about.', 'An interesting person.', 'Briefly, then.', 'A name worth remembering.', 'I like questions like this.', 'Here is what matters about them.', 'Here is who that was.', 'Good thing you asked.', 'Let me introduce them.'],
    uz: ['U haqida bilish kerak.', 'Qiziqarli inson.', 'Qisqacha aytaman.', 'Bu ism albatta asqotadi.', 'Bunday savollar menga yoqadi.', 'U haqida muhimi shu.', 'Qara, bu kim boʻlgan.', 'Soʻraganing yaxshi boʻldi.', 'Tanishib ol.'],
  },
  history: {
    ru: ['Немного истории.', 'Это интересная история.', 'Смотри, как это было.', 'Давай заглянем в прошлое.', 'История тут показательная.', 'Коротко о том, как всё началось.', 'Вот как это открыли.', 'Любопытный факт из истории химии.', 'Отмотаем назад.'],
    en: ['A bit of history.', 'It is an interesting story.', 'Here is how it happened.', 'Let us look back.', 'The history here is telling.', 'Briefly, how it began.', 'Here is how it was discovered.', 'A curious fact from chemistry history.', 'Let us rewind.'],
    uz: ['Biroz tarix.', 'Bu qiziq voqea.', 'Qara, bu qanday boʻlgan.', 'Oʻtmishga nazar tashlaymiz.', 'Bu yerda tarix ibratli.', 'Qisqacha, hammasi qanday boshlangan.', 'Mana bu qanday kashf etilgan.', 'Kimyo tarixidan qiziq fakt.', 'Orqaga qaytamiz.'],
  },
  everyday: {
    ru: ['Это как раз химия вокруг нас.', 'Смотри, где это в жизни.', 'Кстати, это встречается каждый день.', 'Отличный бытовой вопрос.', 'Химия на кухне и дома — моя любимая тема.', 'Вот практическая сторона.', 'Это легко увидеть дома.', 'Если по-простому, из жизни.', 'Приземлённый пример — лучший.'],
    en: ['This is chemistry all around us.', 'Here is where it shows up in life.', 'By the way, this happens every day.', 'A great everyday question.', 'Kitchen chemistry is my favourite.', 'Here is the practical side.', 'Easy to see at home.', 'Simply put, from real life.', 'A down-to-earth example works best.'],
    uz: ['Bu atrofimizdagi kimyo.', 'Qara, bu hayotda qayerda.', 'Aytgancha, bu har kuni uchraydi.', 'Ajoyib maishiy savol.', 'Oshxona kimyosi — sevimli mavzuim.', 'Mana amaliy tomoni.', 'Buni uyda koʻrish oson.', 'Oddiy qilib, hayotdan.', 'Hayotiy misol — eng yaxshisi.'],
  },
  calc: {
    ru: ['Считаем вместе.', 'Тут важно не спешить.', 'Давай по шагам.', 'Задача решается просто.', 'Смотри на порядок действий.', 'Главное — формула и единицы.', 'Разложим на шаги.', 'Считаю вслух.', 'Проверим расчёт.'],
    en: ['Let us calculate together.', 'No rush here.', 'Step by step.', 'The problem is simple.', 'Watch the order of steps.', 'Formula and units matter most.', 'Let us split it into steps.', 'Thinking out loud.', 'Let us check the maths.'],
    uz: ['Birga hisoblaymiz.', 'Bu yerda shoshilmaslik muhim.', 'Bosqichma-bosqich.', 'Masala oson yechiladi.', 'Amallar tartibiga qara.', 'Asosiysi — formula va birliklar.', 'Bosqichlarga boʻlamiz.', 'Ovoz chiqarib hisoblayman.', 'Hisobni tekshiramiz.'],
  },
  how: {
    ru: ['Смотри, как это делается.', 'Порядок такой.', 'Покажу по шагам.', 'Это делается так.', 'Давай разберём механику.', 'Вот рабочий способ.', 'Объясню, как это устроено.', 'Главное — последовательность.', 'Пошагово будет понятнее.'],
    en: ['Here is how it is done.', 'The order is this.', 'Step by step.', 'It goes like this.', 'Let us look at the mechanics.', 'Here is a way that works.', 'Here is how it is set up.', 'The sequence is what matters.', 'Step by step is clearer.'],
    uz: ['Qara, bu qanday qilinadi.', 'Tartib shunday.', 'Bosqichma-bosqich koʻrsataman.', 'Bu shunday qilinadi.', 'Mexanikasini koʻramiz.', 'Mana ishlaydigan usul.', 'Qanday tuzilganini tushuntiraman.', 'Asosiysi — ketma-ketlik.', 'Bosqichma-bosqich tushunarliroq.'],
  },
  general: {
    ru: ['Смотри.', 'Кстати, хороший вопрос.', 'Если по-простому.', 'Честно говоря, мне нравится этот вопрос.', 'Вот что скажу.', 'Отвечаю по делу.', 'Давай разберёмся.', 'Коротко.', 'Так.'],
    en: ['Look.', 'By the way, good question.', 'Simply put.', 'Honestly, I like this question.', 'Here is what I will say.', 'Straight to the point.', 'Let us figure it out.', 'Briefly.', 'Right.'],
    uz: ['Qara.', 'Aytgancha, yaxshi savol.', 'Oddiy qilib aytsam.', 'Rostini aytsam, bu savol menga yoqdi.', 'Mana nima deyman.', 'Toʻgʻridan-toʻgʻri.', 'Keling, aniqlaymiz.', 'Qisqacha.', 'Xoʻsh.'],
  },
}

const MOOD_REACTIONS: Record<Exclude<VoiceMood, 'neutral'>, Bank> = {
  cool: {
    ru: ['Правда круто!', 'Да, мне тоже это нравится.', 'Согласен, впечатляет.', 'Вот и я о том же.', 'Химия умеет удивлять.', 'Рад, что зацепило.', 'Да, это сильно.', 'Отличная реакция!'],
    en: ['It really is cool!', 'Yes, I love it too.', 'Agreed, impressive.', 'My thoughts exactly.', 'Chemistry can surprise you.', 'Glad it clicked.', 'Yes, that is strong.', 'Great reaction!'],
    uz: ['Haqiqatan zoʻr!', 'Ha, menga ham yoqadi.', 'Rozi, hayratlanarli.', 'Men ham shuni aytmoqchiman.', 'Kimyo hayratga sola oladi.', 'Yoqqanidan xursandman.', 'Ha, bu kuchli.', 'Ajoyib munosabat!'],
  },
  hard: {
    ru: ['Понимаю, тема непростая.', 'Ничего, разберёмся вместе.', 'Сложно всем сначала — это нормально.', 'Давай медленнее.', 'Не переживай, ещё раз и проще.', 'Это место многих путает.', 'Спокойно, шаг за шагом.', 'Хорошо, что сказал — объясню иначе.'],
    en: ['I get it, this topic is tricky.', 'No worries, we will sort it out together.', 'It is hard for everyone at first — normal.', 'Let us slow down.', 'Do not worry, once more and simpler.', 'This part confuses many.', 'Easy, step by step.', 'Good that you said so — another way, then.'],
    uz: ['Tushunaman, mavzu oson emas.', 'Hechqisi yoʻq, birga tushunamiz.', 'Avvaliga hammaga qiyin — bu normal.', 'Sekinroq boramiz.', 'Xavotir olma, yana bir bor va oddiyroq.', 'Bu joy koʻpchilikni chalkashtiradi.', 'Xotirjam, bosqichma-bosqich.', 'Aytganing yaxshi — boshqacha tushuntiraman.'],
  },
  thanks: {
    ru: ['Пожалуйста!', 'Рад помочь.', 'Обращайся.', 'Всегда пожалуйста.', 'Мне в радость.', 'Не за что.', 'Для этого я и здесь.', 'Приятно слышать.'],
    en: ['You are welcome!', 'Glad to help.', 'Any time.', 'Always welcome.', 'My pleasure.', 'No problem.', 'That is what I am here for.', 'Nice to hear.'],
    uz: ['Arzimaydi!', 'Yordam berganimdan xursandman.', 'Murojaat qilaver.', 'Har doim marhamat.', 'Men uchun quvonch.', 'Hechqisi yoʻq.', 'Men shuning uchun shu yerdaman.', 'Eshitish yoqimli.'],
  },
}

/** Мостики (короткие связки перед вторым предложением, если ответ длинный). */
export const BRIDGES: Bank = {
  ru: ['Кстати,', 'Смотри,', 'Если по-простому,', 'Честно говоря,', 'Важный момент:', 'И ещё:', 'Обрати внимание:', 'Проще говоря,'],
  en: ['By the way,', 'Look,', 'Simply put,', 'Honestly,', 'Key point:', 'And one more thing:', 'Note:', 'In plain words,'],
  uz: ['Aytgancha,', 'Qara,', 'Oddiy qilib aytsam,', 'Rostini aytsam,', 'Muhim nuqta:', 'Yana bir narsa:', 'Eʼtibor ber:', 'Soddaroq aytganda,'],
}

const HOOKS: Record<VoiceIntent, Bank> = {
  definition: {
    ru: ['Хочешь, покажу на примере?', 'Разобрать на конкретном веществе?', 'Понятно или объяснить иначе?', 'Привести пример из жизни?', 'Проверим на задаче?', 'Спросишь, почему так?', 'Показать на формуле?', 'Идём дальше или остановимся тут?'],
    en: ['Want an example?', 'Shall we try a specific substance?', 'Clear, or explain it another way?', 'Want a real-life example?', 'Test it on a problem?', 'Curious why it works?', 'Show it on a formula?', 'Move on or stay here?'],
    uz: ['Misolda koʻrsataymi?', 'Aniq moddada koʻramizmi?', 'Tushunarlimi yoki boshqacha tushuntiraymi?', 'Hayotdan misol keltiraymi?', 'Masalada tekshiramizmi?', 'Nega shunday — soʻraysanmi?', 'Formulada koʻrsataymi?', 'Davom etamizmi yoki shu yerda toʻxtaymizmi?'],
  },
  why: {
    ru: ['Логично?', 'Хочешь, проверим на примере?', 'Рассказать, где это используют?', 'Углубиться в механизм?', 'Понятно, откуда это берётся?', 'Задать похожий вопрос тебе?', 'Показать опыт, где это видно?', 'Есть ещё «почему»?'],
    en: ['Makes sense?', 'Want to check it on an example?', 'Shall I tell you where it is used?', 'Go deeper into the mechanism?', 'Clear where it comes from?', 'Shall I ask you a similar one?', 'Show an experiment where you can see it?', 'Any more “whys”?'],
    uz: ['Mantiqiymi?', 'Misolda tekshiramizmi?', 'Qayerda ishlatilishini aytaymi?', 'Mexanizmga chuqurroq kiramizmi?', 'Qayerdan kelishi tushunarlimi?', 'Senga oʻxshash savol beraymi?', 'Buni koʻrsatadigan tajribani koʻrsataymi?', 'Yana «nega» bormi?'],
  },
  scientist: {
    ru: ['Рассказать, что он ещё открыл?', 'Хочешь, свяжу это с темой урока?', 'Интересно, как это открытие проверяли?', 'Рассказать о его современниках?', 'Показать, где это в учебнике?', 'Спросишь ещё про кого-нибудь?', 'Хочешь историю этого открытия?', 'Какой из его работ займёмся?'],
    en: ['Shall I tell you what else they discovered?', 'Want me to link this to the lesson?', 'Curious how the discovery was tested?', 'Tell you about their contemporaries?', 'Show where this is in the textbook?', 'Ask about someone else?', 'Want the story of this discovery?', 'Which of their works shall we take?'],
    uz: ['Yana nima kashf etganini aytaymi?', 'Buni dars mavzusiga bogʻlaymi?', 'Kashfiyot qanday tekshirilgani qiziqmi?', 'Zamondoshlari haqida aytaymi?', 'Darslikda qayerdaligini koʻrsataymi?', 'Yana kimdir haqida soʻraysanmi?', 'Bu kashfiyot tarixini aytaymi?', 'Qaysi ishini olamiz?'],
  },
  history: {
    ru: ['Рассказать, что было дальше?', 'Интересно, кто это открыл?', 'Связать с тем, что учим сейчас?', 'Хочешь ещё один факт из истории?', 'Показать, как это проверили опытом?', 'Спросишь про учёного?', 'Продолжим хронологию?', 'Было ли это новым для тебя?'],
    en: ['Want to know what came next?', 'Curious who discovered it?', 'Link it to what we study now?', 'Another fact from history?', 'Show how it was tested by experiment?', 'Ask about the scientist?', 'Continue the timeline?', 'Was that new to you?'],
    uz: ['Keyin nima boʻlganini aytaymi?', 'Kim kashf etgani qiziqmi?', 'Hozir oʻrganayotganimizga bogʻlaymi?', 'Tarixdan yana bir fakt?', 'Tajribada qanday tekshirilganini koʻrsataymi?', 'Olim haqida soʻraysanmi?', 'Xronologiyani davom ettiramizmi?', 'Bu sen uchun yangilik boʻldimi?'],
  },
  everyday: {
    ru: ['Заметишь это дома?', 'Хочешь ещё пример из быта?', 'Рассказать, как это безопасно проверить?', 'Связать с темой урока?', 'Где ещё это встречал?', 'Разобрать состав чего-нибудь из кухни?', 'Интересно, как это устроено внутри?', 'Проверим на простом опыте?'],
    en: ['Will you notice it at home?', 'Another everyday example?', 'Tell you how to check it safely?', 'Link it to the lesson?', 'Where else have you seen it?', 'Break down something from the kitchen?', 'Curious how it works inside?', 'Check it with a simple experiment?'],
    uz: ['Buni uyda sezasanmi?', 'Yana bir maishiy misol?', 'Xavfsiz tekshirishni aytaymi?', 'Dars mavzusiga bogʻlaymi?', 'Yana qayerda uchratgansan?', 'Oshxonadagi biror narsa tarkibini koʻramizmi?', 'Ichida qanday ishlashi qiziqmi?', 'Oddiy tajribada tekshiramizmi?'],
  },
  calc: {
    ru: ['Проверим на задаче?', 'Решишь похожую сам?', 'Показать ещё способ?', 'Единицы сошлись?', 'Дать задачу чуть сложнее?', 'Нужна формула целиком?', 'Разобрать типичную ошибку тут?', 'Считаем следующий шаг?'],
    en: ['Test it on a problem?', 'Try a similar one yourself?', 'Show another method?', 'Do the units match?', 'A slightly harder problem?', 'Need the full formula?', 'Look at a typical mistake here?', 'Next step?'],
    uz: ['Masalada tekshiramizmi?', 'Oʻxshashini oʻzing yechasanmi?', 'Yana bir usul koʻrsataymi?', 'Birliklar toʻgʻri keldimi?', 'Biroz qiyinroq masala beraymi?', 'Toʻliq formula kerakmi?', 'Bu yerdagi odatiy xatoni koʻramizmi?', 'Keyingi qadamni hisoblaymizmi?'],
  },
  how: {
    ru: ['Попробуешь повторить шаги?', 'Показать на конкретном примере?', 'Разобрать, где обычно ошибаются?', 'Сделаем вместе первый шаг?', 'Нужна схема?', 'Дальше сам?', 'Проверим на задаче?', 'Что непонятно в шагах?'],
    en: ['Try repeating the steps?', 'Show it on a specific example?', 'Look at where people usually slip?', 'Do the first step together?', 'Need a diagram?', 'Carry on yourself?', 'Test it on a problem?', 'Which step is unclear?'],
    uz: ['Qadamlarni takrorlab koʻrasanmi?', 'Aniq misolda koʻrsataymi?', 'Odatda qayerda adashishlarini koʻramizmi?', 'Birinchi qadamni birga qilamizmi?', 'Sxema kerakmi?', 'Keyin oʻzing?', 'Masalada tekshiramizmi?', 'Qadamlarda nima tushunarsiz?'],
  },
  general: {
    ru: ['Хочешь, покажу на примере?', 'Понятно объяснил?', 'Разобрать подробнее?', 'Проверим на задаче?', 'Что из этого было новым?', 'Идём дальше?', 'Задать тебе вопрос на проверку?', 'Есть что уточнить?'],
    en: ['Want an example?', 'Did that make sense?', 'Go into more detail?', 'Test it on a problem?', 'What was new for you?', 'Shall we move on?', 'Shall I quiz you on it?', 'Anything to clarify?'],
    uz: ['Misolda koʻrsataymi?', 'Tushunarli boʻldimi?', 'Batafsilroq koʻramizmi?', 'Masalada tekshiramizmi?', 'Nimasi yangilik boʻldi?', 'Davom etamizmi?', 'Tekshirish uchun savol beraymi?', 'Aniqlashtiradigan narsa bormi?'],
  },
}

/** Честное «не знаю»: тёплое, короткое, с близкими темами. */
const NO_ANSWER_NEAR: Bank = {
  ru: ['Зато могу рассказать про {a} или {b} — что ближе?', 'Рядом есть {a} и {b} — начнём с одной из них?', 'Если хочешь, разберём {a} или {b}.', 'Близкие темы, где я уверен: {a}, {b}. Выбирай.', 'Могу уверенно ответить про {a} или {b}.', 'Давай зайдём с другой стороны: {a} или {b}?', 'Что ближе к твоему вопросу — {a} или {b}?', 'Из того, что знаю точно: {a}, {b}. Возьмём?'],
  en: ['But I can tell you about {a} or {b} — which is closer?', 'Nearby there are {a} and {b} — start with one?', 'If you like, we can look at {a} or {b}.', 'Close topics I am sure about: {a}, {b}. Your pick.', 'I can answer confidently about {a} or {b}.', 'Let us come at it from another side: {a} or {b}?', 'Which is closer to your question — {a} or {b}?', 'What I know for sure: {a}, {b}. Shall we?'],
  uz: ['Lekin {a} yoki {b} haqida aytib bera olaman — qaysi yaqinroq?', 'Yaqinida {a} va {b} bor — biridan boshlaymizmi?', 'Xohlasang, {a} yoki {b} ni koʻramiz.', 'Ishonchli bilgan yaqin mavzular: {a}, {b}. Tanla.', '{a} yoki {b} haqida ishonch bilan javob beraman.', 'Boshqa tomondan kiramiz: {a} yoki {b}?', 'Savolingga qaysi yaqinroq — {a} yoki {b}?', 'Aniq bilganlarim: {a}, {b}. Olamizmi?'],
}
const NO_ANSWER_ONE: Bank = {
  ru: ['Зато про {a} расскажу уверенно — хочешь?', 'Рядом есть тема «{a}» — начнём с неё?', 'Могу разобрать {a}, если подходит.'],
  en: ['But I can confidently tell you about {a} — want that?', 'There is a nearby topic “{a}” — start there?', 'I can go over {a} if that fits.'],
  uz: ['Lekin {a} haqida ishonch bilan aytaman — xohlaysanmi?', 'Yaqinida «{a}» mavzusi bor — undan boshlaymizmi?', 'Mos kelsa, {a} ni koʻrib chiqamiz.'],
}

/* ------------------------------------------------------------ канцелярит → живая речь (факты не меняются) */

/** «Следует отметить, что оксиды…» → «Оксиды…» (начало предложения — с заглавной). */
const RU_LEAD_INS: RegExp[] = [
  /(^|[.!?]\s+|\n)Следует отметить, что\s+(\p{L})/gu,
  /(^|[.!?]\s+|\n)Необходимо отметить, что\s+(\p{L})/gu,
  /(^|[.!?]\s+|\n)Стоит отметить, что\s+(\p{L})/gu,
]
const RU_BUREAU: [RegExp, string][] = [
  [/(?<!\p{L})Данное вещество/gu, 'Это вещество'],
  [/(?<!\p{L})данное вещество/gu, 'это вещество'],
  [/(?<!\p{L})Данный элемент/gu, 'Этот элемент'],
  [/(?<!\p{L})данный элемент/gu, 'этот элемент'],
  [/(?<!\p{L})Данная реакция/gu, 'Эта реакция'],
  [/(?<!\p{L})данная реакция/gu, 'эта реакция'],
  [/(?<!\p{L})Данное соединение/gu, 'Это соединение'],
  [/(?<!\p{L})данное соединение/gu, 'это соединение'],
  [/(?<!\p{L})В настоящее время(?!\p{L})/gu, 'Сейчас'],
  [/(?<!\p{L})в настоящее время(?!\p{L})/gu, 'сейчас'],
]

/** Снять канцелярит без изменения смысла; применяется только к русскому тексту. */
export function softenBureaucratic(text: string, lang: VoiceLang): string {
  if (lang !== 'ru') return text
  let out = text
  for (const re of RU_LEAD_INS) out = out.replace(re, (_m, p: string, l: string) => `${p}${l.toUpperCase()}`)
  for (const [re, rep] of RU_BUREAU) out = out.replace(re, rep)
  return out
}

/* ------------------------------------------------------------ утилиты */

const CITATION_LINE = /^\s*(?:\[[^\]\n]{2,120}\]\s*)+$/u

/** Отделить хвост с подписями источников «[Kimyo 8, §12, стр. 40] [ATOMLAB — учёные]». */
function splitCitations(text: string): { body: string; tail: string } {
  const lines = text.replace(/\s+$/u, '').split('\n')
  const tailLines: string[] = []
  while (lines.length && (CITATION_LINE.test(lines[lines.length - 1]!) || !lines[lines.length - 1]!.trim())) {
    tailLines.unshift(lines.pop()!)
  }
  return { body: lines.join('\n').trim(), tail: tailLines.join('\n').trim() }
}

/** Нормализованное предложение (для поиска дублей). */
export function canonSentence(s: string): string {
  return s
    .toLowerCase()
    .replace(/[*_`#>]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/** Разбить текст на предложения, не ломая формулы и маркдаун (строки — границы всегда). */
export function splitVoiceSentences(text: string): string[] {
  const out: string[] = []
  for (const line of text.split(/\n/)) {
    if (!line.trim()) {
      out.push('')
      continue
    }
    // Не режем после сокращений «т. е.», «г.», «стр.», чисел с точкой «6,02» и после одиночных букв «Д. И.».
    const parts = line.split(/(?<=[.!?…])\s+(?=[«"(*_\p{Lu}\p{N}])(?<!\b(?:т|е|г|гг|стр|см|рис|табл|им|св|ул|тыс|млн|млрд|Д|И|М|А|Н|В|Dr|Mr|St|e\.g|i\.e)\.\s*)/u)
    for (const p of parts) if (p.trim()) out.push(p.trim())
  }
  return out
}

/** Убрать точные дубли предложений (первое вхождение остаётся), пустые строки сохраняют абзацы. */
function dedupeSentences(body: string): string {
  const seen = new Set<string>()
  const lines = body.split('\n')
  const result: string[] = []
  for (const line of lines) {
    if (!line.trim()) {
      result.push(line)
      continue
    }
    const sentences = splitVoiceSentences(line)
    const kept: string[] = []
    for (const s of sentences) {
      const key = canonSentence(s)
      if (key.length > 12 && seen.has(key)) continue
      if (key.length > 12) seen.add(key)
      kept.push(s)
    }
    if (kept.length) result.push(kept.join(' '))
  }
  return result.join('\n')
}

function words(s: string): number {
  return s.split(/\s+/).filter(Boolean).length
}

/** Детерминированный выбор по seed c обходом уже использованных вариантов. */
function pickSeeded(pool: readonly string[], seed: number, avoid: ReadonlySet<string>): string {
  if (!pool.length) return ''
  const n = pool.length
  const start = Math.abs(Math.floor(seed)) % n
  for (let i = 0; i < n; i++) {
    const cand = pool[(start + i * 7 + Math.floor(seed / n)) % n]!
    if (!avoid.has(cand)) return cand
  }
  return pool[start]!
}

/** Память модуля: последние вступления/концовки (чтобы не повторяться подряд даже без previousOpeners). */
const recentOpeners: string[] = []
const recentHooks: string[] = []
let nameCounter = 0

/** Для тестов: сбросить память повторов. */
export function resetVoiceMemory(): void {
  recentOpeners.length = 0
  recentHooks.length = 0
  nameCounter = 0
}

/** Все вступления (для проверки «уже начинается с нашего вступления»). */
const ALL_OPENERS: Set<string> = new Set(
  [...Object.values(OPENERS), ...Object.values(MOOD_REACTIONS)].flatMap((bank) => [...bank.ru, ...bank.en, ...bank.uz]),
)

/** Угадать тип вопроса по его тексту (если intent не передан). */
export function detectVoiceIntent(query: string | undefined, kind: VoiceKind): VoiceIntent {
  if (kind === 'encyclopedia') return 'scientist'
  const q = (query ?? '').toLowerCase()
  if (!q) return 'general'
  if (/(кто\s+так|что\s+открыл|чем\s+извест|учён|химик|биограф|who\s+was|who\s+is|discover(ed)?\b|scientist|olim|kim\s+(edi|boʻlgan|bo'lgan)|kashf)/u.test(q)) return 'scientist'
  if (/(истори|когда\s+(открыл|получил|появил)|впервые|в\s+каком\s+году|history|when\s+was|first\s+(made|found)|tarix|qachon)/u.test(q)) return 'history'
  if (/(сколько|рассчита|вычисли|реши|найди\s+масс|молярн|объём|процент|how\s+many|how\s+much|calculate|solve|hisobla|necha|qancha|foiz)/u.test(q)) return 'calc'
  if (/(почему|зачем|отчего|из-за\s+чего|why|nega|nima\s+uchun)/u.test(q)) return 'why'
  if (/(в\s+быту|дома|на\s+кухне|в\s+жизни|в\s+еде|в\s+медицин|вокруг\s+нас|повседнев|everyday|at\s+home|kitchen|in\s+life|uyda|oshxona|hayotda|turmush)/u.test(q)) return 'everyday'
  if (/(^|\s)(как|каким\s+образом|how\s+(do|does|to|can)|qanday\s+qilib)\b/u.test(q)) return 'how'
  if (/(что\s+так|что\s+значит|определени|what\s+is|what\s+are|define|nima\b|degani)/u.test(q)) return 'definition'
  return 'general'
}

/* ------------------------------------------------------------ главная функция */

/**
 * Превратить ответ в живую реплику учителя, не меняя фактов.
 * Возвращает текст (подписи источников и маркдаун сохраняются).
 */
export function speakLikeHuman(answer: string, opts: SpeakOptions): string {
  const src = (answer ?? '').trim()
  if (!src) return src
  const lang: VoiceLang = opts.lang === 'en' || opts.lang === 'uz' ? opts.lang : 'ru'
  // Разговорные реплики человеческого слоя уже живые — не трогаем.
  if (opts.kind === 'smalltalk') return src

  const profile = safeProfile()
  const name = (opts.studentName ?? profile.name ?? '').trim()
  const intent: VoiceIntent = opts.intent ?? detectVoiceIntent(opts.query, opts.kind)
  const seed = Number.isFinite(opts.seed) ? opts.seed : 0
  const avoid = new Set<string>([...(opts.previousOpeners ?? []), ...recentOpeners])

  const { body: rawBody, tail } = splitCitations(src)
  let body = dedupeSentences(softenBureaucratic(rawBody, lang))
  const baseWords = words(src)

  // Уже начинается с нашей фразы (повторный вызов) — не наращиваем второй раз.
  const firstLine = body.split('\n')[0] ?? ''
  const alreadyVoiced = [...ALL_OPENERS].some((o) => firstLine.startsWith(o)) || (name && firstLine.startsWith(`${name},`))
  const endsWithQuestion = /[?？]\s*$/u.test(body)

  const pieces: { opener: string; hook: string; withName: boolean } = { opener: '', hook: '', withName: false }

  if (!alreadyVoiced) {
    // 1) Эмоциональная реакция важнее вступления.
    if (opts.mood && opts.mood !== 'neutral') {
      pieces.opener = pickSeeded(MOOD_REACTIONS[opts.mood][lang], seed, avoid)
    } else if (opts.kind === 'noAnswer') {
      pieces.opener = '' // текст «не знаю» уже честный и короткий — без вступления
    } else if (seed % 3 !== 2 || opts.kind === 'encyclopedia') {
      // Вступление не в каждом ответе: иначе приедается.
      pieces.opener = pickSeeded(OPENERS[intent][lang], seed, avoid)
    }
    // 2) Имя — не чаще раза в 3 ответа и только если его ещё нет в тексте.
    if (name && !body.includes(name)) {
      nameCounter += 1
      if (nameCounter % 3 === 1) pieces.withName = true
    }
    // 3) Концовка-зацепка: не после вопроса, не для коротких стилей, не для «не знаю».
    const brief = profile.detail <= -1
    if (!opts.noHook && !endsWithQuestion && !brief && opts.kind !== 'noAnswer' && body.length < 900 && seed % 2 === 0) {
      const pool = profile.examples >= 1 && intent !== 'scientist' ? HOOKS.definition[lang] : HOOKS[intent][lang]
      pieces.hook = pickSeeded(pool, seed + 3, new Set(recentHooks))
    }
  }

  // «Не знаю»: добавить близкие темы (если они есть и их ещё нет в тексте).
  let near = ''
  if (opts.kind === 'noAnswer' && opts.nearTopics?.length) {
    const topics = [...new Set(opts.nearTopics.map((t) => t.replace(/[*_`]/g, '').trim()).filter((t) => t && !body.toLowerCase().includes(t.toLowerCase())))].slice(0, 2)
    if (topics.length === 2) near = pickSeeded(NO_ANSWER_NEAR[lang], seed, new Set()).replace('{a}', topics[0]!).replace('{b}', topics[1]!)
    else if (topics.length === 1) near = pickSeeded(NO_ANSWER_ONE[lang], seed, new Set()).replace('{a}', topics[0]!)
  }

  // Сборка с контролем прироста (≤ MAX_ADDED_WORDS).
  const assemble = () => {
    let head = ''
    if (pieces.withName && pieces.opener) head = `${name}, ${lowerFirst(pieces.opener)}`
    else if (pieces.withName) head = `${name}, ${lowerFirst(firstWordHint(lang))}`
    else head = pieces.opener
    let out = head ? `${head} ${body}` : body
    if (near) out = `${out} ${near}`
    if (pieces.hook) out = `${out}\n\n${pieces.hook}`
    return tail ? `${out}\n\n${tail}` : out
  }
  let result = assemble()
  if (words(result) - baseWords > MAX_ADDED_WORDS) {
    pieces.hook = ''
    result = assemble()
  }
  if (words(result) - baseWords > MAX_ADDED_WORDS) {
    near = ''
    result = assemble()
  }
  if (words(result) - baseWords > MAX_ADDED_WORDS) {
    pieces.opener = ''
    pieces.withName = false
    result = assemble()
  }

  if (pieces.opener) {
    recentOpeners.push(pieces.opener)
    if (recentOpeners.length > 4) recentOpeners.shift()
  }
  if (pieces.hook) {
    recentHooks.push(pieces.hook)
    if (recentHooks.length > 4) recentHooks.shift()
  }
  return result
}

function lowerFirst(s: string): string {
  return s ? s[0]!.toLowerCase() + s.slice(1) : s
}

function firstWordHint(lang: VoiceLang): string {
  // С точкой: имя остаётся отдельной фразой и не склеивается с первым фактическим предложением.
  return lang === 'en' ? 'look.' : lang === 'uz' ? 'qara.' : 'смотри.'
}

function safeProfile(): { name: string | null; detail: number; examples: number } {
  try {
    const p = loadProfile()
    return { name: p.name, detail: p.detail, examples: p.examples }
  } catch {
    return { name: null, detail: 0, examples: 0 }
  }
}

/** Настроение из реплики ученика («круто», «сложно», «спасибо»), для speakLikeHuman({ mood }). */
export function detectMood(text: string): VoiceMood {
  const t = (text ?? '').toLowerCase()
  if (!t) return 'neutral'
  if (/(спасиб|благодар|thank|rahmat)/u.test(t)) return 'thanks'
  if (/(круто|класс(но)?|вау|обалдеть|прикольно|интересно!|cool|awesome|wow|amazing|zoʻr|zo'r|ajoyib|qoyil)/u.test(t)) return 'cool'
  if (/(сложно|трудно|не\s+понима|не\s+понял|запутал|тяжело|hard|difficult|confus|don'?t\s+(get|understand)|qiyin|tushunmad)/u.test(t)) return 'hard'
  return 'neutral'
}
