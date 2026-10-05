/**
 * Класс вещества по функциональным группам, функциональные группы (ключи контракта OV2GroupKey),
 * степень атомов углерода (первичный … четвертичный) и полуструктурная формула «CH₃–CH(CH₃)–CH₃».
 */
import type { OV2GroupKey } from '../../data/organicV2/types'
import { bondKey, subscriptDigits, toMol, type Mol, type SkeletonGraph } from './graph'
import { aromaticBonds } from './canonical'

/** Школьный класс вещества (совпадает с classId реестра, где он есть). */
export type OrganicClassKey =
  | 'alkane' | 'cycloalkane' | 'alkene' | 'cycloalkene' | 'alkyne' | 'alkadiene' | 'arene'
  | 'halo' | 'alcohol' | 'polyol' | 'phenol' | 'aldehyde' | 'ketone' | 'acid' | 'ester' | 'ether'
  | 'amine' | 'nitro' | 'aminoAcid' | 'other'

export const CLASS_LABELS: Record<OrganicClassKey, { ru: string; en: string; uz: string }> = {
  alkane: { ru: 'Алкан', en: 'Alkane', uz: 'Alkan' },
  cycloalkane: { ru: 'Циклоалкан', en: 'Cycloalkane', uz: 'Sikloalkan' },
  alkene: { ru: 'Алкен', en: 'Alkene', uz: 'Alken' },
  cycloalkene: { ru: 'Циклоалкен', en: 'Cycloalkene', uz: 'Sikloalken' },
  alkyne: { ru: 'Алкин', en: 'Alkyne', uz: 'Alkin' },
  alkadiene: { ru: 'Алкадиен', en: 'Alkadiene', uz: 'Alkadiyen' },
  arene: { ru: 'Арен (ароматический углеводород)', en: 'Arene', uz: 'Aren' },
  halo: { ru: 'Галогенопроизводное', en: 'Haloalkane', uz: 'Galogenli hosila' },
  alcohol: { ru: 'Спирт', en: 'Alcohol', uz: 'Spirt' },
  polyol: { ru: 'Многоатомный спирт', en: 'Polyol', uz: 'Ko‘p atomli spirt' },
  phenol: { ru: 'Фенол', en: 'Phenol', uz: 'Fenol' },
  aldehyde: { ru: 'Альдегид', en: 'Aldehyde', uz: 'Aldegid' },
  ketone: { ru: 'Кетон', en: 'Ketone', uz: 'Keton' },
  acid: { ru: 'Карбоновая кислота', en: 'Carboxylic acid', uz: 'Karbon kislota' },
  ester: { ru: 'Сложный эфир', en: 'Ester', uz: 'Murakkab efir' },
  ether: { ru: 'Простой эфир', en: 'Ether', uz: 'Oddiy efir' },
  amine: { ru: 'Амин', en: 'Amine', uz: 'Amin' },
  nitro: { ru: 'Нитросоединение', en: 'Nitro compound', uz: 'Nitrobirikma' },
  aminoAcid: { ru: 'Аминокислота', en: 'Amino acid', uz: 'Aminokislota' },
  other: { ru: 'Органическое вещество', en: 'Organic compound', uz: 'Organik modda' },
}

export interface FoundGroup {
  readonly key: OV2GroupKey
  /** индексы атомов Mol (тяжёлые атомы в порядке toMol) */
  readonly atoms: readonly number[]
}

const isHal = (e: string) => e === 'F' || e === 'Cl' || e === 'Br' || e === 'I'
const termO = (m: Mol, o: number) => m.el[o] === 'O' && m.adj[o].length === 1

