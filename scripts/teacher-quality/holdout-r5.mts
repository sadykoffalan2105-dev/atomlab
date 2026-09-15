/**
 * HOLDOUT r5 (fresh generalization check for the local AI teacher, judge round 5).
 *
 * 20 NEW questions that are in none of goldQuestions.mts, holdout-r3.mts, holdout-r4.mts: grades 7–11, all question
 * types, 3 English + 3 Uzbek, 2 follow-up pairs. Every expected fact was grepped in src/data/kb/corpus (see `source`).
 * The composer was NOT tuned on these questions — do not add rules for them; write a new holdout set instead.
 *
 * Same code paths as runAnswers.mts (chat = composeLocalTeacherReply, voice = TrainingModeEngine.answer with
 * smartAi=false, ctx lesson); output .smoke/answer-quality/answers-<tag>.json in the same format:
 *
 *   npx tsx scripts/teacher-quality/holdout-r5.mts [--tag h5] [--modes chat,voice]
 *   npx tsx scripts/teacher-quality/autoScore.mts --tag h5 --questions holdout-r5.mts#HOLDOUT_R5
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

export const HOLDOUT_R5: GoldQuestion[] = [
  /* ---------------------------------------------------------------- ru singles */
  {
    id: 'h5-01', grade: 7, locale: 'ru', type: 'definition', lesson: 'c2-s04', source: 'Kimyo 7 §2.4 (g7-c2-s04-t04, t06)',
    question: 'Что такое относительная атомная масса?',
    mustMention: ['1/12', 'углерод', 'во сколько раз|больше'],
  },
  {
    id: 'h5-02', grade: 10, locale: 'ru', type: 'how', lesson: 'c3-s02', source: 'Kimyo 10 §3.2 (g10-c3-s02-t07: брожение глюкозы, гидратация алкенов); card card-eq-g10-carb-ferment',
    question: 'Как получают этиловый спирт?',
    mustMention: ['брожени|гидратаци', 'глюкоз|этилен|алкен'],
  },
  {
    id: 'h5-03', grade: 9, locale: 'ru', type: 'why', lesson: 'c7-s04', source: 'Kimyo 9 §8 (g9-p08-t06: связь между плоскостями слабее)',
    question: 'Почему графит мягкий?',
    mustMention: ['слабее|слаб', 'плоскост|сло'],
  },
  {
    id: 'h5-04', grade: 7, locale: 'ru', type: 'why', lesson: 'c4-s04', source: 'Kimyo 7 §4.4 (g7-c4-s04-t02: самая низкая t кип −196 °C). NB Kimyo 8 §36 g8-p36-t02 says «выше» (textbook error)',
    question: 'Почему азот первым испаряется из жидкого воздуха?',
    mustMention: ['температур', '-196|−196|–196|самая низкая|ниже'],
  },
  {
    id: 'h5-05', grade: 11, locale: 'ru', type: 'how', lesson: 'c6-s02', source: 'cards faq-035, misc-catalyst-equilibrium',
    question: 'Как катализатор влияет на химическое равновесие?',
    mustMention: ['не смещает|не влияет|не сдвигает', 'ускоряет|быстрее'],
  },
  {
    id: 'h5-06', grade: 11, locale: 'ru', type: 'calc', lesson: 'c4-s04', source: 'cards g10-solutions-molality, deep-mole-calculations (ω = m(в-ва)/m(р-ра)·100%)',
    question: 'В 150 г воды растворили 50 г соли. Какова массовая доля соли в растворе?',
    mustMention: ['25', '200'],
  },
  {
    id: 'h5-07', grade: 7, locale: 'ru', type: 'calc', lesson: 'c2-s09', source: 'Kimyo 7 §2.9 (g7-c2-s09-t06: N = n·NA); card formula-mole',
    question: 'Сколько молекул содержится в 2 моль воды?',
    mustMention: ['12,04|1,204|12.04|1.204', '6,02|6.02'],
  },
  {
    id: 'h5-08', grade: 8, locale: 'ru', type: 'compare', lesson: 'c1-s03', source: 'Kimyo 7 §4.10 (g7-c4-s10-t05); cards theory-oxides, inorg-oxides-classes',
    question: 'Чем основные оксиды отличаются от кислотных?',
    mustMention: ['основани|щёлоч|щелоч', 'кислот'],
  },
  {
    id: 'h5-09', grade: 9, locale: 'ru', type: 'how', lesson: 'c2-s01', source: 'Kimyo 9 §25 (g9-p25-t03: электролиз Al2O3 в расплавленном криолите)',
    question: 'Как получают алюминий в промышленности?',
    mustMention: ['электролиз', 'криолит|Al2O3|оксид алюминия'],
  },
  {
    id: 'h5-10', grade: 8, locale: 'ru', type: 'example', lesson: 'c5-s03', source: 'cards thermo-exo-endo, formula-thermochem (C + O2 = CO2 + 393 кДж); Kimyo 8 §34 (2SO2 + O2 → 2SO3 + Q)',
    question: 'Приведи пример экзотермической реакции',
    mustMention: ['горени|C + O2|C + O₂|нейтрализац|SO3|SO₃|H2 + O2'],
  },
  /* ------------------------------------------------------------ follow-up pairs */
  {
    id: 'h5-11', grade: 7, locale: 'ru', type: 'definition', lesson: 'c6-s05', source: 'Kimyo 7 §6.5 (g7-c6-s05-t02); card faq-021',
    question: 'Что такое индикаторы?',
    mustMention: ['окраск|цвет', 'кислот'],
  },
  {
    id: 'h5-12', grade: 7, locale: 'ru', type: 'example', lesson: 'c6-s05', followUpOf: 'h5-11', source: 'cards faq-021, deep-ph-indicators, formula-ph',
    question: 'Приведи пример',
    mustMention: ['лакмус|фенолфталеин|метилоранж|метиловый оранжевый'],
  },
  {
    id: 'h5-13', grade: 8, locale: 'ru', type: 'definition', lesson: 'c1-s04', source: 'Kimyo 8 §3 (g8-p03-t06); card card-compound-al_oh_3',
    question: 'Что такое амфотерные гидроксиды?',
    mustMention: ['основани', 'кислот'],
  },
  {
    id: 'h5-14', grade: 8, locale: 'ru', type: 'how', lesson: 'c1-s04', followUpOf: 'h5-13', source: 'cards card-compound-al_oh_3, card-reaction-aloh3-naoh',
    question: 'А как это доказать на опыте?',
    mustMention: ['кислот', 'щелоч|щёлоч|NaOH|основани'],
  },
  /* --------------------------------------------------------------------- en */
  {
    id: 'h5-15', grade: 9, locale: 'en', type: 'compare', lesson: 'c7-s04', source: 'Kimyo 9 §8 (g9-p08-t04..t06: алмаз — самое твердое; графит — мягкое)',
    question: 'What is the difference between diamond and graphite?',
    mustMention: ['hard', 'soft'],
  },
  {
    id: 'h5-16', grade: 9, locale: 'en', type: 'calc', lesson: 'c4-s01', source: 'cards formula-mole, deep-mole-calculations (m = n·M); Mr(H2O)=18 Kimyo 7 §2.7',
    question: 'What is the mass of 3 moles of water?',
    mustMention: ['54', '18'],
  },
  {
    id: 'h5-17', grade: 10, locale: 'en', type: 'definition', lesson: 'c2-s07', source: 'card org-deep-alkenes (ненасыщенные углеводороды с одной двойной связью, CnH2n)',
    question: 'What are alkenes?',
    mustMention: ['double bond', 'hydrocarbon'],
  },
  /* --------------------------------------------------------------------- uz */
  {
    id: 'h5-18', grade: 11, locale: 'uz', type: 'definition', lesson: 'c1-s04', source: 'Kimyo 9 §17 (g9-p17-t02); Kimyo 8 §17 (g8-p17-t03)',
    question: "Metall bog'lanish nima?",
    mustMention: ['elektron', 'ion|atom'],
  },
  {
    id: 'h5-19', grade: 8, locale: 'uz', type: 'example', lesson: 'c1-s04', source: 'cards card-compound-koh, card-compound-na2o (NaOH); Kimyo 7 §3.1 (основания – щелочи)',
    question: 'Ishqorga misol keltiring',
    mustMention: ['NaOH|KOH|Ca(OH)2|Ba(OH)2|LiOH'],
  },
  {
    id: 'h5-20', grade: 8, locale: 'uz', type: 'why', lesson: 'c4-s01', source: 'Kimyo 8 §13 (g8-p13-t19), §21 (g8-p21-t04: восемь электронов, завершенные слои)',
    question: 'Nega inert gazlar kimyoviy jihatdan faol emas?',
    mustMention: ["sakkiz|8|tugallangan|to'lgan|barqaror", 'tashqi|elektron'],
  },
]

/* ============================================================== runner (tag h5) */

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
  const tag = arg('tag', 'h5')
  const modes = arg('modes', 'chat,voice').split(',').filter((m): m is Mode => m === 'chat' || m === 'voice')
  await preloadKnowledge()
  const status = getKnowledgeStatus()
  const byIdQ = new Map(HOLDOUT_R5.map((q) => [q.id, q]))
  const items: Awaited<ReturnType<typeof runChat>>[] = []
  for (const mode of modes) {
    const answered = new Map<string, { text: string }>()
    for (const q of HOLDOUT_R5) {
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

if (process.argv[1] && path.basename(process.argv[1]) === 'holdout-r5.mts') await main()
