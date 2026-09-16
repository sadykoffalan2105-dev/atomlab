/**
 * HOLDOUT r7 (fresh generalization check for the local AI teacher, judge round 7).
 *
 * 20 NEW questions that are in none of goldQuestions.mts, holdout-r3/r4/r5/r6.mts, selfcheck-r6/r7.mts:
 * grades 7–11, all question types (definition, why, how, compare, example, composition, calc incl. the molar
 * mass of a single-element substance), 3 English + 3 Uzbek, 2 follow-up pairs. Every expected fact was grepped
 * in src/data/kb/corpus (chunk / card ids in `source`).
 * The composer was NOT tuned on these questions — do not add rules for them; write a new holdout set instead.
 *
 * Same code paths as runAnswers.mts (chat = composeLocalTeacherReply, voice = TrainingModeEngine.answer with
 * smartAi=false, ctx lesson); output .smoke/answer-quality/answers-<tag>.json in the same format:
 *
 *   npx tsx scripts/teacher-quality/holdout-r7.mts [--tag h7] [--modes chat,voice]
 *   npx tsx scripts/teacher-quality/autoScore.mts --tag h7 --questions holdout-r7.mts#HOLDOUT_R7
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { GoldQuestion } from './goldQuestions.mts'
import { preloadKnowledge, getKnowledgeStatus } from '../../src/learn/kb/index.ts'
import { composeLocalTeacherReply } from '../../src/learn/learnTeacherRouter.ts'
import { retrieveForTeacher, type TeacherKnowledgeHit } from '../../src/learn/teacherKnowledge.ts'
import { isSubstantiveQuestion, resolveTurn } from '../../src/learn/brain/dualMode/followUps.ts'
import { TrainingModeEngine } from '../../src/learn/brain/dualMode/trainingModeEngine.ts'
import type { LearnLocalAssistantContext } from '../../src/learn/learnLocalAssistant.ts'

export const HOLDOUT_R7: GoldQuestion[] = [
  /* ---------------------------------------------------------------- ru singles */
  {
    id: 'h7-01', grade: 7, locale: 'ru', type: 'definition', lesson: 'c1-s05', source: 'cards pure-mixture, theory-mixtures-pure, solutions («Гомогенная смесь однородна (соль в воде, воздух)»)',
    question: 'Что такое гомогенная смесь?',
    mustMention: ['однородн|гомогенн', 'смес|раствор'],
  },
  {
    id: 'h7-02', grade: 7, locale: 'ru', type: 'why', lesson: 'c4-s09', source: 'Kimyo 7 §4.4 (g7-c4-s04-t01: озоновый слой защищает от ультрафиолетового излучения), §4.9 (g7-c4-s09-t02)',
    question: 'Почему озоновый слой так важен для жизни на Земле?',
    mustMention: ['ультрафиолет'],
  },
  {
    id: 'h7-03', grade: 9, locale: 'ru', type: 'why', lesson: 'c7-s04', source: 'Kimyo 9 §8 (g9-p08-t05: каждый атом углерода образует ковалентную связь с четырьмя соседними атомами, тетраэдр)',
    question: 'Почему алмаз такой твёрдый?',
    mustMention: ['ковалентн|четырьмя|тетраэдр'],
  },
  {
    id: 'h7-04', grade: 8, locale: 'ru', type: 'example', lesson: 'c5-s01', source: 'cards rx-types («Разложения — из одного несколько: 2H₂O₂ → 2H₂O + O₂↑»), g8-reaction-types, card-reaction-caco3-decomp',
    question: 'Приведи пример реакции разложения',
    mustMention: ['H2O2|H₂O₂|CaCO3|CaCO₃|Cu(OH)2|Cu(OH)₂|2H2O|2H₂O'],
  },
  {
    id: 'h7-05', grade: 7, locale: 'ru', type: 'calc', lesson: 'c2-s09', source: 'Ar(Cu) = 64 (таблица Ar) → M(Cu) = 64 г/моль; cards faq-005, deep-mole-calculations',
    question: 'Чему равна молярная масса меди?',
    mustMention: ['64', 'г/моль|g/mol'],
  },
  {
    id: 'h7-06', grade: 8, locale: 'ru', type: 'calc', lesson: 'c5-s04', source: 'Ar(Al) = 27 → m = n·M = 2 · 27 = 54 г; cards deep-mole-calculations, brain-mole-map',
    question: 'Какова масса 2 моль алюминия?',
    mustMention: ['54', '27'],
  },
  {
    id: 'h7-07', grade: 9, locale: 'ru', type: 'how', lesson: 'c4-s08', source: 'cards qualitative-analysis («CO₃²⁻ (пузырьки CO₂ с кислотой)»), card-reaction-na2co3-hcl («Выделение CO₂ — признак карбонат-ионов»)',
    question: 'Как распознать карбонат-ион в растворе?',
    mustMention: ['кислот', 'CO2|CO₂|газ|пузыр'],
  },
  {
    id: 'h7-08', grade: 10, locale: 'ru', type: 'why', lesson: 'c2-s16', source: 'card org-deep-aromatic («делокализованная π-система … бензол не обесцвечивает бромную воду … характерны реакции замещения»)',
    question: 'Почему бензол не обесцвечивает бромную воду?',
    mustMention: ['замещен|делокализ|π|ароматич'],
  },
  {
    id: 'h7-09', grade: 11, locale: 'ru', type: 'compare', lesson: 'c8-s01', source: 'cards deep-electrolysis («Катод (−) — восстановление … Анод (+) — окисление …»), brain-electrolysis',
    question: 'Чем катод отличается от анода?',
    mustMention: ['восстанов', 'окисл'],
  },
  {
    id: 'h7-10', grade: 9, locale: 'ru', type: 'how', lesson: 'c7-s04', source: 'Kimyo 9 §10 (g9-p10-t03: «В лаборатории … воздействием на карбонат кальция (мел, известняк, мрамор) соляной кислотой: CaCO3 + 2HCl → CaCl2 + CO2 + H2O»)',
    question: 'Как получают углекислый газ в лаборатории?',
    mustMention: ['CaCO3|CaCO₃|карбонат кальция|мрамор|известняк|мел', 'HCl|соляной'],
  },
  /* ------------------------------------------------------------ follow-up pairs */
  {
    id: 'h7-11', grade: 7, locale: 'ru', type: 'definition', lesson: 'c4-s01', source: 'Kimyo 7 §4.1 (g7-c4-s01-t02/t03: воздух — смесь газов); card theory-air-water',
    question: 'Что такое воздух?',
    mustMention: ['смес', 'газ'],
  },
  {
    id: 'h7-12', grade: 7, locale: 'ru', type: 'definition', lesson: 'c4-s01', followUpOf: 'h7-11', source: 'Kimyo 7 §4.1 (g7-c4-s01-t02: 78,1 % азота и 20,93 % кислорода); cards theory-air-water, inorg-nitrogen-oxygen (~78 % N₂, ~21 % O₂)',
    question: 'А из чего он состоит?',
    mustMention: ['азот|N2|N₂|78', 'кислород|O2|O₂|21'],
  },
  {
    id: 'h7-13', grade: 8, locale: 'ru', type: 'definition', lesson: 'c1-s05', source: 'Kimyo 8 §2 (g8-p02-d02/t07: «Сложные вещества, молекула которых состоит из атомов металла и кислотного остатка, называются солями»); card faq-003',
    question: 'Что такое соли?',
    mustMention: ['металл', 'кислотн'],
  },
  {
    id: 'h7-14', grade: 8, locale: 'ru', type: 'example', lesson: 'c1-s05', followUpOf: 'h7-13', source: 'Kimyo 8 §2 (g8-p02-t07: NaCl, KCl, CaCl2, Ba(NO3)2, Al2(SO4)3, FeSO4); card faq-003 (NaCl, CuSO₄)',
    question: 'Приведи пример',
    mustMention: ['NaCl|KCl|CaCl2|CaCl₂|CuSO4|CuSO₄|FeSO4|FeSO₄|Na2CO3|Na₂CO₃'],
  },
  /* --------------------------------------------------------------------- en */
  {
    id: 'h7-15', grade: 7, locale: 'en', type: 'compare', lesson: 'c1-s05', source: 'cards pure-mixture, theory-mixtures-pure («Гомогенная смесь однородна (соль в воде, воздух). Гетерогенная — видны частицы (песок в воде, молоко)»)',
    question: 'What is the difference between a homogeneous and a heterogeneous mixture?',
    mustMention: ['uniform|homogeneous|same|dissolved|one phase', 'particles|visible|heterogeneous|sand'],
  },
  {
    id: 'h7-16', grade: 9, locale: 'en', type: 'calc', lesson: 'c4-s01', source: 'Ar(Cu) = 64 → m = n·M = 2 · 64 = 128 g; cards deep-mole-calculations, brain-mole-map',
    question: 'What is the mass of 2 moles of copper?',
    mustMention: ['128', '64'],
  },
  {
    id: 'h7-17', grade: 11, locale: 'en', type: 'definition', lesson: 'c4-s01', source: 'card solutions («Раствор — гомогенная смесь растворителя и растворённого вещества»); Kimyo 11 §4.1',
    question: 'What is a solution?',
    mustMention: ['mixture|homogeneous', 'solvent|solute|dissolved'],
  },
  /* --------------------------------------------------------------------- uz */
  {
    id: 'h7-18', grade: 9, locale: 'uz', type: 'why', lesson: 'c7-s04', source: 'Kimyo 9 §8 (g9-p08-t05: алмаз — самое твёрдое вещество; каждый атом связан ковалентно с четырьмя соседями)',
    question: 'Nega olmos juda qattiq modda?',
    mustMention: ["kovalent|bog'|atom|uglerod|ковалентн"],
  },
  {
    id: 'h7-19', grade: 11, locale: 'uz', type: 'calc', lesson: 'c2-s01', source: 'M(H₂O) = 18 г/моль → m = n·M = 5 · 18 = 90 g; cards deep-mole-calculations, faq-005',
    question: "5 mol suvning massasi qancha?",
    mustMention: ['90', '18'],
  },
  {
    id: 'h7-20', grade: 8, locale: 'uz', type: 'example', lesson: 'c5-s01', source: 'cards rx-types («Разложения … 2H₂O₂ → 2H₂O + O₂↑»), g8-reaction-types (2H₂O → 2H₂ + O₂), card-reaction-caco3-decomp',
    question: 'Parchalanish reaksiyasiga misol keltiring',
    mustMention: ['H2O2|H₂O₂|CaCO3|CaCO₃|2H2O|2H₂O|O2|O₂'],
  },
]

