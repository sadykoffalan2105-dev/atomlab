/**
 * Аудит 200 неорганических веществ каталога по правилам (строгий рецензент-химик, Kimyo 7–9).
 * Правила (столбец таблицы «правило | нарушений | примеры»):
 *  a1 формула ↔ composition (разбор формулы с индексами, скобками, точкой гидрата);
 *  a2 атомы 3D-модели карточки (buildSchoolHeroModel) ↔ composition (молекула — кратно формуле; кристалл — пропорции);
 *  a3 молярная масса карточки (molarMass, IUPAC) ↔ по школьным Ar (±1 % или ±1,5 г/моль);
 *  a4 типографика формулы: только подстрочные индексы, точка гидрата «·», без ASCII-цифр/«*»/«.»;
 *  b  электронейтральность по школьным степеням окисления (есть согласованное распределение; смешанные с.о. — только у
 *     Fe₃O₄, Mn₃O₄, CaOCl₂, NH₄NO₃/NH₄NO₂-подобных и т.п.);
 *  c  класс (category) по Kimyo 8: оксид — бинарное с O(−2); пероксиды/надпероксиды — не оксиды; основание — M(OH)n /
 *     NH₃·H₂O; кислота — HₙR; соль — катион (металл/NH₄⁺) + кислотный остаток; простое вещество и бинарные гидриды,
 *     карбиды, фосфиды неметаллов-гидридов — 'other' единообразно;
 *  d1 название RU: римская цифра в скобках = степени окисления элемента (если она однозначна), у металлов постоянной
 *     валентности цифры нет, у оксидов неметаллов — есть; «иодид», не «йодид»; «оксид», «гидроксид» в учебной форме;
 *  d2 названия EN/UZ есть (resolver не возвращает null) и римская цифра согласована с формулой; UZ — латиница,
 *     изафет «-i» у анионов (xloridi, sulfati, nitrati …), без кириллицы;
 *  d3 главное имя RU встречается в тексте учебников 7–9 (scripts/kb/.cache/lines-g*.json) — информационно;
 *  e1 геометрия ключевых молекул: длины связей ±0,05 Å, углы ±3° (справочные значения CRC/NIST);
 *  e2 кратности связей школьной графформулы (CO₂ две C=O, CO тройная, N₂ тройная, O₂ двойная, SO₃ три S=O …);
 *  e3 у ионных веществ — нет палочек между ионами (между атомами разных частиц formula unit) и у ионных кристаллов;
 *  f1 получение: каждое уравнение obtainingStepsRu уравнено (атомы каждого элемента слева = справа);
 *  f2 среди шагов есть тот, где само вещество — продукт; условия (t°, катализатор) у реакций, где учебник их требует;
 *  g1 описания: пустые/шаблонные descriptionRu («Ионная соль.», «Неорганическое соединение…», < 60 символов,
 *     дубликаты у разных веществ), EN/UZ из resolver — не пустой fallback;
 *  g2 факты о цвете/состоянии (таблица ожиданий по учебнику: CuSO₄ безводный белый, Fe(OH)₃ бурый, AgCl белый …) —
 *     в descriptionRu + factsRu должно быть ключевое слово, не должно быть противоречащего;
 *  h  formationScripts: тип (S/MP/N/PM/IB/IC/IH) по правилам formation200-rules.md, route уравнен и даёт вещество,
 *     direct ⇔ слева только простые вещества, latticeKind по типу, ΔЭО ≈ разности ЭО по данным проекта.
 * Запуск: npx tsx scripts/audit-catalog-200-rules.mts [--list] [--dump] [--json]
 *   --list  — все замечания построчно; --dump — таблица карточек для чтения глазами в .tmp/audit200/cards.txt;
 *   --json  — машинный отчёт в .tmp/audit200/audit.json. Код выхода 1, если есть нарушения (кроме info-правил d3).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { CATALOG_TOP200_IDS } from '../src/data/catalog/catalogTop200'
import { compoundById } from '../src/data/compounds'
import { resolveCompoundName } from '../src/i18n/compoundNameResolver'
import { resolveCompoundDescription } from '../src/i18n/compoundDescriptionResolver'
import { molarMass } from '../src/components/catalog/catalogVisuals'
import { buildSchoolHeroModel, type SchoolHeroModel } from '../src/components/lab/hero/schoolHeroModel'
import { pmToScene } from '../src/lab/cinema/scenes/kit/cpkAtoms'
import { formationScript } from '../src/chemistry/formationScripts'
import { ATOMIC_DATA, type ElementSymbol } from '../src/chemistry/data/atomicData'
import type { CompoundDef } from '../src/types/chemistry'

const args = new Set(process.argv.slice(2))
const LIST = args.has('--list')
const DUMP = args.has('--dump')
const JSON_OUT = args.has('--json')

// ───────────────────────── справочники ─────────────────────────
/** Школьные Ar (округлённые, как в таблице Менделеева учебника). */
const SCHOOL_AR: Record<string, number> = {
  H: 1, Li: 7, Be: 9, B: 11, C: 12, N: 14, O: 16, F: 19, Na: 23, Mg: 24, Al: 27, Si: 28, P: 31, S: 32, Cl: 35.5, K: 39,
  Ca: 40, Cr: 52, Mn: 55, Fe: 56, Co: 59, Ni: 59, Cu: 64, Zn: 65, Br: 80, Ag: 108, Sn: 119, I: 127, Cs: 133, Ba: 137,
  Au: 197, Hg: 201, Pb: 207, V: 51, Sr: 88,
}
const METALS = new Set(['Li', 'Na', 'K', 'Cs', 'Be', 'Mg', 'Ca', 'Sr', 'Ba', 'Al', 'Zn', 'Cu', 'Fe', 'Pb', 'Ag', 'Hg', 'Au', 'Ni', 'Sn', 'Mn', 'Cr', 'V', 'Co'])
const FIXED_VALENCE_METALS = new Set(['Li', 'Na', 'K', 'Cs', 'Be', 'Mg', 'Ca', 'Sr', 'Ba', 'Al', 'Zn', 'Ag'])
const PEROXIDES = new Set(['h2o2', 'na2o2', 'tb_k2o2', 'tb_bao2', 'li2o2'])
const SUPEROXIDES = new Set(['tb_ko2'])
/** Гидриды металлов: H −1. */
const METAL_HYDRIDES = new Set(['tb_nah', 'tb_kh', 'tb_cah2'])
/** Школьные степени окисления (×2, чтобы −½ у надпероксидов оставалась целой). */
function allowedOx(el: string, id: string, comp: Record<string, number>): number[] {
  const hasO = (comp.O ?? 0) > 0
  const els = Object.keys(comp)
  if (els.length === 1) return [0]
  const t = (xs: number[]) => xs.map((x) => x * 2)
  switch (el) {
    case 'H':
      return METAL_HYDRIDES.has(id) ? t([-1]) : t([1])
    case 'O': {
      if (SUPEROXIDES.has(id)) return [-1] // −½
      if (PEROXIDES.has(id)) return t([-1])
      return t([-2])
    }
    case 'F':
      return t([-1])
    case 'Cl':
    case 'Br':
    case 'I':
      return hasO ? t([-1, 1, 3, 5, 7]) : t([-1])
    case 'S':
      return id === 'fes2' ? t([-1]) : t([-2, 4, 6]) // пирит — дисульфид: S₂²⁻, S −1
    case 'N':
      return t([-3, 1, 2, 3, 4, 5])
    case 'P':
      return t([-3, 3, 5])
    case 'C':
      return t([-4, -1, 2, 4])
    case 'Si':
      return t([-4, 4])
    case 'Li':
    case 'Na':
    case 'K':
    case 'Cs':
    case 'Ag':
      return t([1])
    case 'Be':
    case 'Mg':
    case 'Ca':
    case 'Sr':
    case 'Ba':
    case 'Zn':
      return t([2])
    case 'Al':
      return t([3])
    case 'Fe':
      return t([2, 3])
    case 'Cu':
      return t([1, 2])
    case 'Mn':
      return t([2, 3, 4, 6, 7])
    case 'Cr':
      return t([2, 3, 6])
    case 'Pb':
    case 'Sn':
      return t([2, 4])
    case 'Hg':
      return t([1, 2])
    case 'Au':
      return t([1, 3])
    case 'V':
      return t([5])
    case 'Ni':
    case 'Co':
      return t([2, 3])
    default:
      return t([0])
  }
}

