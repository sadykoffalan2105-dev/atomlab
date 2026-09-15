/**
 * HOLDOUT r4 (fresh generalization check for the local AI teacher, judge round 4).
 *
 * 20 NEW questions that are in neither goldQuestions.mts nor holdout-r3.mts: grades 7–11, all question types,
 * 3 English + 3 Uzbek, 2 follow-up pairs. Every expected fact was grepped in src/data/kb/corpus (see `source`).
 * The composer was NOT tuned on these questions — do not add rules for them; write a new holdout set instead.
 *
 * Same code paths as runAnswers.mts (chat = composeLocalTeacherReply, voice = TrainingModeEngine.answer with
 * smartAi=false, ctx lesson); output .smoke/answer-quality/answers-<tag>.json in the same format:
 *
 *   npx tsx scripts/teacher-quality/holdout-r4.mts [--tag h4] [--modes chat,voice]
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

export const HOLDOUT_R4: GoldQuestion[] = [
  /* ---------------------------------------------------------------- ru singles */
  {
    id: 'h4-01', grade: 7, locale: 'ru', type: 'definition', lesson: 'c2-s03', source: 'Kimyo 7 §2.3 (g7-c2-s03-t03); Kimyo 11 §3 (g11-c1-s03-d02)',
    question: 'Что такое химический элемент?',
    mustMention: ['разновидность атомов|вид атомов', 'атом'],
  },
  {
    id: 'h4-02', grade: 7, locale: 'ru', type: 'how', lesson: 'c5-s02', source: 'Kimyo 7 §5.2 практическое (g7-c5-s02-t01); card card-reaction-zn-hcl',
    question: 'Как получают водород в лаборатории?',
    mustMention: ['цинк|Zn|железо|Fe|алюмини|Al', 'соляной кислот|HCl'],
  },
  {
    id: 'h4-03', grade: 7, locale: 'ru', type: 'calc', lesson: 'c2-s11', source: 'Kimyo 7 §2.11 (g7-c2-s11-t05: ω(E), Mr(H2O)=18)',
    question: 'Вычисли массовую долю кислорода в воде.',
    mustMention: ['88,9|88.9|89 %|89%|0,89|8/9', '16', '18'],
  },
  {
    id: 'h4-04', grade: 8, locale: 'ru', type: 'why', lesson: 'c4-s09', source: 'Kimyo 8 §36 (g8-p36-t03)',
    question: 'Почему азот химически малоактивен?',
    mustMention: ['трех пар электронов|три пары|тройн', 'инертн|прочн|неактивн'],
  },
  {
    id: 'h4-05', grade: 8, locale: 'ru', type: 'compare', lesson: 'c5-s03', source: 'cards faq-031, thermo-exo-endo; Kimyo 11 §26 (g11-c6-s02-t13)',
    question: 'Чем экзотермические реакции отличаются от эндотермических?',
    mustMention: ['выделя|выделением', 'поглоща|поглощением'],
  },
  {
    id: 'h4-06', grade: 9, locale: 'ru', type: 'calc', lesson: 'c4-s01', source: 'cards faq-005, deep-mole-calculations (n = m/M); Mr(H2O) Kimyo 7 §2.7',
    question: 'Сколько моль составляют 36 г воды?',
    mustMention: ['2 моль', '18'],
  },
  {
    id: 'h4-07', grade: 10, locale: 'ru', type: 'example', lesson: 'c2-s08', source: 'cards card-eq-g10-alkene-pe, org-deep-polymers, g10-alkene-reactions',
    question: 'Приведи пример реакции полимеризации',
    mustMention: ['полиэтилен|(C2H4)n|CH2=CH2|полистирол|(C8H8)n'],
  },
  {
    id: 'h4-08', grade: 11, locale: 'ru', type: 'how', lesson: 'c6-s02', source: 'Kimyo 11 §26 p118 (g11-c6-s02-t11..t13)',
    question: 'Как температура влияет на химическое равновесие?',
    mustMention: ['повышени', 'эндотерм|поглощением', 'экзотерм|выделением|понижени'],
  },
  {
    id: 'h4-09', grade: 11, locale: 'ru', type: 'compare', lesson: 'c6-s01', source: 'Kimyo 11 §25 (g11-c6-s01-t02); Kimyo 8 §34 (g8-p34-t01)',
    question: 'Чем обратимые реакции отличаются от необратимых?',
    mustMention: ['противоположн|обе стороны|обоих направлениях', 'до конца|полностью|одном направлении'],
  },
  {
    id: 'h4-20', grade: 9, locale: 'ru', type: 'why', lesson: 'c1-s02', source: 'Kimyo 9 §24 p117 (g9-p24-t02)',
    question: 'Почему в жёсткой воде плохо пенится мыло?',
    mustMention: ['кальци|Ca', 'магни|Mg', 'нерастворим|не растворимые'],
  },
  /* ------------------------------------------------------------ follow-up pairs */
  {
    id: 'h4-10', grade: 10, locale: 'ru', type: 'definition', lesson: 'c3-s01', source: 'Kimyo 10 §3.1 (g10-c3-s01-d01)',
    question: 'Что такое спирты?',
    mustMention: ['гидроксильн|OH', 'углеводород'],
  },
  {
    id: 'h4-11', grade: 10, locale: 'ru', type: 'example', lesson: 'c3-s01', followUpOf: 'h4-10', source: 'Kimyo 10 §3.1–3.3; card org-deep-alcohols',
    question: 'Приведи пример',
    mustMention: ['метанол|этанол|CH3OH|C2H5OH|глицерин|этиленгликоль|метиловый|этиловый'],
  },
  {
    id: 'h4-12', grade: 10, locale: 'ru', type: 'how', lesson: 'c2-s14', source: 'Kimyo 10 §2.14 (g10-c2-s14-t01); card org-deep-alkynes',
    question: 'Как получают ацетилен?',
    mustMention: ['карбид кальция|карбида кальция|CaC2', 'вод|гидролиз|H2O'],
  },
  {
    id: 'h4-13', grade: 10, locale: 'ru', type: 'how', lesson: 'c2-s14', followUpOf: 'h4-12', source: 'Kimyo 10 §2.14',
    question: 'Объясни проще',
    mustMention: ['карбид|CaC2', 'вод'],
  },
  /* --------------------------------------------------------------------- en */
  {
    id: 'h4-14', grade: 11, locale: 'en', type: 'definition', lesson: 'c5-s02', source: 'card kin-activation-energy; Kimyo 11 §23 p106',
    question: 'What is activation energy?',
    mustMention: ['minimum energy|energy barrier|minimum amount of energy', 'react|particles'],
  },
  {
    id: 'h4-15', grade: 7, locale: 'en', type: 'calc', lesson: 'c2-s09', source: 'Kimyo 7 §2.7 p54 (Mr(CO2) = 44); card faq-005 (M = Mr g/mol)',
    question: 'What is the molar mass of carbon dioxide CO2?',
    mustMention: ['44', 'g/mol'],
  },
  {
    id: 'h4-16', grade: 8, locale: 'en', type: 'how', lesson: 'c4-s09', source: 'Kimyo 8 §37 (g8-p37-t02); card card-reaction-n2-h2-nh3',
    question: 'How is ammonia produced in industry?',
    mustMention: ['nitrogen|N2', 'hydrogen|H2', 'catalyst|iron|pressure|temperature'],
  },
  /* --------------------------------------------------------------------- uz */
  {
    id: 'h4-17', grade: 11, locale: 'uz', type: 'definition', lesson: 'c2-s01', source: 'Kimyo 11 §5 (g11-c2-s01-d01)',
    question: 'Mol nima?',
    mustMention: ['modda miqdori', '6,02|Avogadro|zarracha'],
  },
  {
    id: 'h4-18', grade: 9, locale: 'uz', type: 'why', lesson: 'c1-s04', source: 'Kimyo 9 §18 (g9-p18-t04); card faq-032',
    question: 'Nega alyuminiy havoda korroziyaga uchramaydi?',
    mustMention: ['oksid', "parda|qatlam|plyonka|pard"],
  },
  {
    id: 'h4-19', grade: 8, locale: 'uz', type: 'example', lesson: 'c1-s03', source: 'Kimyo 8 §2 p10 (g8-p02-t01)',
    question: 'Kislotali oksidga misol keltiring',
    mustMention: ['CO2|SO3|P2O5|SO2|N2O5|SiO2'],
  },
]

/* ============================================================== runner (tag h4) */

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
  const tag = arg('tag', 'h4')
  const modes = arg('modes', 'chat,voice').split(',').filter((m): m is Mode => m === 'chat' || m === 'voice')
  await preloadKnowledge()
  const status = getKnowledgeStatus()
  const byIdQ = new Map(HOLDOUT_R4.map((q) => [q.id, q]))
  const items: Awaited<ReturnType<typeof runChat>>[] = []
  for (const mode of modes) {
    const answered = new Map<string, { text: string }>()
    for (const q of HOLDOUT_R4) {
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

if (process.argv[1] && path.basename(process.argv[1]) === 'holdout-r4.mts') await main()
