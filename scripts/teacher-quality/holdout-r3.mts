/**
 * HOLDOUT r3 (generalization check for the local AI teacher, judge round 3).
 *
 * 20 NEW questions that are not in goldQuestions.mts: grades 7–11, all question types, 3 English + 3 Uzbek,
 * 2 follow-up pairs. Every expected fact was checked in src/data/kb/corpus (see `source`).
 * The composer was NOT tuned on these questions — do not add rules for them, add new holdout questions instead.
 *
 * Runs the same code paths as runAnswers.mts (chat = composeLocalTeacherReply, voice = TrainingModeEngine.answer
 * with smartAi=false, ctx lesson) and writes .smoke/answer-quality/answers-<tag>.json in the same format:
 *
 *   npx tsx scripts/teacher-quality/holdout-r3.mts [--tag h3] [--modes chat,voice]
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

export const HOLDOUT_R3: GoldQuestion[] = [
  /* ---------------------------------------------------------------- ru singles */
  {
    id: 'h3-01', grade: 7, locale: 'ru', type: 'definition', lesson: 'c2-s07', source: 'Kimyo 7 §2.7 p54',
    question: 'Что такое молекула?',
    mustMention: ['частица|частицей', 'атомов|атомы'],
  },
  {
    id: 'h3-02', grade: 10, locale: 'ru', type: 'how', lesson: 'c2-s08', source: 'Kimyo 10 §2.8 p60; §2.9 p62',
    question: 'Как получают этилен в лаборатории?',
    mustMention: ['этилового спирта|этанол|C2H5OH', 'серной кислоты|H2SO4', 'нагрева'],
  },
  {
    id: 'h3-03', grade: 7, locale: 'ru', type: 'why', lesson: 'c3-s02', source: 'Kimyo 7 §3.2 p79',
    question: 'Почему щелочные металлы хранят под слоем керосина?',
    mustMention: ['активны|активные|активность', 'водой|воздух|кислород'],
  },
  {
    id: 'h3-04', grade: 10, locale: 'ru', type: 'calc', lesson: 'c3-s01', source: 'Kimyo 7 §2.7 p54 (Mr = ΣAr)',
    question: 'Чему равна относительная молекулярная масса этанола C2H5OH?',
    mustMention: ['46', 'сумм|складыва'],
  },
  {
    id: 'h3-05', grade: 11, locale: 'ru', type: 'definition', lesson: 'c1-s04', source: 'Kimyo 11 §4 p26–27; Kimyo 9 §2 p18',
    question: 'Что такое водородная связь?',
    mustMention: ['водород', 'электроотрицательн'],
  },
  {
    id: 'h3-06', grade: 8, locale: 'ru', type: 'compare', lesson: 'c3-s03', source: 'Kimyo 8 §15 p66, §16 p72–73; Kimyo 9 §2 p17',
    question: 'Чем ковалентная связь отличается от ионной?',
    mustMention: ['электронных пар|общих электронных|общие пары', 'ионами|ионов'],
  },
  {
    id: 'h3-07', grade: 8, locale: 'ru', type: 'calc', lesson: 'c5-s04', source: 'Kimyo 8 §25 p102–104',
    question: 'Какой объём занимают 2 моль кислорода при нормальных условиях?',
    mustMention: ['44,8|44.8', '22,4|22.4'],
  },
  {
    id: 'h3-08', grade: 9, locale: 'ru', type: 'example', lesson: 'c6-s03', source: 'Kimyo 9 §6 p29–30',
    question: 'Приведи пример реакции ионного обмена, в которой образуется осадок',
    mustMention: ['BaSO4|AgCl|осадок'],
  },
  {
    id: 'h3-09', grade: 10, locale: 'ru', type: 'definition', lesson: 'c2-s13', source: 'Kimyo 10 §2.13 p72',
    question: 'Что такое алкины?',
    mustMention: ['углеводород', 'тройн'],
  },
  {
    id: 'h3-10', grade: 11, locale: 'ru', type: 'why', lesson: 'c5-s02', source: 'Kimyo 11 §23 p106',
    question: 'Почему катализатор ускоряет химическую реакцию?',
    mustMention: ['энергию активации|энергия активации'],
  },
  /* ------------------------------------------------------------ follow-up pairs */
  {
    id: 'h3-11', grade: 7, locale: 'ru', type: 'definition', lesson: 'c2-s08', source: 'Kimyo 7 §2.8 p56–57',
    question: 'Что такое аллотропия?',
    mustMention: ['нескольких простых веществ|несколько видов простых веществ', 'одного химического элемента|один химический элемент'],
  },
  {
    id: 'h3-12', grade: 7, locale: 'ru', type: 'example', lesson: 'c2-s08', followUpOf: 'h3-11', source: 'Kimyo 7 §2.8 p56–57',
    question: 'А какие есть примеры?',
    mustMention: ['графит|алмаз|озон|фосфор|сера'],
  },
  {
    id: 'h3-13', grade: 11, locale: 'ru', type: 'how', lesson: 'c6-s02', source: 'Kimyo 11 §26 p116–117',
    question: 'Как концентрация влияет на химическое равновесие?',
    mustMention: ['увелич', 'смещ', 'прямой|вправо|обратной|влево'],
  },
  {
    id: 'h3-14', grade: 11, locale: 'ru', type: 'how', lesson: 'c6-s02', followUpOf: 'h3-13', source: 'Kimyo 11 §26 p116–117',
    question: 'А если концентрацию уменьшить?',
    mustMention: ['уменьш', 'смещ'],
  },
  /* --------------------------------------------------------------------- en */
  {
    id: 'h3-15', grade: 8, locale: 'en', type: 'definition', lesson: 'c1-s04', source: 'Kimyo 8 §2 p11–12',
    question: 'What is a base?',
    mustMention: ['metal', 'hydroxide|hydroxyl|OH'],
  },
  {
    id: 'h3-16', grade: 8, locale: 'en', type: 'how', lesson: 'c4-s07', source: 'Kimyo 8 §27 p115–118',
    question: 'How can you detect chloride ions in a solution?',
    mustMention: ['silver nitrate|AgNO3', 'precipitate|AgCl'],
  },
  {
    id: 'h3-17', grade: 7, locale: 'en', type: 'compare', lesson: 'c2-s07', source: 'Kimyo 7 §2.7 p54; card misc-atom-vs-molecule',
    question: 'What is the difference between an atom and a molecule?',
    mustMention: ['atom', 'molecule', 'atoms'],
  },
  /* --------------------------------------------------------------------- uz */
  {
    id: 'h3-18', grade: 8, locale: 'uz', type: 'definition', lesson: 'c1-s05', source: 'Kimyo 8 §2 p15',
    question: 'Tuz nima?',
    mustMention: ['metall', 'kislota qoldig'],
  },
  {
    id: 'h3-19', grade: 9, locale: 'uz', type: 'why', lesson: 'c1-s04', source: 'Kimyo 9 §18 p80–81',
    question: 'Nega temir zanglaydi?',
    mustMention: ['kislorod', 'suv|nam'],
  },
  {
    id: 'h3-20', grade: 7, locale: 'uz', type: 'definition', lesson: 'c6-s06', source: 'Kimyo 7 §6.6 p142',
    question: 'Neytrallanish reaksiyasi nima?',
    mustMention: ['kislota', 'asos', 'tuz', 'suv'],
  },
]

/* ============================================================== runner (tag h3) */

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
  const tag = arg('tag', 'h3')
  const modes = arg('modes', 'chat,voice').split(',').filter((m): m is Mode => m === 'chat' || m === 'voice')
  await preloadKnowledge()
  const status = getKnowledgeStatus()
  const byIdQ = new Map(HOLDOUT_R3.map((q) => [q.id, q]))
  const items: Awaited<ReturnType<typeof runChat>>[] = []
  for (const mode of modes) {
    const answered = new Map<string, { text: string }>()
    for (const q of HOLDOUT_R3) {
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

if (process.argv[1] && path.basename(process.argv[1]) === 'holdout-r3.mts') await main()
