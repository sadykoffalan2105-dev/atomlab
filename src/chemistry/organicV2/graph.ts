/**
 * Органика v2 — модель «скелета» для Конструктора.
 *
 * Ученик рисует только тяжёлые атомы (C, O, N, S, галогены) и связи 1/2/3; водороды движок
 * добавляет сам по валентности. Явные H можно нарисовать — они «сворачиваются» в число H у соседа.
 * Чистый TS без React: используется и в браузере, и в тестах (tsx).
 */

/** Кратность связи в форме Кекуле. */
export type BondOrder = 1 | 2 | 3

/** Тяжёлый атом скелета (или явный H, если ученик его нарисовал). */
export interface SkeletonAtom {
  /** символ элемента: C, N, O, S, F, Cl, Br, I, P, B, H */
  readonly el: string
  /** формальный заряд (N⁺ нитрогруппы, O⁻) */
  readonly charge?: number
  /** число H задано вручную (иначе — по валентности) */
  readonly h?: number
  /** позиция для рисования 2D (единица ≈ длина связи) */
  readonly x?: number
  readonly y?: number
}

/** Связь скелета. Для двойной связи можно задать цис/транс. */
export interface SkeletonBond {
  readonly a: number
  readonly b: number
  readonly o: BondOrder
  /**
   * Геометрия двойной связи: 'cis' — опорные заместители по одну сторону.
   * Опорные атомы `ref` = [сосед a, сосед b]; если не заданы — первые тяжёлые соседи (по индексу).
   */
  readonly cisTrans?: 'cis' | 'trans'
  readonly ref?: readonly [number, number]
}

export interface SkeletonGraph {
  readonly atoms: readonly SkeletonAtom[]
  readonly bonds: readonly SkeletonBond[]
}

/** Внутреннее представление: только тяжёлые атомы + число H. */
export interface Mol {
  readonly n: number
  readonly el: string[]
  readonly ch: number[]
  /** полное число H у атома (свёрнутые явные + неявные) */
  readonly hc: number[]
  readonly adj: { to: number; o: BondOrder }[][]
  /** цис/транс двойных связей: ключ "i-j" (i<j), ref — индексы тяжёлых соседей */
  readonly stereo: Map<string, { ref: [number, number]; v: 'cis' | 'trans' }>
  /** индекс тяжёлого атома → индекс в исходном SkeletonGraph */
  readonly src: number[]
}

export const bondKey = (a: number, b: number): string => (a < b ? `${a}-${b}` : `${b}-${a}`)

/** Допустимые валентности (по возрастанию) с учётом заряда — школьный набор. */
export function allowedValences(el: string, charge = 0): number[] {
  switch (el) {
    case 'C': return charge === 0 ? [4] : [3]
    case 'N': return charge === 1 ? [4] : charge === -1 ? [2] : [3]
    case 'O': return charge === 1 ? [3] : charge === -1 ? [1] : [2]
    case 'S': return charge === 0 ? [2, 4, 6] : [1, 3, 5]
    case 'P': return [3, 5]
    case 'B': return [3]
    case 'H': case 'F': case 'Cl': case 'Br': case 'I': case 'Na': case 'K': case 'Li': return [charge === 0 ? 1 : 0]
    default: return [charge === 0 ? 1 : 0]
  }
}