/** Ссылочные геометрии (Å, °): CRC Handbook / NIST CCCBDB; школьные значения совпадают. */
type GeoRef = { bonds?: [string, string, number][]; angle?: [string, number]; orders?: Record<string, number> }
const GEO_REF: Record<string, GeoRef> = {
  h2o: { bonds: [['O', 'H', 0.958]], angle: ['O', 104.5], orders: { 'O-H': 1 } },
  nh3: { bonds: [['N', 'H', 1.012]], angle: ['N', 107], orders: { 'N-H': 1 } },
  co2: { bonds: [['C', 'O', 1.16]], angle: ['C', 180], orders: { 'C-O': 2 } },
  so2: { bonds: [['S', 'O', 1.431]], angle: ['S', 119.3] },
  so3: { bonds: [['S', 'O', 1.42]], angle: ['S', 120], orders: { 'S-O': 2 } },
  h2s: { bonds: [['S', 'H', 1.336]], angle: ['S', 92.1], orders: { 'S-H': 1 } },
  no2: { bonds: [['N', 'O', 1.193]], angle: ['N', 134.1] },
  no: { bonds: [['N', 'O', 1.151]], orders: { 'N-O': 2 } },
  co: { bonds: [['C', 'O', 1.128]], orders: { 'C-O': 3 } },
  hcl: { bonds: [['H', 'Cl', 1.275]], orders: { 'H-Cl': 1 } },
  hbr: { bonds: [['H', 'Br', 1.414]] },
  hi: { bonds: [['H', 'I', 1.609]] },
  hf: { bonds: [['H', 'F', 0.917]] },
  tb_h2: { bonds: [['H', 'H', 0.741]], orders: { 'H-H': 1 } },
  tb_o2: { bonds: [['O', 'O', 1.208]], orders: { 'O-O': 2 } },
  tb_n2: { bonds: [['N', 'N', 1.098]], orders: { 'N-N': 3 } },
  tb_f2: { bonds: [['F', 'F', 1.412]] },
  tb_cl2: { bonds: [['Cl', 'Cl', 1.988]], orders: { 'Cl-Cl': 1 } },
  tb_br2: { bonds: [['Br', 'Br', 2.281]] },
  tb_i2: { bonds: [['I', 'I', 2.666]] },
  tb_o3: { bonds: [['O', 'O', 1.278]], angle: ['O', 116.8] },
  tb_cs2: { bonds: [['C', 'S', 1.553]], angle: ['C', 180], orders: { 'C-S': 2 } },
  tb_ph3: { bonds: [['P', 'H', 1.42]], angle: ['P', 93.5] },
  tb_sih4: { bonds: [['Si', 'H', 1.48]], angle: ['Si', 109.5], orders: { 'Si-H': 1 } },
  tb_sif4: { bonds: [['Si', 'F', 1.553]], angle: ['Si', 109.5], orders: { 'Si-F': 1 } },
  n2o: { bonds: [['N', 'N', 1.128], ['N', 'O', 1.184]], angle: ['N', 180] },
  h2o2: { bonds: [['O', 'O', 1.475], ['O', 'H', 0.95]] },
  tb_p4: { bonds: [['P', 'P', 2.21]], angle: ['P', 60] },
  tb_s8: { bonds: [['S', 'S', 2.05]], angle: ['S', 108] },
  hclo: { bonds: [['Cl', 'O', 1.69], ['O', 'H', 0.97]], angle: ['O', 103] },
  tb_n2o4: { bonds: [['N', 'N', 1.78], ['N', 'O', 1.19]] },
}

