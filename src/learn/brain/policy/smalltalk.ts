/**
 * Светская беседа: «привет», «как дела», «кто ты», «спасибо», «пока»… (ru/uz/en).
 * Тёплый ответ (2–3 варианта на каждый случай) и мягкий мост к химии.
 * Срабатывает, только если реплика целиком — светская: «привет, что такое моль?» сюда не попадает.
 * Границы слов для кириллицы — через (?<!\p{L}) / (?!\p{L}) с флагом u.
 */
import { foldForPolicy, type PolicyLang } from './lang'

export type SmalltalkKind =
  | 'hello'
  | 'morning'
  | 'afternoon'
  | 'evening'
  | 'night'
  | 'howAreYou'
  | 'whoAreYou'
  | 'name'
  | 'whatCanYouDo'
  | 'thanks'
  | 'bye'
  | 'sorry'
  | 'praise'
  | 'areYouBot'
  | 'age'

type Pattern = { kind: SmalltalkKind; lang: PolicyLang; re: RegExp }

const B = '(?<!\\p{L})'
const E = '(?!\\p{L})'
const p = (kind: SmalltalkKind, lang: PolicyLang, body: string): Pattern => ({ kind, lang, re: new RegExp(`${B}(?:${body})${E}`, 'giu') })

/** ≥40 шаблонов. Порядок важен: более «смысловые» виды (как дела, кто ты) — раньше приветствий. */
const PATTERNS: readonly Pattern[] = [
  // ru
  p('howAreYou', 'ru', 'как\\s+(?:у\\s+тебя\\s+|у\\s+вас\\s+)?дела|как\\s+ты|как\\s+вы|как\\s+поживаешь|как\\s+поживаете|как\\s+жизнь|как\\s+настроение|что\\s+нового'),
  p('whoAreYou', 'ru', 'кто\\s+ты(?:\\s+такой|\\s+такая)?|ты\\s+кто(?:\\s+такой)?|кто\\s+вы(?:\\s+такой)?|представься'),
  p('name', 'ru', 'как\\s+тебя\\s+зовут|как\\s+вас\\s+зовут|твоё\\s+имя|твое\\s+имя'),
  p('whatCanYouDo', 'ru', 'что\\s+ты\\s+умеешь|что\\s+вы\\s+умеете|чем\\s+(?:ты\\s+|вы\\s+)?можешь\\s+помочь|чем\\s+(?:вы\\s+)?можете\\s+помочь|что\\s+ты\\s+можешь'),
  p('areYouBot', 'ru', 'ты\\s+робот|ты\\s+бот|ты\\s+человек|ты\\s+(?:ии|нейросеть)'),
  p('age', 'ru', 'сколько\\s+тебе\\s+лет|сколько\\s+вам\\s+лет'),
  p('morning', 'ru', 'доброе\\s+утро|утро\\s+доброе|с\\s+добрым\\s+утром'),
  p('afternoon', 'ru', 'добрый\\s+день|день\\s+добрый'),
  p('evening', 'ru', 'добрый\\s+вечер|вечер\\s+добрый'),
  p('night', 'ru', 'спокойной\\s+ночи|доброй\\s+ночи'),
  p('thanks', 'ru', 'спасибо(?:\\s+большое|\\s+огромное)?|благодарю|спс|мерси'),
  p('bye', 'ru', 'пока(?:-пока)?|до\\s+свидания|до\\s+встречи|до\\s+завтра|увидимся|всего\\s+доброго|прощай'),
  p('sorry', 'ru', 'извини(?:те)?|прости(?:те)?|сорри'),
  p('praise', 'ru', 'ты\\s+(?:молодец|крут(?:ой|ая)|классн(?:ый|ая)|лучш(?:ий|ая))|вы\\s+молодец'),
  p('hello', 'ru', 'привет(?:ик|ствую)?|здравствуй(?:те)?|здрасьте|хай|салют|салам|приветики|йо'),
  // uz (латиница)
  p('howAreYou', 'uz', "qalaysiz|qalaysan|ishlar\\s+qalay|yaxshimisiz|yaxshimisan|ahvollar\\s+qalay|ahvolingiz\\s+qalay|nima\\s+gap"),
  p('whoAreYou', 'uz', 'sen\\s+kimsan|siz\\s+kimsiz|kimsan|kimsiz'),
  p('name', 'uz', "isming\\s+nima|ismingiz\\s+nima|oting\\s+nima"),
  p('whatCanYouDo', 'uz', "nima\\s+qila\\s+olasan|nimalar\\s+qila\\s+olasiz|nima\\s+qila\\s+olasiz|qanday\\s+yordam\\s+bera\\s+olasiz"),
  p('morning', 'uz', "xayrli\\s+tong"),
  p('afternoon', 'uz', 'xayrli\\s+kun'),
  p('evening', 'uz', 'xayrli\\s+kech'),
  p('night', 'uz', 'xayrli\\s+tun|yaxshi\\s+tun'),
  p('thanks', 'uz', 'rahmat|raxmat|katta\\s+rahmat|tashakkur'),
  p('bye', 'uz', "xayr|ko'rishguncha|ko'rishamiz|sog'\\s+bo'ling"),
  p('sorry', 'uz', 'kechirasiz|kechir|uzr'),
  p('hello', 'uz', 'salom(?:\\s+alaykum)?|assalomu\\s+alaykum|assalom'),
  // uz (кириллица)
  p('howAreYou', 'uz', 'қалайсиз|қалайсан|яхшимисиз|ишлар\\s+қалай'),
  p('thanks', 'uz', 'раҳмат|рахмат|ташаккур'),
  p('bye', 'uz', 'хайр|кўришгунча'),
  p('hello', 'uz', 'ассалому\\s+алайкум|салом'),
  // en
  p('howAreYou', 'en', "how\\s+are\\s+you(?:\\s+doing)?|how's\\s+it\\s+going|how\\s+is\\s+it\\s+going|what's\\s+up|whats\\s+up|how\\s+do\\s+you\\s+do"),
  p('whoAreYou', 'en', 'who\\s+are\\s+you|introduce\\s+yourself'),
  p('name', 'en', "what(?:'s|\\s+is)\\s+your\\s+name"),
  p('whatCanYouDo', 'en', 'what\\s+can\\s+you\\s+do|how\\s+can\\s+you\\s+help(?:\\s+me)?'),
  p('areYouBot', 'en', 'are\\s+you\\s+(?:a\\s+)?(?:robot|bot|human|real|an?\\s+ai)'),
  p('age', 'en', 'how\\s+old\\s+are\\s+you'),
  p('morning', 'en', 'good\\s+morning'),
  p('afternoon', 'en', 'good\\s+afternoon'),
  p('evening', 'en', 'good\\s+evening'),
  p('night', 'en', 'good\\s+night'),
  p('thanks', 'en', 'thank\\s+you(?:\\s+so\\s+much|\\s+very\\s+much)?|thanks(?:\\s+a\\s+lot)?|thx|ty'),
  p('bye', 'en', 'bye(?:-bye)?|goodbye|good\\s+bye|see\\s+you(?:\\s+later|\\s+tomorrow)?|see\\s+ya|cya'),
  p('sorry', 'en', 'sorry|my\\s+bad|apologies'),
  p('praise', 'en', "you(?:'re|\\s+are)\\s+(?:great|awesome|cool|the\\s+best|smart)|good\\s+job"),
  p('hello', 'en', 'hello|hi|hey|hiya|greetings|yo'),
]

