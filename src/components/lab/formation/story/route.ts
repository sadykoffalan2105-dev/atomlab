import type { FormationPlan } from '../../../../chemistry/formationPlan'
import type { FormationRouteKind, FormationScript } from '../../../../chemistry/formationScripts'
import { schoolBallRadius, type SchoolHeroModel, type V3 } from '../../hero/schoolHeroModel'
import { SCHOOL_DRAW } from '../../../../lab/cinema/scenes/school/schoolModel'
import type { ElementSymbol } from '../../../../chemistry/data/atomicData'
import { buildMoreScene, type MoreShow, type SceneKit } from './routeMore'

/**
 * Этап «Путь получения» на уровне частиц (formationScript(id).routeKind; правила — docs/plans/formation200-rules.md,
 * IC п. 1 «что показать особо»). Отдельная маленькая сцена в центре кадра (исходные вещества стоят кольцом вокруг):
 *  neutralization — H⁺ + OH⁻ → H₂O (пара O уходит к H⁺), ионы соли остаются;
 *  protonTransfer — NH₃ + H⁺ → NH₄⁺: неподелённая пара N становится общей (донорно-акцепторная связь);
 *  hydration — молекулы H₂O поворачиваются кислородом (δ−) к катиону и подходят к нему;
 *  exchange — ионы двух растворов встречаются: осадок (ионы продукта) собирается, ионы-«зрители» остаются в растворе;
 *  oxideWater (основный оксид) — O²⁻ + H₂O → 2OH⁻ (протон переходит от воды к O²⁻);
 *  baseAcidOxide (основный оксид + CO₂/SO₂/SiO₂) — пара O²⁻ присоединяется к C / S / Si, получается XO₃²⁻.
 * Остальные виды пути (разложение, обезвоживание, ОВР, кислотный оксид + вода, щёлочь + кислотный оксид, смесь,
 * основный оксид + кислота, кислота из соли, сближение молекул) — routeMore.ts (buildMoreScene), в том числе у молекул.
 * Без сцены — только 'elements' / 'atoms': там путь — это сами этапы (простые вещества → атомы → связи).
 * Все положения строятся в плоскости экрана (x вправо, y вверх, z к зрителю) и переводятся в координаты модели.
 */

export type Tri = [string, string, string]
export type RouteKey = [number, V3]
/** q / qKind (добавлено): начальный заряд иона ('ion') или степень окисления ('ox') — подпись; смены — story.chargeSteps */
export type RouteAtom = { el: string; r: number; keys: RouteKey[]; tIn: number; tOut: number; q?: number; qKind?: 'ion' | 'ox' }
/** n / s (добавлено): кратность связи и номер палочки (O=O — две палочки: s = 0, 1; n = 2); нет — одинарная */
export type RouteStick = { a: number; b: number; t0: number; t1: number; tOut: number; n?: number; s?: number }
/** kind / from / to (добавлено): 'transfer' — перенос e⁻ от атома from к атому to (индексы routeStage.atoms) */
export type RouteElectron = { keys: RouteKey[]; tIn: number; tOut: number; kind?: 'transfer'; from?: number; to?: number }
export type RouteBadge = { text: string; atoms: number[]; from: number; to: number }
export type RouteShow = 'neutralization' | 'protonTransfer' | 'hydration' | 'exchange' | 'oxideWater' | 'baseAcidOxide' | MoreShow

export type RouteStage = {
  kind: FormationRouteKind
  /** что показано на уровне частиц (ключ подписи) */
  show: RouteShow
  /** уравнение пути (как в таблице правил) */
  equation: string
  /** подпись этапа (RU / EN / UZ) — заголовок и фраза учителя */
  title: Tri
  text: Tri
  t0: number
  dur: number
  atoms: RouteAtom[]
  sticks: RouteStick[]
  electrons: RouteElectron[]
  badges: RouteBadge[]
}

export const ROUTE_DUR = 7

/** Положение по ключам (линейно со сглаживанием между ключами). */
export function routeKeyAt(keys: RouteKey[], t: number, out: V3): V3 {
  const k0 = keys[0]!
  if (t <= k0[0] || keys.length === 1) {
    out[0] = k0[1][0]
    out[1] = k0[1][1]
    out[2] = k0[1][2]
    return out
  }
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1]!
    const b = keys[i]!
    if (t < b[0]) {
      const x = (t - a[0]) / Math.max(1e-6, b[0] - a[0])
      const u = x * x * (3 - 2 * x)
      for (let q = 0; q < 3; q++) out[q] = a[1][q]! + (b[1][q]! - a[1][q]!) * u
      return out
    }
  }
  const z = keys[keys.length - 1]!
  out[0] = z[1][0]
  out[1] = z[1][1]
  out[2] = z[1][2]
  return out
}

