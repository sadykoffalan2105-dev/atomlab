/**
 * Reference cards generated from app data (grade-independent "common" shard, KbChunk contract):
 * elements, compounds (facts + obtaining), school reactions with passports, grade 10–11 equations, organic
 * molecules and lessons, solubility table, FAQ, misconceptions and the hand-written knowledge packs (original ids).
 *
 * Quiz items (section quiz banks g7–g9 with en/uz translations, organic nomenclature quizzes) are built by
 * buildQuizChunks() into a separate file — see build-corpus.mts.
 */
import fs from 'node:fs'
import path from 'node:path'
import type { KbChunk } from '../../../src/learn/kb/types.ts'

export type CorpusChunk = KbChunk & { keywords?: string[] }

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..')
const readJson = <T,>(p: string): T => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8')) as T

const stripMd = (s: string) =>
  s
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^#+\s*/gm, '')
    .replace(/`/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

const clean = (xs: (string | undefined | null | false)[]) => xs.filter((x): x is string => !!x && !!x.trim())

const STATE_RU: Record<string, string> = { Gas: 'газ', Solid: 'твёрдое вещество', Liquid: 'жидкость' }
const BLOCK_RU: Record<string, string> = {
  Nonmetal: 'неметалл',
  'Noble gas': 'благородный (инертный) газ',
  'Alkali metal': 'щелочной металл',
  'Alkaline earth metal': 'щёлочноземельный металл',
  Metalloid: 'полуметалл (металлоид)',
  Halogen: 'галоген',
  'Transition metal': 'переходный металл',
  'Post-transition metal': 'постпереходный металл',
  Lanthanide: 'лантаноид',
  Actinide: 'актиноид',
  Metal: 'металл',
}
const CATEGORY_RU: Record<string, string> = {
  oxide: 'оксид',
  acid: 'кислота',
  base: 'основание (гидроксид)',
  salt: 'соль',
  organic: 'органическое вещество',
  simple: 'простое вещество',
}

type RawElement = {
  atomicNumber: number
  symbol: string
  name: string
  atomicMass: number
  electronConfiguration: string
  electronegativity: number | string
  oxidationStates: string
  standardState: string
  meltingPoint: number | string
  boilingPoint: number | string
  groupBlock: string
  yearDiscovered: string
}
type LifeProfile = {
  z: number
  captionRu?: string
  appearanceRu?: string
  usesRu?: string[]
  extractionRu?: string
}

async function elementCards(): Promise<CorpusChunk[]> {
  const { ELEMENT_NAMES_RU } = await import('../../../src/data/elementNamesRu.ts')
  const { ELEMENT_NAMES_EN } = await import('../../../src/data/elementNamesEn.ts')
  const { ELEMENT_NAMES_UZ } = await import('../../../src/data/elementNamesUz.ts')
  const raw = readJson<RawElement[]>('src/data/periodicTableRaw.json')
  const life = readJson<LifeProfile[]>('src/data/elementRealLife/elementRealLifeProfiles.json')
  const lifeByZ = new Map(life.map((l) => [l.z, l]))
  const has = (v: unknown) => v !== '' && v != null
  return raw.map((e) => {
    const z = e.atomicNumber
    const ru = ELEMENT_NAMES_RU[z - 1]
    const en = ELEMENT_NAMES_EN[z - 1] ?? e.name
    const uz = ELEMENT_NAMES_UZ[z - 1]
    const l = lifeByZ.get(z)
    const lines = clean([
      `${ru} (${e.symbol}) — химический элемент № ${z}. English: ${en}. O'zbekcha: ${uz}.`,
      `Относительная атомная масса ${e.atomicMass}. Электронная конфигурация ${e.electronConfiguration}.`,
      clean([
        e.groupBlock ? `Тип: ${BLOCK_RU[e.groupBlock] ?? e.groupBlock}.` : '',
        e.standardState ? `При обычных условиях — ${STATE_RU[e.standardState] ?? e.standardState}.` : '',
        has(e.electronegativity) ? `Электроотрицательность ${e.electronegativity}.` : '',
        e.oxidationStates ? `Степени окисления: ${e.oxidationStates}.` : '',
      ]).join(' '),
      clean([
        has(e.meltingPoint) ? `Температура плавления ${e.meltingPoint} K.` : '',
        has(e.boilingPoint) ? `Температура кипения ${e.boilingPoint} K.` : '',
        e.yearDiscovered ? `Год открытия: ${e.yearDiscovered === 'Ancient' ? 'известен с древности' : e.yearDiscovered}.` : '',
      ]).join(' '),
      l?.captionRu,
      l?.appearanceRu,
      l?.usesRu?.length ? `Применение: ${l.usesRu.join('; ')}.` : '',
      l?.extractionRu ? `Получение: ${l.extractionRu}` : '',
    ])
    return {
      id: `card-element-${z}`,
      grade: null,
      title: `${ru} (${e.symbol})`,
      type: 'card' as const,
      lang: 'ru' as const,
      text: lines.join('\n'),
      source: 'ATOMLAB: элементы',
      keywords: clean([ru, en, uz, e.symbol, `элемент ${ru}`]),
    }
  })
}