/** Функциональные группы (ключи контракта: hydroxyl, carboxyl, ester, …). */
export function findGroups(g: SkeletonGraph | Mol): FoundGroup[] {
  const m = 'adj' in g ? g : toMol(g)
  const aro = aromaticBonds(m)
  const arAtom = new Set([...aro].flatMap((k) => k.split('-').map(Number)))
  const out: FoundGroup[] = []
  const usedO = new Set<number>()
  for (let i = 0; i < m.n; i++) {
    if (m.el[i] !== 'C') continue
    const dO = m.adj[i].find((e) => e.o === 2 && termO(m, e.to))
    const sO = m.adj[i].filter((e) => e.o === 1 && m.el[e.to] === 'O')
    if (dO) {
      const oh = sO.find((e) => m.adj[e.to].length === 1 && m.hc[e.to] >= 1)
      const or = sO.find((e) => m.adj[e.to].length === 2)
      const nN = m.adj[i].find((e) => e.o === 1 && m.el[e.to] === 'N')
      if (oh) { out.push({ key: 'carboxyl', atoms: [i, dO.to, oh.to] }); usedO.add(dO.to).add(oh.to) }
      else if (or) { out.push({ key: 'ester', atoms: [i, dO.to, or.to] }); usedO.add(dO.to).add(or.to) }
      else if (nN) { out.push({ key: 'amide', atoms: [i, dO.to, nN.to] }); usedO.add(dO.to) }
      else if (m.hc[i] >= 1) { out.push({ key: 'carbonylAldehyde', atoms: [i, dO.to] }); usedO.add(dO.to) }
      else { out.push({ key: 'carbonylKetone', atoms: [i, dO.to] }); usedO.add(dO.to) }
    }
  }
  for (let o = 0; o < m.n; o++) {
    if (m.el[o] !== 'O' || usedO.has(o)) continue
    const nb = m.adj[o]
    if (nb.length === 1 && nb[0].o === 1 && m.hc[o] >= 1 && m.el[nb[0].to] === 'C') out.push({ key: arAtom.has(nb[0].to) ? 'phenolOH' : 'hydroxyl', atoms: [o, nb[0].to] })
    else if (nb.length === 2 && nb.every((e) => m.el[e.to] === 'C' && e.o === 1)) out.push({ key: 'ether', atoms: [o] })
  }
  for (let n = 0; n < m.n; n++) {
    if (m.el[n] !== 'N') continue
    const os = m.adj[n].filter((e) => termO(m, e.to))
    if (os.length >= 2) {
      const viaO = m.adj[n].find((e) => m.el[e.to] === 'O' && m.adj[e.to].length === 2)
      out.push({ key: viaO ? 'nitrate' : 'nitro', atoms: [n, ...os.map((e) => e.to)] })
    } else if (m.adj[n].some((e) => e.o === 3)) out.push({ key: 'nitrile', atoms: [n] })
    else if (!out.some((x) => x.key === 'amide' && x.atoms.includes(n)) && m.adj[n].every((e) => e.o === 1 && m.el[e.to] === 'C')) out.push({ key: 'amino', atoms: [n] })
  }
  for (let s = 0; s < m.n; s++) if (m.el[s] === 'S' && m.adj[s].filter((e) => termO(m, e.to)).length >= 2) out.push({ key: 'sulfo', atoms: [s] })
  for (let x = 0; x < m.n; x++) if (isHal(m.el[x])) out.push({ key: 'halogen', atoms: [x] })
  // кратные связи (вне ароматических колец и не C=O)
  for (let i = 0; i < m.n; i++) for (const e of m.adj[i]) {
    if (e.to < i || m.el[i] !== 'C' || m.el[e.to] !== 'C' || aro.has(bondKey(i, e.to))) continue
    if (e.o === 2) out.push({ key: 'alkene', atoms: [i, e.to] })
    if (e.o === 3) out.push({ key: 'alkyne', atoms: [i, e.to] })
  }
  // бензольные кольца
  const ringAtoms = [...arAtom]
  if (ringAtoms.length) out.push({ key: 'arene', atoms: ringAtoms.sort((a, b) => a - b) })
  return out
}

function inRing(m: Mol): boolean {
  // число связей ≥ числа атомов в связной компоненте → есть цикл
  let edges = 0
  for (const l of m.adj) edges += l.length
  return edges / 2 >= m.n
}

/** Класс вещества по старшей группе (школьная иерархия). */
export function classifyMolecule(g: SkeletonGraph | Mol): OrganicClassKey {
  const m = 'adj' in g ? g : toMol(g)
  if (!m.el.includes('C')) return 'other'
  const gr = findGroups(m)
  const has = (k: OV2GroupKey) => gr.some((x) => x.key === k)
  const count = (k: OV2GroupKey) => gr.filter((x) => x.key === k).length
  if (has('carboxyl') && has('amino')) return 'aminoAcid'
  if (has('carboxyl')) return 'acid'
  if (has('ester') || has('nitrate')) return 'ester'
  if (has('carbonylAldehyde')) return 'aldehyde'
  if (has('carbonylKetone')) return 'ketone'
  if (has('phenolOH')) return 'phenol'
  if (count('hydroxyl') >= 2) return 'polyol'
  if (has('hydroxyl')) return 'alcohol'
  if (has('amino')) return 'amine'
  if (has('nitro')) return 'nitro'
  if (has('ether')) return 'ether'
  if (has('halogen')) return 'halo'
  if (m.el.some((e) => e !== 'C')) return 'other'
  if (has('arene')) return 'arene'
  const nd = count('alkene'), nt = count('alkyne')
  const cyc = inRing(m)
  if (nt) return 'alkyne'
  if (nd >= 2) return 'alkadiene'
  if (nd === 1) return cyc ? 'cycloalkene' : 'alkene'
  return cyc ? 'cycloalkane' : 'alkane'
}

