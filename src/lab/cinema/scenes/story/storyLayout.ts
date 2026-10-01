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
import { breakFragments, ionChargeText, type ReactionStory, type StorySide, type StoryStepId, type StoryTransfer, type StoryUnit } from '../../../../chemistry/reactionStory'

export type StoryStepTiming = { readonly id: StoryStepId; readonly from: number; readonly to: number }

export type StoryStickSpec = {
  /** кратность связи: столько параллельных палочек */
  readonly order: number
  /** атомы — id ЛЕВОЙ стороны (у новых связей — прообразы атомов продукта) */
  readonly a: number
  readonly b: number
  /** 'kept' — весь ролик; 'broken' — гаснет в [t0, t1]; 'formed' — растёт в [t0, t1] */
  readonly kind: 'kept' | 'broken' | 'formed'
  readonly t0: number
  readonly t1: number
}

/**
 * Летящий электрон (или группа): от донора к акцептору. n — сколько e⁻ несёт точка (1 — по одному; у больших чисел
 * точка = перенос «атом → атом» из сюжета, n — его число e⁻). wave — номер «волны»: точки одной волны летят вместе.
 */
export type StoryElectronSpec = { readonly from: number; readonly to: number; readonly t0: number; readonly t1: number; readonly n: number; readonly wave: number }

/** Волна электронов (группа с подписью «e⁻ ×n» у больших чисел): окно полёта и сколько e⁻ она несёт. */
export type StoryWaveSpec = { readonly t0: number; readonly t1: number; readonly n: number; readonly tokens: readonly number[] }

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
  /** волны электронов; single — каждый e⁻ летит отдельно (Σ ≤ E_SINGLE_MAX), иначе группами «×n» */
  readonly waves: readonly StoryWaveSpec[]
  readonly eSingle: boolean
  /** окно шага переноса: подсветка ролей [eOn, eOff], последний прилёт — eLastArrive */
  readonly eOn: number
  readonly eOff: number
  readonly eLastArrive: number
  /** доноры (степень окисления растёт — восстановитель) и акцепторы (падает — окислитель) */
  readonly donors: readonly number[]
  readonly acceptors: readonly number[]
  /** сохранённые многоатомные группы (SO₄²⁻, OH⁻ …), атомы — id левой стороны */
  readonly keptGroups: readonly { readonly atoms: readonly number[]; readonly label: string }[]
  /** окно образования (шаг formation) */
  readonly formFrom: number
  readonly formTo: number
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
  /**
   * Компактный вид огромных реакций (2KMnO₄ + 10FeSO₄ + 8H₂SO₄ … — 128 атомов): у каждого члена одна лицевая копия,
   * остальные копии — тёмной «стопкой» позади (сдвиг вверх-вправо и вглубь), подпись члена несёт коэффициент.
   * Атомы все на месте (сохраняются в каждом кадре), читается одна копия.
   */
  readonly compact: boolean
  /** слой копии атома слева / справа: 0 — лицевая копия, 1, 2 — копии стопки позади (у обычного вида — все 0) */
  readonly layerL: Uint8Array
  readonly layerR: Uint8Array
}

/** Компактный вид — когда атомов больше стольких (на телефоне — меньше порог). */
export const STORY_COMPACT_ATOMS = 40
export const STORY_COMPACT_ATOMS_LOW = 30
/** Сдвиг слоя стопки копий: вверх-вправо и вглубь (слой 1, 2; дальше копии совпадают со слоем 2). */
const STACK_DX = 0.2
const STACK_DY = 0.15
const STACK_DZ = -0.55
/** Яркость атома по слою стопки: лицевая копия — полная, позади — тёмные. */
export const STORY_LAYER_BRIGHT = [1, 0.26, 0.15] as const

/** Стопка копий: лицевая единица каждого члена (term → unit id) и слой каждой единицы (unit id → 0, 1, 2). */
type Stack = { readonly rep: Map<number, number>; readonly layer: Map<number, number> }

