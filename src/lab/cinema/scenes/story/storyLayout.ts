/**
 * РАСКЛАДКА СЮЖЕТА РЕАКЦИИ (чистая, без three): кадры положений атомов и расписание анимации после синтеза.
 *
 * Сюжет (chemistry/reactionStory.ts) → для каждого атома ЛЕВОЙ стороны (атомы одни и те же весь ролик):
 *   p0 — исходные вещества: члены уравнения рядом, копии по коэффициентам; молекулы — шары и палочки
 *        (школьная структурная формула), ионные вещества — фрагмент решётки (ионы касаются, без палочек);
 *   p1 — после разрыва: фрагменты (атомы, сохранившиеся группы, ионы) расходятся от центра своего члена;
 *   p3 — продукты: та же раскладка, что у реагентов, но по правой стороне (атом встаёт на место своего образа);
 *   p4 — итог: газ поднимается ↑, осадок и выделившийся металл оседают ↓.
 * Связи: левые (сохранённые живут весь ролик, разорванные гаснут на шаге «Разрыв») и новые правые
 * (появляются по одной, когда их атомы пришли на место). Перенос e⁻ — отдельные электроны от донора к акцептору.
 * Тест scripts/test-reaction-story.mts проверяет, что атомы сохраняются в каждом кадре.
 */
import { ATOMIC_DATA, isElementSymbol } from '../../../../chemistry/data'
import { breakFragments, ionChargeText, type ReactionStory, type StorySide, type StoryStepId } from '../../../../chemistry/reactionStory'

export type StoryStepTiming = { readonly id: StoryStepId; readonly from: number; readonly to: number }

export type StoryStickSpec = {
  /** атомы — id ЛЕВОЙ стороны (у новых связей — прообразы атомов продукта) */
  readonly a: number
  readonly b: number
  /** 'kept' — весь ролик; 'broken' — гаснет в [t0, t1]; 'formed' — растёт в [t0, t1] */
  readonly kind: 'kept' | 'broken' | 'formed'
  readonly t0: number
  readonly t1: number
}

export type StoryElectronSpec = { readonly from: number; readonly to: number; readonly t0: number; readonly t1: number }

export type StoryLabelSpec = {
  readonly id: string
  readonly kind: 'atom' | 'atomDark' | 'ox' | 'species' | 'token' | 'glassEquation' | 'glassNote'
  /** к какому атому привязана (−1 — к точке) */
  readonly atom: number
}

export type StoryLayout = {
  readonly n: number
  readonly el: readonly string[]
  /** радиус шара слева (атом/ион как в реагенте) и справа (как в продукте) */
  readonly radius: Float32Array
  readonly radiusR: Float32Array
  readonly p0: Float32Array
  readonly p1: Float32Array
  readonly p3: Float32Array
  readonly p4: Float32Array
  /** окно движения атома к продукту: начало и длительность */
  readonly moveFrom: Float32Array
  readonly moveDur: number
  /** окно «разлёта» на шаге разрыва */
  readonly breakFrom: number
  readonly breakTo: number
  readonly fateFrom: number
  readonly fateTo: number
  readonly sticks: readonly StoryStickSpec[]
  readonly electrons: readonly StoryElectronSpec[]
  /** момент, когда подпись атома переходит в правое состояние (заряд/степень окисления); Infinity — не меняется до прихода */
  readonly flipAt: Float32Array
  /** подпись атома: слева, после разрыва, справа */
  readonly labelL: readonly string[]
  readonly labelB: readonly string[]
  readonly labelR: readonly string[]
  readonly oxL: readonly number[]
  readonly oxR: readonly number[]
  /** атомы, у которых меняется степень окисления (подписи-чипы на шаге электронов) */
  readonly oxAtoms: readonly number[]
  /** фрагменты после разрыва (≥ 2 атомов) с подписью: «SO₄²⁻», «OH⁻», «CO₂» */
  readonly fragments: readonly { readonly atoms: readonly number[]; readonly label: string }[]
  /** подписи членов: слева (под кластером в p0) и справа (под кластером в p4) */
  readonly termLabels: readonly { readonly side: 'left' | 'right'; readonly text: string; readonly atoms: readonly number[] }[]
  readonly steps: readonly StoryStepTiming[]
  readonly end: number
  readonly finish: { readonly from: number; readonly to: number }
  /** габарит всего ролика (с подписями), система сцены */
  readonly extent: { readonly w: number; readonly h: number; readonly cx: number; readonly cy: number }
  readonly top: number
  readonly bottom: number
}

// ─── размеры ───

