/**
 * Школьная номенклатура ИЮПАК (RU по учебнику Kimyo 10, EN, UZ) для собранного скелета.
 *
 * Покрытие: алканы, циклоалканы, алкены/алкины/алкадиены (цис/транс), галогенпроизводные, спирты (-ол, -диол),
 * альдегиды, кетоны, карбоновые кислоты, сложные эфиры (алкилалканоат, «этиловый эфир уксусной кислоты»),
 * простые эфиры (радикально-функциональные и «алкокси»), амины, нитросоединения, производные бензола, фенол.
 * Тривиальные названия учебника — синонимы (trivial.ts).
 *
 * Правила главной цепи (школьные): больше старших групп → кольцо при равенстве → больше кратных связей →
 * длиннее → больше двойных → больше заместителей → наименьшие локанты (старшая группа, кратные, двойные,
 * заместители, первый по алфавиту).
 */
import { bondKey, toMol, type Mol, type SkeletonGraph } from './graph'
import { canonicalizeMol } from './canonical'
import { trivialNamesFor } from './trivial'

export type Lang = 'ru' | 'en' | 'uz'

/** Результат: главное название и синонимы на трёх языках. */
export interface MoleculeName {
  readonly ru: string
  readonly en: string
  readonly uz: string
  /** все варианты RU (тривиальное, старый и новый стиль локантов, порядок приставок) */
  readonly synonymsRu: readonly string[]
  readonly synonymsEn: readonly string[]
  readonly synonymsUz: readonly string[]
  /** название получено систематически (а не только из словаря тривиальных) */
  readonly systematic: boolean
}

// ───────────────────────── лексикон ─────────────────────────

const STEM: Record<Lang, string[]> = {
  ru: ['', 'мет', 'эт', 'проп', 'бут', 'пент', 'гекс', 'гепт', 'окт', 'нон', 'дек'],
  en: ['', 'meth', 'eth', 'prop', 'but', 'pent', 'hex', 'hept', 'oct', 'non', 'dec'],
  uz: ['', 'met', 'et', 'prop', 'but', 'pent', 'geks', 'gept', 'okt', 'non', 'dek'],
}
const UNITS: Record<Lang, string[]> = {
  ru: ['', 'ген', 'до', 'три', 'тетра', 'пента', 'гекса', 'гепта', 'окта', 'нона'],
  en: ['', 'hen', 'do', 'tri', 'tetra', 'penta', 'hexa', 'hepta', 'octa', 'nona'],
  uz: ['', 'gen', 'do', 'tri', 'tetra', 'penta', 'geksa', 'gepta', 'okta', 'nona'],
}
const TENS: Record<Lang, string[]> = {
  ru: ['', 'дек', 'коз', 'триаконт', 'тетраконт'],
  en: ['', 'dec', 'cos', 'triacont', 'tetracont'],
  uz: ['', 'dek', 'koz', 'triakont', 'tetrakont'],
}
function stem(n: number, L: Lang): string {
  if (n <= 10) return STEM[L][n]
  if (n === 11) return { ru: 'ундек', en: 'undec', uz: 'undek' }[L]
  if (n === 20) return { ru: 'эйкоз', en: 'icos', uz: 'eykoz' }[L]
  if (n === 21) return { ru: 'генэйкоз', en: 'henicos', uz: 'geneykoz' }[L]
  const u = n % 10, t = Math.floor(n / 10)
  return UNITS[L][u] + TENS[L][t]
}
const MULT: Record<Lang, string[]> = {
  ru: ['', '', 'ди', 'три', 'тетра', 'пента', 'гекса', 'гепта', 'окта'],
  en: ['', '', 'di', 'tri', 'tetra', 'penta', 'hexa', 'hepta', 'octa'],
  uz: ['', '', 'di', 'tri', 'tetra', 'penta', 'geksa', 'gepta', 'okta'],
}
const HETERO_PREFIX: Record<string, Record<Lang, string>> = {
  F: { ru: 'фтор', en: 'fluoro', uz: 'ftor' },
  Cl: { ru: 'хлор', en: 'chloro', uz: 'xlor' },
  Br: { ru: 'бром', en: 'bromo', uz: 'brom' },
  I: { ru: 'иод', en: 'iodo', uz: 'yod' },
  nitro: { ru: 'нитро', en: 'nitro', uz: 'nitro' },
  amino: { ru: 'амино', en: 'amino', uz: 'amino' },
  hydroxy: { ru: 'гидрокси', en: 'hydroxy', uz: 'gidroksi' },
  oxo: { ru: 'оксо', en: 'oxo', uz: 'okso' },
}

// ───────────────────────── анализ молекулы ─────────────────────────

type Principal = 'acid' | 'ester' | 'aldehyde' | 'ketone' | 'alcohol' | 'amine' | null

interface Ctx {
  m: Mol
  isC: boolean[]
  ringId: number[] // -1 — не в кольце
  rings: number[][] // циклический порядок атомов простых колец
  benzene: boolean[] // кольцо — бензольное
  carbonyl: boolean[] // C=O
  oh: number[] // число OH у атома C
  principal: Principal
  pAtoms: Set<number> // атомы C со старшей группой
  /** атомы, которые нельзя использовать (другая часть сложного эфира) */
  blocked: Set<number>
}