/** Sentences of a card text ("(с. 53); 9 класс" and "Д. И. Менделеев" do not split). */
function cardSentences(text: string): string[] {
  // never inside «…» (section titles: «Химическая формула. Валентность»)
  const out: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (ch === '«') depth += 1
    else if (ch === '»') depth = Math.max(0, depth - 1)
    else if (depth === 0 && /[.!?]/.test(ch) && /\s/.test(text[i + 1] ?? '') && /[А-ЯЁA-Z«]/u.test(text.slice(i + 1).trimStart()[0] ?? '')) {
      out.push(text.slice(start, i + 1))
      start = i + 1
    }
  }
  out.push(text.slice(start))
  return out.map((s) => s.trim()).filter(Boolean)
}

/**
 * r10: the catalog now fills textbook substances from category templates ("Применение: Промышленность, лаборатория,
 * учебные демонстрации.", "Соль — сложное вещество, состоящее из …" in every salt card). A text shared by more than
 * TEMPLATE_MAX compounds (after replacing the compound's own name and formula) carries no information about the
 * substance: it is left out of the card, like the synthesis-condition templates.
 */
const TEMPLATE_MAX = 5
function templateKey(text: string, name: string, formula: string): string {
  let t = text.toLowerCase().replace(/ё/g, 'е')
  if (formula) t = t.split(formula.toLowerCase()).join('<f>')
  if (name) t = t.split(name.toLowerCase().replace(/ё/g, 'е')).join('<n>')
  return t.replace(/\s+/g, ' ').trim()
}

/**
 * r10: a generated obtaining step that "synthesises" a compound of three or more elements directly from simple
 * substances ("Cd + 2O₂ + S → CdSO₄", "4Cu + 2C + 2H₂ + 5O₂ → 2(CuOH)₂CO₃") is chemically false, and an unbalanced
 * step is wrong as written — neither goes into the knowledge base.
 */
async function falseObtainingStep(): Promise<(equation: string) => boolean> {
  const { parseEquationText, isParsedEquationBalanced } = await import('../../../src/chemistry/equationFormula.ts')
  return (equation: string) => {
    const eq = parseEquationText(equation)
    if (!eq) return false
    if (!isParsedEquationBalanced(eq)) return true
    const simple = eq.reactants.every((r) => Object.keys(r.counts ?? {}).length === 1)
    const complexProduct = eq.products.some((p) => Object.keys(p.counts ?? {}).length >= 3)
    return simple && complexProduct
  }
}