const COV_FALLBACK: Readonly<Record<string, number>> = { Mn: 139, Cr: 139, Co: 126, Ni: 124, Ag: 145, Pb: 146, Sn: 139, Ba: 215, Sr: 195, Li: 128, Hg: 132, Au: 136, Pt: 136, Cd: 144, Bi: 148, Ti: 160, V: 153, W: 162, Mo: 154 }

/** Радиус шара: по ковалентному радиусу, в узком коридоре — символ читается и у H, и у Ba. */
export function storyBallRadius(el: string): number {
  const pm = isElementSymbol(el) ? ATOMIC_DATA[el].covalentRadiusPm : (COV_FALLBACK[el] ?? 130)
  return Math.min(0.37, Math.max(0.2, 0.165 + 0.00105 * pm))
}

/** Радиус иона (Shannon, КЧ 6): Na⁺ меньше атома Na, Cl⁻ больше атома Cl — видно, как меняется частица. */
export function storyIonRadius(el: string, charge: number): number {
  if (el === 'H') return storyBallRadius('H')
  const key = `${charge > 0 ? '+' : '-'}${Math.abs(charge)}`
  const pm = isElementSymbol(el) ? ATOMIC_DATA[el].ionicRadiiPm[key] : undefined
  if (pm == null) return storyBallRadius(el)
  return Math.min(0.4, Math.max(0.17, 0.165 + 0.00105 * pm))
}

/** Длина «палочки» (между центрами): шары не касаются, палочка видна. */
const bondLen = (ra: number, rb: number) => (ra + rb) * 1.32

type V = [number, number, number]

// ─── геометрия молекулы / многоатомного иона: школьная структурная формула в плоскости, с лёгкой глубиной ───

const LINEAR_CENTER = new Set(['C', 'Si', 'Be', 'Zn', 'Hg', 'Cd', 'Mg'])

function rot2(u: V, ang: number, z = 0): V {
  const c = Math.cos(ang)
  const s = Math.sin(ang)
  const x = u[0] * c - u[1] * s
  const y = u[0] * s + u[1] * c
  const l = Math.hypot(x, y, z) || 1
  return [x / l, y / l, z / l]
}

function rootDirs(d: number, el: string, nbEls: readonly string[], charged: boolean): V[] {
  const deg = Math.PI / 180
  if (d === 1) return [[1, 0, 0]]
  if (d === 2) {
    const linear = LINEAR_CENTER.has(el) || (el === 'N' && nbEls.includes('N'))
    if (linear) return [[1, 0, 0], [-1, 0, 0]]
    const a = 112 * deg
    return [
      [Math.sin(a / 2), -Math.cos(a / 2), 0],
      [-Math.sin(a / 2), -Math.cos(a / 2), 0],
    ]
  }
  if (d === 3) {
    const pyramid = (['N', 'P', 'As'].includes(el) && !nbEls.includes('O')) || (['S', 'Cl', 'Br', 'I', 'Se'].includes(el) && charged)
    const z = pyramid ? -0.42 : 0
    return [rot2([0, 1, 0], 0, z), rot2([0, 1, 0], 120 * deg, z), rot2([0, 1, 0], 240 * deg, z)]
  }
  if (d === 4) {
    // тетраэдр, повёрнутый так, чтобы все четыре связи читались в проекции
    const t: V[] = [
      [0, 1, 0],
      [0.943, -0.333, 0],
      [-0.471, -0.333, 0.816],
      [-0.471, -0.333, -0.816],
    ]
    const ay = 32 * deg
    const ax = 14 * deg
    return t.map(([x, y, z]) => {
      const x1 = x * Math.cos(ay) + z * Math.sin(ay)
      const z1 = -x * Math.sin(ay) + z * Math.cos(ay)
      const y2 = y * Math.cos(ax) - z1 * Math.sin(ax)
      const z2 = y * Math.sin(ax) + z1 * Math.cos(ax)
      return [x1, y2, z2] as V
    })
  }
  if (d === 5) return [[0, 1, 0], [0, -1, 0], [1, 0, 0.2], [-0.5, 0, 0.85], [-0.5, 0, -0.85]]
  if (d === 6) return [[0, 1, 0], [0, -1, 0], [1, 0, 0.25], [-1, 0, -0.25], [0.25, 0, -1], [-0.25, 0, 1]].map((v) => {
    const l = Math.hypot(v[0]!, v[1]!, v[2]!)
    return [v[0]! / l, v[1]! / l, v[2]! / l] as V
  })
  return Array.from({ length: d }, (_, k) => rot2([0, 1, 0], (k * 2 * Math.PI) / d))
}

