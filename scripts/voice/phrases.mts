/**
 * Фразы тестового аудио «Голос»: по 30 на язык (ru / uz-латиница / en), два голоса Edge Neural на язык
 * (чередуются), категории: question (вопросы по химии), formula (формулы словами), number (числа),
 * command (команды уроку), everyday (бытовые). Плюс фразы учителя для эха и слово для «Проверить микрофон».
 */
export type VoiceLang = 'ru' | 'uz' | 'en'
export type PhraseCat = 'question' | 'formula' | 'number' | 'command' | 'everyday' | 'teacher' | 'check'

export interface Phrase {
  id: string
  lang: VoiceLang
  text: string
  voice: string
  cat: PhraseCat
}

export const VOICES: Record<VoiceLang, [string, string]> = {
  ru: ['ru-RU-DmitryNeural', 'ru-RU-SvetlanaNeural'],
  uz: ['uz-UZ-SardorNeural', 'uz-UZ-MadinaNeural'],
  en: ['en-US-GuyNeural', 'en-US-AriaNeural'],
}

/** Голос учителя для эха (как озвучка урока). */
export const TEACHER_VOICE = 'ru-RU-DmitryNeural'

const CATS: PhraseCat[] = [
  ...Array<PhraseCat>(10).fill('question'),
  ...Array<PhraseCat>(5).fill('formula'),
  ...Array<PhraseCat>(5).fill('number'),
  ...Array<PhraseCat>(5).fill('command'),
  ...Array<PhraseCat>(5).fill('everyday'),
]

const RU = [
  'что такое валентность',
  'аш два эс о четыре это кислота?',
  'молярная масса воды восемнадцать грамм на моль',
  'как получить кислород в лаборатории',
  'почему натрий хранят под слоем керосина',
  'чем отличается оксид от гидроксида',
  'сколько протонов в атоме углерода',
  'какая степень окисления у серы в серной кислоте',
  'что получится если смешать соляную кислоту и гидроксид натрия',
  'объясни что такое электроотрицательность',
  'эн а о аш реагирует с аш хлор',
  'це о два это углекислый газ',
  'аш два о это вода',
  'ка эм эн о четыре называется перманганат калия',
  'фе два о три это оксид железа',
  'двадцать пять грамм соли растворили в ста граммах воды',
  'массовая доля равна двенадцати процентам',
  'температура кипения воды сто градусов',
  'в реакцию вступило два моля водорода',
  'ответ сорок четыре грамма',
  'стоп',
  'повтори',
  'следующий вопрос',
  'объясни ещё раз помедленнее',
  'давай другую тему',
  'здравствуйте, я готов к уроку',
  'я не понял, можно проще',
  'спасибо, всё понятно',
  'подождите минутку',
  'сегодня у нас контрольная по химии',
]

const UZ = [
  'kislorod qanday olinadi',
  'molyar massa nima',
  'valentlik nima',
  'suvning molyar massasi oʻn sakkiz gramm',
  'natriy nima uchun kerosin ostida saqlanadi',
  'oksid bilan gidroksidning farqi nima',
  'uglerod atomida nechta proton bor',
  'sulfat kislotada oltingugurtning oksidlanish darajasi qanday',
  "xlorid kislota va natriy gidroksid aralashtirilsa nima hosil bo'ladi",
  'elektromanfiylik nima ekanini tushuntirib bering',
  'ash ikki o bu suv',
  'se o ikki bu karbonat angidrid',
  'en a o ash ishqor hisoblanadi',
  "ash ikki es o to'rt sulfat kislota",
  'ka el kaliy xlorid',
  'yigirma besh gramm tuz yuz gramm suvda eritildi',
  "massa ulushi o'n ikki foiz",
  'suvning qaynash harorati yuz daraja',
  "javob qirq to'rt gramm",
  'ikki mol vodorod reaksiyaga kirishdi',
  "to'xta",
  'takrorlang',
  'keyingi savol',
  'sekinroq tushuntiring',
  'boshqa mavzuga oʻtaylik',
  'assalomu alaykum, men darsga tayyorman',
  'tushunmadim, soddaroq tushuntiring',
  'rahmat, hammasi tushunarli',
  'bir daqiqa kuting',
  'bugun kimyodan nazorat ishi bor',
]

const EN = [
  'what is the valence of oxygen',
  'how do you get oxygen in the laboratory',
  'what is molar mass',
  'the molar mass of water is eighteen grams per mole',
  'why is sodium stored under kerosene',
  'what is the difference between an oxide and a hydroxide',
  'how many protons are in a carbon atom',
  'what is the oxidation state of sulfur in sulfuric acid',
  'what happens when hydrochloric acid reacts with sodium hydroxide',
  'explain electronegativity in simple words',
  'h two o is water',
  'c o two is carbon dioxide',
  'h two s o four is a strong acid',
  'n a o h reacts with h c l',
  'k m n o four is potassium permanganate',
  'twenty five grams of salt in one hundred grams of water',
  'the mass fraction is twelve percent',
  'water boils at one hundred degrees',
  'the answer is forty four grams',
  'two moles of hydrogen reacted',
  'stop',
  'repeat that',
  'next question',
  'explain it again more slowly',
  "let's change the topic",
  'hello, I am ready for the lesson',
  'I did not understand, can you make it simpler',
  'thank you, everything is clear',
  'wait a minute please',
  'we have a chemistry test today',
]

function build(lang: VoiceLang, texts: string[]): Phrase[] {
  return texts.map((text, i) => ({
    id: `${lang}-${String(i + 1).padStart(2, '0')}`,
    lang,
    text,
    voice: VOICES[lang][i % 2],
    cat: CATS[i],
  }))
}

export const PHRASES: Phrase[] = [...build('ru', RU), ...build('uz', UZ), ...build('en', EN)]

/** Фразы учителя: подаются как вход микрофона во время озвучки — реплики ученика быть не должно. */
export const TEACHER_PHRASES: Phrase[] = [
  'Хорошо, давай разберём, что такое валентность. Это способность атома образовывать химические связи.',
  'Молярная масса воды равна восемнадцати граммам на моль.',
  'Отлично! Теперь скажи, какой газ выделяется, когда цинк реагирует с соляной кислотой?',
].map((text, i) => ({ id: `echo-${String(i + 1).padStart(2, '0')}`, lang: 'ru', text, voice: TEACHER_VOICE, cat: 'teacher' }))

/** Слово экрана «Проверить микрофон» (#/voice-check: «скажите: кислород»). */
export const CHECK_PHRASE: Phrase = { id: 'check-kislorod', lang: 'ru', text: 'кислород', voice: 'ru-RU-SvetlanaNeural', cat: 'check' }

/** Какие клипы кладём в репозиторий (scripts/voice/fixtures, 16 кГц, ≤ 1,5 МБ) — для e2e без сети. */
export const FIXTURE_IDS = ['ru-01', 'ru-03', 'ru-26','uz-01', 'uz-04', 'en-01', 'en-04', 'echo-02', 'check-kislorod']