/** Степень атома C: 1 — первичный, 2 — вторичный, 3 — третичный, 4 — четвертичный (0 — нет соседних C). */
export function carbonDegrees(g: SkeletonGraph | Mol): number[] {
  const m = 'adj' in g ? g : toMol(g)
  return m.el.map((e, i) => (e === 'C' ? m.adj[i].filter((x) => m.el[x.to] === 'C').length : -1))
}

export const DEGREE_LABELS: Record<number, { ru: string; en: string; uz: string; roman: string }> = {
  0: { ru: 'нулевой', en: 'methane-type', uz: 'nolinchi', roman: '0' },
  1: { ru: 'первичный', en: 'primary', uz: 'birlamchi', roman: 'I' },
  2: { ru: 'вторичный', en: 'secondary', uz: 'ikkilamchi', roman: 'II' },
  3: { ru: 'третичный', en: 'tertiary', uz: 'uchlamchi', roman: 'III' },
  4: { ru: 'четвертичный', en: 'quaternary', uz: 'to‘rtlamchi', roman: 'IV' },
}

// ───────────────────────── полуструктурная формула ─────────────────────────

const BOND = ['', '–', '=', '≡']
const sub = (n: number) => (n > 1 ? String(n) : '')

/**
 * Полуструктурная (сокращённая структурная) формула: «CH₃–CH(CH₃)–CH₃», «CH₃–COOH», «CH₃–COO–CH₂–CH₃»,
 * «C₆H₅–OH». Для молекул с циклами (кроме одного бензольного кольца с одним заместителем) — брутто-формула и
 * `exact: false`.
 */