/** Положения атомов связного фрагмента (локально, центр — в середине габарита). */
function embed(atoms: readonly number[], bonds: readonly [number, number][], el: (i: number) => string, r: (i: number) => number, charged: boolean): Map<number, V> {
  const pos = new Map<number, V>()
  if (atoms.length === 0) return pos
  const nb = new Map<number, number[]>()
  for (const a of atoms) nb.set(a, [])
  for (const [a, b] of bonds) {
    nb.get(a)?.push(b)
    nb.get(b)?.push(a)
  }
  const placedAll = new Set<number>()
  let offsetX = 0
  // несвязные части (не должно быть, но кристаллогидрат и т. п.) — рядом друг с другом
  for (const start of atoms) {
    if (placedAll.has(start)) continue
    // корень компоненты: наибольшая степень, затем не-H
    const comp: number[] = []
    const stack = [start]
    const seen = new Set([start])
    while (stack.length) {
      const x = stack.pop()!
      comp.push(x)
      for (const y of nb.get(x) ?? []) if (!seen.has(y)) {
        seen.add(y)
        stack.push(y)
      }
    }
    let root = comp[0]!
    for (const x of comp) {
      const dx = nb.get(x)!.length
      const dr = nb.get(root)!.length
      if (dx > dr || (dx === dr && el(root) === 'H' && el(x) !== 'H')) root = x
    }
    const local = new Map<number, V>()
    local.set(root, [0, 0, 0])
    const rootNb = nb.get(root)!
    const dirs = rootDirs(rootNb.length, el(root), rootNb.map(el), charged)
    // тяжёлые соседи — на «верхние» направления, водород — на остальные
    const order = rootNb.slice().sort((a, b) => Number(el(a) === 'H') - Number(el(b) === 'H'))
    const queue: { atom: number; from: number; dir: V; depth: number }[] = []
    order.forEach((c, k) => {
      const d = dirs[k]!
      const L = bondLen(r(root), r(c))
      local.set(c, [d[0] * L, d[1] * L, d[2] * L])
      queue.push({ atom: c, from: root, dir: d, depth: 1 })
    })
    while (queue.length) {
      const { atom, from, dir, depth } = queue.shift()!
      const kids = (nb.get(atom) ?? []).filter((x) => x !== from && !local.has(x))
      if (kids.length === 0) continue
      const p = local.get(atom)!
      const sp2 = kids.length === 1 && !(['C', 'N', 'Be'].includes(el(atom)) && (nb.get(atom)!.length === 2))
      const offs = kids.length === 1 ? [sp2 ? (depth % 2 ? 1 : -1) * 68 : 0] : kids.length === 2 ? [-60, 60] : [-70, 0, 70, 140].slice(0, kids.length)
      kids.forEach((c, k) => {
        const zTilt = kids.length >= 3 ? (k === 1 ? 0.5 : k === 2 ? -0.4 : 0) : 0
        const d = rot2(dir, ((offs[k] ?? 0) * Math.PI) / 180, zTilt)
        const L = bondLen(r(atom), r(c))
        local.set(c, [p[0] + d[0] * L, p[1] + d[1] * L, p[2] + d[2] * L])
        queue.push({ atom: c, from: atom, dir: d, depth: depth + 1 })
      })
    }
    // в общую карту со сдвигом по x (несвязные части)
    let minX = Infinity
    let maxX = -Infinity
    for (const [i, v] of local) {
      minX = Math.min(minX, v[0] - r(i))
      maxX = Math.max(maxX, v[0] + r(i))
    }
    const shift = offsetX - minX
    for (const [i, v] of local) {
      pos.set(i, [v[0] + shift, v[1], v[2]])
      placedAll.add(i)
    }
    offsetX += maxX - minX + 0.25
  }
  centerMap(pos, r)
  return pos
}

function centerMap(pos: Map<number, V>, r: (i: number) => number): void {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  let sz = 0
  for (const [i, v] of pos) {
    minX = Math.min(minX, v[0] - r(i))
    maxX = Math.max(maxX, v[0] + r(i))
    minY = Math.min(minY, v[1] - r(i))
    maxY = Math.max(maxY, v[1] + r(i))
    sz += v[2]
  }
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const cz = sz / Math.max(1, pos.size)
  for (const [i, v] of pos) pos.set(i, [v[0] - cx, v[1] - cy, v[2] - cz])
}

type Box = { minX: number; maxX: number; minY: number; maxY: number }

function boxOf(pos: Map<number, V>, r: (i: number) => number): Box {
  const b = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
  for (const [i, v] of pos) {
    b.minX = Math.min(b.minX, v[0] - r(i))
    b.maxX = Math.max(b.maxX, v[0] + r(i))
    b.minY = Math.min(b.minY, v[1] - r(i))
    b.maxY = Math.max(b.maxY, v[1] + r(i))
  }
  if (!Number.isFinite(b.minX)) return { minX: -0.2, maxX: 0.2, minY: -0.2, maxY: 0.2 }
  return b
}