const deg = Math.PI / 180

type Ctx = {
  T: number
  D: number
  toModel: (s: V3) => V3
  atoms: RouteAtom[]
  sticks: RouteStick[]
  electrons: RouteElectron[]
  badges: RouteBadge[]
  rOf: (el: string) => number
}

function atom(c: Ctx, el: string, keys: [number, V3][], tIn?: number, tOut?: number, r?: number): number {
  c.atoms.push({ el, r: r ?? c.rOf(el), keys: keys.map(([t, p]) => [t, p] as RouteKey), tIn: tIn ?? c.T + 0.2, tOut: tOut ?? c.T + c.D - 0.4 })
  return c.atoms.length - 1
}

const plus = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]
const dirA = (a: number): V3 => [Math.cos(a), Math.sin(a), 0]

/** Многоатомная частица модели (ион): атомы относительно центра + связи внутри. */
function unitTpl(model: SchoolHeroModel, atoms: number[]) {
  const c: V3 = [0, 0, 0]
  for (const a of atoms) for (let q = 0; q < 3; q++) c[q] += model.atoms[a]!.pos[q]! / atoms.length
  const set = new Set(atoms)
  return {
    atoms: atoms.map((a) => ({ el: model.atoms[a]!.el as string, rel: [model.atoms[a]!.pos[0] - c[0], model.atoms[a]!.pos[1] - c[1], model.atoms[a]!.pos[2] - c[2]] as V3, r: model.atoms[a]!.r })),
    bonds: model.bonds.filter((b) => set.has(b.a) && set.has(b.b)).map((b) => [atoms.indexOf(b.a), atoms.indexOf(b.b)] as [number, number]),
    ext: Math.max(...atoms.map((a) => Math.hypot(model.atoms[a]!.pos[0] - c[0], model.atoms[a]!.pos[1] - c[1], model.atoms[a]!.pos[2] - c[2]) + model.atoms[a]!.r)),
  }
}

/** Частица-шаблон по ключам центра (в координатах модели шаблон не поворачиваем — как в модели карточки). */
function placeTpl(c: Ctx, tpl: ReturnType<typeof unitTpl>, keys: [number, V3][], tIn?: number, tOut?: number): number[] {
  const ids = tpl.atoms.map((a) => {
    const relScr = a.rel
    return atom(
      c,
      a.el,
      keys.map(([t, p]) => [t, plus(c.toModel(p), relScr)] as [number, V3]),
      tIn,
      tOut,
      a.r,
    )
  })
  // Ключи переведены в модель отдельно: помечаем, чтобы не переводить второй раз.
  for (const i of ids) (c.atoms[i] as RouteAtom & { model?: boolean }).model = true
  for (const [x, y] of tpl.bonds) c.sticks.push({ a: ids[x]!, b: ids[y]!, t0: (tIn ?? c.T + 0.2) - 0.01, t1: tIn ?? c.T + 0.2, tOut: tOut ?? c.T + c.D - 0.4 })
  return ids
}

const SUP: Record<string, string> = { '+': '⁺', '-': '⁻', '1': '¹', '2': '²', '3': '³', '4': '⁴' }
const ionText = (f: string, q: number) => `${f}${Math.abs(q) === 1 ? '' : SUP[String(Math.abs(q))]}${q > 0 ? '⁺' : '⁻'}`

/** «Зрители» обмена: второй продукт вида NaCl, 2KCl, Na₂SO₄, 2NaNO₃ → [катион, анион]. */
function spectatorsOf(route: string, product: string): { cat: [string, string]; an: [string, string] } | null {
  const right = route.split(/→|⇄/)[1]
  if (!right) return null
  for (const raw of right.split(' + ')) {
    const f = raw.trim().replace(/^\d+/, '')
    if (f === product) continue
    const m = /^(Na|K|Li|Ag)(₂|₃)?(Cl|Br|I|NO₃|SO₄|PO₄)$/.exec(f)
    if (!m) continue
    const an = m[3]!
    const q = an === 'SO₄' ? 2 : an === 'PO₄' ? 3 : 1
    const anEl = an === 'NO₃' ? 'N' : an === 'SO₄' ? 'S' : an === 'PO₄' ? 'P' : an
    return { cat: [m[1]!, `${m[1]}⁺`], an: [anEl, ionText(an, -q)] }
  }
  return null
}