export function semiStructuralFormula(g: SkeletonGraph | Mol): { text: string; exact: boolean } {
  const m = 'adj' in g ? g : toMol(g)
  const aro = aromaticBonds(m)
  const ring = new Set([...aro].flatMap((k) => k.split('-').map(Number)))
  let edges = 0
  for (const l of m.adj) edges += l.length
  edges /= 2
  const cycles = edges - m.n + 1
  // одно бензольное кольцо с одним заместителем → псевдоатом C₆H₅
  let phenyl = -1
  if (cycles === 1 && ring.size === 6) {
    const att = [...ring].filter((a) => m.adj[a].some((e) => !ring.has(e.to)))
    if (att.length === 1) phenyl = att[0]
    else if (att.length === 0) return { text: 'C₆H₆', exact: true }
  }
  if (cycles > 0 && phenyl < 0) return { text: subscriptDigits(hillLike(m)), exact: false }
  const skip = new Set<number>(phenyl >= 0 ? [...ring].filter((a) => a !== phenyl) : [])
  const heavy = (i: number) => !skip.has(i)
  // атомы, «поглощённые» соседним C: =O, OH карбоксила, галогены, нитрогруппа
  const absorbed = new Set<number>()
  const tok = new Map<number, string>()
  for (let i = 0; i < m.n; i++) {
    if (!heavy(i) || m.el[i] !== 'C' || i === phenyl) continue
    const dO = m.adj[i].find((e) => e.o === 2 && termO(m, e.to))
    let t = 'C' + (m.hc[i] ? 'H' + sub(m.hc[i]) : '')
    if (dO) {
      absorbed.add(dO.to)
      const oh = m.adj[i].find((e) => e.o === 1 && m.el[e.to] === 'O' && m.adj[e.to].length === 1)
      if (oh) { absorbed.add(oh.to); t = 'COOH' } else t = m.hc[i] ? 'CHO' : 'CO'
    }
    const hal = new Map<string, number>()
    for (const e of m.adj[i]) if (isHal(m.el[e.to])) { absorbed.add(e.to); hal.set(m.el[e.to], (hal.get(m.el[e.to]) ?? 0) + 1) }
    for (const [el, k] of hal) t += el + sub(k)
    tok.set(i, t)
  }
  for (let n = 0; n < m.n; n++) {
    if (m.el[n] !== 'N') continue
    const os = m.adj[n].filter((e) => termO(m, e.to))
    if (os.length >= 2) { os.forEach((e) => absorbed.add(e.to)); tok.set(n, 'NO₂') }
    else tok.set(n, 'N' + (m.hc[n] ? 'H' + sub(m.hc[n]) : ''))
  }
  for (let o = 0; o < m.n; o++) if (m.el[o] === 'O' && !absorbed.has(o)) tok.set(o, 'O' + (m.hc[o] ? 'H' + sub(m.hc[o]) : ''))
  if (phenyl >= 0) tok.set(phenyl, 'C₆H₅')
  const nodes = [...Array(m.n).keys()].filter((i) => heavy(i) && !absorbed.has(i))
  if (nodes.length === 1) {
    // одна частица: CH₄, CH₃Cl, CHCl₃
    return { text: subscriptDigits(tok.get(nodes[0]) ?? m.el[nodes[0]]), exact: true }
  }
  const nb = (v: number) => m.adj[v].filter((e) => heavy(e.to) && !absorbed.has(e.to))
  // главная цепь — самый длинный путь в дереве (две волны BFS), при равенстве — с меньшим индексом
  const far = (s: number): { v: number; par: Map<number, number> } => {
    const par = new Map<number, number>([[s, -1]])
    const q = [s]; let last = s
    while (q.length) { const v = q.shift()!; last = v; for (const e of nb(v)) if (!par.has(e.to)) { par.set(e.to, v); q.push(e.to) } }
    return { v: last, par }
  }
  // старт с конца, где C (а не O/N), — «CH₃–CH₂–OH», а не «HO–CH₂–CH₃»
  const a = far(nodes[0]).v
  const { v: b, par } = far(a)
  let path: number[] = []
  for (let v = b; v !== -1; v = par.get(v)!) path.push(v)
  if (m.el[path[0]] !== 'C' && m.el[path[path.length - 1]] === 'C') path = path.reverse()
  if (path[0] !== phenyl && path[path.length - 1] === phenyl) path = path.reverse()
  // «NH₂–CH₂–COOH»: старшая группа COOH/CHO — в конце записи
  if (/^(COOH|CHO)$/.test(tok.get(path[0]) ?? '') && !/^(COOH|CHO)$/.test(tok.get(path[path.length - 1]) ?? '')) path = path.reverse()
  const onPath = new Set(path)
  const branch = (v: number, from: number): string => {
    // ветвь: CH₃, C₂H₅ или вложенная запись
    const kids = nb(v).filter((e) => e.to !== from)
    if (m.el[v] === 'C' && !tok.get(v)!.includes('O') && kids.every((e) => m.el[e.to] === 'C' && e.o === 1)) {
      // неразветвлённый алкил → CnH2n+1
      let len = 1, cur = v, prev = from, linear = true
      for (;;) {
        const nx = nb(cur).filter((e) => e.to !== prev)
        if (!nx.length) break
        if (nx.length > 1 || m.el[nx[0].to] !== 'C' || nx[0].o !== 1 || nb(nx[0].to).some((e) => m.el[e.to] !== 'C')) { linear = false; break }
        prev = cur; cur = nx[0].to; len++
      }
      if (linear && m.adj[v].every((e) => e.o === 1)) return len === 1 ? (tok.get(v) ?? 'CH₃') : `C${len}H${2 * len + 1}`
    }
    let s = tok.get(v) ?? m.el[v]
    for (const e of kids) s += `(${BOND[e.o] === '–' ? '' : BOND[e.o]}${branch(e.to, v)})`
    return s
  }
  const parts: string[] = []
  path.forEach((v, k) => {
    let t = tok.get(v) ?? m.el[v]
    const side = nb(v).filter((e) => !onPath.has(e.to))
    const groups = new Map<string, number>()
    for (const e of side) { const s = (e.o > 1 ? BOND[e.o] : '') + branch(e.to, v); groups.set(s, (groups.get(s) ?? 0) + 1) }
    for (const [s, c] of groups) t += `(${s})${sub(c)}`
    if (k > 0) {
      const o = m.adj[v].find((e) => e.to === path[k - 1])!.o
      // сложноэфирная группа: «COO–», «–OOC»
      const prevTok = parts[parts.length - 1]
      if (o === 1 && m.el[v] === 'O' && !m.hc[v] && prevTok.endsWith('CO') && !prevTok.endsWith('COOH')) { parts[parts.length - 1] = prevTok + 'O'; return }
      if (o === 1 && t.startsWith('CO') && !t.startsWith('COOH') && prevTok === 'O' && k >= 2) { parts[parts.length - 1] = 'OO' + t.slice(2).replace(/^/, 'C'); return }
      parts.push(BOND[o])
    }
    parts.push(t)
  })
  // группа в начале записи: «HO–CH₂–…», «H₂N–CH₂–…»
  if (parts[0] === 'OH') parts[0] = 'HO'
  else if (parts[0] === 'NH2') parts[0] = 'H2N'
  return { text: subscriptDigits(parts.join('')), exact: true }
}

function hillLike(m: Mol): string {
  const cnt = new Map<string, number>()
  m.el.forEach((e, i) => { cnt.set(e, (cnt.get(e) ?? 0) + 1); if (m.hc[i]) cnt.set('H', (cnt.get('H') ?? 0) + m.hc[i]) })
  const keys = ['C', 'H', ...[...cnt.keys()].filter((k) => k !== 'C' && k !== 'H').sort()]
  return keys.filter((k) => cnt.has(k)).map((k) => k + sub(cnt.get(k)!)).join('')
}
