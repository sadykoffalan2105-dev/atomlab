/**
 * Ответ «как человек» по статье энциклопедии (Википедия, CC BY-SA 4.0) — wf15.
 *
 * Правило: ни одного факта не из текста статьи. Учитель добавляет только связки («Смотри,», «Если коротко,»,
 * «Интересно, что»), переформулирует даты рождения/смерти из скобок в естественную фразу, при совпадении —
 * напоминает, в каком классе эта тема проходится (по учебникам Kimyo 7–11), и заканчивает коротким вопросом-зацепкой.
 *
 *   учёный:  кто и откуда → годы жизни → главное открытие → любопытный факт → связь со школьной темой → вопрос
 *   понятие: что это → зачем/где используется → один конкретный пример из текста → вопрос
 *
 * Подпись: «[Википедия: <заголовок> — CC BY-SA]». EN/UZ: англ./узб. версия статьи, если есть; иначе фраза на языке
 * ученика + цитата по-русски с пометкой.
 */
import type { KbLang } from '../../kb/types'

export { encyclopediaIntent, wantsEncyclopedia } from '../../kb/encyclopedia'

export type EncyclopediaHit = { id?: string; title: string; text: string; source?: string; type?: string; score?: number; /** wf16: статьи с тем же названием — для уточняющего вопроса. */ alts?: string[] }

export type EncyclopediaAnswer = {
  text: string
  /** «[Википедия: … — CC BY-SA]» — та же строка стоит в конце `text`. */
  citation: string
  title: string
  kind: 'person' | 'topic'
  lang: KbLang
}

const PERSON_TITLE_RE = /^([А-ЯЁ][а-яёА-ЯЁ'’-]+(?:\s[А-ЯЁ][а-яёА-ЯЁ'’-]+){0,2}),\s[А-ЯЁ]|^(Ибн|Абу|Джабир|Ар-|Аль-)/
const PERSON_TEXT_RE = /\(\s*(?:\d{1,2}\s)?(?:\[[^\]]*\]\s*)?(?:[а-я]+\s)?\d{4}[^)]*[—–-][^)]*\d{4}/
const FEMALE_RE = /(?<![а-я])(она|её|ее|родилась|учёная|ученая|женщин|first woman|she|her)(?![а-я])/i

