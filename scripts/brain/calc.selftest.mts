/**
 * npm run brain:selftest:calc — проверка школьного калькулятора (brain/calc) без LLM и без BM25-шардов:
 *   (а) golden.jsonl — 100 % (тип распознан, все ожидаемые значения есть в numbers);
 *   (б) textbook.jsonl — задачи учебников: проверенные (checked) — распознано ≥ 95 %, верно ≥ 98 %; непроверенные — отчёт;
 *   (в) генеративные round-trip — 12 базовых типов × 500 задач (сид), ru/uz/en — 100 %;
 *   (г) негатив — тексты без задачи → null;  (д) reconcileCalcAnswer — 12 случаев;  (е) p95 ≤ 5 мс на задачу.
 * --only=golden|textbook|gen|neg|rec  --n=500  --verbose
 */
import fs from 'node:fs'
import path from 'node:path'
import { reconcileCalcAnswer, runSchoolCalc, solveSchoolTask } from '../../brain/calc/index.ts'
import { REPO_ROOT } from '../../brain/kb/shards.ts'
import { cmpForm, type Lang } from '../../brain/pipeline/normalize.ts'
import type { ToolResult } from '../../brain/pipeline/tools.ts'
import { lightKnowledge } from './calcKb.mts'

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1]
const only = arg('only')
const verbose = process.argv.includes('--verbose')
const N = Number(arg('n') ?? 500)
const kb = lightKnowledge()
let failed = false
const times: number[] = []

type Expect = { value?: number; text?: string; tol?: { rel?: number; abs?: number } }
type Case = { id: string; type?: string; lang: Lang; statement: string; expect: Expect[]; grade?: number; checked?: boolean; loose?: boolean }

