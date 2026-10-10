/**
 * Запасной путь без Ollama — ответ из найденного, точных фактов и законов:
 *   1) тезис: определение понятия (ядро понятий, 3 языка) / факты элемента или вещества (qaBank) /
 *      предложение учебника, где термин вопроса — подлежащее (иначе первое предложение лучшего чанка);
 *   2) 1–2 поясняющих предложения из учебника (для ru) или второго понятия;
 *   3) «Логика от законов: …» по типу вопроса (почему — причина через законы; как получить — уравнения из qaBank;
 *      сравнение — две колонки признаков);
 *   4) микровопрос.
 * При conf_r < 0.35 — «Разберём от основ: …» + две ближайшие темы + уточняющий вопрос. Никогда «нет в базе».
 */
import { ELEMENT_DISCOVERY_YEARS } from '../../src/data/elementDiscoveryYears.ts'
import { analyzeTerms } from '../../src/learn/kb/analyzer.ts'
import { FIRST_PRINCIPLES, type Concept } from '../kb/concepts.ts'
import type { Knowledge, QaElement, QaSubstance } from '../kb/shards.ts'
import type { StudentSnapshot } from '../student/model.ts'
import { fallbackStyle } from '../student/adapt.ts'
import { findConcepts, findElements, findFormulas, findSubstances } from './entities.ts'
import type { Candidate } from './hybrid.ts'
import { jaccard } from './hybrid.ts'
import type { Intent, QType } from './intent.ts'
import type { Lang } from './normalize.ts'
import { splitSentences, trimToWords } from './postcheck.ts'
import type { RetrievalResult } from './retrieve.ts'
import { fmt, type ToolResult } from './tools.ts'

const T = (lang: Lang, ru: string, uz: string, en: string) => (lang === 'ru' ? ru : lang === 'uz' ? uz : en)

export type FallbackInput = {
  text: string
  cmp: string
  lang: Lang
  intent: Intent
  qtype: QType
  detail: 'brief' | 'more'
  mode: 'chat' | 'live'
  kb: Knowledge
  retrieval: RetrievalResult | null
  tools: ToolResult[]
  student: StudentSnapshot
  seed: number
  thresholds: { high: number; medium: number }
  wordLimit: number
}

export type FallbackOutput = { text: string; citations: string[]; confidence: number; concept?: string }

function pick<T>(list: readonly T[], seed: number): T {
  return list[Math.abs(seed) % list.length]!
}

const WANTS_NUMBER = /((как(ая|ой|ое|ова|ов)|сколько|назови|точн\p{L}*)[^?.!]{0,40}(температур|масс|вес|год|плотност|объ[её]м|заряд|давлени)|сколько вес|qancha|necha|what is the (exact )?(mass|temperature|year|density)|how much does)/iu
const NUMBER_NOTE: Record<Lang, string> = {
  ru: 'Честно: точного числа здесь назвать нельзя — для этого объекта в научных справочниках нет измеренного значения, а придумывать цифры я не буду. Такие величины определяют только измерением для конкретного чистого вещества и сверяют со справочником.',
  uz: 'Ochigʻi: bu yerda aniq son aytib boʻlmaydi — bu obyekt uchun ilmiy maʼlumotnomalarda oʻlchangan qiymat yoʻq, men esa raqam oʻylab topmayman. Bunday kattaliklar faqat aniq toza modda uchun oʻlchab topiladi va maʼlumotnoma bilan solishtiriladi.',
  en: 'Honestly, no exact number can be given here — there is no measured value for this object in scientific references, and I will not invent one. Such quantities are found only by measuring a specific pure substance and checking against reference data.',
}

const LOGIC: Record<Lang, string> ={ ru: 'Логика от законов: ', uz: 'Qonunlardan mantiq: ', en: 'Reasoning from the laws: ' }