function findRings(m: Mol): { ringId: number[]; rings: number[][] } {
  // мосты (Тарьян) → атомы на не-мостах; компоненты; простое кольцо: |E| = |V|
  const n = m.n
  const tin = new Array(n).fill(-1), low = new Array(n).fill(0)
  let t = 0
  const bridges = new Set<string>()
  const dfs = (v: number, p: number) => {
    tin[v] = low[v] = t++
    for (const e of m.adj[v]) {
      if (e.to === p) continue
      if (tin[e.to] >= 0) low[v] = Math.min(low[v], tin[e.to])
      else { dfs(e.to, v); low[v] = Math.min(low[v], low[e.to]); if (low[e.to] > tin[v]) bridges.add(bondKey(v, e.to)) }
    }
  }
  for (let i = 0; i < n; i++) if (tin[i] < 0) dfs(i, -1)
  const ringId = new Array(n).fill(-1)
  const rings: number[][] = []
  const comp = new Array(n).fill(-1)
  let c = 0
  for (let i = 0; i < n; i++) {
    if (comp[i] >= 0) continue
    if (!m.adj[i].some((e) => !bridges.has(bondKey(i, e.to)))) continue
    const st = [i]; comp[i] = c
    const atoms: number[] = []
    let edges = 0
    while (st.length) {
      const v = st.pop()!; atoms.push(v)
      for (const e of m.adj[v]) {
        if (bridges.has(bondKey(v, e.to))) continue
        edges++
        if (comp[e.to] < 0) { comp[e.to] = c; st.push(e.to) }
      }
    }
    edges /= 2
    if (edges === atoms.length) {
      // циклический порядок
      const order = [atoms[0]]
      let prev = -1, cur = atoms[0]
      for (;;) {
        const nx = m.adj[cur].find((e) => e.to !== prev && !bridges.has(bondKey(cur, e.to)))!.to
        if (nx === atoms[0]) break
        order.push(nx); prev = cur; cur = nx
      }
      for (const a of order) ringId[a] = rings.length
      rings.push(order)
    } else for (const a of atoms) ringId[a] = -2 // полициклическая система — не поддерживается
    c++
  }
  return { ringId, rings }
}

const isHal = (e: string) => e === 'F' || e === 'Cl' || e === 'Br' || e === 'I'

function isNitroN(m: Mol, n: number): boolean {
  if (m.el[n] !== 'N') return false
  const os = m.adj[n].filter((e) => m.el[e.to] === 'O' && m.adj[e.to].length === 1)
  return os.length === 2 && os.some((e) => e.o === 2)
}

function analyze(m: Mol): Ctx | null {
  const { ringId, rings } = findRings(m)
  if (ringId.some((r) => r === -2)) return null
  const isC = m.el.map((e) => e === 'C')
  const benzene = rings.map((r) => r.length === 6 && r.every((a) => isC[a]) && r.every((a) => m.adj[a].filter((e) => e.o === 2 && r.includes(e.to)).length === 1))
  const carbonyl = m.el.map((e, i) => e === 'C' && m.adj[i].some((x) => x.o === 2 && m.el[x.to] === 'O'))
  const oh = m.el.map((_, i) => (isC[i] ? m.adj[i].filter((x) => x.o === 1 && m.el[x.to] === 'O' && m.hc[x.to] === 1 && m.adj[x.to].length === 1).length : 0))
  const acid = new Set<number>(), ester = new Set<number>(), ald = new Set<number>(), ket = new Set<number>(), alc = new Set<number>(), amine = new Set<number>()
  for (let i = 0; i < m.n; i++) {
    if (!isC[i]) continue
    const cNb = m.adj[i].filter((x) => isC[x.to]).length
    if (carbonyl[i]) {
      const singleO = m.adj[i].filter((x) => x.o === 1 && m.el[x.to] === 'O')
      if (oh[i]) acid.add(i)
      else if (singleO.some((x) => m.adj[x.to].some((y) => y.to !== i && isC[y.to]))) ester.add(i)
      else if (singleO.length) return null
      else if (m.adj[i].some((x) => m.el[x.to] === 'N' || m.el[x.to] === 'S')) return null
      else if (m.hc[i] >= 1) ald.add(i)
      else if (cNb === 2) ket.add(i)
    } else if (oh[i]) alc.add(i)
    if (m.adj[i].some((x) => m.el[x.to] === 'N' && !isNitroN(m, x.to) && x.o === 1)) amine.add(i)
  }
  // неподдерживаемые элементы
  if (m.el.some((e, i) => !['C', 'O', 'N', 'F', 'Cl', 'Br', 'I'].includes(e) || (e === 'N' && !isNitroN(m, i) && m.adj[i].some((x) => !isC[x.to])))) return null
  let principal: Principal = null
  let pAtoms = new Set<number>()
  if (acid.size) { principal = 'acid'; pAtoms = acid } else if (ester.size) { principal = 'ester'; pAtoms = ester } else if (ald.size) { principal = 'aldehyde'; pAtoms = ald } else if (ket.size) { principal = 'ketone'; pAtoms = ket } else if (alc.size) { principal = 'alcohol'; pAtoms = alc } else if (amine.size) { principal = 'amine'; pAtoms = amine }
  return { m, isC, ringId, rings, benzene, carbonyl, oh, principal, pAtoms, blocked: new Set() }
}

// ───────────────────────── заместители и радикалы ─────────────────────────

/** Радикал (алкил и т. п.) — дерево для рендера на любом языке. */
interface Radical {
  kind: 'chain' | 'phenyl' | 'cyclo' | 'hetero' | 'alkoxy'
  /** chain: длина; cyclo: размер кольца */
  len: number
  /** hetero: ключ HETERO_PREFIX */
  key?: string
  /** кратные связи в цепи радикала (локанты, 1 — атом присоединения) */
  dbl: number[]
  tpl: number[]
  subs: Sub[]
  /** alkoxy: радикал по ту сторону O */
  inner?: Radical
}
interface Sub { loc: number; r: Radical }

