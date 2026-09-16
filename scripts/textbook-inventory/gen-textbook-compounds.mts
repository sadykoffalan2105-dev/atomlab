// Генерирует src/data/textbookCompounds.data.ts — неорганические вещества (и соли органических кислот),
// которые есть в учебниках «Химия» 7–11, но отсутствовали в каталоге.
// Вход: .smoke/textbook-inventory/missing-classified.json (classify-missing.mts) + src/data/textbook/*.json.
// Запуск: npx tsx scripts/textbook-inventory/gen-textbook-compounds.mts
import fs from 'node:fs'
import path from 'node:path'
import { ascii, parseComposition } from './formula.mts'

type Row = { formula: string; nameRu: string; kind: string; grades: number[]; mentions: number; comp: Record<string, number>; group: string }
const { rows } = JSON.parse(fs.readFileSync('.smoke/textbook-inventory/missing-classified.json', 'utf8')) as { rows: Row[] }

const DIR = 'src/data/textbook'
const GRADES = [7, 8, 9, 10, 11]

/** Нестандартные формулы, которые оставляем несмотря на «несбалансированность» (смешанные степени окисления и т. п.). */
const EXTRA_OK = new Set(['CaOCl2', 'OF2', 'KO3', 'Br2O7', 'Fe3C', 'Fe(CO)5', 'KFe[Fe(CN)6]', 'Fe3[Fe(CN)6]2', 'Fe4[Fe(CN)6]3', 'Sc(OH)3', 'Sc2O3', 'P4S7'])
/** Соли/алкоголяты органических кислот, которые показываем в неорганическом каталоге. */
const ORGANIC_SALTS = new Set([
  'CH3COONa', 'C2H5ONa', 'C6H5ONa', 'C17H35COONa', '(CH3COO)2Ca', 'C2H5COONa', 'CH3CH2CH2COONa', '(CH3COO)2Mg', 'CH3COOK',
  'NH4NCS', 'HCOONa', 'NaOCH2CH2ONa', 'C3H5(ONa)3', 'Fe(OC6H5)3', 'C6H5SO3Na', 'C6H5OK', 'C15H31COONa', 'Cu3C2H2O8',
])
const SKIP = new Set(['NO3', 'SiO', '(NH4)2HPO4·(NH4)2SO4', 'CuZn', 'Cu3Al', 'Cu5Zn8'])