const MICRO: Record<QType | 'calc', Record<Lang, string[]>> = {
  definition: {
    ru: ['Сможете привести свой пример?', 'Как бы вы объяснили это другу одной фразой?'],
    uz: ['Oʻzingiz misol keltira olasizmi?', 'Buni doʻstingizga bir jumlada qanday tushuntirgan boʻlardingiz?'],
    en: ['Can you think of your own example?', 'How would you explain this to a friend in one sentence?'],
  },
  why: {
    ru: ['Попробуете объяснить это своими словами?', 'Как думаете, что изменится, если условия поменять?'],
    uz: ['Buni oʻz soʻzlaringiz bilan tushuntirib bera olasizmi?', 'Sharoit oʻzgarsa, nima oʻzgaradi deb oʻylaysiz?'],
    en: ['Can you explain it in your own words?', 'What do you think would change if the conditions changed?'],
  },
  how: {
    ru: ['Попробуете сами проверить, что уравнение уравнено?', 'Какой признак покажет, что реакция пошла?'],
    uz: ['Tenglama tenglashganini oʻzingiz tekshirib koʻrasizmi?', 'Reaksiya ketganini qaysi belgi koʻrsatadi?'],
    en: ['Can you check for yourself that the equation is balanced?', 'Which sign would show the reaction has started?'],
  },
  compare: {
    ru: ['Какой признак, по-вашему, главный?', 'Сможете добавить ещё одно отличие?'],
    uz: ['Sizningcha, qaysi belgi asosiy?', 'Yana bitta farqni qoʻsha olasizmi?'],
    en: ['Which difference do you think matters most?', 'Can you add one more difference?'],
  },
  properties: {
    ru: ['Какое из этих свойств можно проверить опытом?'],
    uz: ['Bu xossalardan qaysi birini tajribada tekshirish mumkin?'],
    en: ['Which of these properties could you test in an experiment?'],
  },
  uses: {
    ru: ['Где ещё, по-вашему, это пригодится?'],
    uz: ['Sizningcha, bu yana qayerda kerak boʻladi?'],
    en: ['Where else do you think this is useful?'],
  },
  who: {
    ru: ['Хотите узнать, как было сделано это открытие?'],
    uz: ['Bu kashfiyot qanday qilinganini bilishni xohlaysizmi?'],
    en: ['Would you like to hear how the discovery was made?'],
  },
  general: {
    ru: ['Разобрать пример на эту тему?', 'Хотите задачу на эту тему?'],
    uz: ['Shu mavzuda misol koʻrib chiqamizmi?', 'Shu mavzuda masala istaysizmi?'],
    en: ['Shall we work through an example?', 'Would you like a problem on this topic?'],
  },
  calc: {
    ru: ['Хотите похожую задачу для тренировки?', 'Сможете проверить ответ другим способом?'],
    uz: ['Mashq uchun shunga oʻxshash masala istaysizmi?', 'Javobni boshqa usul bilan tekshira olasizmi?'],
    en: ['Would you like a similar problem to practise?', 'Can you check the answer another way?'],
  },
}

// ---------------------------------------------------------------- тексты учебника

export function cleanChunk(text: string, title = ''): string {
  let t = text
    .replace(/\*\*/g, '')
    .replace(/(\p{Ll})-\s+(\p{Ll})/gu, '$1$2')
    .replace(/[ \t]+/g, ' ')
  const first = t.split('\n')[0]!.trim()
  if (title && first && title.toLowerCase().startsWith(first.toLowerCase().slice(0, 40))) t = t.slice(t.indexOf('\n') + 1)
  return t.replace(/\n+/g, ' ').trim()
}

function goodSentence(s: string): boolean {
  if (s.length < 25 || s.length > 330) return false
  const letters = (s.match(/\p{L}/gu) ?? []).length
  if (letters / s.length < 0.6) return false
  if (/^[\p{Ll}(,;:)]/u.test(s)) return false
  if (/(рис\.|таблиц[аеу]\s*\d|упражнени|задани[ея]\s*\d|ответьте на вопросы|^\d+\.)/iu.test(s)) return false
  return true
}

type Sent = { s: string; terms: Set<string>; cand: Candidate; pos: number }

function sentencesFrom(items: Candidate[]): Sent[] {
  const out: Sent[] = []
  for (const c of items.slice(0, 4)) {
    if (c.lang !== 'ru' && c.type !== 'encyclopedia') continue
    const ss = splitSentences(cleanChunk(c.text, c.title)).filter(goodSentence)
    ss.slice(0, 14).forEach((s, pos) => out.push({ s, terms: new Set(analyzeTerms(s)), cand: c, pos }))
  }
  return out
}

