/**
 * Мост «органический реестр → частица реактора» (10–11 классы и всё, чего нет среди формульных единиц
 * labSpecies): вещество узнаётся по составу И строению записи учебника.
 *
 *  1. Структурная запись (CH₃–CH₂Cl, CH₂=CH–CH₃, C₆H₅–CH=CH₂, HOCH₂CH₂OH, CH₃COOC₂H₅) разбирается в скелет
 *     (condensedFormula) и ищется в реестре органики по канонической подписи скелета — так этанол CH₃CH₂OH
 *     не спутать с диметиловым эфиром CH₃OCH₃, пропаналь CH₃CH₂CHO — с ацетоном CH₃COCH₃.
 *  2. Особые записи учебника (звено целлюлозы, глюкозид, комплексы) — таблица SPELLING_OVERRIDES.
 *  3. Брутто-формула (C₄H₁₀, C₆H₁₂O₆) строения не задаёт: берётся изомер, который учебник имеет в виду на
 *     этой странице (подсказка hint из ссылки), иначе самый школьный изомер (DEFAULT_ISOMER), иначе
 *     единственный изомер реестра, иначе н-алкан CₙH₂ₙ₊₂.
 *
 * 3D: вещество реестра — его граф (раскладка + релаксация, с водородами); чего в реестре нет (соли, нитро-
 * соединения, полимерные звенья) — скелет записи, раскладка тем же organicLayout. id частицы кодирует запись
 * («org:CH3-CH2Cl», «org:C2H4O@ethylene-oxide»), labOrganicById восстанавливает её по id.
 */
import type { CompoundDef } from '../types/chemistry'
import { formulaCompositionKey, formulaToUnicode, parseFormula, type FormulaCounts } from '../chemistry/equationFormula'
import {
  canonicalizeSkeleton,
  toCompoundPreview,
  type OrganicGraph,
  type OrganicElement,
  type SkeletonSpec,
} from '../chemistry/organic/organicGraph'
import { layoutOrganicGraph } from '../chemistry/organic/organicLayout'
import {
  parseCondensedFormula,
  parseSimpleSmiles,
  skeletonComposition,
  type CondensedSkeleton,
} from '../chemistry/organic/condensedFormula'
import { ORGANIC_MOLECULES, organicMoleculeById } from './organicLab/organicMoleculeRegistry'
import { ORGANIC_BUILD_CHALLENGES } from './researchLab/organicBuildCatalog'
import { TEXTBOOK_ORGANIC_SPECS } from './organicLab/textbookOrganic.data'

/** Самый школьный изомер брутто-формулы (состав → id реестра). */
export const DEFAULT_ISOMER: Readonly<Record<string, string>> = {
  'C:2|H:4|O:1': 'acetaldehyde',
  'C:2|H:6|O:1': 'ethanol',
  'C:2|H:4|O:2': 'acetic-acid',
  'C:3|H:6': 'propene',
  'C:3|H:4': 'propyne',
  'C:3|H:6|O:1': 'acetone',
  'C:3|H:8|O:1': 'propanol',
  'C:4|H:10': 'n-butane',
  'C:4|H:8': 'but-1-ene',
  'C:4|H:6': 'butadiene',
  'C:4|H:8|O:2': 'ethyl-acetate',
  'C:4|H:10|O:1': 'diethyl-ether',
  'C:5|H:12': 'n-pentane',
  'C:5|H:10': 'pent-1-ene',
  'C:5|H:8': 'isoprene',
  'C:6|H:12': 'cyclohexane',
  'C:6|H:14': 'n-hexane',
  'C:7|H:8': 'toluene',
  'C:7|H:8|O:1': 'o-cresol',
  'C:8|H:18': 'n-octane',
  'C:6|H:12|O:6': 'glucose-pyranose',
  'C:12|H:22|O:11': 'sucrose-structure',
}

type Override = { id: string } | { smiles: string; nameRu: string }