/** Лицевая копия члена — с наибольшим score (при равенстве — первая); остальные — слои 1, 2, 2 … */
function pickStack(side: StorySide, score: (u: StoryUnit) => number): Stack {
  const rep = new Map<number, number>()
  const layer = new Map<number, number>()
  const byTerm = new Map<number, StoryUnit[]>()
  for (const u of side.units) {
    const g = byTerm.get(u.term)
    if (g) g.push(u)
    else byTerm.set(u.term, [u])
  }
  for (const [term, us] of byTerm) {
    let best = us[0]!
    let bs = score(best)
    for (const u of us) {
      const sc = score(u)
      if (sc > bs + 1e-9) {
        best = u
        bs = sc
      }
    }
    rep.set(term, best.id)
    let rank = 0
    for (const u of us) layer.set(u.id, u.id === best.id ? 0 : Math.min(2, ++rank))
  }
  return { rep, layer }
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

/**
 * Положения атомов члена (все копии): молекулы — сеткой, ионные и металлы — фрагментом решётки. В компактном виде
 * (stack) раскладывается одна лицевая копия, остальные встают позади неё стопкой; front — атомы лицевой копии.
 */
function termCluster(side: StorySide, term: number, r: (i: number) => number, stack?: Stack): { m: Map<number, V>; front: number[] } {
  const all = side.units.filter((u) => u.term === term)
  const repId = stack?.rep.get(term)
  const units = repId == null ? all : all.filter((u) => u.id === repId)
  const m = clusterOf(side, units, r)
  if (repId != null && stack) {
    const f = side.units[repId]!
    for (const u of all) {
      if (u.id === repId) continue
      const ly = stack.layer.get(u.id) ?? 2
      u.atoms.forEach((a, k) => {
        const p = m.get(f.atoms[k]!)!
        m.set(a, [p[0] + STACK_DX * ly, p[1] + STACK_DY * ly, p[2] + STACK_DZ * ly])
      })
    }
  }
  return { m, front: units.flatMap((u) => u.atoms) }
}

function clusterOf(side: StorySide, units: readonly StoryUnit[], r: (i: number) => number): Map<number, V> {
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
    if (kind === 'ionic') compactIons(items.map((x) => x.atoms), out, r, el)
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

/**
 * Ионы фрагмента решётки касаются друг друга: сетка шагом «радиус катиона + габарит аниона» оставляет зазор у
 * многоатомных ионов (Fe²⁺ … SO₄²⁻ — кислород не на линии сетки). Ионы по очереди (от центра наружу) сдвигаются
 * к центру, пока не коснутся уже стоящих (зазор 0.02).
 */
function compactIons(items: readonly (readonly number[])[], pos: Map<number, V>, r: (i: number) => number, elOf: (i: number) => string): void {
  if (items.length < 2) return
  const centre = (it: readonly number[]): V => {
    const c: V = [0, 0, 0]
    for (const i of it) {
      const p = pos.get(i)!
      c[0] += p[0] / it.length
      c[1] += p[1] / it.length
    }
    return c
  }
  let gx = 0
  let gy = 0
  let cnt = 0
  for (const it of items) for (const i of it) {
    gx += pos.get(i)![0]
    gy += pos.get(i)![1]
    cnt++
  }
  gx /= cnt
  gy /= cnt
  // ион с водородом (OH⁻, HCO₃⁻ …) — водородом наружу: к катиону обращён кислород (иначе Ca²⁺ «касался» H)
  for (const it of items) {
    const hs = it.filter((i) => elOf(i) === 'H')
    if (hs.length === 0 || hs.length === it.length) continue
    const c = centre(it)
    let hx = 0
    let hy = 0
    for (const i of hs) {
      hx += pos.get(i)![0] / hs.length - c[0] / hs.length
      hy += pos.get(i)![1] / hs.length - c[1] / hs.length
    }
    if (hx * (gx - c[0]) + hy * (gy - c[1]) <= 0) continue
    for (const i of it) {
      const p = pos.get(i)!
      pos.set(i, [2 * c[0] - p[0], 2 * c[1] - p[1], p[2]])
    }
  }
  const order = items.map((it, k) => ({ it, k, d: Math.hypot(centre(it)[0] - gx, centre(it)[1] - gy) })).sort((a, b) => a.d - b.d)
  const fixed: number[] = [...order[0]!.it]
  const clash = (it: readonly number[], dx: number, dy: number) => {
    for (const i of it) {
      const p = pos.get(i)!
      for (const j of fixed) {
        const q = pos.get(j)!
        // касание — в плоскости кадра (без глубины): иначе кислород одного SO₄²⁻ встаёт «за» кислород соседа
        // и в кадре шары и символы налезают друг на друга
        if (Math.hypot(p[0] + dx - q[0], p[1] + dy - q[1]) < r(i) + r(j) + 0.02) return true
      }
    }
    return false
  }
  for (let o = 1; o < order.length; o++) {
    const { it } = order[o]!
    const c = centre(it)
    const vx = gx - c[0]
    const vy = gy - c[1]
    const d = Math.hypot(vx, vy)
    if (d > 1e-6 && !clash(it, 0, 0)) {
      const ux = vx / d
      const uy = vy / d
      let s = 0
      const stepS = 0.02
      while (s + stepS <= d && !clash(it, ux * (s + stepS), uy * (s + stepS))) s += stepS
      if (s > 0) for (const i of it) {
        const p = pos.get(i)!
        pos.set(i, [p[0] + ux * s, p[1] + uy * s, p[2]])
      }
    }
    fixed.push(...it)
  }
}

/** Ряд членов одной стороны: кластеры слева направо, перенос строки, всё по центру. */
function sideRow(side: StorySide, terms: readonly number[], r: (i: number) => number, maxW: number, stack?: Stack): { pos: Map<number, V>; termAtoms: Map<number, number[]> } {
  const clusters = terms.map((t) => {
    const { m, front } = termCluster(side, t, r, stack)
    return { t, m, front, b: boxOf(m, r) }
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
      for (const [i, v] of c.m) pos.set(i, [v[0] + dx, v[1] + dy, v[2]])
      // атомы члена для подписи и центра разлёта — лицевая копия (в обычном виде — все)
      termAtoms.set(c.t, c.front)
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

/**
 * Подпись атома в шаре: символ или символ с зарядом иона. Заряд — только у настоящих одноатомных ионов: ион
 * ионного вещества (Na⁺, Cl⁻) и ион кислоты, отделившийся при разрыве (HCl → H⁺ + Cl⁻). Атом, вырванный из
 * многоатомного иона или молекулы (Mn и O из MnO₄⁻), остаётся символом — «Mn⁷⁺», «O²⁻» как частиц нет;
 * его степень окисления показывает чип над шаром.
 */
function atomLabel(side: StorySide, atom: number, freedIon: boolean): string {
  const a = side.atoms[atom]!
  const g = side.groups[a.group]!
  if ((g.kind === 'cation' || g.kind === 'anion') && g.atoms.length === 1) return `${a.el}${ionChargeText(g.charge)}`
  if (freedIon && g.atoms.length === 1 && (g.kind === 'acidH' || g.kind === 'residue') && Number.isInteger(a.ox) && a.ox !== 0) return `${a.el}${ionChargeText(a.ox)}`
  return a.el
}

/** Сколько e⁻ при Σ Δ не больше этого летят по одному; больше — группами (волнами) с подписью «e⁻ ×n». */
export const E_SINGLE_MAX = 6
/** Не больше стольких волн у больших чисел (акцепторы подряд объединяются). */
export const E_WAVES_MAX = 6

export type ElectronToken = { readonly from: number; readonly to: number; readonly n: number; readonly wave: number }

/**
 * План полёта электронов (без времени): по одному, если Σ Δ ≤ E_SINGLE_MAX и все переносы целые; иначе точка —
 * перенос «донор → акцептор» из сюжета (n e⁻), волна — акцепторы подряд (у KMnO₄ + HCl: 2 волны «e⁻ ×5» к двум Mn).
 * Σ n по точкам = Σ Δ степеней окисления (= story.electrons) — проверяет scripts/test-reaction-story.mts.
 */
export function planElectronTokens(story: ReactionStory, compactTermOf?: (leftAtom: number) => number): { tokens: ElectronToken[]; waves: number; single: boolean } {
  const tr = story.transfers
  if (!story.redox || tr.length === 0) return { tokens: [], waves: 0, single: true }
  if (compactTermOf) {
    // компактный вид: волна — поток «член → член» (10FeSO₄ → 2KMnO₄: одна волна «e⁻ ×10» от стопки к стопке);
    // точки — те же переносы атом → атом, каждый атом отдаёт/принимает ровно свой Δ
    const byKey = new Map<string, StoryTransfer[]>()
    for (const t of tr) {
      const k = `${compactTermOf(t.from)}>${compactTermOf(t.to)}`
      const g = byKey.get(k)
      if (g) g.push(t)
      else byKey.set(k, [t])
    }
    const groups = [...byKey.values()]
    const per = Math.ceil(groups.length / Math.min(E_WAVES_MAX, groups.length))
    const tokens: ElectronToken[] = []
    groups.forEach((g, gi) => {
      for (const t of g) tokens.push({ from: t.from, to: t.to, n: t.n, wave: Math.floor(gi / per) })
    })
    return { tokens, waves: Math.ceil(groups.length / per), single: false }
  }
  const total = tr.reduce((s, t) => s + t.n, 0)
  const allInt = tr.every((t) => Math.abs(t.n - Math.round(t.n)) < 1e-6)
  const tokens: ElectronToken[] = []
  if (allInt && total <= E_SINGLE_MAX + 1e-9) {
    for (const t of tr) for (let q = 0; q < Math.round(t.n); q++) tokens.push({ from: t.from, to: t.to, n: 1, wave: tokens.length })
    return { tokens, waves: tokens.length, single: true }
  }
  if (!allInt && total <= E_SINGLE_MAX + 1e-9) {
    // дробные степени окисления (KO₂, Fe₃O₄ по средней): одна волна — подпись «e⁻ ×n» с целым n
    for (const t of tr) tokens.push({ from: t.from, to: t.to, n: t.n, wave: 0 })
    return { tokens, waves: 1, single: false }
  }
  const byTo = new Map<number, typeof tr[number][]>()
  for (const t of tr) {
    const g = byTo.get(t.to)
    if (g) g.push(t)
    else byTo.set(t.to, [t])
  }
  const groups = [...byTo.values()]
  const per = Math.ceil(groups.length / Math.min(E_WAVES_MAX, groups.length))
  groups.forEach((g, gi) => {
    for (const t of g) tokens.push({ from: t.from, to: t.to, n: t.n, wave: Math.floor(gi / per) })
  })
  return { tokens, waves: Math.ceil(groups.length / per), single: false }
}

/** Длительность шага переноса: подсветка ролей → полёты → пауза-акцент с карточкой полуреакций. */
const E_LEAD = 0.75
const E_HOLD = 1.9
const E_TRAVEL_SINGLE = 0.85
const E_GAP_SINGLE = 0.62
const E_TRAVEL_WAVE = 0.95
const E_GAP_WAVE = 0.85

function electronSchedule(plan: ReturnType<typeof planElectronTokens>, from: number): { list: StoryElectronSpec[]; waves: StoryWaveSpec[]; last: number } {
  const list: StoryElectronSpec[] = []
  const waves: StoryWaveSpec[] = []
  if (plan.single) {
    plan.tokens.forEach((tk, k) => {
      const t0 = from + E_LEAD + k * E_GAP_SINGLE
      list.push({ ...tk, t0, t1: t0 + E_TRAVEL_SINGLE })
      waves.push({ t0, t1: t0 + E_TRAVEL_SINGLE, n: tk.n, tokens: [k] })
    })
  } else {
    for (let w = 0; w < plan.waves; w++) {
      const idx = plan.tokens.map((tk, k) => (tk.wave === w ? k : -1)).filter((k) => k >= 0)
      const base = from + E_LEAD + w * E_GAP_WAVE
      const stag = Math.min(0.07, 0.35 / Math.max(1, idx.length))
      let t1w = base
      let nw = 0
      idx.forEach((k, q) => {
        const tk = plan.tokens[k]!
        const t0 = base + q * stag
        list[k] = { ...tk, t0, t1: t0 + E_TRAVEL_WAVE }
        t1w = Math.max(t1w, t0 + E_TRAVEL_WAVE)
        nw += tk.n
      })
      waves.push({ t0: base, t1: t1w, n: Math.round(nw * 1e6) / 1e6, tokens: idx })
    }
  }
  let last = from + E_LEAD
  for (const e of list) last = Math.max(last, e.t1)
  return { list, waves, last }
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

  // ——— доноры (степень окисления растёт) и акцепторы (падает) ———
  const donors: number[] = []
  const acceptors: number[] = []
  for (let i = 0; i < n; i++) {
    const d = R.atoms[story.map[i]!]!.ox - L.atoms[i]!.ox
    if (d > 1e-9) donors.push(i)
    else if (d < -1e-9) acceptors.push(i)
  }

  // ——— компактный вид огромных реакций: лицевая копия каждого члена + стопка ———
  const compact = n > (opts.lowPower ? STORY_COMPACT_ATOMS_LOW : STORY_COMPACT_ATOMS)
  const layerL = new Uint8Array(n)
  const layerR = new Uint8Array(n)
  let stackL: Stack | undefined
  let stackR: Stack | undefined
  if (compact) {
    const role = new Int8Array(n)
    for (const i of donors) role[i] = 1
    for (const i of acceptors) role[i] = -1
    // слева лицевая копия — та, где видны роли (у 10HNO₃ → NH₄NO₃ акцептор лишь в одной копии из десяти)
    stackL = pickStack(L, (u) => {
      let d = 0
      let a = 0
      let c = 0
      for (const i of u.atoms) {
        if (role[i]! > 0) d = 1
        else if (role[i]! < 0) a = 1
        if (role[i]) c++
      }
      return (d + a) * 1000 + c
    })
    const repAtoms = new Set<number>()
    for (const id of stackL.rep.values()) for (const i of L.units[id]!.atoms) repAtoms.add(i)
    // справа — копия, куда пришло больше всего атомов лицевых копий (меньше перелётов из стопки в стопку)
    stackR = pickStack(R, (u) => u.atoms.reduce((c, j) => c + (repAtoms.has(inv[j]!) ? 1 : 0), 0))
    for (let i = 0; i < n; i++) {
      layerL[i] = stackL.layer.get(L.atoms[i]!.unit) ?? 0
      layerR[i] = stackR.layer.get(R.atoms[story.map[i]!]!.unit) ?? 0
    }
  }
  const rowL = sideRow(L, leftTerms, rL, maxW, stackL)
  const rowR = sideRow(R, rightTerms, rR, maxW, stackR)

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
    if (f.length >= 2 && !f.some((i) => layerL[i]) && f.length < (L.units[L.atoms[f[0]!]!.unit]!.atoms.length || 0) + 1) {
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
        // заряд — только у целого иона (SO₄²⁻, OH⁻): кусок, вырванный из иона или молекулы (S и два O из SO₄²⁻ на
        // пути к SO₂), частицей с зарядом не бывает — «SO₂²⁺» в кадре было бы химической ошибкой
        const g0 = L.groups[L.atoms[f[0]!]!.group]!
        const wholeIon = g0.atoms.length === f.length && f.every((i) => L.atoms[i]!.group === g0.id)
        const ionish = (unit.kind === 'ionic' || unit.acid) && wholeIon
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
          if (fi === fj || layerL[i] || layerL[j]) continue
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

  // стопка при разрыве — целиком (без своего разлёта: копии рвутся по-разному, а повторять разлёт лицевой копии —
  // значит растянуть сохранённые связи стопки в длинные палочки), сдвиг — средний сдвиг лицевой копии
  if (stackL) {
    for (const [term, repId] of stackL.rep) {
      const f = L.units[repId]!
      const sh = [0, 0, 0]
      for (const b of f.atoms) for (let c = 0; c < 3; c++) sh[c]! += (p1[b * 3 + c]! - p0[b * 3 + c]!) / f.atoms.length
      for (const u of L.units) {
        if (u.term !== term || u.id === repId) continue
        for (const a of u.atoms) for (let c = 0; c < 3; c++) p1[a * 3 + c] = p0[a * 3 + c]! + sh[c]!
      }
    }
  }

  // ——— расписание шагов ———
  const T = STORY_TIMING
  const leftTermOf = (i: number) => L.units[L.atoms[i]!.unit]!.term
  const plan = planElectronTokens(story, compact ? leftTermOf : undefined)
  // шаг переноса — по числу волн: подсветка ролей, полёты по одному (или волнами), пауза-акцент
  const eSpan = plan.tokens.length === 0 ? 0 : plan.single ? (plan.waves - 1) * E_GAP_SINGLE + E_TRAVEL_SINGLE : (plan.waves - 1) * E_GAP_WAVE + E_TRAVEL_WAVE + 0.35
  const eDur = Math.max(T.electrons, E_LEAD + eSpan + E_HOLD)
  const steps: StoryStepTiming[] = []
  let t = 0
  for (const id of story.steps) {
    const dur = id === 'electrons' ? eDur : T[id]
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
      sticks.push({ a: b.a, b: b.b, order: b.order, kind: 'broken', t0, t1: t0 + 0.55 })
      bi++
    } else sticks.push({ a: b.a, b: b.b, order: b.order, kind: 'kept', t0: 0, t1: 0 })
  })

  // ——— образование: единицы продукта по очереди, связи — по одной после прихода атомов ———
  const moveFrom = new Float32Array(n)
  const moveDur = 1.15
  const runits = R.units
  const stagger = Math.min(0.26, 1.35 / Math.max(1, runits.length))
  const unitStart = new Map<number, number>()
  runits.forEach((u, k) => unitStart.set(u.id, sF.from + 0.2 + k * stagger))
  for (let i = 0; i < n; i++) moveFrom[i] = unitStart.get(R.atoms[story.map[i]!]!.unit) ?? sF.from + 0.2
  // новые связи — по одной (каждая с мягкой вспышкой в сцене): не раньше, чем пришли атомы её единицы, и не
  // раньше предыдущей + шаг; весь ряд укладывается в шаг «Образование»
  const formedList = story.bondsFormed
    .map((j) => {
      const b = R.bonds[j]!
      return { b, ready: (unitStart.get(R.atoms[b.a]!.unit) ?? sF.from) + moveDur * 0.8 }
    })
    .sort((x, y) => x.ready - y.ready)
  const fGap = formedList.length > 1 ? Math.min(0.2, Math.max(0.05, (sF.to - 0.45 - (formedList[0]?.ready ?? sF.from)) / (formedList.length - 1))) : 0
  let prevT0 = -Infinity
  for (const { b, ready } of formedList) {
    const t0 = Math.max(ready, prevT0 + fGap)
    prevT0 = t0
    sticks.push({ a: inv[b.a]!, b: inv[b.b]!, order: b.order, kind: 'formed', t0, t1: t0 + 0.32 })
  }

  // Сохранённая связь, у которой меняется кратность (SO₃ + H₂O: S=O → S–OH): старая кратность гаснет, когда
  // единица продукта собирается, новая — проявляется (иначе в H₂SO₄ осталась бы лишняя двойная связь).
  L.bonds.forEach((b, i) => {
    if (sticks[i]!.kind !== 'kept') return
    const ra = story.map[b.a]!
    const rb = story.map[b.b]!
    const rBond = R.bonds.find((x) => (x.a === ra && x.b === rb) || (x.a === rb && x.b === ra))
    if (!rBond || rBond.order === b.order) return
    const t0 = (unitStart.get(R.atoms[ra]!.unit) ?? sF.from) + moveDur * 0.8
    sticks[i] = { a: b.a, b: b.b, order: b.order, kind: 'broken', t0, t1: t0 + 0.35 }
    sticks.push({ a: b.a, b: b.b, order: rBond.order, kind: 'formed', t0: t0 + 0.2, t1: t0 + 0.55 })
  })

  // ——— судьба продуктов: газ ↑, осадок ↓ ———
  const p4 = new Float32Array(p3)
  const fateFrom = sF.to - 0.9
  const fateTo = sF.to + 0.5
  const termOfRightAtom = (j: number) => R.units[R.atoms[j]!.unit]!.term
  // Член уходит целиком: газ — вверх, осадок и металл — вниз, на наибольший сдвиг, при котором он не налезает
  // на другие продукты (в два ряда газ иначе «въезжал» в продукты верхнего ряда).
  {
    const termOfAtom = Array.from({ length: n }, (_, i) => termOfRightAtom(story.map[i]!))
    const moving = new Map<number, number[]>()
    for (let i = 0; i < n; i++) {
      const fate = story.terms[termOfAtom[i]!]!.fate
      if (fate === 'gas' || fate === 'precipitate' || fate === 'deposit') {
        const g = moving.get(termOfAtom[i]!)
        if (g) g.push(i)
        else moving.set(termOfAtom[i]!, [i])
      }
    }
    for (const [term, ids] of moving) {
      const up = story.terms[term]!.fate === 'gas'
      const tries = up ? [1.05, 0.85, 0.65, 0.45, 0.3, 0.18] : [-0.75, -0.6, -0.45, -0.3, -0.18]
      const fits = (dy: number) => {
        for (const i of ids) {
          for (let j = 0; j < n; j++) {
            if (termOfAtom[j] === term) continue
            const d = Math.hypot(p3[i * 3]! - p4[j * 3]!, p3[i * 3 + 1]! + dy - p4[j * 3 + 1]!)
            if (d < radiusR[i]! + radiusR[j]! + 0.1) return false
          }
        }
        return true
      }
      const dy = tries.find(fits) ?? 0
      for (const i of ids) p4[i * 3 + 1] = p3[i * 3 + 1]! + dy
    }
  }

  // ——— электроны ———
  const flipAt = new Float32Array(n).fill(Number.POSITIVE_INFINITY)
  const sched = sE ? electronSchedule(plan, sE.from) : { list: [], waves: [], last: 0 }
  const electrons: StoryElectronSpec[] = sched.list
  if (sE) {
    // донор меняет подпись, когда ушёл его последний электрон; акцептор — когда пришёл последний
    const lastFrom = new Map<number, number>()
    const lastTo = new Map<number, number>()
    for (const e of electrons) {
      lastFrom.set(e.from, Math.max(lastFrom.get(e.from) ?? 0, e.t0 + 0.15))
      lastTo.set(e.to, Math.max(lastTo.get(e.to) ?? 0, e.t1))
    }
    for (const [a, tt] of lastFrom) flipAt[a] = tt
    for (const [a, tt] of lastTo) flipAt[a] = tt
    // все переносы показаны (по одному или волнами), но на всякий случай: атом без своей точки — к паузе-акценту
    for (const c of [...story.oxidations, ...story.reductions]) for (const a of c.atoms) if (!Number.isFinite(flipAt[a]!)) flipAt[a] = sched.last
  }
  // сохранённые многоатомные группы (переходят целиком — общая подсветка)
  const keptGroups = story.conserved
    .map(([gl, gr]) => ({ atoms: L.groups[gl]!.atoms.slice(), label: R.groups[gr]!.label }))
    .filter((g) => g.atoms.length >= 2)

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
  // поля: сверху — подписи групп и чипы степеней окисления (у ОВР — ещё карточка полуреакций), снизу — подписи членов
  const top = maxY + (story.redox ? 1.35 : 0.7)
  const bottom = minY - 0.8
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
    waves: sched.waves,
    eSingle: plan.single,
    eOn: sE ? sE.from : Infinity,
    eOff: sE ? sE.to : Infinity,
    eLastArrive: sE ? sched.last : Infinity,
    donors,
    acceptors,
    keptGroups,
    formFrom: sF.from,
    formTo: sF.to,
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
    compact,
    layerL,
    layerR,
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
