import { matchFaqEntry, LEARN_CHEMISTRY_FAQ } from './learnChemistryFaq'
import { CHEMISTRY_KNOWLEDGE_CHUNKS, type ChemistryKnowledgeChunk } from './learnChemistryKnowledgeBase'
import { parseRequestedTopicNumber } from './learnG7TextbookKnowledge'
import {
  findTextbookByQuery,
  getTextbookByTopicNumber,
  textbookKnowledgeChunks,
} from './learnTextbookKnowledge'
import { GENERATED_ELEMENT_KNOWLEDGE } from './knowledge/learnGeneratedElementKnowledge'
import { GENERATED_COMPOUND_KNOWLEDGE } from './knowledge/learnGeneratedCompoundKnowledge'
import { SCIENTISTS_KNOWLEDGE } from './knowledge/learnScientistsKnowledge'
import { CHEMISTRY_FORMULAS_KNOWLEDGE } from './knowledge/learnChemistryFormulasKnowledge'
import { REACTIONS_KNOWLEDGE } from './knowledge/learnReactionsKnowledge'
import { ORGANIC_DEEP_KNOWLEDGE } from './knowledge/learnOrganicDeepKnowledge'
import { PROBLEM_BANK_KNOWLEDGE } from './knowledge/learnProblemBankKnowledge'
import { SCHOOL_THEORY_DEEP_KNOWLEDGE } from './knowledge/learnSchoolTheoryDeepKnowledge'
import { MISCONCEPTIONS_KNOWLEDGE } from './knowledge/learnMisconceptionsKnowledge'
import { KINETICS_EQUILIBRIUM_KNOWLEDGE } from './knowledge/learnKineticsEquilibriumKnowledge'
import { LAB_PRACTICE_KNOWLEDGE } from './knowledge/learnLabPracticeKnowledge'
import { THERMO_ELECTRO_KNOWLEDGE } from './knowledge/learnThermoElectroKnowledge'
import { INORGANIC_CORE_KNOWLEDGE } from './knowledge/learnInorganicCoreKnowledge'
import { TEACHER_KNOWLEDGE_PACKS } from './knowledge/learnTeacherKnowledgePacks'
import { TEACHER_REASONING_KNOWLEDGE } from './knowledge/learnTeacherReasoningKnowledge'

const ALL_KNOWLEDGE_CHUNKS: ChemistryKnowledgeChunk[] = [
  ...CHEMISTRY_KNOWLEDGE_CHUNKS,
  ...CHEMISTRY_FORMULAS_KNOWLEDGE,
  ...REACTIONS_KNOWLEDGE,
  ...ORGANIC_DEEP_KNOWLEDGE,
  ...PROBLEM_BANK_KNOWLEDGE,
  ...SCHOOL_THEORY_DEEP_KNOWLEDGE,
  ...MISCONCEPTIONS_KNOWLEDGE,
  ...TEACHER_REASONING_KNOWLEDGE,
  ...KINETICS_EQUILIBRIUM_KNOWLEDGE,
  ...LAB_PRACTICE_KNOWLEDGE,
  ...THERMO_ELECTRO_KNOWLEDGE,
  ...INORGANIC_CORE_KNOWLEDGE,
  ...SCIENTISTS_KNOWLEDGE,
  ...GENERATED_ELEMENT_KNOWLEDGE,
  ...GENERATED_COMPOUND_KNOWLEDGE,
  ...TEACHER_KNOWLEDGE_PACKS,
  ...textbookKnowledgeChunks(),
]

export type RetrievedKnowledge = {
  chunks: ChemistryKnowledgeChunk[]
  faqHit: boolean
  score: number
}

export type RetrieveOptions = {
  maxChunks?: number
  minScore?: number
  gradeId?: string
  chapterId?: string
  sectionId?: string
  sectionTitle?: string
}

/** Интент запроса — поднимает профильные packs и режет шум mega. */
export type QueryIntent =
  | 'misconception'
  | 'problem'
  | 'lab'
  | 'kinetics'
  | 'organic'
  | 'redox'
  | 'definition'
  | 'thermo'
  | 'electro'
  | 'general'

const STOP_TOKENS = new Set([
  'что', 'это', 'как', 'для', 'или', 'при', 'про', 'чем', 'где', 'кто', 'все', 'они', 'она',
  'the', 'and', 'for', 'how', 'what', 'why', 'with', 'from', 'that', 'this', 'are', 'was',
  'мне', 'можно', 'нужно', 'скажите', 'объясни', 'расскажи', 'пожалуйста', 'почему',
])