/* ============================================================== runner (tag h7) */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT_DIR = path.join(ROOT, '.smoke', 'answer-quality')
type Mode = 'chat' | 'voice'

function sectionTitle(grade: number, lesson: string | undefined): string {
  if (!lesson) return ''
  const file = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/kb/corpus/kb-sections.json'), 'utf8')) as Record<
    string,
    Array<{ id: string; title: string }> | { appSections?: Array<{ id: string; title: string }> }
  >
  const g = file[`g${grade}`]
  const rows = Array.isArray(g) ? g : (g?.appSections ?? [])
  return rows.find((r) => r.id === lesson)?.title ?? ''
}

function contextFor(q: GoldQuestion) {
  const [chapterId = '', sectionId = ''] = q.lesson ? q.lesson.split('-') : []
  return { gradeId: `g${q.grade}`, chapterId, sectionId, sectionTitle: sectionTitle(q.grade, q.lesson) }
}

const saveHits = (hits: readonly TeacherKnowledgeHit[]) =>
  hits.slice(0, 6).map((h) => ({
    title: h.title,
    citation: h.citation,
    type: h.type,
    score: h.score === undefined ? undefined : Math.round(h.score * 100) / 100,
    text: h.text.slice(0, 900),
  }))

const stripCitations = (s: string) => s.replace(/\n\n(\[[^\]]+\]\s*)+$/u, '').trim()

