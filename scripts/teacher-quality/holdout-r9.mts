/**
 * HOLDOUT r9 (fresh generalization check for the local AI teacher, judge round 9).
 *
 * 20 NEW questions that are in none of goldQuestions.mts, holdout-r3..r8.mts, selfcheck-r6/r7/r9.mts:
 * grades 7–11, all question types (definition, why, how, compare, example, calc incl. the water mass for a
 * solution and an element mass fraction), 3 English + 3 Uzbek, 2 follow-up pairs (h9-04 → h9-05, h9-07 → h9-08).
 * Every expected fact was grepped in src/data/kb/corpus (chunk / card ids in `source`).
 * The composer was NOT tuned on these questions — do not add rules for them; write a new holdout set instead.
 *
 * Same code paths as runAnswers.mts (chat = composeLocalTeacherReply, voice = TrainingModeEngine.answer with
 * smartAi=false, ctx lesson); output .smoke/answer-quality/answers-<tag>.json in the same format:
 *
 *   npx tsx scripts/teacher-quality/holdout-r9.mts [--tag h9] [--modes chat,voice]
 *   npx tsx scripts/teacher-quality/autoScore.mts --tag h9 --questions holdout-r9.mts#HOLDOUT_R9 --gold-tag r9
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

export const HOLDOUT_R9: GoldQuestion[] = [
  /* ---------------------------------------------------------------- ru singles */
  {
    id: 'h9-01', grade: 7, locale: 'ru', type: 'why', lesson: 'c5-s06',
    source: 'Kimyo 7 §5.6 (g7-c5-s06-t02: «водород в 14,5 раз легче воздуха. Поэтому, чтобы наполнить пробирку водородом, необходимо держать ее вверх дном»)',
    question: 'Почему пробирку для сбора водорода держат вверх дном?',
    mustMention: ['легч|легк'],
  },
  {
    id: 'h9-02', grade: 7, locale: 'ru', type: 'how', lesson: 'c1-s05',
    source: 'Kimyo 7 §1.5 (g7-c1-s05-t06: «Перегонку применяют … для разделения смесей жидких веществ с разными температурами кипения»)',
    question: 'Как разделить смесь жидкостей с разными температурами кипения?',
    mustMention: ['перегон|дистилл'],
  },
  {
    id: 'h9-03', grade: 7, locale: 'ru', type: 'calc', lesson: 'c2-s07',
    source: 'Kimyo 7 §2.7/§2.11 (Mr = сумма Ar; g7-c2-s11-t05) → Mr(NH3) = 14 + 3·1 = 17',
    question: 'Чему равна относительная молекулярная масса аммиака NH3?',
    mustMention: ['17'],
  },
  /* ------------------------------------------------------------ follow-up pair A */
  {
    id: 'h9-04', grade: 11, locale: 'ru', type: 'definition', lesson: 'c5-s02',
    source: 'Kimyo 11 (g11-c5-s02-d02: «Вещества, замедляющие скорость химической реакции, называются ингибиторами»); Kimyo 8 §33 (g8-p33-d01)',
    question: 'Что такое ингибиторы?',
    mustMention: ['замедл|снижа', 'скорост|реакц'],
  },
  {
    id: 'h9-05', grade: 11, locale: 'ru', type: 'compare', lesson: 'c5-s02', followUpOf: 'h9-04',
    source: 'Kimyo 11 (g11-c5-s02-d01: катализаторы ускоряют и не расходуются; d02: ингибиторы замедляют); Kimyo 8 §33 (g8-p33-d01)',
    question: 'А чем они отличаются от катализаторов?',
    mustMention: ['ускор', 'замедл|снижа'],
  },
  {
    id: 'h9-06', grade: 8, locale: 'ru', type: 'how', lesson: 'c4-s09',
    source: 'Kimyo 8 §37 (g8-p37-t01: «NH4Cl + NaOH = NaCl + H2O + NH3 … накаливания смеси хлорида аммония и гашеной извести: 2NH4Cl + Ca(OH)2 = …»)',
    question: 'Как получают аммиак в лаборатории?',
    mustMention: ['NH4Cl|хлорид аммония|хлорида аммония', 'Ca(OH)2|NaOH|гашен|щёлоч|щелоч'],
  },
  /* ------------------------------------------------------------ follow-up pair B */
  {
    id: 'h9-07', grade: 9, locale: 'ru', type: 'definition', lesson: 'c7-s04',
    source: 'Kimyo 9 §9 (g9-p09-d01: «Поглощение жидкостью или поверхностью твердых веществ молекул, атомов, ионов другого вещества называется адсорбцией»; t02 «Адсорбция – поглощение одного вещества поверхностью другого»)',
    question: 'Что такое адсорбция?',
    mustMention: ['поглощ', 'поверхност'],
  },
  {
    id: 'h9-08', grade: 9, locale: 'ru', type: 'example', lesson: 'c7-s04', followUpOf: 'h9-07',
    source: 'Kimyo 9 §9 (g9-p09-t02/t03: «Углерод в виде древесного угля обладает высшими адсорбционными свойствами», активированный уголь); §8 (адсорбент)',
    question: 'Приведи пример',
    mustMention: ['уголь|углерод'],
  },
  {
    id: 'h9-09', grade: 9, locale: 'ru', type: 'why', lesson: 'c1-s04',
    source: 'Kimyo 9 §18 (g9-p18-t07: «поверхность железа покрыта цинком, то металл, образующий защитный слой, становится анодом … Защищаемый металл (железо) является катодом и не будет разрушаться»)',
    question: 'Почему цинковое покрытие защищает железо от коррозии?',
    mustMention: ['анод|активн', 'катод|цинк'],
  },
  {
    id: 'h9-10', grade: 9, locale: 'ru', type: 'calc', lesson: 'c4-s02',
    source: 'm(в-ва) = 200 · 0,05 = 10 г; m(воды) = 200 − 10 = 190 г (как в g9-p19-t17: «m(воды) = 500 – 50 = 450 г»)',
    question: 'Сколько граммов воды нужно для приготовления 200 г 5%-го раствора соли?',
    mustMention: ['190'],
  },
  {
    id: 'h9-11', grade: 10, locale: 'ru', type: 'compare', lesson: 'c3-s11',
    source: 'Kimyo 10 (g10-c3-s11-t03: «Разница между альдегидами и кетонами определяется реакцией «серебряного зеркала» … Способность вступать в реакцию слабее, чем у альдегидов»)',
    question: 'Чем кетоны отличаются от альдегидов?',
    mustMention: ['серебрян|слабее|карбонил'],
  },
  {
    id: 'h9-12', grade: 10, locale: 'ru', type: 'how', lesson: 'c3-s09',
    source: 'Kimyo 10 (g10-c3-s09-t02: «Окисление первичных спиртов. При окислении первичных спиртов образуются альдегиды»)',
    question: 'Как получают альдегиды?',
    mustMention: ['окислен|окисля', 'спирт'],
  },
  {
    id: 'h9-13', grade: 11, locale: 'ru', type: 'definition', lesson: 'c6-s02',
    source: 'Kimyo 11 (g11-c6-s02-d01: «Переход реакционной системы от одного состояния равновесия в другое называется смещением химического равновесия»)',
    question: 'Что такое смещение химического равновесия?',
    mustMention: ['переход', 'состояни|равновес'],
  },
  {
    id: 'h9-14', grade: 8, locale: 'ru', type: 'example', lesson: 'c3-s07',
    source: 'Kimyo 8 §19 (g8-p19-t01: «Реакция натрия с хлором … атомы натрия отдают один электрон»); §4 (g8-p04-t02: «2Na + Cl2 = 2NaCl»)',
    question: 'Приведи пример окислительно-восстановительной реакции',
    mustMention: ['Na|Cl|Zn|Cu|Fe|H2|O2'],
  },
  /* --------------------------------------------------------------------- en */
  {
    id: 'h9-15', grade: 10, locale: 'en', type: 'definition', lesson: 'c3-s20',
    source: 'Kimyo 10 (g10-c3-s20-t03: «Крахмал – растительный полисахарид … (C6H10O5)n»); card faq-030 («крахмал — полисахарид»); glossary «крахмал» → starch',
    question: 'What is starch?',
    mustMention: ['polysaccharide|полисахарид'],
  },
  {
    id: 'h9-16', grade: 11, locale: 'en', type: 'compare', lesson: 'c1-s04',
    source: 'Kimyo 11 (g11-c1-s04-t10/t11: «Кристаллическое состояние более устойчиво, чем аморфное. В кристаллических веществах частицы расположены упорядоченно»)',
    question: 'What is the difference between crystalline and amorphous substances?',
    mustMention: ['order|arrang|stable|упорядоч|устойчив'],
  },
  {
    id: 'h9-17', grade: 8, locale: 'en', type: 'calc', lesson: 'c5-s04',
    source: 'Kimyo 8 §25 (Vm = 22,4 л/моль; V = n·Vm) → V = 0,25 · 22,4 = 5,6 L',
    question: 'What volume do 0.25 mol of carbon dioxide occupy at STP?',
    mustMention: ['5.6|5,6', '22.4|22,4'],
  },
  /* --------------------------------------------------------------------- uz */
  {
    id: 'h9-18', grade: 8, locale: 'uz', type: 'definition', lesson: 'c5-s04',
    source: 'Kimyo 8 §25 (g8-p25-t03: «1 моль любого газа при нормальных условиях занимают объем … 22,4 л, который называется молярным объемом»); glossary «молярный объем» → molyar hajm',
    question: 'Molyar hajm nima?',
    mustMention: ['22,4|22.4', 'gaz|mol|газ'],
  },
  {
    id: 'h9-19', grade: 8, locale: 'uz', type: 'example', lesson: 'c1-s05',
    source: 'Kimyo 8 §2 (g8-p02-t07: «Кислые соли … NaHCO3, Ca(HCO3)2, KHSO4»); glossary «кислая соль» → nordon tuz',
    question: 'Nordon tuzga misol keltiring',
    mustMention: ['NaHCO3|NaHCO₃|KHSO4|KHSO₄|Ca(HCO3)2|NaHSO4|KHCO3'],
  },
  {
    id: 'h9-20', grade: 7, locale: 'uz', type: 'calc', lesson: 'c2-s07',
    source: 'Kimyo 7 §2.11 (g7-c2-s11-t05: ω(E) = n·Ar(E) / Mr) → ω(C) в CH4 = 12 / 16 = 75 %',
    question: 'Metan CH4 tarkibidagi uglerodning massa ulushini hisoblang',
    mustMention: ['75', '16'],
  },
]

/* ============================================================== runner (tag h9) */

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
  const tag = arg('tag', 'h9')
  const modes = arg('modes', 'chat,voice').split(',').filter((m): m is Mode => m === 'chat' || m === 'voice')
  await preloadKnowledge()
  const status = getKnowledgeStatus()
  const byIdQ = new Map(HOLDOUT_R9.map((q) => [q.id, q]))
  const items: Awaited<ReturnType<typeof runChat>>[] = []
  for (const mode of modes) {
    const answered = new Map<string, { text: string }>()
    for (const q of HOLDOUT_R9) {
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

if (process.argv[1] && path.basename(process.argv[1]) === 'holdout-r9.mts') await main()
