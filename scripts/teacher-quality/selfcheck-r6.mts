/**
 * SELF-CHECK r6 (composer author's own varied questions, written BEFORE tuning; not for rules).
 * Same runner as holdout-r5.mts.  npx tsx scripts/teacher-quality/selfcheck-r6.mts --tag s6
 *   npx tsx scripts/teacher-quality/autoScore.mts --tag s6 --questions "selfcheck-r6.mts#SELF_R6"
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

export const SELF_R6: GoldQuestion[] = [
  { id: 's6-01', grade: 8, locale: 'ru', type: 'definition', lesson: 'c3-s02', question: 'Что такое ковалентная связь?', mustMention: ['общ|электронн пар', 'атом'] },
  { id: 's6-02', grade: 8, locale: 'ru', type: 'example', lesson: 'c3-s02', followUpOf: 's6-01', question: 'Приведи пример', mustMention: ['H2|Cl2|HCl|H2O|O2|N2|NH3|CH4'] },
  { id: 's6-03', grade: 8, locale: 'ru', type: 'calc', lesson: 'c5-s04', question: 'Какой объём займут 0,5 моль кислорода при нормальных условиях?', mustMention: ['11,2|11.2', '22,4|22.4'] },
  { id: 's6-04', grade: 9, locale: 'ru', type: 'calc', lesson: 'c4-s03', question: 'Сколько граммов сахара нужно взять для приготовления 250 г 8%-го раствора?', mustMention: ['20'] },
  { id: 's6-05', grade: 7, locale: 'ru', type: 'calc', lesson: 'c2-s09', question: 'Какое количество вещества составляют 36 г воды?', mustMention: ['2 моль', '18'] },
  { id: 's6-06', grade: 9, locale: 'ru', type: 'why', lesson: 'c1-s04', question: 'Почему железо ржавеет во влажном воздухе?', mustMention: ['вод|влаг', 'кислород|окисл'] },
  { id: 's6-07', grade: 8, locale: 'ru', type: 'how', lesson: 'c4-s09', question: 'Как получают азот в промышленности?', mustMention: ['воздух', 'жидк|перегонк|фракц|кипени'] },
  { id: 's6-08', grade: 10, locale: 'ru', type: 'compare', lesson: 'c2-s07', question: 'Чем алкены отличаются от алканов?', mustMention: ['двойн', 'одинарн|предельн|насыщ'] },
  { id: 's6-09', grade: 9, locale: 'ru', type: 'example', lesson: 'c2-s05', question: 'Приведи пример амфотерного оксида', mustMention: ['Al2O3|ZnO|BeO|Al₂O₃'] },
  { id: 's6-10', grade: 11, locale: 'ru', type: 'how', lesson: 'c6-s02', question: 'Как давление влияет на химическое равновесие?', mustMention: ['давлен', 'смещ|сдвиг'] },
  { id: 's6-11', grade: 7, locale: 'en', type: 'calc', lesson: 'c2-s09', question: 'How many molecules are there in 0.5 mol of oxygen?', mustMention: ['3,01|3.01'] },
  { id: 's6-12', grade: 8, locale: 'en', type: 'definition', lesson: 'c1-s05', question: 'What is a salt?', mustMention: ['metal', 'acid'] },
  { id: 's6-13', grade: 9, locale: 'uz', type: 'calc', lesson: 'c4-s01', question: "20 g natriy gidroksid necha mol bo'ladi?", mustMention: ['0,5|0.5', '40'] },
  { id: 's6-14', grade: 8, locale: 'uz', type: 'definition', lesson: 'c3-s02', question: "Kovalent bog'lanish nima?", mustMention: ['elektron|электрон'] },
  { id: 's6-15', grade: 11, locale: 'ru', type: 'calc', lesson: 'c4-s05', question: 'К 100 г 20%-го раствора добавили 100 г воды. Какова массовая доля вещества в новом растворе?', mustMention: ['10'] },
]

/* ============================================================== runner (tag s6) */

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
  const tag = arg('tag', 's6')
  const modes = arg('modes', 'chat,voice').split(',').filter((m): m is Mode => m === 'chat' || m === 'voice')
  await preloadKnowledge()
  const status = getKnowledgeStatus()
  const byIdQ = new Map(SELF_R6.map((q) => [q.id, q]))
  const items: Awaited<ReturnType<typeof runChat>>[] = []
  for (const mode of modes) {
    const answered = new Map<string, { text: string }>()
    for (const q of SELF_R6) {
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

if (process.argv[1] && path.basename(process.argv[1]) === 'selfcheck-r6.mts') await main()