const RU_NUM = ['ноль', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять']
function ruBonds(k: number): string {
  const w = RU_NUM[k] ?? String(k)
  const f = k % 10 === 1 && k % 100 !== 11 ? 'связь' : [2, 3, 4].includes(k % 10) && ![12, 13, 14].includes(k % 100) ? 'связи' : 'связей'
  return `${w} ${f}`
}

/** Ошибка валентности с понятным текстом. */
export interface ValenceIssue {
  readonly atom: number
  /** подпись атома: элемент + номер в рисунке (C2) */
  readonly label: string
  readonly bonds: number
  readonly max: number
  readonly messageRu: string
  readonly messageEn: string
  readonly messageUz: string
}

/** Подпись атома «C2»: элемент + порядковый номер среди атомов этого элемента. */
export function atomLabel(g: SkeletonGraph, i: number): string {
  const el = g.atoms[i].el
  let k = 0
  for (let j = 0; j <= i; j++) if (g.atoms[j].el === el) k++
  return `${el}${k}`
}

function bondSums(g: SkeletonGraph): number[] {
  const s = g.atoms.map(() => 0)
  for (const b of g.bonds) { s[b.a] += b.o; s[b.b] += b.o }
  return s
}

/**
 * Проверка валентности: «у C2 пять связей — уберите одну».
 * Учитывает связи к явным H и заданное вручную число H.
 */
export function checkValence(g: SkeletonGraph): ValenceIssue[] {
  const s = bondSums(g)
  const out: ValenceIssue[] = []
  g.atoms.forEach((a, i) => {
    const vals = allowedValences(a.el, a.charge ?? 0)
    const max = schoolNitro(g, i) ? s[i] : vals[vals.length - 1]
    const used = s[i] + (a.h ?? 0)
    if (used > max) {
      const extra = used - max
      const label = atomLabel(g, i)
      out.push({
        atom: i, label, bonds: used, max,
        messageRu: `у ${label} ${ruBonds(used)}, а валентность ${a.el} — ${max}: уберите ${extra === 1 ? 'одну' : ruBonds(extra)}`,
        messageEn: `${label} has ${used} bonds but ${a.el} has valence ${max}: remove ${extra}`,
        messageUz: `${label} da ${used} ta bog‘ bor, ${a.el} valentligi ${max}: ${extra} tasini olib tashlang`,
      })
    }
  })
  return out
}

/**
 * Школьная запись нитрогруппы без зарядов: N(=O)=O (пятивалентный N) или N(=O)–O без H (граф с явными H).
 * Движок сам переводит её в [N⁺](=O)[O⁻] (toMol), поэтому валентность такого N не считается ошибкой.
 */
export function schoolNitro(g: SkeletonGraph, i: number): boolean {
  const a = g.atoms[i]
  if (a.el !== 'N' || (a.charge ?? 0) !== 0) return false
  const deg = new Map<number, number>()
  for (const b of g.bonds) { deg.set(b.a, (deg.get(b.a) ?? 0) + 1); deg.set(b.b, (deg.get(b.b) ?? 0) + 1) }
  let sum = 0, dO = 0, sO = 0
  for (const b of g.bonds) {
    if (b.a !== i && b.b !== i) continue
    sum += b.o
    const o = b.a === i ? b.b : b.a
    if (g.atoms[o].el !== 'O' || deg.get(o) !== 1 || (g.atoms[o].charge ?? 0) !== 0) continue
    if (b.o === 2) dO++
    else if (b.o === 1 && g.atoms[o].h === 0) sO++
  }
  return (sum === 5 && dO >= 2) || (sum === 4 && dO >= 1 && sO >= 1)
}

/** Число неявных H по валентности (наименьшая допустимая валентность ≥ занятой). */
export function implicitH(el: string, charge: number, used: number): number {
  for (const v of allowedValences(el, charge)) if (v >= used) return v - used
  return 0
}

/**
 * Сворачивает граф в тяжёлые атомы + число H (явные H-атомы с одним тяжёлым соседом сворачиваются).
 * Не бросает исключений при ошибках валентности (H = 0).
 */
export function toMol(g: SkeletonGraph): Mol {
  const N = g.atoms.length
  const deg = new Array(N).fill(0)
  for (const b of g.bonds) { deg[b.a]++; deg[b.b]++ }
  const fold = g.atoms.map((a, i) => a.el === 'H' && (a.charge ?? 0) === 0 && deg[i] === 1)
  // H, связанный с H (молекула H₂), не сворачиваем
  for (const b of g.bonds) if (fold[b.a] && fold[b.b]) { fold[b.a] = false; fold[b.b] = false }
  const map = new Array(N).fill(-1)
  const src: number[] = []
  g.atoms.forEach((_, i) => { if (!fold[i]) { map[i] = src.length; src.push(i) } })
  const n = src.length
  const el = src.map((i) => g.atoms[i].el)
  const ch = src.map((i) => g.atoms[i].charge ?? 0)
  const folded = new Array(n).fill(0)
  const adj: { to: number; o: BondOrder }[][] = Array.from({ length: n }, () => [])
  const used = new Array(n).fill(0)
  for (const b of g.bonds) {
    const A = map[b.a], B = map[b.b]
    if (A >= 0 && B >= 0) { adj[A].push({ to: B, o: b.o }); adj[B].push({ to: A, o: b.o }); used[A] += b.o; used[B] += b.o }
    else if (A >= 0) { folded[A]++; used[A] += b.o } else if (B >= 0) { folded[B]++; used[B] += b.o }
  }
  // школьная нитрогруппа N(=O)=O / N(=O)–O → [N⁺](=O)[O⁻]
  for (let k = 0; k < n; k++) {
    if (!schoolNitro(g, src[k])) continue
    const termO = adj[k].filter((e) => el[e.to] === 'O' && adj[e.to].length === 1 && folded[e.to] === 0)
    const d2 = termO.filter((e) => e.o === 2)
    if (used[k] === 5 && d2.length >= 2) {
      const e = d2[d2.length - 1]
      e.o = 1
      adj[e.to][0].o = 1
      used[k]--; used[e.to]--
      ch[k] = 1; ch[e.to] = -1
    } else {
      const s1 = termO.find((e) => e.o === 1 && g.atoms[src[e.to]].h === 0)
      if (s1) { ch[k] = 1; ch[s1.to] = -1 }
    }
  }
  const hc = src.map((i, k) => {
    const a = g.atoms[i]
    if (a.h !== undefined) return a.h + folded[k]
    return folded[k] + implicitH(a.el, ch[k], used[k])
  })
  const stereo = new Map<string, { ref: [number, number]; v: 'cis' | 'trans' }>()
  for (const b of g.bonds) {
    if (b.o !== 2 || !b.cisTrans) continue
    const A = map[b.a], B = map[b.b]
    if (A < 0 || B < 0) continue
    let ra = b.ref ? map[b.ref[0]] : -1, rb = b.ref ? map[b.ref[1]] : -1
    if (ra < 0) ra = adj[A].find((x) => x.to !== B)?.to ?? -1
    if (rb < 0) rb = adj[B].find((x) => x.to !== A)?.to ?? -1
    if (ra < 0 || rb < 0) continue
    // ключ хранит концы в порядке (меньший, больший); ref — в том же порядке
    if (A < B) stereo.set(bondKey(A, B), { ref: [ra, rb], v: b.cisTrans })
    else stereo.set(bondKey(A, B), { ref: [rb, ra], v: b.cisTrans })
  }
  return { n, el, ch, hc, adj, stereo, src }
}

/** Обратное преобразование: Mol → SkeletonGraph (без явных H). */
export function fromMol(m: Mol): SkeletonGraph {
  const atoms: SkeletonAtom[] = m.el.map((el, i) => ({ el, ...(m.ch[i] ? { charge: m.ch[i] } : {}), h: m.hc[i] }))
  const bonds: SkeletonBond[] = []
  for (let i = 0; i < m.n; i++) for (const e of m.adj[i]) if (e.to > i) {
    const st = m.stereo.get(bondKey(i, e.to))
    bonds.push(st ? { a: i, b: e.to, o: e.o, cisTrans: st.v, ref: st.ref } : { a: i, b: e.to, o: e.o })
  }
  return { atoms, bonds }
}

/** Брутто-формула по Хиллу: "C6H14", "C2H5Br", "CH3NO2". */
export function hillFormula(g: SkeletonGraph | Mol): string {
  const m = 'adj' in g ? g : toMol(g)
  const cnt = new Map<string, number>()
  m.el.forEach((e, i) => { cnt.set(e, (cnt.get(e) ?? 0) + 1); if (m.hc[i]) cnt.set('H', (cnt.get('H') ?? 0) + m.hc[i]) })
  const keys = [...cnt.keys()]
  const hasC = cnt.has('C')
  const order = hasC ? ['C', 'H', ...keys.filter((k) => k !== 'C' && k !== 'H').sort()] : keys.sort()
  return order.filter((k) => cnt.has(k)).map((k) => k + (cnt.get(k)! > 1 ? cnt.get(k) : '')).join('')
    + (m.ch.reduce((s, c) => s + c, 0) ? '' : '')
}

const SUB = '₀₁₂₃₄₅₆₇₈₉'
/** "C6H14" → "C₆H₁₄" */
export const subscriptDigits = (s: string): string => s.replace(/\d/g, (d) => SUB[+d])

/** Добавляет явные H-атомы (с 2D-позициями, если у тяжёлых есть x/y) — для рисования и 3D. */
export function withExplicitHydrogens(g: SkeletonGraph): { graph: SkeletonGraph; heavy: number[] } {
  const m = toMol(g)
  const atoms: SkeletonAtom[] = m.src.map((i) => ({ ...g.atoms[i], h: 0 }))
  const bonds: SkeletonBond[] = []
  for (let i = 0; i < m.n; i++) for (const e of m.adj[i]) if (e.to > i) bonds.push({ a: i, b: e.to, o: e.o })
  for (let i = 0; i < m.n; i++) {
    const a = g.atoms[m.src[i]]
    const x = a.x ?? 0, y = a.y ?? 0
    // направления H — в свободные секторы вокруг атома
    const used = m.adj[i].map((e) => Math.atan2((g.atoms[m.src[e.to]].y ?? 0) - y, (g.atoms[m.src[e.to]].x ?? 0) - x))
    for (let k = 0; k < m.hc[i]; k++) {
      const ang = freeAngle(used)
      used.push(ang)
      const j = atoms.length
      atoms.push({ el: 'H', x: x + 0.7 * Math.cos(ang), y: y + 0.7 * Math.sin(ang) })
      bonds.push({ a: i, b: j, o: 1 })
    }
  }
  return { graph: { atoms, bonds }, heavy: m.src }
}

function freeAngle(used: number[]): number {
  if (!used.length) return 0
  const s = [...used].map((a) => (a + 2 * Math.PI) % (2 * Math.PI)).sort((p, q) => p - q)
  let best = 0, bestGap = -1
  for (let i = 0; i < s.length; i++) {
    const a = s[i], b = i + 1 < s.length ? s[i + 1] : s[0] + 2 * Math.PI
    if (b - a > bestGap) { bestGap = b - a; best = a + (b - a) / 2 }
  }
  return best
}

/**
 * Цис/транс по координатам рисунка: для каждой двойной связи вне малого цикла берётся двугранный угол
 * «сосед–C=C–сосед» (по первым тяжёлым соседям); |угол| < 90° → цис. Координаты — `coords[i]` (3D или 2D)
 * или x/y атомов. Уже заданные cisTrans не меняются.
 */
export function perceiveCisTrans(g: SkeletonGraph, coords?: readonly (readonly number[])[]): SkeletonGraph {
  const P = (i: number): [number, number, number] => {
    const c = coords?.[i]
    if (c) return [c[0] ?? 0, c[1] ?? 0, c[2] ?? 0]
    return [g.atoms[i].x ?? NaN, g.atoms[i].y ?? NaN, 0]
  }
  const heavyNb = (v: number, other: number) => g.bonds.filter((b) => (b.a === v || b.b === v)).map((b) => (b.a === v ? b.b : b.a)).filter((x) => x !== other && g.atoms[x].el !== 'H').sort((p, q) => p - q)
  const bonds = g.bonds.map((b) => {
    if (b.o !== 2 || b.cisTrans) return b
    const na = heavyNb(b.a, b.b), nb = heavyNb(b.b, b.a)
    if (!na.length || !nb.length) return b
    const ra = na[0], rb = nb[0]
    const d = dihedral(P(ra), P(b.a), P(b.b), P(rb))
    if (!Number.isFinite(d)) return b
    return { ...b, cisTrans: (Math.abs(d) < Math.PI / 2 ? 'cis' : 'trans') as 'cis' | 'trans', ref: [ra, rb] as const }
  })
  return { atoms: g.atoms, bonds }
}

/** Двугранный угол p0–p1–p2–p3, рад (NaN, если вырожден). */
export function dihedral(p0: readonly number[], p1: readonly number[], p2: readonly number[], p3: readonly number[]): number {
  const sub = (a: readonly number[], b: readonly number[]) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
  const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
  const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  const b1 = sub(p1, p0), b2 = sub(p2, p1), b3 = sub(p3, p2)
  const n1 = cross(b1, b2), n2 = cross(b2, b3)
  const l2 = Math.sqrt(dot(b2, b2))
  if (dot(n1, n1) < 1e-8 || dot(n2, n2) < 1e-8 || l2 < 1e-8) return NaN
  const m1 = cross(n1, b2.map((x) => x / l2))
  return Math.atan2(dot(m1, n2), dot(n1, n2))
}
