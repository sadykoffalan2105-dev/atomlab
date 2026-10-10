import fs from 'node:fs'
process.env.BRAIN_DATA_DIR ??= 'C:/Users/A2AF~1/AppData/Local/Temp/claude/C--Users--------Desktop------/9c00e9d5-7100-46be-b800-2b4d9ce0829e/scratchpad/bd1'
const { createBrain } = await import('../../brain/server.ts')
const { runChat } = await import('../../brain/pipeline/chat.ts')
const brain = createBrain({ llm: null })
await brain.deps.journal.buildIndex()
const file = process.argv[2] ?? 'C:/Users/A2AF~1/AppData/Local/Temp/claude/C--Users--------Desktop------/9c00e9d5-7100-46be-b800-2b4d9ce0829e/scratchpad/qs.txt'
const qs = fs.readFileSync(file, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean)
for (const q of qs) {
  let meta: unknown
  const d = await runChat(
    { sessionId: 'try', lang: 'auto', stream: true, messages: [{ role: 'user', content: q }], context: { gradeId: 'g8', mode: 'chat', detail: 'brief' } },
    { ...brain.deps, noJournal: true },
    { meta: (m) => (meta = m), delta: () => {}, done: () => {}, error: (e) => console.log('ERR', e) },
  )
  console.log('\n=== ', q, JSON.stringify(meta))
  console.log(d.text)
  console.log('--', d.source, d.confidence, d.confidenceLabel, d.citations.join(' '), d.ms + 'ms')
}
