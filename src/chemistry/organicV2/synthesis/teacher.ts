/**
 * Органика v2 · «Как образуется» — тексты: названия этапов, фразы учителя (RU/EN/UZ, 1–2 фразы на этап по типу
 * реакции и реальным связям из атомного соответствия), разбор уравнения учебника на члены, условия, неорганика.
 * Чистые функции: используются проигрывателем и тестом scripts/test-organic-v2-synthesis.mts.
 */
import type { OV2Reaction, OV2ReactionType } from '../../../data/organicV2/types'
import type { SynthScenario, SynthStageKey } from './scenario'

export type SynthLang = 'ru' | 'en' | 'uz'
type L3 = Readonly<Record<SynthLang, string>>

const STAGE_TITLES: Readonly<Record<SynthStageKey, L3>> = {
  reactants: { ru: 'Исходные вещества', en: 'Starting substances', uz: 'Boshlang‘ich moddalar' },
  center: { ru: 'Реакционный центр', en: 'Reaction centre', uz: 'Reaksiya markazi' },
  break: { ru: 'Разрыв связей', en: 'Bonds break', uz: 'Bog‘lar uziladi' },
  form: { ru: 'Образование связей', en: 'New bonds form', uz: 'Yangi bog‘lar hosil bo‘ladi' },
  products: { ru: 'Продукты', en: 'Products', uz: 'Mahsulotlar' },
  summary: { ru: 'Итог', en: 'Summary', uz: 'Xulosa' },
}

export const stageTitle = (k: SynthStageKey, lang: SynthLang): string => STAGE_TITLES[k][lang]

const TYPE_NAMES: Readonly<Record<OV2ReactionType, L3>> = {
  combustion: { ru: 'горение', en: 'combustion', uz: 'yonish' },
  substitutionRadical: { ru: 'радикальное замещение', en: 'radical substitution', uz: 'radikal o‘rin olish' },
  substitution: { ru: 'замещение', en: 'substitution', uz: 'o‘rin olish' },
  addition: { ru: 'присоединение', en: 'addition', uz: 'birikish' },
  hydrogenation: { ru: 'гидрирование (присоединение H₂)', en: 'hydrogenation', uz: 'gidrogenlash' },
  halogenation: { ru: 'галогенирование', en: 'halogenation', uz: 'galogenlash' },
  hydrohalogenation: { ru: 'гидрогалогенирование', en: 'hydrohalogenation', uz: 'gidrogalogenlash' },
  hydration: { ru: 'гидратация (присоединение воды)', en: 'hydration', uz: 'gidratlanish' },
  elimination: { ru: 'отщепление', en: 'elimination', uz: 'ajralish' },
  dehydration: { ru: 'дегидратация (отщепление воды)', en: 'dehydration', uz: 'degidratlanish' },
  dehydrogenation: { ru: 'дегидрирование (отщепление H₂)', en: 'dehydrogenation', uz: 'degidrogenlash' },
  dehydrohalogenation: { ru: 'дегидрогалогенирование', en: 'dehydrohalogenation', uz: 'degidrogalogenlash' },
  esterification: { ru: 'этерификация', en: 'esterification', uz: 'eterifikatsiya' },
  hydrolysis: { ru: 'гидролиз', en: 'hydrolysis', uz: 'gidroliz' },
  polymerization: { ru: 'полимеризация', en: 'polymerization', uz: 'polimerlanish' },
  polycondensation: { ru: 'поликонденсация', en: 'polycondensation', uz: 'polikondensatsiya' },
  oxidation: { ru: 'окисление', en: 'oxidation', uz: 'oksidlanish' },
  reduction: { ru: 'восстановление', en: 'reduction', uz: 'qaytarilish' },
  nitration: { ru: 'нитрование', en: 'nitration', uz: 'nitrolash' },
  sulfonation: { ru: 'сульфирование', en: 'sulfonation', uz: 'sulfolash' },
  fermentation: { ru: 'брожение', en: 'fermentation', uz: 'bijg‘ish' },
  cracking: { ru: 'крекинг', en: 'cracking', uz: 'kreking' },
  isomerization: { ru: 'изомеризация', en: 'isomerization', uz: 'izomerlanish' },
  wurtz: { ru: 'реакция Вюрца', en: 'Wurtz reaction', uz: 'Vyurs reaksiyasi' },
  acidBase: { ru: 'кислотно-основная реакция', en: 'acid–base reaction', uz: 'kislota-asos reaksiyasi' },
  metal: { ru: 'реакция с металлом', en: 'reaction with a metal', uz: 'metall bilan reaksiya' },
  trimerization: { ru: 'тримеризация', en: 'trimerization', uz: 'trimerlanish' },
  other: { ru: 'превращение', en: 'transformation', uz: 'o‘zgarish' },
}

