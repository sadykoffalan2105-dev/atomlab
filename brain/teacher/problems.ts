/**
 * Расчётные задачи для плана урока и теста: условие строит шаблон (числа — от сида единицы, детерминированно),
 * решение и ВСЕ числа ответа — только школьный калькулятор brain/calc (solveSchoolTask). Шаблон ещё и сам знает
 * ожидаемый ответ (want): калькулятор с ним не сошёлся — задача отбрасывается (в план не попадёт неверное число).
 * Задачи из учебника (examples карты, только ru) идут, если калькулятор их решает.
 */
import { solveSchoolTask } from '../calc/index.ts'
import { render, valueNum, valueStr } from '../calc/format.ts'
import type { Knowledge } from '../kb/shards.ts'
import { cmpForm, type Lang } from '../pipeline/normalize.ts'
import type { TaskTypeId, Unit } from '../curriculum/types.ts'

export type Problem = {
  /** тип задачи калькулятора ('calc:<тип>' без префикса) */
  type: string
  statement: string
  /** «Дано → Решение → Ответ» калькулятора на языке запроса */
  solution: string
  /** итоговые ответы калькулятора (школьное округление) — их и только их печатает ключ */
  answers: string[]
  /** «m(H₂O) = 3,6 г» — для ключа */
  answerLine: string
  source: 'generated' | 'textbook'
  page?: number
}

export type Rng = () => number
export function rng(seed: number): Rng {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}
export function seedOf(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}
const pick = <T,>(r: Rng, xs: readonly T[]) => xs[Math.floor(r() * xs.length)]!
/** «красивые» школьные числа: целые или с одним знаком */
const val = (r: Rng, lo: number, hi: number, d = 1) => Number((lo + r() * (hi - lo)).toFixed(d))
const S = (x: number, lang: Lang) => (lang === 'en' ? String(x) : String(x).replace('.', ','))
const T = (lang: Lang, ru: string, uz: string, en: string) => (lang === 'ru' ? ru : lang === 'uz' ? uz : en)

/** школьные M (как в калькуляторе) */
const M: Record<string, number> = { H2O: 18, NaCl: 58.5, CO2: 44, NaOH: 40, H2SO4: 98, CaCO3: 100, CaO: 56, Zn: 65, H2: 2, O2: 32, NH3: 17, Mg: 24, MgO: 40, KCl: 74.5, CH4: 16 }

type Gen = { type: TaskTypeId; make(r: Rng, lang: Lang): { text: string; want: number | string } }

