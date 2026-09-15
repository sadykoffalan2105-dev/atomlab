/**
 * Answer harness: asks every GOLD question through the SAME code the app uses for local (no-LLM) answers
 * and saves the answers for autoScore.mts.
 *
 *   chat  — composeLocalTeacherReply (src/learn/learnTeacherRouter.ts), as LearnAssistantPanel calls it;
 *   voice — TrainingModeEngine.answer with smartAi=false (src/learn/brain/dualMode/trainingModeEngine.ts),
 *           i.e. the live voice teacher's local composer path.
 *
 * Context is realistic: the student sits on the lesson where the topic is taught (--ctx lesson, default)
 * or only the grade is known (--ctx grade). Follow-ups reuse the parent question and the answer the same
 * mode gave to it. All KB shards are preloaded first so results do not depend on background loading.
 *
 *   npx tsx scripts/teacher-quality/runAnswers.mts --tag baseline [--ctx lesson|grade] [--modes chat,voice] [--only g8-01,fu-01]
 *
 * Output: .smoke/answer-quality/answers-<tag>.json
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { GOLD_QUESTIONS, goldById, type GoldQuestion } from './goldQuestions.mts'
import { preloadKnowledge, getKnowledgeStatus } from '../../src/learn/kb/index.ts'
import { composeLocalTeacherReply } from '../../src/learn/learnTeacherRouter.ts'
import { retrieveForTeacher, type TeacherKnowledgeHit } from '../../src/learn/teacherKnowledge.ts'
import { isSubstantiveQuestion, resolveTurn } from '../../src/learn/brain/dualMode/followUps.ts'
import { TrainingModeEngine } from '../../src/learn/brain/dualMode/trainingModeEngine.ts'
import type { LearnLocalAssistantContext } from '../../src/learn/learnLocalAssistant.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT_DIR = path.join(ROOT, '.smoke', 'answer-quality')

const args = process.argv.slice(2)
const arg = (name: string, def?: string) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1]! : def
}
const tag = arg('tag', 'baseline')!
const ctxMode = arg('ctx', 'lesson') === 'grade' ? 'grade' : 'lesson'
const modes = (arg('modes', 'chat,voice') ?? 'chat,voice').split(',').filter((m): m is Mode => m === 'chat' || m === 'voice')
const only = arg('only')?.split(',').map((s) => s.trim()).filter(Boolean)

export type Mode = 'chat' | 'voice'

export interface SavedHit {
  title: string
  citation?: string
  type?: string
  score?: number
  text: string
}

export interface AnswerRecord {
  id: string
  mode: Mode
  question: string
  /** Parent question for follow-ups. */
  parentQuestion?: string
  /** Query after follow-up resolution (what was searched). */
  query: string
  /** What the student sees (text + citation chips line). */
  answer: string
  /** Answer without the citations line (what is spoken). */
  text: string
  citations: string[]
  confident: boolean
  ms: number
  context: { gradeId: string; chapterId: string; sectionId: string; sectionTitle: string }
  hits: SavedHit[]
}

export interface AnswersFile {
  tag: string
  generatedAt: string
  ctxMode: 'lesson' | 'grade'
  modes: Mode[]
  kb: { shards: string[]; docs: number }
  items: AnswerRecord[]
}

/* ------------------------------------------------------------ section titles */

type SectionRow = { id: string; title: string }
const sectionsFile = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/kb/corpus/kb-sections.json'), 'utf8')) as Record<
  string,
  SectionRow[] | { appSections?: SectionRow[] }
>

function sectionTitle(grade: number, lesson: string | undefined): string {
  if (!lesson) return ''
  const g = sectionsFile[`g${grade}`]
  const rows = Array.isArray(g) ? g : (g?.appSections ?? [])
  return rows.find((r) => r.id === lesson)?.title ?? ''
}

function contextFor(q: GoldQuestion) {
  const [chapterId = '', sectionId = ''] = ctxMode === 'lesson' && q.lesson ? q.lesson.split('-') : []
  return {
    gradeId: `g${q.grade}`,
    chapterId,
    sectionId,
    sectionTitle: ctxMode === 'lesson' ? sectionTitle(q.grade, q.lesson) : '',
  }
}

function saveHits(hits: readonly TeacherKnowledgeHit[]): SavedHit[] {
  return hits.slice(0, 6).map((h) => ({
    title: h.title,
    citation: h.citation,
    type: h.type,
    score: h.score === undefined ? undefined : Math.round(h.score * 100) / 100,
    text: h.text.slice(0, 900),
  }))
}