export const reactionTypeName = (r: OV2Reaction, lang: SynthLang): string =>
  lang === 'ru' && r.typeRu ? r.typeRu : TYPE_NAMES[r.type][lang]

const INORG: Readonly<Record<string, L3>> = {
  H2O: { ru: 'вода', en: 'water', uz: 'suv' },
  HCl: { ru: 'хлороводород', en: 'hydrogen chloride', uz: 'vodorod xlorid' },
  HBr: { ru: 'бромоводород', en: 'hydrogen bromide', uz: 'vodorod bromid' },
  HI: { ru: 'йодоводород', en: 'hydrogen iodide', uz: 'vodorod yodid' },
  Cl2: { ru: 'хлор', en: 'chlorine', uz: 'xlor' },
  Br2: { ru: 'бром', en: 'bromine', uz: 'brom' },
  I2: { ru: 'йод', en: 'iodine', uz: 'yod' },
  H2: { ru: 'водород', en: 'hydrogen', uz: 'vodorod' },
  O2: { ru: 'кислород', en: 'oxygen', uz: 'kislorod' },
  CO2: { ru: 'углекислый газ', en: 'carbon dioxide', uz: 'karbonat angidrid' },
  CO: { ru: 'угарный газ', en: 'carbon monoxide', uz: 'is gazi' },
  NaOH: { ru: 'гидроксид натрия', en: 'sodium hydroxide', uz: 'natriy gidroksid' },
  KOH: { ru: 'гидроксид калия', en: 'potassium hydroxide', uz: 'kaliy gidroksid' },
  NaCl: { ru: 'хлорид натрия', en: 'sodium chloride', uz: 'natriy xlorid' },
  NaBr: { ru: 'бромид натрия', en: 'sodium bromide', uz: 'natriy bromid' },
  KCl: { ru: 'хлорид калия', en: 'potassium chloride', uz: 'kaliy xlorid' },
  KBr: { ru: 'бромид калия', en: 'potassium bromide', uz: 'kaliy bromid' },
  Na: { ru: 'натрий', en: 'sodium', uz: 'natriy' },
  K: { ru: 'калий', en: 'potassium', uz: 'kaliy' },
  HNO3: { ru: 'азотная кислота', en: 'nitric acid', uz: 'nitrat kislota' },
  H2SO4: { ru: 'серная кислота', en: 'sulfuric acid', uz: 'sulfat kislota' },
  NH3: { ru: 'аммиак', en: 'ammonia', uz: 'ammiak' },
  C: { ru: 'углерод', en: 'carbon', uz: 'uglerod' },
}

const SUB = '₀₁₂₃₄₅₆₇₈₉'
export const subscript = (s: string): string => s.replace(/\d/g, (d) => SUB[Number(d)])

/** Название неорганического участника ('inorg:H2O' → «вода»), иначе undefined. */
export function inorganicName(ref: string, lang: SynthLang): string | undefined {
  if (!ref.startsWith('inorg:')) return undefined
  return INORG[ref.slice(6)]?.[lang]
}

/** Члены уравнения: левая/правая часть, у каждого — коэффициент и запись (как в учебнике). */
export interface EquationTerm {
  readonly coef: string
  readonly text: string
}
export interface ParsedEquation {
  readonly left: readonly EquationTerm[]
  readonly right: readonly EquationTerm[]
  /** стрелка учебника (→, ⇄ …) */
  readonly arrow: string
}

export function parseEquation(eq: string): ParsedEquation {
  const m = /\s*(⇄|⇌|↔|→|⟶|->|=)\s*/.exec(eq)
  const arrow = m ? (m[1] === '->' || m[1] === '=' || m[1] === '⟶' ? '→' : m[1]) : '→'
  const [l, r] = m ? [eq.slice(0, m.index), eq.slice(m.index + m[0].length)] : [eq, '']
  const terms = (side: string): EquationTerm[] =>
    side
      .split(/\s\+\s/)
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => {
        const c = /^(\d+n|\d+|n)(?=[A-Za-zА-Яа-я(\[]|\s)\s*/.exec(t)
        return c ? { coef: c[1], text: t.slice(c[0].length) } : { coef: '', text: t }
      })
  return { left: terms(l), right: terms(r), arrow }
}

/** Условия над стрелкой: «t°, H2SO4 (конц.)» → с подстрочными цифрами; длинные пояснения отбрасываются. */
export function conditionsLabel(r: OV2Reaction): string {
  const c = r.conditions?.trim()
  if (!c) return ''
  return subscript(c.replace(/\s*\(над стрелкой[^)]*\)/, '')).replace(/\bкат\b(?!\.)/g, 'кат.')
}