const NAME: Record<string, string> = {
  'Ca3(PO4)2': 'Фосфат кальция', PH3: 'Фосфин', SiH4: 'Силан', CaH2: 'Гидрид кальция', CaC2: 'Карбид кальция',
  'CuSO4·5H2O': 'Медный купорос', Cl2O7: 'Оксид хлора(VII)', NaH: 'Гидрид натрия', Na3PO4: 'Фосфат натрия', CS2: 'Сероуглерод',
  '(CuOH)2CO3': 'Гидроксокарбонат меди(II) (малахит)', Mn2O7: 'Оксид марганца(VII)', N2O3: 'Оксид азота(III)', HgO: 'Оксид ртути(II)',
  K2O2: 'Пероксид калия', CCl4: 'Тетрахлорметан', HPO3: 'Метафосфорная кислота', CrO: 'Оксид хрома(II)', Mn3O4: 'Оксид марганца(II,III)',
  BeCl2: 'Хлорид бериллия', H2Se: 'Селеноводород', MnO: 'Оксид марганца(II)', Mn2O3: 'Оксид марганца(III)', KO2: 'Надпероксид калия',
  V2O5: 'Оксид ванадия(V)', NaAlO2: 'Метаалюминат натрия', 'Na[Al(OH)4]': 'Тетрагидроксоалюминат натрия', Ag3PO4: 'Фосфат серебра',
  BeO: 'Оксид бериллия', 'Cr(OH)3': 'Гидроксид хрома(III)', Cl2O5: 'Оксид хлора(V)', Sb2O3: 'Оксид сурьмы(III)', WO3: 'Оксид вольфрама(VI)',
  MgH2: 'Гидрид магния', 'Na2[Zn(OH)4]': 'Тетрагидроксоцинкат натрия', H2Cr2O7: 'Дихромовая кислота', H4SiO4: 'Ортокремниевая кислота',
  H4P2O7: 'Пирофосфорная кислота', TiO2: 'Оксид титана(IV)', Si3N4: 'Нитрид кремния', TiC: 'Карбид титана', Au2O3: 'Оксид золота(III)',
  Cl2O3: 'Оксид хлора(III)', TiCl4: 'Хлорид титана(IV)', Pb3O4: 'Свинцовый сурик', AgOH: 'Гидроксид серебра', H2B4O7: 'Тетраборная кислота',
  H4V2O7: 'Пированадиевая кислота', NiO: 'Оксид никеля(II)', 'Pt(NO3)2': 'Нитрат платины(II)', As2S3: 'Сульфид мышьяка(III) (аурипигмент)',
  'Na2B4O7*10H2O': 'Бура', N2O4: 'Тетраоксид диазота', 'KCl·NaCl': 'Сильвинит', 'KCl*MgCl2*6H2O': 'Карналлит', KO3: 'Озонид калия',
  NOCl: 'Нитрозилхлорид', Na2S2O3: 'Тиосульфат натрия', H2MnO4: 'Марганцовистая кислота', 'MnSO4*4H2O': 'Тетрагидрат сульфата марганца(II)',
  'CaSO4*H2O': 'Моногидрат сульфата кальция', '(CaSO4)2*H2O': 'Алебастр (жжёный гипс)', 'Ca5(PO4)3OH': 'Гидроксиапатит',
  'Na2O*CaO*6SiO2': 'Стекло (оконное)', 'MgO*CaO': 'Обожжённый доломит', 'KFe[Fe(CN)6]': 'Гексацианоферрат(II) калия-железа(III)',
  OF2: 'Фторид кислорода', CaOCl2: 'Хлорная известь', 'K3[Fe(CN)6]': 'Красная кровяная соль', 'K4[Fe(CN)6]': 'Жёлтая кровяная соль',
  '[Cu(NH3)4](OH)2': 'Гидроксид тетраамминмеди(II) (реактив Швейцера)', HAuCl4: 'Тетрахлорозолотая кислота', 'Cu2S': 'Сульфид меди(I) (медный блеск)',
  'CuCl2*2H2O': 'Дигидрат хлорида меди(II)', 'Cu(NO3)2*3H2O': 'Тригидрат нитрата меди(II)', 'K[Au(CN)2]': 'Дицианоаурат(I) калия',
  'Al2(SO4)3*18H2O': 'Кристаллогидрат сульфата алюминия', 'Fe2(SO4)3*9H2O': 'Кристаллогидрат сульфата железа(III)', CuOH: 'Гидроксид меди(I)',
  '[Ag(NH3)2]OH': 'Гидроксид диамминсеребра(I)', HgSO4: 'Сульфат ртути(II)', CdS: 'Сульфид кадмия', HgS: 'Сульфид ртути(II) (киноварь)',
  'Na3[Cr(OH)6]': 'Гексагидроксохромат(III) натрия', H2Te: 'Теллуроводород', H2SO4·H2O: 'Моногидрат серной кислоты',
  'NaOH·H2O': 'Моногидрат гидроксида натрия', 'Ca5(PO4)3F': 'Фторапатит', CH3COONa: 'Ацетат натрия', C2H5ONa: 'Этилат натрия',
  C6H5ONa: 'Фенолят натрия', C17H35COONa: 'Стеарат натрия (мыло)', '(CH3COO)2Ca': 'Ацетат кальция', C2H5COONa: 'Пропионат натрия',
  CH3CH2CH2COONa: 'Бутират натрия', '(CH3COO)2Mg': 'Ацетат магния', CH3COOK: 'Ацетат калия', NH4NCS: 'Роданид аммония',
  HCOONa: 'Формиат натрия', NaOCH2CH2ONa: 'Гликолят натрия', 'C3H5(ONa)3': 'Глицерат натрия', 'Fe(OC6H5)3': 'Фенолят железа(III)',
  C6H5SO3Na: 'Бензолсульфонат натрия', C6H5OK: 'Фенолят калия', C15H31COONa: 'Пальмитат натрия (мыло)', Cu3C2H2O8: 'Азурит',
  'Fe(CO)5': 'Пентакарбонил железа', Fe3C: 'Карбид железа (цементит)', Br2O7: 'Оксид брома(VII)', P4S7: 'Сульфид фосфора P₄S₇',
  'Fe3[Fe(CN)6]2': 'Турнбулева синь', 'Fe4[Fe(CN)6]3': 'Берлинская лазурь', 'Sc(OH)3': 'Гидроксид скандия', Sc2O3: 'Оксид скандия',
  'K2O*Al2O3*6SiO2': 'Полевой шпат (ортоклаз)', 'Na2O*Al2O3*6SiO2': 'Полевой шпат (альбит)', 'Al2O3*2SiO2*2H2O': 'Каолин',
  NH2OH: 'Гидроксиламин', N2H4: 'Гидразин', Cu2C2: 'Ацетиленид меди(I)', '(CN)2': 'Дициан', KNCS: 'Роданид калия', 'Fe(NCS)3': 'Роданид железа(III)',
}
/** Формула в каталоге, если в учебнике записана брутто-формулой. */
const FORMULA_DISPLAY: Record<string, string> = { Cu3C2H2O8: 'Cu3(CO3)2(OH)2' }

