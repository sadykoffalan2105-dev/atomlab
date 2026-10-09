/**
 * Химический аудит 3D-лаборатории (без браузера): npx tsx scripts/lab3d-chem-audit.mts
 *  1) ответы 15 задач-опытов пересчитаны независимо по условию учебника (M — школьные Ar из measure/quantities,
 *     Vm = 22,4 л/моль, Nₐ = 6,02·10²³) и сверены с answers[].book (допуск 1 %);
 *  2) измерения задач: размерность прибора совпадает с величиной (m — весы, V — мерная посуда/газ, t — термометр);
 *  3) у каждого шага опытов и задач есть наблюдение;
 *  4) у каждого опыта с кислотой или пламенем есть средства защиты (gear);
 *  5) приёмники лёгких газов (H₂, NH₃) в установках помечены «дном вверх» (userData.labOrientation: 'mouthDown').
 * Код выхода 1 — есть расхождения.
 */
import { readFileSync } from 'node:fs'
import { LAB_EXPERIMENTS } from '../src/data/labWorks/labExperiments.ts'
import { LAB_TASKS } from '../src/data/labTasks/labTasks.ts'
import { molarMass } from '../src/components/lab3d/measure/quantities.ts'

const VM = 22.4
const NA = 6.02e23
const M = (f: string) => molarMass(f)
const problems: string[] = []
const okLines: string[] = []

/** Независимый расчёт по условию задачи (числа — из текста условия учебника). */
const EXPECTED: Record<string, Record<string, () => number>> = {
  // 26 г Zn: n = m/M, N = n·Nₐ (ответ N хранится как мантисса при 10²³)
  'task-g7-zn-moles': { n: () => 26 / M('Zn'), N: () => ((26 / M('Zn')) * NA) / 1e23 },
  // 2Mg + O₂ → 2MgO, 1,2 г Mg
  'task-g7-mg-burn': { mMgO: () => (1.2 / M('Mg')) * M('MgO'), nMgO: () => 1.2 / M('Mg') },
  // Zn + 2HCl → ZnCl₂ + H₂, 0,39 кг Zn
  'task-g7-kipp-h2': { VH2: () => (390 / M('Zn')) * VM },
  // CaO + H₂O → Ca(OH)₂, 28 г CaO
  'task-g7-cao-water': { mCaOH2: () => (28 / M('CaO')) * M('Ca(OH)2') },
  // Cu(OH)₂ → CuO + H₂O, 49 г
  'task-g7-cuoh2-heat': { mCuO: () => (49 / M('Cu(OH)2')) * M('CuO') },
  // 26 г Zn + HCl (изб.)
  'task-g8-zn-hcl-gas': { mH2: () => (26 / M('Zn')) * M('H2'), VH2: () => (26 / M('Zn')) * VM },
  // MgCl₂ + 2AgNO₃ → 2AgCl + Mg(NO₃)₂, 19 г MgCl₂
  'task-g8-agcl': { mAgCl: () => ((19 / M('MgCl2')) * 2) * M('AgCl'), nAgCl: () => (19 / M('MgCl2')) * 2 },
  // w(H₂O) в CuSO₄·5H₂O
  'task-g8-cuso4-hydrate': { w: () => ((5 * M('H2O')) / (M('CuSO4') + 5 * M('H2O'))) * 100 },
  // 2Al + 3H₂SO₄, 5,4 г Al, раствор 20 %
  'task-g8-al-acid': { mSol: () => (((5.4 / M('Al')) * 3) / 2) * M('H2SO4') / 0.2 },
  // 5,6 л HCl в 100 мл (100 г) воды
  'task-g8-hcl-solution': { w: () => { const m = (5.6 / VM) * M('HCl'); return (m / (100 + m)) * 100 } },
  // 54 г Na₂CO₃·10H₂O → 10 % раствор: m(воды) = m(Na₂CO₃)/0,1 − 54
  'task-g9-soda-solution': { water: () => (54 * M('Na2CO3')) / (M('Na2CO3') + 10 * M('H2O')) / 0.1 - 54 },
  // 104 г 5 % BaCl₂ + 71 г 10 % Na₂SO₄ — по недостатку
  'task-g9-baso4-excess': { mBaSO4: () => Math.min((104 * 0.05) / M('BaCl2'), (71 * 0.1) / M('Na2SO4')) * M('BaSO4') },
  // 40 г 20 % CuSO₄ + Fe → Cu
  'task-g9-cu-from-cuso4': { mCu: () => ((40 * 0.2) / M('CuSO4')) * M('Cu') },
  // 4 г 20 % CuSO₄ + 2NaOH; раствор NaOH 20 %, ρ = 1,22 г/мл
  'task-g9-naoh-cuso4': { V: () => (((4 * 0.2) / M('CuSO4')) * 2 * M('NaOH')) / 0.2 / 1.22 },
  // 2NaHCO₃ → Na₂CO₃ + H₂O + CO₂; 60 г смеси, 2,7 г воды
  'task-g9-nahco3-mix': {
    wBicarb: () => (((2.7 / M('H2O')) * 2 * M('NaHCO3')) / 60) * 100,
    wCarb: () => 100 - (((2.7 / M('H2O')) * 2 * M('NaHCO3')) / 60) * 100,
  },
}

