/**
 * npx tsx scripts/brain/probe-retrieve.mts [«вопрос» …] — что находит поиск мозга (без LLM): источники, баллы,
 * уверенность и что уйдёт в подсказку модели. Без аргументов — набор контрольных вопросов (тема, омонимы, «как получить»).
 *   --json — машинный вывод (для сравнения до/после).
 */
import { createBrain } from '../../brain/server.ts'
import { retrieve } from '../../brain/pipeline/retrieve.ts'
import { normalizeInput, cmpForm } from '../../brain/pipeline/normalize.ts'
import { wantsEncyclopedia, questionType, classifyIntent } from '../../brain/pipeline/intent.ts'
import { runTools } from '../../brain/pipeline/tools.ts'

const DEFAULT_QS = [
  'Почему небо голубое?',
  'Как получить кислород?',
  'Как получить кислород в лаборатории?',
  'Как получают водород?',
  'Что такое катализатор?',
  'Почему железо ржавеет?',
  'Кто открыл кислород?',
  'Свойства натрия',
  'How is oxygen produced?',
  'Kislorod qanday olinadi?',
]

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const asJson = process.argv.includes('--json')
const qs = args.length ? args : DEFAULT_QS
const brain = createBrain({ llm: null })
await brain.deps.journal.buildIndex()
const out: unknown[] = []
for (const q of qs) {
  const norm = normalizeInput(q, 'auto')
  const cmp = cmpForm(norm.text)
  const qtype = questionType(cmp)
  const intent = classifyIntent(norm.text, cmp).intent
  const wantEnc = wantsEncyclopedia(cmp) || qtype === 'who' || intent === 'offtopic'
  const r = await retrieve(norm.text, norm.lang, { gradeId: 'g9' }, wantEnc, { kb: brain.deps.kb, journal: brain.deps.journal, embeds: null, llm: null, config: brain.deps.config })
  const tools = runTools(norm.text, cmp, norm.lang, brain.deps.kb).map((t) => t.tool)
  const row = {
    q,
    confR: Math.round(r.confR * 100) / 100,
    tools,
    items: r.items.map((c) => ({ title: c.title.slice(0, 70), type: c.type, src: c.source.slice(0, 30), score: Math.round(c.score * 100) / 100 })),
  }
  out.push(row)
  if (!asJson) {
    console.log(`\n«${q}»  conf_r=${row.confR} tools=[${tools.join(',')}]`)
    for (const it of row.items) console.log(`   ${it.score.toFixed(2)}  [${it.type}] ${it.title}  · ${it.src}`)
    if (!row.items.length) console.log('   (ничего подходящего — модель отвечает из своих знаний)')
    if (process.argv.includes('--why')) for (const d of r.droppedTop) console.log(`   ✗ ${d.title} — ${d.why}`)
  }
}
if (asJson) console.log(JSON.stringify(out, null, 1))