function heteroSub(ctx: Ctx, from: number, x: number, principalSuffix: boolean): Radical | null | 'suffix' {
  const { m } = ctx
  const e = m.el[x]
  if (isHal(e)) return { kind: 'hetero', key: e, len: 0, dbl: [], tpl: [], subs: [] }
  if (e === 'N') {
    if (isNitroN(m, x)) return { kind: 'hetero', key: 'nitro', len: 0, dbl: [], tpl: [], subs: [] }
    if (ctx.principal === 'amine' && principalSuffix) return 'suffix'
    return { kind: 'hetero', key: 'amino', len: 0, dbl: [], tpl: [], subs: [] }
  }
  if (e === 'O') {
    const bo = m.adj[from].find((y) => y.to === x)!.o
    if (bo === 2) {
      if (principalSuffix && (ctx.principal === 'ketone' || ctx.principal === 'aldehyde' || ctx.principal === 'acid' || ctx.principal === 'ester')) return 'suffix'
      return { kind: 'hetero', key: 'oxo', len: 0, dbl: [], tpl: [], subs: [] }
    }
    const other = m.adj[x].find((y) => y.to !== from)
    if (!other) {
      if (principalSuffix && (ctx.principal === 'alcohol' || ctx.principal === 'acid')) return 'suffix'
      return { kind: 'hetero', key: 'hydroxy', len: 0, dbl: [], tpl: [], subs: [] }
    }
    if (principalSuffix && ctx.principal === 'ester' && ctx.carbonyl[from]) return 'suffix'
    if (ctx.blocked.has(other.to)) return 'suffix'
    const inner = radical(ctx, x, other.to)
    if (!inner) return null
    return { kind: 'alkoxy', len: 0, dbl: [], tpl: [], subs: [], inner }
  }
  return null
}

/** Радикал с корнем x, присоединённый к атому from. */
function radical(ctx: Ctx, from: number, x: number): Radical | null {
  const { m } = ctx
  if (!ctx.isC[x]) return heteroSub(ctx, from, x, false) as Radical | null
  if (ctx.ringId[x] >= 0) {
    const ring = ctx.rings[ctx.ringId[x]]
    const extra = ring.some((a) => m.adj[a].some((e) => !ring.includes(e.to) && !(a === x && e.to === from)))
    if (extra) return null // замещённое кольцо-радикал — вне школьной программы
    return ctx.benzene[ctx.ringId[x]] ? { kind: 'phenyl', len: 6, dbl: [], tpl: [], subs: [] } : { kind: 'cyclo', len: ring.length, dbl: [], tpl: [], subs: [] }
  }
  // цепи от x в поддереве (без from)
  const paths: number[][] = []
  const walk = (v: number, p: number, path: number[]) => {
    const next = m.adj[v].filter((e) => e.to !== p && ctx.isC[e.to] && ctx.ringId[e.to] < 0)
    if (!next.length) { paths.push(path); return }
    for (const e of next) walk(e.to, v, [...path, e.to])
  }
  walk(x, from, [x])
  let best: { key: number[]; r: Radical } | null = null
  for (const path of paths) {
    const r = describeChain(ctx, path, new Set([from]), false)
    if (!r) return null
    const key = [-(r.dbl.length + r.tpl.length), -path.length, -r.dbl.length, -r.subs.length, ...multiLoc(r)]
    if (!best || cmpNum(key, best.key) < 0) best = { key, r }
  }
  return best ? best.r : null
}

function multiLoc(r: Radical): number[] {
  return [...[...r.dbl, ...r.tpl].sort((a, b) => a - b), 99, ...r.subs.map((s) => s.loc).sort((a, b) => a - b)]
}

function cmpNum(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return a[i] - b[i]
  return a.length - b.length
}

/** Цепь path (по порядку нумерации) → кратные связи и заместители. */
function describeChain(ctx: Ctx, path: number[], exclude: Set<number>, isParent: boolean): (Radical & { suffix: number[] }) | null {
  const { m } = ctx
  const inPath = new Set(path)
  const dbl: number[] = [], tpl: number[] = []
  for (let i = 0; i + 1 < path.length; i++) {
    const o = m.adj[path[i]].find((e) => e.to === path[i + 1])!.o
    if (o === 2) dbl.push(i + 1)
    if (o === 3) tpl.push(i + 1)
  }
  const subs: Sub[] = []
  const suffix: number[] = []
  for (let i = 0; i < path.length; i++) {
    const a = path[i]
    for (const e of m.adj[a]) {
      if (inPath.has(e.to) || exclude.has(e.to)) continue
      if (ctx.blocked.has(e.to)) continue
      if (ctx.isC[e.to] && e.o !== 1) return null // экзоциклическая C=C к заместителю — школьный намер не строит
      if (!ctx.isC[e.to]) {
        const h = heteroSub(ctx, a, e.to, isParent && ctx.pAtoms.has(a))
        if (h === 'suffix') { if (!(m.el[e.to] === 'O' && e.o === 1 && ctx.principal === 'acid')) suffix.push(i + 1); continue }
        if (!h) return null
        subs.push({ loc: i + 1, r: h })
        continue
      }
      const r = radical(ctx, a, e.to)
      if (!r) return null
      subs.push({ loc: i + 1, r })
    }
  }
  return { kind: 'chain', len: path.length, dbl, tpl, subs, suffix }
}

// ───────────────────────── рендер ─────────────────────────

interface Opt { L: Lang; style: 'old' | 'new'; alpha: Lang; trivialRadicals: boolean }

