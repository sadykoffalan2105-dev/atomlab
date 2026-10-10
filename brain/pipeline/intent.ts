/**
 * Шаг 4: намерение. Правила (банк ≥40 шаблонов светской беседы ru/uz/en, маркеры расчёта и проверки ДЗ);
 * спорные случаи (длинный текст без маркеров) уточняются одним быстрым вызовом LLM, если она есть.
 */
import type { Lang } from './normalize.ts'
import { ub } from './rx.ts'

export type Intent = 'smalltalk' | 'chemistry' | 'calc' | 'homework' | 'offtopic' | 'rule' | 'gibberish'
export type SmalltalkKind = 'greet' | 'howareyou' | 'thanks' | 'bye' | 'who' | 'praise' | 'sorry' | 'ok' | 'tired' | 'bored'
export type QType = 'definition' | 'why' | 'how' | 'compare' | 'properties' | 'uses' | 'who' | 'general'

/** Банк шаблонов светской беседы: начало сообщения. */
const SMALLTALK_RAW: [SmalltalkKind, RegExp][] = [
  // приветствия
  ['greet', /^(привет(ик|ствую)?|здравствуй(те)?|здрасьте|здорово|хай|хеллоу|салам|салют|доброе утро|добрый (день|вечер)|доброй ночи|ку)\b/],
  ['greet', /^(hello|hi|hey|hiya|yo|greetings|good (morning|afternoon|evening))\b/],
  ['greet', /^(salom|assalomu alaykum|assalom|xayrli (tong|kun|kech)|hayrli (tong|kun|kech)|salomlar)\b/],
  // как дела
  ['howareyou', /^(как (у тебя |у вас )?(дела|делишки|жизнь|настроение|ты|вы|поживаешь|поживаете|сам)|что нового|как прошел день)\b/],
  ['howareyou', /^(how are (you|u)|how('s| is) it going|how do you do|what'?s up|sup|how have you been|how'?s your day)\b/],
  ['howareyou', /^(qalaysiz|qalaysan|ishlar qalay|yaxshimisiz|yaxshimisan|nima gap|nima yangilik|ahvollar qalay|kayfiyat qalay)\b/],
  // спасибо
  ['thanks', /^(спасибо( большое| огромное)?|спс|благодарю|пасиб|спасибочки|большое спасибо|огромное спасибо)\b/],
  ['thanks', /^(thanks( a lot| so much)?|thank you( so much| very much)?|thx|ty|much appreciated|cheers)\b/],
  ['thanks', /^(rahmat|katta rahmat|tashakkur|raxmat)\b/],
  // пока
  ['bye', /^(пока|до свидания|до встречи|до завтра|увидимся|всего доброго|спокойной ночи|бывай)\b/],
  ['bye', /^(bye|goodbye|good bye|see you|see ya|good night|later|take care)\b/],
  ['bye', /^(xayr|hayr|ko'rishguncha|korishguncha|salomat bo'ling|xayrli tun)\b/],
  // кто ты
  ['who', /^(кто ты|ты кто|кто вы|как тебя зовут|как вас зовут|ты (робот|бот|человек|ии)|что ты (умеешь|можешь))\b/],
  ['who', /^(who are you|what('?s| is) your name|are you (a )?(bot|robot|human|ai)|what can you do)\b/],
  ['who', /^(sen kimsan|siz kimsiz|ismingiz nima|isming nima|sen robotmisan|nima qila olasan)\b/],
  // похвала
  ['praise', /^(ты (молодец|лучший|крут|умный)|круто|класс|супер|отлично объясняешь|здорово объясняешь)\b/],
  ['praise', /^(you('?re| are) (great|awesome|the best|smart)|cool|awesome|great job|nice)\b/],
  ['praise', /^(zo'r|ajoyib|barakalla|qoyil|sen zo'rsan)\b/],
  // извинения
  ['sorry', /^(извини(те)?|прости(те)?|сорри|виноват)\b/],
  ['sorry', /^(sorry|my bad|apologies)\b/],
  ['sorry', /^(kechirasiz|kechir|uzr)\b/],
  // согласие
  ['ok', /^(ок|окей|ладно|хорошо|понятно|ясно|понял|поняла|договорились|ага|угу|да)$/],
  ['ok', /^(ok|okay|got it|alright|sure|fine|yes|yep|understood)$/],
  ['ok', /^(xo'p|xop|tushunarli|tushundim|mayli|ha|albatta)$/],
  // усталость и скука
  ['tired', /^(я )?(устал|устала|утомился|утомилась|нет сил|хочу спать)\b/],
  ['tired', /^(i('?m| am) (tired|exhausted|sleepy))\b/],
  ['tired', /^(charchadim|charchadim-ku|uxlagim kelyapti)\b/],
  ['bored', /^(мне )?(скучно|надоело|неинтересно)\b/],
  ['bored', /^(i('?m| am) bored|this is boring|boring)\b/],
  ['bored', /^(zerikdim|zerikarli|qiziq emas)\b/],
]

const SMALLTALK: [SmalltalkKind, RegExp][] = SMALLTALK_RAW.map(([k, re]) => [k, ub(re)])

/** Слова-обращения, которые остаются после приветствия и ничего не спрашивают. */
const FILLER = /^(учитель|учительница|друг|бро|бот|ии|ustoz|domla|do'stim|teacher|bot|friend|buddy|ты|вы|тебе|вам|you|too|тоже|ham|all|всем|[)(:;!?.,\s-]|\p{Extended_Pictographic})*$/u

export type SmalltalkMatch = { kinds: SmalltalkKind[]; rest: string }

/** Снять светские фразы с начала: «Привет! Что такое моль?» → greet + «Что такое моль?». */
export function matchSmalltalk(cmp: string, original: string): SmalltalkMatch | null {
  let rest = cmp
  let orig = original.trim()
  const kinds: SmalltalkKind[] = []
  for (let guard = 0; guard < 4; guard++) {
    const hit = SMALLTALK.find(([, re]) => re.test(rest))
    if (!hit) break
    const m = rest.match(hit[1])!
    kinds.push(hit[0])
    const cut = m[0].length
    rest = rest.slice(cut).replace(/^[\s,!.?)(:;—–-]+/, '')
    // в оригинале режем столько же «слов», сколько в сравнительной форме
    const words = m[0].split(/\s+/).length
    orig = orig.split(/\s+/).slice(words).join(' ').replace(/^[\s,!.?)(:;—–-]+/, '')
    const fill = rest.match(/^((учитель|учительница|друг|бро|ustoz|domla|teacher|friend)[\s,!.?]*)+/)
    if (fill) {
      rest = rest.slice(fill[0].length)
      orig = orig.split(/\s+/).slice(fill[0].trim().split(/\s+/).length).join(' ')
    }
  }
  if (!kinds.length) return null
  return { kinds, rest: FILLER.test(rest) ? '' : orig }
}

const CALC_RE = [
  /молярн\p{L}* масс/u, /сколько\s+(\p{L}+\s+)?(грамм|г\b|кг|моль|литр|л\b|мл|атомов|молекул|частиц)/u, /уравня|уравнят|расстав\p{L}* коэфф/u,
  /степен\p{L}* окислени/u, /процент|массов\p{L}* дол|объемн\p{L}* дол/u, /концентрац|молярност/u, /\bph\b|\bрн\b|водородн\p{L}* показател/u,
  /разбав/u, /энтальп|тепловой эффект|δh|теплот\p{L}* образовани/u, /н\.\s?у\.|нормальных услови/u, /вычисли|рассчитай|рассчитать|посчитай|найди (массу|объем|количество|число)/u,
  /pv\s*=\s*nrt|уравнени\p{L}* (менделеева|клапейрона)|идеальн\p{L}* газ/u,
  /molyar|necha (gramm|mol|litr)|tenglashtir|koeffitsient|oksidlanish darajasi|massa ulushi|konsentratsiya|hisobla|toping|qancha/u,
  /molar mass|how many (grams|g|moles|mol|liters|litres|atoms|molecules)|balance|coefficient|oxidation (state|number)|mass (fraction|percent)|percent(age)? by mass|concentration|molarity|ph of|dilut|enthalpy|ideal gas|calculate|compute/u,
  /\bm\s*\(\s*[a-z]/i, /[→=⇄]|->/,
].map(ub)
const HOMEWORK_RE = [
  /провер(ь|ьте|ить)|я решил|я решила|мой ответ|правильно ли|верно ли|\bдано\b|\bнайти\b|\bрешение\b/u,
  /tekshir|to'g'rimi|togrimi|men yechdim|berilgan|javobim/u,
  /check (my|this)|is (it|this|my answer) (correct|right)|did i (get|do)|my answer|\bgiven\b/u,
].map(ub)

/** Химическая лексика: основы ru/uz/en. Нет ни одной — кандидат в «не по химии». */
const CHEM_RE =
  /(хими|атом|молекул|\bион|элемент|веществ|реакц|формул|валент|оксид|кислот|основани|щелоч|сол[ьеия]|раствор|масс|моль|связ|заряд|электрон|протон|нейтрон|ядр|катализ|кристалл|металл|газ|жидк|тверд|орбитал|изотоп|гибридиз|энтроп|энтальп|гиббс|равновес|скорост\p{L}* реакц|окисл|восстанов|электролиз|гидролиз|диссоциац|полимер|углевод|белк|жир|спирт|алкан|алкен|алкин|арен|эфир|альдегид|кетон|амин|бензол|нефт|коррози|аллотроп|галоген|водород|кислород|азот|углерод|сера|фосфор|хлор|натри|кали[йя]|кальци|желез|мед[ьи]|цинк|алюмини|серебр|золот|ртут|свинец|титр|хроматограф|спектр|коллоид|буфер|комплексн|координацион|лиганд|термодинам|кинетик|перегонк|фильтр|опыт|лаборатор|пробирк|chem|atom|molecul|\bion|element|substanc|react|formula|valen|oxid|acid|base|salt|solut|mass|\bmole|bond|charg|electron|proton|neutron|nucle|catalys|crystal|metal|\bgas|liquid|solid|orbital|isotop|hybrid|entrop|enthalp|gibbs|equilibri|redox|electroly|hydroly|polymer|carbohydr|protein|alcohol|alkan|alken|alkyn|benzen|ester|aldehyd|ketone|amine|buffer|ligand|titrat|kimyo|modda|reaksiya|birikma|eritma|valentlik|kislota|asos|tuz|elektron|katalizator|oksid|vodorod|kislorod|azot|uglerod|metall|gaz|suyuq|qattiq|molekula|formula|tenglama|izotop|polimer|spirt|\bph\b|[A-Z][a-z]?\d)/iu
const CHEM = ub(CHEM_RE)

const ENCYCLO_RE = ub(/(кто\s|когда\s|истори|открыл|открыт|изобр|учен(ый|ые|ого)|биограф|промышлен|производств|завод|в быту|применени|где использ|who\s|when\s|histor|discover|invent|scientist|industr|everyday|kim\s|qachon|kashf|tarix|olim|sanoat|ishlab chiqarish)/iu)

/** Явные темы «не про химию» — короткий честный ответ и возврат к химии. */
const OFFTOPIC_RE = ub(
  /(футбол|хоккей|фильм|кино|сериал|музык|песн|игр[аыу]|майнкрафт|погод|политик|президент|выбор[ыа]|анекдот|шутк|программирован|python|javascript|рецепт (торта|пирога|блюда)|столиц[аеу]|football|movie|film|music|song|game|weather|politic|joke|capital of|programming|ob-havo|futbol|kino|qo'shiq|o'yin)/iu,
)

export function hasChemVocabulary(text: string): boolean {
  return CHEM.test(text)
}

export function wantsEncyclopedia(cmp: string): boolean {
  return ENCYCLO_RE.test(cmp)
}

export type IntentGuess = { intent: Intent; markers: number; ambiguous: boolean }

export function classifyIntent(text: string, cmp: string): IntentGuess {
  const lines = text.split(/\n/).filter((l) => l.trim()).length
  const numbers = (text.match(/\d+(?:[.,]\d+)?/g) ?? []).length
  const hw = HOMEWORK_RE.some((re) => re.test(cmp)) || (lines >= 3 && numbers >= 2)
  if (hw) return { intent: 'homework', markers: 1, ambiguous: false }
  if (CALC_RE.some((re) => re.test(cmp) || re.test(text))) return { intent: 'calc', markers: 1, ambiguous: false }
  const chem = hasChemVocabulary(text)
  if (!chem && OFFTOPIC_RE.test(cmp)) return { intent: 'offtopic', markers: 1, ambiguous: false }
  if (chem) return { intent: 'chemistry', markers: 1, ambiguous: false }
  return { intent: 'chemistry', markers: 0, ambiguous: text.length > 60 }
}

/** Тип вопроса — от него зависит «логика от законов» в запасном ответе. */
export function questionType(cmp: string): QType {
  if (/(сравни|отлича|отличи|разниц|различ|общего|\bvs\b|versus|differ|compar|farq|solishtir)/u.test(cmp)) return 'compare'
  if (/(почему|зачем|отчего|из-за чего|в чем причина|why|how come|nega|nima uchun|nimaga)/u.test(cmp)) return 'why'
  if (/(как (получ|приготов|сделать|синтезир|образу)|получени|способ\p{L}* получ|how (to|do you|is it) (make|prepare|obtain|produce)|preparation of|qanday (olinadi|olish|hosil)|olinishi)/u.test(cmp)) return 'how'
  if (/(кто (открыл|изобрел|придумал|создал)|когда (открыл|был открыт|открыт)|who (discovered|invented)|kim kashf)/u.test(cmp)) return 'who'
  if (/(свойств|характеристик|properties|xossa|xususiyat)/u.test(cmp)) return 'properties'
  if (/(примен|использ|где (встреча|нужен)|для чего|uses? of|used for|qo'llan|ishlatil)/u.test(cmp)) return 'uses'
  if (/(что так|что это|что значит|что означает|что называ|определени|дай определ|^что за|what is|what are|what does|define|meaning of|nima\b|nima degani|deb ataladi|ta'rif)/u.test(cmp)) return 'definition'
  return 'general'
}

const BRIDGE: Record<Lang, string[]> = {
  ru: ['Чем займёмся — задача, тема или опыт?', 'Какую тему по химии разберём?', 'Хочешь задачу, новую тему или опыт в лаборатории?'],
  uz: ['Nima bilan shugʻullanamiz — masala, mavzu yoki tajriba?', 'Kimyodan qaysi mavzuni koʻrib chiqamiz?', 'Masala yechamizmi, yangi mavzumi yoki laboratoriyada tajriba?'],
  en: ['What shall we do — a problem, a topic or an experiment?', 'Which chemistry topic shall we explore?', 'Want a problem, a new topic or a lab experiment?'],
}

const REPLIES: Record<SmalltalkKind, Record<Lang, string[]>> = {
  greet: {
    ru: ['Привет! Рад тебя видеть.', 'Здравствуйте! Хорошо, что заглянули.', 'Привет-привет! Я на месте и готов к химии.'],
    uz: ['Salom! Sizni koʻrganimdan xursandman.', 'Assalomu alaykum! Yaxshi keldingiz.', 'Salom! Men shu yerdaman va kimyoga tayyorman.'],
    en: ['Hi! Great to see you.', 'Hello! Glad you dropped by.', 'Hey there! I am here and ready for some chemistry.'],
  },
  howareyou: {
    ru: ['Спасибо, у меня всё хорошо — как раз думал, почему лёд плавает на воде. А у тебя как настроение?', 'Отлично, спасибо! Настроение рабочее, химическое. Как ты?'],
    uz: ['Rahmat, yaxshiman — hozirgina muz nega suvda suzishini oʻylayotgan edim. Sizda kayfiyat qalay?', 'Ajoyib, rahmat! Kayfiyat ishchan, kimyoviy. Oʻzingiz qalaysiz?'],
    en: ['Thanks, I am doing well — I was just thinking about why ice floats on water. How about you?', 'Great, thanks! In a very chemical mood today. How are you?'],
  },
  thanks: {
    ru: ['Пожалуйста! Рад, что помог.', 'Всегда пожалуйста — мне самому нравится объяснять.'],
    uz: ['Arzimaydi! Yordam berganimdan xursandman.', 'Marhamat — tushuntirish menga ham yoqadi.'],
    en: ['You are welcome! Glad it helped.', 'Any time — I enjoy explaining this stuff.'],
  },
  bye: {
    ru: ['До встречи! Было приятно позаниматься.', 'Пока! Хорошего дня.'],
    uz: ['Koʻrishguncha! Birga shugʻullanish yoqimli boʻldi.', 'Xayr! Kuningiz yaxshi oʻtsin.'],
    en: ['See you! It was a pleasure working together.', 'Bye! Have a great day.'],
  },
  who: {
    ru: ['Я — учитель химии ATOMLAB: объясняю темы, решаю задачи и разбираю опыты вместе с тобой.'],
    uz: ['Men ATOMLAB kimyo oʻqituvchisiman: mavzularni tushuntiraman, masalalar yechaman va tajribalarni siz bilan birga tahlil qilaman.'],
    en: ['I am the ATOMLAB chemistry teacher: I explain topics, solve problems and walk through experiments with you.'],
  },
  praise: {
    ru: ['Спасибо, очень приятно! А ты молодец, что занимаешься.'],
    uz: ['Rahmat, juda yoqimli! Siz ham shugʻullanayotganingiz uchun barakalla.'],
    en: ['Thank you, that is kind! And well done for studying.'],
  },
  sorry: {
    ru: ['Ничего страшного, всё в порядке.'],
    uz: ['Hechqisi yoʻq, hammasi joyida.'],
    en: ['No worries at all.'],
  },
  ok: {
    ru: ['Отлично!', 'Договорились.'],
    uz: ['Ajoyib!', 'Kelishdik.'],
    en: ['Great!', 'Deal.'],
  },
  tired: {
    ru: ['Понимаю, так бывает. Давай коротко: могу показать один яркий опыт в лаборатории или разобрать маленькую тему за пару минут.'],
    uz: ['Tushunaman, shunday boʻladi. Qisqa qilamiz: laboratoriyada bitta yorqin tajriba koʻrsataman yoki kichik mavzuni ikki daqiqada tushuntiraman.'],
    en: ['I get it, that happens. Let us keep it short: I can show one vivid lab experiment or cover a small topic in a couple of minutes.'],
  },
  bored: {
    ru: ['Давай оживим урок: хочешь опыт, где раствор меняет цвет, или загадку про вещества?'],
    uz: ['Darsni jonlantiramiz: eritma rangi oʻzgaradigan tajriba yoki moddalar haqida topishmoq istaysizmi?'],
    en: ['Let us liven it up: want an experiment where a solution changes colour, or a riddle about substances?'],
  },
}

function pick<T>(list: readonly T[], seed: number): T {
  return list[Math.abs(seed) % list.length]!
}

/** Тёплый ответ 1–2 фразы + мягкий мост к химии (у «пока» и «устал/скучно» мост свой). */
export function smalltalkReply(kinds: readonly SmalltalkKind[], lang: Lang, seed: number): string {
  const main = kinds[kinds.length - 1]!
  const parts: string[] = []
  if (kinds.includes('greet') && main !== 'greet') parts.push(pick(REPLIES.greet[lang], seed))
  parts.push(pick(REPLIES[main][lang], seed))
  if (main === 'bye') parts.push(lang === 'ru' ? 'Возвращайся — продолжим с химией.' : lang === 'uz' ? 'Qaytib keling — kimyoni davom ettiramiz.' : 'Come back any time — we will carry on with chemistry.')
  else if (main !== 'tired' && main !== 'bored') parts.push(pick(BRIDGE[lang], seed + 1))
  return parts.join(' ')
}

/** Короткий префикс-приветствие перед ответом по сути («Привет! Что такое моль?»). */
export function greetingPrefix(kinds: readonly SmalltalkKind[], lang: Lang): string {
  if (kinds.includes('greet')) return lang === 'ru' ? 'Привет! ' : lang === 'uz' ? 'Salom! ' : 'Hi! '
  if (kinds.includes('thanks')) return lang === 'ru' ? 'Пожалуйста! ' : lang === 'uz' ? 'Arzimaydi! ' : 'You are welcome! '
  return ''
}
