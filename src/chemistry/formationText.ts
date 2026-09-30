/**
 * Тексты «Как образуется» (RU / EN / UZ) по плану formationPlan: шаблоны без свободного текста — формулы, заряды,
 * валентности и связи берутся из плана, названия элементов — из данных проекта (elementNames*).
 */
import { ELEMENT_NAMES_EN } from '../data/elementNamesEn'
import { ELEMENT_NAMES_RU } from '../data/elementNamesRu'
import { ELEMENT_NAMES_UZ } from '../data/elementNamesUz'
import { ELEMENTS } from '../data/elements'
import type { FormationPlan, FormationShape, FormationSpecies } from './formationPlan'
import { VARIABLE_METALS } from './formationPlan'

export type FormationLocale = 'ru' | 'en' | 'uz'

export type FormationStepText = {
  title: string
  /** крупная строка: частицы, баланс зарядов, валентности, связи или тип связи */
  main: string
  /** пояснение одной-двумя фразами */
  sub: string
}

export type FormationTexts = {
  steps: [FormationStepText, FormationStepText, FormationStepText, FormationStepText]
  note: string
  ui: { play: string; pause: string; resume: string; replay: string; close: string; step: string }
}

const zBySymbol = new Map(ELEMENTS.map((e) => [e.symbol, e.z]))

function elementName(sym: string, loc: FormationLocale): string {
  const z = zBySymbol.get(sym)
  if (!z) return sym
  const list = loc === 'en' ? ELEMENT_NAMES_EN : loc === 'uz' ? ELEMENT_NAMES_UZ : ELEMENT_NAMES_RU
  const n = list[z - 1] ?? sym
  return n.charAt(0).toLocaleLowerCase(loc === 'en' ? 'en' : loc === 'uz' ? 'uz' : 'ru') + n.slice(1)
}