// ─── кластер члена уравнения ───

/** Положения атомов члена (все копии): молекулы — сеткой, ионные и металлы — фрагментом решётки. */
function termCluster(side: StorySide, term: number, r: (i: number) => number): Map<number, V> {
  const units = side.units.filter((u) => u.term === term)
  const out = new Map<number, V>()
  if (units.length === 0) return out
  const kind = units[0]!.kind
  const sideBonds: [number, number][] = side.bonds.map((b) => [b.a, b.b])
  const el = (i: number) => side.atoms[i]!.el
  if (kind === 'ionic' || kind === 'metal') {
    // ионы (или атомы металла) всех копий — одним фрагментом решётки, ионы касаются
    type Item = { atoms: number[]; local: Map<number, V>; R: number; cation: boolean }
    const items: Item[] = []
    for (const u of units) {
      for (const g of u.groups) {
        const grp = side.groups[g]!
        const local = embed(grp.atoms, sideBonds.filter(([a, b]) => grp.atoms.includes(a) && grp.atoms.includes(b)), el, r, grp.charge !== 0)
        let R = 0
        for (const [i, v] of local) R = Math.max(R, Math.hypot(v[0], v[1]) + r(i))
        items.push({ atoms: grp.atoms.slice(), local, R, cation: grp.charge > 0 || kind === 'metal' })
      }
    }
    const cats = items.filter((x) => x.cation)
    const ans = items.filter((x) => !x.cation)
    const total = items.length
    const cols = total <= 3 ? total : Math.ceil(Math.sqrt(total))
    const rows = Math.ceil(total / cols)
    const maxC = Math.max(0, ...cats.map((x) => x.R))
    const maxA = Math.max(0, ...ans.map((x) => x.R))
    const step = kind === 'metal' ? 2 * maxC : maxC + maxA
    const cells: { x: number; y: number; even: boolean; d: number }[] = []
    const gx = (cols - 1) / 2
    const gy = (rows - 1) / 2
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) cells.push({ x, y, even: (x + y) % 2 === 0, d: Math.hypot(x - gx, (y - gy) * 1.05) + x * 1e-3 + y * 1e-4 })
    const byCenter = cells.map((_, ci) => ci).sort((a, b) => cells[a]!.d - cells[b]!.d)
    const used = new Set<number>()
    // меньшинство — в центр (Cl⁻ Zn²⁺ Cl⁻), при равенстве — шахматный порядок; большинство — на ближайшие свободные
    const minority = cats.length <= ans.length ? cats : ans
    const majority = minority === cats ? ans : cats
    const centerParity = cells[byCenter[0]!]!.even
    const put = (it: Item, ci: number) => {
      used.add(ci)
      const c = cells[ci]!
      const cx = (c.x - gx) * step
      const cy = (gy - c.y) * step
      for (const [i, v] of it.local) out.set(i, [cx + v[0], cy + v[1], v[2]])
    }
    for (const it of minority) {
      const ci = byCenter.find((k) => !used.has(k) && (minority.length === 1 || cells[k]!.even === centerParity)) ?? byCenter.find((k) => !used.has(k))!
      put(it, ci)
    }
    for (const it of majority) put(it, byCenter.find((k) => !used.has(k))!)
    centerMap(out, r)
    return out
  }
  // молекулы / атомы: копии сеткой
  const locals = units.map((u) => embed(u.atoms, sideBonds.filter(([a, b]) => u.atoms.includes(a) && u.atoms.includes(b)), el, r, u.charge !== 0))
  const boxes = locals.map((m) => boxOf(m, r))
  const cw = Math.max(...boxes.map((b) => b.maxX - b.minX)) + 0.32
  const ch = Math.max(...boxes.map((b) => b.maxY - b.minY)) + 0.32
  const k = units.length
  const cols = k <= 2 ? k : k <= 4 ? 2 : Math.ceil(Math.sqrt(k * 1.4))
  const rows = Math.ceil(k / cols)
  locals.forEach((m, idx) => {
    const cx = ((idx % cols) - (cols - 1) / 2) * cw
    const cy = ((rows - 1) / 2 - Math.floor(idx / cols)) * ch
    const zz = (idx % 2 ? 0.12 : -0.12) * (k > 1 ? 1 : 0)
    for (const [i, v] of m) out.set(i, [cx + v[0], cy + v[1], v[2] + zz])
  })
  centerMap(out, r)
  return out
}