/** Особые записи учебника (ASCII, связи дефисом). */
const SPELLING_OVERRIDES: Readonly<Record<string, Override>> = {
  // фенолформальдегидные продукты: гидроксиметильная группа — в орто-положении (как в каталоге органики)
  HOC6H4CH2OH: { id: 'salicyl-alcohol' },
  HOC6H4CH2C6H4OH: { id: 'dihydroxydiphenylmethane' },
  C6H11O5OCH3: { id: 'methyl-glucoside' },
  'C6H7O6(CH3CO)5': { id: 'glucose-pentaacetate' },
  C7H7OH: { id: 'o-cresol' },
  C7H7OK: { smiles: 'CC1=CC=CC=C1O[K]', nameRu: 'Крезолят калия (2-метилфенолят калия)' },
  C6H10O6Cu: { smiles: 'OCC1OC(O)C(O[Cu]2)C(O2)C1O', nameRu: 'Глюкозат меди(II) (запись учебника)' },
  '(C6H11O6)2Cu': {
    smiles: 'OCC1OC(O)C(O[Cu]OC2C(O)C(O)C(CO)OC2O)C(O)C1O',
    nameRu: 'Глюкозат меди(II) (2 : 1)',
  },
  'C12H22O11*CaO': {
    smiles: 'OCC1OC(OC2(CO)OC(CO)C(O)C2O)C(O)C(O)C1O.[Ca]=O',
    nameRu: 'Сахарат кальция (сахароза · CaO)',
  },
  '[Fe(C6H5OH)6]Cl3': {
    smiles:
      '[Fe]([OH]C1=CC=CC=C1)([OH]C1=CC=CC=C1)([OH]C1=CC=CC=C1)([OH]C1=CC=CC=C1)([OH]C1=CC=CC=C1)[OH]C1=CC=CC=C1.[Cl].[Cl].[Cl]',
    nameRu: 'Комплекс фенола с железом(III) (запись учебника)',
  },
  '[(C2H5)2OH]HSO4': { smiles: 'CC[OH]CC.OS(=O)(=O)[O]', nameRu: 'Гидросульфат диэтилоксония' },
  'CH2OH(CHOH)4COONH4': { smiles: 'OCC(O)C(O)C(O)C(O)C(=O)[O].[NH4]', nameRu: 'Глюконат аммония' },
  // радикалы механизма хлорирования (10 кл., с. 28; пример учебника R = CH₃): «•» в записи → «*»
  'CH3*': { smiles: '[CH3]', nameRu: 'Метил-радикал CH₃•' },
  // резолвер реактора снимает точку радикала: отдельного вещества «CH₃» не бывает — это тот же метил-радикал
  CH3: { smiles: '[CH3]', nameRu: 'Метил-радикал CH₃•' },
  // звено крахмала без «n» — пример «на одно звено» (10 кл., с. 165: 2C₆H₁₀O₅ + H₂O → C₁₂H₂₂O₁₁)
  C6H10O5: { smiles: 'C1(*)OC(CO)C(O*)C(O)C1O', nameRu: 'Звено крахмала C₆H₁₀O₅ (на одно звено)' },
  // звенья полимеров (n — в подписи)
  '(C6H10O5)n': { smiles: 'C1(*)OC(CO)C(O*)C(O)C1O', nameRu: 'Звено крахмала / целлюлозы (C₆H₁₀O₅)ₙ' },
  '(C6H7O2(OH)3)n': { smiles: 'C1(*)OC(CO)C(O*)C(O)C1O', nameRu: 'Звено целлюлозы' },
  '(C6H7O2(ONO2)3)n': {
    smiles: 'C1(*)OC(CON(=O)[O])C(O*)C(ON(=O)[O])C1ON(=O)[O]',
    nameRu: 'Звено тринитрата целлюлозы (пироксилин)',
  },
  '(C6H7O2(OCOCH3)3)n': {
    smiles: 'C1(*)OC(COC(C)=O)C(O*)C(OC(C)=O)C1OC(C)=O',
    nameRu: 'Звено триацетата целлюлозы',
  },
  '(C6H3(OH)CH2)n': { smiles: 'OC1=C(C*)C=CC=C1*', nameRu: 'Звено фенолформальдегидной смолы' },
}