/** Ожидания по цвету/состоянию (Kimyo 7–9, справочник): в descriptionRu+factsRu должно быть одно из must, не должно быть mustNot. */
const COLOR_EXPECT: Record<string, { must?: string[]; mustNot?: RegExp[]; src: string }> = {
  salt_cu_so4: { must: ['бел'], mustNot: [/\bсин(ие|яя|ий) кристалл/i], src: 'Kimyo 9, медный купорос синий, безводный CuSO₄ белый' },
  tb_cuso4_5h2o: { must: ['син', 'голуб'], src: 'Kimyo 9 — медный купорос, синие кристаллы' },
  fe_oh_3: { must: ['бур', 'коричн'], mustNot: [/бел(ый|ого) осад/i], src: 'Kimyo 9 — Fe(OH)₃ бурый осадок' },
  fe_oh_2: { must: ['бел', 'зелен', 'зелён'], src: 'Kimyo 9 — Fe(OH)₂ белый (зеленоватый), буреет на воздухе' },
  salt_ag_cl: { must: ['бел'], src: 'Kimyo 8 — AgCl белый творожистый осадок, темнеет на свету' },
  salt_ag_br: { must: ['жёлт', 'желт'], src: 'справочник — AgBr светло-жёлтый' },
  salt_ag_i: { must: ['жёлт', 'желт'], src: 'справочник — AgI жёлтый' },
  no2: { must: ['бур'], src: 'Kimyo 9 — NO₂ бурый газ' },
  tb_cl2: { must: ['жёлто-зел', 'желто-зел'], src: 'Kimyo 8 — хлор жёлто-зелёный газ' },
  tb_br2: { must: ['бур', 'красн'], src: 'Kimyo 8 — бром красно-бурая жидкость' },
  tb_i2: { must: ['фиолет', 'сер', 'чёрн', 'черн'], src: 'Kimyo 8 — иод тёмно-серые/фиолетовые кристаллы' },
  cuo: { must: ['чёрн', 'черн'], src: 'Kimyo 7 — CuO чёрный порошок' },
  cu_oh_2: { must: ['голуб', 'син'], src: 'Kimyo 7 — Cu(OH)₂ голубой осадок' },
  cu2o: { must: ['красн', 'кирпич'], src: 'справочник — Cu₂O красный' },
  salt_k_mno4: { must: ['фиолет', 'малинов'], src: 'Kimyo 8 — KMnO₄ фиолетовые кристаллы' },
  salt_k2cr2o7: { must: ['оранж'], src: 'Kimyo 9 — K₂Cr₂O₇ оранжевый' },
  cr2o3: { must: ['зелён', 'зелен'], src: 'Kimyo 9 — Cr₂O₃ зелёный' },
  salt_fe2_s: { must: ['чёрн', 'черн', 'тёмн', 'темн'], src: 'Kimyo 8 — FeS чёрный/тёмно-серый' },
  mno2: { must: ['чёрн', 'черн', 'тёмн', 'темн', 'бур'], src: 'справочник — MnO₂ чёрный' },
  fe2o3: { must: ['бур', 'красн', 'ржав'], src: 'Kimyo 9 — Fe₂O₃ красно-бурый' },
  tb_s8: { must: ['жёлт', 'желт'], src: 'Kimyo 8 — сера жёлтая' },
  tb_p4: { must: ['бел'], src: 'Kimyo 9 — белый фосфор' },
  salt_pb_i: { must: ['жёлт', 'желт', 'золот'], src: 'справочник — PbI₂ золотисто-жёлтый' },
  salt_pb_s: { must: ['чёрн', 'черн'], src: 'справочник — PbS чёрный' },
  salt_zn_s: { must: ['бел'], src: 'справочник — ZnS белый' },
  salt_cu_s: { must: ['чёрн', 'черн'], src: 'справочник — CuS чёрный' },
  salt_ba_so4: { must: ['бел'], src: 'Kimyo 8 — BaSO₄ белый осадок' },
  tb_hgo: { must: ['красн', 'жёлт', 'желт'], src: 'справочник — HgO красный/жёлтый' },
  tb_ag3po4: { must: ['жёлт', 'желт'], src: 'Kimyo 9 — Ag₃PO₄ жёлтый осадок' },
  cro3: { must: ['красн', 'тёмно', 'темно'], src: 'справочник — CrO₃ тёмно-красный' },
  h2sio3: { must: ['студ', 'гел', 'осад'], src: 'Kimyo 9 — H₂SiO₃ студенистый осадок' },
  al_oh_3: { must: ['бел', 'студ'], src: 'Kimyo 9 — Al(OH)₃ белый студенистый осадок' },
  zn_oh_2: { must: ['бел'], src: 'Kimyo 9 — Zn(OH)₂ белый осадок' },
  mg_oh_2: { must: ['бел'], src: 'справочник — Mg(OH)₂ белый' },
  salt_ca_co3: { must: ['бел', 'мел', 'мрамор', 'известн'], src: 'Kimyo 7 — CaCO₃ мел, мрамор, известняк' },
  tb_cuoh2co3: { must: ['зелён', 'зелен'], src: 'Kimyo 7 — малахит зелёный' },
  h2s: { must: ['тухл', 'яйц', 'ядовит'], src: 'Kimyo 8 — H₂S запах тухлых яиц, ядовит' },
  nh3: { must: ['резк'], src: 'Kimyo 9 — аммиак бесцветный газ с резким запахом' },
  tb_f2: { must: ['жёлт', 'желт'], src: 'Kimyo 8 — фтор светло-жёлтый газ' },
  co: { must: ['ядовит', 'без запаха'], src: 'Kimyo 7 — угарный газ ядовит, без запаха' },
}

/** Обязательные условия в шагах получения (хотя бы в одном шаге, дающем вещество). */
const COND_EXPECT: Record<string, { re: RegExp; src: string }> = {
  so3: { re: /V₂O₅|кат/i, src: 'Kimyo 8 — контактный процесс, катализатор V₂O₅' },
  nh3: { re: /кат|Fe|p|t°/i, src: 'Kimyo 9 — синтез NH₃: катализатор, давление, t°' },
  hno3: { re: /Pt|кат|t°|O₂|NO₂/i, src: 'Kimyo 9 — HNO₃ из NH₃ через NO/NO₂' },
  cao: { re: /t°|°C/, src: 'Kimyo 7 — обжиг известняка' },
}

// ───────────────────────── утилиты ─────────────────────────
const SUB = '₀₁₂₃₄₅₆₇₈₉'
const toAscii = (s: string) => [...s].map((ch) => (SUB.includes(ch) ? String(SUB.indexOf(ch)) : ch)).join('')
type Counts = Record<string, number>
function addInto(dst: Counts, src: Counts, k = 1) {
  for (const [el, n] of Object.entries(src)) dst[el] = (dst[el] ?? 0) + n * k
}
/** Разбор формулы: индексы, (), [], точка гидрата «·» с множителем. Бросает при мусоре. */
export function parseFormulaCounts(formulaUnicode: string): Counts {
  const total: Counts = {}
  for (const partRaw of formulaUnicode.split(/[·⋅]/)) {
    const part = toAscii(partRaw.trim())
    const mm = part.match(/^(\d+)(.*)$/)
    const mult = mm ? Number(mm[1]) : 1
    const body = mm ? mm[2]! : part
    let i = 0
    const parseGroup = (): Counts => {
      const out: Counts = {}
      while (i < body.length) {
        const ch = body[i]!
        if (ch === '(' || ch === '[') {
          i++
          const inner = parseGroup()
          const m = body.slice(i).match(/^\d+/)
          const n = m ? Number(m[0]) : 1
          if (m) i += m[0].length
          addInto(out, inner, n)
        } else if (ch === ')' || ch === ']') {
          i++
          return out
        } else {
          const m = body.slice(i).match(/^([A-Z][a-z]?)(\d*)/)
          if (!m) throw new Error(`формула не разбирается: «${formulaUnicode}» у «${body.slice(i)}»`)
          i += m[0].length
          out[m[1]!] = (out[m[1]!] ?? 0) + (m[2] ? Number(m[2]) : 1)
        }
      }
      return out
    }
    addInto(total, parseGroup(), mult)
  }
  return total
}
const keyOf = (c: Counts) =>
  Object.entries(c)
    .filter(([, n]) => n > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, n]) => `${k}:${n}`)
    .join('|')
