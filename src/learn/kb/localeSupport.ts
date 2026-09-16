/**
 * en/uz support for the local (no-LLM) teacher answer: the textbooks are Russian, so for an English or Uzbek
 * question we add two kinds of extra hits next to the Russian KB hits:
 *
 *   • type 'i18n'     — sentences that already exist in the student's language (translated quiz items of the
 *                       section banks: explanations, full-sentence answers, «Term — answer» pairs);
 *   • type 'glossary' — one hit with glossary pairs «ru<TAB>local1|local2» for the terms of the question and of
 *                       the best Russian hits (the composer translates key terms with them).
 *
 * Quiz sentences are (lightly re-joined) pieces of the translated quiz data; CORE_STATEMENTS are hand-checked
 * translations of the textbook definitions for the most asked terms (the Russian source sentence is quoted next to them).
 * Data is loaded lazily (dynamic import → separate chunks) and only for en/uz questions.
 */
import { foldText } from './analyzer'

/** 'source-quote' — the Russian textbook sentence a core statement translates (quoted next to it by the composer). */
export type LocaleHit = { title: string; text: string; source?: string; citation?: string; type: 'i18n' | 'glossary' | 'source-quote'; score?: number }

type GlossaryEntry = { ru: string; en: string[]; uz: string[]; source?: string; formula?: string[] }
type QuizChunk = { id: string; grade: number | null; sectionId?: string; title: string; lang: string; text: string; source: string }

let glossaryJob: Promise<GlossaryEntry[]> | null = null
let quizJob: Promise<QuizChunk[]> | null = null

function loadGlossary(): Promise<GlossaryEntry[]> {
  glossaryJob ??= import('../../data/kb/corpus/kb-glossary.json')
    .then((m) => ((m.default as unknown as { entries: GlossaryEntry[] }).entries ?? []))
    .catch(() => {
      glossaryJob = null
      return []
    })
  return glossaryJob
}

function loadQuiz(): Promise<QuizChunk[]> {
  quizJob ??= import('../../data/kb/corpus/kb-quiz.json')
    .then((m) => ((m.default as unknown as { chunks: QuizChunk[] }).chunks ?? []).filter((c) => c.lang !== 'ru'))
    .catch(() => {
      quizJob = null
      return []
    })
  return quizJob
}