/** Шаблоны по типам задач (те же формулировки, что проверяет calc.selftest «генеративный round-trip»). */
const GENS: Gen[] = [
  {
    type: 'molar_mass',
    make(r, l) {
      const f = pick(r, ['H2O', 'NaCl', 'CO2', 'NaOH', 'H2SO4', 'CaCO3', 'NH3', 'MgO', 'KCl', 'CH4'])
      return { text: T(l, `Вычислите относительную молекулярную массу ${f}.`, `${f} ning nisbiy molekulyar massasini hisoblang.`, `Calculate the relative molecular mass of ${f}.`), want: M[f]! }
    },
  },
  {
    type: 'mass_fraction_element',
    make(r, l) {
      const [f, el] = pick(r, [['H2O', 'O'], ['CO2', 'C'], ['NaOH', 'Na'], ['CaCO3', 'Ca'], ['NH3', 'N'], ['MgO', 'Mg'], ['H2SO4', 'S']] as const)
      const Ar: Record<string, number> = { O: 16, C: 12, Na: 23, Ca: 40, N: 14, Mg: 24, S: 32 }
      return { text: T(l, `Вычислите массовую долю ω(${el}) в ${f}.`, `${f} dagi ω(${el}) massa ulushini hisoblang.`, `Find the mass fraction ω(${el}) in ${f}.`), want: (Ar[el]! / M[f]!) * 100 }
    },
  },
  {
    type: 'formula_from_fractions',
    make(r, l) {
      const [el, wEl, wO, ans, ru, uz, en] = pick(r, [
        ['S', 40, 60, 'SO₃', 'серы', 'oltingugurt', 'sulfur'],
        ['S', 50, 50, 'SO₂', 'серы', 'oltingugurt', 'sulfur'],
        ['Cu', 80, 20, 'CuO', 'меди', 'mis', 'copper'],
        ['C', 27.3, 72.7, 'CO₂', 'углерода', 'uglerod', 'carbon'],
      ] as const)
      void el
      return {
        text: T(
          l,
          `Определите формулу оксида, содержащего ${S(wEl, l)} % ${ru} и ${S(wO, l)} % кислорода.`,
          `Tarkibida ${S(wEl, l)} % ${uz} va ${S(wO, l)} % kislorod boʻlgan oksid formulasini aniqlang.`,
          `Determine the formula of an oxide containing ${S(wEl, l)} % ${en} and ${S(wO, l)} % oxygen.`,
        ),
        want: ans,
      }
    },
  },
  {
    type: 'moles_mass_volume_particles',
    make(r, l) {
      const f = pick(r, ['H2O', 'NaCl', 'CO2', 'NaOH', 'CaCO3', 'MgO'])
      const m = val(r, 2, 200)
      return { text: T(l, `Сколько моль вещества содержится в ${S(m, l)} г ${f}?`, `${S(m, l)} g ${f} necha mol boʻladi?`, `How many moles are in ${S(m, l)} g of ${f}?`), want: m / M[f]! }
    },
  },
  {
    type: 'equation_stoich',
    make(r, l) {
      const m = Math.round(val(r, 5, 100, 0))
      return {
        text: T(l, `Сколько литров водорода (н.у.) выделится при взаимодействии ${m} г цинка Zn с соляной кислотой HCl?`, `${m} g Zn HCl bilan reaksiyaga kirishganda necha litr H2 (n.sh.) ajraladi?`, `What volume of H2 (STP) is released when ${m} g of Zn reacts with HCl?`),
        want: (m / 65) * 22.4,
      }
    },
  },
  {
    type: 'excess_limiting',
    make(r, l) {
      const a = Math.round(val(r, 1, 20, 0))
      const b = Math.round(val(r, 8, 160, 0))
      const nW = Math.min(a / 2, (2 * b) / 32)
      return {
        text: T(l, `Смешали ${a} г водорода H2 и ${b} г кислорода O2 и подожгли. Какая масса воды H2O образовалась?`, `${a} g H2 va ${b} g O2 aralashmasi portlatildi. Necha gramm H2O hosil boʻldi?`, `${a} g of H2 and ${b} g of O2 were mixed and ignited. What mass of H2O was formed?`),
        want: nW * 18,
      }
    },
  },
  {
    type: 'yield',
    make(r, l) {
      const m = Math.round(val(r, 10, 500, 0))
      const eta = Math.round(val(r, 60, 95, 0))
      return {
        text: T(l, `Какую массу оксида кальция CaO можно получить разложением ${m} г карбоната кальция CaCO3, если выход составляет ${eta} %?`, `${m} g CaCO3 parchalanganda unum ${eta} % boʻlsa, necha gramm CaO olinadi?`, `What mass of CaO can be obtained by decomposing ${m} g of CaCO3 if the yield is ${eta} %?`),
        want: (m / 100) * 56 * (eta / 100),
      }
    },
  },
  {
    type: 'impurities',
    make(r, l) {
      const m = Math.round(val(r, 10, 500, 0))
      const w = Math.round(val(r, 5, 40, 0))
      return {
        text: T(l, `Какой объём углекислого газа CO2 (н.у.) выделится при обжиге ${m} г карбоната кальция CaCO3, содержащего ${w} % примесей?`, `Tarkibida ${w} % aralashma boʻlgan ${m} g CaCO3 qizdirilganda necha litr CO2 (n.sh.) ajraladi?`, `What volume of CO2 (STP) is released when ${m} g of CaCO3 with ${w} % impurities is heated?`),
        want: ((m * (100 - w)) / 100 / 100) * 22.4,
      }
    },
  },
  {
    type: 'solution_mass_fraction',
    make(r, l) {
      const s = Math.round(val(r, 5, 60, 0))
      const w = Math.round(val(r, 50, 400, 0))
      return { text: T(l, `В ${w} г воды растворили ${s} г соли. Вычислите массовую долю соли в растворе.`, `${w} g suvda ${s} g tuz eritildi. Eritmadagi tuzning massa ulushini toping.`, `${s} g of salt was dissolved in ${w} g of water. Find the mass fraction of the salt in the solution.`), want: (s / (s + w)) * 100 }
    },
  },
  {
    type: 'molarity',
    make(r, l) {
      const m = Math.round(val(r, 2, 80, 0))
      const v = pick(r, [100, 200, 250, 500, 1000])
      return { text: T(l, `Рассчитайте молярную концентрацию раствора, в ${v} мл которого содержится ${m} г NaOH.`, `${v} ml eritmada ${m} g NaOH erigan. Eritmaning molyar konsentratsiyasini hisoblang.`, `Calculate the molar concentration of a solution containing ${m} g of NaOH in ${v} mL.`), want: m / 40 / (v / 1000) }
    },
  },
  {
    type: 'clapeyron',
    make(r, l) {
      const n = val(r, 0.5, 5, 1)
      const t = Math.round(val(r, 0, 100, 0))
      const p = pick(r, [100, 101.3, 150, 200, 250])
      return { text: T(l, `Какой объём займут ${S(n, l)} моль газа при температуре ${t} °C и давлении ${S(p, l)} кПа?`, `${S(n, l)} mol gaz ${t} °C va ${S(p, l)} kPa bosimda qancha hajmni egallaydi?`, `What volume do ${S(n, l)} mol of a gas occupy at ${t} °C and ${S(p, l)} kPa?`), want: (n * 8.314 * (t + 273)) / p }
    },
  },
  {
    type: 'gas_density',
    make(r, l) {
      const d = pick(r, [8, 14, 15, 16, 17, 22, 32, 35.5])
      return { text: T(l, `Плотность газа по водороду равна ${S(d, l)}. Найдите молярную массу газа.`, `Gazning vodorodga nisbatan zichligi ${S(d, l)} ga teng. Uning molyar massasini toping.`, `The density of a gas relative to hydrogen is ${S(d, l)}. Find its molar mass.`), want: d * 2 }
    },
  },
  {
    type: 'electrolysis_faraday',
    make(r, l) {
      const I = pick(r, [1, 2, 2.5, 4, 5, 10])
      const t = pick(r, [600, 965, 1930, 3600, 9650])
      return { text: T(l, `Какая масса меди выделится на катоде при электролизе раствора CuSO4 током ${S(I, l)} А в течение ${t} с?`, `CuSO4 eritmasi ${S(I, l)} A tok bilan ${t} s davomida elektroliz qilinganda katodda necha gramm Cu ajraladi?`, `What mass of Cu is deposited from CuSO4 solution by a current of ${S(I, l)} A in ${t} s?`), want: (64 * I * t) / (2 * 96500) }
    },
  },
]