const SYNONYMS: Record<string, string[]> = {
  кислот: ['acid', 'ph', 'proton', 'h+', 'кислотн'],
  щелоч: ['base', 'alkali', 'гидроксид', 'oh'],
  реакц: ['reaction', 'уравнен', 'equation'],
  молекул: ['molecule', 'структур', '3d'],
  атом: ['atom', 'электрон', 'ядро', 'proton'],
  металл: ['metal', 'металлич'],
  неметалл: ['nonmetal'],
  окислен: ['oxidation', 'овр', 'redox', 'электрон', 'восстанов'],
  раствор: ['solution', 'solvent', 'растворим'],
  газ: ['gas', 'пар', 'vapor'],
  задач: ['problem', 'расчёт', 'вычисл', 'стехиометр', 'решить', 'найти массу', 'сколько'],
  орган: ['organic', 'углеводород', 'алкан', 'алкен', 'спирт', 'бензол', 'полимер'],
  таблиц: ['periodic', 'менделеев', 'element'],
  формул: ['formula', 'состав', 'индекс'],
  связ: ['bond', 'ionic', 'covalent', 'ионн', 'ковалент'],
  почему: ['причина', 'механизм', 'зачем', 'why', 'because'],
  сравн: ['отличи', 'разниц', 'compare', 'difference', 'чем'],
  оксид: ['oxide', 'кислотн', 'основн', 'амфотер'],
  соль: ['salt', 'нейтрализ', 'гидролиз'],
  равновес: ['equilibrium', 'ле шателье', 'смещен', 'обратим'],
  скорост: ['rate', 'катализ', 'активац', 'температур'],
  лаборат: ['lab', 'опыт', 'титрован', 'фильтр', 'пробирк', 'нагрев'],
  определ: ['definition', 'сформулир', 'дайте определение'],
  ошибк: ['путают', 'неправильн', 'misconception', 'типичная ошибка', 'заблужден'],
  алгоритм: ['пошагово', 'как решать', 'схема решения', 'ход решения'],
  учебник: ['параграф', 'kimyo', 'запомните'],
  водород: ['h2', 'хлопок', 'протий'],
  кислород: ['o2', 'горен', 'оксид'],
  углерод: ['углекисл', 'co2', 'алмаз', 'графит', 'орган'],
  аммиак: ['nh3', 'габер', 'азот'],
  этанол: ['спирт', 'c2h5oh', 'брожен'],
  бензол: ['арен', 'c6h6', 'ароматич'],
  энтальп: ['тепловой эффект', 'экзотерм', 'эндотерм', 'hess', 'гесс'],
  электр: ['электролиз', 'гальвани', 'анод', 'катод', 'ток'],
  моль: ['количество вещества', 'n=', 'молярн'],
  стехиометр: ['коэффициент', 'уравнен', 'избыток', 'недостаток'],
  добыч: ['происхожд', 'месторожд', 'руд', 'где берут', 'откуда'],
  применен: ['использу', 'нужен', 'для чего', 'где применяют', 'usage'],
  грамотн: ['ударен', 'как говорить', 'произнос', 'озвуч'],
  номенклатур: ['как назвать', 'название соли', 'название кислоты', 'назови'],
}

function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[^\p{L}\p{N}+-]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOP_TOKENS.has(t))
}

function expandTokens(tokens: string[]): string[] {
  const out = new Set(tokens)
  for (const t of tokens) {
    for (const [stem, syns] of Object.entries(SYNONYMS)) {
      if (t.includes(stem) || (t.length >= 4 && stem.includes(t))) {
        syns.forEach((s) => out.add(s))
      }
    }
  }
  return [...out]
}

function parseGrade(gradeId?: string): number | null {
  if (!gradeId) return null
  const m = gradeId.match(/g(\d+)/)
  return m ? Number(m[1]) : null
}