function gcdAll(ns: number[]): number {
  const g = (a: number, b: number): number => (b ? g(b, a % b) : a)
  return ns.reduce((acc, n) => g(acc, n), 0) || 1
}
const reduced = (c: Counts) => {
  const g = gcdAll(Object.values(c))
  return Object.fromEntries(Object.entries(c).map(([k, n]) => [k, n / g]))
}

/** Разбор уравнения: → = ⇄ ⇌; условия после стрелки; состояния; ↑↓. */
function parseEquation(eq: string): { left: Counts; right: Counts; products: string[]; reagents: string[]; cond: string } | null {
  let cond = ''
  let s = eq.replace(/[↑↓]/g, '')
  // условия пишутся вплотную к стрелке: «→(t°)», «→(электролиз)»; «→ (NH₄)₂SO₄» — продукт
  s = s.replace(/(→|⟶|=|⇄|⇌)\(([^)]*)\)/g, (_m, arrow: string, c: string) => {
    cond += c + ' '
    return arrow
  })
  s = s.replace(/\((разб\.|конц\.|тв\.|р-р|г|ж|к|водн\.|пар|изб\.|расплав|p|t°)\)/g, '')
  const m = s.split(/→|⟶|⇄|⇌|(?<![⁺⁻])=/)
  if (m.length !== 2) return null
  const side = (txt: string) => {
    const counts: Counts = {}
    const names: string[] = []
    for (const termRaw of txt.split(/\s\+\s|\+(?=\s*\d*[A-Z(])/)) {
      const term = termRaw.trim()
      if (!term) continue
      const mm = term.match(/^(\d+)?\s*(.+)$/)
      const coef = mm?.[1] ? Number(mm[1]) : 1
      const f = (mm?.[2] ?? term).trim()
      names.push(f)
      addInto(counts, parseFormulaCounts(f), coef)
    }
    return { counts, names }
  }
  try {
    const L = side(m[0]!)
    const R = side(m[1]!)
    return { left: L.counts, right: R.counts, reagents: L.names, products: R.names, cond: cond.trim() }
  } catch {
    return null
  }
}
const isSimpleSubstance = (f: string) => Object.keys(parseFormulaCounts(f)).length === 1

/** Электронейтральность: есть ли распределение с.о. (×2) с суммой 0; возвращает по элементам однозначную с.о., если она единственная. */
function solveOx(id: string, comp: Counts): { ok: boolean; mixed: boolean; unique: Record<string, number | null> } {
  const els = Object.keys(comp)
  // достижимые суммы для элемента с n атомами
  const sums = els.map((el) => {
    const allowed = allowedOx(el, id, comp)
    const n = comp[el]!
    let reach = new Map<number, Set<string>>() // сумма → наборы (строка с.о. через запятую)
    reach.set(0, new Set(['']))
    for (let k = 0; k < n; k++) {
      const next = new Map<number, Set<string>>()
      for (const [s, sets] of reach)
        for (const o of allowed) {
          const ns = s + o
          const set = next.get(ns) ?? new Set<string>()
          for (const p of sets) set.add(p ? `${p},${o}` : `${o}`)
          next.set(ns, set)
        }
      reach = next
    }
    return { el, reach }
  })
  // DP по элементам
  let dp = new Map<number, string[][]>()
  dp.set(0, [[]])
  for (const { reach } of sums) {
    const next = new Map<number, string[][]>()
    for (const [s, paths] of dp)
      for (const [es, sets] of reach) {
        const ns = s + es
        const arr = next.get(ns) ?? []
        for (const p of paths) for (const set of sets) arr.push([...p, set])
        next.set(ns, arr.slice(0, 50))
      }
    dp = next
  }
  const sol = dp.get(0) ?? []
  if (sol.length === 0) return { ok: false, mixed: false, unique: {} }
  // предпочитаем решения без смешанных с.о.
  const pure = sol.filter((p) => p.every((set) => new Set(set.split(',')).size === 1))
  const use = pure.length ? pure : sol
  const unique: Record<string, number | null> = {}
  els.forEach((el, i) => {
    const vals = new Set(use.map((p) => p[i]!))
    if (vals.size === 1) {
      const parts = [...vals][0]!.split(',').map(Number)
      unique[el] = new Set(parts).size === 1 ? parts[0]! / 2 : null
    } else unique[el] = null
  })
  return { ok: true, mixed: pure.length === 0, unique }
}

const ROMAN: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8 }
function romanIn(name: string): number[] {
  return [...name.matchAll(/\((I|II|III|IV|V|VI|VII|VIII)(?:,\s*(I|II|III|IV|V|VI|VII|VIII))?\)/g)].flatMap((m) =>
    [m[1], m[2]].filter(Boolean).map((r) => ROMAN[r!]!),
  )
}

/** Текст учебников 7–9 (если кэш есть) для информационной проверки имён. */
function loadTextbookText(): string | null {
  const dirs = ['scripts/kb/.cache', join(process.env.ATOMLAB_MAIN_REPO ?? 'C:/Users/Первый/Desktop/химия', 'scripts/kb/.cache')]
  for (const d of dirs) {
    const files = ['lines-g7.json', 'lines-g8.json', 'lines-g9.json'].map((f) => join(d, f))
    if (!files.every((f) => existsSync(f))) continue
    try {
      let out = ''
      for (const f of files) {
        const pages = JSON.parse(readFileSync(f, 'utf8')) as { lines: { t: string }[] }[]
        for (const p of pages) out += p.lines.map((l) => l.t).join(' ') + '\n'
      }
      return out.toLowerCase().replace(/ё/g, 'е')
    } catch {
      return null
    }
  }
  return null
}

