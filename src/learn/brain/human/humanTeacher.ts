/**
 * «Человеческий» слой ИИ-учителя — работает офлайн, в браузере, до поиска по учебнику.
 *
 *  • разговорная речь: приветствия по времени суток, «как дела», эмоции, шутки, факты;
 *  • смешанные фразы: «привет, а что такое моль?» → приветствие-префикс + ответ по книге;
 *  • вычисления (безопасный парсер), перевод единиц, дата/время по часам устройства;
 *  • химия из данных проекта: элементы, молярные массы, вещества каталога, «а у него?»;
 *  • память ученика: имя, класс, любимые темы, заметки «запомни: …» и поправки —
 *    как заметки СО СЛОВ УЧЕНИКА, сверенные с данными проекта.
 *
 * Возвращает null, если реплика — обычный учебный вопрос: тогда отвечает прежний движок.
 */
import {
  FOLLOW_UPS,
  MONTHS,
  OPENERS,
  TALK,
  TOD_GREETING,
  WEEKDAYS,
  type TalkIntent,
  type TalkLang,
  type TimeOfDay,
} from './humanTalkData'
import { evaluateArithmetic, extractArithmetic, formatNumber, prettyExpression } from './safeMath'
import { convertUnitsQuery } from './unitConvert'
import {
  answerElement,
  answerFormula,
  compoundByNameInText,
  detectChemProperty,
  elementBySymbol,
  findElementInText,
  findFormulaInText,
  molarMassOf,
  molesInText,
  plainFormula,
  prettyFormula,
  parseFormulaDeep,
  compoundByFormula,
  type ChemProperty,
} from './chemFacts'
import { loadProfile, saveProfile, forgetEverything, type NoteStatus, type StudentProfile, type TalkEntity } from './studentProfile'
import { scientistTalk } from './scientistTalk'
import { spokenNormalize } from './spokenNormalize'

export type HumanIntent =
  | TalkIntent
  | 'arith'
  | 'units'
  | 'chem'
  | 'mem_name'
  | 'mem_grade'
  | 'mem_like'
  | 'mem_note'
  | 'mem_correction'
  | 'mem_recall'
  | 'mem_forget'
  | 'scientist'

export type HumanTurn =
  | { kind: 'reply'; text: string; intent: HumanIntent; intents: HumanIntent[]; numbers?: Record<string, number>; noteStatus?: NoteStatus }
  | { kind: 'prefix'; prefix: string; rest: string; intents: HumanIntent[] }

export interface HumanTurnOptions {
  lang: TalkLang
  /** Прошлая реплика учителя (для «нормально» в ответ на «как дела?»). */
  lastTeacher?: string
  /** Часы (для тестов). */
  now?: Date
}

/* ------------------------------------------------------------ утилиты */

let rng: () => number = Math.random
/** Для тестов: детерминированный генератор. */
export function setHumanRandom(fn: () => number): void {
  rng = fn
}

let clock: () => Date = () => new Date()
export function setHumanClock(fn: () => Date): void {
  clock = fn
}

/** Выбрать вариант, не повторяя последние (память в профиле). */
function pick(pool: readonly string[], key: string, profile: StudentProfile): string {
  if (!pool.length) return ''
  const recent = profile.recent[key] ?? []
  const avoid = new Set(recent.slice(-Math.min(pool.length - 1, 3)))
  const options = pool.map((_, i) => i).filter((i) => !avoid.has(i))
  const idx = options[Math.floor(rng() * options.length)] ?? 0
  profile.recent = { ...profile.recent, [key]: [...recent, idx].slice(-4) }
  return pool[idx]!
}

function timeOfDay(d: Date): TimeOfDay {
  const h = d.getHours()
  if (h >= 5 && h < 12) return 'morning'
  if (h >= 12 && h < 18) return 'day'
  if (h >= 18 && h < 23) return 'evening'
  return 'night'
}

function fill(tpl: string, lang: TalkLang, profile: StudentProfile, withName: boolean, d: Date): string {
  const name = withName && profile.name ? profile.name : ''
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const date = lang === 'en' ? `${MONTHS.en[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}` : `${d.getDate()} ${MONTHS[lang][d.getMonth()]} ${d.getFullYear()}`
  return tpl
    .replace('{tod}', () => pick(TOD_GREETING[lang][timeOfDay(d)], `tod-${lang}`, profile))
    .replace(/\{name\}/g, name ? `, ${name}` : '')
    .replace(/\{Name\}/g, name ? `${name}, ` : '')
    .replace('{time}', `${hh}:${mm}`)
    .replace('{date}', date)
    .replace('{weekday}', WEEKDAYS[lang][d.getDay()]!)
    .replace(/\s+([,.!?])/g, '$1')
}