async function compoundCards(): Promise<CorpusChunk[]> {
  const { compoundById } = await import('../../../src/data/compounds.ts')
  const { resolveCompoundName } = await import('../../../src/i18n/compoundNameResolver.ts')
  const out: CorpusChunk[] = []
  // synthesis conditions: many compounds share a category template — only curated (rare) texts carry information
  const condKey = (c: (typeof compoundById)[string]) => JSON.stringify(c.synthesisConditionsRu ?? {})
  const condFreq = new Map<string, number>()
  for (const c of Object.values(compoundById)) condFreq.set(condKey(c), (condFreq.get(condKey(c)) ?? 0) + 1)
  // description sentences / facts / obtaining notes shared by many compounds are templates
  const textFreq = new Map<string, number>()
  const bump = (key: string) => textFreq.set(key, (textFreq.get(key) ?? 0) + 1)
  const factTexts = (c: (typeof compoundById)[string]) => {
    const facts = c.factsRu as { source?: string; usage?: string; importance?: string } | undefined
    return [facts?.source, facts?.usage, facts?.importance].filter((x): x is string => !!x)
  }
  for (const c of Object.values(compoundById)) {
    const keys = new Set([
      ...cardSentences(c.descriptionRu ?? '').map((s) => templateKey(s, c.nameRu, c.formulaUnicode)),
      ...factTexts(c).map((s) => templateKey(s, c.nameRu, c.formulaUnicode)),
      ...(c.obtainingStepsRu ?? []).map((s: { note?: string }) => `note:${templateKey(s.note ?? '', c.nameRu, c.formulaUnicode)}`),
    ])
    keys.forEach(bump)
  }
  const isTemplate = (text: string | undefined, c: (typeof compoundById)[string]) =>
    !!text && (textFreq.get(templateKey(text, c.nameRu, c.formulaUnicode)) ?? 0) > TEMPLATE_MAX
  const falseStep = await falseObtainingStep()
  for (const c of Object.values(compoundById)) {
    const en = resolveCompoundName(c.id, 'en') ?? ''
    const uz = resolveCompoundName(c.id, 'uz') ?? ''
    const rawFacts = c.factsRu as { source?: string; usage?: string; importance?: string } | undefined
    const facts = {
      source: isTemplate(rawFacts?.source, c) ? undefined : rawFacts?.source,
      usage: isTemplate(rawFacts?.usage, c) ? undefined : rawFacts?.usage,
      importance: isTemplate(rawFacts?.importance, c) ? undefined : rawFacts?.importance,
    }
    const steps: readonly { equation?: string; note?: string }[] = (c.obtainingStepsRu ?? [])
      .filter((s: { equation?: string }) => !s.equation || !falseStep(s.equation))
      .map((s: { equation?: string; note?: string }) =>
        s.note && (textFreq.get(`note:${templateKey(s.note, c.nameRu, c.formulaUnicode)}`) ?? 0) > TEMPLATE_MAX ? { ...s, note: undefined } : s,
      )
    // the leading "Name (formula)." of the generated descriptions repeats the card header
    const description = cardSentences(c.descriptionRu ?? '')
      .filter((s) => !isTemplate(s, c) && templateKey(s, c.nameRu, c.formulaUnicode).replace(/[\s.()<>nf]/g, '') !== '')
      .join(' ')
    const cond = c.synthesisConditionsRu
    const condText =
      cond && (condFreq.get(condKey(c)) ?? 0) <= 5
        ? clean([
            cond.temperature && `температура: ${cond.temperature.replace(/^Температура:\s*/i, '')}`,
            cond.pressure && `давление: ${cond.pressure.replace(/^Давление:\s*/i, '')}`,
            cond.catalyst && `катализатор: ${cond.catalyst.replace(/^Катализатор:\s*/i, '')}`,
            cond.equipment && `оборудование: ${cond.equipment.replace(/^Оборудование:\s*/i, '')}`,
          ]).join('; ')
        : ''
    const lines = clean([
      // unknown categories ("other") are not printed as an English word
      `${c.nameRu} (${c.formulaUnicode})${CATEGORY_RU[c.category] ? ` — ${CATEGORY_RU[c.category]}` : ''}.${en ? ` English: ${en}.` : ''}${uz ? ` O'zbekcha: ${uz}.` : ''}`,
      description,
      facts?.source ? `Где встречается / источник: ${facts.source}` : '',
      facts?.usage ? `Применение: ${facts.usage}` : '',
      facts?.importance ? `Значение: ${facts.importance}` : '',
      steps.length
        ? `Получение: ${steps.map((s) => clean([s.equation, s.note ? `(${s.note})` : '']).join(' ')).join('; ')}`
        : '',
      condText ? `Условия получения: ${condText}` : '',
    ])
    out.push({
      id: `card-compound-${c.id}`,
      grade: null,
      title: `${c.nameRu} (${c.formulaUnicode})`,
      type: 'card',
      lang: 'ru',
      text: lines.join('\n'),
      source: 'ATOMLAB: вещества',
      keywords: clean([c.nameRu, c.formulaUnicode, en, uz]),
    })
  }
  return out
}