/** Обращения и связки, которые не делают реплику вопросом. */
const FILLER =
  /(?<!\p{L})(ну|а|и|ну\s+что|учитель|учительница|ии|бот|друг|ребята|тебе|тебя|вам|вас|тоже|очень|все|всё|ладно|ок|окей|хорошо|отлично|снова|ещё|еще|раз|ustoz|domla|ham|sizga|senga|ok|okay|teacher|again|too|so|much|very|well|and|you|dear|sir|mrs|mr|miss|there|all|everyone|guys)(?!\p{L})/giu

const REPLIES: Record<SmalltalkKind, Record<PolicyLang, readonly string[]>> = {
  hello: {
    ru: [
      'Привет! Рад тебя видеть. О чём сегодня поговорим в химии — о веществах, реакциях или задачах?',
      'Здравствуй! Я на месте и готов помочь. Какая тема по химии сейчас интересует?',
      'Привет-привет! Давай сделаем химию понятной. С какого вопроса начнём?',
    ],
    uz: [
      'Salom! Sizni koʻrganimdan xursandman. Bugun kimyodan nimani gaplashamiz — moddalar, reaksiyalar yoki masalalar?',
      'Assalomu alaykum! Men shu yerdaman va yordamga tayyorman. Kimyodan qaysi mavzu qiziqtiradi?',
      'Salom! Kimyoni tushunarli qilamiz. Qaysi savoldan boshlaymiz?',
    ],
    en: [
      'Hi! Great to see you. What shall we explore in chemistry today — substances, reactions or problems?',
      'Hello! I am here and ready to help. Which chemistry topic is on your mind?',
      'Hey there! Let us make chemistry clear. What question shall we start with?',
    ],
  },
  morning: {
    ru: ['Доброе утро! Свежая голова — лучшее время для химии. С чего начнём?', 'С добрым утром! Хорошего дня и лёгких реакций. Какой вопрос по химии разберём первым?'],
    uz: ['Xayrli tong! Tetik bosh — kimyo uchun eng yaxshi vaqt. Nimadan boshlaymiz?', 'Xayrli tong! Kuningiz yaxshi oʻtsin. Kimyodan birinchi qaysi savolni koʻramiz?'],
    en: ['Good morning! A fresh mind is perfect for chemistry. Where shall we start?', 'Good morning! Have a great day. Which chemistry question shall we tackle first?'],
  },
  afternoon: {
    ru: ['Добрый день! Готов помочь с химией — спрашивай смело.', 'Добрый день! Какая тема по химии сегодня вызывает вопросы?'],
    uz: ['Xayrli kun! Kimyodan yordam berishga tayyorman — bemalol soʻrang.', 'Xayrli kun! Bugun kimyoning qaysi mavzusi savol tugʻdiryapti?'],
    en: ['Good afternoon! Ready to help with chemistry — ask away.', 'Good afternoon! Which chemistry topic raises questions today?'],
  },
  evening: {
    ru: ['Добрый вечер! Самое время спокойно разобрать трудную тему по химии. Что повторим?', 'Добрый вечер! Готов помочь с домашним заданием по химии — с чего начнём?'],
    uz: ['Xayrli kech! Kimyodan qiyin mavzuni xotirjam koʻrib chiqish uchun ayni vaqt. Nimani takrorlaymiz?', 'Xayrli kech! Kimyodan uy vazifasiga yordam berishga tayyorman — nimadan boshlaymiz?'],
    en: ['Good evening! A good time to calmly go over a tricky chemistry topic. What shall we review?', 'Good evening! Ready to help with chemistry homework — where do we start?'],
  },
  night: {
    ru: ['Спокойной ночи! Хорошо выспаться — тоже часть учёбы. Завтра продолжим с химией.', 'Доброй ночи! Отдыхай, а завтра разберём следующую тему по химии.'],
    uz: ['Xayrli tun! Yaxshi uxlash ham oʻqishning bir qismi. Ertaga kimyoni davom ettiramiz.', 'Yaxshi dam oling! Ertaga kimyodan keyingi mavzuni koʻramiz.'],
    en: ['Good night! Sleep is part of learning too. We will continue with chemistry tomorrow.', 'Good night! Rest well, and tomorrow we will take the next chemistry topic.'],
  },
  howAreYou: {
    ru: [
      'Спасибо, отлично — как реакция, которая идёт сама собой! А у тебя как? Если есть вопрос по химии — я рядом.',
      'Всё хорошо, спасибо, что спросил! Готов к химии. Что сегодня разберём?',
      'Прекрасно! Электроны на своих местах, настроение рабочее. Чем помочь по химии?',
    ],
    uz: [
      'Rahmat, juda yaxshi — oʻz-oʻzidan ketadigan reaksiyadek! Sizda-chi? Kimyodan savol boʻlsa, men shu yerdaman.',
      'Hammasi yaxshi, soʻraganingiz uchun rahmat! Kimyoga tayyorman. Bugun nimani koʻramiz?',
      'Ajoyib! Elektronlar joyida, kayfiyat ishchan. Kimyodan qanday yordam beray?',
    ],
    en: [
      'Doing great, thanks — like a reaction that runs all by itself! How about you? If you have a chemistry question, I am here.',
      'All good, thanks for asking! Ready for some chemistry. What shall we look at today?',
      'Wonderful! Electrons in place, mood for work. How can I help with chemistry?',
    ],
  },
  whoAreYou: {
    ru: [
      'Я ИИ-учитель химии ATOMLAB: объясняю темы, разбираю задачи и реакции, проверяю ответы. Спроси что-нибудь по химии!',
      'Я твой учитель химии в ATOMLAB. Люблю рассуждать от законов — от строения атома до термодинамики. С какой темы начнём?',
    ],
    uz: [
      'Men ATOMLAB kimyo SI-oʻqituvchisiman: mavzularni tushuntiraman, masala va reaksiyalarni tahlil qilaman, javoblarni tekshiraman. Kimyodan biror narsa soʻrang!',
      'Men ATOMLABdagi kimyo oʻqituvchingizman. Qonunlardan kelib chiqib fikrlashni yaxshi koʻraman. Qaysi mavzudan boshlaymiz?',
    ],
    en: [
      'I am the ATOMLAB AI chemistry teacher: I explain topics, work through problems and reactions, and check answers. Ask me anything about chemistry!',
      'I am your chemistry teacher in ATOMLAB. I like reasoning from the laws — from atomic structure to thermodynamics. Which topic first?',
    ],
  },
  name: {
    ru: ['Я учитель химии ATOMLAB — можно просто «учитель». А как тебя зовут? И какой вопрос по химии у тебя есть?', 'Зови меня учителем ATOMLAB. Давай знакомиться через химию: какая тема тебе интересна?'],
    uz: ['Men ATOMLAB kimyo oʻqituvchisiman — shunchaki «ustoz» deyishingiz mumkin. Ismingiz nima? Kimyodan qanday savolingiz bor?', 'Meni ATOMLAB ustozi deb chaqiring. Kimyo orqali tanishamiz: qaysi mavzu qiziq?'],
    en: ['I am the ATOMLAB chemistry teacher — just call me “teacher”. What is your name? And what chemistry question do you have?', 'Call me the ATOMLAB teacher. Let us get to know each other through chemistry: which topic interests you?'],
  },
  whatCanYouDo: {
    ru: [
      'Объясняю любую тему химии — от 7 класса до университета, решаю и проверяю задачи, уравниваю реакции, помогаю с домашним заданием. Попробуй: «объясни, что такое моль».',
      'Могу объяснить тему по химии простыми словами, привести пример, разобрать задачу по шагам и проверить твой ответ. С чего начнём?',
    ],
    uz: [
      'Kimyoning istalgan mavzusini tushuntiraman — 7-sinfdan universitetgacha, masalalarni yechaman va tekshiraman, reaksiyalarni tenglashtiraman, uy vazifasiga yordam beraman. Sinab koʻring: «mol nima, tushuntiring».',
      'Kimyo mavzusini sodda tilda tushuntira olaman, misol keltiraman, masalani bosqichma-bosqich yechaman va javobingizni tekshiraman. Nimadan boshlaymiz?',
    ],
    en: [
      'I explain any chemistry topic — from school to university, solve and check problems, balance equations and help with homework. Try: “explain what a mole is”.',
      'I can explain a chemistry topic in simple words, give an example, solve a problem step by step and check your answer. Where shall we start?',
    ],
  },
  thanks: {
    ru: ['Пожалуйста! Рад помочь. Если что-то ещё по химии непонятно — спрашивай.', 'Всегда рад! Хочешь закрепить тему по химии небольшим вопросом?', 'Не за что! Ты хорошо работаешь. Идём дальше по химии?'],
    uz: ['Arzimaydi! Yordam berganimdan xursandman. Kimyodan yana tushunarsiz narsa boʻlsa — soʻrang.', 'Doim xursandman! Kimyo mavzusini kichik savol bilan mustahkamlaymizmi?', 'Arzimaydi! Yaxshi ishlayapsiz. Kimyoda davom etamizmi?'],
    en: ['You are welcome! Glad to help. If anything else in chemistry is unclear — just ask.', 'Any time! Want to lock in the chemistry topic with a quick question?', 'No problem! You are doing well. Shall we keep going with chemistry?'],
  },
  bye: {
    ru: ['Пока! Было приятно позаниматься. Возвращайся с новыми вопросами по химии.', 'До встречи! Удачи на уроке — химия тебя ждёт.', 'Всего доброго! Если вспомнишь вопрос по химии — я здесь.'],
    uz: ['Xayr! Birga shugʻullanish yoqimli boʻldi. Kimyodan yangi savollar bilan qayting.', 'Koʻrishguncha! Darsda omad — kimyo sizni kutadi.', 'Salomat boʻling! Kimyodan savol esingizga tushsa — men shu yerdaman.'],
    en: ['Bye! It was a pleasure working together. Come back with new chemistry questions.', 'See you! Good luck in class — chemistry is waiting.', 'Take care! If a chemistry question comes up — I am here.'],
  },
  sorry: {
    ru: ['Всё в порядке, не переживай! Давай продолжим — какой вопрос по химии?', 'Ничего страшного! Ошибаться — нормально, так и учатся. Что разберём в химии?'],
    uz: ['Hammasi joyida, xavotir olmang! Davom etamiz — kimyodan qanday savol?', 'Hech qisi yoʻq! Xato qilish — tabiiy, shunday oʻrganiladi. Kimyodan nimani koʻramiz?'],
    en: ['It is all right, no worries! Let us continue — what is your chemistry question?', 'No problem at all! Mistakes are how we learn. What shall we look at in chemistry?'],
  },
  praise: {
    ru: ['Спасибо, приятно! Но главный молодец — ты, раз разбираешься в химии. Продолжим?', 'Спасибо! Вместе у нас отлично получается. Какую тему по химии возьмём следующей?'],
    uz: ['Rahmat, yoqimli! Lekin asosiy qahramon — siz, kimyoni oʻrganyapsiz. Davom etamizmi?', 'Rahmat! Birgalikda juda yaxshi chiqyapti. Kimyodan keyingi qaysi mavzuni olamiz?'],
    en: ['Thank you, that is kind! But the real star is you for working on chemistry. Shall we continue?', 'Thanks! We make a good team. Which chemistry topic next?'],
  },
  areYouBot: {
    ru: ['Я ИИ-учитель химии — программа, но объясняю по-человечески и рассуждаю от законов природы. Давай проверим на химическом вопросе?', 'Я искусственный интеллект, который очень любит химию. Задай вопрос по химии — посмотрим, как я рассуждаю.'],
    uz: ['Men kimyo SI-oʻqituvchisiman — dastur, lekin odamdek tushuntiraman va tabiat qonunlaridan kelib chiqib fikrlayman. Kimyoviy savolda sinab koʻramizmi?', 'Men kimyoni juda yaxshi koʻradigan sun’iy intellektman. Savol bering — qanday fikrlashimni koʻrasiz.'],
    en: ['I am an AI chemistry teacher — a program, but I explain like a person and reason from the laws of nature. Want to test me on a chemistry question?', 'I am an artificial intelligence that loves chemistry. Ask a chemistry question and see how I reason.'],
  },
  age: {
    ru: ['Мой возраст — как у свежего учебника: я молод, но знаю законы, которым сотни лет. Какой вопрос по химии разберём?', 'Я совсем новый, а вот химия — древняя наука. Спроси что-нибудь по химии, и проверим мои знания!'],
    uz: ['Yoshim — yangi darslikdek: yoshman, lekin yuzlab yillik qonunlarni bilaman. Kimyodan qaysi savolni koʻramiz?', 'Men juda yangiman, kimyo esa qadimiy fan. Kimyodan biror narsa soʻrang — bilimimni tekshiramiz!'],
    en: ['My age is like a fresh textbook: young, but I know laws that are centuries old. Which chemistry question shall we look at?', 'I am quite new, but chemistry is an ancient science. Ask me a chemistry question and test my knowledge!'],
  },
}