const TEXT: Record<Exclude<RouteShow, MoreShow>, { title: Tri; text: Tri }> = {
  neutralization: {
    title: ['Путь: нейтрализация', 'Route: neutralization', 'Yoʻl: neytrallanish'],
    text: [
      'Кислота даёт ион H⁺, основание — ион OH⁻. Неподелённая пара кислорода OH⁻ становится общей с H⁺: H⁺ + OH⁻ → H₂O. Ионы металла и кислотного остатка остаются — из них и собирается соль.',
      'The acid gives an H⁺ ion, the base an OH⁻ ion. A lone pair of the OH⁻ oxygen becomes shared with H⁺: H⁺ + OH⁻ → H₂O. The metal ions and the acid-residue ions remain — the salt is built from them.',
      'Kislota H⁺ ionini, asos OH⁻ ionini beradi. OH⁻ kislorodining boʻlinmagan jufti H⁺ bilan umumiy boʻladi: H⁺ + OH⁻ → H₂O. Metall ionlari va kislota qoldigʻi ionlari qoladi — tuz ulardan yigʻiladi.',
    ],
  },
  protonTransfer: {
    title: ['Путь: ион аммония', 'Route: the ammonium ion', 'Yoʻl: ammoniy ioni'],
    text: [
      'У азота в NH₃ есть неподелённая пара электронов, у H⁺ — свободная орбиталь. Пара азота становится общей: NH₃ + H⁺ → NH₄⁺ — донорно-акцепторный механизм (Kimyo 8, § 15). Все четыре связи N–H после этого одинаковы.',
      'Nitrogen in NH₃ has a lone pair, H⁺ has an empty orbital. The nitrogen pair becomes shared: NH₃ + H⁺ → NH₄⁺ — the donor–acceptor mechanism (Kimyo 8, § 15). Afterwards all four N–H bonds are the same.',
      'NH₃ dagi azotda boʻlinmagan elektron jufti, H⁺ da boʻsh orbital bor. Azot jufti umumiy boʻladi: NH₃ + H⁺ → NH₄⁺ — donor-akseptor mexanizm (Kimyo 8, § 15). Shundan soʻng toʻrtala N–H bogʻ bir xil.',
    ],
  },
  hydration: {
    title: ['Путь: присоединение воды', 'Route: water joins the salt', 'Yoʻl: suv birikishi'],
    text: [
      'Молекула воды полярна: на кислороде δ−, на водородах δ+. Молекулы H₂O поворачиваются кислородом к катиону металла и встраиваются в кристалл — получается кристаллогидрат.',
      'The water molecule is polar: δ− on oxygen, δ+ on the hydrogens. H₂O molecules turn their oxygen towards the metal cation and enter the crystal — a crystal hydrate forms.',
      'Suv molekulasi qutbli: kislorodda δ−, vodorodlarda δ+. H₂O molekulalari kislorodi bilan metall kationiga buriladi va kristallga kiradi — kristallogidrat hosil boʻladi.',
    ],
  },
  exchange: {
    title: ['Путь: обмен ионами в растворе', 'Route: ion exchange in solution', 'Yoʻl: eritmada ion almashinuvi'],
    text: [
      'В растворах вещества уже распались на ионы. Ионы будущего продукта встречаются и связываются (осадок, газ или слабый электролит), а ионы-«зрители» остаются в растворе.',
      'In the solutions the substances are already split into ions. The ions of the product meet and bind (a precipitate, a gas or a weak electrolyte), while the “spectator” ions stay in solution.',
      'Eritmalarda moddalar allaqachon ionlarga ajralgan. Mahsulot ionlari uchrashib bogʻlanadi (choʻkma, gaz yoki kuchsiz elektrolit), «tomoshabin» ionlar esa eritmada qoladi.',
    ],
  },
  oxideWater: {
    title: ['Путь: оксид + вода', 'Route: oxide + water', 'Yoʻl: oksid + suv'],
    text: [
      'Ион O²⁻ основного оксида отнимает у молекулы воды протон H⁺: O²⁻ + H₂O → 2OH⁻. Получаются гидроксид-ионы — основание.',
      'The O²⁻ ion of the basic oxide takes a proton H⁺ from a water molecule: O²⁻ + H₂O → 2OH⁻. Hydroxide ions form — a base.',
      'Asosli oksidning O²⁻ ioni suv molekulasidan H⁺ protonini oladi: O²⁻ + H₂O → 2OH⁻. Gidroksid ionlari — asos hosil boʻladi.',
    ],
  },
  baseAcidOxide: {
    title: ['Путь: основный оксид + кислотный оксид', 'Route: basic oxide + acidic oxide', 'Yoʻl: asosli oksid + kislotali oksid'],
    text: [
      'Ион O²⁻ основного оксида отдаёт свою пару электронов атому неметалла кислотного оксида. Молекула XO₂ становится плоским ионом XO₃²⁻ — кислотным остатком соли.',
      'The O²⁻ ion of the basic oxide gives its electron pair to the non-metal atom of the acidic oxide. The XO₂ molecule turns into the flat XO₃²⁻ ion — the acid residue of the salt.',
      'Asosli oksidning O²⁻ ioni oʻz elektron juftini kislotali oksiddagi nometall atomiga beradi. XO₂ molekulasi yassi XO₃²⁻ ioniga — tuzning kislota qoldigʻiga aylanadi.',
    ],
  },
}