async function reactionCards(): Promise<CorpusChunk[]> {
  const { SCHOOL_REACTION_BANK, passportForReaction } = await import('../../../src/chemistry/schoolReactionBank.ts')
  const { describePassportRu } = await import('../../../src/chemistry/reactionPassport.ts')
  const passportText = (r: (typeof SCHOOL_REACTION_BANK)[number]) => {
    try {
      return `Паспорт реакции: ${describePassportRu(passportForReaction(r))}.`
    } catch {
      return ''
    }
  }
  return SCHOOL_REACTION_BANK.map((r) => {
    const passport = passportText(r)
    return {
      id: `card-reaction-${r.id}`,
      grade: null,
      title: r.titleRu,
      type: 'card' as const,
      lang: 'ru' as const,
      text: clean([`${r.titleRu}: ${r.equationRu}`, `English: ${r.titleEn}.`, r.howToRu, passport, `Классы: ${r.grades.join(', ')}.`]).join('\n'),
      source: 'ATOMLAB: реакции',
      keywords: clean([r.titleRu, r.titleEn, r.equationRu]),
    }
  })
}

async function equationCards(): Promise<CorpusChunk[]> {
  const { G10_G11_EDU_EQUATIONS } = await import('../../../src/data/researchLab/g10g11Equations.ts')
  const byTopic = new Map<string, (typeof G10_G11_EDU_EQUATIONS)[number][]>()
  for (const e of G10_G11_EDU_EQUATIONS) {
    const key = `${e.grade}|${e.topicRu}`
    byTopic.set(key, [...(byTopic.get(key) ?? []), e])
  }
  const out: CorpusChunk[] = []
  for (const list of byTopic.values()) {
    const first = list[0]
    const gradeN = first.grade === 'g10' ? 10 : 11
    const en = first.topicEn !== first.topicRu ? first.topicEn : ''
    const uz = first.topicUz !== first.topicRu ? first.topicUz : ''
    out.push({
      id: `card-eq-${first.id}`,
      grade: null,
      title: `${first.topicRu} — уравнения (${gradeN} класс)`,
      type: 'card',
      lang: 'ru',
      text: clean([
        `${first.topicRu} (${gradeN} класс, Kimyo ${gradeN}).${en ? ` English: ${en}.` : ''}${uz ? ` O'zbekcha: ${uz}.` : ''}`,
        ...list.map((e) => `${e.displayRu} — ${e.hintRu}`),
      ]).join('\n'),
      source: 'ATOMLAB: уравнения 10–11',
      keywords: clean([first.topicRu, en, uz, ...list.map((e) => e.displayRu)]),
    })
  }
  return out
}