const RU_ABBR = /(^|[\s(«"])(?:т|тт|гг|г|им|акад|проф|см|ср|др|пр|ул|д|с|стр|рис|рр|р|св|сп|напр|ок|н|э|в|вв|ч|мин|тыс|млн|млрд)\.$/i

/** Предложения статьи: сноски и заголовки уже вычищены при сборке корпуса; здесь — аккуратное деление. */
export function splitSentences(text: string): string[] {
  const parts = text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?…])\s+(?=[«"(A-ZА-ЯЁ0-9])/u)
    .map((s) => s.trim())
    .filter(Boolean)
  const out: string[] = []
  for (const p of parts) {
    const prev = out[out.length - 1]
    // «т. е.», «в 1869 г. он…», слишком короткие куски — склеиваем с предыдущим
    // незакрытая скобка «(пол. Mikołaj Kopernik, нем. Niklas…» — фраза ещё не кончилась
    const openParen = prev ? prev.length < 200 && (prev.match(/\(/g) ?? []).length > (prev.match(/\)/g) ?? []).length : false
    if (prev && (openParen || RU_ABBR.test(prev) || prev.length < 25 || /\d\.$/.test(prev) || /(^|\s)[А-ЯЁA-Z]\.$/.test(prev))) out[out.length - 1] = `${prev} ${p}`
    else out.push(p)
  }
  return out.filter((s) => /[а-яёa-z]/i.test(s))
}

const lowerFirst = (s: string) => (s ? s[0]!.toLowerCase() + s.slice(1) : s)

/** Первое слово — служебное или местоимение: можно писать с маленькой буквы после связки учителя. */
const FUNCTION_START =
  /^(В|Во|На|Он|Она|Они|Его|Её|Ее|Их|Это|Этот|Эта|Эти|При|После|До|Для|С|Со|Из|По|К|Ко|За|Также|Кроме|Именно|Одним|Одной|Среди|Благодаря|Вместе|Позднее|Позже|Затем|Впервые|Впоследствии|Здесь|Там|Так|Такой|Такая|Такие|Как|Если|Когда|Чтобы|Хотя|Поэтому|Однако|Но|А|И|Был|Была|Были|Является|Используется|Применяется|Представляет|Получают|Получается|Образуется|Состоит|Служит|Широко|Обычно|Часто|Иногда|Основн|Главн|Наиболее|Самый|Самая|In|The|It|He|She|They|His|Her|Its|This|These|At|By|For|From|With|After|Before|During|Since|While|Although|Because|Later|Then|There|Most|Many|Some|One|An|A|Bu|U|Ular|Uning|Bunda|Shu|Keyin|Avval)\s/u

function joinAfter(connector: string, sentence: string): string {
  if (FUNCTION_START.test(sentence)) return `${connector} ${lowerFirst(sentence)}`
  return `${connector}: ${sentence}`
}

const KEY_DISCOVERY =
  /(открыл|открыла|создал|создала|разработал|разработала|сформулировал|предложил|предложила|основал|основала|получил|получила|синтезировал|изобр[её]л|автор|известен|известна|лауреат|преми|первым|первой|впервые|заложил|доказал|установил|исследовал|discovered|developed|formulated|proposed|founded|known for|awarded|invented|first|pioneer|kashf|yaratgan|asos solgan|birinchi)/i
const KEY_FACT = /(интересно|единственн|назван|в честь|имени|имя|памят|считается|называют|first|only|named after|honour|honor|nomi|nomlangan)/i
const KEY_USE = /(использу|применя|служит|нужн|необходим|важн|получа|производ|промышлен|в быту|used|applied|production|industry|important|ishlatiladi|qo‘llaniladi|qollaniladi|muhim)/i
const KEY_EXAMPLE = /(например|пример|так,|в частности|таким образом|for example|such as|e\.g\.|masalan|xususan)/i

/** Связь со школьной темой — по учебникам Kimyo 7–11 (это слова учителя о программе, не факты статьи). */
const SCHOOL_LINKS: { re: RegExp; ru: string; en: string; uz: string }[] = [
  { re: /периодическ|periodic|davriy/i, ru: 'В 8 классе вы как раз проходите периодический закон и строение атома.', en: 'In grade 8 you study the periodic law and atomic structure — this is exactly that topic.', uz: '8-sinfda siz davriy qonun va atom tuzilishini o‘rganasiz — bu xuddi shu mavzu.' },
  { re: /сохранени[яе] массы|conservation of mass|massaning saqlanish/i, ru: 'Закон сохранения массы — тема 7 класса, с него начинаются все расчёты по уравнениям.', en: 'The law of conservation of mass is a grade 7 topic; all equation calculations start from it.', uz: 'Massaning saqlanish qonuni — 7-sinf mavzusi, tenglamalar bo‘yicha barcha hisoblar undan boshlanadi.' },
  { re: /атомно-молекулярн|атомистическ|atomic theory|atom nazariyasi/i, ru: 'Атомно-молекулярное учение вы разбираете в 7 классе — это самое начало химии.', en: 'Atomic–molecular theory is where grade 7 chemistry begins.', uz: 'Atom-molekulyar ta‘limotni 7-sinfda o‘rganasiz — bu kimyoning eng boshlanishi.' },
  { re: /закон авогадро|avogadro/i, ru: 'Закон Авогадро и молярный объём газов — 8 класс, задачи на объёмы газов.', en: 'Avogadro’s law and the molar volume of gases is a grade 8 topic.', uz: 'Avogadro qonuni va gazlarning molyar hajmi — 8-sinf mavzusi.' },
  { re: /теори[яи] (химического )?строения|structural theory|tuzilish nazariyasi/i, ru: 'Теория строения органических веществ — первая тема органики в 10 классе.', en: 'The theory of chemical structure opens organic chemistry in grade 10.', uz: 'Organik moddalarning tuzilish nazariyasi — 10-sinf organik kimyosining birinchi mavzusi.' },
  { re: /электролитическ|диссоциац|dissociation|dissotsiatsiya/i, ru: 'Электролитическая диссоциация — большая тема 9 класса.', en: 'Electrolytic dissociation is a major grade 9 topic.', uz: 'Elektrolitik dissotsiatsiya — 9-sinfning katta mavzusi.' },
  { re: /радиоактивн|radioactiv|radioaktiv/i, ru: 'Радиоактивность и строение атома вы разбираете в 8 классе.', en: 'Radioactivity and atomic structure come up in grade 8.', uz: 'Radioaktivlik va atom tuzilishi 8-sinfda o‘rganiladi.' },
  { re: /аммиак|ammonia|ammiak/i, ru: 'Аммиак и его производство — тема про азот в 9 классе.', en: 'Ammonia and its production is part of the nitrogen topic in grade 9.', uz: 'Ammiak va uni ishlab chiqarish — 9-sinfdagi azot mavzusi.' },
  { re: /серн(ая|ой) кислот|sulfuric acid|sulfat kislota/i, ru: 'Серную кислоту и её производство проходят в 9 классе.', en: 'Sulfuric acid and its production is covered in grade 9.', uz: 'Sulfat kislota va uni ishlab chiqarish 9-sinfda o‘rganiladi.' },
  { re: /электролиз|electrolysis|elektroliz/i, ru: 'Электролиз — тема 9 класса (а подробнее — в 11-м).', en: 'Electrolysis is a grade 9 topic, with more detail in grade 11.', uz: 'Elektroliz — 9-sinf mavzusi (batafsil — 11-sinfda).' },
  { re: /кислород|oxygen|kislorod/i, ru: 'Кислород — одна из первых тем 7 класса.', en: 'Oxygen is one of the first topics in grade 7.', uz: 'Kislorod — 7-sinfning birinchi mavzularidan biri.' },
  { re: /каучук|полимер|rubber|polymer|kauchuk|polimer/i, ru: 'Каучук и полимеры — органика 10–11 класса.', en: 'Rubber and polymers belong to organic chemistry in grades 10–11.', uz: 'Kauchuk va polimerlar — 10–11-sinf organik kimyosi.' },
  { re: /углевод|белк|жир|carbohydrate|protein|uglevod|oqsil/i, ru: 'Белки, жиры и углеводы — биоорганическая тема 11 класса.', en: 'Proteins, fats and carbohydrates are a grade 11 topic.', uz: 'Oqsillar, yog‘lar va uglevodlar — 11-sinf mavzusi.' },
  { re: /катализ|catalys|kataliz/i, ru: 'Катализаторы и скорость реакций — 9 класс.', en: 'Catalysts and reaction rate is a grade 9 topic.', uz: 'Katalizatorlar va reaksiya tezligi — 9-sinf.' },
  { re: /металл|metal/i, ru: 'Металлы и их получение — большой раздел 9 класса.', en: 'Metals and their production is a big grade 9 section.', uz: 'Metallar va ularni olish — 9-sinfning katta bo‘limi.' },
  { re: /кислот|основани|сол[иь]|оксид|acid|base|salt|oxide|kislota|asos|tuz|oksid/i, ru: 'Классы неорганических веществ — оксиды, кислоты, основания, соли — это 7–8 класс.', en: 'Classes of inorganic substances — oxides, acids, bases, salts — are grades 7–8.', uz: 'Noorganik moddalar sinflari — oksidlar, kislotalar, asoslar, tuzlar — 7–8-sinf.' },
]

const OPENERS = {
  ru: ['Смотри:', 'Если коротко:', 'Вот что важно.', 'Расскажу по-человечески.', 'Хороший вопрос.'],
  en: ['Here is the short version.', 'Good question.', 'Let me put it simply:', 'In short:'],
  uz: ['Qisqacha aytsam:', 'Yaxshi savol.', 'Mana, oddiy tilda:', 'Qarang:'],
} as const

const HOOKS = {
  ru: {
    person: ['Хочешь, расскажу, как это связано с тем, что вы сейчас проходите?', 'Спросить что-нибудь ещё об этом учёном или о его эпохе?', 'Интересно, какие ещё учёные работали над этой темой?'],
    topic: ['Хочешь пример из жизни или разберём, как это связано с темой урока?', 'Рассказать, где это встречается в быту?', 'Копнём глубже — как это работает на уровне атомов?'],
  },
  en: {
    person: ['Want to see how this connects to what you are studying now?', 'Anything else about this scientist or their time?', 'Curious who else worked on this problem?'],
    topic: ['Want an everyday example, or shall we link it to your lesson?', 'Shall I tell you where you meet this in daily life?', 'Shall we dig deeper — how it works at the level of atoms?'],
  },
  uz: {
    person: ['Bu hozir o‘rganayotgan mavzungizga qanday bog‘lanishini aytib beraymi?', 'Bu olim yoki uning davri haqida yana nimani bilmoqchisiz?', 'Bu mavzu ustida yana kim ishlaganini bilishni istaysizmi?'],
    topic: ['Hayotdan misol keltiraymi yoki dars mavzusiga bog‘laymizmi?', 'Bu kundalik hayotda qayerda uchrashini aytaymi?', 'Chuqurroq ko‘ramizmi — atomlar darajasida qanday ishlaydi?'],
  },
} as const

const NEUTRAL_HOOKS = {
  ru: ['Хочешь, расскажу подробнее?', 'Рассказать ещё что-нибудь интересное об этом?', 'Есть ещё вопрос по этой теме?'],
  en: ['Want me to tell you more?', 'Shall I share something else interesting about it?', 'Any other question on this topic?'],
  uz: ['Batafsilroq aytib beraymi?', 'Bu haqida yana qiziqarli narsa aytaymi?', 'Bu mavzu bo‘yicha yana savol bormi?'],
} as const

function langOf(h: EncyclopediaHit): KbLang {
  if (/^Wikipedia/i.test(h.source ?? '')) return 'en'
  if (/^Vikipediya/i.test(h.source ?? '')) return 'uz'
  return 'ru'
}

function pickBest(hits: EncyclopediaHit[], lang: KbLang): { hit: EncyclopediaHit; ru?: EncyclopediaHit } | null {
  const enc = hits.filter((h) => h.type === 'encyclopedia' && h.text && h.title)
  if (!enc.length) return null
  const ru = enc.find((h) => langOf(h) === 'ru')
  if (lang === 'ru') return ru ? { hit: ru } : null
  const own = enc.find((h) => langOf(h) === lang)
  if (own) return { hit: own, ru }
  return ru ? { hit: ru } : null
}

/** «Имя (27 января 1834, Тобольск — 20 января 1907, Санкт-Петербург) — русский химик…» → части. */
function parsePerson(first: string) {
  const m = first.match(/^(.{3,90}?)\s\(([^()]*(?:\([^()]*\)[^()]*)*)\)\s*[—–-]\s*(.+)$/u)
  if (!m) return null
  const [, name, paren, rest] = m
  const halves = paren!.split(/\s[—–]\s/)
  const pick = (part: string | undefined) => {
    if (!part) return { year: undefined, place: undefined }
    const year = part.match(/\b(1[0-9]\d\d|20[0-2]\d)\b/)?.[1]
    const afterYear = year ? part.slice(part.indexOf(year) + 4) : ''
    const place = afterYear
      .split(',')
      .map((s) => s.replace(/\[[^\]]*\]/g, '').trim())
      .filter((s) => s && !/\d/.test(s) && !/^(ныне|сейчас|теперь|now)\b/i.test(s))[0]
    return { year, place }
  }
  const born = pick(halves[0])
  const died = halves.length > 1 ? pick(halves[1]) : { year: undefined, place: undefined }
  if (!born.year) return null
  return { name: name!.trim(), rest: rest!.trim(), born, died }
}

function lifeSentence(p: NonNullable<ReturnType<typeof parsePerson>>, female: boolean, lang: KbLang): string {
  const b = p.born
  const d = p.died
  if (lang === 'en') {
    const bornS = `${female ? 'She' : 'He'} was born in ${b.year}${b.place ? ` (${b.place})` : ''}`
    return d.year ? `${bornS} and died in ${d.year}${d.place ? ` (${d.place})` : ''}.` : `${bornS}.`
  }
  if (lang === 'uz') {
    const bornS = `${b.year}-yilda${b.place ? ` (${b.place})` : ''} tug‘ilgan`
    return d.year ? `${bornS}, ${d.year}-yilda${d.place ? ` (${d.place})` : ''} vafot etgan.` : `${bornS}.`
  }
  const bornS = `${female ? 'Родилась' : 'Родился'} в ${b.year} году${b.place ? ` (${b.place})` : ''}`
  return d.year ? `${bornS}, ${female ? 'умерла' : 'умер'} в ${d.year} году${d.place ? ` (${d.place})` : ''}.` : `${bornS}.`
}

function schoolLink(title: string, text: string, lang: KbLang): string | null {
  const probe = `${title} ${text.slice(0, 500)}`
  for (const l of SCHOOL_LINKS) if (l.re.test(probe)) return l[lang]
  return null
}

function citationFor(title: string, lang: KbLang): string {
  const name = lang === 'en' ? 'Wikipedia' : lang === 'uz' ? 'Vikipediya' : 'Википедия'
  return `[${name}: ${title} — CC BY-SA]`
}

/**
 * Живой ответ учителя по лучшей статье энциклопедии среди `hits` (type 'encyclopedia'); null — если таких нет.
 * 3–5 предложений + вопрос-зацепка + подпись источника.
 */
export function composeEncyclopediaAnswer(
  query: string,
  hits: EncyclopediaHit[],
  lang: KbLang,
  opts: { name?: string; seed?: number } = {},
): EncyclopediaAnswer | null {
  const best = pickBest(hits, lang)
  if (!best) return null
  const { hit } = best
  const articleLang = langOf(hit)
  const seed = Math.abs(opts.seed ?? 0)
  const pick = <T>(arr: readonly T[], shift = 0): T => arr[(seed + shift) % arr.length]!
  const sentences = splitSentences(hit.text)
  if (!sentences.length) return null
  const isPerson = PERSON_TITLE_RE.test(hit.title) || PERSON_TEXT_RE.test(sentences[0]!) || (articleLang !== 'ru' && best.ru ? PERSON_TITLE_RE.test(best.ru.title) : false)
  const kind: 'person' | 'topic' = isPerson ? 'person' : 'topic'
  const used = new Set<number>()
  const take = (re: RegExp | null, from = 1): string | null => {
    for (let i = from; i < sentences.length; i++) {
      if (used.has(i)) continue
      const s = sentences[i]!
      if (s.length < 30 || s.length > 420) continue
      // формулы из разметки статьи («{\displaystyle …}») вслух не читаются
      if (/displaystyle|\\[a-z]{2,}|\{\\/.test(s)) continue
      if (re && !re.test(s)) continue
      used.add(i)
      return s
    }
    return null
  }

  const body: string[] = []
  const opener = pick(OPENERS[articleLang === lang ? lang : 'ru'])
  const first = sentences[0]!
  used.add(0)
  const female = FEMALE_RE.test(hit.text.slice(0, 600))

  if (kind === 'person') {
    const p = parsePerson(first)
    if (p) {
      body.push(`${opener} ${p.name} — ${p.rest}`.replace(/\s+—\s+—\s+/, ' — '))
      body.push(lifeSentence(p, female, articleLang))
    } else {
      body.push(`${opener} ${first}`)
    }
    const discovery = take(KEY_DISCOVERY) ?? take(null)
    if (discovery) body.push(discovery)
    const fact = take(KEY_FACT)
    if (fact && body.length < 5) body.push(joinAfter(articleLang === 'en' ? 'Interesting detail' : articleLang === 'uz' ? 'Qizig‘i shundaki' : 'Интересно, что', fact))
    for (let guard = 0; body.length < 4 && guard < 3; guard++) {
      const more = take(null)
      if (!more) break
      body.push(more)
    }
  } else {
    body.push(`${opener} ${first}`)
    const use = take(KEY_USE)
    if (use) body.push(use)
    const example = take(KEY_EXAMPLE) ?? take(null)
    if (example) body.push(joinAfter(articleLang === 'en' ? 'For instance' : articleLang === 'uz' ? 'Masalan' : 'Например', example))
    for (let guard = 0; body.length < 3 && guard < 3; guard++) {
      const more = take(null)
      if (!more) break
      body.push(more)
    }
  }
  // wf16: статьи большой энциклопедии (id «wb-…») — связь со школой только по названию: текст о биологии или
  // астрономии легко «совпадает» со словами вроде «основание», «соли»
  const big = /^wb-/.test(hit.id ?? '')
  const link = schoolLink(hit.title, big ? '' : hit.text, articleLang)
  if (link && body.length < 5) body.push(link)
  // wf16: ответ как человек — понятие 2–4 фразы (определение → главное → пример), учёный — до 5
  while (body.length > (kind === 'topic' ? 4 : 5)) body.pop()

  // wf16: несколько статей с похожим названием («Меркурий (планета)» / «Меркурий (мифология)») — уточняющий вопрос
  const alts = (hit.alts ?? []).filter((t) => t !== hit.title).slice(0, 2)
  const clarify = alts.length
    ? lang === 'en'
      ? `By the way, did you mean ${alts.map((t) => `“${t}”`).join(' or ')}? Tell me and I will explain that one.`
      : lang === 'uz'
        ? `Aytgancha, ${alts.map((t) => `«${t}»`).join(' yoki ')} haqida so‘radingizmi? Ayting — u haqida ham aytib beraman.`
        : `Кстати, может, ты про ${alts.map((t) => `«${t}»`).join(' или ')}? Скажи — расскажу и об этом.`
    : null
  // большая энциклопедия — темы шире химии (почки, чёрные дыры): «на уровне атомов» там не к месту
  const hook = clarify ?? (big && kind === 'topic' ? pick(NEUTRAL_HOOKS[lang], 1) : pick(HOOKS[lang][kind], 1))
  const hookWithName = !clarify && opts.name && seed % 2 === 0 ? `${opts.name}, ${lowerFirst(hook)}` : hook
  const citation = citationFor(hit.title, articleLang)

  let text: string
  if (articleLang === lang) {
    text = `${body.join(' ')} ${hookWithName}\n\n${citation}`
  } else {
    // версии на языке ученика нет: фраза на его языке + цитата по-русски с пометкой
    const intro =
      lang === 'en'
        ? `Here is what the Russian Wikipedia says (quoted in Russian):`
        : `Rus Vikipediyasi bu haqda shunday yozadi (rus tilida keltiraman):`
    text = `${intro} «${body.join(' ')}» ${hookWithName}\n\n${citation}`
  }
  void query
  return { text, citation, title: hit.title, kind, lang: articleLang }
}

/* ------------------------------------------------------------ «кто открыл / изобрёл X» */

/** Вопрос об открытии или изобретении: «кто открыл кислород», «кто изобрёл телефон», «когда открыли радий». */
export const DISCOVERY_QUESTION_RE =
  /(?<![а-яё])(кто\s+(впервые\s+)?(открыл|изобр[её]л|придумал|получил\s+впервые|впервые\s+получил|синтезировал|обнаружил)|когда\s+(открыли|изобрели|был[аио]?\s+(открыт|изобрет))|кем\s+(был[аио]?\s+)?(открыт|изобрет)|история\s+открытия)/iu

/** Фраза-факт об открытии: «открыл», «открыт», «впервые получил», «изобрёл», «выделил». */
const DISCOVERY_SENTENCE_RE =
  /(?<![а-яё])(открыл[аи]?|открыт[аоы]?|впервые\s+(получ|выдел|синтезир|описал|наблюдал|обнаруж)\p{L}*|получил[аи]?|изобр[её]л[аи]?|изобрет[её]н\p{L}*|изобретени\p{L}*|придумал[аи]?|обнаружил[аи]?|выделил[аи]?|назвал[аи]?)(?![а-яё])/iu

export type DiscoverySource = { title: string; text: string; cite: string }

/**
 * Ответ на «кто открыл X» — только фразы источников, где есть И глагол открытия, И предмет вопроса
 * («Пристли получил кислород…», «Шееле… выделил кислород»): статья X, карточки учёных, учебник.
 * 1–3 фразы из разных источников + короткий вопрос; подписи всех использованных источников. Нет таких фраз — null.
 */
export function composeDiscoveryAnswer(
  subjectTerms: readonly string[],
  sources: readonly DiscoverySource[],
  analyze: (text: string) => string[],
  opts: { seed?: number } = {},
): { text: string; citations: string[] } | null {
  if (!subjectTerms.length) return null
  const picked: { s: string; cite: string }[] = []
  const seenText = new Set<string>()
  // карточки учёных и биографии — первыми: «кто открыл» — вопрос о человеке
  const isPersonSrc = (src: DiscoverySource) => src.cite === '[ATOMLAB — учёные]' || /^[А-ЯЁ][^,()]+,\s+[А-ЯЁ]/u.test(src.title)
  const ordered = [...sources.filter(isPersonSrc), ...sources.filter((s) => !isPersonSrc(s))]
  for (const src of ordered) {
    let bestS: string | null = null
    let bestRank = -1
    const person = isPersonSrc(src)
    for (const s of splitSentences(src.text)) {
      if (s.length < 25 || s.length > 360) continue
      if (!DISCOVERY_SENTENCE_RE.test(s)) continue
      // не биография: во фразе должно быть имя («…получил Г. Кавендиш»), иначе это свойство вещества, а не открытие
      if (!person && !/\s([А-ЯЁ]\.\s*)?[А-ЯЁ][а-яё]{3,}/u.test(s.slice(1))) continue
      const have = new Set(analyze(s))
      if (!subjectTerms.every((t) => have.has(t))) continue
      const rank = (/\d{4}/.test(s) ? 2 : 0) + (/[А-ЯЁ][а-яё]{3,}/u.test(s.slice(1)) ? 1 : 0)
      if (rank > bestRank) {
        bestRank = rank
        bestS = s
      }
    }
    if (!bestS) continue
    const key = bestS.slice(0, 60).toLowerCase()
    if (seenText.has(key)) continue
    seenText.add(key)
    // карточка учёного: «Открыл кислород (независимо от Пристли)…» → «Карл Вильгельм Шееле открыл кислород…»
    const personCard = src.cite === '[ATOMLAB — учёные]'
    // статья-биография «Флеминг, Александр»: «Открыл лизоцим…» → «Александр Флеминг открыл лизоцим…»
    const wikiPerson = src.title.match(/^([А-ЯЁ][^,()]+),\s+([^()]+?)\s*(\(.*\))?$/u)
    const name = personCard ? src.title : wikiPerson ? `${wikiPerson[2]!.trim()} ${wikiPerson[1]!.trim()}` : null
    const startsWithVerb = /^(Открыл|Получил|Выделил|Изобр|Доказал|Впервые|Создал|Предложил|Синтезировал|Обнаружил|Назвал|Описал)/u.test(bestS)
    let sentence = bestS
    if (name && startsWithVerb) sentence = `${name} ${lowerFirst(bestS)}`
    else if (name && /^В\s+\d{4}\s+(году|г\.)\s+[а-яё]/u.test(bestS)) sentence = bestS.replace(/^(В\s+\d{4}\s+(году|г\.))\s+/u, `$1 ${name} `)
    picked.push({ s: sentence, cite: src.cite })
    if (picked.length >= 3) break
  }
  if (!picked.length) return null
  const seed = Math.abs(opts.seed ?? 0)
  const openers = ['Вот как это было.', 'Смотри, что известно.', 'Коротко, по источникам.']
  const hooks =
    picked.length > 1
      ? ['Хочешь, расскажу подробнее о ком-то из них?', 'Как думаешь, почему это открытие приписывают нескольким учёным?']
      : ['Хочешь, расскажу подробнее об этом учёном?', 'Рассказать, как это открытие изменило науку?']
  const body = picked.map((p) => (/[.!?…»]$/.test(p.s) ? p.s : `${p.s}.`)).join(' ')
  const citations = [...new Set(picked.map((p) => p.cite))]
  return { text: `${openers[seed % openers.length]} ${body} ${hooks[(seed + 1) % hooks.length]}\n\n${citations.join(' ')}`, citations }
}