const GEN_BY_TYPE = new Map<string, Gen>(GENS.map((g) => [g.type, g]))
/** близкий шаблон для типов без своего генератора */
const NEAR: Partial<Record<TaskTypeId, TaskTypeId>> = {
  solution_density_volume: 'solution_mass_fraction',
  solubility: 'solution_mass_fraction',
  crystal_hydrate: 'mass_fraction_element',
  mixture_fraction: 'impurities',
  combustion_formula: 'gas_density',
  gas_mixture: 'gas_density',
  air_volume: 'equation_stoich',
  metal_plate: 'equation_stoich',
  normality: 'molarity',
  equivalent: 'molar_mass',
  ph: 'molarity',
  dissociation_degree: 'solution_mass_fraction',
  atomic_structure_counts: 'molar_mass',
}
/** типы по классу, если у единицы своих нет (по оглавлению Kimyo: где тип вводится) */
const GRADE_DEFAULT: Record<number, TaskTypeId[]> = {
  7: ['molar_mass', 'mass_fraction_element', 'formula_from_fractions'],
  8: ['moles_mass_volume_particles', 'equation_stoich', 'solution_mass_fraction', 'gas_density'],
  9: ['yield', 'impurities', 'molarity', 'electrolysis_faraday', 'excess_limiting'],
  10: ['gas_density', 'formula_from_fractions', 'equation_stoich', 'clapeyron'],
  11: ['excess_limiting', 'yield', 'molarity', 'clapeyron'],
}