async function runChat(q: GoldQuestion, parent: { question: string; answer: string } | null) {
  const c = contextFor(q)
  const ctx: LearnLocalAssistantContext = {
    locale: q.locale,
    gradeId: c.gradeId,
    chapterId: c.chapterId,
    sectionId: c.sectionId,
    sectionTitle: c.sectionTitle,
    slideTitle: c.sectionTitle,
    slideBody: '',
    mode: 'teacher',
    kpNumber: 1,
  }
  const messages = parent
    ? [
        { role: 'user', content: parent.question },
        { role: 'assistant', content: parent.answer },
        { role: 'user', content: q.question },
      ]
    : [{ role: 'user', content: q.question }]
  const t0 = performance.now()
  const res = await composeLocalTeacherReply(messages, ctx)
  const ms = Math.round(performance.now() - t0)
  const previous = messages.slice(0, -1).filter((m) => m.role === 'user' && isSubstantiveQuestion(m.content)).map((m) => m.content)
  const resolved = resolveTurn(q.question, previous, q.locale, ctx.sectionTitle)
  const k = await retrieveForTeacher(resolved.query, {
    locale: ctx.locale,
    gradeId: ctx.gradeId,
    chapterId: ctx.chapterId,
    sectionId: ctx.sectionId,
    sectionTitle: ctx.sectionTitle,
    limit: 8,
    maxChars: 6_000,
    timeoutMs: 2_500,
  })
  return {
    id: q.id, mode: 'chat' as Mode, question: q.question, parentQuestion: parent?.question, query: resolved.query,
    answer: res.text, text: stripCitations(res.text), citations: res.citations, confident: res.confident, ms, context: c,
    hits: saveHits(k.hits),
  }
}