function thesisFrom(sents: Sent[], queryTerms: Set<string>): Sent | null {
  let best: Sent | null = null
  let bestScore = -Infinity
  const qt = [...queryTerms]
  for (const x of sents) {
    const hits = qt.filter((t) => x.terms.has(t)).length
    if (!hits) continue
    const firstWords = analyzeTerms(x.s.split(/\s+/).slice(0, 3).join(' '))
    let score = hits * 2 + (firstWords.some((t) => queryTerms.has(t)) ? 3 : 0)
    if (/\s[—–-]\s(это\s)?|называ|является|представляет собой/iu.test(x.s)) score += 2
    score += 1 / (1 + x.pos) - x.s.length / 600
    if (x.cand === sents[0]?.cand) score += 0.5
    if (score > bestScore) {
      bestScore = score
      best = x
    }
  }
  return best ?? sents[0] ?? null
}

function explanationsFrom(sents: Sent[], thesis: Sent | null, queryTerms: Set<string>, n: number): Sent[] {
  const out: Sent[] = []
  for (const x of sents) {
    if (out.length >= n) break
    if (thesis && (x === thesis || jaccard(x.terms, thesis.terms) > 0.5)) continue
    if (out.some((o) => jaccard(o.terms, x.terms) > 0.5)) continue
    if (![...queryTerms].some((t) => x.terms.has(t))) continue
    out.push(x)
  }
  return out
}

const CAUSAL = /(потому что|так как|поэтому|вследствие|из-за|обусловлен|объясняется|причин|благодаря)/iu

// ---------------------------------------------------------------- факты qaBank

const CATEGORY: Record<string, [string, string, string]> = {
  Nonmetal: ['неметалл', 'metallmas', 'non-metal'],
  'Noble gas': ['благородный газ', 'inert gaz', 'noble gas'],
  'Alkali metal': ['щелочной металл', 'ishqoriy metall', 'alkali metal'],
  'Alkaline earth metal': ['щёлочноземельный металл', 'ishqoriy-yer metali', 'alkaline-earth metal'],
  'Transition metal': ['переходный металл', 'oʻtish metali', 'transition metal'],
  'Post-transition metal': ['постпереходный металл', 'oʻtishdan keyingi metall', 'post-transition metal'],
  Metalloid: ['полуметалл', 'yarim metall', 'metalloid'],
  Halogen: ['галоген', 'galogen', 'halogen'],
  Lanthanide: ['лантаноид', 'lantanoid', 'lanthanide'],
  Actinide: ['актиноид', 'aktinoid', 'actinide'],
}
const STATE: Record<string, [string, string, string]> = { Gas: ['газ', 'gaz', 'gas'], Liquid: ['жидкость', 'suyuqlik', 'liquid'], Solid: ['твёрдое вещество', 'qattiq modda', 'solid'] }
const LI = (lang: Lang) => (lang === 'ru' ? 0 : lang === 'uz' ? 1 : 2)

function supConfig(cfg: string): string {
  const sup: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' }
  return cfg.replace(/([spdf])(\d+)/g, (_m, l: string, n: string) => l + [...n].map((c) => sup[c] ?? c).join(''))
}

export function elementFacts(e: QaElement, lang: Lang, withYear: boolean): string {
  const cat = CATEGORY[e.blk]?.[LI(lang)] ?? e.blk.toLowerCase()
  const st = STATE[e.st]?.[LI(lang)]
  const A = fmt(e.A, lang, 3)
  const ox = e.ox ? e.ox.replace(/-/g, '−') : ''
  const year = ELEMENT_DISCOVERY_YEARS[e.z]
  const yearText = withYear && year ? (year === 'Ancient' ? T(lang, ' Известен с древности.', ' Qadimdan maʼlum.', ' Known since antiquity.') : T(lang, ` Открыт в ${year} году.`, ` ${year}-yilda kashf etilgan.`, ` Discovered in ${year}.`)) : ''
  return T(
    lang,
    `${e.ru} (${e.s}) — элемент №${e.z}: ${e.per}-й период, ${e.grp}-я группа, ${cat}${st ? `, при обычных условиях ${st}` : ''}; Ar = ${A}; электронная конфигурация ${supConfig(e.cfg)}${ox ? `; типичные степени окисления: ${ox}` : ''}.${yearText}`,
    `${e.uz} (${e.s}) — №${e.z} element: ${e.per}-davr, ${e.grp}-guruh, ${cat}${st ? `, oddiy sharoitda ${st}` : ''}; Ar = ${A}; elektron konfiguratsiyasi ${supConfig(e.cfg)}${ox ? `; tipik oksidlanish darajalari: ${ox}` : ''}.${yearText}`,
    `${e.en} (${e.s}) is element No. ${e.z}: period ${e.per}, group ${e.grp}, a ${cat}${st ? `, a ${st} under normal conditions` : ''}; Ar = ${A}; electron configuration ${supConfig(e.cfg)}${ox ? `; typical oxidation states: ${ox}` : ''}.${yearText}`,
  )
}