/** Ответ калькулятора совпал с ожиданием шаблона (печатное число — школьное округление). */
function agrees(sol: { answers: { value: number; text?: string }[] }, want: number | string, lang: Lang, toNum: (s: string) => number, printed: string[]): boolean {
  if (typeof want === 'string') return sol.answers.some((a) => a.text === want) || printed.includes(want)
  const got = printed.map(toNum).filter(Number.isFinite)
  void lang
  return got.some((n) => Math.abs(n - want) <= Math.max(0.006 * Math.abs(want), 0.051))
}

const SUP: Record<string, string> = { '⁻': '-', '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' }
/** «6,02·10²²» → 6.02e22; «−2» → −2 */
export function parseNum(s: string): number {
  const t = s.replace(/\s+/g, '').replace(/^−/, '-').replace(',', '.')
  const m = t.match(/^(-?[\d.]+)·10([⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+)$/)
  if (m) return Number(m[1]) * 10 ** Number([...m[2]!].map((c) => SUP[c] ?? c).join(''))
  return Number(t)
}

/** Решить условие калькулятором; null — не решил. */
export function solveProblem(text: string, lang: Lang, kb: Knowledge, source: Problem['source'] = 'generated', page?: number): Problem | null {
  const sol = solveSchoolTask(text, cmpForm(text), lang, kb)
  if (!sol || !sol.answers.length) return null
  return {
    type: sol.type,
    statement: text,
    solution: render(sol, lang, 1200),
    answers: sol.answers.map((a) => valueNum(a, lang)),
    answerLine: sol.answers.map((a) => valueStr(a, lang)).join('; '),
    source,
    ...(page ? { page } : {}),
  }
}

/** Задача по типу: шаблон → калькулятор → сверка с шаблоном; до 4 попыток с разными числами. */
export function generateProblem(type: TaskTypeId, lang: Lang, kb: Knowledge, r: Rng): Problem | null {
  const g = GEN_BY_TYPE.get(type) ?? GEN_BY_TYPE.get(NEAR[type] ?? '')
  if (!g) return null
  for (let i = 0; i < 4; i++) {
    const { text, want } = g.make(r, lang)
    const sol = solveSchoolTask(text, cmpForm(text), lang, kb)
    if (!sol || sol.type !== g.type) continue
    const printed = sol.answers.map((a) => valueNum(a, lang))
    if (!agrees(sol, want, lang, parseNum, printed)) continue
    return solveProblem(text, lang, kb)
  }
  return null
}

/** Типы задач единицы (свои → близкие → по классу), без повторов. */
export function problemTypesFor(unit: Unit): TaskTypeId[] {
  const own = unit.tasks.types.map((t) => (GEN_BY_TYPE.has(t) ? t : NEAR[t])).filter((t): t is TaskTypeId => !!t)
  return [...new Set([...own, ...(GRADE_DEFAULT[unit.grade] ?? GRADE_DEFAULT[8]!)])]
}

/**
 * 2–3 задачи к единице: задача учебника, если калькулятор её решает (только ru — учебники русские),
 * дальше — по типам единицы. Детерминированно: сид = id единицы + язык + соль.
 */
export function problemsForUnit(unit: Unit, lang: Lang, kb: Knowledge, count: number, salt = ''): Problem[] {
  const out: Problem[] = []
  const r = rng(seedOf(`${unit.id}|${lang}|${salt}`))
  if (lang === 'ru') {
    for (const ex of unit.tasks.examples) {
      if (out.length >= Math.min(1, count)) break
      if (ex.statement.length > 600 || !ex.typeGuess) continue
      const p = solveProblem(ex.statement, lang, kb, 'textbook', ex.page)
      // учебная задача годится, только если калькулятор понял именно её тип
      if (p && p.type === ex.typeGuess) out.push(p)
    }
  }
  const types = problemTypesFor(unit)
  for (let i = 0; out.length < count && i < types.length * 2; i++) {
    const p = generateProblem(types[i % types.length]!, lang, kb, r)
    if (p && !out.some((x) => x.statement === p.statement)) out.push(p)
  }
  return out
}
