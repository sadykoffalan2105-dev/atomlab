/**
 * HOLDOUT r8 (fresh generalization check for the local AI teacher, judge round 8).
 *
 * 20 NEW questions that are in none of goldQuestions.mts, holdout-r3/r4/r5/r6/r7.mts, selfcheck-r6/r7.mts:
 * grades 7–11, all question types (definition, why, how, compare, example, calc incl. the molar mass of a
 * single-element substance), 3 English + 3 Uzbek, 2 follow-up pairs (h8-04 → h8-05, h8-13 → h8-14).
 * Every expected fact was grepped in src/data/kb/corpus (chunk / card ids in `source`).
 * The composer was NOT tuned on these questions — do not add rules for them; write a new holdout set instead.
 *
 * Same code paths as runAnswers.mts (chat = composeLocalTeacherReply, voice = TrainingModeEngine.answer with
 * smartAi=false, ctx lesson); output .smoke/answer-quality/answers-<tag>.json in the same format:
 *
 *   npx tsx scripts/teacher-quality/holdout-r8.mts [--tag h8] [--modes chat,voice]
 *   npx tsx scripts/teacher-quality/autoScore.mts --tag h8 --questions holdout-r8.mts#HOLDOUT_R8 --gold-tag r8
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

export const HOLDOUT_R8: GoldQuestion[] = [
  /* ---------------------------------------------------------------- ru singles */
  {
    id: 'h8-01', grade: 7, locale: 'ru', type: 'definition', lesson: 'c1-s05',
    source: 'Kimyo 7 §1.5 (g7-c1-s05-d01: «Вещество – однородное по составу и свойствам по всему объему, называют чистым веществом»)',
    question: 'Что такое чистое вещество?',
    mustMention: ['однородн|постоянн|один состав', 'состав|свойств'],
  },
  {
    id: 'h8-02', grade: 7, locale: 'ru', type: 'why', lesson: 'c4-s04',
    source: 'Kimyo 7 §4.4 (g7-c4-s04-t05: «…либо вытеснив воду, так как кислород очень плохо растворяется в воде»)',
    question: 'Почему кислород можно собирать вытеснением воды?',
    mustMention: ['раствор'],
  },
  {
    id: 'h8-03', grade: 7, locale: 'ru', type: 'calc', lesson: 'c2-s07',
    source: 'Kimyo 7 §2.7 (g7-c2-s07-t04: «Mr (H2SO4) = 2·Ar(H) + Ar(S) + 4·Ar(O) = 98»)',
    question: 'Чему равна относительная молекулярная масса серной кислоты H2SO4?',
    mustMention: ['98'],
  },
  {
    id: 'h8-04', grade: 7, locale: 'ru', type: 'definition', lesson: 'c6-s06',
    source: 'Kimyo 7 §6.6 (g7-c6-s06-d01: «Реакции, в которых два сложных вещества обмениваются компонентами, называются реакциями обмена»)',
    question: 'Что такое реакция обмена?',
    mustMention: ['обмен', 'сложных вещества|компонент'],
  },
  {
    id: 'h8-05', grade: 7, locale: 'ru', type: 'example', lesson: 'c6-s06', followUpOf: 'h8-04',
    source: 'Kimyo 7 §6.6 (g7-c6-s06-t01: HCl + NaOH); cards card-reaction-naoh-hcl («NaOH + HCl → NaCl + H₂O»), card-reaction-koh-hcl',
    question: 'Приведи пример',
    mustMention: ['NaOH|KOH|HCl|NaCl|KCl'],
  },
  {
    id: 'h8-06', grade: 8, locale: 'ru', type: 'calc', lesson: 'c5-s04',
    source: 'Ar(Zn) = 65 (таблица Ar в composer/периодическая таблица) → M(Zn) = 65 г/моль; cards deep-mole-calculations, faq-005',
    question: 'Чему равна молярная масса цинка?',
    mustMention: ['65', 'г/моль|g/mol'],
  },
  {
    id: 'h8-07', grade: 8, locale: 'ru', type: 'definition', lesson: 'c4-s05',
    source: 'Kimyo 8 §25 (g8-p25-t01/t02: «В равных объемах различных газов при одинаковых условиях содержится одинаковое число молекул»)',
    question: 'Что такое закон Авогадро?',
    mustMention: ['одинаков|равн', 'молекул', 'объём|объем'],
  },
  {
    id: 'h8-08', grade: 9, locale: 'ru', type: 'definition', lesson: 'c1-s02',
    source: 'Kimyo 9 §24 (g9-p24-t01: «Жесткая вода – это вода, содержащая большое количество ионов Ca2+ и Mg2+»)',
    question: 'Что такое жёсткая вода?',
    mustMention: ['Ca|кальц', 'Mg|магни'],
  },
  {
    id: 'h8-09', grade: 9, locale: 'ru', type: 'compare', lesson: 'c1-s02',
    source: 'Kimyo 9 §24 (g9-p24-t02: «Временная жесткость связана с наличием в воде гидрокарбонатов кальция и магния… Постоянная жесткость связана с наличием в воде сульфатов и хлоридов»)',
    question: 'Чем временная жёсткость воды отличается от постоянной?',
    mustMention: ['гидрокарбонат', 'сульфат|хлорид'],
  },
  {
    id: 'h8-10', grade: 9, locale: 'ru', type: 'why', lesson: 'c1-s01',
    source: 'Kimyo 9 §23 (g9-p23-t04: «…потому что на внешнем электронном слое атомов этих металлов на один электрон больше, чем у щелочных»)',
    question: 'Почему металлические свойства кальция и магния выражены слабее, чем у щелочных металлов?',
    mustMention: ['электрон', 'внешн|больше'],
  },
  {
    id: 'h8-11', grade: 10, locale: 'ru', type: 'definition', lesson: 'c2-s12',
    source: 'cards faq-009 («Полимеры — большие молекулы из повторяющихся звеньев (мономеров)»), polymers-biochem',
    question: 'Что такое полимеры?',
    mustMention: ['больш|высокомолекуляр|макромолекул', 'звен|мономер|повторя'],
  },
  {
    id: 'h8-12', grade: 10, locale: 'ru', type: 'how', lesson: 'c2-s11',
    source: 'Kimyo 10 §2.11 (g10-c2-s11-t02: «Дивинил и изопрен полимеризуются и сополимеризуются … с образованием каучуков»)',
    question: 'Как получают каучук?',
    mustMention: ['полимериз', 'дивинил|изопрен|бутадиен'],
  },
  /* ------------------------------------------------------------ follow-up pair B */
  {
    id: 'h8-13', grade: 11, locale: 'ru', type: 'definition', lesson: 'c6-s02',
    source: 'cards faq-035 («Принцип Ле Шателье: воздействие смещает равновесие так, чтобы ослабить это воздействие»), kinetics-equilibrium, faq-006',
    question: 'Что такое принцип Ле Шателье?',
    mustMention: ['равновес', 'воздейств|смещ|ослаб'],
  },
  {
    id: 'h8-14', grade: 11, locale: 'ru', type: 'how', lesson: 'c6-s02', followUpOf: 'h8-13',
    source: 'cards faq-035 («↑T → эндотермическая сторона»), kinetics-equilibrium; Kimyo 11 §26 (факторы, влияющие на равновесие)',
    question: 'А что будет при повышении температуры?',
    mustMention: ['эндотерм|смещ|равновес'],
  },
  /* --------------------------------------------------------------------- en */
  {
    id: 'h8-15', grade: 7, locale: 'en', type: 'definition', lesson: 'c2-s06',
    source: 'card faq-014 («Валентность — способность атома образовывать определенное число связей»); glossary «валентность» → valence/valency',
    question: 'What is valency?',
    mustMention: ['atom', 'bond|combin|valence'],
  },
  {
    id: 'h8-16', grade: 8, locale: 'en', type: 'compare', lesson: 'c1-s04',
    source: 'Kimyo 8 §2 / Kimyo 7 §5.4 (кислоты — водород + кислотный остаток; основания — металл + гидроксогруппа OH); glossary «основание» → base',
    question: 'What is the difference between an acid and a base?',
    mustMention: ['hydrogen|H', 'hydroxide|OH|metal'],
  },
  {
    id: 'h8-17', grade: 8, locale: 'en', type: 'calc', lesson: 'c5-s05',
    source: 'M(H₂SO₄) = 98 г/моль (Kimyo 7 §2.7) → n = m/M = 49 / 98 = 0,5 моль; cards deep-mole-calculations',
    question: 'How many moles are in 49 g of sulfuric acid H2SO4?',
    mustMention: ['0.5|0,5', '98'],
  },
  /* --------------------------------------------------------------------- uz */
  {
    id: 'h8-18', grade: 10, locale: 'uz', type: 'definition', lesson: 'c2-s12',
    source: 'cards faq-009, polymers-biochem («Полимеры — большие молекулы из повторяющихся звеньев (мономеров)»); glossary «полимер» → polimer',
    question: 'Polimer nima?',
    mustMention: ['molekula|polimer', "bo'g'in|monomer|takrorlan|katta"],
  },
  {
    id: 'h8-19', grade: 8, locale: 'uz', type: 'calc', lesson: 'c5-s04',
    source: 'Ar(Mg) = 24 → M(Mg) = 24 g/mol; n = m/M = 48 / 24 = 2 mol; cards deep-mole-calculations',
    question: "48 g magniy (Mg) necha mol bo'ladi?",
    mustMention: ['2', '24'],
  },
  {
    id: 'h8-20', grade: 7, locale: 'uz', type: 'example', lesson: 'c6-s06',
    source: 'Kimyo 7 §6.6 (g7-c6-s06-d01/t01: реакции обмена, HCl + NaOH); cards card-reaction-naoh-hcl, card-reaction-koh-hcl',
    question: 'Almashinish reaksiyasiga misol keltiring',
    mustMention: ['NaOH|KOH|HCl|NaCl|KCl|H2O|H₂O'],
  },
]

/* ============================================================== runner (tag h8) */

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
  const tag = arg('tag', 'h8')
  const modes = arg('modes', 'chat,voice').split(',').filter((m): m is Mode => m === 'chat' || m === 'voice')
  await preloadKnowledge()
  const status = getKnowledgeStatus()
  const byIdQ = new Map(HOLDOUT_R8.map((q) => [q.id, q]))
  const items: Awaited<ReturnType<typeof runChat>>[] = []
  for (const mode of modes) {
    const answered = new Map<string, { text: string }>()
    for (const q of HOLDOUT_R8) {
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

if (process.argv[1] && path.basename(process.argv[1]) === 'holdout-r8.mts') await main()