function radicalName(r: Radical, o: Opt): string {
  const L = o.L
  if (r.kind === 'hetero') return HETERO_PREFIX[r.key!][L]
  if (r.kind === 'phenyl') return { ru: 'фенил', en: 'phenyl', uz: 'fenil' }[L]
  if (r.kind === 'cyclo') return { ru: 'цикло', en: 'cyclo', uz: 'siklo' }[L] + stem(r.len, L) + { ru: 'ил', en: 'yl', uz: 'il' }[L]
  if (r.kind === 'alkoxy') {
    const inner = r.inner!
    if (inner.kind === 'chain' && !inner.subs.length && !inner.dbl.length && !inner.tpl.length) return stem(inner.len, L) + { ru: 'окси', en: 'oxy', uz: 'oksi' }[L]
    if (inner.kind === 'phenyl') return { ru: 'фенокси', en: 'phenoxy', uz: 'fenoksi' }[L]
    const t = radicalName(inner, o)
    return (needsParens(inner) ? `(${t})` : t) + { ru: 'окси', en: 'oxy', uz: 'oksi' }[L]
  }
  if (o.trivialRadicals) {
    const t = trivialRadical(r, L)
    if (t) return t
  }
  const pre = prefixString(r.subs, o, r.len === 1)
  const un = unsatString(r, o, true)
  return pre + un + { ru: 'ил', en: 'yl', uz: 'il' }[L]
}

function needsParens(r: Radical): boolean {
  return r.kind === 'chain' && r.subs.length > 0
}

function trivialRadical(r: Radical, L: Lang): string | null {
  const sig = `${r.len}|${r.dbl.join(',')}|${r.tpl.join(',')}|${r.subs.map((s) => `${s.loc}${s.r.kind === 'chain' && s.r.len === 1 && !s.r.subs.length ? 'Me' : 'X'}`).sort().join(',')}`
  const T: Record<string, Record<Lang, string>> = {
    '2|||1Me': { ru: 'изопропил', en: 'isopropyl', uz: 'izopropil' },
    '3|||2Me': { ru: 'изобутил', en: 'isobutyl', uz: 'izobutil' },
    '3|||1Me': { ru: 'втор-бутил', en: 'sec-butyl', uz: 'ikkilamchi-butil' },
    '2|||1Me,1Me': { ru: 'трет-бутил', en: 'tert-butyl', uz: 'uchlamchi-butil' },
    '2|1||': { ru: 'винил', en: 'vinyl', uz: 'vinil' },
    '4|||3Me': { ru: 'изоамил', en: 'isopentyl', uz: 'izoamil' },
  }
  return T[sig]?.[L] ?? null
}

function collate(L: Lang) {
  const loc = L === 'ru' ? 'ru' : L === 'uz' ? 'uz' : 'en'
  return (a: string, b: string) => a.replace(/[()\d,-]/g, '').localeCompare(b.replace(/[()\d,-]/g, ''), loc)
}

/** Приставки: «2,3-диметил-4-этил». */
function prefixString(subs: Sub[], o: Opt, omitLoc: boolean): string {
  if (!subs.length) return ''
  const groups = new Map<string, { locs: number[]; complex: boolean; alphaKey: string }>()
  for (const s of subs) {
    const name = radicalName(s.r, o)
    const alphaName = o.alpha === o.L ? name : radicalName(s.r, { ...o, L: o.alpha })
    const complex = needsParens(s.r) || (s.r.kind === 'alkoxy' && needsParens(s.r.inner!))
    const g = groups.get(name)
    if (g) g.locs.push(s.loc); else groups.set(name, { locs: [s.loc], complex, alphaKey: alphaName })
  }
  const items = [...groups.entries()].sort((a, b) => collate(o.alpha)(a[1].alphaKey, b[1].alphaKey))
  return items.map(([name, g], k) => {
    const locs = g.locs.sort((a, b) => a - b)
    const mult = locs.length > 1 ? MULT[o.L][locs.length] : ''
    const body = g.complex || (locs.length > 1 && /^\d/.test(name)) ? `${mult}(${name})` : mult + name
    const lp = omitLoc ? '' : `${locs.join(',')}-`
    const sep = k > 0 && !omitLoc ? '-' : ''
    return sep + lp + (g.complex && locs.length === 1 ? `(${name})` : body)
  }).join('')
}

/** Часть «ен/ин/ан» (для радикала — без конечного -ан). */
function unsatString(r: Radical, o: Opt, isRadical: boolean): string {
  const L = o.L
  const s = stem(r.len, L)
  const nd = r.dbl.length, nt = r.tpl.length
  if (!nd && !nt) return s + (isRadical ? '' : { ru: 'ан', en: 'ane', uz: 'an' }[L])
  const en = { ru: 'ен', en: 'en', uz: 'en' }[L], yn = { ru: 'ин', en: 'yn', uz: 'in' }[L]
  const part = (locs: number[], base: string) => (locs.length > 1 ? MULT[L][locs.length].replace(/^/, '') : '') + base
  const showLoc = !(isRadical && r.len <= 2)
  const lstr = (locs: number[]) => (showLoc ? locs.join(',') : '')
  if (isRadical || o.style === 'new' || L === 'en') {
    const pieces: string[] = []
    if (nd) pieces.push((showLoc ? `-${lstr(r.dbl)}-` : '') + part(r.dbl, en))
    if (nt) pieces.push((showLoc ? `-${lstr(r.tpl)}-` : '') + part(r.tpl, yn))
    const multi = nd > 1 || nt > 1
    const st = s + (multi ? { ru: 'а', en: 'a', uz: 'a' }[L] : '')
    let out = st + pieces.join('')
    if (!isRadical) out += L === 'en' ? 'e' : ''
    return out
  }
  // старый стиль: «бутен-1», «пентадиен-1,3», «бутен-1-ин-3»
  let out = s + (nd > 1 || nt > 1 ? { ru: 'а', en: 'a', uz: 'a' }[L] : '')
  if (nd) out += part(r.dbl, en) + `-${r.dbl.join(',')}`
  if (nt) out += (nd ? '-' : '') + part(r.tpl, yn) + `-${r.tpl.join(',')}`
  return out
}