/** Названия веществ, которых нет в реестре органики (скелет из записи учебника). */
const EXTRA_NAMES: Readonly<Record<string, string>> = {
  'Br:1|C:1|H:3': 'Бромметан',
  'C:1|H:1|I:3': 'Йодоформ (трийодметан)',
  'C:1|H:1|Na:1|O:2': 'Формиат натрия',
  'C:2|H:3|Na:1|O:2': 'Ацетат натрия',
  'C:3|H:5|Na:1|O:2': 'Пропаноат натрия',
  'C:4|H:7|Na:1|O:2': 'Бутаноат натрия',
  'C:16|H:31|Na:1|O:2': 'Пальмитат натрия (мыло)',
  'C:18|H:35|Na:1|O:2': 'Стеарат натрия (мыло)',
  'C:2|H:5|Na:1|O:1': 'Этилат натрия',
  'C:2|H:5|Na:1': 'Этилнатрий',
  'C:2|H:4|Na:2|O:2': 'Этиленгликолят натрия',
  'C:3|H:5|Na:3|O:3': 'Глицерат натрия',
  'C:6|H:5|Na:1|O:1': 'Фенолят натрия',
  'C:6|H:5|K:1|O:1': 'Фенолят калия',
  'C:6|H:5|N:1|O:2': 'Нитробензол',
  'C:7|H:5|N:3|O:6': '2,4,6-Тринитротолуол (тротил)',
  'C:3|H:5|N:3|O:9': 'Тринитрат глицерина (нитроглицерин)',
  'C:2|H:5|N:1|O:3': 'Этилнитрат',
  'C:2|H:6|O:4|S:1': 'Этилсерная кислота',
  'C:6|H:6|O:3|S:1': 'Бензолсульфокислота',
  'C:6|H:5|Na:1|O:3|S:1': 'Бензолсульфонат натрия',
  'C:2|K:2|O:4': 'Оксалат калия',
  'C:4|Ca:1|H:6|O:4': 'Ацетат кальция',
  'C:4|Cu:1|H:10|O:4': 'Гликолят меди(II)',
  'C:6|Cu:1|H:14|O:6': 'Глицерат меди(II)',
  'C:18|Fe:1|H:15|O:3': 'Фенолят железа(III)',
  'C:4|H:9|I:1': '1-Иодбутан',
  'C:5|H:11|N:1|O:1': 'Пентанамид',
  'C:7|H:5|K:1|O:2': 'Бензоат калия',
  'C:23|H:48': 'Трикозан (н-алкан C₂₃H₄₈)',
}

/** Звенья полимеров (состав звена → название). */
const POLYMER_NAMES: Readonly<Record<string, string>> = {
  'C:2|H:4': 'Звено полиэтилена',
  'C:2|Cl:1|H:3': 'Звено поливинилхлорида',
  'C:8|H:8': 'Звено полистирола',
  'C:4|H:6': 'Звено бутадиенового каучука',
  'C:5|H:8': 'Звено изопренового (натурального) каучука',
  'C:4|Cl:1|H:5': 'Звено хлоропренового каучука',
  'C:12|H:14': 'Звено бутадиен-стирольного каучука',
  'C:10|H:8|O:4': 'Звено лавсана (полиэтилентерефталата)',
}

// ───────────────────────── реестр по строению ─────────────────────────

function specGraph(spec: SkeletonSpec): OrganicGraph {
  const atoms = spec.elements.map((element, i) => ({ id: `k${i}`, element, pos: [0, 0, 0] as [number, number, number] }))
  const bonds = spec.edges.map((e, i) => ({ id: `kb${i}`, a: `k${e[0]}`, b: `k${e[1]}`, order: (e[2] ?? 1) as 1 | 2 | 3 }))
  return { atoms, bonds }
}

function skeletonGraph(sk: CondensedSkeleton): OrganicGraph {
  return specGraph({
    elements: sk.atoms.map((a) => a.el as OrganicElement),
    edges: sk.bonds.map(([a, b, o]) => [a, b, o] as const),
  })
}

let registryIndex: { byCanon: Map<string, string>; byComposition: Map<string, string[]> } | null = null