/** Ряд членов одной стороны: кластеры слева направо, перенос строки, всё по центру. */
function sideRow(side: StorySide, terms: readonly number[], r: (i: number) => number, maxW: number): { pos: Map<number, V>; termAtoms: Map<number, number[]> } {
  const clusters = terms.map((t) => {
    const m = termCluster(side, t, r)
    return { t, m, b: boxOf(m, r) }
  })
  const GAP = 0.95
  type Line = { items: typeof clusters; w: number; h: number }
  const lines: Line[] = []
  let cur: Line = { items: [], w: 0, h: 0 }
  for (const c of clusters) {
    const w = c.b.maxX - c.b.minX
    if (cur.items.length > 0 && cur.w + GAP + w > maxW) {
      lines.push(cur)
      cur = { items: [], w: 0, h: 0 }
    }
    cur.w += (cur.items.length ? GAP : 0) + w
    cur.h = Math.max(cur.h, c.b.maxY - c.b.minY)
    cur.items.push(c)
  }
  if (cur.items.length) lines.push(cur)
  const LINE_GAP = 0.85
  const totalH = lines.reduce((s, l) => s + l.h, 0) + LINE_GAP * Math.max(0, lines.length - 1)
  const pos = new Map<number, V>()
  const termAtoms = new Map<number, number[]>()
  let y = totalH / 2
  for (const l of lines) {
    let x = -l.w / 2
    const cy = y - l.h / 2
    for (const c of l.items) {
      const w = c.b.maxX - c.b.minX
      const dx = x - c.b.minX
      const dy = cy - (c.b.minY + c.b.maxY) / 2
      const ids: number[] = []
      for (const [i, v] of c.m) {
        pos.set(i, [v[0] + dx, v[1] + dy, v[2]])
        ids.push(i)
      }
      termAtoms.set(c.t, ids)
      x += w + GAP
    }
    y -= l.h + LINE_GAP
  }
  return { pos, termAtoms }
}

// ─── расписание ───

export const STORY_TIMING = {
  reactants: 2.3,
  breaking: 2.6,
  electrons: 3.1,
  formation: 3.6,
  result: 3.0,
  finish: 1.5,
} as const

/** Подпись атома в шаре: символ или символ с зарядом иона. */
function atomLabel(side: StorySide, atom: number, freedIon: boolean): string {
  const a = side.atoms[atom]!
  const g = side.groups[a.group]!
  if ((g.kind === 'cation' || g.kind === 'anion') && g.atoms.length === 1) return `${a.el}${ionChargeText(g.charge)}`
  if (freedIon && Number.isInteger(a.ox) && a.ox !== 0) return `${a.el}${ionChargeText(a.ox)}`
  return a.el
}