export function detectQueryIntent(query: string): QueryIntent {
  const q = query.toLowerCase()
  if (/ошибк|путают|заблужд|неправильн|типичн\w*\s+ошиб|misconception|confused with|не путать/.test(q)) {
    return 'misconception'
  }
  if (/задач|расчёт|вычисл|найти массу|сколько\s+(г|грамм|л|моль)|решить|лимитир|избыток|недостаток|выход реакц|η|percent yield/.test(q)) {
    return 'problem'
  }
  if (/титр|фильтр|пробирк|колб|нагрев|опыт|лаборат|бюрет|пипетк|осадок|вытяжк|lab\b|glassware/.test(q)) {
    return 'lab'
  }
  if (/равновес|ле\s*шатель|скорост\w*\s+реакц|катализ|энерги\w*\s+активац|вант-?гофф|le chatelier|reaction rate/.test(q)) {
    return 'kinetics'
  }
  if (/электролиз|гальваническ|анод|катод|электрохими|galvanic|electrolysis/.test(q)) {
    return 'electro'
  }
  if (/энтальп|тепловой эффект|экзотерм|эндотерм|закон гесс|hess|калориметр/.test(q)) {
    return 'thermo'
  }
  if (/овр|окислител|восстановител|электронн\w*\s+баланс|redox|степень окислен/.test(q)) {
    return 'redox'
  }
  if (/орган|алкан|алкен|алкин|спирт|карбонов|бензол|эфир|аминокислот|белок|углевод|полимер/.test(q)) {
    return 'organic'
  }
  if (/что такое|дайте определ|сформулир|definition|что значит|что называют/.test(q)) {
    return 'definition'
  }
  return 'general'
}

/** Вес источника: качественные hand-packs выше шумных mega-окон. */
function sourceWeight(chunk: ChemistryKnowledgeChunk, intent: QueryIntent): number {
  const id = chunk.id
  let w = 0
  if (id.startsWith('misc-')) w += intent === 'misconception' ? 28 : 12
  if (id.startsWith('prob-') || id.startsWith('formula-') || id.startsWith('mega-algo-') || id.startsWith('mega-calc-')) {
    w += intent === 'problem' ? 26 : 10
  }
  if (id.startsWith('lab-')) w += intent === 'lab' ? 26 : 10
  if (id.startsWith('kin-')) w += intent === 'kinetics' ? 24 : 9
  if (id.startsWith('thermo-') || id.startsWith('electro-')) {
    w += intent === 'thermo' || intent === 'electro' ? 24 : 8
  }
  if (id.startsWith('org-') || id.startsWith('org-deep-')) w += intent === 'organic' ? 22 : 8
  if (id.startsWith('rxn-') || id.startsWith('react-')) w += intent === 'redox' ? 18 : 7
  if (id.startsWith('inorg-')) w += 8
  if (id.startsWith('brain') || id.startsWith('teach-') || id.startsWith('logic-')) w += 10
  if (id.startsWith('reason-')) w += intent === 'problem' || intent === 'definition' ? 22 : 14
  if (id.startsWith('theory-') || id.startsWith('school-')) w += 8
  if (id.startsWith('cmp-') || id.startsWith('org-')) {
    w += intent === 'definition' ? 16 : 11
    if (id.includes('-facts')) w += 4
    if (id.includes('-obtain') || id.includes('-rxn')) w += 3
  }
  if (id.startsWith('el-') || id.startsWith('elem-')) w += 8
  if (chunk.textbook) w += 6
  if (/^g[789]-/.test(id) && !id.includes('-w-')) w += 4

  // Шум megaPack
  if (id.includes('-w-')) w -= 18
  if (id.startsWith('mega-move-')) w -= 30
  if (id.startsWith('mega-qa-') && intent !== 'definition') w -= 8
  if (id.startsWith('mega-theory-') && intent === 'problem') w -= 4
  if (id.startsWith('mega-el-') && intent === 'definition') w -= 2
  return w
}

function keywordHitScore(query: string, kw: string): number {
  const k = kw.toLowerCase().trim()
  if (k.length < 3) return 0
  // Многословные ключи — только как фраза (не «что» из «что такое кислота»).
  if (k.includes(' ')) {
    return query.includes(k) ? (k.length >= 10 ? 10 : 7) : 0
  }
  if (!query.includes(k)) return 0
  if (k.length >= 6) return 5
  if (k.length >= 4) return 3
  return 1
}

