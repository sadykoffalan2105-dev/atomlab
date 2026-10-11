/**
 * npx tsx scripts/brain/probe-retrieve.mts [«вопрос» …] — что находит поиск мозга (без LLM): источники, ярусы, баллы,
 * уверенность и что уйдёт в подсказку модели. Без аргументов — набор контрольных вопросов (тема, омонимы, «как получить»).
 *   --grade=g7      — класс ученика (по умолчанию g9);
 *   --topic=…       — тема диалога по-русски (как от DIALOG: дописывается к запросу на уточнениях);
 *   --entities=Na,… — сущности диалога; --followup=switch_entity — тип уточнения (по умолчанию none, с темой — switch_entity);
 *   --scope=school|broad|offtopic — охват (по умолчанию — classifyScope); --items=N --chars=N — бюджет подсказки;
 *   --json — машинный вывод (для сравнения до/после);  --why — что отброшено проверкой темы.
 */
import { createBrain } from '../../brain/server.ts'
import { retrieveV2 } from '../../brain/pipeline/retrieve.ts'
import { normalizeInput, cmpForm } from '../../brain/pipeline/normalize.ts'
import { classifyIntent, classifyScope, questionKind } from '../../brain/pipeline/intent.ts'
import { runTools } from '../../brain/pipeline/tools.ts'
import type { FollowUp, GradeId, Scope } from '../../brain/pipeline/dialogTypes.ts'

const DEFAULT_QS = [
  'Почему небо голубое?',
  'Как получить кислород?',
  'Как получить кислород в лаборатории?',
  'Как получают водород?',
  'Что такое катализатор?',
  'Что такое валентность?',
  'Почему железо ржавеет?',
  'Кто открыл кислород?',
  'Свойства натрия',
  'What is a mole?',
  'How is oxygen produced?',
  'Kislorod qanday olinadi?',
  'Valentlik nima?',
]

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const asJson = process.argv.includes('--json')
const qs = args.length ? args : DEFAULT_QS
const grade = (arg('grade') ?? 'g9') as GradeId
const topic = arg('topic') ?? null
const entities = arg('entities')?.split(',').filter(Boolean) ?? []
const followUp = (arg('followup') ?? (topic ? 'switch_entity' : 'none')) as FollowUp
const brain = createBrain({ llm: null })
await brain.deps.journal.buildIndex()
const { kb, journal, config } = brain.deps
const out: unknown[] = []
for (const q of qs) {
  const norm = normalizeInput(q, 'auto')
  const cmp = cmpForm(norm.text)
  const intent = classifyIntent(norm.text, cmp).intent
  const kind = questionKind(cmp, norm.text)
  const sc = classifyScope(norm.text, cmp, norm.lang, kb)
  const scope = (arg('scope') as Scope | undefined) ?? (intent === 'offtopic' ? 'offtopic' : sc.scope)
  const r = await retrieveV2(
    {
      query: { text: norm.text, lang: norm.lang, topic, entities, grade, scope, kind, lengthClass: 'normal', followUp, resolvedBy: 'none', original: q },
      ctx: { gradeId: grade },
      profile: 'laptop',
      budgetChars: Number(arg('chars') ?? config.prompt.chatChars),
      maxItems: Number(arg('items') ?? config.hybrid.topK),
    },
    { kb, journal, embeds: null, llm: null, config },
  )
  const tools = runTools(norm.text, cmp, norm.lang, kb).map((t) => t.tool)
  const row = {
    q,
    kind,
    scope,
    scopeWhy: sc.why,
    scopeUsed: r.scopeUsed,
    schoolHit: r.schoolHit,
    confR: Math.round(r.confR * 100) / 100,
    tools,
    items: r.items.map((c) => ({ title: c.title.slice(0, 70), type: c.type, src: c.source.slice(0, 30), sourceKind: c.sourceKind, tier: c.tier, score: Math.round(c.score * 100) / 100 })),
  }
  out.push(row)
  if (!asJson) {
    console.log(`\n«${q}»  kind=${kind} scope=${scope}(${sc.why})→${r.scopeUsed} school=${r.schoolHit ? 'да' : 'нет'} conf_r=${row.confR} tools=[${tools.join(',')}]`)
    for (const it of row.items) console.log(`   ${it.score.toFixed(2)}  t${it.tier} ${it.sourceKind.padEnd(14)} [${it.type}] ${it.title}  · ${it.src}`)
    if (!row.items.length) console.log('   (ничего подходящего — модель отвечает из своих знаний)')
    if (process.argv.includes('--why')) for (const d of r.droppedTop) console.log(`   ✗ ${d.title} — ${d.why}`)
  }
}
if (asJson) console.log(JSON.stringify(out, null, 1))