export function buildStoryLayout(story: ReactionStory, opts: { lowPower?: boolean } = {}): StoryLayout {
  const L = story.left
  const R = story.right
  const n = L.atoms.length
  const el = L.atoms.map((a) => a.el)
  // радиус по состоянию: одноатомный ион — ионный радиус, иначе — по ковалентному
  const stateRadius = (side: StorySide, i: number) => {
    const a = side.atoms[i]!
    const g = side.groups[a.group]!
    return (g.kind === 'cation' || g.kind === 'anion') && g.atoms.length === 1 && g.charge !== 0 ? storyIonRadius(a.el, g.charge) : storyBallRadius(a.el)
  }
  const radius = new Float32Array(n)
  const radiusR = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    radius[i] = stateRadius(L, i)
    radiusR[i] = stateRadius(R, story.map[i]!)
  }
  const rL = (i: number) => radius[i]!
  const inv = new Array<number>(n)
  story.map.forEach((rr, l) => (inv[rr] = l))
  const rR = (j: number) => radiusR[inv[j]!]!

  const leftTerms = story.terms.filter((t) => t.side === 'left').map((t) => t.index)
  const rightTerms = story.terms.filter((t) => t.side === 'right').map((t) => t.index)
  const maxW = opts.lowPower ? 6.2 : 8.4
  const rowL = sideRow(L, leftTerms, rL, maxW)
  const rowR = sideRow(R, rightTerms, rR, maxW)

  const p0 = new Float32Array(n * 3)
  const p3 = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const a = rowL.pos.get(i) ?? [0, 0, 0]
    p0.set(a, i * 3)
    const b = rowR.pos.get(story.map[i]!) ?? a
    p3.set(b, i * 3)
  }

  // ——— разрыв: фрагменты расходятся от центра своего члена ———
  const frags = breakFragments(story)
  const p1 = new Float32Array(p0)
  const termCenter = new Map<number, V>()
  for (const [t, ids] of rowL.termAtoms) {
    const c: V = [0, 0, 0]
    for (const i of ids) for (let k = 0; k < 3; k++) c[k]! += p0[i * 3 + k]! / ids.length
    termCenter.set(t, c)
  }
  const fragmentLabels: { atoms: number[]; label: string }[] = []
  const unitCenter = new Map<number, V>()
  for (const u of L.units) {
    const c: V = [0, 0, 0]
    for (const i of u.atoms) for (let k = 0; k < 3; k++) c[k]! += p0[i * 3 + k]! / u.atoms.length
    unitCenter.set(u.id, c)
  }
  for (const f of frags) {
    const unit0 = L.units[L.atoms[f[0]!]!.unit]!
    const t = unit0.term
    // ионы и атомы металла расходятся от центра всего кристаллика, части молекулы — от центра своей молекулы
    const tc = (unit0.kind === 'ionic' || unit0.kind === 'metal' ? termCenter.get(t) : unitCenter.get(unit0.id)) ?? [0, 0, 0]
    const c: V = [0, 0, 0]
    for (const i of f) for (let k = 0; k < 3; k++) c[k]! += p0[i * 3 + k]! / f.length
    const dx = c[0] - tc[0]
    const dy = c[1] - tc[1]
    const d = Math.hypot(dx, dy)
    // небольшая раздвижка + отход от центра; одиночный фрагмент — лёгкое «покачивание»
    const k = 0.55
    const ux = d > 1e-6 ? dx / d : 0
    const uy = d > 1e-6 ? dy / d : 0
    const mx = dx * k + ux * 0.32
    const my = dy * k + uy * 0.32
    for (const i of f) {
      p1[i * 3] = (p0[i * 3]! + mx) * 1.12
      p1[i * 3 + 1] = p0[i * 3 + 1]! + my
    }
    if (f.length >= 2 && f.length < (L.units[L.atoms[f[0]!]!.unit]!.atoms.length || 0) + 1) {
      const unit = L.units[L.atoms[f[0]!]!.unit]!
      if (f.length < unit.atoms.length || unit.kind === 'ionic') {
        const q = f.reduce((s, i) => s + L.atoms[i]!.ox, 0)
        const counts: Record<string, number> = {}
        const order: string[] = []
        for (const i of f) {
          const e = L.atoms[i]!.el
          if (!(e in counts)) order.push(e)
          counts[e] = (counts[e] ?? 0) + 1
        }
        // центральный атом первым: SO₄, NO₃, CO₂ (а не O₄S)
        order.sort((a, b) => Number(a === 'O' || a === 'H') - Number(b === 'O' || b === 'H'))
        const SUBD = '₀₁₂₃₄₅₆₇₈₉'
        const sub = (x: number) => (x > 1 ? String(x).split('').map((dd) => SUBD[Number(dd)]).join('') : '')
        let text = order.map((e) => `${e}${sub(counts[e]!)}`).join('')
        if (text === 'HO') text = 'OH'
        const ionish = unit.kind === 'ionic' || unit.acid
        fragmentLabels.push({ atoms: f, label: `${text}${ionish && Number.isInteger(q) ? ionChargeText(Math.round(q)) : ''}` })
      }
    }
  }

  // фрагменты не налезают друг на друга: несколько проходов «расталкивания» (жёстко, целиком)
  {
    const fragOfAtom = new Int32Array(n)
    frags.forEach((f, k) => f.forEach((i) => (fragOfAtom[i] = k)))
    const shift = new Float32Array(frags.length * 2)
    for (let it = 0; it < 40; it++) {
      shift.fill(0)
      let moved = false
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const fi = fragOfAtom[i]!
          const fj = fragOfAtom[j]!
          if (fi === fj) continue
          const dx = p1[j * 3]! - p1[i * 3]!
          const dy = p1[j * 3 + 1]! - p1[i * 3 + 1]!
          const d = Math.hypot(dx, dy) || 1e-6
          const need = Math.max(radius[i]!, radiusR[i]!) + Math.max(radius[j]!, radiusR[j]!) + 0.12
          if (d >= need) continue
          const push = (need - d) / 2
          const ux = d > 1e-5 ? dx / d : 1
          const uy = d > 1e-5 ? dy / d : 0
          shift[fi * 2] -= ux * push
          shift[fi * 2 + 1] -= uy * push * 0.5
          shift[fj * 2] += ux * push
          shift[fj * 2 + 1] += uy * push * 0.5
          moved = true
        }
      }
      if (!moved) break
      frags.forEach((f, k) => {
        for (const i of f) {
          p1[i * 3] += shift[k * 2]! * 0.6
          p1[i * 3 + 1] += shift[k * 2 + 1]! * 0.6
        }
      })
    }
  }

  // ——— расписание шагов ———
  const T = STORY_TIMING
  const steps: StoryStepTiming[] = []
  let t = 0
  for (const id of story.steps) {
    const dur = T[id]
    steps.push({ id, from: t, to: t + dur })
    t += dur
  }
  const at = (id: StoryStepId) => steps.find((s) => s.id === id)!
  const sB = at('breaking')
  const sF = at('formation')
  const sE = story.redox ? at('electrons') : null
  const finish = { from: t, to: t + T.finish }

  // ——— связи ———
  const sticks: StoryStickSpec[] = []
  const brokenSet = new Set(story.bondsBroken)
  let bi = 0
  L.bonds.forEach((b, i) => {
    if (brokenSet.has(i)) {
      const t0 = sB.from + 0.35 + Math.min(1.2, bi * 0.14)
      sticks.push({ a: b.a, b: b.b, kind: 'broken', t0, t1: t0 + 0.55 })
      bi++
    } else sticks.push({ a: b.a, b: b.b, kind: 'kept', t0: 0, t1: 0 })
  })

  // ——— образование: единицы продукта по очереди, связи — по одной после прихода атомов ———
  const moveFrom = new Float32Array(n)
  const moveDur = 1.15
  const runits = R.units
  const stagger = Math.min(0.26, 1.35 / Math.max(1, runits.length))
  const unitStart = new Map<number, number>()
  runits.forEach((u, k) => unitStart.set(u.id, sF.from + 0.2 + k * stagger))
  for (let i = 0; i < n; i++) moveFrom[i] = unitStart.get(R.atoms[story.map[i]!]!.unit) ?? sF.from + 0.2
  const formedByUnit = new Map<number, number>()
  for (const j of story.bondsFormed) {
    const b = R.bonds[j]!
    const u = R.atoms[b.a]!.unit
    const k = formedByUnit.get(u) ?? 0
    formedByUnit.set(u, k + 1)
    const t0 = (unitStart.get(u) ?? sF.from) + moveDur * 0.8 + k * 0.2
    sticks.push({ a: inv[b.a]!, b: inv[b.b]!, kind: 'formed', t0, t1: t0 + 0.35 })
  }

  // ——— судьба продуктов: газ ↑, осадок ↓ ———
  const p4 = new Float32Array(p3)
  const fateFrom = sF.to - 0.9
  const fateTo = sF.to + 0.5
  const termOfRightAtom = (j: number) => R.units[R.atoms[j]!.unit]!.term
  for (let i = 0; i < n; i++) {
    const term = story.terms[termOfRightAtom(story.map[i]!)]!
    if (term.fate === 'gas') p4[i * 3 + 1] = p3[i * 3 + 1]! + 1.05
    else if (term.fate === 'precipitate' || term.fate === 'deposit') p4[i * 3 + 1] = p3[i * 3 + 1]! - 0.75
  }

  // ——— электроны ———
  const electrons: StoryElectronSpec[] = []
  const flipAt = new Float32Array(n).fill(Number.POSITIVE_INFINITY)
  if (sE) {
    const list: { from: number; to: number }[] = []
    for (const tr of story.transfers) {
      const k = Math.max(1, Math.round(tr.n))
      for (let q = 0; q < k; q++) list.push({ from: tr.from, to: tr.to })
    }
    const cap = opts.lowPower ? 10 : 16
    const shown = list.length > cap ? list.filter((_, q) => q % Math.ceil(list.length / cap) === 0) : list
    const travel = 0.95
    const gap = shown.length > 1 ? Math.min(0.32, 1.55 / (shown.length - 1)) : 0
    shown.forEach((e, q) => {
      const t0 = sE.from + 0.4 + q * gap
      electrons.push({ from: e.from, to: e.to, t0, t1: t0 + travel })
    })
    // донор меняет подпись, когда ушёл его последний электрон; акцептор — когда пришёл последний
    const lastFrom = new Map<number, number>()
    const lastTo = new Map<number, number>()
    for (const e of electrons) {
      lastFrom.set(e.from, Math.max(lastFrom.get(e.from) ?? 0, e.t0 + 0.15))
      lastTo.set(e.to, Math.max(lastTo.get(e.to) ?? 0, e.t1))
    }
    for (const [a, tt] of lastFrom) flipAt[a] = tt
    for (const [a, tt] of lastTo) flipAt[a] = tt
    // атомы с изменённой с.о., электрон которых не показан (прорежено), — в конце шага
    for (const c of [...story.oxidations, ...story.reductions]) for (const a of c.atoms) if (!Number.isFinite(flipAt[a]!)) flipAt[a] = sE.to - 0.4
  }

  // ——— подписи ———
  const fragOf = new Map<number, number>()
  frags.forEach((f, k) => f.forEach((i) => fragOf.set(i, k)))
  const labelL: string[] = []
  const labelB: string[] = []
  const labelR: string[] = []
  const oxL: number[] = []
  const oxR: number[] = []
  const oxAtoms: number[] = []
  for (let i = 0; i < n; i++) {
    const unit = L.units[L.atoms[i]!.unit]!
    const freed = frags[fragOf.get(i)!]!.length === 1 && (unit.kind === 'ionic' || unit.acid)
    labelL.push(atomLabel(L, i, false))
    labelB.push(atomLabel(L, i, freed))
    labelR.push(atomLabel(R, story.map[i]!, false))
    oxL.push(L.atoms[i]!.ox)
    oxR.push(R.atoms[story.map[i]!]!.ox)
    if (Math.abs(oxL[i]! - oxR[i]!) > 1e-9) oxAtoms.push(i)
  }
  const termLabels: { side: 'left' | 'right'; text: string; atoms: number[] }[] = []
  for (const tm of story.terms) {
    const coeff = tm.coeff > 1 ? String(tm.coeff) : ''
    const mark = tm.fate === 'gas' ? ' ↑' : tm.fate === 'precipitate' || tm.fate === 'deposit' ? ' ↓' : ''
    if (tm.side === 'left') termLabels.push({ side: 'left', text: `${coeff}${tm.formula}`, atoms: rowL.termAtoms.get(tm.index) ?? [] })
    else termLabels.push({ side: 'right', text: `${coeff}${tm.formula}${mark}`, atoms: (rowR.termAtoms.get(tm.index) ?? []).map((j) => inv[j]!) })
  }

  // ——— габарит ролика ———
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const P of [p0, p1, p3, p4]) {
    for (let i = 0; i < n; i++) {
      const rr = Math.max(radius[i]!, radiusR[i]!)
      minX = Math.min(minX, P[i * 3]! - rr)
      maxX = Math.max(maxX, P[i * 3]! + rr)
      minY = Math.min(minY, P[i * 3 + 1]! - rr)
      maxY = Math.max(maxY, P[i * 3 + 1]! + rr)
    }
  }
  // поля: сверху — подпись шага, снизу — подписи членов и уравнение
  const top = maxY + 0.95
  const bottom = minY - 1.35
  const w = Math.max(maxX - minX + 0.8, 4.2)
  const h = top - bottom
  return {
    n,
    el,
    radius,
    radiusR,
    p0,
    p1,
    p3,
    p4,
    moveFrom,
    moveDur,
    breakFrom: sB.from + 0.3,
    breakTo: sB.from + 1.9,
    fateFrom,
    fateTo,
    sticks,
    electrons,
    flipAt,
    labelL,
    labelB,
    labelR,
    oxL,
    oxR,
    oxAtoms,
    fragments: fragmentLabels,
    termLabels,
    steps,
    end: finish.to,
    finish,
    extent: { w, h, cx: (minX + maxX) / 2, cy: (top + bottom) / 2 },
    top,
    bottom,
  }
}