const SUP: Record<string, string> = { '⁻': '-', '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' }
/** «6,02·10²²» → 6.02e22; «−2» → −2 */
function parseNum(s: string): number {
  const t = s.replace(/\s+/g, '').replace(/^−/, '-').replace(',', '.')
  const m = t.match(/^(-?[\d.]+)·10([⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+)$/)
  if (m) return Number(m[1]) * 10 ** Number([...m[2]!].map((c) => SUP[c] ?? c).join(''))
  return Number(t)
}

function solve(statement: string, lang: Lang): ToolResult | null {
  const t0 = performance.now()
  const r = runSchoolCalc(statement, cmpForm(statement), lang, kb)
  times.push(performance.now() - t0)
  return r
}

function matches(r: ToolResult, ex: Expect[], loose = false): string | null {
  for (const e of ex) {
    if (e.text != null) {
      if (!r.numbers.some((n) => n === e.text) && !r.text.includes(e.text)) return `нет «${e.text}»`
      continue
    }
    const rel = e.tol?.rel ?? (loose ? 0.03 : 0.01)
    const abs = e.tol?.abs ?? 0.01
    const ok = r.numbers.map(parseNum).some((n) => Math.abs(n - e.value!) <= Math.max(abs, rel * Math.abs(e.value!)))
    if (!ok) return `нет ${e.value} (есть ${r.numbers.join(', ')})`
  }
  return null
}

function readJsonl(p: string): Case[] {
  if (!fs.existsSync(p)) return []
  return fs
    .readFileSync(p, 'utf8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as Case)
}

// ---------------------------------------------------------------- (а) golden
if (!only || only === 'golden') {
  const cases = readJsonl(path.join(REPO_ROOT, 'brain', 'calc', 'fixtures', 'golden.jsonl'))
  let ok = 0
  const fails: string[] = []
  for (const c of cases) {
    const r = solve(c.statement, c.lang)
    const why = !r ? 'null' : r.tool !== `calc:${c.type}` ? `тип ${r.tool} ≠ ${c.type}` : matches(r, c.expect)
    if (why) fails.push(`  ✗ ${c.id} [${c.type}] ${c.statement}\n      ${why}${r && verbose ? `\n${r.text}` : ''}`)
    else ok++
    if (verbose && r && !why) console.log(`✓ ${c.id}\n${r.text}\n`)
  }
  console.log(`(а) golden: ${ok}/${cases.length}`)
  if (fails.length) console.log(fails.join('\n'))
  if (ok !== cases.length) failed = true
}

// ---------------------------------------------------------------- (б) задачи учебников
if (!only || only === 'textbook') {
  const cases = readJsonl(path.join(REPO_ROOT, 'brain', 'calc', 'fixtures', 'textbook.jsonl'))
  const groups = { checked: cases.filter((c) => c.checked), raw: cases.filter((c) => !c.checked) }
  for (const [name, list] of Object.entries(groups)) {
    if (!list.length) continue
    let rec = 0
    let right = 0
    const fails: string[] = []
    for (const c of list) {
      const r = solve(c.statement, c.lang)
      if (!r) continue
      rec++
      const why = matches(r, c.expect, c.loose)
      if (!why) right++
      else fails.push(`  ✗ ${c.id} ${r.tool}: ${why}`)
    }
    const recPct = (rec / list.length) * 100
    const rightPct = rec ? (right / rec) * 100 : 100
    console.log(`(б) учебники, ${name === 'checked' ? 'выверенные' : 'сырые (не выверены вручную — только отчёт)'}: ${list.length} задач, распознано ${rec} (${recPct.toFixed(0)} %), из них верно ${right} (${rightPct.toFixed(0)} %)`)
    if (name === 'checked') {
      if (fails.length) console.log(fails.join('\n'))
      if (recPct < 95 || rightPct < 98) failed = true
    } else if (verbose && fails.length) console.log(fails.slice(0, 40).join('\n'))
  }
}

// ---------------------------------------------------------------- (в) генеративные round-trip
type Gen = { type: string; make(rnd: () => number, lang: Lang): { text: string; want: number } }
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}
const pick = <T,>(r: () => number, xs: T[]) => xs[Math.floor(r() * xs.length)]!
const val = (r: () => number, lo: number, hi: number, d = 1) => Number((lo + r() * (hi - lo)).toFixed(d))
const S = (x: number, lang: Lang) => (lang === 'en' ? String(x) : String(x).replace('.', ','))
const T = (lang: Lang, ru: string[], uz: string[], en: string[], r: () => number) => pick(r, lang === 'ru' ? ru : lang === 'uz' ? uz : en)
/** школьные M */
const M: Record<string, number> = { H2O: 18, NaCl: 58.5, CO2: 44, NaOH: 40, H2SO4: 98, CaCO3: 100, CaO: 56, Zn: 65, H2: 2, O2: 32, N2: 28, NH3: 17, Mg: 24, MgO: 40, Cu: 64, Ag: 108, KCl: 74.5, CH4: 16 }

const GENS: Gen[] = [
  {
    type: 'molar_mass',
    make(r, l) {
      const f = pick(r, ['H2O', 'NaCl', 'CO2', 'NaOH', 'H2SO4', 'CaCO3', 'NH3', 'MgO', 'KCl', 'CH4'])
      return { text: T(l, [`Вычислите относительную молекулярную массу ${f}`, `Найдите Mr(${f})`], [`${f} ning nisbiy molekulyar massasini hisoblang`], [`Calculate the relative molecular mass of ${f}`], r), want: M[f]! }
    },
  },
  {
    type: 'mass_fraction_element',
    make(r, l) {
      const [f, el, n] = pick(r, [['H2O', 'O', 1], ['CO2', 'C', 1], ['NaOH', 'Na', 1], ['CaCO3', 'Ca', 1], ['NH3', 'N', 1], ['MgO', 'Mg', 1], ['H2SO4', 'S', 1]] as [string, string, number][])
      const Ar: Record<string, number> = { O: 16, C: 12, Na: 23, Ca: 40, N: 14, Mg: 24, S: 32 }
      return { text: T(l, [`Вычислите массовую долю ω(${el}) в ${f}`, `Найдите ω(${el}) в веществе ${f}`], [`${f} dagi ω(${el}) massa ulushini hisoblang`], [`Find the mass fraction ω(${el}) in ${f}`], r), want: ((n * Ar[el]!) / M[f]!) * 100 }
    },
  },
  {
    type: 'moles_mass_volume_particles',
    make(r, l) {
      const f = pick(r, ['H2O', 'NaCl', 'CO2', 'NaOH', 'CaCO3', 'MgO'])
      const m = val(r, 1, 300)
      return { text: T(l, [`Сколько моль вещества содержится в ${S(m, l)} г ${f}?`, `Вычислите количество вещества в ${S(m, l)} г ${f}.`], [`${S(m, l)} g ${f} necha mol boʻladi?`], [`How many moles are in ${S(m, l)} g of ${f}?`], r), want: m / M[f]! }
    },
  },
  {
    type: 'equation_stoich',
    make(r, l) {
      const m = val(r, 1, 100)
      return { text: T(l, [`Сколько литров водорода (н.у.) выделится при взаимодействии ${S(m, l)} г цинка Zn с соляной кислотой HCl?`], [`${S(m, l)} g Zn HCl bilan reaksiyaga kirishganda necha litr H2 (n.sh.) ajraladi?`], [`What volume of H2 (STP) is released when ${S(m, l)} g of Zn reacts with HCl?`], r), want: (m / 65) * 22.4 }
    },
  },
  {
    type: 'excess_limiting',
    make(r, l) {
      const a = val(r, 1, 20)
      const b = val(r, 8, 160)
      const nH = a / 2
      const nO = b / 32
      const nW = Math.min(nH, 2 * nO)
      return { text: T(l, [`Смешали ${S(a, l)} г водорода H2 и ${S(b, l)} г кислорода O2 и подожгли. Какая масса воды H2O образовалась?`], [`${S(a, l)} g H2 va ${S(b, l)} g O2 aralashmasi portlatildi. Necha gramm H2O hosil boʻldi?`], [`${S(a, l)} g of H2 and ${S(b, l)} g of O2 were mixed and ignited. What mass of H2O was formed?`], r), want: nW * 18 }
    },
  },
  {
    type: 'yield',
    make(r, l) {
      const m = val(r, 10, 500)
      const eta = Math.round(val(r, 50, 95, 0))
      return { text: T(l, [`Какую массу оксида кальция CaO можно получить разложением ${S(m, l)} г карбоната кальция CaCO3, если выход составляет ${eta} %?`], [`${S(m, l)} g CaCO3 parchalanganda unum ${eta} % boʻlsa, necha gramm CaO olinadi?`], [`What mass of CaO can be obtained by decomposing ${S(m, l)} g of CaCO3 if the yield is ${eta} %?`], r), want: (m / 100) * 56 * (eta / 100) }
    },
  },
  {
    type: 'impurities',
    make(r, l) {
      const m = val(r, 10, 500)
      const w = Math.round(val(r, 5, 40, 0))
      return { text: T(l, [`Какой объём углекислого газа CO2 (н.у.) выделится при обжиге ${S(m, l)} г карбоната кальция CaCO3, содержащего ${w} % примесей?`], [`Tarkibida ${w} % aralashma boʻlgan ${S(m, l)} g CaCO3 qizdirilganda necha litr CO2 (n.sh.) ajraladi?`], [`What volume of CO2 (STP) is released when ${S(m, l)} g of CaCO3 with ${w} % impurities is heated?`], r), want: ((m * (100 - w)) / 100 / 100) * 22.4 }
    },
  },
  {
    type: 'solution_mass_fraction',
    make(r, l) {
      const s = val(r, 1, 100)
      const w = val(r, 50, 900)
      return { text: T(l, [`В ${S(w, l)} г воды растворили ${S(s, l)} г соли. Вычислите массовую долю соли в растворе.`], [`${S(w, l)} g suvda ${S(s, l)} g tuz eritildi. Eritmadagi tuzning massa ulushini toping.`], [`${S(s, l)} g of salt was dissolved in ${S(w, l)} g of water. Find the mass fraction of the salt in the solution.`], r), want: (s / (s + w)) * 100 }
    },
  },
  {
    type: 'molarity',
    make(r, l) {
      const m = val(r, 1, 80)
      const v = Math.round(val(r, 100, 2000, 0))
      return { text: T(l, [`Рассчитайте молярную концентрацию раствора, в ${v} мл которого содержится ${S(m, l)} г NaOH.`], [`${v} ml eritmada ${S(m, l)} g NaOH erigan. Eritmaning molyar konsentratsiyasini hisoblang.`], [`Calculate the molar concentration of a solution containing ${S(m, l)} g of NaOH in ${v} mL.`], r), want: m / 40 / (v / 1000) }
    },
  },
  {
    type: 'clapeyron',
    make(r, l) {
      const n = val(r, 0.1, 10, 2)
      const t = Math.round(val(r, 0, 200, 0))
      const p = Math.round(val(r, 50, 500, 0))
      return { text: T(l, [`Какой объём займут ${S(n, l)} моль газа при температуре ${t} °C и давлении ${p} кПа?`], [`${S(n, l)} mol gaz ${t} °C va ${p} kPa bosimda qancha hajmni egallaydi?`], [`What volume do ${S(n, l)} mol of a gas occupy at ${t} °C and ${p} kPa?`], r), want: (n * 8.314 * (t + 273)) / p }
    },
  },
  {
    type: 'gas_density',
    make(r, l) {
      const d = val(r, 1, 80)
      return { text: T(l, [`Плотность газа по водороду равна ${S(d, l)}. Найдите молярную массу газа.`, `D(H2) = ${S(d, l)}. Вычислите молярную массу газа.`], [`Gazning vodorodga nisbatan zichligi ${S(d, l)} ga teng. Uning molyar massasini toping.`], [`The density of a gas relative to hydrogen is ${S(d, l)}. Find its molar mass.`], r), want: d * 2 }
    },
  },
  {
    type: 'electrolysis_faraday',
    make(r, l) {
      const I = val(r, 0.5, 20)
      const t = Math.round(val(r, 60, 20000, 0))
      return { text: T(l, [`Какая масса меди выделится на катоде при электролизе раствора CuSO4 током ${S(I, l)} А в течение ${t} с?`], [`CuSO4 eritmasi ${S(I, l)} A tok bilan ${t} s davomida elektroliz qilinganda katodda necha gramm Cu ajraladi?`], [`What mass of Cu is deposited from CuSO4 solution by a current of ${S(I, l)} A in ${t} s?`], r), want: (64 * I * t) / (2 * 96500) }
    },
  },
]

if (!only || only === 'gen') {
  const langs: Lang[] = ['ru', 'uz', 'en']
  let allOk = true
  for (const g of GENS) {
    const r = rng(20261011 + g.type.length * 7919)
    let ok = 0
    const fails: string[] = []
    for (let i = 0; i < N; i++) {
      const lang = langs[i % 3]!
      const { text, want } = g.make(r, lang)
      const res = solve(text, lang)
      const got = res?.numbers.map(parseNum) ?? []
      // сравнение с печатным (школьно округлённым) числом: допуск — округление печати + rel 0,005
      const good = res && res.tool === `calc:${g.type}` && got.some((n) => Math.abs(n - want) <= Math.max(0.005 * Math.abs(want), 0.0051 * 10 ** (Math.floor(Math.log10(Math.abs(want) || 1)) - 2), 0.051))
      if (good) ok++
      else if (fails.length < 3) fails.push(`    ✗ [${lang}] ${text} → ${res ? `${res.tool} ${res.numbers.join(', ')}` : 'null'} (ждали ${want})`)
    }
    console.log(`(в) ${g.type}: ${ok}/${N}`)
    if (fails.length) console.log(fails.join('\n'))
    if (ok !== N) allOk = false
  }
  if (!allOk) failed = true
}

// ---------------------------------------------------------------- (г) негатив
const NEG: [string, Lang][] = [
  ['Что такое моль?', 'ru'], ['pH 12', 'ru'], ['Менделеев открыл периодический закон в 1869 году. Расскажи об этом.', 'ru'], ['Какова масса атома любви?', 'ru'],
  ['Уравняй H2 + O2 = H2O', 'ru'], ['Fe + O2 = Fe2O3', 'ru'], ['Какая степень окисления марганца в KMnO4?', 'ru'], ['Почему натрий хранят под керосином?', 'ru'],
  ['Сколько будет 2 + 2?', 'ru'], ['Привет! Как дела?', 'ru'], ['Назови 3 свойства кислорода', 'ru'], ['Что такое 22,4 л/моль?', 'ru'],
  ['Расскажи про 7 класс химии', 'ru'], ['Какие элементы в 2 группе?', 'ru'], ['Элемент номер 26', 'ru'], ['Какой pH у раствора HCl с концентрацией 0,01 моль/л?', 'ru'],
  ['Mol nima?', 'uz'], ['Kislorod qanday olinadi?', 'uz'], ['1869 yilda nima kashf qilindi?', 'uz'], ['Salom, 9-sinf kimyosini tushuntir', 'uz'],
  ['NaCl qanday modda?', 'uz'], ['H2O ning tuzilishi qanday?', 'uz'], ['3 ta kislota nomini ayt', 'uz'], ['Vodorod nechta elektron beradi?', 'uz'],
  ['What is a mole?', 'en'], ['Why is the sky blue?', 'en'], ['Tell me about the year 1869 in chemistry', 'en'], ['Balance CH4 + O2 = CO2 + H2O', 'en'],
  ['What is the mass of love?', 'en'], ['Name 2 noble gases', 'en'], ['How do I get 100 points in chemistry?', 'en'], ['What are the 7 diatomic elements?', 'en'],
  ['Сколько уроков в 8 классе?', 'ru'], ['Как получить 5 по химии?', 'ru'], ['Сколько воды надо пить в день: 2 литра?', 'ru'], ['Какой у тебя номер, 7?', 'ru'],
  ['В 2024 году я пошёл в 7 класс. Что изучать?', 'ru'], ['Кислота + основание = соль + вода. Почему?', 'ru'], ['Сколько электронов в атоме?', 'ru'], ['Какой объём у колбы?', 'ru'],
]
if (!only || only === 'neg') {
  let ok = 0
  const fails: string[] = []
  for (const [t, l] of NEG) {
    const r = solveSchoolTask(t, cmpForm(t), l, kb)
    if (!r) ok++
    else fails.push(`  ✗ «${t}» → ${r.type}`)
  }
  console.log(`(г) негатив: ${ok}/${NEG.length}`)
  if (fails.length) console.log(fails.join('\n'))
  if (ok !== NEG.length) failed = true
}

// ---------------------------------------------------------------- (д) сверка ответа модели
if (!only || only === 'rec') {
  const tool = (q: string, l: Lang) => runSchoolCalc(q, cmpForm(q), l, kb)!
  const zn = tool('Сколько литров водорода (н.у.) выделится при взаимодействии 13 г цинка с соляной кислотой?', 'ru')
  const znUz = tool('13 g rux xlorid kislota bilan reaksiyaga kirishganda necha litr vodorod (n.sh.) ajralib chiqadi?', 'uz')
  const znEn = tool('What volume of H2 (STP) is released when 13 g of Zn reacts with HCl?', 'en')
  const old: ToolResult = { tool: 'stoich', text: 'n = 2 моль', facts: '', numbers: ['2'] }
  const cases: { name: string; text: string; tools: ToolResult[]; lang: Lang; want: (s: string) => boolean }[] = [
    { name: 'верно → без изменений', text: 'n(Zn) = 13 / 65 = 0,2 моль. Ответ: V(H₂) = 4,48 л.', tools: [zn], lang: 'ru', want: (s) => s === 'n(Zn) = 13 / 65 = 0,2 моль. Ответ: V(H₂) = 4,48 л.' },
    { name: 'переврано в «Ответ»', text: 'n(Zn) = 0,2 моль. Ответ: V(H₂) = 5,48 л.', tools: [zn], lang: 'ru', want: (s) => s.includes('4,48') && !s.includes('5,48') },
    { name: 'переврано в последнем предложении', text: 'Считаем по уравнению. Получаем V(H₂) = 44,8 л.', tools: [zn], lang: 'ru', want: (s) => s.includes('4,48') && !s.includes('44,8') },
    { name: 'нет шагов → расчёт целиком', text: 'Водород выделяется при реакции цинка с кислотой.', tools: [zn], lang: 'ru', want: (s) => s.includes('Точный расчёт') && s.includes('4,48') },
    { name: 'итог пропущен → строка «Ответ»', text: 'n(Zn) = 13 / 65 = 0,2 моль, дальше по уравнению.', tools: [zn], lang: 'ru', want: (s) => /Ответ: V\(H₂\) = 4,48 л/.test(s) },
    { name: 'uz: переврано', text: 'Javob: V(H₂) = 3,36 l.', tools: [znUz], lang: 'uz', want: (s) => s.includes('4,48') && !s.includes('3,36') },
    { name: 'uz: верно', text: 'n(Zn) = 0,2 mol. Javob: V(H₂) = 4,48 l.', tools: [znUz], lang: 'uz', want: (s) => s === 'n(Zn) = 0,2 mol. Javob: V(H₂) = 4,48 l.' },
    { name: 'en: переврано', text: 'n(Zn) = 0.2 mol. Answer: V(H₂) = 4.8 L.', tools: [znEn], lang: 'en', want: (s) => s.includes('4.48') && !s.includes('4.8 L') },
    { name: 'en: нет шагов', text: 'Zinc reacts with acid and gives hydrogen.', tools: [znEn], lang: 'en', want: (s) => s.includes('Exact calculation') && s.includes('4.48') },
    { name: 'без calc → без изменений', text: 'Ответ: 3 моль.', tools: [old], lang: 'ru', want: (s) => s === 'Ответ: 3 моль.' },
    { name: 'блок «Точный расчёт» уже есть → модельную часть чиним, блок не трогаем', text: `Ответ: 5 л.\n\nТочный расчёт: ${zn.text}`, tools: [zn], lang: 'ru', want: (s) => !s.startsWith('Ответ: 5 л') && s.includes('Точный расчёт') },
    { name: 'промежуточные числа инструмента не трогаем', text: 'M(Zn) = 65 г/моль, n = 0,2 моль. Ответ: n(H₂) = 0,2 моль, V(H₂) = 4,48 л.', tools: [zn], lang: 'ru', want: (s) => s === 'M(Zn) = 65 г/моль, n = 0,2 моль. Ответ: n(H₂) = 0,2 моль, V(H₂) = 4,48 л.' },
  ]
  let ok = 0
  for (const c of cases) {
    const out = reconcileCalcAnswer(c.text, c.tools, c.lang)
    if (c.want(out)) ok++
    else console.log(`  ✗ ${c.name}\n      «${out}»`)
  }
  console.log(`(д) сверка ответа: ${ok}/${cases.length}`)
  if (ok !== cases.length) failed = true
}

// ---------------------------------------------------------------- (е) время
if (times.length) {
  const s = [...times].sort((a, b) => a - b)
  const p95 = s[Math.floor(s.length * 0.95)]!
  console.log(`(е) время: p50 ${s[Math.floor(s.length / 2)]!.toFixed(2)} мс, p95 ${p95.toFixed(2)} мс на задачу (${s.length} задач)`)
  if (p95 > 5) failed = true
}

console.log(failed ? '\nНЕ ПРОЙДЕНО' : '\nПРОЙДЕНО')
process.exit(failed ? 1 : 0)