/**
 * Группы участников, соответствующие членам уравнения (подряд идущие копии одного ref — один член).
 * Возвращает для каждого участника индекс члена своей части уравнения (или −1, если число членов не совпало).
 */
export function speciesTermIndex(r: OV2Reaction, eq: ParsedEquation): number[] {
  const out = new Array<number>(r.species.length).fill(-1)
  for (const side of ['L', 'R'] as const) {
    const idx = r.species.map((s, i) => (s.side === side ? i : -1)).filter((i) => i >= 0)
    const groups: number[][] = []
    for (const i of idx) {
      const last = groups[groups.length - 1]
      if (last && r.species[last[0]].ref === r.species[i].ref) last.push(i)
      else groups.push([i])
    }
    const terms = side === 'L' ? eq.left : eq.right
    if (groups.length !== terms.length) continue
    groups.forEach((g, k) => g.forEach((i) => (out[i] = k)))
  }
  return out
}

// ─── связи словами ───────────────────────────────────────────────────────────

const BOND_SIGN = ['', '–', '=', '≡']
const ORDER_EL = (a: string, b: string): [string, string] => {
  const rank = (e: string) => (e === 'C' ? 0 : e === 'H' ? 2 : 1)
  return rank(a) <= rank(b) ? [a, b] : [b, a]
}

function bondList(sc: SynthScenario, kinds: readonly string[], useFrom: boolean, lang: SynthLang): string {
  const counts = new Map<string, number>()
  for (const b of sc.bonds) {
    if (!kinds.includes(b.kind)) continue
    const [x, y] = ORDER_EL(sc.atoms[b.i].el, sc.atoms[b.j].el)
    const o = useFrom ? b.from : b.to
    const label = `${x}${BOND_SIGN[o] ?? '–'}${y}`
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  const times = lang === 'ru' ? '×' : '×'
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([l, n]) => (n > 1 ? `${n}${times} ${l}` : l))
    .join(', ')
}

function piList(sc: SynthScenario): string {
  const out = new Set<string>()
  for (const b of sc.bonds) {
    if (b.kind !== 'down' && b.kind !== 'up') continue
    const [x, y] = ORDER_EL(sc.atoms[b.i].el, sc.atoms[b.j].el)
    out.add(`${x}${BOND_SIGN[Math.max(b.from, b.to)]}${y}`)
  }
  return [...out].join(', ')
}

type Family =
  | 'addition' | 'radical' | 'substitution' | 'elimination' | 'ester' | 'hydrolysis' | 'polymer' | 'polycond'
  | 'combustion' | 'oxidation' | 'reduction' | 'wurtz' | 'metal' | 'trimer' | 'ferment' | 'isomer' | 'other'

function familyOf(r: OV2Reaction, sc: SynthScenario): Family {
  switch (r.type) {
    case 'addition': case 'hydrogenation': case 'halogenation': case 'hydrohalogenation': case 'hydration':
      return sc.bonds.some((b) => b.kind === 'down') ? 'addition' : 'other'
    case 'substitutionRadical': return 'radical'
    case 'substitution': case 'nitration': case 'sulfonation': return sc.radical ? 'radical' : 'substitution'
    case 'elimination': case 'dehydration': case 'dehydrogenation': case 'dehydrohalogenation': case 'cracking':
      return 'elimination'
    case 'esterification': return 'ester'
    case 'hydrolysis': return 'hydrolysis'
    case 'polymerization': return 'polymer'
    case 'polycondensation': return 'polycond'
    case 'combustion': return 'combustion'
    case 'oxidation': return 'oxidation'
    case 'reduction': return 'reduction'
    case 'wurtz': return 'wurtz'
    case 'metal': case 'acidBase': return 'metal'
    case 'trimerization': return 'trimer'
    case 'fermentation': return 'ferment'
    case 'isomerization': return 'isomer'
    default: return 'other'
  }
}

type Ctx = { brk: string; frm: string; pi: string; by: string; cond: string }
type Lines = Readonly<Record<Family, Readonly<Record<'center' | 'break' | 'form', (c: Ctx) => string>>>>