const stripCitations = (s: string) => s.replace(/\n\n(\[[^\]]+\]\s*)+$/u, '').trim()

/* ------------------------------------------------------------------- runners */

async function runChat(q: GoldQuestion, parent: { question: string; answer: string } | null): Promise<AnswerRecord> {
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
  // Same resolution + same (cached) retrieval as inside composeLocalTeacherReply — for scoring only.
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
    id: q.id,
    mode: 'chat',
    question: q.question,
    parentQuestion: parent?.question,
    query: resolved.query,
    answer: res.text,
    text: stripCitations(res.text),
    citations: res.citations,
    confident: res.confident,
    ms,
    context: c,
    hits: saveHits(k.hits),
  }
}

async function runVoice(q: GoldQuestion, parent: { question: string; answer: string } | null): Promise<AnswerRecord> {
  const c = contextFor(q)
  const engine = new TrainingModeEngine({
    lang: q.locale,
    gradeId: c.gradeId,
    chapterId: c.chapterId,
    sectionId: c.sectionId || undefined,
    sectionTitle: c.sectionTitle || undefined,
  })
  // Deterministic check-question wording (the engine seeds it with Math.random()).
  ;(engine as unknown as { seed: number }).seed = 0
  const t0 = performance.now()
  const res = await engine.answer({
    text: q.question,
    history: parent
      ? [
          { role: 'user', content: parent.question },
          { role: 'assistant', content: parent.answer },
        ]
      : [],
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
    id: q.id,
    mode: 'voice',
    question: q.question,
    parentQuestion: parent?.question,
    query: res.resolved.query,
    answer: res.display,
    text: res.text,
    citations: res.citations,
    confident: res.confident,
    ms,
    context: c,
    hits: saveHits(k.hits),
  }
}

/* ---------------------------------------------------------------------- main */

async function main(): Promise<void> {
  const t0 = performance.now()
  await preloadKnowledge()
  const status = getKnowledgeStatus()
  console.log(`[answers] KB loaded: ${status.shards.join(',')} docs=${status.docs} in ${Math.round(performance.now() - t0)} ms`)

  let questions = GOLD_QUESTIONS
  if (only?.length) {
    const want = new Set(only)
    // Follow-ups need their parent answered first.
    for (const id of only) {
      const p = goldById(id)?.followUpOf
      if (p) want.add(p)
    }
    questions = GOLD_QUESTIONS.filter((q) => want.has(q.id))
  }
  const ordered = [...questions.filter((q) => !q.followUpOf), ...questions.filter((q) => q.followUpOf)]

  const items: AnswerRecord[] = []
  for (const mode of modes) {
    const byId = new Map<string, AnswerRecord>()
    for (const q of ordered) {
      const parentRec = q.followUpOf ? byId.get(q.followUpOf) : undefined
      const parentGold = q.followUpOf ? goldById(q.followUpOf) : undefined
      const parent = parentGold ? { question: parentGold.question, answer: parentRec?.text ?? '' } : null
      try {
        const rec = mode === 'chat' ? await runChat(q, parent) : await runVoice(q, parent)
        byId.set(q.id, rec)
        items.push(rec)
        const flat = rec.text.replace(/\s+/g, ' ')
        console.log(`  ${mode.padEnd(5)} ${q.id.padEnd(7)} ${String(rec.ms).padStart(4)} ms ${rec.confident ? '✓' : '·'} ${flat.slice(0, 110)}`)
      } catch (error) {
        console.error(`  ${mode} ${q.id} FAILED: ${(error as Error)?.stack ?? error}`)
        items.push({
          id: q.id,
          mode,
          question: q.question,
          parentQuestion: parent?.question,
          query: q.question,
          answer: '',
          text: '',
          citations: [],
          confident: false,
          ms: -1,
          context: contextFor(q),
          hits: [],
        })
      }
    }
  }

  // Keep the gold order in the file (easier to diff between tags).
  const order = new Map(GOLD_QUESTIONS.map((q, i) => [q.id, i]))
  items.sort((a, b) => (a.mode === b.mode ? order.get(a.id)! - order.get(b.id)! : a.mode.localeCompare(b.mode)))

  const out: AnswersFile = {
    tag,
    generatedAt: new Date().toISOString(),
    ctxMode,
    modes,
    kb: { shards: status.shards, docs: status.docs },
    items,
  }
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const file = path.join(OUT_DIR, `answers-${tag}.json`)
  fs.writeFileSync(file, JSON.stringify(out, null, 2) + '\n')
  console.log(`[answers] ${items.length} answers → ${path.relative(ROOT, file)} (${Math.round(performance.now() - t0)} ms)`)
}

await main()
