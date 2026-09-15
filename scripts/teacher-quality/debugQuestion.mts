/**
 * Debug gold questions: resolved query, top candidate sentences of the composer, chat/voice answers.
 *   npx tsx scripts/teacher-quality/debugQuestion.mts g8-10 g11-01 [--hits] [--cands N]
 */
import fs from 'node:fs'
import { goldById as goldOnly } from './goldQuestions.mts'
import { HOLDOUT_R3 } from './holdout-r3.mts'
import { HOLDOUT_R4 } from './holdout-r4.mts'
const goldById = (id: string) => goldOnly(id) ?? HOLDOUT_R3.find((q) => q.id === id) ?? HOLDOUT_R4.find((q) => q.id === id)
import { preloadKnowledge } from '../../src/learn/kb/index.ts'
import { retrieveForTeacher } from '../../src/learn/teacherKnowledge.ts'
import { resolveTurn } from '../../src/learn/brain/dualMode/followUps.ts'
import { composeLocalAnswer } from '../../src/learn/brain/dualMode/localAnswerComposer.ts'

const argv = process.argv.slice(2)
const flag = (n: string) => argv.includes(`--${n}`)
const candN = Number(argv[argv.indexOf('--cands') + 1] ?? 0) || (flag('cands') ? 10 : 0)
const ids = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--cands')
const sections = JSON.parse(fs.readFileSync('src/data/kb/corpus/kb-sections.json', 'utf8'))
await preloadKnowledge()
for (const id of ids) {
  const q = goldById(id)
  if (!q) continue
  const parent = q.followUpOf ? goldById(q.followUpOf) : undefined
  const [chapterId = '', sectionId = ''] = q.lesson?.split('-') ?? []
  const g = sections[`g${q.grade}`]
  const rows = Array.isArray(g) ? g : (g?.appSections ?? [])
  const sectionTitle = rows.find((r: { id: string }) => r.id === q.lesson)?.title ?? ''
  const resolved = resolveTurn(q.question, parent ? [parent.question] : [], q.locale, sectionTitle)
  console.log(`\n===== ${q.id} [${q.locale}] ${q.question} → «${resolved.query}» ${JSON.stringify(resolved.style)} §«${sectionTitle}»`)
  for (const mode of ['chat', 'voice'] as const) {
    const style = mode === 'chat' ? { ...resolved.style, detail: resolved.style.detail ?? ('brief' as const), maxWords: resolved.style.detail === 'more' ? 140 : 80, channel: 'chat' as const } : resolved.style
    const k = await retrieveForTeacher(resolved.query, {
      locale: q.locale, gradeId: `g${q.grade}`, chapterId, sectionId, sectionTitle,
      limit: mode === 'chat' ? 8 : style.detail === 'more' ? 8 : 6, maxChars: mode === 'chat' ? 6000 : 3600,
    })
    if (mode === 'chat' && flag('hits')) for (const h of k.hits) console.log(`  - ${h.type} ${h.score?.toFixed(1)} ${h.title.slice(0, 60)} ${h.citation} :: ${h.text.slice(0, 160).replace(/\n/g, ' ⏎ ')}`)
    const c = composeLocalAnswer({
      query: resolved.query, hits: k.hits, lang: q.locale, style, topicHint: sectionTitle, seed: 0, suggestSmartAi: true,
      debug: mode === 'chat' && candN ? (cands) => {
        for (const x of cands.slice(0, candN) as Array<Record<string, unknown>>) {
          const flags = Object.entries(x).filter(([k2, v]) => v === true).map(([k2]) => k2).join(',')
          console.log(`   ${Number(x.score).toFixed(2)} h${x.hitIndex} ov${Number(x.overlap).toFixed(2)} [${flags}] ${String(x.text).slice(0, 150)}`)
        }
      } : undefined,
    })
    console.log(`  [${mode}] ${c.confident ? '✓' : '·'} ${c.text}`)
  }
}