const norm = (s: string) => foldText(s).toLowerCase().replace(/[^\p{L}\p{N}' -]/gu, ' ').replace(/\s+/g, ' ').trim()

/** Light en/uz word stem (plural/case suffixes only). */
function latStem(word: string): string {
  const w = word.toLowerCase().replace(/'/g, '')
  if (w.length <= 4) return w
  return w.replace(/(ies)$/, 'y').replace(/(larning|larni|larga|larda|lardan|lari|lar|ning|dagi|dan|ni|ga|da|es|s)$/, '')
}

const words = (s: string) => norm(s).split(' ').filter(Boolean)

const hasWord = (textWords: readonly string[], stem: string) =>
  textWords.some((w) => {
    const ws = latStem(w)
    return ws === stem || (stem.length >= 5 && ws.startsWith(stem)) || (ws.length >= 5 && stem.startsWith(ws))
  })

/** Local phrase occurs in a text (every word, as a word form). */
function phraseIn(phrase: string, textWords: readonly string[]): boolean {
  const ps = words(phrase).map(latStem).filter((w) => w.length >= 2)
  if (ps.length === 0) return false
  if (ps.every((p) => hasWord(textWords, p))) return true
  // Multi-word phrase: the other words match exactly, the last one may be a prefix («metall bog'» ⊂ «metall bog'lanish»).
  if (ps.length < 2 || ps[ps.length - 1]!.length < 3) return false
  const tw = textWords.map(latStem)
  for (let i = 0; i + ps.length <= tw.length; i++) {
    if (ps.slice(0, -1).every((p, j) => tw[i + j] === p) && tw[i + ps.length - 1]!.startsWith(ps[ps.length - 1]!)) return true
  }
  return false
}

/** Russian glossary term occurs in a Russian text (prefix of each word). */
function ruTermIn(ru: string, textWords: ReadonlySet<string>): boolean {
  const parts = norm(ru).split(' ').filter((w) => w.length >= 3)
  if (parts.length === 0) return false
  return parts.every((w) => {
    if (w.length <= 4) return textWords.has(w) || [...'аеиоуыяюь'].some((e) => textWords.has(w + e))
    const prefix = w.slice(0, w.length - 2)
    for (const tw of textWords) if (tw.startsWith(prefix) && tw.length <= w.length + 3) return true
    return false
  })
}

const STOP = new Set(
  ('what which when where does why how the and are is of to in for with from about can give explain example tell ' +
    'nima nega qanday qaysi haqida uchun bilan va bu ular misol keltiring tushuntiring deb nimaga').split(' '),
)

const LABELS = {
  en: { q: /^Question:\s*/i, a: /^Answer:\s*/i, e: /^Explanation:\s*/i },
  uz: { q: /^Savol:\s*/i, a: /^Javob:\s*/i, e: /^Izoh:\s*/i },
} as const

const COPULA = { en: /\b(is|are|called|consists?|contains?|means)\b/i, uz: /(deyiladi|hisoblanadi|ataladi|iborat|dir\b|bo'ladi)/i } as const

const lowerFirst = (s: string) => (/^[\p{Lu}]{2}|^[A-Z][a-z]?\d/u.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1))
const upperFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const sentenceEnd = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`)

/** Statements of one translated quiz item. */
function statementsOf(chunk: QuizChunk, lang: 'en' | 'uz'): string[] {
  const lab = LABELS[lang]
  let q = ''
  let a = ''
  let e = ''
  for (const line of chunk.text.split('\n')) {
    if (lab.q.test(line)) q = line.replace(lab.q, '').trim()
    else if (lab.a.test(line)) a = line.replace(lab.a, '').trim()
    else if (lab.e.test(line)) e = line.replace(lab.e, '').trim()
  }
  const out: string[] = []
  const truncated = (s: string) => /(\.\.\.|…)\s*$/.test(s)
  if (e && !truncated(e)) {
    const body = e.replace(/^(According to the textbook|By the textbook|In the textbook|Darslik bo'?yicha|Darslikka ko'ra)\s*:\s*/i, '')
    if (body.split(/\s+/).length >= 4) out.push(sentenceEnd(upperFirst(body)))
  }
  if (!a || truncated(a)) return out
  const aWords = a.split(/\s+/).length
  if (aWords >= 6 && COPULA[lang].test(a) && /[.!]$/.test(a)) out.push(a)
  // «According to § “…”: Catalyst... → Answer» — the stem of a fill-in item plus its (correct) answer.
  const fill = q.match(/:\s*([^:“”"«»]{3,80}?)\s*(?:\.\.\.|…)\s*$/u)
  if (fill && aWords >= 2) {
    const stem = fill[1]!.trim()
    const stemWords = stem.split(/\s+/).length
    // Uzbek word order does not survive the join — only a bare term («Katalizator... → …»).
    const joined =
      lang === 'uz'
        ? stemWords === 1 && !/(dan|da|ga|ni|ning|dagi)$/i.test(stem) && !COPULA.uz.test(stem) ? `${stem} — ${lowerFirst(a)}` : ''
        : /\s(is|are|on|of|by|from|to|as|in|with)$/i.test(stem)
          ? `${stem} ${lowerFirst(a)}`
          : stemWords <= 2 && !COPULA.en.test(stem)
            ? `${stem} — ${lowerFirst(a)}`
            : /\s(is|are)\s/i.test(stem) && stemWords <= 5
              ? `${stem}: ${lowerFirst(a)}`
              : ''
    if (joined) out.push(sentenceEnd(upperFirst(joined)))
  }
  // «How to understand the term “isotopes”?» → «Isotopes — atoms of …» (not «the topic “…”»).
  const quoted =
    lang === 'en'
      ? q.match(/(?:term|specifically of|about|regarding|separates)\s+[“"«]([^”"»]{2,40})[”"»]/i)
      : q.match(/[“"«]([^”"»]{2,40})[”"»]\s*(?:atamasini|haqida|ni\b|ning\b)/i)
  if (quoted && !/topic|mavzu/i.test(q.slice(Math.max(0, (quoted.index ?? 0) - 12), (quoted.index ?? 0) + 4)) && aWords >= 3 && !COPULA[lang].test(a)) {
    out.push(sentenceEnd(`${upperFirst(quoted[1]!.trim())} — ${lowerFirst(a.replace(/[.]$/, ''))}`))
  }
  return out
}

type Statement = { chunk: QuizChunk; text: string; tw: string[]; key: string }
const statementCache = new Map<string, { source: QuizChunk[]; list: Statement[] }>()

/** Parsed and filtered statements of one locale (built once per loaded quiz data). */
function statementIndex(quiz: QuizChunk[], locale: 'en' | 'uz'): Statement[] {
  const cached = statementCache.get(locale)
  if (cached && cached.source === quiz) return cached.list
  const list: Statement[] = []
  for (const chunk of quiz) {
    if (chunk.lang !== locale) continue
    for (const raw of statementsOf(chunk, locale)) {
      // Calques of «сложные/простые вещества»: English school chemistry says «compounds» / «elementary substances».
      const text = locale === 'en' ? raw.replace(/\bcomplex substance(s?)\b/gi, 'compound$1').replace(/\bsimple substance(s?)\b/gi, 'elementary substance$1') : raw
      const tw = words(text)
      if (tw.length < 4 || tw.length > 45) continue
      // Lab safety rules («Rule 12: add acid to water») are not answers about the substance.
      if (/^(rule\s*\d+|\d+-qoida)/i.test(text)) continue
      // OCR-garbled formulas of the source («NahcO3», «caOcl2») — skip the statement.
      if (/\b[a-z]{1,2}[A-Z][A-Za-z]*\d|\b[A-Z][a-z]{2,}[A-Z]\w*\d/.test(text)) continue
      list.push({ chunk, text, tw, key: tw.join(' ') })
    }
  }
  statementCache.set(locale, { source: quiz, list })
  return list
}

/**
 * Hand-checked en/uz statements for core school terms — faithful translations of the Kimyo 7–11 textbook definitions
 * (the source sentence is quoted in Russian next to them by the composer). They replace the machine-quality quiz
 * translations («does not consume itself», «eritmasidan yoki eritmasidan») for the most asked questions.
 * `terms` — word forms that must occur in the question (any alternative, as a word form).
 */
type CoreStatement = {
  terms: { en: string[]; uz: string[] }
  /** Also required in the question (one of): «metals» + «conduct». */
  with?: { en: string[]; uz: string[] }
  title: string
  source: string
  en: string[]
  uz: string[]
  /** The textbook sentence (Russian) to quote when the KB hits do not carry it next to the question. */
  quote?: string
}

const CORE_STATEMENTS: CoreStatement[] = [
  {
    terms: { en: ['catalyst'], uz: ['katalizator'] }, title: 'Катализатор', source: 'Kimyo 11 §23',
    en: ['A catalyst is a substance that increases the rate of a chemical reaction but is not used up in it.', 'For example, manganese(IV) oxide MnO₂ speeds up the decomposition of hydrogen peroxide, and platinum is a catalyst of many reactions.'],
    uz: ['Katalizator — kimyoviy reaksiyani tezlashtiradigan, lekin o‘zi sarflanmaydigan modda.', 'Masalan, marganes(IV) oksid MnO₂ vodorod peroksidning parchalanishini tezlashtiradi, platina esa ko‘p reaksiyalarning katalizatoridir.'],
  },
  {
    terms: { en: ['oxide'], uz: ['oksid'] }, title: 'Оксиды', source: 'Kimyo 8 §2',
    en: ['Oxides are compounds made of two elements, one of which is oxygen.', 'For example, Na₂O, CO₂ and Al₂O₃ are oxides.'],
    uz: ['Oksidlar — ikki elementdan tashkil topgan murakkab moddalar, ulardan biri kislorod.', 'Masalan, Na₂O, CO₂ va Al₂O₃ — oksidlar.'],
  },
  {
    terms: { en: ['isotope'], uz: ['izotop'] }, title: 'Изотопы', source: 'Kimyo 7 §2.5',
    en: ['Isotopes are atoms of the same element that have the same number of protons but a different number of neutrons, so their masses differ.', 'For example, ¹²C and ¹⁴C are isotopes of carbon: both have 6 protons, but 6 and 8 neutrons.'],
    uz: ['Izotoplar — protonlar soni bir xil, neytronlar soni esa har xil bo‘lgan bir element atomlari, shuning uchun ularning massasi har xil.', 'Masalan, ¹²C va ¹⁴C — uglerod izotoplari: ikkalasida 6 tadan proton, lekin 6 va 8 ta neytron bor.'],
  },
  {
    terms: { en: ['electrolysis'], uz: ['elektroliz'] }, title: 'Электролиз', source: 'Kimyo 9 §19',
    en: ['Electrolysis is a redox process that takes place when an electric current passes through a solution or a melt of an electrolyte.'],
    uz: ['Elektroliz — elektrolit eritmasi yoki suyuqlanmasidan elektr toki o‘tganda sodir bo‘ladigan oksidlanish-qaytarilish jarayoni.'],
  },
  {
    terms: { en: ['acid'], uz: ['kislota'] }, title: 'Кислоты', source: 'Kimyo 7 §6.4',
    quote: 'Кислоты – сложные вещества, состоящие из атомов водорода и кислотного остатка.',
    en: ['Acids are compounds made of hydrogen atoms and an acid residue.', 'For example, in hydrochloric acid HCl the acid residue is Cl, and in sulfuric acid H₂SO₄ it is SO₄.'],
    uz: ['Kislotalar — vodorod atomlari va kislota qoldig‘idan tashkil topgan murakkab moddalar.', 'Masalan, xlorid kislota HCl da kislota qoldig‘i Cl, sulfat kislota H₂SO₄ da esa SO₄.'],
  },
  {
    terms: { en: ['electrolyte'], uz: ['elektrolit'] }, title: 'Электролиты', source: 'Kimyo 9 §3',
    en: ['Electrolytes are substances whose solutions or melts conduct an electric current.'],
    uz: ['Elektrolitlar — eritmasi yoki suyuqlanmasi elektr tokini o‘tkazadigan moddalar.'],
  },
  {
    terms: { en: ['metal', 'metals'], uz: ['metall'] }, with: { en: ['conduct', 'electricity', 'current'], uz: ['tok', "o'tkaz", 'elektr'] }, title: 'Металлическая связь', source: 'Kimyo 9 §17',
    quote: 'Наличие этих свободных электронов обусловливает хорошую электро- и теплопроводность металлов.',
    en: ['Metals conduct electricity because free electrons move between the positive ions in the crystal lattice of a metal.', 'These free electrons are shared by the whole crystal.'],
    uz: ['Metallar elektr tokini o‘tkazadi, chunki metall kristall panjarasidagi musbat ionlar orasida erkin elektronlar harakatlanadi.', 'Bu erkin elektronlar butun kristall uchun umumiy hisoblanadi.'],
  },
  {
    terms: { en: ['mixture'], uz: ['aralashma'] }, title: 'Смесь', source: 'Kimyo 7 §1.5',
    en: ['A mixture consists of two or more substances that can be separated by physical methods.'],
    uz: ['Aralashma — fizik usullar bilan ajratish mumkin bo‘lgan ikki yoki undan ortiq moddadan iborat.'],
  },
  {
    terms: { en: ['valence', 'valency'], uz: ['valentlik'] }, title: 'Валентность', source: 'Kimyo 7 §2.6',
    en: ['Valence is the ability of an atom to attach a certain number of other atoms.'],
    uz: ['Valentlik — element atomining boshqa element atomlarining ma’lum sonini biriktirib olish xossasi.'],
  },
  {
    terms: { en: ['corrosion'], uz: ['korroziya'] }, title: 'Коррозия металлов', source: 'Kimyo 9 §18',
    en: ['Corrosion is the destruction of a metal under the action of the environment.'],
    uz: ['Korroziya — metallning atrof-muhit ta’sirida yemirilishi.'],
  },
  {
    terms: { en: ['alloy'], uz: ['qotishma'] }, title: 'Сплавы', source: 'Kimyo 9 §16',
    en: ['An alloy is a material formed when other metals, non-metals or compounds dissolve in molten metals.'],
    uz: ['Qotishma — suyuqlantirilgan metallarda boshqa metallar, metallmaslar va murakkab moddalar erishidan hosil bo‘lgan material.'],
  },
  {
    terms: { en: ['oxidizing agent', 'oxidant', 'oxidiser', 'oxidizer'], uz: ['oksidlovchi'] }, title: 'Окислитель', source: 'Kimyo 8 §19',
    en: ['An oxidizing agent is an atom or ion that accepts electrons in a redox reaction; it is reduced itself.'],
    uz: ['Oksidlovchi — oksidlanish-qaytarilish reaksiyasida elektron qabul qiladigan atom yoki ion; uning o‘zi qaytariladi.'],
  },
  {
    terms: { en: ['reducing agent', 'reductant'], uz: ['qaytaruvchi'] }, title: 'Восстановитель', source: 'Kimyo 8 §19',
    en: ['A reducing agent is an atom or ion that gives away electrons in a redox reaction; it is oxidized itself.'],
    uz: ['Qaytaruvchi — oksidlanish-qaytarilish reaksiyasida elektron beradigan atom yoki ion; uning o‘zi oksidlanadi.'],
  },
  {
    terms: { en: ['hydrolysis'], uz: ['gidroliz'] }, title: 'Гидролиз солей', source: 'Kimyo 9 §7',
    en: ['Hydrolysis of a salt is the formation of a weak electrolyte when the ions of the dissolved salt react with water.'],
    uz: ['Tuz gidrolizi — tuz ionlarining suv bilan o‘zaro ta’sirlashib, kuchsiz elektrolit hosil qilishi.'],
  },
  {
    terms: { en: ['isomer'], uz: ['izomer'] }, title: 'Изомеры', source: 'Kimyo 10 §1.4',
    en: ['Isomers are substances with the same molecular formula but different structure and properties.'],
    uz: ['Izomerlar — molekulyar formulasi bir xil, lekin tuzilishi va xossalari har xil bo‘lgan moddalar.'],
  },
  {
    terms: { en: ['alkane'], uz: ['alkan'] }, title: 'Алканы', source: 'Kimyo 10 §2.1',
    en: ['Alkanes are saturated hydrocarbons: their carbon atoms are joined only by single σ-bonds; the general formula is CnH2n+2.'],
    uz: ['Alkanlar — to‘yingan uglevodorodlar: uglerod atomlari faqat oddiy σ-bog‘lar bilan bog‘langan; umumiy formulasi CnH2n+2.'],
  },
  {
    terms: { en: ['electronegativity'], uz: ['elektromanfiylik'] }, title: 'Электроотрицательность', source: 'Kimyo 8 §14',
    en: ['Electronegativity is the ability of an atom of one element to pull the shared electron pairs of atoms of another element towards itself.'],
    uz: ['Elektromanfiylik — bir element atomining boshqa element atomlari bilan umumiy elektron juftlarini o‘ziga tortish xossasi.'],
  },
  {
    terms: { en: ['equilibrium'], uz: ['muvozanat'] }, title: 'Химическое равновесие', source: 'Kimyo 11 §25',
    en: ['Chemical equilibrium is the state of a reversible reaction in which the rates of the forward and reverse reactions are equal.'],
    uz: ['Kimyoviy muvozanat — qaytar reaksiyada to‘g‘ri va teskari reaksiyalar tezliklari teng bo‘lgan holat.'],
  },
]

function coreHitsFor(qWords: readonly string[], locale: 'en' | 'uz'): LocaleHit[] {
  const out: LocaleHit[] = []
  for (const c of CORE_STATEMENTS) {
    if (!c.terms[locale].some((t) => phraseIn(t, qWords))) continue
    if (c.with && !c.with[locale].some((t) => qWords.some((w) => w.startsWith(norm(t))))) continue
    const citation = `[${c.source.replace(/^Kimyo (\d+) /, 'Kimyo $1, ')}]`
    c[locale].forEach((text, i) => out.push({ title: c.title, text, source: c.source, citation, type: 'i18n', score: 100 - i }))
    if (c.quote) out.push({ title: c.title, text: c.quote, source: c.source, citation, type: 'source-quote', score: 100 })
  }
  return out
}

/**
 * Russian terms of the question for the KB search: «What is the difference between a homogeneous and a heterogeneous
 * mixture?» → ['неоднородная смесь', 'смесь']. The textbooks are Russian, so the query has to carry Russian words.
 */
export async function ruQueryTerms(query: string, locale: 'en' | 'uz'): Promise<string[]> {
  const glossary = await loadGlossary()
  const qWords = words(query)
  const found = glossary.filter((g) => (g[locale] ?? []).some((alt) => phraseIn(alt, qWords))).map((g) => g.ru)
  return [...new Set(found)].sort((a, b) => b.length - a.length).slice(0, 4)
}

export async function localeHitsFor(
  query: string,
  locale: 'en' | 'uz',
  ruHits: readonly { text: string; title: string }[],
  grade?: number,
): Promise<LocaleHit[]> {
  const [glossary, quiz] = await Promise.all([loadGlossary(), loadQuiz()])
  const qWords = words(query)
  const inQuery = glossary.filter((g) => (g[locale] ?? []).some((alt) => phraseIn(alt, qWords)))
  // Longer phrases first; single words inside a matched phrase still count (they are separate concepts).
  const termStems = [...new Set(inQuery.flatMap((g) => (g[locale] ?? []).filter((alt) => phraseIn(alt, qWords)).flatMap((alt) => words(alt).map(latStem))))]
  const contentStems = [...new Set(qWords.filter((w) => w.length >= 4 && !STOP.has(w)).map(latStem))]
  const required = termStems.length ? termStems.filter((s) => s.length >= 3) : contentStems

  const out: LocaleHit[] = coreHitsFor(qWords, locale)
  if (required.length) {
    type Scored = { text: string; chunk: QuizChunk; score: number }
    const seen = new Set<string>()
    const scored: Scored[] = []
    for (const { chunk, text, tw, key } of statementIndex(quiz, locale)) {
      if (seen.has(key)) continue
      const matchedTerms = required.filter((s) => hasWord(tw, s)).length
      if (matchedTerms === 0 || (required.length >= 2 && matchedTerms < Math.ceil(required.length / 2))) continue
      seen.add(key)
      const matchedContent = contentStems.filter((s) => hasWord(tw, s)).length
      const head = tw.slice(0, 4)
      let score = matchedTerms * 2 + matchedContent
      const inHead = required.some((s) => hasWord(head, s))
      if (inHead) score += 2
      if (COPULA[locale].test(text) || /\s—\s/.test(text)) score += 1
      // Definition of the asked term: «Oxides are …», «Izotoplar — …», «… is called electrolysis», «… deb ataladi».
      const lastWords = tw.slice(-4)
      const calledTerm =
        (locale === 'en' ? /\b(is|are) called\b/i.test(text) : /(deb ataladi|deyiladi)\.?$/i.test(text)) && required.some((s) => hasWord(lastWords, s))
      const subjectTerm = inHead && (locale === 'en' ? /^\S+(\s\S+)?\s(is|are|—)\s/i : /^\S+(\s\S+)?\s(—|bu)\s/i).test(text.replace(/^(an?|the)\s/i, ''))
      if (calledTerm || subjectTerm) score += 3
      if (grade != null && chunk.grade === grade) score += 0.5
      score -= tw.length / 40
      scored.push({ text, chunk, score })
    }
    scored.sort((x, y) => y.score - x.score)
    for (const s of scored.slice(0, 8)) {
      out.push({ title: s.chunk.title, text: s.text, source: s.chunk.source, type: 'i18n', score: s.score })
    }
  }

  const ruText = new Set(words(ruHits.slice(0, 5).map((h) => `${h.title} ${h.text}`).join(' ')))
  const pairs = new Map<string, GlossaryEntry>()
  for (const g of inQuery) pairs.set(g.ru, g)
  for (const g of glossary) {
    if (pairs.size >= 120) break
    if (!(g[locale]?.length) || pairs.has(g.ru)) continue
    if (g.source === 'organic') continue
    if (ruTermIn(g.ru, ruText)) pairs.set(g.ru, g)
  }
  if (pairs.size) {
    const text = [...pairs.values()].map((g) => `${g.ru}\t${(g[locale] ?? []).join('|')}\t${g.source ?? ''}\t${g.formula?.[0] ?? ''}`).join('\n')
    out.push({ title: 'glossary', text, source: 'ATOMLAB: glossary', type: 'glossary' })
  }
  return out
}