const RU: Lines = {
  addition: {
    center: (c) => `Реакционный центр — кратная связь ${c.pi}: её π-связь слабее σ-связи, к ней и присоединяется реагент.`,
    break: (c) => `π-связь ${c.pi} рвётся, σ-связь остаётся. ${c.brk ? `Рвётся и связь ${c.brk} в молекуле реагента.` : ''}`,
    form: (c) => `К атомам углерода по месту π-связи присоединяются атомы реагента: ${c.frm}. Кратная связь становится одинарной (π → σ).`,
  },
  radical: {
    center: (c) => `${c.cond.includes('hν') ? 'Квант света hν' : 'Энергия'} разрывает молекулу галогена на радикалы; радикал отрывает атом H от углерода.`,
    break: (c) => `Связи ${c.brk} рвутся гомолитически: у каждого атома остаётся по неспаренному электрону (•) — это радикалы.`,
    form: (c) => `Радикалы соединяются: ${c.frm}. Атом H заменён — это замещение${c.by ? `, побочно образуется ${c.by}` : ''}.`,
  },
  substitution: {
    center: (c) => `Реагент атакует связь ${c.brk.split(', ')[0] || c.pi}: атом или группа будут заменены.`,
    break: (c) => `Связи ${c.brk} рвутся гетеролитически: электронная пара (:) уходит к более электроотрицательному атому.`,
    form: (c) => `Образуются связи ${c.frm} — на место ушедшего атома встаёт новый${c.by ? `; уходящие атомы собираются в ${c.by}` : ''}.`,
  },
  elimination: {
    center: (c) => `От соседних атомов отщепляются атомы — рвутся связи ${c.brk}.`,
    break: (c) => `Связи ${c.brk} рвутся, атомы уходят из молекулы.`,
    form: (c) => `${c.pi ? `Между атомами появляется новая π-связь: ${c.pi}. ` : ''}${c.by ? `Отщеплённые атомы образуют ${c.by}.` : `Образуются связи ${c.frm}.`}`,
  },
  ester: {
    center: () => 'Реакционный центр — группа –COOH кислоты и группа –OH спирта.',
    break: () => 'От кислоты уходит группа OH (рвётся C–O), от спирта — атом H (рвётся O–H).',
    form: () => 'Остатки кислоты и спирта соединяются связью C–O — получается сложный эфир; OH и H образуют воду.',
  },
  hydrolysis: {
    center: (c) => `Вода атакует связь ${c.brk.split(', ')[0] || 'C–O'} — её и рвёт гидролиз.`,
    break: (c) => `Рвутся связи ${c.brk}: молекула распадается на части, вода — на H и OH.`,
    form: (c) => `H и OH воды присоединяются к частям молекулы: ${c.frm}.`,
  },
  polymer: {
    center: (c) => `У каждого мономера раскрывается π-связь ${c.pi} — реакционный центр полимеризации.`,
    break: () => 'В каждой молекуле мономера рвётся π-связь, σ-связь остаётся.',
    form: (c) => `Звенья соединяются σ-связями ${c.frm} в длинную цепь. «…» — цепь продолжается (n звеньев).`,
  },
  polycond: {
    center: () => 'Функциональные группы мономеров реагируют друг с другом, как при этерификации.',
    break: (c) => `Рвутся связи ${c.brk}, отщепляется вода.`,
    form: (c) => `Звенья соединяются связями ${c.frm} в цепь, побочно образуется ${c.by || 'вода'}. «…» — цепь продолжается.`,
  },
  combustion: {
    center: () => 'При горении кислород разрушает молекулу полностью — рвутся все связи.',
    break: (c) => `Рвутся все связи: ${c.brk}. Атомы освобождаются.`,
    form: () => 'Атомы C соединяются с кислородом в CO₂, атомы H — в H₂O.',
  },
  oxidation: {
    center: (c) => `Окислитель атакует связь ${c.brk.split(', ')[0] || c.pi}: у атома углерода растёт число связей с кислородом.`,
    break: (c) => `Рвутся связи ${c.brk}.`,
    form: (c) => `Образуются связи ${c.frm}${c.by ? `; побочно — ${c.by}` : ''}.`,
  },
  reduction: {
    center: (c) => `Водород восстанавливает группу у связи ${c.pi || c.brk.split(', ')[0]}.`,
    break: (c) => `Рвутся связи ${c.brk || c.pi}.`,
    form: (c) => `Атомы H присоединяются: ${c.frm}.`,
  },
  wurtz: {
    center: () => 'Натрий отнимает атомы галогена у двух молекул галогеналкана.',
    break: (c) => `Рвутся связи ${c.brk}.`,
    form: (c) => `Два углеводородных радикала соединяются связью C–C; натрий с галогеном дают соль (${c.frm}).`,
  },
  metal: {
    center: (c) => `Активный атом — H у кислорода (связь ${c.brk.split(', ')[0] || 'O–H'}).`,
    break: (c) => `Рвутся связи ${c.brk}.`,
    form: (c) => `Образуются связи ${c.frm} — получается соль${c.by ? `, выделяется ${c.by}` : ''}.`,
  },
  trimer: {
    center: (c) => `У трёх молекул раскрываются π-связи ${c.pi}.`,
    break: () => 'Из каждой тройной связи рвётся одна π-связь.',
    form: (c) => `Три молекулы замыкаются в шестичленное кольцо: ${c.frm}.`,
  },
  ferment: {
    center: () => 'Ферменты дрожжей расщепляют молекулу сахара.',
    break: (c) => `Рвутся связи ${c.brk}.`,
    form: (c) => `Образуются связи ${c.frm} — получаются спирт и углекислый газ.`,
  },
  isomer: {
    center: () => 'Состав не меняется — меняется строение углеродной цепи.',
    break: (c) => `Рвутся связи ${c.brk || c.pi}.`,
    form: (c) => `Образуются связи ${c.frm || c.pi} — получается изомер.`,
  },
  other: {
    center: (c) => `Изменятся связи: ${[c.brk, c.pi].filter(Boolean).join(', ') || c.frm}.`,
    break: (c) => `Рвутся связи ${c.brk || c.pi}.`,
    form: (c) => `Образуются связи ${c.frm || c.pi}.`,
  },
}