function compositionOfGraph(g: OrganicGraph): FormulaCounts {
  const c: FormulaCounts = {}
  for (const a of g.atoms) c[a.element] = (c[a.element] ?? 0) + 1
  return c
}

/** Индекс реестра: каноническая подпись скелета → id (первый в порядке каталога), состав → id. */
function registry() {
  if (registryIndex) return registryIndex
  const skeletons = new Map<string, SkeletonSpec>()
  for (const c of ORGANIC_BUILD_CHALLENGES) skeletons.set(c.id, c.skeleton)
  for (const s of TEXTBOOK_ORGANIC_SPECS) if (!skeletons.has(s.id)) skeletons.set(s.id, s.skeleton)
  const byCanon = new Map<string, string>()
  const byComposition = new Map<string, string[]>()
  for (const m of ORGANIC_MOLECULES) {
    const spec = skeletons.get(m.id)
    const heavy = spec ? specGraph(spec) : m.graph
    const canon = canonicalizeSkeleton(heavy)
    if (!byCanon.has(canon)) byCanon.set(canon, m.id)
    // состав — из записи формулы, если она брутто-разбирается, иначе из графа
    const parsed = parseFormula(m.formula.replace(/[–—-]/g, ''))
    const counts = parsed && !parsed.charge ? parsed.counts : compositionOfGraph(m.graph)
    const key = formulaCompositionKey(counts)
    byComposition.set(key, [...(byComposition.get(key) ?? []), m.id])
  }
  registryIndex = { byCanon, byComposition }
  return registryIndex
}

/** id реестра по строению скелета (или null). */
export function registryIdForSkeleton(sk: CondensedSkeleton): string | null {
  if (sk.open.length) return null
  return registry().byCanon.get(canonicalizeSkeleton(skeletonGraph(sk))) ?? null
}

/** Все id реестра с этим составом. */
export function registryIdsForComposition(counts: Readonly<FormulaCounts>): string[] {
  return registry().byComposition.get(formulaCompositionKey(counts)) ?? []
}

// ───────────────────────── выбор вещества ─────────────────────────

/** Запись формулы для сравнения: ASCII-цифры, связи — «-», без пробелов и точек радикала. */
export function organicSpelling(formula: string): string {
  return formula
    .replace(/[₀-₉]/g, (c) => String(c.charCodeAt(0) - 0x2080))
    .replace(/ₙ/g, 'n')
    .replace(/[–—−]/g, '-')
    .replace(/[·•∙]/g, '*')
    .replace(/\s+/g, '')
}

export type OrganicPickHow = 'structure' | 'override' | 'hint' | 'default' | 'unique' | 'alkane' | 'skeleton'

export type OrganicPick = {
  /** id реестра органики или null (строение из записи). */
  registryId: string | null
  skeleton: CondensedSkeleton | null
  nameRu: string
  how: OrganicPickHow
  polymer: boolean
}

function linearAlkane(n: number): CondensedSkeleton {
  const atoms = Array.from({ length: n }, (_, i) => ({ el: 'C', h: i === 0 || i === n - 1 ? 3 : 2 }))
  if (n === 1) atoms[0]!.h = 4
  const bonds = Array.from({ length: Math.max(0, n - 1) }, (_, i) => [i, i + 1, 1] as const)
  return { atoms, bonds, open: [] }
}

function sameComposition(a: Readonly<FormulaCounts>, b: Readonly<FormulaCounts>): boolean {
  return formulaCompositionKey(a) === formulaCompositionKey(b)
}

/**
 * Органическое вещество по записи учебника и составу. hint — id реестра, который выбрал учебник на этой
 * странице для брутто-формулы (C₂H₄O → ethylene-oxide); к структурной записи не применяется.
 */
