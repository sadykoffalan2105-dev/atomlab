import { createBrain } from './brain/server.ts'
import { findConcepts, findElements, findSubstances, findFormulas } from './brain/pipeline/entities.ts'
const brain = createBrain({ llm: null })
const kb = brain.deps.kb
for (const f of ['Al', 'O2', 'H2O', 'H2', 'H2SO4', 'Cu', 'HNO3']) {
  const s = kb.substanceByFormula.get(f)
  console.log(f, s?.id, s?.ru, s?.rec)
}
for (const t of ['а если взять 4 моль водорода, сколько воды?', 'Сколько граммов воды получится из 4 моль водорода по уравнению 2H₂ + O₂ → 2H₂O?', 'Расскажи подробно про серную кислоту', 'В промышленности кислород?', 'Как получают алюминий в промышленности?', 'Почему медь растворяется в азотной кислоте?']) {
  console.log('---', t)
  console.log(' subs', findSubstances(t, kb).map((x) => `${x.item.fa}@${x.index}`))
  console.log(' els', findElements(t, kb).map((x) => `${x.item.s}@${x.index}`))
  console.log(' fs', findFormulas(t, true).map((x) => `${x.ascii}@${x.index}`))
  console.log(' concepts', findConcepts(t).map((c) => c.id))
}
console.log(kb.qa.reactions.filter((r) => r.r.includes('H2') && r.p.includes('H2O')).slice(0, 5).map((r) => `${r.eq} | ${r.r} | ${r.p}`))