/** Приоритет при нескольких совпадениях: смысловые виды важнее приветствий. */
const PRIORITY: readonly SmalltalkKind[] = [
  'whatCanYouDo',
  'whoAreYou',
  'name',
  'areYouBot',
  'age',
  'howAreYou',
  'thanks',
  'bye',
  'night',
  'sorry',
  'praise',
  'morning',
  'afternoon',
  'evening',
  'hello',
]

export interface SmalltalkMatch {
  kind: SmalltalkKind
  lang: PolicyLang
  reply: string
}

/**
 * Реплика целиком светская? Возвращает тёплый ответ на языке реплики, иначе null.
 * `seed` — детерминированный выбор варианта.
 */
export function detectSmalltalk(text: string, opts: { seed?: number; fallbackLang?: PolicyLang } = {}): SmalltalkMatch | null {
  const src = foldForPolicy(text).trim()
  if (!src || src.length > 90) return null
  // Химические термины и вопросы по сути — не светская беседа.
  if (/[0-9₀-₉=+→]|(?<!\p{L})(что\s+такое|почему|зачем|объясни|реши|nima\s+uchun|tushuntir|explain|why|what\s+is|solve)(?!\p{L})/u.test(src)) return null
  let rest = src
  const found: Pattern[] = []
  for (const pat of PATTERNS) {
    pat.re.lastIndex = 0
    if (pat.re.test(rest)) {
      found.push(pat)
      pat.re.lastIndex = 0
      rest = rest.replace(pat.re, ' ')
    }
  }
  if (!found.length) return null
  rest = rest.replace(FILLER, ' ').replace(/[^\p{L}]+/gu, ' ').trim()
  // Остаток не пуст — в реплике есть ещё что-то, кроме светских слов.
  if (rest.length > 0) return null
  const best = PRIORITY.map((k) => found.find((f) => f.kind === k)).find(Boolean)!
  const lang = found.find((f) => f.lang !== 'ru')?.lang ?? (/\p{Script=Latin}/u.test(src) && !/\p{Script=Cyrillic}/u.test(src) ? 'en' : best.lang)
  const pool = REPLIES[best.kind][lang]
  const seed = Math.abs(Math.floor(opts.seed ?? Date.now() / 1000))
  let reply = pool[seed % pool.length]!
  // «Привет, как дела?» — приветствие перед ответом на «как дела».
  if (best.kind !== 'hello' && found.some((f) => f.kind === 'hello')) {
    const hi = lang === 'en' ? 'Hi!' : lang === 'uz' ? 'Salom!' : 'Привет!'
    if (!reply.startsWith(hi)) reply = `${hi} ${reply}`
  }
  return { kind: best.kind, lang, reply }
}

/** Количество шаблонов (для проверки «≥ 40»). */
export const SMALLTALK_PATTERN_COUNT = PATTERNS.length