const CLS: Record<string, [string, string, string]> = {
  oxide: ['оксид', 'oksid', 'an oxide'],
  acid: ['кислота', 'kislota', 'an acid'],
  base: ['основание', 'asos', 'a base'],
  salt: ['соль', 'tuz', 'a salt'],
  other: ['вещество', 'modda', 'a substance'],
}

function firstSentence(t: string): string {
  return splitSentences(t)[0] ?? t
}

export function substanceFacts(s: QaSubstance, lang: Lang, qtype: QType): string {
  const cls = CLS[s.cls]?.[LI(lang)] ?? CLS.other![LI(lang)]
  const fam = s.fam ? (lang === 'ru' ? s.fam.ru : lang === 'uz' ? s.fam.uz : s.fam.en) : ''
  const name = (lang === 'ru' ? s.ru : lang === 'uz' ? s.uz : s.en) || s.ru || s.f
  const M = fmt(s.M, lang)
  let out = T(lang, `${name} (${s.f}) — ${cls}${fam ? ` (${fam.toLowerCase()})` : ''}; M = ${M} г/моль.`, `${name} (${s.f}) — ${cls}${fam ? ` (${fam.toLowerCase()})` : ''}; M = ${M} g/mol.`, `${name} (${s.f}) is ${cls}${fam ? ` (${fam.toLowerCase()})` : ''}; M = ${M} g/mol.`)
  if (lang === 'ru' && s.d) out += ' ' + firstSentence(s.d)
  if (lang === 'ru' && s.use && (qtype === 'uses' || qtype === 'general' || qtype === 'definition' || qtype === 'properties')) out += ` Применение: ${firstSentence(s.use).replace(/^./, (c) => c.toLowerCase())}`
  return out
}

function obtainEquations(s: QaSubstance, kb: Knowledge): string[] {
  const out: string[] = []
  if (s.rec) for (const r of s.rec.split(/;\s*/)) if (r.trim()) out.push(r.trim().replace(/\s=\s/, ' → '))
  for (const r of kb.qa.reactions) {
    if (out.length >= 3) break
    if (r.p.includes(s.fa) && !out.includes(r.eq)) out.push(r.eq)
  }
  return out.slice(0, 2)
}

/**
 * Точные справочные факты для промпта LLM (блок «СПРАВОЧНИК ATOMLAB»): определение и «закон» понятия,
 * карточка вещества (M из qaBank), карточка элемента — на языке вопроса. До 4 строк.
 */
export function referenceFacts(text: string, lang: Lang, kb: Knowledge, qtype: QType): string[] {
  const out: string[] = []
  for (const c of findConcepts(text).slice(0, 2)) out.push(`${c.def[lang]} ${c.law[lang]}`)
  const formulaSubs = findFormulas(text, lang !== 'en')
    .map((f) => kb.substanceByFormula.get(f.ascii) ?? null)
    .filter((x): x is QaSubstance => !!x)
  const subs = [...formulaSubs, ...findSubstances(text, kb).map((x) => x.item).filter((s) => !formulaSubs.includes(s))]
  for (const s of subs.slice(0, 2)) out.push(substanceFacts(s, lang, qtype))
  for (const e of findElements(text, kb).slice(0, 1)) out.push(elementFacts(e.item, lang, false))
  return out.slice(0, 4)
}

// ---------------------------------------------------------------- сборка

function topicTitle(c: Candidate, lang: Lang, kb: Knowledge): string | null {
  if (lang === 'ru') return c.title.replace(/:.*$/, '').trim()
  const g = kb.glossaryRu.get(c.title.toLowerCase().replace(/:.*$/, '').trim())
  const tr = g ? (lang === 'uz' ? g.uz[0] : g.en[0]) : null
  return tr ?? null
}