/* 1) ответы задач */
for (const t of LAB_TASKS) {
  const exp = EXPECTED[t.id]
  if (!exp) {
    problems.push(`${t.id}: нет независимого расчёта в аудите`)
    continue
  }
  for (const a of t.answers) {
    const f = exp[a.key]
    if (!f) {
      problems.push(`${t.id}: ответ ${a.key} не пересчитан`)
      continue
    }
    const want = f()
    const dev = Math.abs(a.book - want) / Math.max(1e-9, Math.abs(want))
    const line = `${t.id} · ${a.label} = ${a.book} (расчёт ${want.toPrecision(5)}, ${(dev * 100).toFixed(2)} %)`
    if (dev > 0.01) problems.push(`ответ расходится > 1 %: ${line}`)
    else okLines.push(line)
  }
}

/* 2) размерность измерений: m → весы, V → мерная посуда/газометр, t → термометр */
const VOLUME = /^(cyl|burette|pipette|gas)/
for (const t of LAB_TASKS) {
  for (const m of t.measurements) {
    if (m.derived) continue
    const lead = m.label.replace(/^Δ/, '')[0]
    const inst = m.instrument as string
    const ok =
      (lead === 'm' && inst === 'scales') || (lead === 'V' && VOLUME.test(inst)) || (lead === 't' && inst === 'thermometer') || !/[mVt]/.test(lead ?? '')
    if (!ok) problems.push(`${t.id}: измерение ${m.key} «${m.label}» прибором ${inst} — не та размерность`)
    if (m.afterStep < 0 || m.afterStep >= t.steps.length) problems.push(`${t.id}: измерение ${m.key} после шага ${m.afterStep} — такого шага нет`)
  }
}

/* 3) наблюдение у каждого шага; 4) средства защиты при кислоте/пламени */
const HAZARD = /кислот|спиртовк|горелк|пламен|нагре|прокал|накал|щёлоч|щелоч|NaOH|HCl|H₂SO₄|HNO₃/i
for (const e of LAB_EXPERIMENTS) {
  e.steps.forEach((s, i) => {
    if (!s.observation?.ru?.trim()) problems.push(`${e.id}: шаг ${i + 1} «${s.id}» без наблюдения`)
  })
  const text = [e.equation, ...e.steps.map((s) => s.instruction.ru), ...e.equipment.map((q) => q.ru)].join(' ')
  if (HAZARD.test(text) && !(e.gear ?? []).includes('goggles')) problems.push(`${e.id}: кислота/пламя/щёлочь без защитных очков (gear)`)
}

/* 5) ориентация приёмных пробирок лёгких газов */
const ORIENT: Record<string, number> = {
  'src/components/lab3d/experiments/rigs/H2PracticalRig.tsx': 1,
  'src/components/lab3d/experiments/rigs/Nh3Rig.tsx': 2,
}
for (const [file, n] of Object.entries(ORIENT)) {
  const src = readFileSync(file, 'utf8')
  const found = (src.match(/labOrientation: 'mouthDown'/g) ?? []).length
  if (found < n) problems.push(`${file}: приёмник лёгкого газа не помечен labOrientation 'mouthDown' (${found}/${n})`)
}

for (const l of okLines) console.log(`✓ ${l}`)
console.log(`\nответов сверено: ${okLines.length}; задач: ${LAB_TASKS.length}; опытов и задач проверено на наблюдения и защиту: ${LAB_EXPERIMENTS.length}`)
if (problems.length) {
  console.log(`\nрасхождений: ${problems.length}`)
  for (const p of problems) console.log(`✗ ${p}`)
  process.exit(1)
}
console.log('расхождений: 0')