async function organicCards(): Promise<CorpusChunk[]> {
  const { ORGANIC_MOLECULES, organicMoleculeById } = await import('../../../src/data/organicLab/organicMoleculeRegistry.ts')
  const { ORGANIC_BUILD_CHALLENGES, ORGANIC_CLASS_LABELS } = await import('../../../src/data/researchLab/organicBuildCatalog.ts')
  const { ORGANIC_CURRICULUM, ORGANIC_CHAPTER_LABELS } = await import('../../../src/data/organicLab/organicCurriculum.ts')
  const { G10_G11_EDU_EQUATIONS } = await import('../../../src/data/researchLab/g10g11Equations.ts')
  const challengeById = new Map(ORGANIC_BUILD_CHALLENGES.map((c) => [c.id, c]))
  const eqById = new Map(G10_G11_EDU_EQUATIONS.map((e) => [e.id, e]))
  const out: CorpusChunk[] = []
  for (const m of ORGANIC_MOLECULES) {
    const cls = ORGANIC_CLASS_LABELS[m.classId]
    const ch = challengeById.get(m.challengeId ?? m.id)
    const groups = [...new Set(m.functionalGroups.map((g) => g.labelRu || g.label))]
    const ir = ch?.irPeaks?.length ? `ИК-спектр: ${ch.irPeaks.map((p) => `${p.wavenumber} см⁻¹ (${p.label})`).join('; ')}.` : ''
    out.push({
      id: `card-organic-${m.id}`,
      grade: null,
      title: `${m.nameRu} (${m.formula})`,
      type: 'card',
      lang: 'ru',
      text: clean([
        `${m.nameRu} (${m.formula}) — ${cls?.ru.toLowerCase() ?? m.classId}, ${m.grade === 'g10' ? 10 : 11} класс. English: ${m.nameEn}. O'zbekcha: ${m.nameUz}.`,
        m.descriptionRu,
        groups.length ? `Функциональные группы / связи: ${groups.join(', ')}.` : '',
        m.equationRu ? `Уравнение: ${m.equationRu}` : '',
        ir,
      ]).join('\n'),
      source: 'ATOMLAB: органическая лаборатория',
      keywords: clean([m.nameRu, m.nameEn, m.nameUz, m.formula, cls?.ru]),
    })
  }
  for (const l of ORGANIC_CURRICULUM) {
    const mols = [...new Set([l.defaultMolId, ...l.challengeIds])]
      .map((id) => organicMoleculeById[id])
      .filter(Boolean)
      .map((m) => `${m.nameRu} (${m.formula})`)
    const eqs = l.equationIds.map((id) => eqById.get(id)).filter(Boolean).map((e) => `${e!.displayRu} — ${e!.hintRu}`)
    out.push({
      id: `card-organic-lesson-${l.id}`,
      grade: null,
      title: `${l.titleRu} (органическая химия, 10 класс)`,
      type: 'card',
      lang: 'ru',
      text: clean([
        `${l.titleRu}. ${ORGANIC_CHAPTER_LABELS[l.chapter].ru} (Kimyo 10). English: ${l.titleEn}. O'zbekcha: ${l.titleUz}.`,
        `Цель: ${l.goalRu}`,
        mols.length ? `Вещества: ${mols.join(', ')}.` : '',
        eqs.length ? `Уравнения:\n${eqs.join('\n')}` : '',
      ]).join('\n'),
      source: 'ATOMLAB: органическая лаборатория',
      keywords: clean([l.titleRu, l.titleEn, l.titleUz]),
    })
  }
  return out
}

async function solubilityCards(): Promise<CorpusChunk[]> {
  const { SOLUBILITY_ANIONS, SOLUBILITY_CATIONS, solubilityMark } = await import('../../../src/data/solubilityTableData.ts')
  const MARK: Record<string, string> = { R: 'растворимы', M: 'малорастворимы', N: 'нерастворимы', X: 'разлагаются водой (не существуют в растворе)' }
  const out: CorpusChunk[] = [
    {
      id: 'card-solubility-legend',
      grade: null,
      title: 'Таблица растворимости: как читать',
      type: 'card',
      lang: 'ru',
      text:
        'Таблица растворимости кислот, оснований и солей в воде. Р — растворимо, М — малорастворимо, Н — нерастворимо, ' +
        '«—» — разлагается водой или не существует. Соли натрия, калия, аммония и все нитраты и ацетаты растворимы. ' +
        'Нерастворимые вещества выпадают в осадок в реакциях ионного обмена: по таблице проверяют, идёт ли реакция до конца.',
      source: 'ATOMLAB: таблица растворимости',
      keywords: ['таблица растворимости', 'растворимость', 'осадок', 'solubility table', "eruvchanlik jadvali"],
    },
  ]
  const group = (pairs: { label: string; mark: string }[]) =>
    Object.entries(MARK)
      .map(([k, word]) => {
        const xs = pairs.filter((p) => p.mark === k).map((p) => p.label)
        return xs.length ? `${word}: ${xs.join(', ')}` : ''
      })
      .filter(Boolean)
      .join('; ')
  for (const a of SOLUBILITY_ANIONS) {
    const pairs = SOLUBILITY_CATIONS.map((c) => ({ label: c.label, mark: solubilityMark(c.id, a.id) }))
    out.push({
      id: `card-solubility-anion-${a.id}`,
      grade: null,
      title: `Растворимость соединений с анионом ${a.label}`,
      type: 'card',
      lang: 'ru',
      text: `Соединения с анионом ${a.label} (по таблице растворимости): ${group(pairs)}.`,
      source: 'ATOMLAB: таблица растворимости',
      keywords: [a.label, 'растворимость', 'осадок'],
    })
  }
  for (const c of SOLUBILITY_CATIONS) {
    const pairs = SOLUBILITY_ANIONS.map((a) => ({ label: a.label, mark: solubilityMark(c.id, a.id) }))
    out.push({
      id: `card-solubility-cation-${c.id}`,
      grade: null,
      title: `Растворимость соединений катиона ${c.label}`,
      type: 'card',
      lang: 'ru',
      text: `Соединения катиона ${c.label} с анионами (по таблице растворимости): ${group(pairs)}.`,
      source: 'ATOMLAB: таблица растворимости',
      keywords: [c.label, 'растворимость', 'осадок'],
    })
  }
  return out
}