/** Плавный шаг 0…1 на [a, b]. */
export function smooth(a: number, b: number, t: number): number {
  if (t <= a) return 0
  if (t >= b) return 1
  const x = (t - a) / (b - a)
  return x * x * (3 - 2 * x)
}

/** Положение атома i в момент t (в out[0..2]). Атомы есть в КАЖДОМ кадре — функция определена всюду. */
export function storyAtomPos(lay: StoryLayout, i: number, t: number, out: Float32Array | number[], o = 0): void {
  const k = i * 3
  const b = smooth(lay.breakFrom, lay.breakTo, t)
  const m = smooth(lay.moveFrom[i]!, lay.moveFrom[i]! + lay.moveDur, t)
  const f = smooth(lay.fateFrom, lay.fateTo, t)
  for (let c = 0; c < 3; c++) {
    const a0 = lay.p0[k + c]!
    const a1 = a0 + (lay.p1[k + c]! - a0) * b
    const a3 = a1 + (lay.p3[k + c]! - a1) * m
    out[o + c] = a3 + (lay.p4[k + c]! - lay.p3[k + c]!) * f
  }
  // дуга при перелёте к продукту: атом приподнимается к камере, не проходит сквозь соседей
  const arc = Math.sin(Math.PI * m) * 0.35
  out[o + 2] = (out[o + 2] as number) + arc
}

/** Радиус шара атома i в момент t: меняется, когда атом становится ионом (или перестаёт им быть). */
export function storyAtomRadius(lay: StoryLayout, i: number, t: number): number {
  const a = lay.radius[i]!
  const b = lay.radiusR[i]!
  if (a === b) return a
  const tf = Number.isFinite(lay.flipAt[i]!) ? lay.flipAt[i]! : lay.moveFrom[i]! + lay.moveDur * 0.6
  return a + (b - a) * smooth(tf - 0.15, tf + 0.35, t)
}
