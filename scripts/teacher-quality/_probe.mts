// Timing probe: retrieval vs composer for a few gold questions (after preloading all shards).
import { preloadKnowledge } from '../../src/learn/kb/index.ts'
import { retrieveForTeacher } from '../../src/learn/teacherKnowledge.ts'
import { composeLocalAnswer } from '../../src/learn/brain/dualMode/localAnswerComposer.ts'
await preloadKnowledge()
for (const [q, locale, grade] of [['Что такое оксиды?', 'ru', 'g8'], ['Как получают кислород в лаборатории?', 'ru', 'g7'], ['What is a catalyst?', 'en', 'g11'], ['Oksidlar nima?', 'uz', 'g8']] as const) {
  for (let rep = 0; rep < 2; rep++) {
    const t0 = performance.now()
    const k = await retrieveForTeacher(q + ' '.repeat(rep), { locale, gradeId: grade, limit: 8, maxChars: 6000 })
    const t1 = performance.now()
    for (let i = 0; i < 5; i++) composeLocalAnswer({ query: q, hits: k.hits, lang: locale, style: { detail: 'more' } })
    const t2 = performance.now()
    console.log(q, rep, 'retrieve', (t1 - t0).toFixed(1), 'compose/5', ((t2 - t1) / 5).toFixed(1))
  }
}