export function composeFallback(inp: FallbackInput): FallbackOutput {
  const { lang, qtype, kb, tools, student } = inp
  const style = fallbackStyle(student, lang, inp.detail, inp.mode)
  const r = inp.retrieval
  const items = r?.items ?? []
  const citations: string[] = []
  const cite = (c: string) => {
    if (c && !citations.includes(c) && citations.length < 3) citations.push(c)
  }
  const parts: string[] = []
  let confidence = r?.confR ?? 0
  let conceptId: string | undefined

  // 0) точные инструменты
  if (tools.length) {
    parts.push(tools.map((t) => t.text).join('\n'))
    cite('[ATOMLAB: расчёт]')
    confidence = Math.max(confidence, 0.95)
    if (inp.intent === 'calc' || inp.intent === 'homework') {
      const body = [style.prefix + parts.join('\n'), pick(MICRO.calc[lang], inp.seed)]
      if (style.suffix) body.push(style.suffix)
      return { text: body.filter(Boolean).join('\n'), citations, confidence }
    }
  }

  const concepts = findConcepts(inp.text)
  const elements = findElements(inp.text, kb).map((x) => x.item)
  const formulaSubs = findFormulas(inp.text, lang !== 'en')
    .map((f) => kb.substanceByFormula.get(f.ascii) ?? null)
    .filter((x): x is QaSubstance => !!x)
  const named = findSubstances(inp.text, kb).map((x) => x.item)
  const substances = [...formulaSubs, ...named.filter((s) => !formulaSubs.includes(s))].filter((s) => Object.keys(s.comp).length > 1 || !elements.some((e) => e.s === s.fa.replace(/\d+$/, '')))
  // вопрос о точном числе (температура, масса, год…), а вещества/элемента/расчёта нет — числа из чужих текстов не цитируем
  const numberTrap = WANTS_NUMBER.test(inp.cmp) && !tools.length && !substances.length && !elements.length
  const sents = (lang === 'ru' ? sentencesFrom(items) : []).filter((x) => !numberTrap || !/\d/.test(x.s))
  const qTerms = r?.queryTerms ?? new Set(analyzeTerms(inp.text, { query: true }))
  const primary: Concept | undefined = concepts[0]
  const lines: string[] = []
  let logic = ''

  // 1) сравнение — две колонки признаков
  if (qtype === 'compare') {
    const sides: string[] = []
    for (const c of concepts.slice(0, 2)) sides.push(`• ${c.def[lang]}`)
    for (const s of substances.slice(0, 2 - sides.length)) sides.push(`• ${substanceFacts(s, lang, 'definition')}`)
    for (const e of elements.slice(0, 2 - sides.length)) sides.push(`• ${elementFacts(e, lang, false)}`)
    if (sides.length >= 2) {
      lines.push(T(lang, 'Сравним по существу:', 'Mohiyatan solishtiramiz:', 'Let us compare the essentials:'), ...sides)
      logic = concepts[0]?.law[lang] ?? FIRST_PRINCIPLES[lang]
      if (concepts[1] && concepts[1].law[lang] !== logic) logic += ' ' + concepts[1].law[lang]
      conceptId = concepts[0]?.id
      confidence = Math.max(confidence, 0.7)
    }
  }

  if (!lines.length) {
    // 2) тезис
    if (primary && !(qtype === 'who' && elements.length)) {
      lines.push(primary.def[lang])
      logic = primary.law[lang]
      conceptId = primary.id
      confidence = Math.max(confidence, 0.7)
    } else if (substances.length) {
      lines.push(substanceFacts(substances[0]!, lang, qtype))
      cite('[ATOMLAB: справочник веществ]')
      confidence = Math.max(confidence, 0.7)
    } else if (elements.length) {
      lines.push(elementFacts(elements[0]!, lang, qtype === 'who' || /открыт|kashf|discover/iu.test(inp.cmp)))
      cite('[ATOMLAB: таблица элементов]')
      confidence = Math.max(confidence, 0.7)
    }

    // 3) учебник: тезис (если ещё нет) и пояснения
    const thesis = sents.length ? thesisFrom(sents, qTerms) : null
    const haveThesis = lines.length > 0
    const enoughRetrieval = confidence >= inp.thresholds.medium || (r?.confR ?? 0) >= inp.thresholds.medium
    if (!haveThesis && thesis && enoughRetrieval) {
      lines.push(thesis.s)
      cite(thesis.cand.citation)
    }
    if (lang === 'ru' && enoughRetrieval) {
      const n = inp.detail === 'more' ? 3 : haveThesis ? 1 : 2
      for (const x of explanationsFrom(sents, haveThesis ? null : thesis, qTerms, n + 2)) {
        if (lines.length >= n + 1) break
        if (lines.some((l) => jaccard(new Set(analyzeTerms(l)), x.terms) > 0.45)) continue
        lines.push(x.s)
        cite(x.cand.citation)
      }
    } else if (lang !== 'ru' && enoughRetrieval) {
      // энциклопедия на языке вопроса (uz/en вступления Википедии)
      const enc = items.find((c) => c.lang === lang && c.type === 'encyclopedia')
      if (enc) {
        const s = splitSentences(cleanChunk(enc.text, enc.title)).find(goodSentence)
        if (s && !lines.length) {
          lines.push(s)
          cite(enc.citation)
        }
      }
      if (concepts[1] && lines.length < 2) lines.push(concepts[1].def[lang])
    }
    if (haveThesis && items[0] && (r?.confR ?? 0) >= inp.thresholds.medium) cite(items[0].citation)

    // 4) логика по типу вопроса
    if (qtype === 'how' && substances.length) {
      const eqs = obtainEquations(substances[0]!, kb)
      if (eqs.length) {
        logic = T(lang, `например, ${eqs.join('; ')}. Атомов каждого элемента слева и справа поровну — закон сохранения массы.`, `masalan, ${eqs.join('; ')}. Har bir element atomlari chapda va oʻngda teng — massaning saqlanish qonuni.`, `for example, ${eqs.join('; ')}. Each element has the same number of atoms on both sides — conservation of mass.`)
        cite(`[ATOMLAB: реакции учебника]`)
      }
    }
    if (qtype === 'why' && !primary && lang === 'ru') {
      const causal = sents.find((x) => CAUSAL.test(x.s) && !lines.includes(x.s))
      if (causal) {
        logic = causal.s.charAt(0).toLowerCase() + causal.s.slice(1)
        cite(causal.cand.citation)
      }
    }
    if (!logic && (substances.length || elements.length)) {
      const e = elements[0]
      if (e) logic = T(lang, `свойства ${e.ru.toLowerCase()} задаёт строение атома: заряд ядра +${e.z} и конфигурация внешнего слоя определяют его место в ${e.grp}-й группе и типичные степени окисления.`, `${e.uz} xossalarini atom tuzilishi belgilaydi: yadro zaryadi +${e.z} va tashqi qavat konfiguratsiyasi uning ${e.grp}-guruhdagi oʻrnini va tipik oksidlanish darajalarini belgilaydi.`, `the properties of ${e.en.toLowerCase()} follow from its atomic structure: nuclear charge +${e.z} and the outer-shell configuration set its place in group ${e.grp} and its typical oxidation states.`)
      else if (substances[0]) logic = T(lang, 'свойства вещества определяются его составом и типом химической связи, а превращения подчиняются закону сохранения массы.', 'moddaning xossalari uning tarkibi va kimyoviy bogʻ turi bilan belgilanadi, oʻzgarishlar esa massaning saqlanish qonuniga boʻysunadi.', 'a substance’s properties come from its composition and bonding, and its reactions obey conservation of mass.')
    }
  }

  // 5) мало знаний — от основ, без выдумок
  const lowConfidence = !lines.length
  if (lowConfidence) {
    const near = items
      .map((c) => topicTitle(c, lang, kb))
      .filter((x): x is string => !!x && x.length < 90)
      .filter((x, i, a) => a.indexOf(x) === i)
      .slice(0, 2)
    let body = T(lang, 'Разберём от основ: ', 'Asoslardan boshlaymiz: ', 'Let us reason from the basics: ') + FIRST_PRINCIPLES[lang]
    if (near.length) body += ' ' + T(lang, `Ближайшие темы в учебнике: «${near.join('», «')}».`, `Darslikdagi eng yaqin mavzular: «${near.join('», «')}».`, `The closest textbook topics: “${near.join('”, “')}”.`)
    for (const c of items.slice(0, 2)) cite(c.citation)
    body += ' ' + T(lang, 'Уточните, пожалуйста: о каком веществе, явлении или законе идёт речь? Тогда разберу точно и с примером.', 'Iltimos, aniqlashtiring: qaysi modda, hodisa yoki qonun haqida gap ketyapti? Shunda aniq va misol bilan tushuntiraman.', 'Could you clarify which substance, phenomenon or law you mean? Then I will go through it precisely, with an example.')
    const text = style.prefix + body + (style.suffix ? ' ' + style.suffix : '')
    return { text: trimToWords(text, inp.wordLimit), citations, confidence: Math.min(confidence, inp.thresholds.medium - 0.01) }
  }

  // 6) сборка, длина, адаптация
  if (numberTrap) {
    lines.unshift(NUMBER_NOTE[lang])
    confidence = Math.min(confidence, inp.thresholds.medium - 0.01)
  }
  let out = lines.slice(0, Math.max(1, style.maxSentences - 1))
  if (inp.mode === 'live') out = out.slice(0, 2)
  let text = style.prefix + out.join(lines[0]?.endsWith(':') ? '\n' : ' ')
  if (logic && inp.mode !== 'live') text += `\n${LOGIC[lang]}${logic.charAt(0).toLowerCase() + logic.slice(1)}`
  if (tools.length) text = parts.join('\n') + '\n' + text
  if (style.offerLab) text += ' ' + T(lang, 'Хотите увидеть это вживую в лаборатории ATOMLAB?', 'Buni ATOMLAB laboratoriyasida jonli koʻrishni xohlaysizmi?', 'Want to see it live in the ATOMLAB lab?')
  else text += '\n' + pick(MICRO[qtype][lang], inp.seed)
  if (style.suffix) text += ' ' + style.suffix
  if (inp.mode === 'live') text = text.replace(/\s*\((?:[A-Z][a-z]?[₀-₉0-9]*)+[⁺⁻²³]*\)/g, '')
  text = trimToWords(text, inp.wordLimit)
  if (!citations.length && conceptId) cite('[ATOMLAB: справочник понятий]')
  return { text, citations, confidence: Math.min(0.99, confidence), concept: conceptId }
}

