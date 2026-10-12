/**
 * Ручная проба калькулятора: npx tsx scripts/brain/calc-probe.mts "задача 1" "задача 2" …
 * (без аргументов — несколько типовых задач).
 */
import { solveSchoolTask, runSchoolCalc } from '../../brain/calc/index.ts'
import { cmpForm, detectLang } from '../../brain/pipeline/normalize.ts'
import { lightKnowledge } from './calcKb.mts'

const kb = lightKnowledge()
const args = process.argv.slice(2)
const list = args.length
  ? args
  : [
      'Сколько литров водорода (н.у.) выделится при взаимодействии 13 г цинка с соляной кислотой?',
      'Вычислите массу оксида кальция, полученного при разложении 200 г карбоната кальция.',
      'Сколько моль в 36 г воды H2O?',
      'Какой объём займут 2 моль кислорода при н.у.?',
      'Сколько граммов в 0,5 моль NaCl?',
      'Найди массовую долю кислорода в H2O',
      'Вычислите относительную молекулярную массу H2SO4',
    ]
for (const q of list) {
  const lang = detectLang(q)
  const t0 = performance.now()
  const r = runSchoolCalc(q, cmpForm(q), lang, kb)
  const ms = performance.now() - t0
  console.log(`\n### ${q}\n→ ${r ? r.tool : 'null'} (${ms.toFixed(1)} мс)`)
  if (r) console.log(`${r.text}\nnumbers: ${JSON.stringify(r.numbers)}`)
  void solveSchoolTask
}