// ───────────────────────── главная цепь ─────────────────────────

interface Parent {
  ring: boolean
  benzene: boolean
  atoms: number[] // в порядке нумерации
  d: Radical & { suffix: number[] }
}

function numberingKey(p: Parent, o: Opt): (number | string)[] {
  const d = p.d
  const mult = [...d.dbl, ...d.tpl].sort((a, b) => a - b)
  const subsLoc = d.subs.map((s) => s.loc).sort((a, b) => a - b)
  // первый по алфавиту — наименьший локант
  const alpha = [...d.subs].map((s) => ({ s, n: radicalName(s.r, { ...o, L: o.alpha }) })).sort((a, b) => collate(o.alpha)(a.n, b.n) || a.s.loc - b.s.loc).map((x) => x.s.loc)
  return [...d.suffix.sort((a, b) => a - b), 99, ...(p.benzene ? [] : mult), 99, ...(p.benzene ? [] : [...d.dbl]), 99, ...subsLoc, 99, ...alpha]
}

function cmpMixed(a: (number | string)[], b: (number | string)[]): number {
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return (a[i] as number) - (b[i] as number)
  return a.length - b.length
}

function chooseParent(ctx: Ctx, o: Opt, restrict?: Set<number>): Parent | null {
  const { m } = ctx
  const allowed = (i: number) => ctx.isC[i] && !ctx.blocked.has(i) && (!restrict || restrict.has(i))
  const cands: { atoms: number[]; ring: boolean; benzene: boolean }[] = []
  ctx.rings.forEach((r, k) => {
    if (!r.every((a) => allowed(a))) return
    const n = r.length
    for (let s = 0; s < n; s++) for (const dir of [1, -1]) {
      const atoms = Array.from({ length: n }, (_, i) => r[(s + dir * i + n * 2) % n])
      cands.push({ atoms, ring: true, benzene: ctx.benzene[k] })
    }
  })
  // ациклические цепи: от листа до листа леса ациклических C
  const acyc = (i: number) => allowed(i) && ctx.ringId[i] < 0
  const nbA = (i: number) => m.adj[i].filter((e) => acyc(e.to)).map((e) => e.to)
  const leaves = m.el.map((_, i) => i).filter((i) => acyc(i) && nbA(i).length <= 1)
  for (const s of leaves) {
    // все пути из s (лес — путь единственен)
    const walk = (v: number, p: number, path: number[]) => {
      const next = nbA(v).filter((x) => x !== p)
      if (!next.length || (path.length > 1 && nbA(v).length <= 1)) cands.push({ atoms: path, ring: false, benzene: false })
      for (const x of next) walk(x, v, [...path, x])
    }
    walk(s, -1, [s])
  }
  let best: { key: (number | string)[]; p: Parent } | null = null
  for (const c of cands) {
    const d = describeChain(ctx, c.atoms, new Set(), true)
    if (!d) continue
    // кольцо: связь последнего с первым
    if (c.ring) {
      const o2 = m.adj[c.atoms[c.atoms.length - 1]].find((e) => e.to === c.atoms[0])!.o
      if (o2 === 2) d.dbl.push(c.atoms.length)
      if (o2 === 3) d.tpl.push(c.atoms.length)
    }
    const pCount = c.atoms.filter((a) => ctx.pAtoms.has(a)).length
    const p: Parent = { ring: c.ring, benzene: c.benzene, atoms: c.atoms, d }
    const multi = c.benzene ? 0 : d.dbl.length + d.tpl.length
    const key = [-pCount, c.ring ? 0 : 1, -multi, -c.atoms.length, -(c.benzene ? 0 : d.dbl.length), -d.subs.length, ...numberingKey(p, o)]
    if (!best || cmpMixed(key, best.key) < 0) best = { key, p }
  }
  return best?.p ?? null
}

const SUFFIX: Record<string, Record<Lang, string>> = {
  alcohol: { ru: 'ол', en: 'ol', uz: 'ol' },
  ketone: { ru: 'он', en: 'one', uz: 'on' },
  aldehyde: { ru: 'аль', en: 'al', uz: 'al' },
  amine: { ru: 'амин', en: 'amine', uz: 'amin' },
}