type PackChunk = { id: string; topic: string; keywords: string[]; ru: string; grades?: number[] }

export const PACK_SOURCES: [string, string, string][] = [
  ['../../../src/learn/learnChemistryKnowledgeBase.ts', 'CHEMISTRY_KNOWLEDGE_CHUNKS', 'база знаний'],
  ['../../../src/learn/knowledge/learnFoundationsLawsKnowledge.ts', 'FOUNDATIONS_LAWS_KNOWLEDGE', 'законы и основы'],
  ['../../../src/learn/knowledge/learnChemistryFormulasKnowledge.ts', 'CHEMISTRY_FORMULAS_KNOWLEDGE', 'формулы'],
  ['../../../src/learn/knowledge/learnReactionsKnowledge.ts', 'REACTIONS_KNOWLEDGE', 'реакции'],
  ['../../../src/learn/knowledge/learnOrganicDeepKnowledge.ts', 'ORGANIC_DEEP_KNOWLEDGE', 'органика'],
  ['../../../src/learn/knowledge/learnProblemBankKnowledge.ts', 'PROBLEM_BANK_KNOWLEDGE', 'задачи'],
  ['../../../src/learn/knowledge/learnSchoolTheoryDeepKnowledge.ts', 'SCHOOL_THEORY_DEEP_KNOWLEDGE', 'теория'],
  ['../../../src/learn/knowledge/learnKineticsEquilibriumKnowledge.ts', 'KINETICS_EQUILIBRIUM_KNOWLEDGE', 'кинетика и равновесие'],
  ['../../../src/learn/knowledge/learnLabPracticeKnowledge.ts', 'LAB_PRACTICE_KNOWLEDGE', 'лабораторная практика'],
  ['../../../src/learn/knowledge/learnThermoElectroKnowledge.ts', 'THERMO_ELECTRO_KNOWLEDGE', 'термохимия и электрохимия'],
  ['../../../src/learn/knowledge/learnInorganicCoreKnowledge.ts', 'INORGANIC_CORE_KNOWLEDGE', 'неорганика'],
  ['../../../src/learn/knowledge/learnScientistsKnowledge.ts', 'SCIENTISTS_KNOWLEDGE', 'учёные'],
  ['../../../src/learn/knowledge/learnTeacherReasoningKnowledge.ts', 'TEACHER_REASONING_KNOWLEDGE', 'алгоритмы решения'],
]

/** Teaching-strategy / answer-style notes (prompt material, not chemistry knowledge). */
const PROMPT_ONLY_PACK_IDS = new Set([
  'reason-how-to-think',
  'reason-compare-template',
  'reason-definition-template',
  'reason-speak-literacy',
  'reason-homework-check',
  'reason-retrieve-first',
  'reason-grade-ladder',
  'reason-why-chain',
  'reason-live-speech',
  'reason-confusion-repair',
])