/** Вопрос не про химию: коротко и честно (энциклопедия, если нашлась) + возврат к химии. */
export function offtopicReply(lang: Lang, retrieval: RetrievalResult | null, seed: number): FallbackOutput {
  const enc = retrieval?.items.find((c) => c.type === 'encyclopedia' && (c.lang === lang || lang === 'ru'))
  const bridge = pick(
    [
      T(lang, 'А теперь давайте вернёмся к химии: какая тема у вас сейчас на уроке?', 'Endi kimyoga qaytaylik: hozir darsda qaysi mavzuni oʻtyapsiz?', 'Now let us get back to chemistry: what topic are you studying right now?'),
      T(lang, 'Если хотите, посмотрим на это глазами химика — из каких веществ это состоит и какие реакции тут идут.', 'Xohlasangiz, bunga kimyogar koʻzi bilan qaraymiz — u qanday moddalardan iborat va qanday reaksiyalar boradi.', 'If you like, we can look at it through a chemist’s eyes — what it is made of and which reactions are involved.'),
    ],
    seed,
  )
  if (enc && (retrieval?.sTop ?? 0) >= 0.5) {
    const s = splitSentences(cleanChunk(enc.text, enc.title)).find(goodSentence)
    if (s) return { text: `${s}\n${bridge}`, citations: [enc.citation], confidence: 0.5 }
  }
  return {
    text: T(
      lang,
      'Это уже не совсем химия, поэтому отвечу коротко и без догадок: надёжного источника по этому вопросу у меня под рукой нет, а придумывать факты я не стану.',
      'Bu endi unchalik kimyo emas, shuning uchun qisqa va taxminsiz javob beraman: bu savol boʻyicha ishonchli manba qoʻlimda yoʻq, faktlarni esa oʻylab topmayman.',
      'That is not really chemistry, so I will keep it short and avoid guessing: I do not have a reliable source on this at hand, and I will not make facts up.',
    ) + `\n${bridge}`,
    citations: [],
    confidence: 0.3,
  }
}