// ───────────────────────── аудит ─────────────────────────
type Rule = 'a1' | 'a2' | 'a3' | 'a4' | 'b' | 'c' | 'd1' | 'd2' | 'd3' | 'e1' | 'e2' | 'e3' | 'f1' | 'f2' | 'g1' | 'g2' | 'h'
const RULES: Record<Rule, string> = {
  a1: 'формула ↔ composition',
  a2: 'атомы 3D-модели ↔ composition',
  a3: 'молярная масса карточки ↔ школьные Ar',
  a4: 'типографика формулы (индексы, «·»)',
  b: 'электронейтральность по школьным с.о.',
  c: 'класс (category) по Kimyo 8',
  d1: 'название RU (номенклатура, римские цифры)',
  d2: 'названия EN/UZ (есть, согласованы, латиница)',
  d3: 'имя RU встречается в учебниках 7–9 (info)',
  e1: 'геометрия ключевых молекул (±0,05 Å, ±3°)',
  e2: 'кратности связей школьной графформулы',
  e3: 'ионные: нет палочек между ионами',
  f1: 'получение: уравнения уравнены',
  f2: 'получение: вещество — продукт; условия',
  g1: 'описания: пустые/шаблонные/дубликаты, EN/UZ',
  g2: 'факты о цвете/состоянии по учебнику',
  h: 'formationScripts: тип/route/direct/решётка/ΔЭО',
}
const INFO_RULES = new Set<Rule>(['d3'])
const viol: Record<Rule, Map<string, string>> = Object.fromEntries(Object.keys(RULES).map((k) => [k, new Map()])) as Record<Rule, Map<string, string>>
const flag = (r: Rule, id: string, msg: string) => {
  const m = viol[r]
  m.set(id, m.has(id) ? `${m.get(id)}; ${msg}` : msg)
}

const K = pmToScene(1)
const dist = (a: number[], b: number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!)
const angleDeg = (c: number[], a: number[], b: number[]) => {
  const u = [a[0]! - c[0]!, a[1]! - c[1]!, a[2]! - c[2]!]
  const v = [b[0]! - c[0]!, b[1]! - c[1]!, b[2]! - c[2]!]
  const d = u[0]! * v[0]! + u[1]! * v[1]! + u[2]! * v[2]!
  return (Math.acos(Math.max(-1, Math.min(1, d / (Math.hypot(...u) * Math.hypot(...v))))) * 180) / Math.PI
}

const textbook = loadTextbookText()
const descSeen = new Map<string, string>()
const dumpRows: Record<string, unknown>[] = []