async function packCards(): Promise<CorpusChunk[]> {
  const out: CorpusChunk[] = []
  const { LEARN_CHEMISTRY_FAQ } = await import('../../../src/learn/learnChemistryFaq.ts')
  LEARN_CHEMISTRY_FAQ.forEach((f, i) => {
    const text = stripMd(f.ru)
    const title = /\*\*([^*]+)\*\*/.exec(f.ru)?.[1] ?? text.slice(0, 60)
    out.push({
      id: `faq-${String(i + 1).padStart(3, '0')}`,
      grade: null,
      title: stripMd(title),
      type: 'faq',
      lang: 'ru',
      text,
      source: 'ATOMLAB: частые вопросы',
      keywords: f.keywords,
    })
  })
  const seen = new Set(out.map((c) => c.id))
  const uniqueId = (id: string) => {
    let u = id
    for (let n = 2; seen.has(u); n += 1) u = `${id}-${n}`
    seen.add(u)
    return u
  }
  const { MISCONCEPTIONS_KNOWLEDGE } = await import('../../../src/learn/knowledge/learnMisconceptionsKnowledge.ts')
  for (const m of MISCONCEPTIONS_KNOWLEDGE as PackChunk[]) {
    out.push({
      id: uniqueId(m.id.startsWith('misc-') ? m.id : `misc-${m.id}`),
      grade: null,
      title: m.topic,
      type: 'misconception',
      lang: 'ru',
      text: stripMd(m.ru),
      source: 'ATOMLAB: типичные ошибки',
      keywords: m.keywords,
    })
  }
  for (const [mod, name, label] of PACK_SOURCES) {
    const m = (await import(mod)) as Record<string, PackChunk[]>
    for (const c of m[name] ?? []) {
      if (!c.ru?.trim()) continue
      // teaching-strategy notes (hint ladders, exam plans) are prompt material, not chemistry knowledge
      if (/^(brain2-|prob-thinking|found-teacher)/.test(c.id) || PROMPT_ONLY_PACK_IDS.has(c.id)) continue
      out.push({
        id: uniqueId(c.id),
        grade: null,
        title: stripMd(c.topic),
        type: name === 'SCIENTISTS_KNOWLEDGE' ? 'card' : 'summary',
        lang: 'ru',
        text: stripMd(c.ru),
        source: `ATOMLAB: ${label}`,
        keywords: c.keywords,
      })
    }
  }
  return out
}

export async function buildCards(): Promise<CorpusChunk[]> {
  return [
    ...(await elementCards()),
    ...(await compoundCards()),
    ...(await reactionCards()),
    ...(await equationCards()),
    ...(await organicCards()),
    ...(await solubilityCards()),
    ...(await packCards()),
  ]
}

// ---------------------------------------------------------------- quiz items

type BankQ = { id: string; question: string; choices: string[]; correctIndex: number; explanation?: string }
type I18nQ = {
  questionEn?: string
  questionUz?: string
  choicesEn?: string[]
  choicesUz?: string[]
  explanationEn?: string
  explanationUz?: string
}

const JUNK_ANSWER = /учебник Kimyo|неверная формулировка|такой информации нет|другое явление или вещество/i
/** quiz items generated from the old garbled extraction: "grx 27 , 375 10045 , 2 =⋅= г" */
const BROKEN_TEXT = /=⋅=|[a-z]{2,}x \d|\d , \d{3} \d|[À-ÿ]{2}/

/** Formulas that app data knows (used by the text repair of the textbook corpus). */
export async function appFormulas(): Promise<string[]> {
  const out: string[] = []
  const { compoundById } = await import('../../../src/data/compounds.ts')
  for (const c of Object.values(compoundById)) out.push(c.formulaUnicode)
  const { ORGANIC_MOLECULES } = await import('../../../src/data/organicLab/organicMoleculeRegistry.ts')
  for (const m of ORGANIC_MOLECULES) out.push(m.formula)
  const { G10_G11_EDU_EQUATIONS } = await import('../../../src/data/researchLab/g10g11Equations.ts')
  for (const e of G10_G11_EDU_EQUATIONS) out.push(...e.left, ...e.right)
  const { SOLUBILITY_ANIONS, SOLUBILITY_CATIONS } = await import('../../../src/data/solubilityTableData.ts')
  for (const x of [...SOLUBILITY_ANIONS, ...SOLUBILITY_CATIONS]) out.push(x.label)
  const { SCHOOL_REACTION_BANK } = await import('../../../src/chemistry/schoolReactionBank.ts')
  for (const r of SCHOOL_REACTION_BANK) out.push(...r.equationRu.split(/\s*(?:\+|→|=|⇄|↑|↓)\s*/))
  return out
}

