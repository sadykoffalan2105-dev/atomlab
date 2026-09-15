/**
 * HOLDOUT r6 (fresh generalization check for the local AI teacher, judge round 6).
 *
 * 20 NEW questions that are in none of goldQuestions.mts, holdout-r3/r4/r5.mts, selfcheck-r6.mts: grades 7–11, all
 * question types (definition, why, how, compare, example, calc incl. n=m/M, V=n·Vm, ω), 3 English + 3 Uzbek,
 * 2 follow-up pairs. Every expected fact was grepped in src/data/kb/corpus (chunk ids in `source`).
 * The composer was NOT tuned on these questions — do not add rules for them; write a new holdout set instead.
 *
 * Same code paths as runAnswers.mts (chat = composeLocalTeacherReply, voice = TrainingModeEngine.answer with
 * smartAi=false, ctx lesson); output .smoke/answer-quality/answers-<tag>.json in the same format:
 *
 *   npx tsx scripts/teacher-quality/holdout-r6.mts [--tag h6] [--modes chat,voice]
 *   npx tsx scripts/teacher-quality/autoScore.mts --tag h6 --questions holdout-r6.mts#HOLDOUT_R6
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

export const HOLDOUT_R6: GoldQuestion[] = [
  /* ---------------------------------------------------------------- ru singles */
  {
    id: 'h6-01', grade: 7, locale: 'ru', type: 'how', lesson: 'c1-s05', source: 'Kimyo 7 §1.5 (g7-c1-s05-t05: «можете использовать магнит, чтобы отделить железные опилки»)',
    question: 'Как отделить железные опилки от порошка серы?',
    mustMention: ['магнит'],
  },
  {
    id: 'h6-02', grade: 11, locale: 'ru', type: 'compare', lesson: 'c4-s02', source: 'Kimyo 11 §4.2 (g11-c4-s02-d02: насыщенный / ненасыщенный); card theory-solutions',
    question: 'Чем насыщенный раствор отличается от ненасыщенного?',
    mustMention: ['нельзя растворить|больше не растворяется|не растворяется', 'можно растворить|еще|ещё'],
  },
  {
    id: 'h6-03', grade: 8, locale: 'ru', type: 'example', lesson: 'c5-s01', source: 'cards rx-types (Zn + 2HCl → ZnCl₂ + H₂↑), g8-reaction-types (Fe + CuSO₄), faq-033',
    question: 'Приведи пример реакции замещения',
    mustMention: ['Zn + 2HCl|Fe + CuSO4|Fe + CuSO₄|ZnCl2|ZnCl₂'],
  },
  {
    id: 'h6-04', grade: 8, locale: 'ru', type: 'how', lesson: 'c4-s10', source: 'Kimyo 8 §32 (g8-p32-t03: растворимая соль бария, белый осадок BaSO4); card card-eq-g11-ion-baso4',
    question: 'Как распознать сульфат-ион в растворе?',
    mustMention: ['бари|BaCl2|BaCl₂|Ba2+|Ba²⁺', 'осад|BaSO4|BaSO₄'],
  },
  {
    id: 'h6-05', grade: 9, locale: 'ru', type: 'why', lesson: 'c1-s01', source: 'Kimyo 9 §20 (g9-p20-t01: один s-электрон на внешнем слое, легко отдают валентные электроны)',
    question: 'Почему щелочные металлы — самые сильные восстановители?',
    mustMention: ['отда', 'электрон'],
  },
  {
    id: 'h6-06', grade: 10, locale: 'ru', type: 'definition', lesson: 'c2-s04', source: 'Kimyo 10 §2.4 (g10-c2-s04-d01: «Крекинг – это расщепление алкана с длинной цепью…»)',
    question: 'Что такое крекинг?',
    mustMention: ['расщеплен', 'алкен|коротк'],
  },
  {
    id: 'h6-07', grade: 11, locale: 'ru', type: 'calc', lesson: 'c2-s01', source: 'Kimyo 7 §2.9 (g7-c2-s09-t05: M(Fe) = 56 г/моль); cards faq-005, deep-mole-calculations (n = m/M) → 0,2 моль',
    question: 'Сколько моль составляют 11,2 г железа?',
    mustMention: ['0,2|0.2', '56'],
  },
  {
    id: 'h6-08', grade: 11, locale: 'ru', type: 'calc', lesson: 'c2-s02', source: 'Kimyo 11 §2.2 (g11-c2-s02-d02: 22,4 л); cards brain-mole-map, deep-mole-calculations → n = 8/32 = 0,25 моль, V = 5,6 л',
    question: 'Какой объём при нормальных условиях занимают 8 г кислорода?',
    mustMention: ['5,6|5.6', '22,4|22.4'],
  },
  {
    id: 'h6-09', grade: 9, locale: 'ru', type: 'calc', lesson: 'c1-s02', source: 'Kimyo 9 §24 (g9-p24-t05: C% = m(растворимое)/m(раствор)·100%); card deep-mole-calculations → 15 %',
    question: 'В 200 г раствора содержится 30 г соли. Какова массовая доля соли в этом растворе?',
    mustMention: ['15'],
  },
  {
    id: 'h6-10', grade: 7, locale: 'ru', type: 'why', lesson: 'c4-s06', source: 'Kimyo 7 §4.6 (g7-c4-s06-t05: самовоспламеняющееся вещество, поэтому под слоем воды)',
    question: 'Почему белый фосфор хранят под слоем воды?',
    mustMention: ['самовоспламен|самовозгоран|самопроизвольно'],
  },
  /* ------------------------------------------------------------ follow-up pairs */
  {
    id: 'h6-11', grade: 8, locale: 'ru', type: 'definition', lesson: 'c3-s04', source: 'Kimyo 8 §17 (g8-p17-d01, g8-p17-t02)',
    question: 'Что такое кристаллическая решётка?',
    mustMention: ['решетк|решётк', 'частиц|узл'],
  },
  {
    id: 'h6-12', grade: 8, locale: 'ru', type: 'compare', lesson: 'c3-s04', followUpOf: 'h6-11', source: 'Kimyo 8 §17 (g8-p17-t02/t03: ионная, атомная, молекулярная, металлическая); Kimyo 11 §1.4 (g11-c1-s04-t11)',
    question: 'А какие они бывают?',
    mustMention: ['ионн', 'атомн', 'молекулярн', 'металлическ'],
  },
  {
    id: 'h6-13', grade: 9, locale: 'ru', type: 'definition', lesson: 'c7-s04', source: 'Kimyo 9 §10 (g9-p10-t02: CO – бесцветный газ без запаха, чрезвычайно ядовит); card card-compound-co',
    question: 'Что такое угарный газ?',
    mustMention: ['CO|оксид углерода', 'ядовит|бесцветн'],
  },
  {
    id: 'h6-14', grade: 9, locale: 'ru', type: 'why', lesson: 'c7-s04', followUpOf: 'h6-13', source: 'Kimyo 9 §10 (g9-p10-t02: легче соединяется с гемоглобином); card card-compound-co',
    question: 'А почему он ядовит?',
    mustMention: ['гемоглобин', 'кислород'],
  },
  /* --------------------------------------------------------------------- en */
  {
    id: 'h6-15', grade: 10, locale: 'en', type: 'definition', lesson: 'c2-s08', source: 'Kimyo 10 §2.8 (g10-c2-s08-d01: полимеризация – соединение молекул мономеров в полимер)',
    question: 'What is polymerization?',
    mustMention: ['monomer', 'polymer'],
  },
  {
    id: 'h6-16', grade: 9, locale: 'en', type: 'calc', lesson: 'c4-s01', source: 'cards faq-005, brain-mole-map (n = V/Vm, Vm = 22,4 л/моль) → 0.5 mol',
    question: 'How many moles are there in 11.2 liters of hydrogen at STP?',
    mustMention: ['0.5|0,5', '22.4|22,4'],
  },
  {
    id: 'h6-17', grade: 8, locale: 'en', type: 'compare', lesson: 'c4-s09', source: 'Kimyo 8 §40 (g8-p40-t02/t03, table 22: white – poisonous, glows, molecular; red – not poisonous, no glow, atomic)',
    question: 'What is the difference between white and red phosphorus?',
    mustMention: ['poison|toxic|glow', 'white', 'red'],
  },
  /* --------------------------------------------------------------------- uz */
  {
    id: 'h6-18', grade: 7, locale: 'uz', type: 'definition', lesson: 'c1-s05', source: 'Kimyo 7 §1.5 (g7-c1-s05-t05), §1.6 (g7-c1-s06-d01: фильтрация разделяет разнородные смеси); card lab-filtration',
    question: 'Filtrlash nima?',
    mustMention: ['filtr', "qattiq|zarra|aralashma|ajrat"],
  },
  {
    id: 'h6-19', grade: 8, locale: 'uz', type: 'calc', lesson: 'c4-s05', source: 'cards faq-005, brain-mole-map (V = n·Vm, 22,4 л/моль) → 44,8 l',
    question: "Normal sharoitda 2 mol vodorod qancha hajmni egallaydi?",
    mustMention: ['44,8|44.8', '22,4|22.4'],
  },
  {
    id: 'h6-20', grade: 7, locale: 'uz', type: 'example', lesson: 'c3-s02', source: 'Kimyo 7 §3.2 (g7-c3-s02-t02: фтор F, хлор Cl, бром Br, йод I)',
    question: 'Galogenlarga misol keltiring',
    mustMention: ['ftor|xlor|brom|yod|фтор|хлор|бром|йод|Cl2|Cl₂|Br2|Br₂'],
  },
]

/* ============================================================== runner (tag h6) */

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
  const tag = arg('tag', 'h6')
  const modes = arg('modes', 'chat,voice').split(',').filter((m): m is Mode => m === 'chat' || m === 'voice')
  await preloadKnowledge()
  const status = getKnowledgeStatus()
  const byIdQ = new Map(HOLDOUT_R6.map((q) => [q.id, q]))
  const items: Awaited<ReturnType<typeof runChat>>[] = []
  for (const mode of modes) {
    const answered = new Map<string, { text: string }>()
    for (const q of HOLDOUT_R6) {
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

if (process.argv[1] && path.basename(process.argv[1]) === 'holdout-r6.mts') await main()