function scoreChunk(
  query: string,
  tokens: string[],
  chunk: ChemistryKnowledgeChunk,
  opts: RetrieveOptions | undefined,
  intent: QueryIntent,
): number {
  const q = query.toLowerCase()
  let score = sourceWeight(chunk, intent)

  for (const kw of chunk.keywords) {
    score += keywordHitScore(q, kw)
  }

  for (const tok of tokens) {
    if (tok.length < 3) continue
    const tokHit = chunk.keywords.some((kw) => {
      const k = kw.toLowerCase()
      if (k.includes(' ')) return k.split(/\s+/).includes(tok)
      // Не засчитывать короткое вхождение внутрь длинного чужого ключа без равенства/префикса
      if (k === tok) return true
      if (tok.length >= 4 && (k.startsWith(tok) || tok.startsWith(k))) return true
      return tok.length >= 5 && k.includes(tok)
    })
    if (tokHit) score += 2
    if (chunk.topic.toLowerCase().includes(tok)) score += 3
    if (tok.length >= 4) {
      const body = `${chunk.ru} ${chunk.en}`.toLowerCase()
      if (body.includes(tok)) score += 1
    }
  }

  const grade = parseGrade(opts?.gradeId)
  if (grade && chunk.grades?.includes(grade)) score += 4

  if (chunk.textbook && opts?.gradeId && chunk.textbook.gradeId === opts.gradeId) {
    score += 5
    if (opts.chapterId && chunk.textbook.chapterId === opts.chapterId) score += 8

    const requestedKp = parseRequestedTopicNumber(query)

    if (requestedKp !== null && opts.gradeId) {
      const hit = getTextbookByTopicNumber(opts.gradeId, requestedKp, opts.chapterId)
      if (
        hit &&
        chunk.textbook &&
        hit.section.chapterId === chunk.textbook.chapterId &&
        hit.section.sectionId === chunk.textbook.sectionId
      ) {
        score += 55
      }
    } else if (opts.sectionId && chunk.textbook.sectionId === opts.sectionId) {
      score += 16
    }

    if (opts.sectionTitle && requestedKp === null) {
      const st = opts.sectionTitle.toLowerCase()
      if (chunk.topic.toLowerCase().includes(st.slice(0, 20)) || st.includes(chunk.textbook.sectionId)) {
        score += 6
      }
    }
  }

  if (opts?.sectionTitle) {
    const st = opts.sectionTitle.toLowerCase()
    for (const tok of tokens) {
      if (st.includes(tok) && tok.length >= 4) score += 2
    }
  }

  const gradeMatch = q.match(/\b([7-9]|1[01])\s*класс|\bgrade\s*([7-9]|1[01])\b/)
  if (gradeMatch && chunk.grades) {
    const g = Number(gradeMatch[1] ?? gradeMatch[2])
    if (chunk.grades.includes(g)) score += 3
  }

  // Интент-буст по тексту темы
  if (intent === 'misconception' && /ошибк|пута|не путать|misconception/i.test(chunk.topic)) score += 8
  if (intent === 'problem' && /задач|расчёт|алгоритм|пример/i.test(chunk.topic)) score += 6
  if (intent === 'lab' && /лаборат|опыт|посуд|титр|фильтр/i.test(chunk.topic)) score += 6

  return score
}

/** MMR-подобное разнообразие: не забивать top-k одним § / одним префиксом. */
function selectDiverseTop(
  ranked: Array<{ chunk: ChemistryKnowledgeChunk; score: number }>,
  maxChunks: number,
): Array<{ chunk: ChemistryKnowledgeChunk; score: number }> {
  const picked: Array<{ chunk: ChemistryKnowledgeChunk; score: number }> = []
  const prefixCount = new Map<string, number>()
  const sectionCount = new Map<string, number>()

  for (const row of ranked) {
    if (picked.length >= maxChunks) break
    const id = row.chunk.id
    const prefix = id.split('-').slice(0, 2).join('-')
    const sectionKey = row.chunk.textbook
      ? `${row.chunk.textbook.chapterId}/${row.chunk.textbook.sectionId}`
      : id.replace(/-p-\d+$|-w-\d+$|-concept-\d+$/, '')

    const pCount = prefixCount.get(prefix) ?? 0
    const sCount = sectionCount.get(sectionKey) ?? 0
    // Жёсткий кап на скользящие окна и клоны одного §
    if (id.includes('-w-') && sCount >= 1) continue
    if (sCount >= 2) continue
    if (pCount >= 3 && !row.chunk.textbook) continue

    picked.push(row)
    prefixCount.set(prefix, pCount + 1)
    sectionCount.set(sectionKey, sCount + 1)
  }

  // Если слишком мало — добор без капов
  if (picked.length < Math.min(3, maxChunks)) {
    for (const row of ranked) {
      if (picked.length >= maxChunks) break
      if (picked.some((p) => p.chunk.id === row.chunk.id)) continue
      picked.push(row)
    }
  }
  return picked
}