for (const id of CATALOG_TOP200_IDS) {
  const c: CompoundDef | undefined = compoundById[id]
  if (!c) {
    flag('a1', id, 'нет вещества в compoundById')
    continue
  }
  const comp = c.composition
  const f = c.formulaUnicode
  const els = Object.keys(comp)
  const single = els.length === 1
  const hasMetal = els.some((e) => METALS.has(e))
  const isAmmonium = /NH₄/.test(f) || id.includes('nh4')

  // a1 формула ↔ composition
  let parsed: Counts | null = null
  try {
    parsed = parseFormulaCounts(f)
    if (keyOf(parsed) !== keyOf(comp)) flag('a1', id, `формула ${f} → ${keyOf(parsed)} ≠ composition ${keyOf(comp)}`)
  } catch (e) {
    flag('a1', id, String((e as Error).message))
  }
  // a4 типографика
  if (/(?<!·)[0-9]/.test(f.replace(/·\d+/g, '·'))) flag('a4', id, `ASCII-цифра в формуле «${f}» (допустима только как множитель после «·»)`)
  if (/[*.⋅x]/.test(f)) flag('a4', id, `точка гидрата должна быть «·» в «${f}»`)
  if (/\s/.test(f)) flag('a4', id, `пробел в формуле «${f}»`)

  // a3 молярная масса
  const mCard = molarMass(comp)
  const mSchool = els.every((e) => SCHOOL_AR[e] != null) ? els.reduce((s, e) => s + SCHOOL_AR[e]! * comp[e]!, 0) : null
  if (mCard == null) flag('a3', id, 'molarMass карточки = null')
  else if (mSchool == null) flag('a3', id, `нет школьного Ar для ${els.filter((e) => SCHOOL_AR[e] == null).join(', ')}`)
  else if (Math.abs(mCard - mSchool) > Math.max(1.5, 0.01 * mSchool)) flag('a3', id, `карточка ${mCard.toFixed(2)} ≠ школьная ${mSchool}`)

  // a2 3D-модель
  let model: SchoolHeroModel | null = null
  try {
    model = buildSchoolHeroModel(c)
  } catch (e) {
    flag('a2', id, `модель не строится: ${(e as Error).message}`)
  }
  if (!model) flag('a2', id, 'buildSchoolHeroModel → null')
  else {
    const mc: Counts = {}
    for (const a of model.atoms) mc[a.el] = (mc[a.el] ?? 0) + 1
    if (model.kind === 'crystal') {
      // фрагмент из целых ячеек: пропорции ± 15 % (на гранях — лишние ионы одного сорта)
      const tot = model.atoms.length
      const bad = els.filter((e) => Math.abs((mc[e] ?? 0) / tot - comp[e]! / Object.values(comp).reduce((s, n) => s + n, 0)) > 0.15)
      if (bad.length) flag('a2', id, `кристалл: пропорции ${keyOf(mc)} далеки от ${keyOf(comp)}`)
    } else {
      const mult = model.formulaMultiple ?? 1
      const exp: Counts = Object.fromEntries(els.map((e) => [e, comp[e]! * mult]))
      if (keyOf(mc) !== keyOf(exp)) flag('a2', id, `модель ${keyOf(mc)} ≠ формула×${mult} ${keyOf(exp)}`)
    }
  }

  // b электронейтральность
  const ox = solveOx(id, comp)
  if (!ox.ok) flag('b', id, `нет распределения школьных с.о. с суммой 0 (${f})`)
  const MIXED_OK = new Set(['fe3o4', 'tb_mn3o4', 'tb_caocl2', 'salt_nh4_no3', 'salt_nh4_no2', 'tb_pb3o4', 'salt_k_no2', 'salt_na_no2'])
  if (ox.ok && ox.mixed && !MIXED_OK.has(id)) flag('b', id, `только смешанные с.о. (${f}) — проверить`)

  // c класс
  const cat = c.category
  const nO = comp.O ?? 0
  const nH = comp.H ?? 0
  const expectCat = (() => {
    if (single) return 'other'
    if (PEROXIDES.has(id) || SUPEROXIDES.has(id)) return 'other'
    if (id === 'fes2') return 'other' // пирит FeS₂ — дисульфид (S₂²⁻), не соль H₂S; в проекте — «прочее», как бинарные карбиды
    if (['hmno4', 'h2cro4', 'h2cr2o7'].includes(id)) return 'acid' // кислоты с Mn/Cr в кислотном остатке
    if (els.length === 2 && nO > 0 && !isAmmonium) return 'oxide'
    if (id === 'nh3_h2o') return 'base'
    if (hasMetal && nO > 0 && nH > 0 && nO === nH && els.length === 3) return 'base'
    const otherHydrides = new Set(['nh3', 'tb_ph3', 'tb_sih4', 'ch4', 'tb_nah', 'tb_kh', 'tb_cah2', 'tb_cac2', 'tb_al4c3', 'tb_ca3p2', 'tb_cs2', 'tb_sif4'])
    if (otherHydrides.has(id)) return 'other'
    if (!hasMetal && !isAmmonium && nH > 0) return 'acid'
    if (hasMetal || isAmmonium) return 'salt'
    return 'other'
  })()
  if (cat !== expectCat) flag('c', id, `category «${cat}», по правилам Kimyo 8 — «${expectCat}» (${f})`)

  // d1 название RU
  const name = c.nameRu
  const romans = romanIn(name)
  const variable = els.filter((e) => e !== 'O' && e !== 'H' && !FIXED_VALENCE_METALS.has(e))
  // Kimyo 8 пишет «йод», проект и ИЮПАК-рус — «иод»: требуем единообразия внутри проекта («Иодид калия», «Иод»)
  if (/йод/i.test(name)) flag('d1', id, `«йод» → «иод» (единообразно с «Иодид …», «Иод» в каталоге): «${name}»`)
  if (/^Окись|^Закись|^Едкий|^Едкое/i.test(name)) flag('d1', id, `устаревшее имя «${name}»`)
  if (cat === 'oxide' || cat === 'base' || cat === 'salt') {
    const central = cat === 'salt' ? els.find((e) => METALS.has(e)) : els.find((e) => e !== 'O' && e !== 'H')
    if (central && romans.length) {
      const u = ox.unique[central]
      if (u != null && !romans.includes(u)) flag('d1', id, `римская цифра (${romans.join(',')}) ≠ с.о. ${central} ${u} в «${name}» (${f})`)
    }
    if (central && FIXED_VALENCE_METALS.has(central) && romans.length) flag('d1', id, `у ${central} постоянная валентность — цифра лишняя: «${name}»`)
    if (cat === 'oxide' && central && !FIXED_VALENCE_METALS.has(central) && !romans.length && !/^Вода$/.test(name) && !/газ|ангидрид|купорос/i.test(name))
      flag('d1', id, `у оксида переменновалентного элемента нужна римская цифра: «${name}» (${f})`)
  }
  if (cat === 'oxide' && !/^Оксид|^Вода$/.test(name)) flag('d1', id, `главное имя — учебное «Оксид …(n)», тривиальное — в описании: «${name}»`)
  if (cat === 'base' && !/^Гидроксид|^Гидрат аммиака|^Аммиачная вода/.test(name)) flag('d1', id, `основание именуется «Гидроксид …»: «${name}»`)
  if (cat === 'acid' && !/кислота|водород$/i.test(name)) flag('d1', id, `кислота именуется «… кислота»: «${name}»`)
  if (variable.length === 0 && romans.length && cat !== 'salt') flag('d1', id, `римская цифра у элемента постоянной валентности: «${name}»`)

  // d2 EN/UZ
  const en = resolveCompoundName(id, 'en')
  const uz = resolveCompoundName(id, 'uz')
  if (!en) flag('d2', id, 'нет EN-названия (fallback на RU)')
  if (!uz) flag('d2', id, 'нет UZ-названия (fallback на RU)')
  if (uz && /[А-Яа-яЁё]/.test(uz)) flag('d2', id, `UZ содержит кириллицу: «${uz}»`)
  if (uz && /ʼ|’/.test(uz) === false && /'/.test(uz) && !/[\w]'[\w]/.test(uz)) flag('d2', id, `UZ: апостроф «${uz}»`)
  for (const [loc, nm] of [['EN', en], ['UZ', uz]] as const) {
    if (!nm) continue
    const r = romanIn(nm)
    if (r.length && romans.length && (r.length !== romans.length || r.some((x, i) => x !== romans[i]))) flag('d2', id, `${loc} «${nm}»: римская цифра ≠ RU «${name}»`)
    if (r.length && !romans.length && cat !== 'salt' && !/^(Вода|Углекислый|Угарный|Сернистый|Серный)/.test(name)) flag('d2', id, `${loc} «${nm}» с цифрой, RU «${name}» без`)
  }
  if (uz && cat === 'salt' && id.startsWith('salt_') && !/i$/.test(uz.split(' ').pop() ?? '')) flag('d2', id, `UZ изафет «-i» у аниона: «${uz}»`)
  if (uz && (cat === 'oxide' || cat === 'base') && !/(oksidi|gidroksidi|Suv|peroksidi|ammiak)$/i.test(uz.replace(/\s*\(.*\)$/, '')))
    flag('d2', id, `UZ оксид/основание: «${uz}»`)

  // d3 имя в учебнике (info)
  if (textbook) {
    const needle = name.toLowerCase().replace(/ё/g, 'е')
    const alt = needle.replace(/\(([ivx]+)\)/, ' ($1)')
    if (!textbook.includes(needle) && !textbook.includes(alt)) flag('d3', id, `«${name}» не найдено в тексте Kimyo 7–9`)
  }

  // e1/e2/e3 геометрия модели
  if (model) {
    const ref = GEO_REF[id]
    const pos = model.atoms.map((a) => a.pos as unknown as number[])
    if (ref?.bonds) {
      for (const [ea, eb, refA] of ref.bonds) {
        const ds = model.bonds
          .filter((b) => {
            const x = model!.atoms[b.a]!.el
            const y = model!.atoms[b.b]!.el
            return (x === ea && y === eb) || (x === eb && y === ea)
          })
          .map((b) => dist(pos[b.a]!, pos[b.b]!) / K / 100)
        if (!ds.length) flag('e1', id, `нет связи ${ea}–${eb} в модели`)
        else {
          // у HNO₃/N₂O₄ разные длины — проверяем, что хотя бы одна в допуске и все в ±0,15
          const bad = ds.filter((d) => Math.abs(d - refA) > 0.05)
          if (bad.length === ds.length) flag('e1', id, `${ea}–${eb} ${ds.map((d) => d.toFixed(3)).join('/')} Å, справочник ${refA}`)
        }
      }
    }
    if (ref?.angle) {
      const [ce, refDeg] = ref.angle
      const centers = model.atoms.map((a, i) => [a.el, i] as const).filter(([e]) => e === ce).map(([, i]) => i)
      const angles: number[] = []
      for (const ci of centers) {
        const nb = model.bonds.filter((b) => b.a === ci || b.b === ci).map((b) => (b.a === ci ? b.b : b.a))
        for (let i = 0; i < nb.length; i++) for (let j = i + 1; j < nb.length; j++) angles.push(angleDeg(pos[ci]!, pos[nb[i]!]!, pos[nb[j]!]!))
      }
      if (!angles.length) flag('e1', id, `нет угла при ${ce}`)
      else {
        const bad = angles.filter((a) => Math.abs(a - refDeg) > 3)
        if (bad.length) flag('e1', id, `∠ при ${ce} ${bad.map((a) => a.toFixed(1)).join('/')}°, справочник ${refDeg}°`)
      }
    }
    if (ref?.orders) {
      for (const [pair, ord] of Object.entries(ref.orders)) {
        const [ea, eb] = pair.split('-') as [string, string]
        const bad = model.bonds.filter((b) => {
          const x = model!.atoms[b.a]!.el
          const y = model!.atoms[b.b]!.el
          return ((x === ea && y === eb) || (x === eb && y === ea)) && b.order !== ord
        })
        if (bad.length) flag('e2', id, `${pair}: кратность ${bad.map((b) => b.order).join('/')} ≠ ${ord}`)
      }
    }
    const fs = formationScript(id)
    const ionic = fs ? fs.type === 'IB' || fs.type === 'IC' || fs.type === 'IH' : cat === 'salt'
    if (ionic && model.ions?.length) {
      const ionOf = new Map<number, string>()
      model.ions.forEach((ion) => ion.atoms.forEach((ai) => ionOf.set(ai, ion.key)))
      const cross = model.bonds.filter((b) => ionOf.get(b.a) !== ionOf.get(b.b))
      if (cross.length) flag('e3', id, `${cross.length} палочек между разными ионами`)
    }
    if (ionic && model.kind === 'crystal') {
      // внутри многоатомного иона (S–O в BaSO₄, C–O в CaCO₃) палочки допустимы; между катионом и анионом — нет
      const cross = model.bonds.filter((b) => METALS.has(model!.atoms[b.a]!.el) || METALS.has(model!.atoms[b.b]!.el))
      if (cross.length) flag('e3', id, `ионный кристалл: ${cross.length} палочек катион–анион`)
    }
    if (ionic && model.kind !== 'crystal' && !model.ions?.length && model.bonds.length && single === false)
      flag('e3', id, 'ионное вещество без разбиения на ионы (ions) — палочки между ионами не проверить')
  }

  // f1/f2 получение
  const steps = c.obtainingStepsRu ?? []
  let givesProduct = false
  let condText = ''
  for (const st of steps) {
    const pe = parseEquation(st.equation)
    if (!pe) {
      flag('f1', id, `не разбирается: «${st.equation}»`)
      continue
    }
    if (keyOf(pe.left) !== keyOf(pe.right)) flag('f1', id, `не уравнено: «${st.equation}» (${keyOf(pe.left)} vs ${keyOf(pe.right)})`)
    const prodMatch = pe.products.some((p) => {
      try {
        const pc = parseFormulaCounts(p)
        // простые вещества в уравнениях пишут как S, P, O₂ — сравниваем по элементу
        return single ? keyOf(reduced(pc)) === keyOf(reduced(comp)) : keyOf(pc) === keyOf(comp)
      } catch {
        return false
      }
    })
    if (prodMatch) {
      givesProduct = true
      condText += ` ${st.equation} ${st.note ?? ''}`
    }
  }
  if (!steps.length) flag('f2', id, 'нет шагов получения')
  else if (!givesProduct) flag('f2', id, `ни один шаг не даёт ${f}`)
  const ce = COND_EXPECT[id]
  if (ce && givesProduct && !ce.re.test(condText)) flag('f2', id, `нет условий (${ce.src})`)
  if (c.laboratoryRecipeRu.includes('=') && !/[\n①]/.test(c.laboratoryRecipeRu)) {
    const pe = parseEquation(c.laboratoryRecipeRu)
    if (pe && keyOf(pe.left) !== keyOf(pe.right)) flag('f1', id, `laboratoryRecipeRu не уравнен: «${c.laboratoryRecipeRu}»`)
  }

  // g1 описания
  const d = c.descriptionRu.trim()
  if (d.length < 60) flag('g1', id, `descriptionRu короткое/шаблон: «${d}»`)
  if (/^Ионная соль\.?$|Неорганическое соединение\.|Оксид — сложное вещество|Соль — сложное вещество|Гидрид металла\.|Карбид\./.test(d))
    flag('g1', id, `шаблонная фраза: «${d.slice(0, 80)}…»`)
  const prev = descSeen.get(d)
  if (prev) flag('g1', id, `descriptionRu совпадает с ${prev}`)
  else descSeen.set(d, id)
  const fallbackMark = '__FALLBACK__'
  const enD = resolveCompoundDescription(id, cat, 'en', () => fallbackMark, f, '')
  const uzD = resolveCompoundDescription(id, cat, 'uz', () => fallbackMark, f, '')
  if (enD === fallbackMark) flag('g1', id, 'EN-описание — общий fallback')
  if (uzD === fallbackMark) flag('g1', id, 'UZ-описание — общий fallback')
  if (/[А-Яа-яЁё]/.test(uzD) && uzD !== fallbackMark) flag('g1', id, 'UZ-описание содержит кириллицу')
  // g2 цвет/состояние
  const ex = COLOR_EXPECT[id]
  const allRu = `${d} ${c.factsRu.source} ${c.factsRu.usage} ${c.factsRu.importance} ${Object.values(c.synthesisConditionsRu).join(' ')}`.toLowerCase()
  if (ex) {
    if (ex.must && !ex.must.some((w) => allRu.includes(w))) flag('g2', id, `нет «${ex.must.join('/')}» (${ex.src})`)
    if (ex.mustNot?.some((re) => re.test(allRu))) flag('g2', id, `противоречие (${ex.src})`)
  }

  // h formationScripts
  const fs = formationScript(id)
  if (!fs) flag('h', id, 'нет сценария formationScripts')
  else {
    const expectType = (() => {
      if (single) return 'S'
      if (id === 'nh3_h2o') return 'MP' // гидрат аммиака — молекула NH₃·H₂O, не кристаллогидрат
      if (/·/.test(f)) return 'IH'
      if (id === 'tb_cac2' || id === 'fes2') return 'IC' // многоатомные анионы C₂²⁻, S₂²⁻ (правила: ацетилениды — IC)
      if (id === 'sio2') return 'N'
      if (['cro3', 'tb_v2o5', 'h2sio3', 'tb_hpo3'].includes(id)) return 'PM'
      if (PEROXIDES.has(id) && id !== 'h2o2') return 'IC'
      if (SUPEROXIDES.has(id)) return 'IC'
      if (hasMetal || isAmmonium) {
        if (['tb_mn2o7', 'cro3', 'tb_v2o5', 'tb_aucl3', 'tb_cl2o7'].includes(id)) return fs.type // ковалентные оксиды/хлориды металлов — по таблице правил
        return els.length === 2 && !isAmmonium ? 'IB' : 'IC'
      }
      return 'MP'
    })()
    if (fs.type !== expectType) flag('h', id, `тип ${fs.type}, по правилам — ${expectType} (${f})`)
    const pe = parseEquation(fs.route)
    if (!pe) flag('h', id, `route не разбирается: «${fs.route}»`)
    else {
      if (keyOf(pe.left) !== keyOf(pe.right)) flag('h', id, `route не уравнен: «${fs.route}»`)
      const gives = pe.products.some((p) => {
        try {
          return keyOf(parseFormulaCounts(p)) === keyOf(comp)
        } catch {
          return false
        }
      })
      if (!gives && !single) flag('h', id, `route не даёт ${f}: «${fs.route}»`)
      const allSimple = pe.reagents.every((r) => {
        try {
          return isSimpleSubstance(r)
        } catch {
          return false
        }
      })
      if (!single && fs.direct !== allSimple) flag('h', id, `direct=${fs.direct}, а слева ${allSimple ? 'только простые' : 'сложные'}: «${fs.route}»`)
    }
    const lk = fs.latticeKind
    const okLattice =
      fs.type === 'S' || fs.type === 'MP'
        ? lk === 'molecular' || lk === 'none'
        : fs.type === 'N'
          ? lk === 'network'
          : fs.type === 'PM'
            ? lk === 'chain'
            : lk === 'generator' || lk === 'schema'
    if (!okLattice) flag('h', id, `latticeKind «${lk}» не по типу ${fs.type}`)
    if (!single) {
      const ens = els.map((e) => ATOMIC_DATA[e as ElementSymbol]?.electronegativity ?? null).filter((x): x is number => x != null)
      if (ens.length >= 2) {
        const dEN = Math.max(...ens) - Math.min(...ens)
        if (Math.abs(dEN - fs.dEN) > 0.25) flag('h', id, `ΔЭО ${fs.dEN} ≠ ${dEN.toFixed(2)} по данным проекта`)
      }
    }
  }

  if (DUMP) {
    dumpRows.push({
      id,
      f,
      name,
      cat,
      en,
      uz,
      M: mCard?.toFixed(2),
      ox: Object.entries(ox.unique)
        .map(([e, v]) => `${e}${v == null ? '?' : v > 0 ? `+${v}` : v}`)
        .join(' '),
      desc: d,
      enD,
      uzD,
      recipe: c.laboratoryRecipeRu,
      steps: steps.map((s) => `${s.step}. ${s.equation}${s.note ? ` — ${s.note}` : ''}`),
      cond: c.synthesisConditionsRu,
      facts: c.factsRu,
      fs: fs ? { type: fs.type, route: fs.route, routeKind: fs.routeKind, direct: fs.direct, lattice: fs.lattice, latticeKind: fs.latticeKind, dEN: fs.dEN, special: fs.special } : null,
      model: model ? { kind: model.kind, source: model.source, atoms: model.atoms.length, bonds: model.bonds.length, ions: model.ions?.map((i) => i.label) } : null,
    })
  }
}