const METALS = new Set(
  'Li Be Na Mg Al K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Rb Sr Y Zr Nb Mo Ag Cd In Sn Cs Ba La W Pt Au Hg Tl Pb Bi U'.split(' '),
)
const OX_O2: Record<string, number[]> = {
  H: [1], Li: [1], Na: [1], K: [1], Rb: [1], Cs: [1], Be: [2], Mg: [2], Ca: [2], Sr: [2], Ba: [2], Al: [3], Sc: [3], Zn: [2], Cd: [2],
  Hg: [1, 2], Cu: [1, 2], Ag: [1], Au: [1, 3], Fe: [2, 3], Co: [2, 3], Ni: [2, 3], Mn: [2, 3, 4, 6, 7], Cr: [2, 3, 6], V: [2, 3, 4, 5],
  Ti: [2, 3, 4], W: [4, 6], Mo: [4, 6], Sn: [2, 4], Pb: [2, 4], Ge: [2, 4], Si: [2, 4], B: [3], C: [2, 4], N: [1, 2, 3, 4, 5],
  P: [3, 5], As: [3, 5], Sb: [3, 5], S: [4, 6], Se: [4, 6], Te: [4, 6], Cl: [1, 3, 4, 5, 7], Br: [1, 5, 7], I: [5, 7], Xe: [6, 8], Pt: [2, 4],
}

function isNormalOxide(comp: Record<string, number>): boolean {
  const els = Object.keys(comp)
  if (els.length !== 2 || !comp.O) return false
  const other = els.find((e) => e !== 'O')!
  return (OX_O2[other] ?? []).some((s) => s * comp[other]! === 2 * comp.O!)
}

