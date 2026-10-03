/**
 * Сборка src/chemistry/formationScripts.ts из таблицы docs/plans/formation200-rules.md (раздел 3):
 * тип образования (S | MP | N | PM | IB | IC | IH), путь (уравнение и вид пути), частицы/электроны, итог (решётка/форма),
 * генератор решётки из crystalData (если есть), ΔЭО и уникальный момент (RU). Фразы учителя EN/UZ и доработка
 * уникальных моментов — вручную в formationScriptsText.ts (не перезаписывается этим скриптом).
 *
 *   npx tsx scripts/build-formation-scripts.mts
 */
import fs from 'node:fs'
import path from 'node:path'
import { CATALOG_TOP200 } from '../src/data/catalog/catalogTop200.ts'

const ROOT = path.resolve(import.meta.dirname, '..')
const md = fs.readFileSync(path.join(ROOT, 'docs/plans/formation200-rules.md'), 'utf8')
const rows = md
  .split(/\r?\n/)
  .filter((l) => /^\| \d+ \| `/.test(l))
  .map((l) => l.split(' | ').map((c) => c.replace(/^\|\s*|\s*\|$/g, '').trim()))

type Kind = 'elements' | 'atoms' | 'neutralization' | 'oxideWater' | 'oxideAcid' | 'baseAcidOxide' | 'exchange' | 'decomposition' | 'redox' | 'hydration' | 'mixture' | 'protonTransfer' | 'dehydration'

/** Где эвристика по формулам ошибается — вид пути по химии (проверено вручную). */
const KIND_OVERRIDE: Record<string, Kind> = {
  tb_ph3: 'protonTransfer', salt_nh4_cl: 'protonTransfer', salt_nh4_no3: 'protonTransfer', salt_nh4_so4: 'protonTransfer', tb_nh42hpo4: 'protonTransfer', salt_nh4_co3: 'protonTransfer',
  hno3: 'redox', tb_n2o3: 'redox', salt_na_clo2: 'redox', salt_fe3_so4: 'redox', salt_mn_so4: 'redox', salt_cr_so4: 'redox',
  tb_naalo2: 'baseAcidOxide', tb_na2zno2: 'baseAcidOxide',
  h2o2: 'exchange', salt_k2cr2o7: 'exchange', hno2: 'exchange', h2sio3: 'exchange', cro3: 'exchange', hclo4: 'exchange', tb_mn2o7: 'exchange',
  tb_cl2o7: 'dehydration', tb_h4p2o7: 'dehydration', feo: 'dehydration', tb_cro: 'dehydration',
}
const SIMPLE = /^(\d*)(H₂|O₂|O₃|N₂|F₂|Cl₂|Br₂|I₂|S|S₈|P|P₄|C|Si|[A-Z][a-z]?)$/
const isMetalSym = (s: string) => /^(Li|Na|K|Rb|Cs|Be|Mg|Ca|Sr|Ba|Al|Zn|Fe|Cu|Ag|Au|Hg|Pb|Sn|Cr|Mn|Ni|Co|Ti|V|W|Mo|Cd)$/.test(s)
const strip = (f: string) => f.replace(/^\d+/, '').trim()

function routeKind(eq: string, direct: boolean): Kind {
  const [lhs = '', rhs = ''] = eq.split(/→|⇄|=/)
  const L = lhs.split('+').map((x) => strip(x.trim())).filter(Boolean)
  const R = rhs.split('+').map((x) => strip(x.trim())).filter(Boolean)
  if (direct && L.every((x) => SIMPLE.test(x) || /^\d*[A-Z][a-z]?$/.test(x))) return L.length === 1 && /^[A-Z][a-z]?$/.test(L[0]!) ? 'atoms' : 'elements'
  if (R.some((x) => x.includes('·'))) return L.includes('H₂O') ? 'hydration' : 'mixture'
  if (L.length === 1) return 'decomposition'
  const simple = L.filter((x) => SIMPLE.test(x) && !/^(\d*)(O₂)$/.test(x) ? true : false)
  if (simple.some((x) => isMetalSym(x.replace(/\d/g, '')) || /^(H₂|Cl₂|Br₂|I₂|F₂|S|C|P|Si)$/.test(x))) return 'redox'
  const acid = (x: string) => /^H[A-Z₀-₉]/.test(x) && x !== 'H₂O' && x !== 'H₂O₂'
  const base = (x: string) => /OH/.test(x)
  const oxide = (x: string) => /O[₀-₉]*$/.test(x) && !/H/.test(x) && !/[SNCP]O[₃₄]?$/.test(x.replace(/^[A-Z][a-z]?[₀-₉]*/, '')) // MeₓOᵧ
  const nmOxide = (x: string) => /^(CO₂|SO₂|SO₃|SiO₂|P₂O₅|NO₂|N₂O₅|CO)$/.test(x)
  if (L.includes('H₂O') && L.length === 2) return 'oxideWater'
  if (L.some(acid) && L.some(base)) return 'neutralization'
  if (L.some(acid) && L.some((x) => oxide(x) || /^[A-Z][a-z]?[₀-₉]*O[₀-₉]*$/.test(x))) return 'oxideAcid'
  if (L.some(base) && L.some(nmOxide)) return 'baseAcidOxide'
  if (L.some(nmOxide) && L.some((x) => /^[A-Z][a-z]?O$|^[A-Z][a-z]?₂O$/.test(x))) return 'baseAcidOxide'
  if (L.includes('O₂') || L.some((x) => /^Cl₂$/.test(x))) return 'redox'
  return 'exchange'
}

const LATTICE_GEN: [RegExp, string][] = [
  [/^NaCl, 6:6/, 'nacl'], [/^кварц|каркас тетраэдров SiO₄ \(кварц/, 'quartz'], [/кальцит/, 'calcite'], [/барит/, 'barite'],
  [/сфалерит/, 'sphalerite'], [/^вюрцит/, 'wurtzite'], [/^корунд/, 'corundum'], [/троилит/, 'troilite'], [/глёт/, 'litharge'],
  [/генератор zncl2/, 'zncl2'], [/типа CsCl/, 'cscl'],
]
const GEN_BY_ID: Record<string, string> = { nacl: 'nacl', mgo: 'mgo', cao: 'cao', sio2: 'quartz', salt_ca_co3: 'calcite', salt_ba_so4: 'barite', salt_zn_s: 'sphalerite', zno: 'wurtzite', al2o3: 'corundum', salt_fe2_s: 'troilite', pbo: 'litharge', salt_zn_cl: 'zncl2' }

const out: string[] = []
const seen = new Set<string>()
for (const c of rows) {
  const [, idCell, formula, name, cls, typeCell, routeCell, particles, lattice, den, special] = c
  const id = idCell!.replace(/`/g, '')
  seen.add(id)
  const type = typeCell!.replace(/\*/g, '')
  const noDirect = routeCell!.startsWith('—')
  const routeEq = noDirect ? routeCell!.replace(/^—.*?→\s*/, '') : routeCell!.replace(/\s+\(лаб\.:.*\)$/, '')
  const lab = noDirect ? null : (/\(лаб\.: (.*)\)$/.exec(routeCell!)?.[1] ?? null)
  const kind = KIND_OVERRIDE[id] ?? routeKind(routeEq, !noDirect)
  let gen = GEN_BY_ID[id] ?? null
  if (!gen) for (const [re, g] of LATTICE_GEN) if (re.test(lattice!)) gen = g
  const latticeKind =
    type === 'N' ? 'network' : type === 'PM' ? 'chain' : type === 'S' || type === 'MP' ? (/молекулярная/.test(lattice!) ? 'molecular' : 'none') : gen ? 'generator' : 'schema'
  out.push(
    `  ${JSON.stringify(id)}: { id: ${JSON.stringify(id)}, formula: ${JSON.stringify(formula)}, name: ${JSON.stringify(name)}, cls: ${JSON.stringify(cls)}, type: ${JSON.stringify(type)}, route: ${JSON.stringify(routeEq)}, routeKind: ${JSON.stringify(kind)}, direct: ${!noDirect}, lab: ${JSON.stringify(lab)}, particles: ${JSON.stringify(particles)}, lattice: ${JSON.stringify(lattice)}, latticeKind: ${JSON.stringify(latticeKind)}, latticeGen: ${JSON.stringify(gen)}, dEN: ${Number(den!.replace('ΔЭО ', '')) || 0}, special: ${JSON.stringify(special)} },`,
  )
}
const missing = [...CATALOG_TOP200].filter((id) => !seen.has(id))
if (missing.length || rows.length !== 200) throw new Error(`таблица: ${rows.length} строк, нет: ${missing.join(', ')}`)