/** Родительный падеж русского названия металла: натрия, меди, железа, свинца, цинка. */
function ruGenitive(name: string): string {
  if (name.endsWith('ий')) return `${name.slice(0, -2)}ия`
  if (name.endsWith('ец')) return `${name.slice(0, -2)}ца`
  if (name.endsWith('о')) return `${name.slice(0, -1)}а`
  if (name.endsWith('ь')) return `${name.slice(0, -1)}и`
  return `${name}а`
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']
const roman = (n: number): string => ROMAN[n] ?? String(n)

const ANION_NAMES: Record<string, [string, string, string]> = {
  F: ['фторид-ион', 'fluoride ion', 'ftorid ioni'],
  Cl: ['хлорид-ион', 'chloride ion', 'xlorid ioni'],
  Br: ['бромид-ион', 'bromide ion', 'bromid ioni'],
  I: ['иодид-ион', 'iodide ion', 'yodid ioni'],
  O: ['оксид-ион', 'oxide ion', 'oksid ioni'],
  S: ['сульфид-ион', 'sulfide ion', 'sulfid ioni'],
  H: ['гидрид-ион', 'hydride ion', 'gidrid ioni'],
  N: ['нитрид-ион', 'nitride ion', 'nitrid ioni'],
  P: ['фосфид-ион', 'phosphide ion', 'fosfid ioni'],
  C: ['карбид-ион', 'carbide ion', 'karbid ioni'],
}

const POLY_NAMES: Record<string, [string, string, string]> = {
  OH: ['гидроксид-ион', 'hydroxide ion', 'gidroksid ioni'],
  NH4: ['ион аммония', 'ammonium ion', 'ammoniy ioni'],
  SO4: ['сульфат-ион', 'sulfate ion', 'sulfat ioni'],
  HSO4: ['гидросульфат-ион', 'hydrogen sulfate ion', 'gidrosulfat ioni'],
  SO3: ['сульфит-ион', 'sulfite ion', 'sulfit ioni'],
  CO3: ['карбонат-ион', 'carbonate ion', 'karbonat ioni'],
  HCO3: ['гидрокарбонат-ион', 'hydrogen carbonate ion', 'gidrokarbonat ioni'],
  NO3: ['нитрат-ион', 'nitrate ion', 'nitrat ioni'],
  NO2: ['нитрит-ион', 'nitrite ion', 'nitrit ioni'],
  PO4: ['фосфат-ион', 'phosphate ion', 'fosfat ioni'],
  HPO4: ['гидрофосфат-ион', 'hydrogen phosphate ion', 'gidrofosfat ioni'],
  H2PO4: ['дигидрофосфат-ион', 'dihydrogen phosphate ion', 'digidrofosfat ioni'],
  SiO3: ['силикат-ион', 'silicate ion', 'silikat ioni'],
  MnO4: ['перманганат-ион', 'permanganate ion', 'permanganat ioni'],
  MnO4_2: ['манганат-ион', 'manganate ion', 'manganat ioni'],
  CrO4: ['хромат-ион', 'chromate ion', 'xromat ioni'],
  Cr2O7: ['дихромат-ион', 'dichromate ion', 'dixromat ioni'],
  ClO3: ['хлорат-ион', 'chlorate ion', 'xlorat ioni'],
  ClO2: ['хлорит-ион', 'chlorite ion', 'xlorit ioni'],
  ClO: ['гипохлорит-ион', 'hypochlorite ion', 'gipoxlorit ioni'],
  AlO2: ['метаалюминат-ион', 'metaaluminate ion', 'metaalyuminat ioni'],
  ZnO2: ['цинкат-ион', 'zincate ion', 'sinkat ioni'],
  ZnOH4: ['тетрагидроксоцинкат-ион', 'tetrahydroxozincate ion', 'tetragidroksosinkat ioni'],
  O2_2: ['пероксид-ион', 'peroxide ion', 'peroksid ioni'],
  O2_1: ['надпероксид-ион', 'superoxide ion', 'superoksid ioni'],
  S2: ['дисульфид-ион', 'disulfide ion', 'disulfid ioni'],
  C2: ['ацетиленид-ион', 'acetylide ion', 'atsetilenid ioni'],
}

const LI = { ru: 0, en: 1, uz: 2 } as const

/** Название частицы: «ион натрия», «ион железа(III)», «сульфат-ион», «молекула воды». */
export function speciesName(s: FormationSpecies, loc: FormationLocale): string {
  const [kind, key] = s.nameKey.split(':') as [string, string]
  if (kind === 'cation') {
    const el = elementName(key, loc)
    const v = VARIABLE_METALS.has(key) ? `(${roman(s.charge)})` : ''
    if (loc === 'ru') return `ион ${ruGenitive(el)}${v}`
    if (loc === 'en') return `${el}${v} ion`
    return `${el}${v} ioni`
  }
  if (kind === 'anion') return ANION_NAMES[key]?.[LI[loc]] ?? s.formula
  if (kind === 'poly') return POLY_NAMES[key]?.[LI[loc]] ?? s.formula
  if (kind === 'mol') return loc === 'ru' ? 'молекула воды' : loc === 'en' ? 'water molecule' : 'suv molekulasi'
  return elementName(key, loc)
}

const joinList = (items: readonly string[], loc: FormationLocale): string => {
  if (items.length <= 1) return items.join('')
  const and = loc === 'ru' ? 'и' : loc === 'en' ? 'and' : 'va'
  return `${items.slice(0, -1).join(', ')} ${and} ${items[items.length - 1]}`
}

const SHAPE: Record<FormationShape['key'], [string, string, string]> = {
  linear: ['линейная', 'linear', 'chiziqli'],
  angular: ['угловая', 'bent', 'burchakli'],
  'trigonal-planar': ['плоский треугольник', 'trigonal planar', 'yassi uchburchak'],
  'trigonal-pyramidal': ['треугольная пирамида', 'trigonal pyramid', 'uchburchakli piramida'],
  tetrahedral: ['тетраэдр', 'tetrahedron', 'tetraedr'],
  octahedral: ['октаэдр', 'octahedron', 'oktaedr'],
  ring: ['кольцо («корона»)', 'ring (“crown”)', 'halqa («toj»)'],
  'tetrahedron-p4': ['тетраэдр из четырёх атомов', 'tetrahedron of four atoms', 'toʻrt atomdan iborat tetraedr'],
  'ionic-lattice': ['ионная кристаллическая решётка', 'ionic crystal lattice', 'ion kristall panjara'],
  'atomic-lattice': ['атомная кристаллическая решётка', 'atomic (covalent network) crystal lattice', 'atom kristall panjara'],
  'formula-unit': [
    'модель — одна формульная единица; в твёрдом веществе ионы образуют кристаллическую решётку',
    'the model is one formula unit; in the solid, ions form a crystal lattice',
    'model — bitta formula birligi; qattiq moddada ionlar kristall panjara hosil qiladi',
  ],
}

function shapeText(sh: FormationShape, loc: FormationLocale): string {
  const name = SHAPE[sh.key][LI[loc]]
  let around = ''
  if (sh.center && sh.key !== 'linear') {
    around =
      loc === 'ru'
        ? sh.each
          ? ` (вокруг каждого ${sh.center})`
          : ` (вокруг ${sh.center})`
        : loc === 'en'
          ? sh.each
            ? ` (around each ${sh.center})`
            : ` (around ${sh.center})`
          : sh.each
            ? ` (har bir ${sh.center} atrofida)`
            : ` (${sh.center} atrofida)`
  }
  if (sh.key === 'formula-unit' || sh.key === 'ionic-lattice' || sh.key === 'atomic-lattice') return cap(name)
  if (sh.of) return `${sh.of} — ${name}${around}`
  const lead = loc === 'ru' ? 'Форма' : loc === 'en' ? 'Shape' : 'Shakli'
  return `${lead}: ${name}${around}`
}

const cap = (s: string): string => s.charAt(0).toLocaleUpperCase() + s.slice(1)

function countList(p: FormationPlan): string {
  return p.species.map((s) => `${s.formula} ×${s.count}`).join(' · ')
}

function namesLine(p: FormationPlan, loc: FormationLocale): string {
  if (p.mode === 'molecular') {
    const lead = loc === 'ru' ? 'Атомы' : loc === 'en' ? 'Atoms' : 'Atomlar'
    const list = p.species.map((s) => `${s.formula} — ${speciesName(s, loc)}`).join(', ')
    if (p.hydrogenBond) {
      const two = loc === 'ru' ? 'две молекулы — NH₃ и H₂O' : loc === 'en' ? 'two molecules — NH₃ and H₂O' : 'ikkita molekula — NH₃ va H₂O'
      return `${lead}: ${list}; ${two}.`
    }
    return `${lead}: ${list}.`
  }
  const parts = p.species.map((s) => {
    let n = speciesName(s, loc)
    if (s.kind === 'polyion' && s.charge < 0 && s.nameKey !== 'poly:OH') n += loc === 'ru' ? ' (кислотный остаток)' : loc === 'en' ? ' (acid residue)' : ' (kislota qoldigʻi)'
    if (s.kind === 'molecule') n += loc === 'ru' ? ' (кристаллизационная вода)' : loc === 'en' ? ' (water of crystallization)' : ' (kristallizatsiya suvi)'
    return `${s.formula} — ${n}`
  })
  return `${parts.join('; ')}.`
}

function charged(p: FormationPlan): FormationSpecies[] {
  return p.species.filter((s) => s.charge !== 0)
}

function bondTypeText(p: FormationPlan, loc: FormationLocale): string {
  const L = LI[loc]
  const polar = ['ковалентная полярная', 'polar covalent', 'kovalent qutbli'][L]!
  const nonpolar = ['ковалентная неполярная', 'nonpolar covalent', 'kovalent qutbsiz'][L]!
  if (p.bondType === 'covalent-nonpolar') return ['Ковалентная неполярная связь', 'Nonpolar covalent bond', 'Kovalent qutbsiz bogʻ'][L]!
  if (p.bondType === 'ionic') return ['Ионная связь', 'Ionic bond', 'Ion bogʻ'][L]!
  if (p.bondType === 'covalent-polar') {
    let s = ['Ковалентная полярная связь', 'Polar covalent bond', 'Kovalent qutbli bogʻ'][L]!
    if (p.alsoNonpolar) {
      const same = p.bondKinds.find((b) => {
        const [a, c] = b.label.split(/[–=≡]/)
        return a === c
      })
      const lab = same ? ` ${same.label}` : ''
      s += loc === 'ru' ? `; между одинаковыми атомами${lab} — неполярная` : loc === 'en' ? `; between identical atoms${lab} — nonpolar` : `; bir xil atomlar orasida${lab} — qutbsiz`
    }
    if (p.hydrogenBond) s += loc === 'ru' ? '; между молекулами — водородная связь' : loc === 'en' ? '; between the molecules — a hydrogen bond' : '; molekulalar orasida — vodorod bogʻ'
    return s
  }
  // ионная + ковалентная внутри многоатомных частиц
  const ions = charged(p).map((s) => s.formula)
  const inner = p.species.filter((s) => s.kind === 'polyion' || s.kind === 'molecule')
  const polarIn = inner.filter((s) => !s.innerNonpolar).map((s) => s.formula)
  const nonpolarIn = inner.filter((s) => s.innerNonpolar).map((s) => s.formula)
  const da = inner.filter((s) => s.donorAcceptor).map((s) => s.formula)
  const between = loc === 'ru' ? `Ионная связь между ${joinList(ions, loc)}` : loc === 'en' ? `Ionic bond between ${joinList(ions, loc)}` : `${joinList(ions, loc)} orasida ion bogʻ`
  const inside = (kind: string, list: string[]): string =>
    loc === 'ru' ? `${kind} — внутри ${joinList(list, loc)}` : loc === 'en' ? `${kind} inside ${joinList(list, loc)}` : `${joinList(list, loc)} ichida — ${kind}`
  const out = [between]
  if (polarIn.length) {
    const daNote = loc === 'ru' ? ' (в том числе донорно-акцепторная)' : loc === 'en' ? ' (including donor–acceptor)' : ' (shu jumladan donor-akseptor)'
    // Одна частица — пометка к виду связи; несколько — только у той, где она есть: «внутри NH₄⁺ (…) и SO₄²⁻».
    if (da.length && polarIn.length === 1) out.push(inside(polar + daNote, polarIn))
    else out.push(inside(polar, polarIn.map((f) => (da.includes(f) ? f + daNote : f))))
  }
  if (nonpolarIn.length) out.push(inside(nonpolar, nonpolarIn))
  return out.join('; ')
}

function step3Sub(p: FormationPlan, loc: FormationLocale): string {
  if (p.mode === 'molecular') {
    let s =
      loc === 'ru'
        ? 'Атомы соединяются общими электронными парами — связи возникают по одной.'
        : loc === 'en'
          ? 'Atoms join through shared electron pairs — the bonds form one by one.'
          : 'Atomlar umumiy elektron juftlar orqali birikadi — bogʻlar birma-bir hosil boʻladi.'
    if (p.hydrogenBond) s += loc === 'ru' ? ' Молекулы NH₃ и H₂O удерживает водородная связь.' : loc === 'en' ? ' A hydrogen bond holds the NH₃ and H₂O molecules together.' : ' NH₃ va H₂O molekulalarini vodorod bogʻ tutib turadi.'
    return s
  }
  let s =
    loc === 'ru'
      ? 'Разноимённо заряженные ионы притягиваются друг к другу — общих электронных пар между ними нет, поэтому и палочек нет.'
      : loc === 'en'
        ? 'Oppositely charged ions attract each other — they share no electron pairs, so no sticks are drawn between them.'
        : 'Qarama-qarshi zaryadlangan ionlar bir-biriga tortiladi — ular orasida umumiy elektron juft yoʻq, shuning uchun tayoqchalar ham yoʻq.'
  const inner = p.species.filter((x) => x.kind === 'polyion').map((x) => x.formula)
  if (inner.length) {
    // Только связи внутри самих ионов (у кристаллогидрата O–H воды сюда не входят).
    const kinds = p.innerBonds.map((x) => x.kinds.map((b) => `${b.label} ×${b.count}`).join(', ')).join('; ')
    s +=
      loc === 'ru'
        ? ` Внутри ${joinList(inner, loc)} атомы связаны ковалентно${kinds ? ` (${kinds})` : ''}.`
        : loc === 'en'
          ? ` Inside ${joinList(inner, loc)} the atoms are bonded covalently${kinds ? ` (${kinds})` : ''}.`
          : ` ${joinList(inner, loc)} ichida atomlar kovalent bogʻlangan${kinds ? ` (${kinds})` : ''}.`
  }
  if (p.species.some((x) => x.kind === 'molecule'))
    s += loc === 'ru' ? ' Молекулы воды H₂O входят в кристалл.' : loc === 'en' ? ' Water molecules H₂O are part of the crystal.' : ' Suv molekulalari H₂O kristall tarkibiga kiradi.'
  return s
}

export function formationTexts(p: FormationPlan, loc: FormationLocale, obtainingSection: string): FormationTexts {
  const L = LI[loc]
  const ionic = p.mode === 'ionic'
  const s1: FormationStepText = {
    title: ['Состав', 'Composition', 'Tarkibi'][L]!,
    main: countList(p),
    sub: namesLine(p, loc),
  }
  const binaryIonic = p.bondType === 'ionic'
  const s2: FormationStepText = ionic
    ? {
        title: ['Заряды', 'Charges', 'Zaryadlar'][L]!,
        main: p.balance ?? '',
        sub:
          (binaryIonic
            ? [
                'Атомы металла отдают электроны и становятся катионами, атомы неметалла принимают их и становятся анионами. ',
                'Metal atoms give up electrons and become cations; non-metal atoms accept them and become anions. ',
                'Metall atomlari elektron beradi va kationga aylanadi, metallmas atomlari ularni qabul qilib anionga aylanadi. ',
              ][L]!
            : '') +
          [
            'Сумма зарядов всех ионов равна нулю — вещество электронейтрально.',
            'The charges of all the ions add up to zero — the substance is electrically neutral.',
            'Barcha ionlar zaryadlarining yigʻindisi nolga teng — modda elektroneytral.',
          ][L]!,
      }
    : {
        title: ['Валентности', 'Valences', 'Valentliklar'][L]!,
        main: p.species
          .filter((s) => s.valences && s.valences.length > 0)
          // Школьная запись валентности: S(VI) — римская цифра в скобках после символа.
          .map((s) => `${s.formula}(${s.valences!.map(roman).join(', ')})`)
          .join(' · '),
        sub: [
          'Валентность — число общих электронных пар (связей), которые образует атом.',
          'Valence is the number of shared electron pairs (bonds) an atom forms.',
          'Valentlik — atom hosil qiladigan umumiy elektron juftlar (bogʻlar) soni.',
        ][L]!,
      }
  const s3: FormationStepText = {
    title: ['Сборка', 'Assembly', 'Yigʻilishi'][L]!,
    main: ionic
      ? ['Катионы и анионы притягиваются', 'Cations and anions attract', 'Kationlar va anionlar tortishadi'][L]!
      : p.bondKinds.map((b) => `${b.label} ×${b.count}`).join(' · ') || ['Атомы соединяются', 'Atoms join', 'Atomlar birikadi'][L]!,
    sub: step3Sub(p, loc),
  }
  const shapes = p.shapes.map((sh) => shapeText(sh, loc))
  const s4: FormationStepText = {
    title: ['Готово', 'Result', 'Tayyor'][L]!,
    main: bondTypeText(p, loc),
    sub: shapes.length
      ? `${shapes.join('. ')}.`
      : ['Модель показывает одну молекулу вещества.', 'The model shows one molecule of the substance.', 'Model moddaning bitta molekulasini koʻrsatadi.'][L]!,
  }
  const note = [
    `Модель строения — из каких частиц складывается вещество (не механизм реакции). Способы получения — в разделе «${obtainingSection}».`,
    `Structure model — which particles make up the substance (not a reaction mechanism). Ways of obtaining it are in the “${obtainingSection}” section.`,
    `Tuzilish modeli — modda qaysi zarrachalardan tashkil topgan (reaksiya mexanizmi emas). Olish usullari — «${obtainingSection}» boʻlimida.`,
  ][L]!
  return {
    steps: [s1, s2, s3, s4],
    note,
    ui: {
      play: ['▶ Как образуется', '▶ How it forms', '▶ Qanday hosil boʻladi'][L]!,
      pause: ['Пауза', 'Pause', 'Pauza'][L]!,
      resume: ['Продолжить', 'Resume', 'Davom etish'][L]!,
      replay: ['Повтор', 'Replay', 'Qayta'][L]!,
      close: ['Закрыть', 'Close', 'Yopish'][L]!,
      step: ['Шаг', 'Step', 'Qadam'][L]!,
    },
  }
}