function categorize(f: string, comp: Record<string, number>): 'oxide' | 'acid' | 'base' | 'salt' | 'other' {
  const parts = f.split(/[·*]/).map((p) => p.replace(/^\d+/, ''))
  if (parts.length > 1) {
    const allOxides = parts.every((p) => {
      const c = parseComposition(p)
      return c && (isNormalOxide(c) || p === 'H2O')
    })
    if (allOxides) return f.includes('Si') ? 'salt' : 'oxide'
    return categorize(parts[0]!, parseComposition(parts[0]!)!)
  }
  if (f === 'Mn3O4' || f === 'Pb3O4') return 'oxide'
  if (isNormalOxide(comp)) return 'oxide'
  if (/^H\d*[A-Z(]/.test(f) && f !== 'H2O2' && !/^H\d*O\d*$/.test(f)) return 'acid'
  if (/^(\[[^\]]+\]|\(?[A-Z][a-z]?\d*\)?)(\(OH\)\d*|OH)$/.test(f) && f !== 'NH2OH') return 'base'
  const els = Object.keys(comp)
  const hasCation = els.some((e) => METALS.has(e)) || /NH4/.test(f)
  if (hasCation) {
    const partners = els.filter((e) => !METALS.has(e))
    if (partners.length > 0 && partners.every((e) => ['N', 'P', 'C', 'Si', 'H', 'B'].includes(e)) && !/NH4|CN|NCS/.test(f)) return 'other'
    if (partners.length === 1 && partners[0] === 'O' && els.filter((e) => METALS.has(e)).length === 1) return 'other'
    if (/^[A-Z][a-z]?\d*\(CO\)\d*$/.test(f)) return 'other'
    return 'salt'
  }
  return 'other'
}

const SUBS = '₀₁₂₃₄₅₆₇₈₉'
const unicode = (f: string) => f.replace(/\*/g, '·').replace(/([A-Za-z)\]])(\d+)/g, (_, a: string, d: string) => a + d.replace(/\d/g, (x) => SUBS[Number(x)]!))

const idOf = (f: string) =>
  'tb_' +
  f
    .toLowerCase()
    .replace(/[·*]/g, '_')
    .replace(/[()[\]]/g, '')
    .replace(/[^a-z0-9_]/g, '')

function cleanName(raw: string): string {
  let n = raw
    .replace(/\s*\((?:[^()]*(?:в книге|так в|задани|схема|катализатор|микроудобр|осадок|изомер|структурн|в смеси|костная|кристаллогидрат|производн)[^()]*)\)/gi, '')
    .replace(/\s+\((I{1,3}|IV|VI{0,3}|V)\)/g, '($1)')
    .replace(/\s+/g, ' ')
    .trim()
  if (n) n = n[0]!.toUpperCase() + n.slice(1)
  return n
}

// Темы учебников по составу вещества.
type Topic = { grade: number; title: string; page: number | null }
const compKey = (c: Record<string, number>) =>
  Object.entries(c)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([e, k]) => `${e}${k}`)
    .join('')
const topicsByKey = new Map<string, Topic[]>()
for (const g of GRADES) {
  const inv = JSON.parse(fs.readFileSync(path.join(DIR, `inventory-g${g}.json`), 'utf8')) as { sections: { sectionId: string; title: string; pageStart?: number }[] }
  const titleById = new Map(inv.sections.map((s) => [s.sectionId, s]))
  const subs = JSON.parse(fs.readFileSync(path.join(DIR, `substances-g${g}.json`), 'utf8')) as { substances: { formula: string | null; sections?: string[]; firstPage?: number | null }[] }
  for (const s of subs.substances) {
    const c = s.formula ? parseComposition(s.formula) : null
    if (!c) continue
    const k = compKey(c)
    const arr = topicsByKey.get(k) ?? []
    const sec = s.sections?.map((id) => titleById.get(id)).find(Boolean)
    if (sec && !arr.some((t) => t.grade === g)) arr.push({ grade: g, title: sec.title.replace(/^§\s*\d+\.?\s*/, ''), page: s.firstPage ?? sec.pageStart ?? null })
    topicsByKey.set(k, arr)
  }
}