export function pickOrganic(formula: string, counts: Readonly<FormulaCounts>, hint?: string | null): OrganicPick | null {
  const spelling = organicSpelling(formula)
  const polymer = /\)n$/.test(spelling)
  const named = (id: string, how: OrganicPickHow): OrganicPick | null => {
    const m = organicMoleculeById[id]
    return m ? { registryId: id, skeleton: null, nameRu: m.nameRu, how, polymer } : null
  }
  const ov = SPELLING_OVERRIDES[spelling]
  if (ov) {
    if ('id' in ov) return named(ov.id, 'override')
    const sk = parseSimpleSmiles(ov.smiles)
    if (sk && sameComposition(skeletonComposition(sk), counts)) {
      return { registryId: null, skeleton: sk, nameRu: ov.nameRu, how: 'override', polymer }
    }
    return null
  }
  const sk = parseCondensedFormula(spelling)
  if (sk && sameComposition(skeletonComposition(sk), counts)) {
    const id = registryIdForSkeleton(sk)
    if (id) return named(id, 'structure')
    const key = formulaCompositionKey(counts)
    const nameRu = (polymer ? POLYMER_NAMES[key] : EXTRA_NAMES[key]) ?? displayFormula(spelling)
    return { registryId: null, skeleton: sk, nameRu, how: 'skeleton', polymer }
  }
  // брутто-формула
  const ids = registryIdsForComposition(counts)
  if (hint && ids.includes(hint)) return named(hint, 'hint')
  const def = DEFAULT_ISOMER[formulaCompositionKey(counts)]
  if (def && ids.includes(def)) return named(def, 'default')
  if (ids.length === 1) return named(ids[0]!, 'unique')
  const keys = Object.keys(counts)
  const c = counts.C ?? 0
  if (keys.length === 2 && c > 0 && counts.H === 2 * c + 2) {
    return { registryId: null, skeleton: linearAlkane(c), nameRu: EXTRA_NAMES[formulaCompositionKey(counts)] ?? `н-Алкан ${formulaToUnicode(spelling)}`, how: 'alkane', polymer }
  }
  return null
}

// ───────────────────────── частица реактора ─────────────────────────

const cache = new Map<string, CompoundDef | null>()

/** Скелет записи → 3D-граф: каждая связная часть раскладывается отдельно, части — в ряд. */
function graphFromSkeleton(sk: CondensedSkeleton): OrganicGraph {
  const n = sk.atoms.length
  const parent = Array.from({ length: n }, (_, i) => i)
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)))
  for (const [a, b] of sk.bonds) parent[find(a)] = find(b)
  const comps = new Map<number, number[]>()
  for (let i = 0; i < n; i++) comps.set(find(i), [...(comps.get(find(i)) ?? []), i])
  const out: OrganicGraph = { atoms: [], bonds: [] }
  let offsetX = 0
  let seq = 0
  for (const members of comps.values()) {
    const local = new Map(members.map((gi, li) => [gi, li]))
    const g: OrganicGraph = { atoms: [], bonds: [] }
    members.forEach((gi, li) => {
      g.atoms.push({ id: `a${li}`, element: sk.atoms[gi]!.el as OrganicElement, pos: [li * 1.4, 0, 0] })
    })
    sk.bonds.forEach(([a, b, o], k) => {
      if (local.has(a) && local.has(b)) g.bonds.push({ id: `b${k}`, a: `a${local.get(a)}`, b: `a${local.get(b)}`, order: o })
    })
    members.forEach((gi, li) => {
      for (let h = 0; h < sk.atoms[gi]!.h; h++) {
        const id = `h${li}_${h}`
        g.atoms.push({ id, element: 'H', pos: [li * 1.4, 1, 0] })
        g.bonds.push({ id: `hb${li}_${h}`, a: `a${li}`, b: id, order: 1 })
      }
    })
    const laid = members.length === 1 && sk.atoms[members[0]!]!.h === 0 ? g : layoutOrganicGraph(g)
    let minX = Infinity
    let maxX = -Infinity
    for (const a of laid.atoms) {
      minX = Math.min(minX, a.pos[0])
      maxX = Math.max(maxX, a.pos[0])
    }
    const dx = offsetX - minX
    const idMap = new Map<string, string>()
    for (const a of laid.atoms) {
      const id = `p${seq++}`
      idMap.set(a.id, id)
      out.atoms.push({ ...a, id, pos: [a.pos[0] + dx, a.pos[1], a.pos[2]] })
    }
    for (const b of laid.bonds) out.bonds.push({ ...b, id: `p${seq++}`, a: idMap.get(b.a)!, b: idMap.get(b.b)! })
    offsetX += maxX - minX + 2.6
  }
  return out
}

