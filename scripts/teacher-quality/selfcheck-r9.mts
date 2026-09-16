/**
 * SELF-CHECK r9 (own fresh generalization check for the local AI teacher, round 9).
 *
 * 13 NEW questions that are in none of goldQuestions.mts, holdout-r3..r8.mts, selfcheck-r6/r7.mts: grades 8-11,
 * all question types (definition, why, how, compare, example, calc), 2 English + 2 Uzbek.
 * Every expected fact was grepped in src/data/kb/corpus (chunk / card ids in ).
 * Written BEFORE the r9 composer changes - do not add per-question rules for them.
 *
 *   npx tsx scripts/teacher-quality/selfcheck-r9.mts [--tag s9] [--modes chat,voice]
 *   npx tsx scripts/teacher-quality/autoScore.mts --tag s9 --questions selfcheck-r9.mts#SELF_R9
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

export const SELF_R9: GoldQuestion[] = [
  { id: 's9-01', grade: 11, locale: 'ru', type: 'definition', lesson: 'c3-s02', source: 'g11-c3-s02-t02 (отношение числа диссоциированных молекул к общему числу)', question: 'Что такое степень диссоциации?', mustMention: ['отношени|число|количество', 'диссоциир|молекул'] },
  { id: 's9-02', grade: 8, locale: 'ru', type: 'how', lesson: 'c4-s09', source: 'g8-p39-t02 (из аммиака в три этапа: 4NH3 + 5O2 = 4NO + 6H2O …)', question: 'Как получают азотную кислоту в промышленности?', mustMention: ['аммиак|NH3|NH₃'] },
  { id: 's9-03', grade: 8, locale: 'ru', type: 'definition', lesson: 'c2-s03', source: 'theory-periodic-law / periodic-table (свойства элементов зависят от заряда ядра)', question: 'Что такое периодический закон?', mustMention: ['заряд', 'период'] },
  { id: 's9-04', grade: 8, locale: 'ru', type: 'definition', lesson: 'c3-s03', source: 'g8-p16-t03 («Ионы — это заряженные частицы»)', question: 'Что такое ионы?', mustMention: ['заряж|заряд'] },
  { id: 's9-05', grade: 9, locale: 'ru', type: 'why', lesson: 'c1-s05', source: 'inorg-water-hard (временная жёсткость = гидрокарбонаты, при кипячении → CaCO₃ накипь)', question: 'Почему в жёсткой воде образуется накипь?', mustMention: ['гидрокарбонат|кипячен|CaCO|Ca'] },
  { id: 's9-06', grade: 9, locale: 'ru', type: 'compare', lesson: 'c1-s05', source: 'g9-p16-t01/t02 (сплав — материал из расплавленных металлов; свойства отличаются от чистых металлов)', question: 'Чем сплавы отличаются от чистых металлов?', mustMention: ['сплав'] },
  { id: 's9-07', grade: 10, locale: 'ru', type: 'example', lesson: 'c3-s05', source: 'card-eq-g10-ester-fischer (CH₃COOH + C₂H₅OH ⇌ CH₃COOC₂H₅ + H₂O)', question: 'Приведи пример реакции этерификации', mustMention: ['CH3COOC2H5|CH₃COOC₂H₅|эфир|C2H5OH|C₂H₅OH'] },
  { id: 's9-08', grade: 8, locale: 'ru', type: 'calc', lesson: 'c5-s04', source: 'V = n·Vm = 3 · 22,4 = 67,2 л', question: 'Какой объём при нормальных условиях занимают 3 моль азота?', mustMention: ['67,2|67.2'] },
  { id: 's9-09', grade: 8, locale: 'ru', type: 'calc', lesson: 'c1-s04', source: 'M(NaOH) = 23 + 16 + 1 = 40 г/моль', question: 'Чему равна молярная масса гидроксида натрия NaOH?', mustMention: ['40'] },
  { id: 's9-10', grade: 9, locale: 'en', type: 'definition', lesson: 'c1-s05', source: 'g9-p16-t01 («Сплав — это материал, образованный при растворении в расплавленных металлах …»)', question: 'What is an alloy?', mustMention: ['metal|material'] },
  { id: 's9-11', grade: 8, locale: 'en', type: 'how', lesson: 'c4-s09', source: 'g8-p39-t02 (из аммиака)', question: 'How is nitric acid produced in industry?', mustMention: ['ammonia|NH3|NH₃|аммиак'] },
  { id: 's9-12', grade: 8, locale: 'uz', type: 'definition', lesson: 'c3-s03', source: 'g8-p16-t03 («Ионы — это заряженные частицы»)', question: 'Ion nima?', mustMention: ['zaryad|заряж|zarra'] },
  { id: 's9-13', grade: 8, locale: 'uz', type: 'example', lesson: 'c5-s01', source: 'rx-types (Соединения: 2H₂ + O₂ → 2H₂O)', question: 'Birikish reaksiyasiga misol keltiring', mustMention: ['H2O|H₂O|CaO|→'] },
]

/* ============================================================== runner (tag s9) */

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
  const tag = arg('tag', 's9')
  const modes = arg('modes', 'chat,voice').split(',').filter((m): m is Mode => m === 'chat' || m === 'voice')
  await preloadKnowledge()
  const status = getKnowledgeStatus()
  const byIdQ = new Map(SELF_R9.map((q) => [q.id, q]))
  const items: Awaited<ReturnType<typeof runChat>>[] = []
  for (const mode of modes) {
    const answered = new Map<string, { text: string }>()
    for (const q of SELF_R9) {
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
  console.log(`[selfcheck] ${items.length} answers → ${path.relative(ROOT, file)}`)
}

if (process.argv[1] && path.basename(process.argv[1]) === 'selfcheck-r9.mts') await main()
