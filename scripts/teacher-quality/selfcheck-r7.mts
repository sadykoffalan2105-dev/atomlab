/**
 * SELF-CHECK r7 (fresh generalization check for the local AI teacher, judge round 6).
 *
 * 20 NEW questions that are in none of goldQuestions.mts, holdout-r3/r4/r5.mts, selfcheck-r6.mts: grades 7–11, all
 * question types (definition, why, how, compare, example, calc incl. n=m/M, V=n·Vm, ω), 3 English + 3 Uzbek,
 * 2 follow-up pairs. Every expected fact was grepped in src/data/kb/corpus (chunk ids in `source`).
 * The composer was NOT tuned on these questions — do not add rules for them; write a new holdout set instead.
 *
 * Same code paths as runAnswers.mts (chat = composeLocalTeacherReply, voice = TrainingModeEngine.answer with
 * smartAi=false, ctx lesson); output .smoke/answer-quality/answers-<tag>.json in the same format:
 *
 *   npx tsx scripts/teacher-quality/selfcheck-r7.mts [--tag h6] [--modes chat,voice]
 *   npx tsx scripts/teacher-quality/autoScore.mts --tag h6 --questions selfcheck-r7.mts#SELF_R7
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

export const SELF_R7: GoldQuestion[] = [
  { id: 's7-01', grade: 7, locale: 'ru', type: 'how', lesson: 'c1-s06', source: 'Kimyo 7 §1.6 (фильтрование соли и песка, выпаривание фильтрата)', question: 'Как отделить поваренную соль от песка?', mustMention: ['фильтр|раствор', 'выпарива|выпарить|фильтрат'] },
  { id: 's7-02', grade: 9, locale: 'ru', type: 'compare', lesson: 'c3-s01', source: 'Kimyo 9 §18 (химическая / электрохимическая коррозия)', question: 'Чем химическая коррозия отличается от электрохимической?', mustMention: ['окислител|внешней среды', 'контакт|другим'] },
  { id: 's7-03', grade: 8, locale: 'ru', type: 'compare', lesson: 'c1-s02', source: 'Kimyo 8 §2 (основные, кислотные, амфотерные оксиды)', question: 'Какие бывают оксиды?', mustMention: ['основн', 'кислотн'] },
  { id: 's7-04', grade: 8, locale: 'ru', type: 'example', lesson: 'c5-s01', source: 'cards rx-types (2H₂ + O₂ → 2H₂O)', question: 'Приведи пример реакции соединения', mustMention: ['H2O|H₂O|CaO|CO2|CO₂'] },
  { id: 's7-05', grade: 8, locale: 'ru', type: 'calc', lesson: 'c2-s01', source: 'Ar(S) = 32 → m = 2 моль · 32 г/моль = 64 г', question: 'Какова масса 2 моль серы?', mustMention: ['64'] },
  { id: 's7-06', grade: 9, locale: 'ru', type: 'how', lesson: 'c4-s01', source: 'cards «Качественные реакции» (Cl⁻ + Ag⁺ → AgCl↓ белый осадок)', question: 'Как распознать хлорид-ион в растворе?', mustMention: ['Ag', 'осад|↓'] },
  { id: 's7-07', grade: 9, locale: 'ru', type: 'definition', lesson: 'c2-s03', source: 'Kimyo 9 §10 (оксид углерода(IV), углекислый газ)', question: 'Что такое углекислый газ?', mustMention: ['оксид|CO2|CO₂'] },
  { id: 's7-08', grade: 11, locale: 'ru', type: 'calc', lesson: 'c2-s01', source: 'M(CO₂) = 44 → n = 8,8 г / 44 = 0,2 моль', question: 'Сколько моль составляют 8,8 г углекислого газа?', mustMention: ['0,2|0.2'] },
  { id: 's7-09', grade: 8, locale: 'en', type: 'example', lesson: 'c5-s01', source: 'cards rx-types (Zn + 2HCl → ZnCl₂ + H₂↑)', question: 'Give an example of a substitution reaction', mustMention: ['Zn|Fe|CuSO'] },
  { id: 's7-10', grade: 11, locale: 'uz', type: 'definition', lesson: 'c3-s01', source: 'Kimyo 11 §23 (katalizator — reaksiya tezligini oshiradi)', question: 'Katalizator nima?', mustMention: ['tezl|reaksiya'] },
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
  const byIdQ = new Map(SELF_R7.map((q) => [q.id, q]))
  const items: Awaited<ReturnType<typeof runChat>>[] = []
  for (const mode of modes) {
    const answered = new Map<string, { text: string }>()
    for (const q of SELF_R7) {
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

if (process.argv[1] && path.basename(process.argv[1]) === 'selfcheck-r7.mts') await main()