/**
 * Quiz questions as small retrieval chunks, one per language: "Вопрос / Ответ / Пояснение".
 * sectionTitles: "g8-c1-s04" → app section title (for chunk titles).
 */
export async function buildQuizChunks(sectionTitles: Map<string, string>): Promise<CorpusChunk[]> {
  const out: CorpusChunk[] = []
  const i18n = readJson<Record<string, I18nQ>>('src/data/sectionQuizI18n.json')
  const L = {
    ru: { q: 'Вопрос', a: 'Ответ', e: 'Пояснение', topic: 'Тест по теме' },
    en: { q: 'Question', a: 'Answer', e: 'Explanation', topic: 'Quiz' },
    uz: { q: 'Savol', a: 'Javob', e: 'Izoh', topic: 'Test' },
  } as const
  for (const g of [7, 8, 9]) {
    const bank = readJson<{ sections: Record<string, BankQ[]> }>(`src/data/g${g}SectionQuizBank.json`)
    for (const [key, qs] of Object.entries(bank.sections)) {
      const m = /^g(\d+)-(c\d+)-(s\d+)$/.exec(key)
      const secTitle = sectionTitles.get(key) ?? key
      for (const q of qs) {
        const answer = q.choices?.[q.correctIndex]
        if (!answer || JUNK_ANSWER.test(answer) || JUNK_ANSWER.test(q.explanation ?? '')) continue
        if (BROKEN_TEXT.test(`${q.question} ${answer} ${q.explanation ?? ''}`)) continue
        const t = i18n[q.id] ?? {}
        const langs: [keyof typeof L, string | undefined, string | undefined, string | undefined][] = [
          ['ru', q.question, answer, q.explanation],
          ['en', t.questionEn, t.choicesEn?.[q.correctIndex], t.explanationEn],
          ['uz', t.questionUz, t.choicesUz?.[q.correctIndex], t.explanationUz],
        ]
        for (const [lang, qq, aa, ee] of langs) {
          if (!qq || !aa) continue
          const w = L[lang]
          out.push({
            id: `quiz-${q.id}-${lang}`,
            grade: g,
            chapterId: m?.[2],
            sectionId: m?.[3],
            title: `${w.topic}: ${secTitle}`,
            type: 'quiz',
            lang,
            text: clean([`${w.q}: ${qq}`, `${w.a}: ${aa}`, ee && ee !== aa ? `${w.e}: ${ee}` : '']).join('\n'),
            source: `ATOMLAB: тесты ${g} класс`,
          })
        }
      }
    }
  }
  const { NOMENCLATURE_QUIZZES } = await import('../../../src/data/organicLab/organicNomenclatureQuizzes.ts')
  for (const quiz of NOMENCLATURE_QUIZZES) {
    for (const q of quiz.questions) {
      const right = q.options.find((o) => o.correct)
      if (!right) continue
      const langs: [keyof typeof L, string, string, string][] = [
        ['ru', quiz.titleRu, q.promptRu, right.labelRu],
        ['en', quiz.titleEn, q.promptEn, right.labelEn],
        ['uz', quiz.titleUz, q.promptUz, right.labelUz],
      ]
      for (const [lang, title, prompt, ans] of langs) {
        if (lang !== 'ru' && prompt === q.promptRu && ans === right.labelRu) continue // untranslated copy
        const w = L[lang]
        out.push({
          id: `quiz-nomenclature-${quiz.id}-${q.id}-${lang}`,
          grade: 10,
          title: `${w.topic}: ${title}`,
          type: 'quiz',
          lang,
          text: clean([`${w.q}: ${prompt}${q.formula ? ` (${q.formula})` : ''}`, `${w.a}: ${ans}`]).join('\n'),
          source: 'ATOMLAB: номенклатура (10 класс)',
        })
      }
    }
  }
  return out
}