export function buildRouteStage(
  script: FormationScript | null,
  plan: FormationPlan,
  model: SchoolHeroModel,
  toModel: (s: V3) => V3,
  t0: number,
  fitR: number,
): RouteStage | null {
  if (!script || script.routeKind === 'elements' || script.routeKind === 'atoms') return null
  const rk = script.routeKind
  const route = script.route
  // Шары — школьные радиусы (ковалентный × ballScale), расстояния — как в моделях карточки: (r₁ + r₂) / ballScale.
  const rOf = (el: string) => schoolBallRadius(el as ElementSymbol)
  const rO = schoolBallRadius('O' as ElementSymbol)
  const rH = schoolBallRadius('H' as ElementSymbol)
  const S = 1 / SCHOOL_DRAW.ballScale
  // Масштаб сцены: «длина связи» O–H = b; вся сцена — в круге ~0,7 радиуса кольца исходных веществ.
  let b = (rO + rH) * S
  b = Math.min(b, (0.7 * fitR) / 4.2)
  const kR = b / ((rO + rH) * S)
  const c: Ctx = { T: t0, D: ROUTE_DUR, toModel, atoms: [], sticks: [], electrons: [], badges: [], rOf: (el) => rOf(el) * kR }
  const T = t0
  const D = ROUTE_DUR
  const end = T + D - 0.4
  const cations = plan.units.filter((u) => plan.species[u.species]!.charge > 0)
  const anions = plan.units.filter((u) => plan.species[u.species]!.charge < 0)
  const spOf = (u: (typeof plan.units)[number]) => plan.species[u.species]!
  let show: RouteShow | null = null

  if (rk === 'neutralization' && cations.length && anions.length) {
    show = 'neutralization'
    const s52 = Math.sin(52 * deg)
    const c52 = Math.cos(52 * deg)
    const hp = atom(c, 'H', [[T + 0.6, [-3.2 * b, 0.4 * b, 0]], [T + 3.0, [-b * s52, -b * c52, 0]], [T + 3.8, [-b * s52, -b * c52, 0]], [T + D - 0.6, [-b * s52, 1.6 * b - b * c52, 0]]])
    const o = atom(c, 'O', [[T + 0.6, [3.2 * b, 0, 0]], [T + 3.0, [0, 0, 0]], [T + 3.8, [0, 0, 0]], [T + D - 0.6, [0, 1.6 * b, 0]]])
    const h = atom(c, 'H', [[T + 0.6, [3.2 * b + b * s52, -b * c52, 0]], [T + 3.0, [b * s52, -b * c52, 0]], [T + 3.8, [b * s52, -b * c52, 0]], [T + D - 0.6, [b * s52, 1.6 * b - b * c52, 0]]])
    c.sticks.push({ a: o, b: h, t0: T + 0.19, t1: T + 0.2, tOut: end }, { a: o, b: hp, t0: T + 3.1, t1: T + 3.7, tOut: end })
    // Неподелённая пара O → общая пара O–H.
    const eOff = 0.18 * b
    for (const s of [-1, 1]) {
      c.electrons.push({
        keys: [
          [T + 0.6, [3.2 * b - 0.75 * b, s * eOff, 0]],
          [T + 2.4, [-0.75 * b, s * eOff, 0]],
          [T + 3.4, [(-b * s52) / 2 + s * 0.08 * b, (-b * c52) / 2, 0]],
        ],
        tIn: T + 1.0,
        tOut: T + 3.7,
      })
    }
    c.badges.push({ text: 'H⁺', atoms: [hp], from: T + 0.3, to: T + 3.0 }, { text: 'OH⁻', atoms: [o, h], from: T + 0.3, to: T + 3.0 }, { text: 'H₂O', atoms: [o, h, hp], from: T + 3.4, to: end })
    // Ионы соли — остаются (зрители реакции нейтрализации): катион слева внизу, анион справа внизу.
    const cu = cations[0]!
    const an = anions[0]!
    const ct = unitTpl(model, cu.atoms)
    const at = unitTpl(model, an.atoms)
    const ci = placeTpl(c, scaleTpl(ct, kR), [[T, [-2.6 * b, -2.8 * b, 0]], [T + D, [-2.2 * b, -2.4 * b, 0]]])
    const ai = placeTpl(c, scaleTpl(at, kR), [[T, [2.9 * b, -2.8 * b, 0]], [T + D, [2.5 * b, -2.4 * b, 0]]])
    c.badges.push({ text: spOf(cu).formula, atoms: ci, from: T + 0.3, to: end }, { text: spOf(an).formula, atoms: ai, from: T + 0.3, to: end })
  } else if (rk === 'protonTransfer' && /NH₃/.test(route) && plan.species.some((s) => s.formula === 'NH₄⁺')) {
    show = 'protonTransfer'
    const N: V3 = [0, -0.4 * b, 0]
    const n = atom(c, 'N', [[T, N]])
    const hs: number[] = []
    for (const phi of [90, 210, 330]) {
      const d: V3 = [Math.sin(109.5 * deg) * Math.cos(phi * deg), Math.cos(109.5 * deg), Math.sin(109.5 * deg) * Math.sin(phi * deg)]
      hs.push(atom(c, 'H', [[T, plus(N, d, b)]]))
    }
    for (const h of hs) c.sticks.push({ a: n, b: h, t0: T + 0.19, t1: T + 0.2, tOut: end })
    const HT: V3 = plus(N, [0, 1, 0], b)
    const withCl = /HCl/.test(route)
    const hp = atom(c, 'H', [[T + 1.0, [0, 3.4 * b, 0]], [T + 3.0, HT]])
    if (withCl) {
      const cl = atom(c, 'Cl', [[T + 1.0, [0, 3.4 * b + 1.3 * b, 0]], [T + 2.0, [0.4 * b, 3.3 * b + 1.3 * b, 0]], [T + 3.4, [2.6 * b, 3.0 * b, 0]]])
      c.sticks.push({ a: hp, b: cl, t0: T + 0.19, t1: T + 0.2, tOut: T + 1.9 })
      c.badges.push({ text: 'HCl', atoms: [hp, cl], from: T + 0.3, to: T + 1.6 }, { text: 'Cl⁻', atoms: [cl], from: T + 2.2, to: end })
    }
    c.sticks.push({ a: n, b: hp, t0: T + 3.0, t1: T + 3.7, tOut: end })
    for (const s of [-1, 1]) {
      c.electrons.push({
        keys: [
          [T + 0.6, plus(N, [s * 0.16 * b, 0.62 * b, 0.1 * b])],
          [T + 2.4, plus(N, [s * 0.16 * b, 0.62 * b, 0.1 * b])],
          [T + 3.3, plus(N, [s * 0.1 * b, 0.5 * b, 0.1 * b])],
        ],
        tIn: T + 0.6,
        tOut: T + 3.8,
      })
    }
    c.badges.push({ text: 'NH₃', atoms: [n, ...hs], from: T + 0.3, to: T + 3.0 }, { text: 'H⁺', atoms: [hp], from: T + 1.9, to: T + 3.0 }, { text: 'NH₄⁺', atoms: [n, ...hs, hp], from: T + 3.5, to: end })
  } else if (rk === 'hydration' && cations.length) {
    show = 'hydration'
    const cu = [...cations].sort((a, b2) => spOf(b2).charge - spOf(a).charge)[0]!
    const csp = spOf(cu)
    const cEl = model.atoms[cu.atoms[0]!]!.el as string
    const nWaterAll = plan.units.filter((u) => spOf(u).formula === 'H₂O').length
    const nW = cEl === 'Cu' ? 4 : cEl === 'Ca' ? 2 : Math.min(6, nWaterAll)
    // Катион — радиус иона из модели карточки (Cu²⁺ меньше атома Cu).
    const rC = (model.atoms[cu.atoms[0]!]!.r ?? rOf(cEl)) * kR
    const k = atom(c, cEl, [[T, [0, 0, 0]]], undefined, undefined, rC)
    const dirs: V3[] = nW === 2 ? [[1, 0, 0], [-1, 0, 0]] : nW === 3 ? [[1, 0, 0], [-0.5, 0.866, 0], [-0.5, -0.866, 0]] : nW === 4 ? [[1, 0, 0], [0, 1, 0], [-1, 0, 0], [0, -1, 0]] : [[1, 0, 0], [0, 1, 0], [-1, 0, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].slice(0, nW) as V3[]
    const ids: number[] = [k]
    dirs.forEach((d, i) => {
      const near = (rC + c.rOf('O')) * S * 0.9
      const lag = 0.25 * i
      // перпендикуляр к d в плоскости (для «поворота» молекулы)
      const p: V3 = Math.abs(d[2]) > 0.5 ? [1, 0, 0] : [-d[1], d[0], 0]
      const Hs = (O: V3, dir: V3, side: number): V3 => plus(O, [dir[0] * Math.cos(52 * deg) + p[0] * side * Math.sin(52 * deg), dir[1] * Math.cos(52 * deg) + p[1] * side * Math.sin(52 * deg), dir[2] * Math.cos(52 * deg) + p[2] * side * Math.sin(52 * deg)], b)
      const far = (s: number): V3 => plus([0, 0, 0], d, s * b)
      const toward: V3 = [-d[0], -d[1], -d[2]]
      const o = atom(c, 'O', [[T + 0.4 + lag, far(4.0)], [T + 1.5 + lag, far(3.5)], [T + 2.5 + lag, far(3.0)], [T + 4.0 + lag, plus([0, 0, 0], d, near)]])
      const hh = [-1, 1].map((side) =>
        atom(c, 'H', [
          [T + 0.4 + lag, Hs(far(4.0), toward, side)],
          [T + 1.5 + lag, Hs(far(3.5), p, side)],
          [T + 2.5 + lag, Hs(far(3.0), d, side)],
          [T + 4.0 + lag, Hs(plus([0, 0, 0], d, near), d, side)],
        ]),
      )
      for (const h of hh) c.sticks.push({ a: o, b: h, t0: T + 0.19, t1: T + 0.2, tOut: end })
      ids.push(o, ...hh)
      if (i === 0) c.badges.push({ text: 'H₂O', atoms: [o, ...hh], from: T + 0.4, to: T + 3.0 })
    })
    const q = csp.charge
    const complex = nW >= 4 ? `[${cEl}(H₂O)${nW === 4 ? '₄' : '₆'}]${q === 1 ? '⁺' : q === 2 ? '²⁺' : '³⁺'}` : `${csp.formula} · ${nW}H₂O`
    c.badges.push({ text: csp.formula, atoms: [k], from: T + 0.3, to: T + 4.0 }, { text: complex, atoms: ids, from: T + 4.4, to: end })
  } else if (rk === 'exchange' && cations.length && anions.length) {
    show = 'exchange'
    const cu = cations[0]!
    const an = [...anions].sort((a, b2) => spOf(b2).charge - spOf(a).charge)[0]!
    const ct = scaleTpl(unitTpl(model, cu.atoms), kR)
    const at = scaleTpl(unitTpl(model, an.atoms), kR)
    const dd = Math.max(ct.ext + at.ext, 1.2 * b)
    const ci = placeTpl(c, ct, [[T + 0.8, [-3.3 * b, 0.9 * b, 0]], [T + 3.4, [-0.5 * dd, 0, 0]]])
    const ai = placeTpl(c, at, [[T + 0.8, [3.3 * b, -0.9 * b, 0]], [T + 3.4, [0.5 * dd, 0, 0]]])
    const spec = spectatorsOf(route, script.formula)
    if (spec) {
      // «зрители» — в стороне от пути ионов продукта (не задевают их при сближении)
      const sc = atom(c, spec.cat[0], [[T + 0.8, [3.4 * b, 2.6 * b, 0]], [T + 3.6, [2.6 * b, 2.6 * b, 0]]])
      const sa = atom(c, spec.an[0], [[T + 0.8, [-3.4 * b, -2.6 * b, 0]], [T + 3.6, [-2.6 * b, -2.6 * b, 0]]])
      c.badges.push({ text: spec.cat[1], atoms: [sc], from: T + 0.3, to: end }, { text: spec.an[1], atoms: [sa], from: T + 0.3, to: end })
    }
    c.badges.push({ text: spOf(cu).formula, atoms: ci, from: T + 0.3, to: T + 3.4 }, { text: spOf(an).formula, atoms: ai, from: T + 0.3, to: T + 3.4 }, { text: `${script.formula}`, atoms: [...ci, ...ai], from: T + 3.7, to: end })
  } else if (rk === 'oxideWater' && /^[A-Z][a-z]?₂?O \+ H₂O/.test(route)) {
    show = 'oxideWater'
    const s52 = Math.sin(52 * deg)
    const c52 = Math.cos(52 * deg)
    const ox = atom(c, 'O', [[T + 0.5, [-3.0 * b, 0, 0]], [T + 2.4, [-1.9 * b, 0, 0]], [T + 4.2, [-1.9 * b, 0, 0]], [T + D - 0.6, [-2.8 * b, -0.3 * b, 0]]])
    const ow = atom(c, 'O', [[T + 0.5, [2.6 * b, 0, 0]], [T + 2.4, [0.3 * b, 0, 0]], [T + 4.2, [0.3 * b, 0, 0]], [T + D - 0.6, [1.6 * b, 0.3 * b, 0]]])
    const ha = atom(c, 'H', [[T + 0.5, [2.6 * b - b * s52, b * c52, 0]], [T + 2.4, [0.3 * b - b * s52, b * c52, 0]], [T + 3.6, [-1.9 * b + b, 0.05 * b, 0]], [T + 4.2, [-1.9 * b + b, 0, 0]], [T + D - 0.6, [-1.8 * b, -0.3 * b, 0]]])
    const hb = atom(c, 'H', [[T + 0.5, [2.6 * b + b * s52, b * c52, 0]], [T + 2.4, [0.3 * b + b * s52, b * c52, 0]], [T + 4.2, [0.3 * b + b, 0, 0]], [T + D - 0.6, [2.6 * b, 0.3 * b, 0]]])
    c.sticks.push({ a: ow, b: hb, t0: T + 0.19, t1: T + 0.2, tOut: end }, { a: ow, b: ha, t0: T + 0.19, t1: T + 0.2, tOut: T + 3.0 }, { a: ox, b: ha, t0: T + 3.3, t1: T + 4.0, tOut: end })
    c.badges.push({ text: 'O²⁻', atoms: [ox], from: T + 0.3, to: T + 3.6 }, { text: 'H₂O', atoms: [ow, ha, hb], from: T + 0.3, to: T + 2.8 }, { text: 'OH⁻', atoms: [ox, ha], from: T + 4.2, to: end }, { text: 'OH⁻', atoms: [ow, hb], from: T + 4.2, to: end })
  } else if (rk === 'baseAcidOxide' && /^[A-Z][a-z]?₂?O \+ (C|S)O₂|^(C|S)O₂ \+ [A-Z][a-z]?₂?O /.test(route)) {
    show = 'baseAcidOxide'
    const X = /(Si|C|S)O₂/.exec(route)![1]!
    const bent = X === 'S'
    const bx = (c.rOf(X) + c.rOf('O')) * S
    const x = atom(c, X, [[T, [0.6 * b, 0, 0]]])
    // O=X=O (линейная у CO₂/SiO₂, уголок у SO₂) → плоский XO₃²⁻ (120°)
    const oa = atom(c, 'O', [[T + 0.5, bent ? plus([0.6 * b, 0, 0], dirA(150 * deg), bx) : plus([0.6 * b, 0, 0], [0, 1, 0], bx)], [T + 2.6, bent ? plus([0.6 * b, 0, 0], dirA(150 * deg), bx) : plus([0.6 * b, 0, 0], [0, 1, 0], bx)], [T + 4.0, plus([0.6 * b, 0, 0], dirA(60 * deg), bx)]])
    const ob = atom(c, 'O', [[T + 0.5, bent ? plus([0.6 * b, 0, 0], dirA(-150 * deg), bx) : plus([0.6 * b, 0, 0], [0, -1, 0], bx)], [T + 2.6, bent ? plus([0.6 * b, 0, 0], dirA(-150 * deg), bx) : plus([0.6 * b, 0, 0], [0, -1, 0], bx)], [T + 4.0, plus([0.6 * b, 0, 0], dirA(-60 * deg), bx)]])
    const ox = atom(c, 'O', [[T + 0.5, [-3.2 * b, 0, 0]], [T + 3.0, [0.6 * b - bx, 0, 0]]])
    c.sticks.push({ a: x, b: oa, t0: T + 0.19, t1: T + 0.2, tOut: end }, { a: x, b: ob, t0: T + 0.19, t1: T + 0.2, tOut: end }, { a: x, b: ox, t0: T + 3.0, t1: T + 3.7, tOut: end })
    for (const s of [-1, 1])
      c.electrons.push({ keys: [[T + 0.8, [-3.2 * b + 0.6 * b, s * 0.15 * b, 0]], [T + 2.4, [0.6 * b - bx + 0.5 * b, s * 0.15 * b, 0]], [T + 3.4, [0.6 * b - bx / 2, s * 0.08 * b, 0]]], tIn: T + 0.8, tOut: T + 3.8 })
    c.badges.push({ text: 'O²⁻', atoms: [ox], from: T + 0.3, to: T + 3.0 }, { text: `${X}O₂`, atoms: [x, oa, ob], from: T + 0.3, to: T + 3.0 }, { text: `${X}O₃²⁻`, atoms: [x, oa, ob, ox], from: T + 3.6, to: end })
  }
  let more: { title: Tri; text: Tri } | null = null
  if (!show) {
    // Остальные виды пути: строитель сцены в долях b от начала этапа (routeMore.ts).
    const hide: [number, number][] = []
    const kit: SceneKit & { _hide?: [number, number][] } = {
      b,
      bl: (x, y) => ((c.rOf(x) + c.rOf(y)) * S) / b,
      A: (el, keys, tIn, tOut, r) =>
        atom(
          c,
          el,
          keys.map(([tt, x, y, z]) => [T + tt, [x * b, y * b, (z ?? 0) * b]] as [number, V3]),
          tIn != null ? T + tIn : undefined,
          tOut != null ? T + tOut : undefined,
          r != null ? r * b : undefined,
        ),
      S: (a, b2, t0 = -1, t1, tOut) => {
        const s0 = t0 < 0 ? T + 0.19 : T + t0
        const s1 = t0 < 0 ? T + 0.2 : T + (t1 ?? t0 + 0.6)
        c.sticks.push({ a, b: b2, t0: s0, t1: s1, tOut: tOut != null ? T + tOut : end })
      },
      E: (keys, tIn, tOut) => {
        c.electrons.push({ keys: keys.map(([tt, x, y, z]) => [T + tt, [x * b, y * b, (z ?? 0) * b]] as RouteKey), tIn: T + tIn, tOut: T + tOut })
      },
      L: (text, atoms, from, to) => {
        c.badges.push({ text, atoms, from: T + from, to: T + to })
      },
      model,
      modelAtoms: (centerKeys, hIn) => {
        const all = model.atoms.map((_, i) => i)
        const tpl = scaleTpl(unitTpl(model, all), kR)
        const ids: number[] = []
        const h: number[] = []
        const heavy: number[] = []
        tpl.atoms.forEach((a) => {
          const isH = a.el === 'H' && !!hIn
          const keys: [number, V3][] = isH
            ? [
                [T + hIn!.from, plus(toModel([centerKeys[0]![1] * b, centerKeys[0]![2] * b, 0]), a.rel, hIn!.k)],
                [T + hIn!.to, plus(toModel([centerKeys[0]![1] * b, centerKeys[0]![2] * b, 0]), a.rel)],
              ]
            : centerKeys.map(([tt, x, y]) => [T + tt, plus(toModel([x * b, y * b, 0]), a.rel)] as [number, V3])
          const id = atom(c, a.el, keys, isH ? T + hIn!.from - 0.3 : undefined, undefined, a.r)
          ;(c.atoms[id] as RouteAtom & { model?: boolean }).model = true
          ids.push(id)
          ;(isH ? h : heavy).push(id)
        })
        for (const [x, y] of tpl.bonds) {
          const withH = hIn && (tpl.atoms[x]!.el === 'H' || tpl.atoms[y]!.el === 'H')
          c.sticks.push(withH ? { a: ids[x]!, b: ids[y]!, t0: T + hIn!.to - 0.5, t1: T + hIn!.to + 0.1, tOut: end } : { a: ids[x]!, b: ids[y]!, t0: T + 0.19, t1: T + 0.2, tOut: end })
        }
        return { ids, h, heavy }
      },
      end: D - 0.4,
      _hide: hide,
    }
    const r = buildMoreScene(kit, script, plan)
    if (r) {
      show = r.show
      more = { title: r.title, text: r.text }
      // Подмена атома «копией» на пути: исходный гаснет (с самого начала — не появляется), его палочки — тоже.
      for (const [i, tt] of kit._hide ?? []) {
        const a = c.atoms[i]!
        if (tt <= 0.05) a.tIn = a.tOut = T + D + 1
        else a.tOut = Math.min(a.tOut, T + tt - 0.35)
        for (const s of c.sticks) if (s.a === i || s.b === i) s.tOut = Math.min(s.tOut, tt <= 0.05 ? T : T + tt - 0.35)
      }
    }
  }
  if (!show) return null
  // Ключи в плоскости экрана → модель (кроме шаблонов частиц модели — они уже в координатах модели).
  for (const a of c.atoms as (RouteAtom & { model?: boolean })[]) {
    if (a.model) {
      delete a.model
      continue
    }
    a.keys = a.keys.map(([t, p]) => [t, toModel(p)] as RouteKey)
  }
  for (const e of c.electrons) e.keys = e.keys.map(([t, p]) => [t, toModel(p)] as RouteKey)
  const tx = more ?? TEXT[show as Exclude<RouteShow, MoreShow>]
  return { kind: rk, show, equation: route, title: tx.title, text: tx.text, t0: T, dur: D, atoms: c.atoms, sticks: c.sticks, electrons: c.electrons, badges: c.badges }
}

function scaleTpl(t: ReturnType<typeof unitTpl>, k: number): ReturnType<typeof unitTpl> {
  return { atoms: t.atoms.map((a) => ({ el: a.el, rel: [a.rel[0] * k, a.rel[1] * k, a.rel[2] * k] as V3, r: a.r * k })), bonds: t.bonds, ext: t.ext * k }
}