/** Нормализация: речевой мусор («э… ну… типа», хвост «да?»), нижний регистр, ё→е, растянутые буквы «приииивет» → «привет». */
export function normalizeUtterance(text: string): string {
  return spokenNormalize(text)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[ʻʼ‘’`]/g, "'")
    .replace(/(\p{L})\1{2,}/gu, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

/* --------------------------------------------------- опечатки (fuzzy) */

const LEXICON = [
  'привет', 'здравствуй', 'здравствуйте', 'спасибо', 'пожалуйста', 'пока', 'извини', 'извините', 'устал', 'устала',
  'скучно', 'страшно', 'боюсь', 'понимаю', 'контрольной', 'контрольная', 'интересный', 'пошути', 'анекдот', 'запомни',
  'забудь', 'зовут', 'сколько', 'который', 'времени', 'молярная', 'масса', 'кислород', 'водород', 'углерод', 'натрий',
  'hello', 'thanks', 'goodbye', 'remember', 'forget', 'tired', 'bored', 'scared', 'joke', 'rahmat', 'salom', 'charchadim',
  // физиология и быт
  'голова', 'болит', 'голодный', 'голоден', 'проголодался', 'холодно', 'жарко', 'душно', 'злюсь', 'обидно', 'обидели', 'болею', 'заболел', 'выспался',
  'температура', 'родители', 'выходные', 'каникулы', 'тренировка', 'футбол', 'майнкрафт', 'друзья', 'оценка', 'двойка', 'пятерка', 'чувства',
  'hungry', 'sleepy', 'headache', 'angry', 'weekend', 'friends', 'parents', 'ochman', 'sovqotdim', 'kasalman',
]

function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) dp[0]![j] = j
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, dp[i - 2]![j - 2]! + 1)
      dp[i]![j] = v
      rowMin = Math.min(rowMin, v)
    }
    if (rowMin > max) return max + 1
  }
  return dp[a.length]![b.length]!
}

/** Исправить опечатки в разговорных словах: «привте» → «привет», «спосибо» → «спасибо». */
export function fixTypos(text: string): string {
  return text.replace(/\p{L}{4,}/gu, (w) => {
    if (LEXICON.includes(w)) return w
    const max = w.length >= 7 ? 2 : 1
    let best: string | null = null
    let bestD = max + 1
    for (const lex of LEXICON) {
      if (lex[0] !== w[0]) continue
      const d = editDistance(w, lex, max)
      if (d < bestD) {
        bestD = d
        best = lex
      }
    }
    return best ?? w
  })
}

/* ----------------------------------------------------------- намерения */

const B = String.raw`(?<!\p{L})`
const E = String.raw`(?!\p{L})`

const GREETING_LEAD = new RegExp(
  String.raw`^(?:(?:ну\s+)?(?:привет\p{L}*|приветик|здравств\p{L}*|здраст\p{L}*|добр\p{L}*\s+(?:утро|день|вечер|ночи)|хай|хэй|хеллоу|салам|салют|hi|hello|hey|hiya|good\s+(?:morning|afternoon|evening)|salom|assalomu?\s+alaykum|assalom))${E}(?:\s*,?\s*(?:учитель|teacher|ustoz|друг|бот))?[\s,!.)]*`,
  'iu',
)
const THANKS_LEAD = new RegExp(String.raw`^(?:спасиб\p{L}*|благодар\p{L}*|спс|пасиб\p{L}*|thanks?|thank\s+you|thx|rahmat|katta\s+rahmat)${E}(?:\s+(?:большое|огромное|a\s+lot|so\s+much))?[\s,!.)]*`, 'iu')
const SORRY_LEAD = new RegExp(String.raw`^(?:извини\p{L}*|прости\p{L}*|сорри|sorry|kechir\p{L}*|uzr)${E}[\s,!.)]*`, 'iu')
const CONFUSED_LEAD = new RegExp(
  String.raw`^(?:я\s+)?(?:(?:совсем|вообще|ничего)\s+)?(?:не\s+понима\p{L}*|не\s+понял\p{L}*|запутал\p{L}*|i\s+don'?t\s+(?:get|understand)(?:\s+it)?|i'?m\s+confused|tushunmayapman|tushunmadim)${E}[\s,!.:—-]*`,
  'iu',
)

const INTENT_RE: [TalkIntent, RegExp][] = [
  ['time', /^(а\s+)?(который\s+(сейчас\s+)?час|сколько\s+(сейчас\s+)?(времени|время)|what\s+time\s+is\s+it|what'?s\s+the\s+time|(hozir\s+)?soat\s+necha)[\s?!.]*$/iu],
  ['date', /(какое\s+(сегодня\s+)?число|какой\s+сегодня\s+день|какая\s+сегодня\s+дата|what'?s\s+the\s+date|what\s+day\s+is\s+(it|today)|today'?s\s+date|bugun\s+(nechanchi|qaysi\s+kun|sana))/iu],
  ['howareyou', /(как\s+(у\s+тебя\s+)?(дела|делишки|жизнь|настроение|поживаешь|ты\s+сам|ты)(?!\p{L})(?!\s+(думаешь|считаешь|объясн))|how\s+are\s+you|how'?s\s+it\s+going|how\s+are\s+things|qalaysan|qalaysiz|ishlar\s+qalay|yaxshimisiz|yaxshimisan|а\s+у\s+тебя\s*\??$|and\s+you\s*\??$)/iu],
  // --- вопросы об учителе (до «кто ты» и до эмоций: «ты устал?» — про учителя, а не про ученика)
  ['teacher_creator', /(кто\s+тебя\s+(создал|сделал|написал|придумал|разработал|запрограммировал)|кто\s+твой\s+(создатель|автор|разработчик)|кто\s+тебя\s+учил|who\s+(made|created|built|developed|programmed)\s+you|who\s+is\s+your\s+(creator|author|developer)|seni\s+kim\s+(yaratdi|yasadi|yozdi|yaratgan))/iu],
  ['teacher_age', /(сколько\s+тебе\s+лет|какой\s+у\s+тебя\s+возраст|тебе\s+сколько\s+лет|how\s+old\s+are\s+you|what'?s\s+your\s+age|yoshing\s+nechada|necha\s+yoshdasan|yoshingiz\s+nechada)/iu],
  ['teacher_feelings', /(у\s+тебя\s+есть\s+(чувства|эмоции|настроение|душа)|ты\s+(чувствуешь|умеешь\s+чувствовать|грустишь|радуешься|обижаешься|любишь|можешь\s+грустить)|тебе\s+(бывает\s+)?(грустно|весело|обидно|скучно)|do\s+you\s+have\s+(feelings|emotions)|can\s+you\s+feel|do\s+you\s+(get\s+)?(sad|happy|bored)|his-?tuyg'?ularing\s+bormi|sen\s+his\s+qilasanmi|xafa\s+bo'?lasanmi)/iu],
  ['teacher_tired', /(ты\s+(устаешь|устал|устала|не\s+устал|спишь|ешь|кушаешь|отдыхаешь|когда-нибудь\s+спишь)|тебе\s+(надо|нужно)\s+(спать|есть|отдыхать)|do\s+you\s+(get\s+tired|sleep|eat|rest|ever\s+sleep)|are\s+you\s+tired|charchaysanmi|charchadingmi|uxlaysanmi|ovqat\s+yeysanmi|dam\s+olasanmi)/iu],
  ['teacher_alive', /(ты\s+(живой|живая|настоящий|настоящая|реальный|реальная|человек\s+или\s+(бот|робот|программа)|робот\s+или\s+человек|бот\s+или\s+человек|правда\s+(живой|человек))|are\s+you\s+(alive|real|a\s+real\s+person|human\s+or\s+(a\s+)?(bot|robot)|a\s+robot\s+or\s+(a\s+)?human)|sen\s+(tirikmisan|haqiqiymisan|odammisan|robotmisan))/iu],
  ['whoareyou', /(кто\s+ты|ты\s+кто|ты\s+(бот|робот|человек|ии|нейросеть)|who\s+are\s+you|are\s+you\s+(a\s+)?(bot|robot|human|real|ai)|sen\s+kimsan|siz\s+kimsiz|как\s+тебя\s+зовут|what'?s\s+your\s+name|isming\s+nima)/iu],
  ['whatcanyou', /(что\s+ты\s+(умеешь|можешь)|чем\s+(ты\s+)?(можешь\s+)?помочь|что\s+ты\s+знаешь\s+и\s+умеешь|what\s+can\s+you\s+do|how\s+can\s+you\s+help|nima(lar)?\s+qila\s+olas)/iu],
  ['rude', new RegExp(`${B}(ты\\s+(тупой|дурак|глупый|бесполезный)|отстой|бесишь|идиот|stupid|you\\s+suck|useless|dumb|ahmoq)${E}`, 'iu')],
  ['compliment', /(ты\s+(классн|крут|умн|лучш|молодец|супер|замечательн|хорош)\p{L}*|молодец|отличн\p{L}*\s+объясн|хорошо\s+объясня|you('?re|\s+are)\s+(great|awesome|smart|the\s+best|cool|amazing)|good\s+job|zo'?rsan|barakalla|ajoyib\s+tushuntir)/iu],
  ['laugh', /^(ха(ха)+|ах(ах)+а?|хех|лол|lol|haha+|hehe|xaxa+|😂|🤣)[\s!)]*$/iu],
  // --- «физиология» ученика: голод/жажда, сон, боль, болезнь, холод/жара, злость, обида
  ['emo_pain', new RegExp(`${B}(болит\\s+(голова|живот|горло|зуб|ухо|глаза|спина)|(голова|живот|горло|зуб|ухо|спина)\\s+болит|головная\\s+боль|голова\\s+раскалывается|тошнит|мутит|headache|stomach\\s*ache|my\\s+(head|stomach|tummy|throat|tooth)\\s+(hurts|aches)|i\\s+feel\\s+sick|boshim\\s+og'?riyapti|qornim\\s+og'?riyapti|tomog'?im\\s+og'?riyapti|ko'?nglim\\s+ayniyapti)${E}`, 'iu')],
  ['emo_sick', new RegExp(`${B}(я\\s+)?(болею|заболел\\p{L}*|простудил\\p{L}*|простыл\\p{L}*|у\\s+меня\\s+(температура|насморк|кашель|простуда|грипп)|температур\\p{L}*|насморк|кашля\\p{L}*|i'?m\\s+(sick|ill|unwell)|i\\s+(have|caught)\\s+a\\s+cold|i\\s+have\\s+(a\\s+)?(fever|flu)|kasalman|kasal\\s+bo'?ldim|kasal\\s+bo'?lib\\s+qoldim|shamollab\\s+qoldim|shamolladim|isitmam\\s+bor)${E}`, 'iu')],
  ['emo_hungry', new RegExp(`${B}(хочу\\s+(есть|кушать|пить|жрать|перекусить)|(есть|кушать|пить)\\s+хочу|голод\\p{L}*|проголодал\\p{L}*|жажда|пить\\s+хочется|есть\\s+хочется|i'?m\\s+(so\\s+)?(hungry|starving|thirsty)|i\\s+want\\s+to\\s+eat|qornim\\s+och|ochman|och\\s+qoldim|chanqadim|suv\\s+ichgim\\s+keldi|ovqat\\s+yegim\\s+kel\\p{L}*)${E}`, 'iu')],
  ['emo_sleepy', new RegExp(`${B}(не\\s+выспал\\p{L}*|хочу\\s+спать|спать\\s+хочу|спать\\s+хочется|сонн\\p{L}*|зеваю|засыпаю|глаза\\s+слипаются|мало\\s+спал\\p{L}*|didn'?t\\s+sleep\\p{L}*|i'?m\\s+(so\\s+)?sleepy|want\\s+to\\s+sleep|i\\s+barely\\s+slept|uyqum\\s+kel\\p{L}*|uxlagim\\s+kel\\p{L}*|uxlamadim|kam\\s+uxladim)${E}`, 'iu')],
  ['emo_cold', new RegExp(`${B}(мне\\s+холодно|холодно|замерз\\p{L}*|мерзну|мёрзну|дубак|i'?m\\s+(cold|freezing)|it'?s\\s+(so\\s+)?cold\\s+(here|in\\s+here)|menga\\s+sovuq|sovqotdim|sovuq\\s+qotdim|muzlab\\s+ketdim)${E}`, 'iu')],
  ['emo_hot', new RegExp(`${B}(мне\\s+жарко|жарко|душно|жара|парилка|i'?m\\s+(so\\s+)?hot|it'?s\\s+(so\\s+|too\\s+)?(hot|stuffy)(\\s+(here|in\\s+here))?|menga\\s+issiq|issiq\\s+bo'?lib\\s+ketdi|dim\\s+bo'?lib\\s+ketdi|juda\\s+issiq)${E}`, 'iu')],
  ['emo_angry', new RegExp(`${B}(злюсь|я\\s+зол|я\\s+злой|я\\s+злая|разозлил\\p{L}*|бесит|всё\\s+бесит|все\\s+бесит|раздража\\p{L}*|в\\s+ярости|выбешивает|достало|i'?m\\s+(so\\s+)?(angry|mad|furious|annoyed|pissed)|it\\s+makes\\s+me\\s+(angry|mad)|jahlim\\s+chiq\\p{L}*|achchig'?im\\s+chiq\\p{L}*|g'?azabim\\s+kel\\p{L}*|asabim\\s+buzildi)${E}`, 'iu')],
  ['emo_hurt', new RegExp(`${B}(обидел\\p{L}*|обидно|обижа\\p{L}*|меня\\s+обижают|надо\\s+мной\\s+смеются|i'?m\\s+(hurt|offended)|hurt\\s+my\\s+feelings|they\\s+(laugh|make\\s+fun)|xafa\\s+qil\\p{L}*|xafa\\s+bo'?ldim|ustimdan\\s+kul\\p{L}*)${E}`, 'iu')],
  ['emo_scared', /(боюсь|страшно|волнуюсь|переживаю|нервничаю|паникую|(завтра|скоро|сегодня)\s+(будет\s+)?(контрольн|экзамен|тест|самостоятельн)|scared|nervous|afraid|anxious|worried\s+about|qo'?rqyapman|hayajonlan)/iu],
  ['emo_tired', /(устал|утомил|нет\s+сил|вымотал|i'?m\s+(so\s+)?tired|i\s+am\s+(so\s+)?tired|exhausted|charchadim|holdan\s+toydim)/iu],
  ['emo_bored', /(скучно|скукота|надоело|неинтересно|i'?m\s+bored|boring|zerikdim|zerikarli)/iu],
  ['emo_sad', /(грустно|плохое\s+настроение|мне\s+плохо|печально|i'?m\s+sad|feel\s+(bad|sad)|upset|xafaman|kayfiyatim\s+yo'?q)/iu],
  ['emo_happy', /((у\s+меня\s+)?(отличное|хорошее|классное)\s+настроение|мне\s+весело|i'?m\s+(so\s+)?happy|i\s+feel\s+great|xursandman|kayfiyatim\s+zo'?r)/iu],
  ['motivation', /(мотивац|замотивируй|подбодри|не\s+могу\s+себя\s+заставить|опускаются\s+руки|хочу\s+бросить|у\s+меня\s+не\s+получится|motivat|encourage\s+me|cheer\s+me\s+up|ruhlantir|motivatsiya)/iu],
  ['joke', /(пошути|шутк|анекдот|рассмеши|tell\s+(me\s+)?a\s+joke|joke|make\s+me\s+laugh|hazil|latifa)/iu],
  ['fact', /(интересн\p{L}*\s+факт|удиви\s+меня|что[\s-]нибудь\s+интересн|fun\s+fact|interesting\s+fact|something\s+interesting|qiziq(arli)?\s+fakt)/iu],
  ['offline_world', /(погод\p{L}*|новост\p{L}*|курс\s+(доллар|валют|евро)|кто\s+выиграл|счет\s+матча|президент|weather|news|exchange\s+rate|who\s+won|ob-?havo|yangilik|kim\s+yutdi)/iu],
  // --- бытовые темы: короткий человеческий отклик + мостик к химии из данных проекта
  ['life_grades', new RegExp(`${B}((получил\\p{L}*|поставили|схватил\\p{L}*|влепили|заработал\\p{L}*)\\s+(двойку|тройку|четверку|четвёрку|пятерку|пятёрку|двойк\\p{L}*|тройк\\p{L}*|2|3|4|5)|(двойк|тройк|четверк|четвёрк|пятерк|пятёрк)\\p{L}*|плох\\p{L}*\\s+оценк\\p{L}*|оценк\\p{L}*\\s+(плох|по\\s+химии|за\\s+контрольн)|мои\\s+оценки|got\\s+an?\\s+[abcdf]${E}|bad\\s+grade|my\\s+grades?|baho\\p{L}*|ikki\\s+oldim|besh\\s+oldim|uch\\s+oldim)${E}`, 'iu')],
  ['life_parents', new RegExp(`${B}(родител\\p{L}*|(мама|папа|мать|отец|предки)\\s+(ругает|ругают|ругается|злится|злятся|сказал\\p{L}*|заставля\\p{L}*|не\\s+разреша\\p{L}*|кричит|кричат|накажут|наказали|отобрал\\p{L}*)|(ругают|ругает)\\s+(мама|папа|родители)|parents|my\\s+(mom|mum|dad|mother|father)\\s+(is|are|was|said|told|yell\\p{L}*|won'?t|doesn'?t)|ota-?onam|onam\\s+\\p{L}+|dadam\\s+\\p{L}+|oyim\\s+\\p{L}+|otam\\s+\\p{L}+)${E}`, 'iu')],
  ['life_school', new RegExp(`${B}((не\\s+хочу|ненавижу|устал\\p{L}*\\s+от)\\s+(в\\s+|ходить\\s+в\\s+)?школ\\p{L}*|школ\\p{L}*\\s+(достала|надоела|бесит|задолбала)|(достала|надоела|бесит)\\s+школ\\p{L}*|в\\s+школе\\s+(скучно|плохо|сложно|трудно|тяжело)|много\\s+(уроков|задали|домашки|домашней)|задали\\s+много|i\\s+hate\\s+school|school\\s+(sucks|is\\s+(boring|hard|too\\s+much))|too\\s+much\\s+homework|maktab\\p{L}*\\s+(zerikarli|yoqmaydi|charchatdi|jonga\\s+tegdi)|maktabni\\s+yomon\\s+ko'?raman|maktabga\\s+borgim\\s+kelmayapti|uy\\s+vazifasi\\s+ko'?p)${E}`, 'iu')],
  ['life_games', new RegExp(`${B}(игра\\p{L}*\\s+(в|на)\\s+(телефон|компьютер|приставк|плейстейшн|майнкрафт|роблокс|доту|кс|фортнайт|бравл)\\p{L}*|видеоигр\\p{L}*|компьютерн\\p{L}*\\s+игр\\p{L}*|майнкрафт\\p{L}*|minecraft|roblox|роблокс\\p{L}*|дота|dota|фортнайт|fortnite|бравл\\s*старс|brawl\\s*stars|геншин|genshin|cs\\s*go|cs2|пубг|pubg|стандофф|standoff|free\\s*fire|фри\\s*фаер|video\\s*games?|gaming|play(ed|ing)?\\s+(games|minecraft|roblox|on\\s+my\\s+phone)|o'?yin\\s+o'?yna\\p{L}*|telefonda\\s+o'?yna\\p{L}*)${E}`, 'iu')],
  ['life_sport', new RegExp(`${B}(футбол\\p{L}*|баскетбол\\p{L}*|волейбол\\p{L}*|тренировк\\p{L}*|тренир\\p{L}*|спортзал|качалк\\p{L}*|плаван\\p{L}*|бассейн\\p{L}*|бокс\\p{L}*|борьб\\p{L}*|каратэ|теннис\\p{L}*|пробежк\\p{L}*|бегал\\p{L}*|занимаюсь\\s+спортом|football|soccer|basketball|volleyball|workout|gym|training|swimming|boxing|wrestling|karate|tennis|jogging|went\\s+running|futbol\\p{L}*|basketbol\\p{L}*|voleybol\\p{L}*|mashg'?ulot\\p{L}*|sport\\s+bilan|suzish\\p{L}*|boks\\p{L}*|kurash\\p{L}*)${E}`, 'iu')],
  ['life_food', new RegExp(`${B}((я\\s+)?(поел\\p{L}*|покушал\\p{L}*|пообедал\\p{L}*|позавтракал\\p{L}*|поужинал\\p{L}*|наелся|наелась)|люблю\\s+(пиццу|плов|шоколад|сладкое|чай|кофе|бургеры|мороженое|манты|самсу|лагман|шашлык)|(плов|пицц|шоколад|бургер|мороженое|манты|самс|лагман|шашлык|вкусняшк|сладост)\\p{L}*|вкусн\\p{L}*|что\\s+(поесть|приготовить)|(ate|had)\\s+(pizza|lunch|dinner|breakfast|chocolate|ice\\s*cream)|i\\s+love\\s+(pizza|chocolate|food|ice\\s*cream)|yummy|tasty|delicious|(palov|osh|pitsa|shokolad|somsa|manti|lag'?mon|shashlik)\\p{L}*\\s+(yedim|yeyman|yaxshi\\s+ko'?raman)|juda\\s+mazali|mazali\\s+bo'?ldi|ovqat\\s+yedim)${E}`, 'iu')],
  ['life_friends', new RegExp(`${B}(друг(а|у|ом|и|ей|е)?${E}|друзья|друзей|друзьям|друзьями|подруг\\p{L}*|одноклассни\\p{L}*|поссорил\\p{L}*|помирил\\p{L}*|(my\\s+)?(best\\s+)?friends?${E}|classmates?${E}|had\\s+a\\s+fight\\s+with|do'?st\\p{L}*|sinfdosh\\p{L}*|urishib\\s+qoldim|yarashib\\s+oldim)${E}`, 'iu')],
  ['life_weekend', new RegExp(`${B}(выходн\\p{L}*|каникул\\p{L}*|на\\s+выходных|в\\s+субботу|в\\s+воскресенье|планы\\s+на\\s+(вечер|завтра|лето)|weekend\\p{L}*|holidays?|vacation|on\\s+saturday|on\\s+sunday|dam\\s+olish\\s+kun\\p{L}*|ta'?til\\p{L}*|shanba\\s+kuni|yakshanba\\s+kuni)${E}`, 'iu')],
  ['bye', /^(ну\s+)?(всё,?\s+)?(пока|до\s+свидания|до\s+встречи|до\s+завтра|бывай|увидимся|спокойной\s+ночи|bye|goodbye|see\s+you|good\s+night|xayr|ko'?rishguncha|xayrli\s+tun)(?!\p{L})/iu],
  ['student_fine', /^(да\s+)?(нормально|норм|хорошо|отлично|прекрасно|пойдет|неплохо|все\s+(хорошо|отлично|норм)|fine|good|great|not\s+bad|i'?m\s+(fine|good|ok|great)|yaxshi|zo'?r|a'?lo|chakki\s+emas)[\s!.,)]*(спасибо|thanks|rahmat)?[\s!.,)]*$/iu],
]

const NAME_RECALL = /(как\s+меня\s+зовут|помнишь\s+(мо[её]\s+)?имя|what'?s\s+my\s+name|do\s+you\s+remember\s+my\s+name|(mening\s+)?ismim\s+nima)/iu
const KNOW_ME = /(что\s+ты\s+(обо\s+мне|про\s+меня)\s+(знаешь|помнишь)|что\s+ты\s+(знаешь|помнишь|запомнил)\s+(обо\s+мне|про\s+меня)|что\s+ты\s+запомнил|what\s+do\s+you\s+(know|remember)\s+about\s+me|men\s+haqimda\s+nima)/iu
const NAME_SET = /(?:меня\s+зовут|мо[её]\s+имя|зови\s+меня|my\s+name\s+is|call\s+me|i'?m\s+called|mening\s+ismim|ismim)\s*[—:-]?\s*([\p{L}][\p{L}'-]{1,19})/iu
const GRADE_SET = /(?:я\s+(?:учусь\s+)?в\s+(\d{1,2})\s*(?:-?(?:м|ом|ый))?\s+класс|i'?m\s+in\s+(?:grade\s+|year\s+)?(\d{1,2})(?:th|st|nd|rd)?(?:\s+grade)?|men\s+(\d{1,2})\s*-?\s*sinf)/iu
const LIKE_SET = /(?:мне\s+нравится|я\s+люблю|моя\s+любимая\s+тема|i\s+(?:really\s+)?(?:like|love)|my\s+favou?rite\s+topic\s+is|sevimli\s+mavzum)\s*[—:-]?\s*(.{3,60})$/iu
const REMEMBER = /^(?:запомни|запиши|запомнить|remember|note\s+that|eslab\s+qol|yozib\s+qo'?y)\s*[:,—-]?\s*(?:что\s+|that\s+)?(.{3,300})$/iu
const CORRECTION = /^(?:нет|неправильно|неверно|ты\s+ошибаешься|не\s+так|no|wrong|that'?s\s+wrong|yo'?q|noto'?g'?ri)[\s,.!—-]+(?:правильно|на\s+самом\s+деле|верно|правильный\s+ответ|correct\s+is|it'?s\s+actually|actually|to'?g'?risi)\s*[:,—-]?\s*(.{2,300})$/iu
const FORGET = /(забудь\s+(всё|все|обо\s+мне|меня|что\s+знаешь)|сотри\s+(память|всё|все)|forget\s+(everything|me|about\s+me)|hammasini\s+unut|meni\s+unut)/iu

const PRONOUN = /(?<!\p{L})(него|нее|неё|его|ее|её|ним|нем|нём|этого|этом|it|its|this\s+one|uning|u\s+haqida|bunda)(?!\p{L})/iu
const ELLIPTIC = /^(а|и|and|a|what\s+about|va)\s/iu
const BOOK_DEPTH = /(свойств|получ|применен|использ|реакц|взаимодейств|значени|роль|где\s+встреча|в\s+природе|propert|obtain|use[sd]?\b|reaction|xossa|olin|ishlatil|reaksiya)/iu
const NARRATIVE = /(расскажи|поведай|опиши|характеристик|что\s+ты\s+знаешь|tell\s+me\s+about|describe|haqida|ta'rifla)/iu
const ABOUT = /^(что\s+так\p{L}*|расскажи\s+(мне\s+)?(про|о|об)|что\s+за|кто\s+так\p{L}*|what\s+is|what'?s|tell\s+me\s+about|nima\s+degani|haqida\s+ayt)/iu

function shortPrefix(intent: TalkIntent | 'confused', lang: TalkLang, profile: StudentProfile, d: Date): string {
  const name = profile.name ? `, ${profile.name}` : ''
  const tod = pick(TOD_GREETING[lang][timeOfDay(d)], `tod-${lang}`, profile)
  const P: Record<TalkLang, Record<string, string[]>> = {
    ru: {
      greet: [`${tod}${name}!`, `${tod}${name}! Рад, что ты с вопросом.`],
      thanks: ['Пожалуйста!', 'Рад помочь!', 'Не за что!'],
      sorry: ['Всё в порядке, не извиняйся.', 'Ничего страшного.'],
      confused: ['Не переживай, сейчас разберёмся спокойно.', 'Ничего, объясню по-другому.', 'Бывает — давай по шагам.'],
    },
    en: {
      greet: [`${tod}${name}!`, `${tod}${name}! Glad you came with a question.`],
      thanks: ['You are welcome!', 'Happy to help!'],
      sorry: ['No worries at all.', 'That is fine.'],
      confused: ['No worries, let us sort it out calmly.', 'OK, let me explain it differently.'],
    },
    uz: {
      greet: [`${tod}${name}!`, `${tod}${name}! Savol bilan kelganing yaxshi.`],
      thanks: ['Arzimaydi!', 'Yordam berganimdan xursandman!'],
      sorry: ['Hechqisi yoʻq.', 'Hammasi joyida.'],
      confused: ['Xavotir olma, hozir tinchgina tushunib olamiz.', 'Mayli, boshqacha tushuntiraman.'],
    },
  }
  return pick(P[lang][intent] ?? P.ru[intent] ?? [''], `pre-${intent}-${lang}`, profile)
}

/* ------------------------------------------------- проверка заметок */

export interface ClaimCheck {
  status: NoteStatus
  /** Что говорят данные проекта. */
  truth?: string
}

function num(text: string): number | null {
  const m = text.replace(/(\d),(\d)/g, '$1.$2').match(/(?<![\w.])(\d+(?:\.\d+)?)(?![\w.]*[A-Za-z])/)
  return m ? Number(m[1]) : null
}

/** Сверить химическое утверждение ученика с данными проекта. */
export function verifyClaim(claim: string, lang: TalkLang): ClaimCheck {
  const fmt = (v: number) => formatNumber(Number(v.toFixed(2)), lang)
  const formula = findFormulaInText(claim)
  const compound = compoundByNameInText(claim)
  const el = findElementInText(claim)
  const massWord = /(молярн|масс|весит|mass|massa|M\s*\()/iu.test(claim)
  const numberWord = /(номер|порядков|протон|atomic\s+number|proton|tartib|raqam)/iu.test(claim)
  // «формула воды — H2O»: название вещества из каталога + формула
  if (compound && formula && !massWord) {
    const a = parseFormulaDeep(formula)
    const b = parseFormulaDeep(compound.formula)
    const same = a && b && JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort())
    return { status: same ? 'checked' : 'contradicted', truth: `${compound.nameRu} — ${prettyFormula(compound.formula)}` }
  }
  const claimNum = num(claim.replace(formula ?? '\u0000', ' '))
  const f = formula ?? (compound ? compound.formula : null)
  if (f && massWord && claimNum != null) {
    const mm = molarMassOf(f)
    if (mm) {
      const ok = Math.abs(mm.total - claimNum) <= Math.max(0.6, mm.total * 0.01)
      return { status: ok ? 'checked' : 'contradicted', truth: `M(${prettyFormula(f)}) = ${fmt(mm.total)} ${lang === 'ru' ? 'г/моль' : 'g/mol'}` }
    }
  }
  if (el && claimNum != null && numberWord) {
    const ok = claimNum === el.z
    return { status: ok ? 'checked' : 'contradicted', truth: `${el.symbol}: Z = ${el.z}` }
  }
  if (el && claimNum != null && massWord) {
    const ok = Math.abs(el.atomicMass - claimNum) <= 0.6
    return { status: ok ? 'checked' : 'contradicted', truth: `Ar(${el.symbol}) ≈ ${fmt(el.atomicMass)}` }
  }
  return { status: 'unverified' }
}

/* -------------------------------------------------------- химия */

function chemTurn(text: string, lang: TalkLang, profile: StudentProfile): { text: string; numbers: Record<string, number> } | null {
  const norm = normalizeUtterance(text)
  const property: ChemProperty | null = detectChemProperty(norm)
  const moles = molesInText(text)
  let formula = findFormulaInText(text)
  const compound = formula ? compoundByFormula(formula) : compoundByNameInText(text)
  if (!formula && compound && (property === 'mass' || property === 'formula' || moles != null)) formula = compound.formula
  let el = !formula ? findElementInText(text) : null
  // Одиночный символ «O» без контекста не ловим, но «а у кислорода?» — да.
  let entity: TalkEntity | null = formula ? { kind: 'formula', key: formula, label: formula } : el ? { kind: 'element', key: el.symbol, label: el.nameRu } : null
  const words = norm.split(/\s+/).length
  const elliptic = ELLIPTIC.test(norm) || PRONOUN.test(norm)
  // «а у него?» — без своих смысловых слов; «а что такое моль?» — новый вопрос, не про прошлое вещество.
  const leftover = norm
    .replace(new RegExp(PRONOUN.source, 'giu'), ' ')
    .replace(/(?<!\p{L})(а|и|у|and|what\s+about|va|about|a|how|какой|какая|какое|сколько|скажи|what|is|the|nima|qancha)(?!\p{L})/giu, ' ')
    .replace(/[?!.,]/g, ' ')
    .trim()
  const reuseEntity = property ? words <= 8 : !leftover
  if (!entity && elliptic && profile.lastEntity && reuseEntity) {
    entity = profile.lastEntity
    if (entity.kind === 'element') el = elementBySymbol(entity.key)
    else formula = entity.key
  }
  if (!entity) return null
  let prop: ChemProperty | null = property
  if (!prop && elliptic && profile.lastProperty && (formula || el)) prop = profile.lastProperty as ChemProperty
  if (!prop) {
    // «Расскажи про кислород» — карточка элемента; «свойства/получение кислорода» — к учебнику.
    if (BOOK_DEPTH.test(norm)) return null
    // «Расскажи о NaCl / что ты знаешь про серную кислоту» — связный рассказ даёт база фактов (qaBank), а не короткая карточка
    if (!el && NARRATIVE.test(norm)) return null
    const bare = norm.replace(/[?!.,]/g, '').trim()
    const isBare = el ? bare.split(' ').length <= 2 : !!formula && bare.split(' ').length <= 2
    if (!ABOUT.test(norm) && !isBare) return null
    prop = 'about'
  }
  if (el && !formula) {
    const a = answerElement(el, prop === 'formula' ? 'about' : prop, lang)
    profile.lastEntity = a.entity
    profile.lastProperty = prop === 'about' ? profile.lastProperty : prop
    return { text: a.text, numbers: a.numbers }
  }
  if (formula) {
    const a = answerFormula(plainFormula(formula), prop, lang, moles ?? undefined)
    if (!a) return null
    profile.lastEntity = a.entity
    profile.lastProperty = prop === 'about' ? profile.lastProperty : prop
    return { text: a.text, numbers: a.numbers }
  }
  return null
}

/* -------------------------------------------------------- память */

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function memoryTurn(text: string, lang: TalkLang, profile: StudentProfile): { intent: HumanIntent; text: string; noteStatus?: NoteStatus } | null {
  const L = (ru: string, en: string, uz: string) => (lang === 'en' ? en : lang === 'uz' ? uz : ru)
  const trimmed = text.trim()
  if (FORGET.test(trimmed)) {
    return { intent: 'mem_forget', text: L('Готово — я всё забыл: имя, заметки и настройки стиля. Начнём знакомство заново? Как тебя зовут?', 'Done — I have forgotten everything: your name, notes and style settings. Shall we get to know each other again? What is your name?', 'Tayyor — hammasini unutdim: ism, eslatmalar va uslub sozlamalari. Qaytadan tanishamizmi? Isming nima?') }
  }
  if (NAME_RECALL.test(trimmed)) {
    return {
      intent: 'mem_recall',
      text: profile.name
        ? L(`Конечно помню — тебя зовут ${profile.name}! 🙂`, `Of course — your name is ${profile.name}! 🙂`, `Albatta eslayman — isming ${profile.name}! 🙂`)
        : L('Ты ещё не говорил, как тебя зовут. Напиши «меня зовут …» — и я запомню.', 'You have not told me your name yet. Say "my name is …" and I will remember.', 'Hali ismingni aytmading. «Mening ismim …» deb yoz — eslab qolaman.'),
    }
  }
  if (KNOW_ME.test(trimmed)) {
    const lines: string[] = []
    if (profile.name) lines.push(L(`• тебя зовут ${profile.name}`, `• your name is ${profile.name}`, `• isming ${profile.name}`))
    if (profile.grade) lines.push(L(`• ты учишься в ${profile.grade} классе`, `• you are in grade ${profile.grade}`, `• ${profile.grade}-sinfda oʻqiysan`))
    if (profile.likes.length) lines.push(L(`• любимые темы: ${profile.likes.join(', ')}`, `• favourite topics: ${profile.likes.join(', ')}`, `• sevimli mavzular: ${profile.likes.join(', ')}`))
    for (const n of profile.notes.slice(-5)) {
      const mark = n.status === 'checked' ? L('проверено ✓', 'checked ✓', 'tekshirildi ✓') : n.status === 'contradicted' ? L('спорно ⚠', 'disputed ⚠', 'bahsli ⚠') : L('с твоих слов', 'your words', 'sening soʻzlaring')
      lines.push(`• «${n.text}» (${mark})`)
    }
    if (profile.detail >= 1) lines.push(L('• ты любишь подробные ответы', '• you like detailed answers', '• batafsil javoblarni yoqtirasan'))
    if (profile.detail <= -1) lines.push(L('• ты любишь короткие ответы', '• you prefer short answers', '• qisqa javoblarni yoqtirasan'))
    return {
      intent: 'mem_recall',
      text: lines.length
        ? `${L('Вот что я запомнил на этом устройстве:', 'Here is what I remember on this device:', 'Bu qurilmada eslab qolganlarim:')}\n${lines.join('\n')}\n${L('Стереть всё можно кнопкой «Забыть всё» или фразой «забудь всё».', 'You can erase it with the "Forget all" button or by saying "forget everything".', '«Hammasini unut» tugmasi yoki iborasi bilan oʻchirish mumkin.')}`
        : L('Пока я почти ничего о тебе не знаю. Расскажи, как тебя зовут и в каком ты классе?', 'I barely know anything about you yet. What is your name and which grade are you in?', 'Hozircha sen haqingda deyarli hech narsa bilmayman. Isming nima, nechanchi sinfdasan?'),
    }
  }
  const correction = trimmed.match(CORRECTION)
  if (correction) {
    const claim = correction[1]!.trim().replace(/[.!]+$/, '')
    const check = verifyClaim(claim, lang)
    profile.notes = [...profile.notes, { text: claim, at: Date.now(), kind: 'correction', status: check.status, checkedWith: check.truth }]
    if (check.status === 'contradicted') profile.mistakes = [...profile.mistakes, claim]
    const text =
      check.status === 'checked'
        ? L(`Спасибо, что поправил${profile.name ? `, ${profile.name}` : ''}! Ты прав — сверил с данными: ${check.truth}. Запомнил.`, `Thanks for the correction! You are right — I checked the data: ${check.truth}. Noted.`, `Tuzatganing uchun rahmat! Toʻgʻri aytding — maʼlumotlar bilan tekshirdim: ${check.truth}. Eslab qoldim.`)
        : check.status === 'contradicted'
          ? L(`Давай сверимся: по данным таблицы ${check.truth}. Я записал твою поправку, но пометил её как спорную. Посмотри ещё раз в учебнике — если найдёшь другое значение, скажи, разберёмся вместе.`, `Let us double-check: according to the data, ${check.truth}. I saved your correction but marked it as disputed. Please check the textbook — if you find something else, tell me.`, `Keling, tekshiramiz: jadval boʻyicha ${check.truth}. Tuzatishingni yozib qoʻydim, lekin bahsli deb belgiladim. Darslikka yana bir qarab chiq.`)
          : L(`Спасибо, учту! Записал твою поправку как заметку с твоих слов: «${claim}». Проверить её по своим данным я не могу — если это для контрольной, сверь с учебником.`, `Thanks, noted! I saved your correction as your note: "${claim}". I cannot verify it with my data, so double-check the textbook if it is for a test.`, `Rahmat, hisobga olaman! Tuzatishingni sening soʻzlaring sifatida yozdim: «${claim}». Uni maʼlumotlarim bilan tekshira olmayman — darslik bilan solishtir.`)
    return { intent: 'mem_correction', text, noteStatus: check.status }
  }
  const remember = trimmed.match(REMEMBER)
  if (remember) {
    const claim = remember[1]!.trim().replace(/[.!]+$/, '')
    const check = verifyClaim(claim, lang)
    profile.notes = [...profile.notes, { text: claim, at: Date.now(), kind: 'remember', status: check.status, checkedWith: check.truth }]
    if (check.status === 'contradicted') profile.mistakes = [...profile.mistakes, claim]
    const text =
      check.status === 'checked'
        ? L(`Записал: «${claim}». Сверил с таблицей — всё верно: ${check.truth}. 👍`, `Saved: "${claim}". I checked it — correct: ${check.truth}. 👍`, `Yozib qoʻydim: «${claim}». Tekshirdim — toʻgʻri: ${check.truth}. 👍`)
        : check.status === 'contradicted'
          ? L(`Записал как твою заметку, но смотри: по данным проекта ${check.truth}. Похоже, тут неточность — я пометил заметку как спорную. Хочешь, разберём, как это посчитать?`, `Saved as your note, but look: according to the data, ${check.truth}. Seems there is a mistake — I marked the note as disputed. Want me to show how to calculate it?`, `Eslatma sifatida yozdim, lekin qara: maʼlumotlarga koʻra ${check.truth}. Bu yerda xato bor shekilli — bahsli deb belgiladim. Qanday hisoblashni koʻrsataymi?`)
          : L(`Запомнил с твоих слов: «${claim}». Это твоя заметка — я не выдаю её за проверенный факт, но буду о ней помнить.`, `Remembered your words: "${claim}". It is your note — I will not present it as a verified fact, but I will keep it in mind.`, `Sening soʻzlaringni eslab qoldim: «${claim}». Bu sening eslatmang — uni tekshirilgan fakt deb aytmayman, lekin yodda tutaman.`)
    return { intent: 'mem_note', text, noteStatus: check.status }
  }
  const name = trimmed.match(NAME_SET)
  if (name && !/^(не|nima|not)$/iu.test(name[1]!)) {
    const n = cap(name[1]!.toLowerCase())
    const had = profile.name
    profile.name = n
    const pool =
      lang === 'en'
        ? [`Nice to meet you, ${n}! I will remember your name. What shall we study?`, `Great, ${n}! Now I know who I am talking to. What are you curious about?`]
        : lang === 'uz'
          ? [`Tanishganimdan xursandman, ${n}! Ismingni eslab qoldim. Nimani oʻrganamiz?`, `Zoʻr, ${n}! Endi kim bilan gaplashayotganimni bilaman. Nima qiziq?`]
          : had && had !== n
            ? [`Понял, теперь буду звать тебя ${n}! Что разберём?`]
            : [`Приятно познакомиться, ${n}! Запомнил твоё имя. С чего начнём?`, `Отлично, ${n}! Теперь знаю, с кем говорю. Что тебе интересно в химии?`, `${n} — красивое имя! Запомнил. Есть вопрос по уроку?`]
    return { intent: 'mem_name', text: pick(pool, `name-${lang}`, profile) }
  }
  const grade = trimmed.match(GRADE_SET)
  if (grade) {
    const g = Number(grade[1] ?? grade[2] ?? grade[3])
    if (g >= 1 && g <= 11) {
      profile.grade = g
      const hint = g >= 7 ? '' : L(' Химию в школе обычно начинают с 7 класса, так что начнём с самых основ.', ' School chemistry usually starts in grade 7, so we will begin with the basics.', ' Kimyo odatda 7-sinfdan boshlanadi, shuning uchun asoslardan boshlaymiz.')
      return { intent: 'mem_grade', text: L(`Понял, ${g} класс! Буду объяснять под твою программу.${hint} Какая тема сейчас идёт?`, `Got it, grade ${g}! I will tailor explanations to your curriculum.${hint} What topic are you on now?`, `Tushundim, ${g}-sinf! Dasturingga moslab tushuntiraman.${hint} Hozir qaysi mavzu?`) }
    }
  }
  const like = trimmed.match(LIKE_SET)
  if (like) {
    const topic = like[1]!.trim().replace(/[.!?]+$/, '')
    if (!profile.likes.includes(topic)) profile.likes = [...profile.likes, topic]
    return { intent: 'mem_like', text: L(`Здорово, запомнил: тебе нравится «${topic}». Буду подбирать примеры поближе к этому. Хочешь, начнём прямо с этой темы?`, `Cool, noted: you like "${topic}". I will pick examples closer to it. Shall we start right there?`, `Zoʻr, eslab qoldim: senga «${topic}» yoqadi. Misollarni shunga yaqin tanlayman. Shu mavzudan boshlaymizmi?`) }
  }
  return null
}

/* ----------------------------------------------------- главная функция */

function socialReply(intent: TalkIntent, lang: TalkLang, profile: StudentProfile, d: Date): string {
  const withName = ['greet', 'bye', 'thanks', 'emo_scared', 'emo_tired', 'motivation'].includes(intent) || profile.turns % 3 === 0
  let text = fill(pick(TALK[lang][intent], `${intent}-${lang}`, profile), lang, profile, withName, d)
  // Вернувшийся ученик: вспоминаем любимую тему.
  if (intent === 'greet' && profile.likes.length && rng() < 0.5) {
    const topic = profile.likes[profile.likes.length - 1]
    text += lang === 'en' ? ` By the way, last time you said you like "${topic}".` : lang === 'uz' ? ` Aytgancha, oʻtgan safar «${topic}» yoqishini aytganding.` : ` Кстати, ты говорил, что тебе нравится «${topic}» — можем продолжить.`
  }
  return text
}

/**
 * Разобрать реплику ученика. null — обычный учебный вопрос (отвечает прежний движок);
 * prefix — социальная часть + остаток-вопрос; reply — полный ответ.
 */
export function humanTurn(raw: string, opts: HumanTurnOptions): HumanTurn | null {
  const lang = opts.lang
  const d = opts.now ?? clock()
  const profile: StudentProfile = { ...loadProfile() }
  profile.turns += 1
  const commit = () => saveProfile(profile)
  // Надиктованная речь: «э… ну… это самое… что такое моль, да?» → «что такое моль?» (регистр и формулы сохраняются).
  const text = spokenNormalize(raw).trim()
  if (!text) return null

  // 1) Память — раньше всего («запомни: …» может содержать что угодно).
  const mem = memoryTurn(text, lang, profile)
  if (mem) {
    if (mem.intent === 'mem_forget') {
      forgetEverything()
      return { kind: 'reply', text: mem.text, intent: mem.intent, intents: [mem.intent] }
    }
    commit()
    return { kind: 'reply', text: mem.text, intent: mem.intent, intents: [mem.intent], noteStatus: mem.noteStatus }
  }

  // 2) Социальный префикс: приветствие / спасибо / извини / «не понимаю» + остаток.
  let norm = fixTypos(normalizeUtterance(text))
  let rest = text
  const prefixIntents: (TalkIntent | 'confused')[] = []
  for (let guard = 0; guard < 3; guard++) {
    const lead: [TalkIntent | 'confused', RegExp][] = [
      ['greet', GREETING_LEAD],
      ['thanks', THANKS_LEAD],
      ['sorry', SORRY_LEAD],
      ['confused', CONFUSED_LEAD],
    ]
    let matched = false
    for (const [intent, re] of lead) {
      const m = norm.match(re)
      if (!m || !m[0].trim()) continue
      prefixIntents.push(intent)
      const cut = m[0].length
      norm = norm.slice(cut).trim()
      // Остаток в исходном регистре (для формул «H2SO4»): отрезаем столько же слов.
      const wordsCut = m[0].trim().split(/\s+/).length
      rest = rest.trim().split(/\s+/).slice(wordsCut).join(' ')
      matched = true
      break
    }
    if (!matched || !norm) break
  }
  rest = rest.replace(/^[,!.\s—-]+/, '').replace(/^(а|и|and|va)\s+/iu, '')
  const restNorm = norm.replace(/^(а|и|and|va)\s+/iu, '')

  // Только социальная реплика: «привет!», «спасибо большое», «не понимаю».
  if (prefixIntents.length && !restNorm.replace(/[\s?!.,)]+/g, '')) {
    const main = prefixIntents[0]!
    const intent: TalkIntent = main === 'confused' ? 'emo_confused' : main
    const reply = socialReply(intent, lang, profile, d)
    commit()
    return { kind: 'reply', text: reply, intent, intents: prefixIntents.map((i) => (i === 'confused' ? 'emo_confused' : i)) }
  }

  const body = prefixIntents.length ? restNorm : norm
  const bodyRaw = prefixIntents.length ? rest : text
  const prefix = prefixIntents.map((i) => shortPrefix(i, lang, profile, d)).join(' ')
  const intents: HumanIntent[] = prefixIntents.map((i) => (i === 'confused' ? 'emo_confused' : i))
  const wrap = (answer: string, intent: HumanIntent, numbers?: Record<string, number>): HumanTurn => {
    commit()
    return { kind: 'reply', text: prefix ? `${prefix} ${answer}` : answer, intent, intents: [...intents, intent], numbers }
  }

  // 3) Вычисления и единицы.
  const units = convertUnitsQuery(bodyRaw, lang)
  if (units) return wrap(units.text, 'units', { result: units.result })
  const expr = extractArithmetic(bodyRaw)
  if (expr) {
    const value = evaluateArithmetic(expr)
    const L = (ru: string, en: string, uz: string) => (lang === 'en' ? en : lang === 'uz' ? uz : ru)
    if (value == null) {
      return wrap(L('Хм, этот пример я не могу посчитать — возможно, там деление на ноль или лишняя скобка. Проверь запись?', 'Hmm, I cannot calculate that — maybe there is a division by zero or an extra bracket. Could you check it?', 'Hmm, buni hisoblay olmayman — nolga boʻlish yoki ortiqcha qavs boʻlishi mumkin. Tekshirib koʻrasanmi?'), 'arith')
    }
    const shown = `${prettyExpression(expr)} = ${formatNumber(value, lang)}`
    const tail = pick(
      lang === 'en' ? ['', ' Easy!', ' Need a chemistry problem with numbers like that?'] : lang === 'uz' ? ['', ' Oson!', ' Shunday sonli kimyo masalasini yechamizmi?'] : ['', ' Проще простого!', ' Хочешь, решим химическую задачу с такими числами?'],
      `arith-tail-${lang}`,
      profile,
    )
    return wrap(`${shown}.${tail}`, 'arith', { result: value })
  }

  // 3b) Учёный («кто такой Бутлеров», «о Менделееве», «who was Dalton») — до chemTurn,
  //     иначе «кто такой Бор» ответит про элемент бор. Текст — только из записи, подпись «[ATOMLAB — учёные]».
  const sci = scientistTalk(bodyRaw, lang, profile.turns)
  if (sci) return wrap(sci.text, 'scientist')

  // 4) Химия из данных проекта (элементы, формулы, «а у него?»).
  const chem = chemTurn(bodyRaw, lang, profile)
  if (chem) {
    const opener = profile.turns % 2 === 0 && !prefix ? `${fill(pick(OPENERS[lang], `open-${lang}`, profile), lang, profile, profile.turns % 4 === 0, d)} ` : ''
    return wrap(`${opener}${chem.text}`, 'chem', chem.numbers)
  }

  // 5) Разговорные намерения.
  for (const [intent, re] of INTENT_RE) {
    if (!re.test(body)) continue
    // «Хорошо» в ответ не на «как дела?» — это обычное «понятно», его ведёт прежний движок.
    if (intent === 'student_fine' && !/(как\s+(дела|настроение|ты|день)|how\s+are|how\s+is\s+your|qalay|kuning)/iu.test(opts.lastTeacher ?? '')) continue
    // «Погода» в химическом вопросе («почему в дождливую погоду…») — не мировой вопрос.
    if (intent === 'offline_world' && /(хими|реакц|вещест|элемент|chem|kimyo)/iu.test(body)) continue
    // Длинная реплика с эмоцией и учебным вопросом: сочувствие-префикс + ответ по книге.
    const isEmotion = intent.startsWith('emo_') || intent === 'motivation'
    const words = body.split(/\s+/).length
    if (isEmotion && words > 8 && /[?]|что\s+так|объясни|как\s|почему|what|how|why|nima|qanday/iu.test(body)) {
      const sympathy = shortPrefix('confused', lang, profile, d)
      commit()
      return { kind: 'prefix', prefix: [prefix, sympathy].filter(Boolean).join(' '), rest: bodyRaw, intents: [...intents, intent] }
    }
    const isLife = intent.startsWith('life_')
    const isTeacherQ = intent.startsWith('teacher_')
    // Бытовая тема рядом с химическим вопросом («после футбола спроси про кислород») — к учебнику, не к болтовне.
    if (isLife && intent !== 'life_grades' && /(хими|реакц|вещест|элемент|формул|моль|валентн|оксид|кислот|chem|formula|reaction|kimyo|reaksiya|modda)/iu.test(body)) continue
    if (isLife && words > 14) continue
    if (!isEmotion && !isLife && !isTeacherQ && !['joke', 'fact', 'offline_world', 'whatcanyou', 'whoareyou', 'howareyou', 'date', 'time'].includes(intent) && words > 7) continue
    return wrap(socialReply(intent, lang, profile, d), intent)
  }

  if (prefix) {
    commit()
    return { kind: 'prefix', prefix, rest: bodyRaw, intents }
  }
  return null
}

/**
 * Сделать ответ по учебнику «человечнее»: иногда обращение по имени, иногда лёгкий вопрос-продолжение.
 * Цитаты в конце («[Kimyo 8, §2]») не трогаем — их добавляет вызывающий код.
 */
export function humanizeBookAnswer(text: string, lang: TalkLang, seed = 0): string {
  const profile = { ...loadProfile() }
  let out = text.trim()
  if (!out) return out
  if (profile.name && seed % 3 === 1 && !out.includes(profile.name)) {
    const look = lang === 'en' ? 'look' : lang === 'uz' ? 'qara' : 'смотри'
    out = `${profile.name}, ${look}: ${out}`
  }
  if (!/[?？]\s*$/.test(out) && seed % 2 === 0 && out.length < 900) {
    out = `${out}\n\n${pick(FOLLOW_UPS[lang], `follow-${lang}`, profile)}`
  }
  saveProfile(profile)
  return out
}

/** Подробность по отзывам 👍/👎 (для ответов из книги). */
export { preferredDetail, applyFeedback, forgetEverything, loadProfile } from './studentProfile'