// ───────────────────────── отчёт ─────────────────────────
const rows = (Object.keys(RULES) as Rule[]).map((r) => {
  const m = viol[r]
  const ex = [...m.entries()].slice(0, 3).map(([id, msg]) => `${id}: ${msg.slice(0, 90)}`)
  return { rule: r, label: RULES[r], n: m.size, examples: ex }
})
console.log('Аудит каталога 200 по правилам (Kimyo 7–9)')
console.log('правило | нарушений | примеры')
for (const r of rows) console.log(`${r.rule.padEnd(3)} ${r.label.padEnd(46)} | ${String(r.n).padStart(3)} | ${r.examples.join(' ‖ ')}`)
if (LIST) {
  console.log('\n— все замечания —')
  for (const r of Object.keys(RULES) as Rule[]) for (const [id, msg] of viol[r]) console.log(`${r} ${id}: ${msg}`)
}
if (DUMP || JSON_OUT) {
  mkdirSync('.tmp/audit200', { recursive: true })
  if (JSON_OUT) writeFileSync('.tmp/audit200/audit.json', JSON.stringify({ rows, notes: Object.fromEntries((Object.keys(RULES) as Rule[]).map((r) => [r, Object.fromEntries(viol[r])])) }, null, 1))
  if (DUMP) {
    writeFileSync('.tmp/audit200/cards.json', JSON.stringify(dumpRows, null, 1))
    const txt = dumpRows
      .map((r) => {
        const o = r as Record<string, unknown>
        const cond = o.cond as Record<string, string>
        const facts = o.facts as Record<string, string>
        return [
          `=== ${o.id} | ${o.f} | ${o.name} | ${o.cat} | M=${o.M} | ${o.ox}`,
          `EN: ${o.en} | UZ: ${o.uz}`,
          `RU: ${o.desc}`,
          `ENd: ${o.enD}`,
          `UZd: ${o.uzD}`,
          `recipe: ${String(o.recipe).replace(/\n/g, ' ⏎ ')}`,
          ...(o.steps as string[]).map((s) => `  ${s}`),
          `cond: ${Object.values(cond).join(' | ')}`,
          `facts.source: ${facts.source}`,
          `facts.usage: ${facts.usage}`,
          `facts.importance: ${facts.importance}`,
          `fs: ${JSON.stringify(o.fs)}`,
          `model: ${JSON.stringify(o.model)}`,
        ].join('\n')
      })
      .join('\n\n')
    writeFileSync('.tmp/audit200/cards.txt', txt)
    console.log(`\nвыгрузка: .tmp/audit200/cards.txt (${dumpRows.length} карточек)`)
  }
}
const total = rows.filter((r) => !INFO_RULES.has(r.rule as Rule)).reduce((s, r) => s + r.n, 0)
console.log(`\nИтого нарушений (без info): ${total}`)
process.exit(total ? 1 : 0)