export function retrieveChemistryKnowledge(
  query: string,
  opts?: RetrieveOptions,
): RetrievedKnowledge {
  const maxChunks = opts?.maxChunks ?? 6
  const preferredMin = opts?.minScore ?? 4
  const tokens = expandTokens(tokenize(query))
  const intent = detectQueryIntent(query)
  const faqHit = !!matchFaqEntry(query)

  const scored = ALL_KNOWLEDGE_CHUNKS.map((chunk) => ({
    chunk,
    score: scoreChunk(query, tokens, chunk, opts, intent),
  })).sort((a, b) => b.score - a.score)

  let ranked = scored.filter((r) => r.score >= preferredMin)
  // Fallback: не оставляем учителя без базы, если порог слишком строг
  if (ranked.length < 2) {
    ranked = scored.filter((r) => r.score >= Math.max(2, preferredMin - 2))
  }
  if (ranked.length < 1) {
    ranked = scored.slice(0, Math.min(4, scored.length))
  }

  const directTextbook = findTextbookByQuery(query, {
    gradeId: opts?.gradeId,
    chapterId: opts?.chapterId,
  })
  if (directTextbook) {
    const directChunk = ranked.find(
      (r) =>
        r.chunk.id === directTextbook.id || r.chunk.id.startsWith(`${directTextbook.id}-p`),
    )
    if (directChunk) directChunk.score += 28
    else {
      const hit = ALL_KNOWLEDGE_CHUNKS.find(
        (c) => c.id === directTextbook.id || c.id.startsWith(`${directTextbook.id}-p`),
      )
      if (hit) ranked.push({ chunk: hit, score: 36 })
    }
    ranked.sort((a, b) => b.score - a.score)
  }

  const top = selectDiverseTop(ranked, maxChunks)
  const totalScore = top.reduce((s, r) => s + r.score, 0) + (faqHit ? 10 : 0)

  return {
    chunks: top.map((r) => r.chunk),
    faqHit,
    score: totalScore,
  }
}

export type BuildBlockOptions = {
  maxChars?: number
  gradeId?: string
  chapterId?: string
  sectionId?: string
  sectionTitle?: string
  preloaded?: RetrievedKnowledge
}

export function buildRetrievedKnowledgeBlock(
  query: string,
  locale: 'ru' | 'en',
  maxCharsOrOpts: number | BuildBlockOptions = 5500,
): string {
  const opts: BuildBlockOptions =
    typeof maxCharsOrOpts === 'number' ? { maxChars: maxCharsOrOpts } : maxCharsOrOpts
  const maxChars = opts.maxChars ?? 5500

  const faq = matchFaqEntry(query)
  const { chunks } =
    opts.preloaded ??
    retrieveChemistryKnowledge(query, {
      maxChunks: 10,
      minScore: 4,
      gradeId: opts.gradeId,
      chapterId: opts.chapterId,
      sectionId: opts.sectionId,
      sectionTitle: opts.sectionTitle,
    })

  const parts: string[] = []
  let len = 0

  if (faq) {
    const faqText = locale === 'en' ? faq.en : faq.ru
    const block = `[Reference · ${locale === 'en' ? 'FAQ' : 'типовой вопрос'}]\n${faqText}`
    parts.push(block)
    len += block.length
  }

  for (const c of chunks) {
    const text = locale === 'en' ? c.en : c.ru
    const bookTag = c.textbook ? (locale === 'en' ? ' · textbook' : ' · учебник') : ''
    const header = `[${c.topic}${c.grades ? ` · grades ${c.grades.join('-')}` : ''}${bookTag}]`
    const block = `${header}\n${text}`
    if (len + block.length > maxChars) break
    parts.push(block)
    len += block.length
  }

  if (parts.length === 0 && tokensFallback(query)) {
    for (const entry of LEARN_CHEMISTRY_FAQ) {
      let s = 0
      for (const kw of entry.keywords) {
        if (query.toLowerCase().includes(kw.toLowerCase())) s++
      }
      if (s >= 1) {
        parts.push(locale === 'en' ? entry.en : entry.ru)
        break
      }
    }
  }

  return parts.join('\n\n---\n\n')
}

function tokensFallback(query: string): boolean {
  return query.trim().length >= 3
}