/** Название родоначальной структуры с приставками и суффиксом. */
function renderParent(ctx: Ctx, p: Parent, o: Opt, asEsterAcid = false): string | null {
  const L = o.L
  const d = p.d
  const suf = [...d.suffix].sort((a, b) => a - b)
  const nSuf = suf.length
  const nSubsTotal = d.subs.length
  // нужно ли писать локанты
  let omitPrefixLoc = false
  if (p.ring) omitPrefixLoc = nSubsTotal + nSuf <= 1 && (p.benzene || !d.dbl.length)
  else omitPrefixLoc = p.atoms.length === 1 || (p.atoms.length === 2 && nSubsTotal + (nSuf && ctx.principal !== 'acid' && ctx.principal !== 'aldehyde' && ctx.principal !== 'ester' ? nSuf : 0) <= 1)
  const pre = prefixString(d.subs, o, omitPrefixLoc)
  if (p.benzene) {
    if (ctx.principal === 'alcohol' && nSuf === 1) {
      // фенол: C1 — атом с OH (нумерация уже выбрана так, что суффикс = 1)
      return pre + { ru: 'фенол', en: 'phenol', uz: 'fenol' }[L]
    }
    if (nSuf) return null
    return pre + { ru: 'бензол', en: 'benzene', uz: 'benzol' }[L]
  }
  const ringPre = p.ring ? { ru: 'цикло', en: 'cyclo', uz: 'siklo' }[L] : ''
  const omitUnsatLoc = p.ring ? d.dbl.length + d.tpl.length <= 1 : p.atoms.length <= 3 && !nSuf && !d.subs.length && d.dbl.length + d.tpl.length <= 1
  const r: Radical = { kind: 'chain', len: p.atoms.length, dbl: p.ring ? d.dbl.map(() => 1).slice(0, 1).concat(d.dbl.slice(1)) : d.dbl, tpl: d.tpl, subs: [] }
  let core: string
  const unsat = (style: 'old' | 'new') => {
    const rr = { ...r }
    if (omitUnsatLoc) {
      // «пропен», «циклогексен», «пропадиен»: без локантов
      const s = stem(rr.len, L)
      const nd = rr.dbl.length, nt = rr.tpl.length
      if (!nd && !nt) return s + { ru: 'ан', en: 'ane', uz: 'an' }[L]
      const pieces = (nd ? (nd > 1 ? MULT[L][nd] : '') + { ru: 'ен', en: 'en', uz: 'en' }[L] : '') + (nt ? (nt > 1 ? MULT[L][nt] : '') + { ru: 'ин', en: 'yn', uz: 'in' }[L] : '')
      return s + (nd > 1 || nt > 1 ? 'a'.replace('a', { ru: 'а', en: 'a', uz: 'a' }[L]) : '') + pieces + (L === 'en' ? 'e' : '')
    }
    return unsatString(rr, { ...o, style }, false)
  }
  const pr = ctx.principal
  const sufLoc = (locs: number[]) => locs.join(',')
  const omitSufLoc = pr === 'acid' || pr === 'aldehyde' || asEsterAcid || p.ring && nSuf === 1 || (!p.ring && p.atoms.length <= 2) || (pr === 'ketone' && !p.ring && p.atoms.length === 3 && !d.subs.length)
  if (asEsterAcid || pr === 'acid') {
    const base = unsat(o.style === 'old' && L !== 'en' ? 'old' : 'new')
    const stemPart = L === 'en' ? base.replace(/e$/, '') : base
    if (asEsterAcid) core = stemPart + { ru: 'оат', en: 'oate', uz: 'oat' }[L]
    else core = nSuf > 1
      ? stemPart + MULT[L][nSuf] + { ru: 'овая кислота', en: 'oic acid', uz: ' kislota' }[L]
      : L === 'uz' ? stemPart + ' kislota' : stemPart + { ru: 'овая кислота', en: 'oic acid', uz: '' }[L]
    if (L === 'ru' && o.style === 'old' && /-\d/.test(base)) core = base + (asEsterAcid ? 'оат' : 'овая кислота') // «пентен-2-овая» — редкость
    return ringPre + pre + core
  }
  if (!pr || nSuf === 0) return ringPre === '' ? pre + unsat(o.style) : pre + ringPre + unsat(o.style)
  const sfx = SUFFIX[pr][L]
  const multS = nSuf > 1 ? MULT[L][nSuf] : ''
  const consonant = /^[дтdt]/.test(multS)
  if (o.style === 'old' && L !== 'en') {
    // «пропанол-2», «бутандиол-1,4», «пропен-2-ол-1»
    const base = unsat('old')
    core = base + multS + sfx + (omitSufLoc ? '' : `-${sufLoc(suf)}`)
  } else {
    let base = unsat('new')
    if (L === 'en') base = base.replace(/e$/, '')
    if (consonant && L === 'en' && !/[aey]$/.test(base)) base += 'e'
    if (consonant && L === 'en' && /an$/.test(base)) base += 'e'
    core = base + (omitSufLoc ? '' : `-${sufLoc(suf)}-`) + multS + sfx
  }
  return pre + ringPre + core
}

// ───────────────────────── сложные и простые эфиры ─────────────────────────

const ACID_TRIVIAL: Record<number, { ru: string; ruGen: string; ate: string; enAte: string; uz: string }> = {
  1: { ru: 'муравьиная', ruGen: 'муравьиной', ate: 'формиат', enAte: 'formate', uz: 'formiat' },
  2: { ru: 'уксусная', ruGen: 'уксусной', ate: 'ацетат', enAte: 'acetate', uz: 'atsetat' },
  3: { ru: 'пропионовая', ruGen: 'пропионовой', ate: 'пропионат', enAte: 'propionate', uz: 'propionat' },
  4: { ru: 'масляная', ruGen: 'масляной', ate: 'бутират', enAte: 'butyrate', uz: 'butirat' },
  5: { ru: 'валериановая', ruGen: 'валериановой', ate: 'валерат', enAte: 'valerate', uz: 'valerat' },
}
const ALKYL_ADJ: Record<string, string> = { метил: 'метиловый', этил: 'этиловый', пропил: 'пропиловый', бутил: 'бутиловый', пентил: 'пентиловый', изопропил: 'изопропиловый', изоамил: 'изоамиловый', изобутил: 'изобутиловый', винил: 'виниловый', фенил: 'фениловый', гексил: 'гексиловый' }