const EN: Lines = {
  addition: {
    center: (c) => `The reaction centre is the multiple bond ${c.pi}: its π-bond is weaker than the σ-bond, so the reagent adds there.`,
    break: (c) => `The π-bond of ${c.pi} breaks, the σ-bond stays. ${c.brk ? `The ${c.brk} bond of the reagent breaks too.` : ''}`,
    form: (c) => `Reagent atoms join the carbons of the former π-bond: ${c.frm}. The multiple bond becomes single (π → σ).`,
  },
  radical: {
    center: (c) => `${c.cond.includes('hν') ? 'Light (hν)' : 'Energy'} splits the halogen molecule into radicals; a radical pulls an H atom off carbon.`,
    break: (c) => `The ${c.brk} bonds break homolytically: each atom keeps one unpaired electron (•) — these are radicals.`,
    form: (c) => `Radicals combine: ${c.frm}. The H atom is replaced — a substitution${c.by ? `; ${c.by} forms as a by-product` : ''}.`,
  },
  substitution: {
    center: (c) => `The reagent attacks the ${c.brk.split(', ')[0] || c.pi} bond: an atom or group will be replaced.`,
    break: (c) => `The ${c.brk} bonds break heterolytically: the electron pair (:) goes to the more electronegative atom.`,
    form: (c) => `New bonds ${c.frm} form — a new atom takes the place of the leaving one${c.by ? `; the leaving atoms make ${c.by}` : ''}.`,
  },
  elimination: {
    center: (c) => `Atoms split off from neighbouring atoms — the ${c.brk} bonds break.`,
    break: (c) => `The ${c.brk} bonds break and the atoms leave the molecule.`,
    form: (c) => `${c.pi ? `A new π-bond appears: ${c.pi}. ` : ''}${c.by ? `The removed atoms form ${c.by}.` : `Bonds ${c.frm} form.`}`,
  },
  ester: {
    center: () => 'The reaction centre is the –COOH group of the acid and the –OH group of the alcohol.',
    break: () => 'The acid loses OH (C–O breaks), the alcohol loses H (O–H breaks).',
    form: () => 'The acid and alcohol parts join by a C–O bond — an ester; OH and H form water.',
  },
  hydrolysis: {
    center: (c) => `Water attacks the ${c.brk.split(', ')[0] || 'C–O'} bond — hydrolysis breaks it.`,
    break: (c) => `The ${c.brk} bonds break: the molecule splits, water splits into H and OH.`,
    form: (c) => `H and OH of water attach to the fragments: ${c.frm}.`,
  },
  polymer: {
    center: (c) => `Each monomer opens its π-bond ${c.pi} — the centre of polymerization.`,
    break: () => 'In every monomer the π-bond breaks, the σ-bond stays.',
    form: (c) => `Units join by σ-bonds ${c.frm} into a long chain. “…” — the chain goes on (n units).`,
  },
  polycond: {
    center: () => 'Functional groups of the monomers react with each other, as in esterification.',
    break: (c) => `The ${c.brk} bonds break and water splits off.`,
    form: (c) => `Units join by ${c.frm} bonds into a chain; ${c.by || 'water'} forms as a by-product. “…” — the chain goes on.`,
  },
  combustion: {
    center: () => 'In combustion oxygen destroys the molecule completely — every bond breaks.',
    break: (c) => `All bonds break: ${c.brk}. The atoms are set free.`,
    form: () => 'Carbon atoms combine with oxygen into CO₂, hydrogen atoms into H₂O.',
  },
  oxidation: {
    center: (c) => `The oxidant attacks the ${c.brk.split(', ')[0] || c.pi} bond: carbon gains bonds to oxygen.`,
    break: (c) => `The ${c.brk} bonds break.`,
    form: (c) => `Bonds ${c.frm} form${c.by ? `; by-product — ${c.by}` : ''}.`,
  },
  reduction: {
    center: (c) => `Hydrogen reduces the group at ${c.pi || c.brk.split(', ')[0]}.`,
    break: (c) => `The ${c.brk || c.pi} bonds break.`,
    form: (c) => `H atoms add on: ${c.frm}.`,
  },
  wurtz: {
    center: () => 'Sodium takes the halogen atoms from two haloalkane molecules.',
    break: (c) => `The ${c.brk} bonds break.`,
    form: (c) => `Two hydrocarbon radicals join by a C–C bond; sodium and halogen give a salt (${c.frm}).`,
  },
  metal: {
    center: (c) => `The active atom is H on oxygen (the ${c.brk.split(', ')[0] || 'O–H'} bond).`,
    break: (c) => `The ${c.brk} bonds break.`,
    form: (c) => `Bonds ${c.frm} form — a salt is obtained${c.by ? `, ${c.by} is released` : ''}.`,
  },
  trimer: {
    center: (c) => `Three molecules open their π-bonds ${c.pi}.`,
    break: () => 'One π-bond of each triple bond breaks.',
    form: (c) => `Three molecules close into a six-membered ring: ${c.frm}.`,
  },
  ferment: {
    center: () => 'Yeast enzymes split the sugar molecule.',
    break: (c) => `The ${c.brk} bonds break.`,
    form: (c) => `Bonds ${c.frm} form — ethanol and carbon dioxide are obtained.`,
  },
  isomer: {
    center: () => 'The composition stays the same — only the carbon chain is rebuilt.',
    break: (c) => `The ${c.brk || c.pi} bonds break.`,
    form: (c) => `Bonds ${c.frm || c.pi} form — an isomer is obtained.`,
  },
  other: {
    center: (c) => `Bonds that will change: ${[c.brk, c.pi].filter(Boolean).join(', ') || c.frm}.`,
    break: (c) => `The ${c.brk || c.pi} bonds break.`,
    form: (c) => `Bonds ${c.frm || c.pi} form.`,
  },
}