const CATEGORY_TEXT: Record<string, string> = {
  oxide: 'Оксид — сложное вещество из двух элементов, один из которых кислород.',
  acid: 'Кислота — сложное вещество, в состав которого входят атомы водорода, способные замещаться на атомы металла, и кислотный остаток.',
  base: 'Основание (гидроксид) — сложное вещество, состоящее из атомов металла (или сложного катиона) и гидроксогрупп OH.',
  salt: 'Соль — сложное вещество, состоящее из катионов металла (или аммония) и анионов кислотного остатка.',
  other: 'Неорганическое соединение, которое рассматривается в школьном курсе химии.',
}

function describe(name: string, formulaU: string, f: string, cat: string, topics: Topic[]): string {
  let kindText = CATEGORY_TEXT[cat]!
  if (/[·*]/.test(f) && /H2O/.test(f.split(/[·*]/).slice(1).join(''))) kindText = 'Кристаллогидрат: в кристаллах вещества содержится химически связанная вода.'
  if (/COO/.test(f)) kindText = 'Соль карбоновой кислоты: атом водорода карбоксильной группы замещён на металл.'
  else if (/^C\d*H\d*O(Na|K)$|C6H5O(Na|K)|ONa\)|OCH2CH2ONa|OC6H5/.test(f)) kindText = 'Алкоголят (фенолят): атом водорода гидроксильной группы замещён на металл.'
  else if (/^[A-Z][a-z]?\d*H\d*$/.test(f) && cat === 'other' && METALS.has(f.match(/^[A-Z][a-z]?/)![0])) kindText = 'Гидрид металла — бинарное соединение металла с водородом.'
  else if (/N\d*$/.test(f) && cat === 'other' && !/H/.test(f)) kindText = 'Нитрид — бинарное соединение элемента с азотом.'
  else if (/C\d*$/.test(f) && cat === 'other' && !/[HOS]/.test(f)) kindText = 'Карбид — бинарное соединение элемента с углеродом.'
  const where = topics
    .slice(0, 3)
    .map((t) => `${t.grade} класс — «${t.title}»${t.page ? ` (с. ${t.page})` : ''}`)
    .join('; ')
  return `${name} (${formulaU}). ${kindText}${where ? ` В учебниках «Химия»: ${where}.` : ''}`
}

type Out = { id: string; category: string; nameRu: string; formulaUnicode: string; composition: Record<string, number>; descriptionRu: string; grades: number[] }
const out: Out[] = []
const noName: string[] = []
for (const r of rows) {
  const f = r.formula
  if (SKIP.has(f)) continue
  const take = r.group === 'inorganic' || (r.group === 'inorganic-unbalanced' && EXTRA_OK.has(f)) || (ORGANIC_SALTS.has(f) && (r.group === 'organic-salt' || r.group === 'organic'))
  if (!take) continue
  const display = FORMULA_DISPLAY[f] ?? f
  let name = NAME[f] ?? cleanName(r.nameRu)
  if (!/[а-яё]{3}/i.test(name) || /[А-Я][а-я]?\d/.test(name)) {
    noName.push(f)
    continue
  }
  const cat = ORGANIC_SALTS.has(f) ? 'salt' : categorize(f, r.comp)
  const formulaU = unicode(display)
  const topics = topicsByKey.get(compKey(r.comp)) ?? []
  out.push({
    id: idOf(display),
    category: cat,
    nameRu: name,
    formulaUnicode: formulaU,
    composition: r.comp,
    descriptionRu: describe(name, formulaU, f, cat, topics),
    grades: [...new Set(topics.map((t) => t.grade).concat(r.grades))].sort((a, b) => a - b),
  })
}