/** Подпись формулы: запись учебника в Unicode, связи — тире. */
function displayFormula(spelling: string): string {
  const u = formulaToUnicode(spelling.replace(/\)n$/, ')').replace(/\*/g, '·'))
  return (/\)n$/.test(spelling) ? `${u}ₙ` : u).replace(/-/g, '–')
}

/** id частицы: «org:<запись>» или «org:<запись>@<hint>». */
export function labOrganicSpeciesId(formula: string, hint?: string | null): string {
  return `org:${organicSpelling(formula)}${hint ? `@${hint}` : ''}`
}

function buildSpecies(id: string, spelling: string, pick: OrganicPick, counts: Readonly<FormulaCounts>): CompoundDef | null {
  let graph: () => OrganicGraph
  if (pick.registryId) {
    const m = organicMoleculeById[pick.registryId]
    if (!m) return null
    graph = () => m.graph
  } else if (pick.skeleton) {
    const sk = pick.skeleton
    let g: OrganicGraph | null = null
    graph = () => (g ??= graphFromSkeleton(sk))
  } else return null
  // 3D-граф (релаксация крупных молекул — сотни мс) строится при первом показе
  let preview: ReturnType<typeof toCompoundPreview> | null = null
  const view = () => (preview ??= toCompoundPreview(graph(), id))
  const formulaUnicode = displayFormula(spelling)
  return {
    id,
    nameRu: pick.nameRu,
    formulaUnicode,
    composition: { ...counts },
    get atoms() {
      return view().atoms
    },
    get bonds() {
      return view().bonds
    },
    accentColor: '#9be38a',
    descriptionRu: `${pick.nameRu} (${formulaUnicode}) — органическое вещество${pick.polymer ? ', звено полимера (n звеньев)' : ''}.`,
    laboratoryRecipeRu: '',
    obtainingStepsRu: [],
    category: 'other',
    synthesisConditionsRu: {},
    factsRu: { source: '', usage: '', importance: '' },
  }
}

/** Частица реактора по id «org:…»; null — не органическая частица или запись не разбирается. */
export function labOrganicById(id: string): CompoundDef | null {
  if (!id.startsWith('org:')) return null
  if (cache.has(id)) return cache.get(id) ?? null
  const body = id.slice(4)
  const at = body.lastIndexOf('@')
  const spelling = at >= 0 ? body.slice(0, at) : body
  const hint = at >= 0 ? body.slice(at + 1) : null
  // радикальная точка записи («CH3*», «Cl*») в состав не входит
  const parsed = parseFormula(spelling.replace(/\)n$/, ')').replace(/-/g, '').replace(/^\*+|\*+$/g, ''))
  let result: CompoundDef | null = null
  if (parsed && !parsed.electron) {
    const pick = pickOrganic(spelling, parsed.counts, hint)
    if (pick) result = buildSpecies(id, spelling, pick, parsed.counts)
  }
  cache.set(id, result)
  return result
}

/** Органическая частица реактора по записи учебника и составу; вместе с тем, как выбрано вещество. */
export function labOrganicSpeciesFor(
  formula: string,
  counts: Readonly<FormulaCounts>,
  hint?: string | null,
): { compound: CompoundDef; pick: OrganicPick } | null {
  const pick = pickOrganic(formula, counts, hint)
  if (!pick) return null
  const id = labOrganicSpeciesId(formula, pick.how === 'hint' ? hint : null)
  const cached = cache.get(id)
  // null в кэше мог остаться от запроса по id, который не разобрался; раз вещество подобрано — строим заново
  const compound = cached ?? buildSpecies(id, organicSpelling(formula), pick, counts)
  cache.set(id, compound)
  if (!compound || !sameComposition(compound.composition, counts)) return null
  return { compound, pick }
}