const UZ: Lines = {
  addition: {
    center: (c) => `Reaksiya markazi — karrali bog‘ ${c.pi}: uning π-bog‘i σ-bog‘dan kuchsiz, reagent shu yerga birikadi.`,
    break: (c) => `${c.pi} dagi π-bog‘ uziladi, σ-bog‘ qoladi. ${c.brk ? `Reagentdagi ${c.brk} bog‘i ham uziladi.` : ''}`,
    form: (c) => `π-bog‘ o‘rnida uglerod atomlariga reagent atomlari birikadi: ${c.frm}. Karrali bog‘ oddiy bog‘ga aylanadi (π → σ).`,
  },
  radical: {
    center: (c) => `${c.cond.includes('hν') ? 'Yorug‘lik (hν)' : 'Energiya'} galogen molekulasini radikallarga ajratadi; radikal ugleroddan H atomini tortib oladi.`,
    break: (c) => `${c.brk} bog‘lari gomolitik uziladi: har bir atomda bittadan juftlashmagan elektron (•) qoladi — bular radikallar.`,
    form: (c) => `Radikallar birikadi: ${c.frm}. H atomi almashtirildi — bu o‘rin olish${c.by ? `, qo‘shimcha ${c.by} hosil bo‘ladi` : ''}.`,
  },
  substitution: {
    center: (c) => `Reagent ${c.brk.split(', ')[0] || c.pi} bog‘iga hujum qiladi: atom yoki guruh almashtiriladi.`,
    break: (c) => `${c.brk} bog‘lari geterolitik uziladi: elektron jufti (:) elektromanfiyroq atomga o‘tadi.`,
    form: (c) => `${c.frm} bog‘lari hosil bo‘ladi — ketgan atom o‘rniga yangisi keladi${c.by ? `; ketgan atomlar ${c.by} hosil qiladi` : ''}.`,
  },
  elimination: {
    center: (c) => `Qo‘shni atomlardan atomlar ajraladi — ${c.brk} bog‘lari uziladi.`,
    break: (c) => `${c.brk} bog‘lari uziladi, atomlar molekuladan chiqadi.`,
    form: (c) => `${c.pi ? `Atomlar orasida yangi π-bog‘ paydo bo‘ladi: ${c.pi}. ` : ''}${c.by ? `Ajralgan atomlar ${c.by} hosil qiladi.` : `${c.frm} bog‘lari hosil bo‘ladi.`}`,
  },
  ester: {
    center: () => 'Reaksiya markazi — kislotaning –COOH guruhi va spirtning –OH guruhi.',
    break: () => 'Kislotadan OH guruhi ketadi (C–O uziladi), spirtdan — H atomi (O–H uziladi).',
    form: () => 'Kislota va spirt qoldiqlari C–O bog‘i bilan birikadi — murakkab efir hosil bo‘ladi; OH va H suvni hosil qiladi.',
  },
  hydrolysis: {
    center: (c) => `Suv ${c.brk.split(', ')[0] || 'C–O'} bog‘iga hujum qiladi — gidroliz uni uzadi.`,
    break: (c) => `${c.brk} bog‘lari uziladi: molekula bo‘laklarga, suv esa H va OH ga ajraladi.`,
    form: (c) => `Suvning H va OH qismlari bo‘laklarga birikadi: ${c.frm}.`,
  },
  polymer: {
    center: (c) => `Har bir monomerda ${c.pi} π-bog‘i ochiladi — polimerlanish markazi.`,
    break: () => 'Har bir monomer molekulasida π-bog‘ uziladi, σ-bog‘ qoladi.',
    form: (c) => `Bo‘g‘inlar ${c.frm} σ-bog‘lari bilan uzun zanjirga birikadi. «…» — zanjir davom etadi (n bo‘g‘in).`,
  },
  polycond: {
    center: () => 'Monomerlarning funksional guruhlari, eterifikatsiyadagi kabi, o‘zaro reaksiyaga kirishadi.',
    break: (c) => `${c.brk} bog‘lari uziladi, suv ajraladi.`,
    form: (c) => `Bo‘g‘inlar ${c.frm} bog‘lari bilan zanjirga birikadi, qo‘shimcha ${c.by || 'suv'} hosil bo‘ladi. «…» — zanjir davom etadi.`,
  },
  combustion: {
    center: () => 'Yonishda kislorod molekulani butunlay parchalaydi — barcha bog‘lar uziladi.',
    break: (c) => `Barcha bog‘lar uziladi: ${c.brk}. Atomlar bo‘shaydi.`,
    form: () => 'Uglerod atomlari kislorod bilan CO₂ ga, vodorod atomlari H₂O ga birikadi.',
  },
  oxidation: {
    center: (c) => `Oksidlovchi ${c.brk.split(', ')[0] || c.pi} bog‘iga hujum qiladi: uglerodning kislorod bilan bog‘lari ko‘payadi.`,
    break: (c) => `${c.brk} bog‘lari uziladi.`,
    form: (c) => `${c.frm} bog‘lari hosil bo‘ladi${c.by ? `; qo‘shimcha — ${c.by}` : ''}.`,
  },
  reduction: {
    center: (c) => `Vodorod ${c.pi || c.brk.split(', ')[0]} dagi guruhni qaytaradi.`,
    break: (c) => `${c.brk || c.pi} bog‘lari uziladi.`,
    form: (c) => `H atomlari birikadi: ${c.frm}.`,
  },
  wurtz: {
    center: () => 'Natriy ikki galogenalkan molekulasidan galogen atomlarini tortib oladi.',
    break: (c) => `${c.brk} bog‘lari uziladi.`,
    form: (c) => `Ikki uglevodorod radikali C–C bog‘i bilan birikadi; natriy va galogen tuz hosil qiladi (${c.frm}).`,
  },
  metal: {
    center: (c) => `Faol atom — kislorod yonidagi H (${c.brk.split(', ')[0] || 'O–H'} bog‘i).`,
    break: (c) => `${c.brk} bog‘lari uziladi.`,
    form: (c) => `${c.frm} bog‘lari hosil bo‘ladi — tuz olinadi${c.by ? `, ${c.by} ajraladi` : ''}.`,
  },
  trimer: {
    center: (c) => `Uch molekulada ${c.pi} π-bog‘lari ochiladi.`,
    break: () => 'Har bir uch karrali bog‘dan bitta π-bog‘ uziladi.',
    form: (c) => `Uch molekula olti a’zoli halqaga tutashadi: ${c.frm}.`,
  },
  ferment: {
    center: () => 'Achitqi fermentlari shakar molekulasini parchalaydi.',
    break: (c) => `${c.brk} bog‘lari uziladi.`,
    form: (c) => `${c.frm} bog‘lari hosil bo‘ladi — spirt va karbonat angidrid olinadi.`,
  },
  isomer: {
    center: () => 'Tarkib o‘zgarmaydi — faqat uglerod zanjirining tuzilishi o‘zgaradi.',
    break: (c) => `${c.brk || c.pi} bog‘lari uziladi.`,
    form: (c) => `${c.frm || c.pi} bog‘lari hosil bo‘ladi — izomer olinadi.`,
  },
  other: {
    center: (c) => `O‘zgaradigan bog‘lar: ${[c.brk, c.pi].filter(Boolean).join(', ') || c.frm}.`,
    break: (c) => `${c.brk || c.pi} bog‘lari uziladi.`,
    form: (c) => `${c.frm || c.pi} bog‘lari hosil bo‘ladi.`,
  },
}