function componentFrom(m: Mol, start: number, cut: Set<string>): Set<number> {
  const s = new Set([start]); const st = [start]
  while (st.length) { const v = st.pop()!; for (const e of m.adj[v]) if (!cut.has(bondKey(v, e.to)) && !s.has(e.to)) { s.add(e.to); st.push(e.to) } }
  return s
}

function esterNames(ctx: Ctx, o: Opt): string[] {
  const { m } = ctx
  if (ctx.pAtoms.size !== 1) return []
  const c = [...ctx.pAtoms][0]
  const oe = m.adj[c].find((e) => e.o === 1 && m.el[e.to] === 'O')!.to
  const r0 = m.adj[oe].find((e) => e.to !== c)!.to
  const acidSide = componentFrom(m, c, new Set([bondKey(oe, r0)]))
  const alkSide = componentFrom(m, r0, new Set([bondKey(oe, r0)]))
  // кислотная часть: цепь, начинающаяся с C=O
  const ctxA: Ctx = { ...ctx, blocked: new Set([...alkSide]) }
  const pA = chooseParent(ctxA, o, new Set([...acidSide].filter((i) => ctx.isC[i])))
  if (!pA) return []
  const acidName = renderParent(ctxA, pA, o, true)
  const ctxR: Ctx = { ...ctx, blocked: new Set([...acidSide]) }
  const rad = radical(ctxR, oe, r0)
  if (!acidName || !rad) return []
  const L = o.L
  const rName = radicalName(rad, o)
  const rPart = needsParens(rad) && !o.trivialRadicals ? rName : rName
  const out: string[] = []
  const sep = L === 'en' ? ' ' : ''
  const benzoate = pA.atoms.length === 1 && pA.d.subs.length === 1 && pA.d.subs[0].r.kind === 'phenyl'
  if (benzoate) {
    out.push(rPart + sep + { ru: 'бензоат', en: 'benzoate', uz: 'benzoat' }[L])
    if (L === 'ru' && ALKYL_ADJ[rName]) out.push(`${ALKYL_ADJ[rName]} эфир бензойной кислоты`)
    return out
  }
  const plainAcid = pA.d.subs.length === 0 && !pA.d.dbl.length && !pA.d.tpl.length && !pA.ring
  const triv = plainAcid ? ACID_TRIVIAL[pA.atoms.length] : pA.atoms.length === 3 && pA.d.subs.length === 1 && pA.d.subs[0].loc === 2 && pA.d.subs[0].r.kind === 'chain' && pA.d.subs[0].r.len === 1 ? { ru: 'изомасляная', ruGen: 'изомасляной', ate: 'изобутират', enAte: 'isobutyrate', uz: 'izobutirat' } : null
  if (triv) {
    if (L === 'ru') {
      out.push(rPart + triv.ate)
      const adj = ALKYL_ADJ[rName]
      if (adj) out.push(`${adj} эфир ${triv.ruGen} кислоты`)
    } else if (L === 'en') out.push(`${rPart} ${triv.enAte}`)
    else out.push(rPart + triv.uz)
  }
  out.push(rPart + sep + acidName)
  return out
}

function etherNames(ctx: Ctx, o: Opt): string[] {
  const { m } = ctx
  const ethers = m.el.map((_, i) => i).filter((i) => m.el[i] === 'O' && m.adj[i].length === 2 && m.adj[i].every((e) => ctx.isC[e.to] && !ctx.carbonyl[e.to]))
  if (ethers.length !== 1 || ctx.principal) return []
  const oe = ethers[0]
  if (ctx.ringId[oe] >= 0) return []
  const [a, b] = m.adj[oe].map((e) => e.to)
  const L = o.L
  const ra = radical(ctx, oe, a), rb = radical(ctx, oe, b)
  if (!ra || !rb) return []
  const size = (s: Set<number>) => [...s].filter((i) => ctx.isC[i]).length
  const sa = size(componentFrom(m, a, new Set([bondKey(oe, a)]))), sb = size(componentFrom(m, b, new Set([bondKey(oe, b)])))
  const na = radicalName(ra, o), nb = radicalName(rb, o)
  const out: string[] = []
  const [first, second] = sa < sb || (sa === sb && collate(L)(na, nb) <= 0) ? [na, nb] : [nb, na]
  if (L === 'ru') {
    const adj = (s: string) => (s.endsWith('ил') ? s + 'овый' : s + 'овый')
    out.push(first === second ? `ди${adj(first)} эфир` : `${first}${adj(second)} эфир`)
  } else if (L === 'en') out.push(first === second ? `di${first} ether` : `${first} ${second} ether`)
  else out.push(first === second ? `di${first} efir` : `${first}${second} efir`)
  // замещающие: алкоксиалкан (обе стороны как родоначальная)
  for (const [side, other] of [[a, b], [b, a]] as const) {
    const blockedSide = componentFrom(m, other, new Set([bondKey(oe, other)]))
    void blockedSide
    const ctx2: Ctx = { ...ctx, blocked: new Set() }
    const restrict = componentFrom(m, side, new Set([bondKey(oe, side)]))
    const p = chooseParent(ctx2, o, new Set([...restrict].filter((i) => ctx.isC[i])))
    if (p) { const s = renderParent(ctx2, p, o); if (s) out.push(s) }
  }
  return out
}