async function runVoice(q: GoldQuestion, parent: { question: string; answer: string } | null) {
  const c = contextFor(q)
  const engine = new TrainingModeEngine({
    lang: q.locale,
    gradeId: c.gradeId,
    chapterId: c.chapterId,
    sectionId: c.sectionId || undefined,
    sectionTitle: c.sectionTitle || undefined,
  })
  ;(engine as unknown as { seed: number }).seed = 0
  const t0 = performance.now()
  const res = await engine.answer({
    text: q.question,
    history: parent ? [{ role: 'user', content: parent.question }, { role: 'assistant', content: parent.answer }] : [],
    previousQuestions: parent ? [parent.question] : [],
    smartAi: false,
  })
  const ms = Math.round(performance.now() - t0)
  const style = res.resolved.style
  const k = await retrieveForTeacher(res.resolved.query, {
    locale: q.locale,
    gradeId: c.gradeId,
    chapterId: c.chapterId,
    sectionId: c.sectionId || undefined,
    sectionTitle: c.sectionTitle || undefined,
    limit: style.detail === 'more' ? 8 : 6,
    maxChars: 3_600,
    timeoutMs: 1_500,
  })
  return {
    id: q.id, mode: 'voice' as Mode, question: q.question, parentQuestion: parent?.question, query: res.resolved.query,
    answer: res.display, text: res.text, citations: res.citations, confident: res.confident, ms, context: c,
    hits: saveHits(k.hits),
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const arg = (n: string, d: string) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] ?? d : d)
  const tag = arg('tag', 'h7')
  const modes = arg('modes', 'chat,voice').split(',').filter((m): m is Mode => m === 'chat' || m === 'voice')
  await preloadKnowledge()
  const status = getKnowledgeStatus()
  const byIdQ = new Map(HOLDOUT_R7.map((q) => [q.id, q]))
  const items: Awaited<ReturnType<typeof runChat>>[] = []
  for (const mode of modes) {
    const answered = new Map<string, { text: string }>()
    for (const q of HOLDOUT_R7) {
      const pq = q.followUpOf ? byIdQ.get(q.followUpOf) : undefined
      const parent = pq ? { question: pq.question, answer: answered.get(pq.id)?.text ?? '' } : null
      const rec = mode === 'chat' ? await runChat(q, parent) : await runVoice(q, parent)
      answered.set(q.id, rec)
      items.push(rec)
      console.log(`  ${mode.padEnd(5)} ${q.id} ${String(rec.ms).padStart(4)} ms ${rec.text.replace(/\s+/g, ' ').slice(0, 110)}`)
    }
  }
  const out = { tag, generatedAt: new Date().toISOString(), ctxMode: 'lesson', modes, kb: { shards: status.shards, docs: status.docs }, items }
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const file = path.join(OUT_DIR, `answers-${tag}.json`)
  fs.writeFileSync(file, JSON.stringify(out, null, 2) + '\n')
  console.log(`[holdout] ${items.length} answers → ${path.relative(ROOT, file)}`)
}

if (process.argv[1] && path.basename(process.argv[1]) === 'holdout-r7.mts') await main()