const file = `/**
 * Сценарии «Как образуется» для 200 веществ каталога — СГЕНЕРИРОВАНО scripts/build-formation-scripts.mts из
 * docs/plans/formation200-rules.md (не править руками: правьте таблицу и пересоберите).
 * Тип: S — простое вещество (молекула), MP — полярная молекула, N — атомная решётка (SiO₂), PM — полимер,
 * IB — ионное бинарное, IC — ионное с многоатомным ионом, IH — кристаллогидрат / двойная соль.
 */
export type FormationType = 'S' | 'MP' | 'N' | 'PM' | 'IB' | 'IC' | 'IH'
export type FormationRouteKind = 'elements' | 'atoms' | 'neutralization' | 'oxideWater' | 'oxideAcid' | 'baseAcidOxide' | 'exchange' | 'decomposition' | 'redox' | 'hydration' | 'mixture' | 'protonTransfer' | 'dehydration'
/** Итог: решётка из генератора crystalData, обобщённая схема ионной решётки, молекулярная укладка, без решётки, атомный каркас, цепь. */
export type FormationLatticeKind = 'generator' | 'schema' | 'molecular' | 'none' | 'network' | 'chain'

export interface FormationScript {
  readonly id: string
  readonly formula: string
  readonly name: string
  readonly cls: string
  readonly type: FormationType
  /** уравнение пути образования (из простых веществ, если так получают; иначе — лабораторный путь) */
  readonly route: string
  readonly routeKind: FormationRouteKind
  /** route — из простых веществ */
  readonly direct: boolean
  /** второй (лабораторный) путь, если основной — из простых веществ */
  readonly lab: string | null
  /** частицы и число переданных электронов (ионные) / «общие электронные пары» */
  readonly particles: string
  /** итог: решётка (координация, тип) или форма — как в таблице правил */
  readonly lattice: string
  readonly latticeKind: FormationLatticeKind
  /** ключ CRYSTAL_DATA (src/chemistry/data/crystalData.ts), если решётка строится настоящим генератором */
  readonly latticeGen: string | null
  /** разность электроотрицательностей (Kimyo 8, § 14, табл. 13) */
  readonly dEN: number
  /** уникальный момент на уровне частиц (RU, из таблицы правил) */
  readonly special: string
}

export const FORMATION_SCRIPTS: Readonly<Record<string, FormationScript>> = {
${out.join('\n')}
}

export function formationScript(id: string): FormationScript | null {
  return FORMATION_SCRIPTS[id] ?? null
}
`
fs.writeFileSync(path.join(ROOT, 'src/chemistry/formationScripts.ts'), file)
const kinds: Record<string, number> = {}
for (const l of out) {
  const k = /routeKind: "(\w+)"/.exec(l)![1]!
  kinds[k] = (kinds[k] ?? 0) + 1
}
console.log('formationScripts.ts: 200 записей; пути:', JSON.stringify(kinds))