const LINES: Readonly<Record<SynthLang, Lines>> = { ru: RU, en: EN, uz: UZ }

const STATIC: Readonly<Record<'reactants' | 'products' | 'summary', Readonly<Record<SynthLang, (r: OV2Reaction, by: string, cond: string) => string>>>> = {
  reactants: {
    ru: (_r, _b, cond) => `Берём исходные вещества — молекулы в настоящей 3D-форме.${cond ? ` Условия: ${cond}.` : ''}`,
    en: (_r, _b, cond) => `We take the starting substances — molecules in their real 3D shape.${cond ? ` Conditions: ${cond}.` : ''}`,
    uz: (_r, _b, cond) => `Boshlang‘ich moddalarni olamiz — molekulalar haqiqiy 3D shaklida.${cond ? ` Sharoit: ${cond}.` : ''}`,
  },
  products: {
    ru: (_r, by) => `Готово: продукты в своей настоящей форме.${by ? ` Побочный продукт — ${by}.` : ''}`,
    en: (_r, by) => `Done: the products in their real shape.${by ? ` By-product — ${by}.` : ''}`,
    uz: (_r, by) => `Tayyor: mahsulotlar haqiqiy shaklida.${by ? ` Qo‘shimcha mahsulot — ${by}.` : ''}`,
  },
  summary: {
    ru: (r) => `Тип реакции: ${reactionTypeName(r, 'ru')}. Каждый атом слева остался — только связи поменялись.`,
    en: (r) => `Reaction type: ${reactionTypeName(r, 'en')}. Every atom on the left is still here — only bonds changed.`,
    uz: (r) => `Reaksiya turi: ${reactionTypeName(r, 'uz')}. Chapdagi har bir atom saqlandi — faqat bog‘lar o‘zgardi.`,
  },
}

/** Фраза учителя для этапа (1–2 предложения, по типу реакции и реальным связям). */
export function teacherLine(r: OV2Reaction, sc: SynthScenario, stage: SynthStageKey, lang: SynthLang): string {
  const byNames = [
    ...new Set(sc.species.filter((s) => s.byproduct).map((s) => inorganicName(s.ref, lang) ?? subscript(s.ref.replace(/^inorg:/, '')))),
  ].join(', ')
  const cond = conditionsLabel(r)
  if (stage === 'reactants' || stage === 'products' || stage === 'summary') return STATIC[stage][lang](r, byNames, cond)
  const ctx: Ctx = {
    brk: bondList(sc, ['break'], true, lang),
    frm: bondList(sc, ['form'], false, lang),
    pi: piList(sc),
    by: byNames,
    cond,
  }
  const fam = familyOf(r, sc)
  return LINES[lang][fam][stage](ctx).replace(/\s+/g, ' ').trim()
}
