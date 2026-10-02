/**
 * Генератор размеченного датасета намерений ученика (RU/EN/UZ) из шаблонов.
 * Слоты заполняются именами веществ и элементов из данных проекта (без выдуманной химии),
 * добавляются опечатки и разговорные формы. Часть фраз откладывается (heldout) для оценки.
 *
 *   npm run teacher:intent-data  →  scripts/teacher-ml/data/intent-dataset.json
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { INTENTS, type Intent } from '../../src/learn/brain/ml/intentFeatures.ts'
import { ELEMENTS } from '../../src/data/elements.ts'
import { INORGANIC_RAW } from '../../src/data/inorganicCompounds.data.ts'
import { TEXTBOOK_EXTRA_RAW } from '../../src/data/textbookCompounds.data.ts'

const here = dirname(fileURLToPath(import.meta.url))
const OUT = join(here, 'data', 'intent-dataset.json')

let seed = 20261002
const rnd = (): number => {
  seed = (seed * 48271) % 2147483647
  return seed / 2147483647
}
const pick = <T>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)]!

// ---------------------------------------------------------------- слоты из данных проекта
const SUB = '₀₁₂₃₄₅₆₇₈₉'
const plainFormula = (f: string) => f.replace(/[₀-₉]/g, (d) => String(SUB.indexOf(d)))
const compounds = [...INORGANIC_RAW, ...TEXTBOOK_EXTRA_RAW]
  .filter((c) => c.nameRu && c.formulaUnicode && c.formulaUnicode.length <= 12)
  .slice(0, 260)
const SUBST_RU = compounds.map((c) => c.nameRu.toLowerCase())
const SUBST_F = compounds.map((c) => (rnd() < 0.5 ? c.formulaUnicode : plainFormula(c.formulaUnicode)))
const ELEM_RU = ELEMENTS.slice(0, 56).map((e) => e.nameRu.toLowerCase())
const ELEM_SYM = ELEMENTS.slice(0, 56).map((e) => e.symbol)
const ELEM_EN = ['oxygen', 'hydrogen', 'carbon', 'nitrogen', 'sodium', 'iron', 'copper', 'chlorine', 'sulfur', 'calcium', 'potassium', 'aluminium', 'zinc', 'magnesium', 'phosphorus']
const ELEM_UZ = ['kislorod', 'vodorod', 'uglerod', 'azot', 'natriy', 'temir', 'mis', 'xlor', 'oltingugurt', 'kalsiy', 'kaliy', 'alyuminiy', 'rux', 'magniy', 'fosfor']
const SUBST_EN = ['water', 'carbon dioxide', 'table salt', 'sulfuric acid', 'ammonia', 'methane', 'sodium hydroxide', 'calcium oxide', 'hydrochloric acid', 'copper sulfate']
const SUBST_UZ = ['suv', 'karbonat angidrid', 'osh tuzi', 'sulfat kislota', 'ammiak', 'metan', 'natriy gidroksid', 'kalsiy oksid', 'xlorid kislota', 'mis sulfat']
const TOPIC_RU = ['оксиды', 'кислоты', 'основания', 'соли', 'валентность', 'моль', 'молярная масса', 'периодическая система', 'химическая связь', 'ионная связь', 'ковалентная связь', 'степень окисления', 'электролиз', 'скорость реакции', 'катализатор', 'растворы', 'массовая доля', 'реакция замещения', 'реакция обмена', 'окислительно-восстановительные реакции', 'атом', 'молекула', 'изотопы', 'электроотрицательность', 'гидролиз', 'амфотерность', 'аллотропия', 'металлы', 'неметаллы', 'галогены', 'щёлочи', 'индикаторы', 'закон сохранения массы', 'число авогадро', 'относительная атомная масса', 'простые вещества', 'сложные вещества', 'химическое уравнение', 'коррозия', 'сплавы', 'углеводороды', 'алканы', 'спирты', 'белки', 'жиры', 'полимеры']
const TOPIC_EN = ['oxides', 'acids', 'bases', 'salts', 'valence', 'mole', 'molar mass', 'periodic table', 'chemical bond', 'ionic bond', 'covalent bond', 'oxidation state', 'electrolysis', 'reaction rate', 'catalyst', 'solutions', 'mass fraction', 'redox reactions', 'atom', 'molecule', 'isotopes', 'electronegativity', 'hydrolysis', 'metals', 'nonmetals', 'halogens', 'indicators', 'alkanes', 'alcohols', 'polymers']
const TOPIC_UZ = ['oksidlar', 'kislotalar', 'asoslar', 'tuzlar', 'valentlik', 'mol', 'molyar massa', 'davriy jadval', 'kimyoviy bog‘', 'ion bog‘', 'kovalent bog‘', 'oksidlanish darajasi', 'elektroliz', 'reaksiya tezligi', 'katalizator', 'eritmalar', 'massa ulushi', 'atom', 'molekula', 'izotoplar', 'gidroliz', 'metallar', 'metallmaslar', 'galogenlar', 'indikatorlar', 'alkanlar', 'spirtlar', 'polimerlar']
const NUM = () => String(Math.floor(rnd() * 98) + 2)
const NUM2 = () => (rnd() < 0.5 ? String(Math.floor(rnd() * 900) + 10) : (Math.floor(rnd() * 500) / 10).toString().replace('.', ','))

type Lang = 'ru' | 'en' | 'uz'
const SLOTS: Record<Lang, Record<string, () => string>> = {
  ru: {
    subst: () => (rnd() < 0.55 ? pick(SUBST_RU) : pick(SUBST_F)),
    elem: () => (rnd() < 0.65 ? pick(ELEM_RU) : pick(ELEM_SYM)),
    topic: () => pick(TOPIC_RU),
    f: () => pick(SUBST_F),
    n: NUM,
    m: NUM2,
  },
  en: { subst: () => (rnd() < 0.55 ? pick(SUBST_EN) : pick(SUBST_F)), elem: () => (rnd() < 0.65 ? pick(ELEM_EN) : pick(ELEM_SYM)), topic: () => pick(TOPIC_EN), f: () => pick(SUBST_F), n: NUM, m: NUM2 },
  uz: { subst: () => (rnd() < 0.55 ? pick(SUBST_UZ) : pick(SUBST_F)), elem: () => (rnd() < 0.65 ? pick(ELEM_UZ) : pick(ELEM_SYM)), topic: () => pick(TOPIC_UZ), f: () => pick(SUBST_F), n: NUM, m: NUM2 },
}

// ---------------------------------------------------------------- шаблоны
type T = Partial<Record<Lang, string[]>>
const TEMPLATES: Record<Intent, T> = {
  greet: {
    ru: ['привет', 'привет!', 'приветик', 'здравствуйте', 'здравствуй', 'добрый день', 'доброе утро', 'добрый вечер', 'хай', 'хей', 'салют', 'здарова', 'приветствую', 'здравствуйте учитель', 'привет учитель', 'доброго времени суток', 'ку', 'здравствуйте, можно вопрос', 'привет, я тут', 'хелло', 'добрый день, учитель', 'приветики', 'хай, как ты', 'я пришёл', 'я снова тут', 'здравствуй учитель я готов'],
    en: ['hi', 'hello', 'hey', 'hi there', 'good morning', 'good afternoon', 'good evening', 'hello teacher', 'hey teacher', 'hiya', 'yo', 'greetings', 'hello, can i ask', 'hi im here', 'morning!'],
    uz: ['salom', 'assalomu alaykum', 'salom ustoz', 'xayrli tong', 'xayrli kun', 'xayrli kech', 'salom, men keldim', 'assalomu alaykum ustoz', 'salom!', 'hayrli kun'],
  },
  bye: {
    ru: ['пока', 'пока!', 'до свидания', 'до встречи', 'увидимся', 'я пошёл', 'мне пора', 'всё, пока', 'спокойной ночи', 'до завтра', 'бывай', 'ладно, я пойду', 'ну всё, до связи', 'пока пока', 'прощай', 'я ухожу, пока', 'на сегодня всё', 'до скорого', 'досвидания', 'пока, спасибо за урок'],
    en: ['bye', 'goodbye', 'see you', 'see ya', 'gotta go', 'i have to go', 'good night', 'see you tomorrow', 'bye bye', 'talk later', 'thats all for today', 'cya', 'im leaving now', 'later!'],
    uz: ['xayr', 'ko‘rishguncha', 'xayr ustoz', 'men ketdim', 'ertaga ko‘rishamiz', 'xayrli tun', 'bugun shu', 'ketishim kerak', 'hayr', 'korishguncha'],
  },
  thanks: {
    ru: ['спасибо', 'спасибо!', 'спасибо большое', 'большое спасибо', 'благодарю', 'спс', 'спасибо, понял', 'спасибо, теперь понятно', 'огромное спасибо', 'спасибо тебе', 'спасибо учитель', 'сенкс', 'спасибки', 'пасиба', 'мерси', 'благодарствую', 'спасибо за объяснение', 'спасибо за помощь', 'спасибо, выручил', 'ты очень помог, спасибо'],
    en: ['thanks', 'thank you', 'thanks a lot', 'thank you so much', 'thx', 'ty', 'thanks, got it', 'thank you teacher', 'cheers', 'thanks for the help', 'many thanks', 'thanks, that helped', 'appreciate it'],
    uz: ['rahmat', 'katta rahmat', 'rahmat ustoz', 'tushundim, rahmat', 'yordam uchun rahmat', 'rahmat sizga', 'raxmat', 'minnatdorman', 'tashakkur', 'rahmat, endi tushunarli'],
  },
  how_are_you: {
    ru: ['как дела?', 'как дела', 'как ты?', 'как у тебя дела', 'как настроение', 'как поживаешь', 'что нового', 'как жизнь', 'как сам', 'как ты сегодня', 'у тебя всё хорошо?', 'как делишки', 'как твои дела учитель', 'ты как', 'как оно', 'чем занимаешься', 'как прошёл день', 'как настрой'],
    en: ['how are you', 'how are you?', 'how are you doing', 'how is it going', 'hows it going', 'whats up', 'how do you feel today', 'you ok?', 'how have you been', 'how are things', 'sup', 'how is your day'],
    uz: ['qalaysiz', 'yaxshimisiz', 'ishlar qalay', 'kayfiyat qanday', 'qandaysiz ustoz', 'ahvolingiz qanday', 'yaxshimisan', 'ishlaring qalay', 'nima gaplar', 'qalaysan'],
  },
  joke: {
    ru: ['пошути', 'расскажи шутку', 'расскажи анекдот', 'ещё шутку', 'рассмеши меня', 'знаешь анекдот про химию', 'шутку про химиков', 'давай шутку', 'пошути про атомы', 'расскажи что-нибудь смешное', 'хочу шутку', 'анекдот плиз', 'есть шутка?', 'повесели меня', 'шутка про {elem}', 'расскажи химическую шутку', 'ещё одну шутку', 'скажи что нибудь смешное'],
    en: ['tell me a joke', 'make me laugh', 'a chemistry joke please', 'another joke', 'do you know any jokes', 'say something funny', 'joke please', 'tell a joke about {elem}', 'got a joke?', 'one more joke', 'funny chemistry joke'],
    uz: ['hazil ayting', 'latifa ayting', 'kuldiring meni', 'kimyo haqida hazil', 'yana bitta hazil', 'biror kulgili narsa ayting', 'hazil aytib bering', 'latifa bormi', 'kulgili gap ayting', '{elem} haqida hazil'],
  },
  about_teacher: {
    ru: ['кто ты?', 'кто ты', 'ты кто', 'ты робот?', 'ты человек или бот', 'как тебя зовут', 'что ты умеешь', 'что ты можешь', 'расскажи о себе', 'ты настоящий учитель?', 'ты ии?', 'откуда ты знаешь химию', 'кто тебя сделал', 'ты живой', 'сколько тебе лет', 'чем ты можешь помочь', 'что ты за программа', 'ты умный?', 'как ты работаешь', 'ты понимаешь меня?', 'ты учитель химии?', 'что ты знаешь'],
    en: ['who are you', 'who are you?', 'are you a robot', 'are you human', 'what is your name', 'what can you do', 'tell me about yourself', 'are you an ai', 'who made you', 'how do you work', 'are you real', 'what do you know', 'how old are you', 'can you help me with chemistry'],
    uz: ['siz kimsiz', 'sen kimsan', 'robotmisiz', 'ismingiz nima', 'nima qila olasiz', 'o‘zingiz haqingizda gapiring', 'siz sun‘iy intellektmisiz', 'sizni kim yaratgan', 'qanday ishlaysiz', 'siz kimyo o‘qituvchisimisiz', 'nimalarni bilasiz'],
  },
  offtopic: {
    ru: ['какая завтра погода', 'кто выиграл матч вчера', 'посоветуй фильм', 'какой курс доллара', 'сколько стоит айфон', 'расскажи про футбол', 'как приготовить плов', 'кто президент франции', 'напиши стих про любовь', 'какая столица австралии', 'помоги с математикой, уравнение x^2', 'реши по физике задачу про скорость поезда', 'что задали по истории', 'давай поиграем в майнкрафт', 'кто такой месси', 'какой сегодня праздник', 'ты смотрел аниме', 'расскажи про динозавров', 'какая самая быстрая машина', 'как выучить английский', 'сколько планет в солнечной системе', 'напиши сочинение про осень', 'переведи текст на английский', 'какой твой любимый цвет', 'давай поболтаем о музыке', 'расскажи про войну 1812 года', 'как скачать игру', 'сколько будет жить человек на марсе', 'что такое биткоин', 'как похудеть', 'посоветуй книгу про приключения', 'хочу спать, расскажи сказку', 'как пройти уровень в игре', 'какая погода в ташкенте'],
    en: ['whats the weather tomorrow', 'who won the game last night', 'recommend a movie', 'what is the dollar rate', 'tell me about football', 'how to cook pasta', 'who is the president of france', 'write a poem about love', 'capital of australia', 'help with my history essay', 'lets play minecraft', 'who is messi', 'tell me about dinosaurs', 'how to learn english fast', 'what is bitcoin', 'whats your favourite color', 'recommend a book', 'tell me a fairy tale', 'how many planets are there', 'solve x^2 - 4 = 0 for math class'],
    uz: ['ertaga ob-havo qanday', 'kecha kim yutdi', 'kino tavsiya qiling', 'dollar kursi qancha', 'futbol haqida gapiring', 'osh qanday pishiriladi', 'fransiya prezidenti kim', 'sevgi haqida she‘r yozing', 'avstraliya poytaxti', 'tarixdan uy vazifasi', 'minecraft o‘ynaymizmi', 'messi kim', 'dinozavrlar haqida', 'ingliz tilini qanday o‘rganish mumkin', 'bitkoin nima', 'sevimli rangingiz qanday', 'ertak aytib bering', 'toshkentda ob-havo qanday'],
  },
  gibberish: {
    ru: ['ммм', 'ммммм', 'ээээ', 'ааа', 'ыыы', 'фывапролдж', 'йцукен', 'лллл', 'ъъъ', 'прлорло', 'кекекек', 'хм', 'ээ ну', 'асдф', 'ололо', 'ы', 'щщщ', 'ждлоадо', '...', '???', 'бла бла бла', 'тест тест', 'ыва', 'апролд', 'жжж', 'рпаврпа', 'ваыва', 'ццц', 'йй', 'nhbdtn', 'ghbdtn', 'zxcv', 'ф', 'мда', 'эмм'],
    en: ['asdf', 'qwerty', 'hmm', 'uhh', 'zzz', 'lol lol', 'sdfgh', 'kjhgf', 'mmm', 'ehh', 'blah blah', 'test', 'aaaaa', 'xcvb', 'qqq', '!!!', 'uhm', 'erm'],
    uz: ['hmm', 'eee', 'mmm', 'asdfg', 'qwert', 'xxx', 'eh', 'hm hm', 'blah', 'yyy'],
  },
  define: {
    ru: ['что такое {topic}', 'что такое {topic}?', 'что значит {topic}', 'объясни что такое {topic}', 'дай определение {topic}', 'определение {topic}', 'что называют {topic}', '{topic} это что', '{topic} — это', 'расскажи что такое {topic}', 'что означает термин {topic}', 'поясни термин {topic}', 'что такое {subst}', 'что такое {elem}', 'кто такие {topic}', 'что имеют в виду под {topic}', 'что подразумевают под {topic}', 'расшифруй понятие {topic}', 'а что такое {topic}', 'не знаю что такое {topic}', 'какое определение у {topic}', 'что такое вообще {topic}'],
    en: ['what is {topic}', 'what is {topic}?', 'define {topic}', 'what does {topic} mean', 'definition of {topic}', 'explain what {topic} is', 'what are {topic}', 'what is {subst}', 'what is {elem}', 'meaning of {topic}', 'what do we call {topic}', 'what is meant by {topic}'],
    uz: ['{topic} nima', '{topic} nima?', '{topic} deganda nima tushuniladi', '{topic} ta‘rifi', '{topic} nimani anglatadi', '{topic} degani nima', '{subst} nima', '{elem} nima', '{topic} haqida tushuntiring nima ekanini', '{topic} nima degani'],
  },
  why: {
    ru: ['почему {subst} растворяется в воде', 'почему {elem} реагирует с водой', 'почему {topic} так называются', 'почему это происходит', 'почему так', 'а почему', 'почему {subst} не горит', 'из-за чего {topic} меняют цвет индикатора', 'почему металлы проводят ток', 'почему железо ржавеет', 'почему вода кипит при 100 градусах', 'отчего {subst} выпадает в осадок', 'почему реакция идёт с выделением тепла', 'почему {elem} инертный', 'в чём причина того что {topic} реагируют', 'почему нельзя смешивать {subst} и {subst}', 'зачем нужен катализатор', 'почему атом нейтральный', 'почему газы сжимаются', 'а почему именно так', 'почему у {elem} такая валентность'],
    en: ['why does {subst} dissolve in water', 'why does {elem} react with water', 'why is that', 'why does iron rust', 'why do metals conduct electricity', 'why is the reaction exothermic', 'why is {elem} inert', 'why do {topic} change indicator color', 'why does this happen', 'why is the atom neutral', 'why does {subst} precipitate', 'why do we need a catalyst'],
    uz: ['nega {subst} suvda eriydi', 'nima uchun {elem} suv bilan reaksiyaga kirishadi', 'nega shunday', 'nima uchun temir zanglaydi', 'nega metallar tok o‘tkazadi', 'nima uchun bu sodir bo‘ladi', 'nega {elem} inert', 'nima uchun atom neytral', 'nega {subst} cho‘kmaga tushadi', 'nima uchun katalizator kerak'],
  },
  how: {
    ru: ['как получить {subst}', 'как получают {subst}', 'как образуется {subst}', 'как найти валентность {elem}', 'как определить степень окисления в {f}', 'как составить формулу {subst}', 'как работает {topic}', 'каким способом получают {elem}', 'как происходит {topic}', 'как протекает реакция {subst} с водой', 'как распознать {subst}', 'как отличить кислоту от щёлочи', 'как расставить степени окисления', 'как читать формулу {f}', 'как собрать {subst} в лаборатории', 'как идёт электролиз', 'как получить {elem} из {subst}', 'как устроен атом', 'как записать уравнение диссоциации {f}', 'каким образом {topic} влияют на реакцию', 'как определить тип связи в {f}'],
    en: ['how to get {subst}', 'how is {subst} produced', 'how is {subst} formed', 'how to find the valence of {elem}', 'how to determine oxidation state in {f}', 'how does {topic} work', 'how to write the formula of {subst}', 'how to tell an acid from a base', 'how does electrolysis work', 'how is the atom built', 'how to recognize {subst}', 'how do {topic} affect the reaction'],
    uz: ['{subst} qanday olinadi', '{subst} qanday hosil bo‘ladi', '{elem} valentligini qanday topish mumkin', '{f} da oksidlanish darajasini qanday aniqlash mumkin', '{topic} qanday ishlaydi', '{subst} formulasi qanday tuziladi', 'kislotani ishqordan qanday ajratish mumkin', 'elektroliz qanday boradi', 'atom qanday tuzilgan', '{subst} ni qanday aniqlash mumkin'],
  },
  compare: {
    ru: ['чем отличается {subst} от {subst}', 'чем отличаются {topic} от {topic}', 'сравни {elem} и {elem}', 'в чём разница между {topic} и {topic}', 'что общего у {topic} и {topic}', '{elem} или {elem} активнее', 'что тяжелее {f} или {f}', 'сравни {subst} и {subst}', 'какая разница между атомом и молекулой', 'чем кислота отличается от основания', 'в чём отличие {elem} от {elem}', 'что сильнее {subst} или {subst}', 'отличие {topic} от {topic}', 'разница {topic} и {topic}', 'сопоставь {topic} и {topic}', 'что лучше растворяется {subst} или {subst}', 'кто активнее {elem} или {elem}', 'чем похожи {elem} и {elem}'],
    en: ['difference between {subst} and {subst}', 'how is {topic} different from {topic}', 'compare {elem} and {elem}', 'what is the difference between {topic} and {topic}', 'what do {topic} and {topic} have in common', 'which is more reactive, {elem} or {elem}', 'which is heavier, {f} or {f}', 'compare {subst} and {subst}', 'atom vs molecule', '{elem} vs {elem}', 'which is stronger {subst} or {subst}'],
    uz: ['{subst} bilan {subst} farqi nimada', '{topic} va {topic} farqi', '{elem} va {elem} ni solishtiring', '{topic} bilan {topic} o‘rtasidagi farq', '{elem} yoki {elem} faolroq', '{f} yoki {f} og‘irroq', '{subst} va {subst} ni taqqoslang', 'atom va molekula farqi', '{topic} va {topic} umumiyligi nimada', 'qaysi biri kuchliroq {subst} yoki {subst}'],
  },
  example: {
    ru: ['приведи пример {topic}', 'пример {topic}', 'примеры {topic}', 'можешь привести пример', 'дай пример реакции с {subst}', 'покажи на примере', 'например?', 'приведи примеры {topic} из жизни', 'какие бывают примеры {topic}', 'назови примеры {topic}', 'пример уравнения с {elem}', 'приведи 3 примера {topic}', 'а пример можно', 'покажи пример {topic}', 'есть пример?', 'где в жизни встречаются {topic}', 'приведи пример где используют {subst}', 'назови пару примеров {topic}'],
    en: ['give an example of {topic}', 'example of {topic}', 'examples of {topic}', 'can you give an example', 'show me an example', 'for example?', 'real life examples of {topic}', 'name some {topic}', 'give me 3 examples of {topic}', 'example reaction with {subst}', 'where do we meet {topic} in everyday life'],
    uz: ['{topic} ga misol keltiring', '{topic} misollari', 'misol keltiring', 'misol bilan ko‘rsating', 'masalan?', 'hayotdan {topic} misollari', '{subst} bilan reaksiyaga misol', '3 ta misol keltiring {topic}', '{topic} ga misol bormi', 'misol keltira olasizmi'],
  },
  calc_arith: {
    ru: ['сколько будет {n}+{n}', 'сколько будет {n} умножить на {n}', 'посчитай {n}*{n}', 'посчитай ({n}+{n})*{n}', '{n}+{n}*{n}', 'сколько будет {n} разделить на {n}', '{m}/{n}', 'вычисли {n}-{n}', 'сколько {n} плюс {n}', 'реши {n}*{n}+{n}', '{n} в квадрате', 'корень из {n}', '{n} процентов от {m}', 'сколько будет {m} минус {n}', 'посчитай мне {n}+{n}+{n}', '{m}*{n}=', 'умножь {n} на {n}', 'раздели {m} на {n}', 'что получится если {n} умножить на {n}', 'сколько будет {n}^2'],
    en: ['how much is {n}+{n}', 'what is {n} times {n}', 'calculate {n}*{n}', 'compute ({n}+{n})*{n}', '{n}+{n}*{n}', '{n} divided by {n}', '{m}/{n}', '{n} squared', 'square root of {n}', '{n} percent of {m}', 'what is {m} minus {n}', 'multiply {n} by {n}', '{m}*{n}='],
    uz: ['{n}+{n} necha bo‘ladi', '{n} ko‘paytiruv {n} necha', '{n}*{n} ni hisoblang', '({n}+{n})*{n} hisoblang', '{n}+{n}*{n}', '{n} bo‘lish {n}', '{m}/{n}', '{n} kvadrati', '{n} dan {m} foizi', '{m} minus {n} necha', '{m}*{n}='],
  },
  molar_mass: {
    ru: ['молярная масса {f}', 'какая молярная масса у {subst}', 'найди молярную массу {f}', 'чему равна молярная масса {subst}', 'M({f})', 'посчитай молярную массу {f}', 'сколько весит моль {subst}', 'молекулярная масса {f}', 'относительная молекулярная масса {f}', 'Mr {f}', 'какая масса одного моля {subst}', 'вычисли M {f}', 'молярная масса {elem}', 'сколько грамм в моле {subst}', 'масса моля {f}', 'найди Mr({f})', 'молярная масса {subst} сколько', 'подскажи молярную массу {f}', 'какая у {f} молярная масса'],
    en: ['molar mass of {f}', 'what is the molar mass of {subst}', 'find the molar mass of {f}', 'M({f})', 'molecular mass of {f}', 'relative molecular mass of {f}', 'how much does one mole of {subst} weigh', 'Mr of {f}', 'calculate molar mass {f}', 'molar mass {elem}', 'grams per mole of {subst}'],
    uz: ['{f} molyar massasi', '{subst} molyar massasi qancha', '{f} molyar massasini toping', 'M({f})', '{f} molekulyar massasi', 'bir mol {subst} necha gramm', '{f} nisbiy molekulyar massasi', '{elem} molyar massasi', '{f} molyar massasini hisoblang', '{subst} ning molyar massasi nechaga teng'],
  },
  moles: {
    ru: ['сколько моль в {m} г {f}', 'сколько молей в {m} граммах {subst}', 'найди количество вещества {m} г {f}', 'какая масса {n} моль {f}', 'сколько грамм в {n} моль {subst}', 'найди массу {n} моль {f}', 'сколько молекул в {n} моль {subst}', 'какой объём занимают {n} моль {subst} при н.у.', 'сколько литров {f} в {n} моль', 'сколько моль в {m} л {subst}', 'количество вещества {f} массой {m} г', 'переведи {m} г {f} в моли', 'сколько атомов в {n} моль {elem}', 'масса {n} моль {elem}', 'n({f}) если m={m} г', 'определи число моль {subst} массой {m} г', 'сколько молей содержится в {m} г {f}', 'объём {n} моль {f} н.у.'],
    en: ['how many moles in {m} g of {f}', 'moles in {m} grams of {subst}', 'find the amount of substance in {m} g of {f}', 'mass of {n} mol of {f}', 'how many grams in {n} mol of {subst}', 'how many molecules in {n} mol of {subst}', 'volume of {n} mol of {subst} at stp', 'convert {m} g of {f} to moles', 'how many atoms in {n} mol of {elem}', 'n({f}) if m = {m} g'],
    uz: ['{m} g {f} da necha mol bor', '{m} gramm {subst} necha mol', '{n} mol {f} massasi qancha', '{n} mol {subst} necha gramm', '{n} mol {subst} da nechta molekula bor', '{n} mol {subst} hajmi n.sh.da', '{m} g {f} ni molga aylantiring', '{n} mol {elem} da nechta atom', '{m} g {f} modda miqdori'],
  },
  units: {
    ru: ['переведи {m} мл в литры', 'сколько грамм в {n} кг', 'переведи {m} г в кг', '{n} л это сколько мл', 'сколько мл в литре', 'переведи {n} градусов цельсия в кельвины', '{m} кпа в паскали', 'сколько миллиграмм в {n} граммах', 'переведи {m} см3 в литры', '{n} дм3 это сколько литров', 'сколько в {n} тоннах килограмм', 'переведи {m} кдж в дж', 'сколько мл в {n} л', '{m} мг в г', 'переведи {n} атм в паскали', 'сколько секунд в {n} минутах', '{m} г это сколько мг', 'переведи {n} кельвин в цельсии'],
    en: ['convert {m} ml to liters', 'how many grams in {n} kg', 'convert {m} g to kg', '{n} l is how many ml', 'convert {n} celsius to kelvin', '{m} kpa in pascals', 'milligrams in {n} grams', '{m} cm3 to liters', '{n} dm3 in liters', 'convert {m} kj to j', '{m} mg to g', '{n} atm to pascals', '{n} kelvin to celsius'],
    uz: ['{m} ml ni litrga aylantiring', '{n} kg da necha gramm', '{m} g ni kg ga', '{n} l necha ml', '{n} selsiy kelvinda qancha', '{m} kpa paskalda', '{n} grammda necha milligramm', '{m} sm3 litrda', '{m} kj ni j ga', '{n} atm paskalda'],
  },
  problem: {
    ru: ['реши задачу: какая масса {subst} образуется из {m} г {subst}', 'задача: {m} г {f} растворили в {m} г воды, найди массовую долю', 'помоги решить задачу на массовую долю', 'найди массовую долю {elem} в {f}', 'вычисли массовую долю соли в растворе {m} г соли и {m} г воды', 'какой объём газа выделится при реакции {m} г {subst} с кислотой', 'реши задачу по уравнению {f} + {f}', 'задача: сколько грамм {subst} нужно для получения {m} г {subst}', 'найди выход продукта если получили {m} г вместо {m} г', 'рассчитай массовую долю {elem} в {subst}', 'реши: m({f}) = {m} г, найди V газа', 'задача на избыток и недостаток {f} и {f}', 'определи формулу вещества если массовая доля {elem} {n}%', 'какова концентрация раствора если {m} г {subst} в {m} мл воды', 'помоги с задачей на растворы', 'вычисли массу осадка при сливании растворов {subst} и {subst}', 'реши задачу про {subst} массой {m} г', 'какой объём {f} нужен для сжигания {m} г {subst}', 'задача: смесь {subst} и {subst} массой {m} г'],
    en: ['solve: what mass of {subst} forms from {m} g of {subst}', 'problem: {m} g of {f} dissolved in {m} g of water, find the mass fraction', 'help me solve a mass fraction problem', 'find the mass fraction of {elem} in {f}', 'what volume of gas is released when {m} g of {subst} reacts with acid', 'how many grams of {subst} are needed to get {m} g of {subst}', 'find the yield if {m} g obtained instead of {m} g', 'solve this stoichiometry problem with {f}', 'limiting reagent problem {f} and {f}', 'concentration of a solution of {m} g {subst} in {m} ml water'],
    uz: ['masala: {m} g {subst} dan qancha {subst} hosil bo‘ladi', 'masala: {m} g {f} {m} g suvda eritildi, massa ulushini toping', 'massa ulushiga oid masalani yechishga yordam bering', '{f} dagi {elem} massa ulushini toping', '{m} g {subst} kislota bilan reaksiyaga kirishganda qancha gaz ajraladi', '{m} g {subst} olish uchun necha gramm {subst} kerak', 'unumni toping: {m} g o‘rniga {m} g olindi', '{f} bo‘yicha masalani yeching', 'eritma konsentratsiyasi {m} g {subst} {m} ml suvda', 'masalani yechib bering {subst} {m} g'],
  },
  reaction_products: {
    ru: ['что получится если смешать {subst} и {subst}', 'что будет если {subst} добавить в воду', 'продукты реакции {f} + {f}', 'что образуется при реакции {subst} с {subst}', '{f} + {f} = ?', '{f} + {f} →', 'что получится при горении {subst}', 'что выделяется при разложении {subst}', 'с чем реагирует {subst}', 'реагирует ли {subst} с {subst}', 'что будет если нагреть {subst}', 'во что превращается {subst} при нагревании', 'что образуется при взаимодействии {elem} с кислородом', 'какие продукты у реакции {subst} с кислотой', '{f} плюс {f} что даёт', 'закончи уравнение {f} + {f}', 'допиши реакцию {f} + {f} →', 'что получается из {subst} и воды', 'куда идёт реакция {f} с {f}', 'взаимодействует ли {elem} с {subst}'],
    en: ['what happens if you mix {subst} and {subst}', 'what happens when {subst} is added to water', 'products of {f} + {f}', 'what forms when {subst} reacts with {subst}', '{f} + {f} = ?', '{f} + {f} →', 'what forms when {subst} burns', 'what is released when {subst} decomposes', 'what does {subst} react with', 'does {subst} react with {subst}', 'what happens if you heat {subst}', 'complete the equation {f} + {f}', 'finish the reaction {f} + {f} →'],
    uz: ['{subst} va {subst} aralashtirilsa nima bo‘ladi', '{subst} suvga qo‘shilsa nima bo‘ladi', '{f} + {f} mahsulotlari', '{subst} {subst} bilan reaksiyaga kirishganda nima hosil bo‘ladi', '{f} + {f} = ?', '{f} + {f} →', '{subst} yonganda nima hosil bo‘ladi', '{subst} parchalanganda nima ajraladi', '{subst} nima bilan reaksiyaga kirishadi', '{subst} qizdirilsa nima bo‘ladi', 'tenglamani tugating {f} + {f}'],
  },
  balance: {
    ru: ['уравняй {f} + {f} → {f}', 'расставь коэффициенты {f} + {f} = {f}', 'уравняй реакцию {f} + {f}', 'помоги уравнять {f} + {f} → {f} + {f}', 'расставь коэффициенты в уравнении горения {subst}', 'какие коэффициенты в {f} + {f} = {f}', 'уравнять {f}+{f}={f}', 'сбалансируй {f} + {f} → {f}', 'проверь коэффициенты {f} + {f} = {f}', 'правильно ли уравнено {f} + {f} = {f}', 'расставь коэффициенты методом электронного баланса {f} + {f}', 'уравняй методом электронного баланса', 'подбери коэффициенты {f} + {f} → {f}', 'уравняй разложение {subst}', 'коэффициенты для {f} + {f} = {f} + {f}'],
    en: ['balance {f} + {f} → {f}', 'balance the equation {f} + {f} = {f}', 'help me balance {f} + {f} → {f} + {f}', 'coefficients for {f} + {f} = {f}', 'balance combustion of {subst}', 'is {f} + {f} = {f} balanced', 'balance using electron balance method {f} + {f}', 'put coefficients in {f} + {f} → {f}'],
    uz: ['{f} + {f} → {f} ni tenglashtiring', '{f} + {f} = {f} koeffitsiyentlarini qo‘ying', '{f} + {f} → {f} + {f} ni tenglashtirishga yordam bering', '{f} + {f} = {f} uchun koeffitsiyentlar', '{subst} yonish tenglamasini tenglashtiring', 'elektron balans usuli bilan {f} + {f} ni tenglashtiring', '{f}+{f}={f} tenglashtiring'],
  },
  element_info: {
    ru: ['расскажи про {elem}', 'расскажи об элементе {elem}', 'что известно о {elem}', 'свойства {elem}', 'характеристика {elem}', 'в какой группе {elem}', 'какой период у {elem}', 'строение атома {elem}', 'электронная формула {elem}', 'сколько протонов у {elem}', 'сколько электронов у {elem}', 'атомная масса {elem}', 'порядковый номер {elem}', 'где применяют {elem}', '{elem} металл или неметалл', 'валентность {elem}', 'какие степени окисления у {elem}', 'сколько нейтронов у {elem}', 'дай характеристику элемента {elem} по положению в таблице', 'как распределены электроны у {elem}', 'информация про {elem}', 'элемент {elem}', 'что за элемент {elem}', 'физические свойства {elem}'],
    en: ['tell me about {elem}', 'properties of {elem}', 'what group is {elem} in', 'period of {elem}', 'atomic structure of {elem}', 'electron configuration of {elem}', 'how many protons does {elem} have', 'how many electrons in {elem}', 'atomic mass of {elem}', 'atomic number of {elem}', 'where is {elem} used', 'is {elem} a metal or a nonmetal', 'valence of {elem}', 'oxidation states of {elem}', 'info about element {elem}', 'the element {elem}'],
    uz: ['{elem} haqida gapiring', '{elem} xossalari', '{elem} qaysi guruhda', '{elem} davri', '{elem} atom tuzilishi', '{elem} elektron formulasi', '{elem} da nechta proton bor', '{elem} da nechta elektron', '{elem} atom massasi', '{elem} tartib raqami', '{elem} qayerda ishlatiladi', '{elem} metallmi yoki metallmasmi', '{elem} valentligi', '{elem} elementi haqida ma‘lumot'],
  },
  compound_info: {
    ru: ['расскажи про {subst}', 'расскажи о веществе {subst}', 'свойства {subst}', 'физические свойства {subst}', 'химические свойства {subst}', 'где применяют {subst}', 'применение {subst}', 'что за вещество {f}', 'какого цвета {subst}', 'растворяется ли {subst} в воде', '{subst} это кислота или соль', 'к какому классу относится {f}', 'формула {subst}', 'как называется {f}', 'название вещества {f}', 'строение {subst}', 'какой тип связи в {f}', 'что ты знаешь про {subst}', 'опиши {subst}', 'характеристика {subst}', '{f} что это', 'информация о {subst}', 'какие свойства у {subst}', 'ядовит ли {subst}', 'агрегатное состояние {subst}', 'где встречается {subst} в природе'],
    en: ['tell me about {subst}', 'properties of {subst}', 'physical properties of {subst}', 'chemical properties of {subst}', 'uses of {subst}', 'what substance is {f}', 'what color is {subst}', 'does {subst} dissolve in water', 'is {subst} an acid or a salt', 'what class is {f}', 'formula of {subst}', 'name of {f}', 'structure of {subst}', 'type of bond in {f}', 'describe {subst}', 'what do you know about {subst}', 'is {subst} toxic'],
    uz: ['{subst} haqida gapiring', '{subst} xossalari', '{subst} fizik xossalari', '{subst} kimyoviy xossalari', '{subst} qayerda ishlatiladi', '{f} qanday modda', '{subst} qanday rangda', '{subst} suvda eriydimi', '{subst} kislotami yoki tuzmi', '{f} qaysi sinfga kiradi', '{subst} formulasi', '{f} nomi nima', '{subst} tuzilishi', '{f} da bog‘ turi qanday', '{subst} ni tavsiflang'],
  },
  exam_me: {
    ru: ['проверь меня', 'задай вопрос', 'задай мне вопрос по {topic}', 'устрой опрос', 'проэкзаменуй меня', 'давай тест', 'дай тест по {topic}', 'задай задачку', 'проверь мои знания', 'спроси меня что-нибудь', 'хочу проверить себя', 'потренируй меня перед контрольной', 'дай вопросы на {topic}', 'задай вопрос как на экзамене', 'устрой мне экзамен', 'поспрашивай меня по {topic}', 'дай викторину по химии', 'проверь как я знаю {topic}', 'задавай вопросы', 'хочу порешать тест', 'давай повторим {topic} в вопросах', 'ещё вопрос', 'следующий вопрос', 'дай ещё задание'],
    en: ['quiz me', 'test me', 'ask me a question', 'ask me about {topic}', 'give me a test on {topic}', 'check my knowledge', 'ask me something', 'i want to test myself', 'practice questions on {topic}', 'examine me', 'next question', 'one more question', 'give me a quiz', 'drill me on {topic}'],
    uz: ['meni tekshiring', 'savol bering', '{topic} bo‘yicha savol bering', 'test bering', '{topic} dan test', 'bilimimni tekshiring', 'mendan biror narsa so‘rang', 'o‘zimni sinab ko‘rmoqchiman', 'imtihon qiling', 'keyingi savol', 'yana savol', '{topic} bo‘yicha so‘rang'],
  },
  simpler: {
    ru: ['объясни проще', 'проще', 'попроще', 'не понял', 'не поняла', 'непонятно', 'я не понимаю', 'объясни простыми словами', 'можно проще', 'слишком сложно', 'объясни как для пятиклассника', 'как-то сложно, проще можно', 'ничего не понятно', 'упрости', 'скажи по-простому', 'слишком заумно', 'объясни на пальцах', 'а если проще', 'не въехал', 'не догоняю', 'расскажи понятнее', 'что-то сложно', 'объясни {topic} проще', 'проще про {topic}'],
    en: ['explain simpler', 'simpler', 'i dont understand', 'i don’t get it', 'too complicated', 'in simple words please', 'can you simplify', 'explain like im five', 'make it simpler', 'thats too hard', 'say it in plain words', 'explain {topic} more simply', 'not clear'],
    uz: ['soddaroq tushuntiring', 'soddaroq', 'tushunmadim', 'oddiyroq qilib', 'juda murakkab', 'oddiy so‘zlar bilan', 'soddalashtiring', 'tushunarsiz', 'tushunarliroq qiling', '{topic} ni soddaroq tushuntiring', 'bolaga tushuntirgandek tushuntiring'],
  },
  more_detail: {
    ru: ['подробнее', 'расскажи подробнее', 'поподробнее', 'расскажи ещё', 'больше деталей', 'поглубже', 'расскажи больше', 'а подробнее можно', 'раскрой тему', 'хочу больше подробностей', 'расскажи подробнее про {topic}', 'подробнее о {topic}', 'углубимся', 'продолжай', 'а дальше', 'расскажи всё что знаешь про {topic}', 'ещё подробности', 'давай детальнее', 'разверни ответ', 'подробно про {subst}'],
    en: ['more detail', 'tell me more', 'in detail', 'go deeper', 'more details please', 'elaborate', 'tell me more about {topic}', 'expand on that', 'continue', 'and then?', 'tell me everything about {topic}', 'details on {subst}'],
    uz: ['batafsil', 'batafsilroq ayting', 'ko‘proq ayting', 'chuqurroq', 'davom eting', '{topic} haqida batafsil', 'yana ma‘lumot bering', '{subst} haqida batafsilroq', 'to‘liqroq tushuntiring', 'keyin-chi'],
  },
  repeat: {
    ru: ['повтори', 'повтори пожалуйста', 'ещё раз', 'скажи ещё раз', 'повтори последнее', 'что ты сказал', 'не расслышал', 'можешь повторить', 'повтори ответ', 'ещё разок', 'я прослушал, повтори', 'повтори медленнее', 'что-что', 'а?', 'повтори последнюю фразу', 'скажи снова'],
    en: ['repeat', 'say that again', 'once more', 'repeat please', 'what did you say', 'can you repeat', 'again please', 'i missed that, repeat', 'say it again slowly', 'come again?'],
    uz: ['takrorlang', 'yana bir bor', 'qayta ayting', 'iltimos takrorlang', 'nima dedingiz', 'yana bir marta ayting', 'eshitmadim, takrorlang', 'sekinroq takrorlang', 'oxirgi gapni takrorlang'],
  },
  remember: {
    ru: ['запомни меня зовут {name}', 'меня зовут {name}', 'запомни я в {n} классе', 'я учусь в 8 классе', 'запомни что я люблю {topic}', 'запомни: контрольная в пятницу', 'запомни мою любимую тему {topic}', 'запиши что я не понимаю {topic}', 'запомни что мне {n} лет', 'меня зовут {name}, запомни', 'я из 9 класса, запомни', 'запомни я боюсь задач', 'мой любимый элемент {elem}, запомни', 'запомни это', 'запомни что я уже прошёл {topic}', 'можешь запомнить что я {name}', 'не забудь: я {name}', 'напомни мне потом про {topic}', 'запомни, я готовлюсь к олимпиаде'],
    en: ['remember my name is {name}', 'my name is {name}', 'remember i am in grade {n}', 'remember that i like {topic}', 'remember: test on friday', 'remember my favourite topic is {topic}', 'note that i dont understand {topic}', 'remember i am {n} years old', 'remember this', 'remind me later about {topic}', 'my favourite element is {elem}, remember'],
    uz: ['eslab qoling, mening ismim {name}', 'mening ismim {name}', 'eslab qoling men {n} sinfda o‘qiyman', 'men {topic} ni yaxshi ko‘raman, eslab qoling', 'eslab qoling: juma kuni nazorat ishi', 'sevimli mavzuim {topic}', '{topic} ni tushunmasligimni yozib qo‘ying', 'buni eslab qoling', 'keyinroq {topic} haqida eslating', 'sevimli elementim {elem}, eslab qoling'],
  },
  correction: {
    ru: ['нет, я спросил что такое {topic}', 'нет, я имел в виду {subst}', 'ты не понял, я про {topic}', 'это была шутка', 'я пошутил', 'нет не то', 'я не это спрашивал', 'я спрашивал про {elem}', 'ты неправильно понял', 'нет, я спрашивал про молярную массу', 'я имела в виду другое', 'не про это, а про {topic}', 'нет, вопрос был про {subst}', 'ты ответил не на тот вопрос', 'я говорил про {topic}, а не про это', 'не так, я хотел пример', 'нет, объясни именно {topic}', 'я шутил', 'это шутка была', 'нет, я спросил сколько будет {n}+{n}', 'я имел в виду {f}', 'не то, я про {elem}'],
    en: ['no, i asked what {topic} is', 'no, i meant {subst}', 'you misunderstood, i mean {topic}', 'it was a joke', 'i was joking', 'no not that', 'thats not what i asked', 'i asked about {elem}', 'you got it wrong', 'i meant {f}', 'no, the question was about {subst}', 'wrong question, i meant {topic}', 'just kidding'],
    uz: ['yo‘q, men {topic} nima deb so‘radim', 'yo‘q, men {subst} ni nazarda tutdim', 'noto‘g‘ri tushundingiz, men {topic} haqida', 'bu hazil edi', 'hazillashdim', 'yo‘q, u emas', 'men buni so‘ramadim', 'men {elem} haqida so‘radim', 'men {f} ni nazarda tutgandim', 'yoq, savol {subst} haqida edi'],
  },
  feedback_pos: {
    ru: ['отлично объяснил', 'понятно, спасибо', 'класс', 'круто', 'супер', 'теперь понял', 'отличный ответ', 'хорошо объясняешь', 'именно это я и хотел', 'да, это оно', 'правильно', 'всё понятно', 'ты лучший', 'топ', 'огонь', 'молодец', 'да, верно', 'очень понятно', 'хорошо', 'ок понял', '👍', 'лайк', 'спасибо, отличное объяснение', 'вот теперь ясно', 'идеально', 'это помогло'],
    en: ['great explanation', 'got it', 'cool', 'awesome', 'now i understand', 'great answer', 'exactly what i wanted', 'yes thats it', 'correct', 'all clear', 'you are the best', 'perfect', 'nice', 'well done', '👍', 'that helped', 'clear now'],
    uz: ['zo‘r tushuntirdingiz', 'tushunarli', 'zo‘r', 'ajoyib', 'endi tushundim', 'a‘lo javob', 'aynan shu', 'to‘g‘ri', 'hammasi tushunarli', 'siz eng zo‘risiz', 'barakalla', '👍', 'yordam berdi', 'juda yaxshi'],
  },
  feedback_neg: {
    ru: ['плохо объяснил', 'неправильно', 'это неверно', 'ты ошибся', 'не то', 'ответ не подходит', 'это не ответ', 'ты не ответил на вопрос', 'чушь', 'бред', 'ерунда какая-то', 'слишком длинно', 'слишком коротко', 'не помогло', '👎', 'дизлайк', 'ты повторяешься', 'ты не прав', 'так себе ответ', 'не нравится ответ', 'мимо', 'это не про то', 'фигня', 'ответ плохой', 'ты меня не слушаешь', 'ты несёшь чепуху'],
    en: ['bad explanation', 'wrong', 'thats incorrect', 'you made a mistake', 'not that', 'this is not an answer', 'you didnt answer my question', 'nonsense', 'too long', 'too short', 'didnt help', '👎', 'you are repeating yourself', 'you are wrong', 'poor answer', 'off topic'],
    uz: ['yomon tushuntirdingiz', 'noto‘g‘ri', 'bu xato', 'xato qildingiz', 'u emas', 'bu javob emas', 'savolimga javob bermadingiz', 'bema‘nilik', 'juda uzun', 'juda qisqa', 'yordam bermadi', '👎', 'takrorlayapsiz', 'yomon javob'],
  },
  homework_help: {
    ru: ['помоги с домашкой', 'помоги с домашним заданием', 'дз по химии', 'мне задали параграф про {topic}', 'помоги сделать упражнение {n}', 'задали {topic}, не знаю с чего начать', 'домашка: {topic}', 'помоги с заданием по {topic}', 'надо сделать номер {n} по {topic}', 'учитель задал составить формулы {topic}', 'помоги написать конспект по {topic}', 'что отвечать на вопрос {n} параграфа {n}', 'помоги подготовиться к уроку по {topic}', 'мне нужно сделать таблицу по {topic}', 'помоги с лабораторной работой', 'задание: составить уравнения с {subst}', 'не могу сделать домашку по {topic}', 'помоги с рефератом про {elem}', 'помоги разобрать домашнее задание', 'как сделать дз по {topic}'],
    en: ['help me with my homework', 'chemistry homework', 'i was assigned a paragraph about {topic}', 'help with exercise {n}', 'homework: {topic}', 'help with the task on {topic}', 'i need to do number {n} on {topic}', 'help me write a summary on {topic}', 'help me prepare for a lesson on {topic}', 'i cant do my homework on {topic}', 'help with my report on {elem}'],
    uz: ['uy vazifasiga yordam bering', 'kimyodan uy vazifasi', '{topic} haqida paragraf berishdi', '{n}-mashqqa yordam bering', 'uy vazifasi: {topic}', '{topic} bo‘yicha topshiriqqa yordam', '{topic} dan {n}-raqamni qilishim kerak', '{topic} bo‘yicha konspekt yozishga yordam bering', '{topic} dan uy vazifasini qila olmayapman', '{elem} haqida referatga yordam bering'],
  },
  lab_safety: {
    ru: ['техника безопасности в лаборатории', 'правила безопасности в кабинете химии', 'как правильно работать с кислотами', 'можно ли нюхать реактивы', 'что делать если кислота попала на кожу', 'как разбавлять серную кислоту', 'почему кислоту льют в воду а не наоборот', 'что делать если разбил термометр', 'можно ли пробовать вещества на вкус', 'как нагревать пробирку', 'как тушить горящий магний', 'что делать при ожоге щёлочью', 'правила работы со спиртовкой', 'опасен ли {subst}', 'как хранить {subst} безопасно', 'нужны ли очки на лабораторной', 'что делать если {subst} попал в глаза', 'первая помощь при отравлении {subst}', 'какие правила безопасности при нагревании', 'можно ли смешивать {subst} с {subst} дома', 'безопасно ли {subst}', 'как безопасно работать с {elem}'],
    en: ['lab safety rules', 'safety rules in the chemistry room', 'how to work with acids safely', 'can i smell reagents', 'what to do if acid gets on skin', 'how to dilute sulfuric acid', 'why pour acid into water and not the other way', 'what to do if i broke a thermometer', 'how to heat a test tube safely', 'how to put out burning magnesium', 'first aid for alkali burn', 'is {subst} dangerous', 'do i need goggles in the lab', 'what if {subst} gets in my eyes', 'is it safe to mix {subst} and {subst} at home'],
    uz: ['laboratoriyada xavfsizlik qoidalari', 'kimyo xonasida xavfsizlik', 'kislotalar bilan qanday xavfsiz ishlash kerak', 'reaktivlarni hidlash mumkinmi', 'kislota teriga tushsa nima qilish kerak', 'sulfat kislotani qanday suyultirish kerak', 'nega kislotani suvga quyadilar', 'termometr sinsa nima qilish kerak', 'probirkani qanday qizdirish kerak', '{subst} xavflimi', 'laboratoriyada ko‘zoynak kerakmi', '{subst} ko‘zga tushsa nima qilish kerak', '{subst} va {subst} ni uyda aralashtirish xavfsizmi'],
  },
  encourage: {
    ru: ['я устал', 'я устала', 'мне трудно', 'у меня не получается', 'я тупой', 'я никогда не пойму химию', 'мне тяжело', 'я сдаюсь', 'хочу бросить', 'это слишком сложно для меня', 'я не справлюсь', 'у меня ничего не выходит', 'мне страшно перед контрольной', 'боюсь экзамена', 'я не верю в себя', 'все понимают а я нет', 'я устал учиться', 'мне грустно', 'у меня плохое настроение', 'не хочу учиться', 'я ничего не запоминаю', 'я получил двойку', 'я опять ошибся', 'надоело всё', 'я бездарь', 'мне скучно и тяжело', 'голова уже не варит', 'я выдохся', 'сил больше нет', 'не получается решить, устал'],
    en: ['im tired', 'this is hard for me', 'i cant do it', 'im stupid', 'i will never understand chemistry', 'i give up', 'i want to quit', 'this is too difficult for me', 'i cant handle it', 'im scared of the exam', 'i dont believe in myself', 'everyone gets it but me', 'im tired of studying', 'im sad', 'i got a bad grade', 'i failed again', 'my brain is fried', 'im exhausted', 'i cant remember anything'],
    uz: ['charchadim', 'menga qiyin', 'qo‘limdan kelmayapti', 'men ahmoqman', 'kimyoni hech qachon tushunmayman', 'taslim bo‘laman', 'tashlab ketmoqchiman', 'bu men uchun juda qiyin', 'imtihondan qo‘rqaman', 'o‘zimga ishonmayman', 'hamma tushunadi, men yo‘q', 'o‘qishdan charchadim', 'xafaman', 'yomon baho oldim', 'yana xato qildim', 'kuchim qolmadi', 'hech narsa esimda qolmayapti'],
  },
}

const NAMES = ['Алишер', 'Мадина', 'Тимур', 'Диана', 'Жасур', 'Азиза', 'Саша', 'Нилуфар', 'Иван', 'Камила', 'Bobur', 'Malika', 'John', 'Anna']

// ---------------------------------------------------------------- шум: опечатки и разговорные формы
const PREFIX: Record<Lang, string[]> = {
  ru: ['', '', '', '', 'а ', 'ну ', 'слушай, ', 'учитель, ', 'скажи ', 'подскажи ', 'плз ', 'пж ', 'эй ', 'блин, ', 'так, ', 'короче ', 'извини, ', 'можно вопрос: ', 'а ещё '],
  en: ['', '', '', '', 'hey ', 'so ', 'teacher, ', 'please ', 'pls ', 'um ', 'ok ', 'btw '],
  uz: ['', '', '', '', 'ustoz, ', 'iltimos ', 'ayting, ', 'xo‘sh ', 'menga '],
}
const SUFFIX: Record<Lang, string[]> = {
  ru: ['', '', '', '?', '', ' пожалуйста', ' плиз', '!', ' пж', ')', ' ?', '...'],
  en: ['', '', '', '?', ' please', ' pls', '!', ')'],
  uz: ['', '', '', '?', ' iltimos', '!', ')'],
}

function typo(s: string): string {
  const chars = [...s]
  const letters = chars.map((c, i) => (/\p{L}/u.test(c) ? i : -1)).filter((i) => i >= 0)
  if (letters.length < 4) return s
  const i = letters[Math.floor(rnd() * letters.length)]!
  const op = rnd()
  if (op < 0.3) chars.splice(i, 1)
  else if (op < 0.55 && i + 1 < chars.length && /\p{L}/u.test(chars[i + 1]!)) [chars[i], chars[i + 1]] = [chars[i + 1]!, chars[i]!]
  else if (op < 0.75) chars.splice(i, 0, chars[i]!)
  else if (op < 0.9) chars[i] = pick(['а', 'о', 'е', 'и', 'у', 'a', 'e', 'o', 'i', 'u'])
  else chars[i] = chars[i]!.toUpperCase()
  return chars.join('')
}

function fill(tpl: string, lang: Lang): string {
  return tpl.replace(/\{(\w+)\}/g, (_m, k: string) => (k === 'name' ? pick(NAMES) : SLOTS[lang][k]?.() ?? k))
}

function noisy(text: string, lang: Lang): string {
  let s = text
  const r = rnd()
  if (r < 0.45) s = pick(PREFIX[lang]) + s
  if (rnd() < 0.5) s = s + pick(SUFFIX[lang])
  if (rnd() < 0.3) s = typo(s)
  if (rnd() < 0.15) s = typo(s)
  if (rnd() < 0.25) s = s.replace(/^./, (c) => c.toUpperCase())
  if (rnd() < 0.1) s = s.toUpperCase()
  if (rnd() < 0.08) s = s.replace(/[?!.,]+$/, '')
  return s.replace(/\s+/g, ' ').trim()
}

// ---------------------------------------------------------------- сборка
interface Row { text: string; intent: Intent; lang: Lang }
const TARGET_PER_INTENT = 150
const rows: Row[] = []
const seen = new Set<string>()
const langs: Lang[] = ['ru', 'en', 'uz']
for (const intent of INTENTS) {
  const t = TEMPLATES[intent]
  const perLang: Record<Lang, number> = { ru: Math.round(TARGET_PER_INTENT * 0.6), en: Math.round(TARGET_PER_INTENT * 0.22), uz: Math.round(TARGET_PER_INTENT * 0.18) }
  for (const lang of langs) {
    const tpls = t[lang] ?? []
    if (!tpls.length) continue
    // каждый шаблон хотя бы раз в чистом виде
    for (const tpl of tpls) {
      const s = fill(tpl, lang)
      if (!seen.has(s.toLowerCase())) {
        seen.add(s.toLowerCase())
        rows.push({ text: s, intent, lang })
      }
    }
    let guard = 0
    let made = 0
    while (made < perLang[lang] && guard++ < perLang[lang] * 30) {
      const s = noisy(fill(pick(tpls), lang), lang)
      if (s.length < 1 || seen.has(s.toLowerCase())) continue
      seen.add(s.toLowerCase())
      rows.push({ text: s, intent, lang })
      made++
    }
  }
}

// ---------------------------------------------------------------- надиктованная речь (STT): заполнители, хвосты, повторы, без пунктуации
const SPOKEN_LEAD: Record<Lang, string[]> = {
  ru: ['э ', 'эм ', 'ну ', 'ну это ', 'это самое ', 'типа ', 'короче ', 'как бы ', 'в общем ', 'значит ', 'блин ', 'слушай ', 'ну вот ', 'э ну ', 'так э ', 'ну короче '],
  en: ['um ', 'uh ', 'so ', 'like ', 'well ', 'you know ', 'so um ', 'erm ', 'i mean ', 'ok so '],
  uz: ['xo‘sh ', 'ya’ni ', 'demak ', 'anavi ', 'hali ', 'xullas ', 'endi ', 'mana ', 'xo‘sh demak '],
}
const SPOKEN_INNER: Record<Lang, string[]> = { ru: ['ну', 'э', 'типа', 'как бы', 'это самое', 'вот', 'значит'], en: ['um', 'like', 'uh', 'you know'], uz: ['ya’ni', 'anavi', 'demak'] }
const SPOKEN_TAIL: Record<Lang, string[]> = { ru: [' да', ' а', ' ну', ' вот', ' понимаешь', ' короче', ' или как', ' правильно'], en: [' right', ' yeah', ' huh', ' you know', ' ok'], uz: [' a', ' to‘g‘rimi', ' shundaymi', ' ha'] }
function spoken(text: string, lang: Lang): string {
  let s = text.toLowerCase().replace(/[?!.,;:…]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (rnd() < 0.85) s = pick(SPOKEN_LEAD[lang]) + s
  const words = s.split(' ')
  if (words.length >= 3 && rnd() < 0.5) words.splice(1 + Math.floor(rnd() * (words.length - 1)), 0, pick(SPOKEN_INNER[lang]))
  if (words.length >= 2 && rnd() < 0.3) {
    const i = Math.floor(rnd() * (words.length - 1))
    words.splice(i, 0, words[i]!) // оборванный повтор: «что что такое»
  }
  s = words.join(' ')
  if (rnd() < 0.5) s += pick(SPOKEN_TAIL[lang])
  return s.replace(/\s+/g, ' ').trim()
}
const SPOKEN_PER_LANG: Record<Lang, number> = { ru: 25, en: 10, uz: 8 }
let spokenRows = 0
for (const intent of INTENTS) {
  const t = TEMPLATES[intent]
  for (const lang of langs) {
    const tpls = t[lang] ?? []
    if (!tpls.length) continue
    let guard = 0
    let made = 0
    while (made < SPOKEN_PER_LANG[lang] && guard++ < SPOKEN_PER_LANG[lang] * 30) {
      const s = spoken(fill(pick(tpls), lang), lang)
      if (s.length < 1 || seen.has(s.toLowerCase())) continue
      seen.add(s.toLowerCase())
      rows.push({ text: s, intent, lang })
      made++
      spokenRows++
    }
  }
}
console.log(`[intent-dataset] надиктованных (STT) фраз: ${spokenRows}`)

// отложенная выборка: 15 % случайно, стратифицированно по намерению
const train: Row[] = []
const heldout: Row[] = []
const byIntent = new Map<Intent, Row[]>()
for (const r of rows) (byIntent.get(r.intent) ?? byIntent.set(r.intent, []).get(r.intent)!).push(r)
for (const [, list] of byIntent) {
  const shuffled = [...list].sort(() => rnd() - 0.5)
  const cut = Math.max(5, Math.round(shuffled.length * 0.15))
  heldout.push(...shuffled.slice(0, cut))
  train.push(...shuffled.slice(cut))
}

mkdirSync(join(here, 'data'), { recursive: true })
writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString().slice(0, 10), intents: INTENTS, train, heldout }), 'utf8')
const perIntent = [...byIntent.entries()].map(([k, v]) => `${k}:${v.length}`).join(' ')
console.log(`[intent-dataset] всего ${rows.length} (train ${train.length}, heldout ${heldout.length}) → ${OUT}`)
console.log(`[intent-dataset] по намерениям: ${perIntent}`)