// Простые вещества-молекулы из учебников (металлы и благородные газы — в таблице Менделеева).
const SIMPLE: [string, string, string, Record<string, number>, string][] = [
  ['tb_h2', 'Водород', 'H₂', { H: 2 }, 'Водород (H₂) — самый лёгкий газ, двухатомные молекулы с ковалентной неполярной связью. Горит, образуя воду; восстанавливает металлы из оксидов.'],
  ['tb_o2', 'Кислород', 'O₂', { O: 2 }, 'Кислород (O₂) — газ без цвета и запаха, поддерживает горение и дыхание. Получают разложением KMnO₄, H₂O₂, KClO₃; собирают вытеснением воздуха или воды.'],
  ['tb_o3', 'Озон', 'O₃', { O: 3 }, 'Озон (O₃) — аллотропная модификация кислорода, газ с резким запахом и сильный окислитель. Озоновый слой задерживает ультрафиолетовое излучение Солнца.'],
  ['tb_n2', 'Азот', 'N₂', { N: 2 }, 'Азот (N₂) — основной компонент воздуха (78 % по объёму). Молекула с тройной связью очень прочна, поэтому азот малоактивен при обычных условиях.'],
  ['tb_f2', 'Фтор', 'F₂', { F: 2 }, 'Фтор (F₂) — светло-жёлтый ядовитый газ, самый сильный окислитель среди простых веществ; в соединениях проявляет степень окисления −1.'],
  ['tb_cl2', 'Хлор', 'Cl₂', { Cl: 2 }, 'Хлор (Cl₂) — жёлто-зелёный ядовитый газ с резким запахом. Взаимодействует с металлами и водородом; применяется для обеззараживания воды.'],
  ['tb_br2', 'Бром', 'Br₂', { Br: 2 }, 'Бром (Br₂) — тяжёлая красно-бурая жидкость с резким запахом, единственный жидкий неметалл при обычных условиях. Бромная вода обесцвечивается непредельными соединениями.'],
  ['tb_i2', 'Иод', 'I₂', { I: 2 }, 'Иод (I₂) — тёмно-фиолетовые кристаллы, при нагревании возгоняются. Спиртовой раствор иода — антисептик; с крахмалом даёт синее окрашивание.'],
  ['tb_p4', 'Белый фосфор', 'P₄', { P: 4 }, 'Белый фосфор (P₄) — аллотропная модификация фосфора из тетраэдрических молекул. Ядовит, светится в темноте и самовоспламеняется на воздухе; хранят под водой.'],
  ['tb_s8', 'Ромбическая сера', 'S₈', { S: 8 }, 'Ромбическая сера (S₈) — жёлтые кристаллы из циклических молекул S₈, устойчивая при обычных условиях аллотропная модификация серы.'],
]
for (const [id, nameRu, formulaUnicode, composition, descriptionRu] of SIMPLE) {
  out.unshift({ id, category: 'other', nameRu, formulaUnicode, composition, descriptionRu, grades: [7, 8, 9] })
}

const ids = new Set<string>()
for (const o of out) {
  if (ids.has(o.id)) throw new Error(`duplicate id ${o.id}`)
  ids.add(o.id)
}

const body = out
  .map(({ grades: _g, ...o }) => `  ${JSON.stringify(o)},`)
  .join('\n')
fs.writeFileSync(
  'src/data/textbookCompounds.data.ts',
  `// Сгенерировано scripts/textbook-inventory/gen-textbook-compounds.mts — не редактировать вручную.
// Вещества из учебников «Химия» 7–11, которых не было в каталоге.
import type { RawCompoundDef } from '../types/chemistry'

export const TEXTBOOK_EXTRA_RAW: RawCompoundDef[] = [
${body}
]

/** Классы учебников, в которых встречается вещество. */
export const TEXTBOOK_EXTRA_GRADES: Record<string, readonly number[]> = ${JSON.stringify(Object.fromEntries(out.map((o) => [o.id, o.grades])))}
`,
)
const byCat: Record<string, number> = {}
for (const o of out) byCat[o.category] = (byCat[o.category] ?? 0) + 1
console.log('generated', out.length, byCat)
console.log('no clean name (skipped):', noName.join(', '))
if (process.argv.includes('--list')) for (const o of out) console.log(`${o.category.slice(0, 3)}|${o.formulaUnicode}|${o.nameRu}`)