/** «2,4,6-трибромтолуол»: производные толуола (CH₃ при C1, остальные — приставки). */
function tolueneName(ctx: Ctx, o: Opt): string | null {
  const { m } = ctx
  if (ctx.principal) return null
  let best: { key: number[]; subs: Sub[] } | null = null
  ctx.rings.forEach((r, k) => {
    if (!ctx.benzene[k]) return
    const n = r.length
    for (let s0 = 0; s0 < n; s0++) for (const dir of [1, -1]) {
      const atoms = Array.from({ length: n }, (_, i) => r[(s0 + dir * i + n * 2) % n])
      const me = m.adj[atoms[0]].find((e) => !r.includes(e.to) && ctx.isC[e.to] && m.adj[e.to].length === 1)
      if (!me) continue
      const d = describeChain(ctx, atoms, new Set([me.to]), true)
      if (!d || !d.subs.length) continue
      const alpha = [...d.subs].map((x) => ({ x, n: radicalName(x.r, { ...o, L: o.alpha }) })).sort((p, q) => collate(o.alpha)(p.n, q.n) || p.x.loc - q.x.loc).map((y) => y.x.loc)
      const key = [...d.subs.map((x) => x.loc).sort((p, q) => p - q), 99, ...alpha]
      if (!best || cmpNum(key, best.key) < 0) best = { key, subs: d.subs }
    }
  })
  if (!best) return null
  const b2 = best as { key: number[]; subs: Sub[] }
  if (b2.subs.some((x) => x.r.kind === 'chain' && x.r.len === 1 && !x.r.subs.length)) return null // ксилолы и т. п.
  return prefixString(b2.subs, o, false) + { ru: 'толуол', en: 'toluene', uz: 'toluol' }[o.L]
}

// ───────────────────────── цис/транс ─────────────────────────

function cisTransPrefix(m: Mol, p: Parent | null, L: Lang): string {
  if (!p || !m.stereo.size) return ''
  const can = canonicalizeMol(m)
  const parts: string[] = []
  for (const [key, st] of can.mol.stereo) {
    const [a, b] = key.split('-').map(Number)
    const ia = p.atoms.indexOf(a), ib = p.atoms.indexOf(b)
    if (ia < 0 || ib < 0) continue
    // опора — соседи по главной цепи
    const chainNb = (end: number, other: number) => p.atoms.find((x) => x !== other && m.adj[end].some((e) => e.to === x))
    const xa = chainNb(a, b), xb = chainNb(b, a)
    if (xa === undefined || xb === undefined) continue
    let v = st.v
    if (xa !== st.ref[0]) v = v === 'cis' ? 'trans' : 'cis'
    if (xb !== st.ref[1]) v = v === 'cis' ? 'trans' : 'cis'
    parts.push(v === 'cis' ? { ru: 'цис', en: 'cis', uz: 'sis' }[L] : { ru: 'транс', en: 'trans', uz: 'trans' }[L])
  }
  return parts.length === 1 ? `${parts[0]}-` : parts.length ? `${parts.join(',')}-` : ''
}

// ───────────────────────── публичный API ─────────────────────────

function cap(s: string): string {
  const i = s.search(/[A-Za-zА-Яа-яЁё]/)
  return i < 0 ? s : s.slice(0, i) + s[i].toUpperCase() + s.slice(i + 1)
}

function variants(m: Mol, L: Lang): { names: string[]; systematic: boolean } {
  const ctx = analyze(m)
  const out: string[] = []
  if (ctx) {
    const opts: Opt[] = []
    for (const style of ['old', 'new'] as const) for (const tr of [true, false]) for (const alpha of (L === 'ru' ? (['ru', 'en'] as Lang[]) : [L])) opts.push({ L, style, alpha, trivialRadicals: tr })
    const ordered = L === 'en' ? opts.filter((o) => o.style === 'new') : opts
    for (const o of ordered) {
      let names: string[] = []
      let parent: Parent | null = null
      if (ctx.principal === 'ester') names = esterNames(ctx, o)
      else {
        const eth = etherNames(ctx, o)
        parent = chooseParent(ctx, o)
        const main = parent ? renderParent(ctx, parent, o) : null
        if (eth.length) names = [eth[0], ...(main ? [main] : []), ...eth.slice(1)]
        else if (main) names = [main]
        const tol = parent?.benzene ? tolueneName(ctx, o) : null
        if (tol) names.push(tol)
      }
      const ct = cisTransPrefix(m, parent, L)
      for (const n of names) out.push(ct + n)
    }
  }
  const uniq = [...new Set(out.map((s) => s.replace(/^-/, '')))]
  return { names: uniq, systematic: uniq.length > 0 }
}

/** Название по ИЮПАК (школьное) для Mol. */
export function nameMol(m: Mol): MoleculeName {
  const triv = trivialNamesFor(m)
  const res = (['ru', 'en', 'uz'] as Lang[]).map((L) => {
    const v = variants(m, L)
    const t = triv ? triv[L] : []
    // главное название: тривиальное учебника (если есть), иначе систематическое; «~» — тривиальное после систематического
    const first = t.filter((x) => !x.startsWith('~')), later = t.filter((x) => x.startsWith('~')).map((x) => x.slice(1))
    const all = [...new Set([...first, ...v.names, ...later].map(cap))]
    return { all, systematic: v.systematic }
  })
  const [ru, en, uz] = res
  return {
    ru: ru.all[0] ?? '', en: en.all[0] ?? '', uz: uz.all[0] ?? '',
    synonymsRu: ru.all, synonymsEn: en.all, synonymsUz: uz.all,
    systematic: ru.systematic,
  }
}

/** Название по ИЮПАК для нарисованного скелета (RU по Kimyo 10, EN, UZ) + синонимы. */
export function nameSkeleton(g: SkeletonGraph): MoleculeName {
  return nameMol(toMol(g))
}

/** Систематическое RU-название без словаря тривиальных (для проверки намера). */
export function systematicNamesRu(g: SkeletonGraph): string[] {
  return variants(toMol(g), 'ru').names.map(cap)
}
