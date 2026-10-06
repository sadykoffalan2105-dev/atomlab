import type { FormationPlan } from '../../../chemistry/formationPlan'
import { formationPlan, isMetal } from '../../../chemistry/formationPlan'
import { DIATOMIC, formationEquation, type FormationEquation } from '../../../chemistry/formationEquation'
import { buildSchoolHeroModel, schoolBallRadius, type SchoolHeroModel, type V3 } from '../hero/schoolHeroModel'
import { compoundById } from '../../../data/compounds'
import { formationScript, type FormationType } from '../../../chemistry/formationScripts'
import { latticeFor, type LatticeAtom, type StoryLatticeKind } from './story/lattice'
import { buildRouteStage, ROUTE_DUR, type RouteStage } from './story/route'
import { buildStoryHud } from './story/hud'
import { buildRedoxDecomposition, type RedoxSceneInfo } from './story/redoxDecomposition'

export type { LatticeAtom, StoryLatticeKind } from './story/lattice'
export type { RouteStage, RouteAtom, RouteStick, RouteElectron, RouteBadge, RouteShow } from './story/route'
export type { RedoxSceneInfo, RedoxUnit } from './story/redoxDecomposition'
export { routeKeyAt } from './story/route'

/**
 * Сценарий «Как образуется» от и до (чистые функции — их читают 3D-вид, подписи и аудит):
 *  исходные вещества (H₂, O₂ — молекулы, металл — атомы кристалла) → разрыв связей в исходных молекулах →
 *  атомы сближаются → валентные электроны (точки Льюиса) → [сборка кислотного остатка] → переход e⁻ (ионная)
 *  или общие электронные пары (ковалентная) → связи по одной (кратные — по очереди) → сборка формульной единицы /
 *  форма молекулы → [фрагмент решётки — ионные] → итоговая модель карточки (тот же buildSchoolHeroModel).
 * Итоговые положения атомов — РОВНО положения модели карточки (ничего не придумывается), меняется только путь.
 */

/** 'route' — путь получения на уровне частиц (H⁺ + OH⁻ → H₂O, NH₃ + H⁺ → NH₄⁺, гидратация, обмен …), см. routeStage. */
/**
 * 'heat' — нагревание (тепловые колебания решётки), 'release' — выделение газа (O₂ ↑): этапы сценария
 * «окислительно-восстановительное разложение» (4MnO₂ → 2Mn₂O₃ + O₂, 4CuO → 2Cu₂O + O₂, 2KMnO₄ → …, 2NaNO₃ → …).
 */
export type StageKey = 'reagents' | 'route' | 'heat' | 'break' | 'approach' | 'valence' | 'inner' | 'transfer' | 'release' | 'pairs' | 'bonds' | 'assemble' | 'lattice' | 'final'
export type Stage = { key: StageKey; t0: number; dur: number }

/** Палочка связи (кратная — несколько палочек, каждая со своим временем). */
export type StoryStick = { a: number; b: number; n: number; s: number; t0: number; t1: number; bond: number }
/** Палочка исходной молекулы (H–H, O=O): b < 0 — партнёр-«призрак» (−1 − индекс). */
export type ReagentStick = { a: number; b: number; n: number; s: number }
/** Атом-призрак: второй атом исходной молекулы (O₂ → один O в молекулу, другой — в соседнюю). */
export type GhostAtom = { el: string; r: number; p0: V3; p1: V3 }

/**
 * Электрон: дом (атом + смещение в плоскости экрана), затем переход — к атому (перенос e⁻) или к середине связи
 * (общая пара). Смещения — в координатах модели (уже с учётом позы модели на экране).
 */
export type StoryElectron = {
  home: number
  homeOff: V3
  /** появление (этап «валентные электроны») */
  tIn: number
  move: null | { t0: number; t1: number; toAtom?: number; toOff?: V3; bond?: { a: number; b: number; slot: number; n: number; sign: -1 | 1; k: number } }
  /** исчезновение: общая пара — когда выросла палочка; остальные — в начале «Готово» */
  tOut: number
  kind: 'lone' | 'transfer' | 'pair'
}

/**
 * Строки стеклянной HUD-карточки у 3D-окна (DOM, НЕ поверх атомов): уравнение пути, полуреакции, баланс e⁻.
 * Показывается в окне [t0, t1) времени истории. Текст — готовые строки с Unicode-индексами/зарядами (RU);
 * titleKey/lineKeys — необязательные ключи перевода (EN/UZ), если строки зависят от языка.
 */
export type StoryHud = {
  t0: number
  t1: number
  title: string
  lines: string[]
  /** акцент: 'redox' — полуреакции (окисление/восстановление), 'route' — путь, 'check' — проверка (баланс, электронейтральность) */
  tone?: 'redox' | 'route' | 'check'
  /** (добавлено) заголовок RU / EN / UZ — если есть, интерфейс берёт строку своего языка вместо title */
  titleT?: [string, string, string]
  /** (добавлено) строки RU / EN / UZ — если есть, вместо lines (по одной тройке на строку) */
  linesT?: [string, string, string][]
}

/**
 * (добавлено) Смена заряда частицы в момент прихода/ухода электрона (сценарий «ОВР-разложение»):
 * src 'route' — индекс в routeStage.atoms; kind 'ion' — заряд иона (Mn⁴⁺ → Mn³⁺, O²⁻ → O⁰), 'ox' — степень окисления
 * атома внутри многоатомного иона (Mn⁺⁷ в MnO₄⁻, N⁺⁵ в NO₃⁻). Подпись до первой смены — RouteAtom.q / qKind.
 */
export type StoryChargeStep = { atom: number; src: 'route'; t: number; from: number; to: number; kind: 'ion' | 'ox' }

export type FormationStory = {
  /** HUD-карточки (стекло, справа сверху у 3D-окна); если заданы — формулы НЕ рисуются 3D-плашками поверх атомов */
  hud?: StoryHud[]
  /** (добавлено) смены зарядов по времени (перенос e⁻ в ОВР-разложении) — для подписей ионов сцены */
  chargeSteps?: StoryChargeStep[]
  /**
   * (добавлено) вид сценария: 'redoxDecomposition' — окислительно-восстановительное разложение при нагревании
   * (4MnO₂ → 2Mn₂O₃ + O₂ …): вся сцена до «Итога» — частицы routeStage (фрагмент решётки исходного по уравнению),
   * атомы модели карточки появляются в «Итоге». Нет — обычный сценарий.
   */
  scenario?: 'redoxDecomposition'
  /** (добавлено) данные ОВР-разложения: формульные единицы продукта (индексы routeStage.atoms), уходящие O, молекула O₂, центры */
  redox?: RedoxSceneInfo
  stages: Stage[]
  total: number
  /** ключевые положения атомов: P0 исходные, P1 после разрыва, P2 сближение, P3 перед сборкой, PF — модель */
  P: [V3[], V3[], V3[], V3[], V3[]]
  /** окно сборки каждого атома (P3 → PF) и окно «внутренней» сборки (P2 → P3) */
  assembleWin: [number, number][]
  innerWin: [number, number][]
  sticks: StoryStick[]
  reagentSticks: ReagentStick[]
  ghosts: GhostAtom[]
  electrons: StoryElectron[]
  /**
   * Фрагмент решётки вокруг модели (мир модели): ионы IB/IC/IH (настоящий из CRYSTAL_DATA или обобщённый 3D),
   * молекулы в узлах (I₂, S₈, P₄, P₄O₁₀ …) или соседние звенья цепи (CrO₃, V₂O₅ …). k — порядок роста (слоями от центра).
   * Пусто у газов/жидкостей, у SiO₂ и у кристаллических моделей карточки (решётка — сама модель).
   */
  latticeAtoms: LatticeAtom[]
  /** вид итоговой «решётки»: ionic — ионная (только IB/IC/IH), molecular, chain (полимер), network (SiO₂), none */
  latticeKind: StoryLatticeKind
  /** окно роста фрагмента: атом с порядком k появляется в latticeWin[0] + k·(latticeWin[1] − latticeWin[0]) */
  latticeWin: [number, number]
  /** тип образования по таблице правил (formationScripts): S, MP, N, PM, IB, IC, IH */
  type: FormationType | null
  /** путь получения на уровне частиц (этап 'route'); null — путь показан только уравнением */
  routeStage: RouteStage | null
  /** ионное: подписи с зарядами — с этого времени */
  ionLabelsFrom: number
  /** радиус электрона, мир */
  eR: number
  /** число переданных электронов (ионное) и общих пар (ковалентное) — для аудита */
  transferred: number
  sharedPairs: number
  /** валентные электроны по атомам (для подписей и аудита) */
  valenceE: number[]
  /** элементы атомов модели */
  atomEl: string[]
  /** радиус нейтрального атома (до перехода e⁻): у иона металла больше, у аниона меньше ионного — физически верно */
  rNeutral: number[]
  /** окно смены радиуса атом → ион (этап перехода e⁻) */
  ionWin: [number, number]
}

/** Валентные электроны главных подгрупп (номер группы). */
const VALENCE_E: Record<string, number> = {
  H: 1, Li: 1, Na: 1, K: 1, Rb: 1, Cs: 1, Ag: 1, Au: 1, Be: 2, Mg: 2, Ca: 2, Sr: 2, Ba: 2, Zn: 2, Hg: 2,
  B: 3, Al: 3, C: 4, Si: 4, Ge: 4, Sn: 4, Pb: 4, N: 5, P: 5, As: 5, O: 6, S: 6, Se: 6, Te: 6, F: 7, Cl: 7, Br: 7, I: 7,
}

const D = { reagents: 3.5, break: 3, approach: 3.5, valence: 4, assemble: 4, lattice: 5.5, final: 5 }
/** Темп (правила, раздел 2): переход e⁻ — каждый электрон отдельно ≈ 1,2 с; общие пары — по одной; палочка ≥ 0,6 с. */
const E_PER = 1.2
const transferDur = (n: number) => clamp(1.5 + 1.25 * n, 4.5, 16)
const pairsDur = (n: number) => clamp(2 + 1.1 * n, 4, 14)
const bondsDur = (n: number) => clamp(1.5 + 0.6 * n, 4, 14)
const STICK_MIN = 0.6
const MIN_TOTAL = 30
const MAX_TOTAL = 60
const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x)

// ─── Поворот позы модели (как в FormationMoleculeView: sway — Ry(yaw)·Rx(pitch), orbit — Rx(pitch)·Ry(yaw)) ───
const rotX = (p: V3, a: number): V3 => [p[0], p[1] * Math.cos(a) - p[2] * Math.sin(a), p[1] * Math.sin(a) + p[2] * Math.cos(a)]
const rotY = (p: V3, a: number): V3 => [p[0] * Math.cos(a) + p[2] * Math.sin(a), p[1], -p[0] * Math.sin(a) + p[2] * Math.cos(a)]
/** Смещение в плоскости экрана (x вправо, y вверх) → координаты модели. */
export function screenToModel(model: SchoolHeroModel, s: V3): V3 {
  return model.motion === 'orbit' ? rotY(rotX(s, -model.pitch), -model.yaw) : rotX(rotY(s, -model.yaw), -model.pitch)
}
export function modelToScreen(model: SchoolHeroModel, p: V3): V3 {
  return model.motion === 'orbit' ? rotX(rotY(p, model.yaw), model.pitch) : rotY(rotX(p, model.pitch), model.yaw)
}
const add = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]
const len = (a: V3) => Math.hypot(a[0], a[1], a[2])

export function buildFormationStory(plan: FormationPlan, model: SchoolHeroModel, eq: FormationEquation | null): FormationStory {
  const redox = buildRedoxDecomposition(plan.compoundId, plan, model, (sv) => screenToModel(model, sv), (p) => modelToScreen(model, p))
  if (redox) return redoxStory(plan, model, redox)
  const n = model.atoms.length
  const crystal = model.kind === 'crystal'
  const ionic = plan.mode === 'ionic'
  const script = formationScript(plan.compoundId)
  const type = script?.type ?? null
  /** N — атомный каркас SiO₂: растёт от центрального тетраэдра SiO₄ к соседним (по удалённости). */
  const network = type === 'N'
  const PF = model.atoms.map((a) => [...a.pos] as V3)
  let maxD = 0
  for (const p of PF) maxD = Math.max(maxD, len(p))
  maxD = Math.max(maxD, 0.25)
  const avgR = model.atoms.reduce((s, a) => s + a.r, 0) / Math.max(1, n)
  const eR = clamp(0.2 * avgR, 0.012, 0.05)
  const unitOf = new Map<number, number>()
  plan.units.forEach((u, i) => u.atoms.forEach((a) => unitOf.set(a, i)))
  const speciesOfAtom = (i: number) => plan.species[plan.units[unitOf.get(i) ?? -1]?.species ?? -1]
  /** радиус нейтрального атома (до перехода e⁻): у иона металла больше, у аниона меньше ионного — физически верно */
  const rNeutralOf = (i: number): number => {
    const a = model.atoms[i]!
    const sp = speciesOfAtom(i)
    // Кристалл (125 ионов) — радиусы как в модели: смена радиусов сотен шаров отвлекает от решётки.
    if (!ionic || crystal || !sp || sp.kind !== 'ion' || sp.charge === 0) return a.r
    // Не больше чем вдвое против ионного — шары не перекрывают соседей.
    return Math.max(0.5 * a.r, Math.min(2 * a.r, schoolBallRadius(a.el)))
  }

  // ── P2 / P3: разлёт от итоговых мест ──
  const P2: V3[] = PF.map((p) => [...p] as V3)
  const P3: V3[] = PF.map((p) => [...p] as V3)
  if (!ionic) {
    const E = crystal ? 1.5 : 1.9
    PF.forEach((p, i) => {
      const k = len(p) < 0.2 * maxD ? 1 : E
      P2[i] = [p[0] * k, p[1] * k, p[2] * k]
      P3[i] = add(p, [p[0] * (k - 1), p[1] * (k - 1), p[2] * (k - 1)], 0.35)
    })
  } else {
    const E = crystal ? 1.55 : 2.0
    for (const u of plan.units) {
      const c: V3 = [0, 0, 0]
      for (const a of u.atoms) for (let q = 0; q < 3; q++) c[q] += PF[a]![q]! / u.atoms.length
      const d = len(c)
      const k = d < 0.15 * maxD ? (plan.units.length > 1 && !crystal ? 0.35 : 0) : E - 1
      // Одна частица в центре: всё равно чуть отводим, чтобы было видно, куда приходят другие.
      const shift: V3 = d < 1e-6 ? [0, 0, 0] : [c[0] * k, c[1] * k, c[2] * k]
      const inner = u.atoms.length > 1 ? 1.75 : 1
      for (const a of u.atoms) {
        const rel: V3 = [PF[a]![0] - c[0], PF[a]![1] - c[1], PF[a]![2] - c[2]]
        P3[a] = add(add(c, shift), rel)
        P2[a] = add(add(c, shift), rel, inner)
      }
    }
  }

  // ── Исходные вещества: группы атомов (X₂ — пары, металл — кластер, прочие — по одному) ──
  type Group = { atoms: number[]; ghost: boolean; kind: 'pair' | 'metal' | 'atom' }
  const groups: Group[] = []
  const atomsMode = eq?.directKind === 'atoms' && eq.reagents[0] !== 'O₂'
  const byEl = new Map<string, number[]>()
  model.atoms.forEach((a, i) => {
    if (!byEl.has(a.el)) byEl.set(a.el, [])
    byEl.get(a.el)!.push(i)
  })
  const scr2 = P2.map((p) => modelToScreen(model, p))
  const ang = (i: number) => Math.atan2(scr2[i]![1], scr2[i]![0])
  for (const [el, list] of byEl) {
    const sorted = [...list].sort((a, b) => ang(a) - ang(b))
    if (!atomsMode && DIATOMIC.has(el)) {
      for (let i = 0; i + 1 < sorted.length; i += 2) groups.push({ atoms: [sorted[i]!, sorted[i + 1]!], ghost: false, kind: 'pair' })
      if (sorted.length % 2 === 1) groups.push({ atoms: [sorted[sorted.length - 1]!], ghost: true, kind: 'pair' })
    } else if (isMetal(el)) {
      for (let i = 0; i < sorted.length; i += 7) groups.push({ atoms: sorted.slice(i, i + 7), ghost: false, kind: 'metal' })
    } else for (const a of sorted) groups.push({ atoms: [a], ghost: false, kind: 'atom' })
  }
  // Места групп: кольцо в плоскости экрана (кристалл — сфера), порядок — по углу к их будущим местам.
  const cen = (g: Group): V3 => {
    const c: V3 = [0, 0, 0]
    for (const a of g.atoms) for (let q = 0; q < 3; q++) c[q] += scr2[a]![q]! / g.atoms.length
    return c
  }
  groups.sort((a, b) => Math.atan2(cen(a)[1], cen(a)[0]) - Math.atan2(cen(b)[1], cen(b)[0]))
  const G = groups.length
  const ringR = maxD * (crystal ? 1.75 : 1.55) + 2.2 * avgR
  const P0: V3[] = PF.map(() => [0, 0, 0])
  const P1: V3[] = PF.map(() => [0, 0, 0])
  const ghosts: GhostAtom[] = []
  const reagentSticks: ReagentStick[] = []
  const bondN = (el: string) => (el === 'N' ? 3 : el === 'O' ? 2 : 1)
  groups.forEach((g, gi) => {
    let c: V3
    let tan: V3
    if (crystal || G > 14) {
      // Сфера Фибоначчи (много групп) — в координатах экрана.
      const y = 1 - (2 * (gi + 0.5)) / G
      const rr = Math.sqrt(Math.max(0, 1 - y * y))
      const phi = gi * 2.399963
      c = [Math.cos(phi) * rr * ringR, y * ringR, Math.sin(phi) * rr * ringR * 0.6]
      tan = [-Math.sin(phi), 0, Math.cos(phi)]
    } else if (G === 1) {
      c = [0, 0, 0]
      tan = [1, 0, 0]
    } else {
      const a = G <= 2 ? (gi === 0 ? Math.PI : 0) : (2 * Math.PI * gi) / G + Math.PI / G
      c = [Math.cos(a) * ringR, Math.sin(a) * ringR, 0]
      tan = [-Math.sin(a), Math.cos(a), 0]
    }
    const el = model.atoms[g.atoms[0]!]!.el
    const r = model.atoms[g.atoms[0]!]!.r
    if (g.kind === 'pair') {
      const d = 1.55 * r
      const p0 = add(c, tan, -d)
      const p1 = add(c, tan, d)
      const a = g.atoms[0]!
      P0[a] = screenToModel(model, p0)
      P1[a] = screenToModel(model, add(p0, tan, -0.9 * r))
      if (g.atoms.length === 2) {
        const b = g.atoms[1]!
        P0[b] = screenToModel(model, p1)
        P1[b] = screenToModel(model, add(p1, tan, 0.9 * r))
        for (let s = 0; s < bondN(el); s++) reagentSticks.push({ a, b, n: bondN(el), s })
      } else {
        // Второй атом молекулы уходит в другую молекулу продукта (призрак).
        ghosts.push({ el, r, p0: screenToModel(model, p1), p1: screenToModel(model, add(p1, tan, 4 * r)) })
        for (let s = 0; s < bondN(el); s++) reagentSticks.push({ a, b: -ghosts.length, n: bondN(el), s })
      }
    } else if (g.kind === 'metal') {
      // Плотная упаковка: центр + шестиугольник (атомы касаются — металлическая решётка).
      g.atoms.forEach((a, k) => {
        // шаг — по радиусу НЕЙТРАЛЬНОГО атома (на этапе «Исходные» шар металла ещё атом, он крупнее иона)
        const rr = rNeutralOf(a)
        const off: V3 = k === 0 ? [0, 0, 0] : [Math.cos(((k - 1) * Math.PI) / 3) * 2.05 * rr, Math.sin(((k - 1) * Math.PI) / 3) * 2.05 * rr, 0]
        P0[a] = screenToModel(model, add(c, off))
        P1[a] = screenToModel(model, add(c, off, 1.7))
      })
    } else {
      const a = g.atoms[0]!
      P0[a] = screenToModel(model, c)
      P1[a] = P0[a]!
    }
  })

  // Исходные вещества не наползают друг на друга: группы, чьи шары перекрываются (много частиц — карналлит, гидраты),
  // расталкиваются вдоль линии центров (молекула H₂, Cl₂ или кучка металла сдвигается целиком).
  const groupOf = new Map<number, number>()
  groups.forEach((g, gi) => g.atoms.forEach((a) => groupOf.set(a, gi)))
  for (let it = 0; it < 16; it++) {
    let moved = false
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const gi = groupOf.get(i)
        const gj = groupOf.get(j)
        if (gi == null || gj == null || gi === gj) continue
        const dv: V3 = [P0[j]![0] - P0[i]![0], P0[j]![1] - P0[i]![1], P0[j]![2] - P0[i]![2]]
        const dd = len(dv)
        const need = 1.02 * (model.atoms[i]!.r + model.atoms[j]!.r)
        if (dd >= need || dd < 1e-6) continue
        const u: V3 = [dv[0] / dd, dv[1] / dd, dv[2] / dd]
        const push = (need - dd) / 2
        for (const a of groups[gi]!.atoms) {
          P0[a] = add(P0[a]!, u, -push)
          P1[a] = add(P1[a]!, u, -push)
        }
        for (const a of groups[gj]!.atoms) {
          P0[a] = add(P0[a]!, u, push)
          P1[a] = add(P1[a]!, u, push)
        }
        moved = true
      }
    if (!moved) break
  }

  // ── Палочки итоговой модели и их порядок ──
  const nbrs: number[][] = model.atoms.map(() => [])
  for (const b of model.bonds) {
    nbrs[b.a]!.push(b.b)
    nbrs[b.b]!.push(b.a)
  }
  const stickList: { a: number; b: number; n: number; s: number; bond: number }[] = []
  const midD = (k: number) => {
    const b = model.bonds[k]!
    return len([(PF[b.a]![0] + PF[b.b]![0]) / 2, (PF[b.a]![1] + PF[b.b]![1]) / 2, (PF[b.a]![2] + PF[b.b]![2]) / 2])
  }
  const bondOrder = network ? model.bonds.map((_, k) => k).sort((x, y) => midD(x) - midD(y)) : plan.bondOrder
  for (const k of bondOrder) {
    const b = model.bonds[k]!
    const nn = Math.max(1, Math.min(3, Math.round(b.order)))
    for (let s = 0; s < nn; s++) stickList.push({ a: b.a, b: b.b, n: nn, s, bond: k })
  }

  // ── Какие частицы показывают электроны (у больших кристаллов — только центральные) ──
  const showE: boolean[] = model.atoms.map(() => true)
  if (crystal && ionic) {
    // Кристалл из ~100 ионов: переход e⁻ — только у ионов ближе к центру, не больше 10 электронов.
    showE.fill(false)
    const cen = (u: { atoms: number[] }) => {
      const c: V3 = [0, 0, 0]
      for (const a of u.atoms) for (let q = 0; q < 3; q++) c[q] += PF[a]![q]! / u.atoms.length
      return len(c)
    }
    let give = 0
    let takeQ = 0
    for (const u of [...plan.units].sort((x, y) => cen(x) - cen(y))) {
      const q = plan.species[u.species]!.charge
      if (q > 0 && give + q <= 10) give += q
      else if (q < 0 && takeQ - q <= 10) takeQ -= q
      else continue
      for (const a of u.atoms) showE[a] = true
      if (give >= 10 && takeQ >= 10) break
    }
  } else if (network) {
    // SiO₂: электроны — у центрального Si и четырёх его O (тетраэдр SiO₄), каркас дальше — палочками.
    showE.fill(false)
    const si = model.atoms.map((_, i) => i).filter((i) => model.atoms[i]!.el === 'Si').sort((x, y) => len(PF[x]!) - len(PF[y]!))[0]
    if (si != null) {
      showE[si] = true
      for (const o of nbrs[si]!) showE[o] = true
    }
  } else if (crystal) for (let i = 0; i < n; i++) showE[i] = len(PF[i]!) <= 0.62 * maxD || n <= 30

  // ── Переход e⁻ (ионное): от атомов металла (и H иона аммония) к анионам — заранее, чтобы знать длительность ──
  const P3d = (a: number, b: number) => len([P3[a]![0] - P3[b]![0], P3[a]![1] - P3[b]![1], P3[a]![2] - P3[b]![2]])
  const plannedMoves: { from: number; to: number }[] = []
  if (ionic) {
    const slots: number[] = []
    const donors: { atom: number; left: number }[] = []
    plan.units.forEach((u) => {
      const sp = plan.species[u.species]!
      if (sp.charge < 0) {
        // Многоатомный анион: электроны — к концевым атомам O (меньше всего связей), по очереди.
        const targets = u.atoms.length === 1 ? u.atoms : [...u.atoms].filter((a) => model.atoms[a]!.el !== 'H').sort((a, b) => nbrs[a]!.length - nbrs[b]!.length)
        for (let q = 0; q < -sp.charge; q++) slots.push(targets[q % targets.length]!)
      } else if (sp.charge > 0) {
        if (u.atoms.length === 1) donors.push({ atom: u.atoms[0]!, left: sp.charge })
        else {
          const h = u.atoms.find((a) => model.atoms[a]!.el === 'H')
          if (h != null) donors.push({ atom: h, left: sp.charge })
        }
      }
    })
    for (const to of slots) {
      if (!showE[to]) continue
      const d = donors.filter((x) => x.left > 0 && showE[x.atom]).sort((x, y) => P3d(x.atom, to) - P3d(y.atom, to))[0]
      if (!d) continue
      d.left--
      plannedMoves.push({ from: d.atom, to })
    }
  }
  // Общие пары (по одной): число — для длительности этапа.
  const seenB = new Set<number>()
  const bondsInOrder = bondOrder.filter((k) => !seenB.has(k) && seenB.add(k))
  let pairCount = 0
  for (const k of bondsInOrder) {
    const b = model.bonds[k]!
    if (showE[b.a] && showE[b.b]) pairCount += Math.max(1, Math.min(3, Math.round(b.order)))
  }

  // ── Решётка по типу (только IB / IC / IH — ионная; молекулярная укладка; цепь полимера) ──
  const lat = latticeFor(script, plan, model, (sv) => screenToModel(model, sv))

  // ── Этапы ──
  const hasBreak = reagentSticks.length > 0 || groups.some((g) => g.kind === 'metal' && g.atoms.length > 1)
  const stages: Stage[] = []
  let t = 0
  const push = (key: StageKey, dur: number) => {
    if (dur <= 0) return
    stages.push({ key, t0: t, dur })
    t += dur
  }
  push('reagents', D.reagents)
  const routeStage = buildRouteStage(script, plan, model, (sv) => screenToModel(model, sv), t, ringR)
  if (routeStage) push('route', ROUTE_DUR)
  if (hasBreak) push('break', D.break)
  push('approach', D.approach)
  push('valence', D.valence)
  if (ionic) {
    push('inner', stickList.length ? pairsDur(pairCount) : 0)
    push('transfer', transferDur(plannedMoves.length))
    push('assemble', D.assemble)
    push('lattice', D.lattice)
  } else {
    push('pairs', pairsDur(pairCount))
    push('bonds', bondsDur(stickList.length))
    push('assemble', network ? D.assemble + 2 : D.assemble)
  }
  const extraFinal = lat.kind === 'molecular' || lat.kind === 'chain' ? 2.5 : 0
  push('final', Math.min(MAX_TOTAL - t, Math.max(D.final + extraFinal, MIN_TOTAL - t)))
  const st = (k: StageKey) => stages.find((s) => s.key === k)

  // Палочки: молекула — в «связях», ионное — в «кислотном остатке».
  const sticks: StoryStick[] = []
  const bondStage = ionic ? st('inner') : st('bonds')
  if (bondStage) {
    const from = ionic ? bondStage.t0 + 0.4 * bondStage.dur : bondStage.t0 + 0.3
    const span = ionic ? 0.55 * bondStage.dur : bondStage.dur - 0.6
    const m = Math.max(1, stickList.length)
    const slot = span / m
    stickList.forEach((x, i) => sticks.push({ ...x, t0: from + i * slot, t1: from + i * slot + Math.max(STICK_MIN, Math.max(slot, Math.min(1.2, span / 2)) * 0.95) }))
  }

  // Окна сборки атомов.
  const assembleWin: [number, number][] = PF.map(() => [0, 0])
  const innerWin: [number, number][] = PF.map(() => [0, 0])
  const sa = st('assemble')!
  if (ionic) {
    const ins = st('inner')
    for (let i = 0; i < n; i++) innerWin[i] = ins ? [ins.t0 + 0.4 * ins.dur, ins.t0 + 0.95 * ins.dur] : [sa.t0, sa.t0]
    const latS = st('lattice')!
    // Кристалл: центральная формульная единица собирается в «притяжении», остальные — в «решётке».
    // Кристалл растёт слоями: частицы — по удалённости от центра.
    const ucen = (ui: number) => {
      const u = plan.units[ui]!
      const c: V3 = [0, 0, 0]
      for (const a of u.atoms) for (let q = 0; q < 3; q++) c[q] += PF[a]![q]! / u.atoms.length
      return len(c)
    }
    const order = crystal ? [...plan.unitOrder].sort((x, y) => ucen(x) - ucen(y)) : plan.unitOrder
    const core = crystal ? Math.max(2, Math.round(order.length * 0.12)) : order.length
    order.forEach((ui, j) => {
      const u = plan.units[ui]!
      let w: [number, number]
      if (j < core) {
        const k = core <= 1 ? 0 : j / (core - 1)
        const t0 = sa.t0 + 0.15 + k * 0.45 * sa.dur
        w = [t0, Math.min(sa.t0 + sa.dur - 0.1, t0 + 0.5 * sa.dur)]
      } else {
        const k = (j - core) / Math.max(1, order.length - core)
        const t0 = latS.t0 + 0.1 + k * 0.5 * latS.dur
        w = [t0, t0 + 0.45 * latS.dur]
      }
      for (const a of u.atoms) assembleWin[a] = w
    })
  } else {
    // Атом сближается со своей первой связью (P2 → P3), затем вся молекула принимает форму (P3 → PF).
    const placed = new Set<number>()
    for (const s of sticks) {
      for (const x of [s.a, s.b]) {
        if (placed.has(x)) continue
        placed.add(x)
        innerWin[x] = [s.t0 - 0.3, s.t1]
      }
    }
    const bs = st('bonds')!
    for (let i = 0; i < n; i++) {
      if (!placed.has(i)) innerWin[i] = [bs.t0, bs.t0 + 1]
      if (network) {
        // Каркас: сначала центральный тетраэдр, затем соседние — по удалённости от центра.
        const k = clamp(len(PF[i]!) / maxD, 0, 1)
        const t0 = sa.t0 + 0.2 + k * 0.6 * sa.dur
        assembleWin[i] = [t0, Math.min(sa.t0 + sa.dur - 0.1, t0 + 0.35 * sa.dur)]
      } else assembleWin[i] = [sa.t0 + 0.2, sa.t0 + sa.dur - 0.3]
    }
  }

  // ── Электроны ──
  const sv = st('valence')!
  const fin = st('final')!
  const sums = model.atoms.map(() => 0)
  for (const b of model.bonds) {
    sums[b.a]! += b.order
    sums[b.b]! += b.order
  }
  const valenceE = model.atoms.map((a, i) => {
    const sp = speciesOfAtom(i)
    if (isMetal(a.el)) {
      if (ionic && sp && sp.charge > 0 && sp.kind === 'ion') return sp.charge
      return ionic ? (VALENCE_E[a.el] ?? 2) : Math.max(1, Math.round(sums[i]!))
    }
    return VALENCE_E[a.el] ?? 0
  })
  const electrons: StoryElectron[] = []
  const pool: number[][] = model.atoms.map(() => [])
  const lewisOff = (i: number, k: number, total: number): V3 => {
    // 4 стороны (верх, право, низ, лево), сначала по одному, затем пары — как в схемах Льюиса.
    const side = k % 4
    const second = k >= 4 ? 1 : 0
    const paired = total > 4 + side
    const r = model.atoms[i]!.r
    const d = r + 2.2 * eR
    const sp = paired ? (second ? 1 : -1) * 1.6 * eR : 0
    const base: V3[] = [[sp, d, 0], [d, sp, 0], [sp, -d, 0], [-d, sp, 0]]
    return screenToModel(model, [base[side]![0], base[side]![1], 0.35 * r])
  }
  model.atoms.forEach((_, i) => {
    if (!showE[i]) return
    const total = Math.min(8, valenceE[i]!)
    for (let k = 0; k < total; k++) {
      pool[i]!.push(electrons.length)
      electrons.push({ home: i, homeOff: lewisOff(i, k, total), tIn: sv.t0 + 0.3 + (0.5 * k) / Math.max(1, total), move: null, tOut: fin.t0 + 1.2, kind: 'lone' })
    }
  })
  const take = (i: number): number | null => (pool[i]!.length ? pool[i]!.shift()! : null)
  const phantom = (i: number): number => {
    electrons.push({ home: i, homeOff: lewisOff(i, 0, 1), tIn: sv.t0 + 0.8, move: null, tOut: fin.t0 + 1.2, kind: 'lone' })
    return electrons.length - 1
  }
  // Общие пары: по одному электрону от каждого атома (нет своего — оба от партнёра: донорно-акцепторная).
  // Пары появляются ПО ОДНОЙ (перекрытие соседних ≤ 30 %); у ионных (кислотный остаток) за парой сразу растёт палочка.
  let sharedPairs = 0
  const pairStage = ionic ? st('inner') : st('pairs')
  if (pairStage) {
    const P = Math.max(1, pairCount)
    const span = ionic ? 0.75 * pairStage.dur - 0.2 : pairStage.dur - 0.6
    const per = P <= 1 ? Math.min(E_PER, span) : clamp(span / (1 + 0.7 * (P - 1)), STICK_MIN, E_PER)
    const step = P <= 1 ? 0 : (span - per) / (P - 1)
    let q = 0
    bondsInOrder.forEach((k) => {
      const b = model.bonds[k]!
      if (!showE[b.a] || !showE[b.b]) return
      const nn = Math.max(1, Math.min(3, Math.round(b.order)))
      for (let p = 0; p < nn; p++) {
        sharedPairs++
        const e1 = take(b.a) ?? take(b.b) ?? phantom(b.a)
        const e2 = take(b.b) ?? take(b.a) ?? phantom(b.b)
        const t0 = pairStage.t0 + 0.2 + q * step
        const t1 = t0 + per
        q++
        const stick = sticks.find((s) => s.bond === k && s.s === p)
        if (stick && ionic) {
          stick.t0 = t1 - 0.15
          stick.t1 = stick.t0 + Math.max(STICK_MIN, per)
        }
        const tOut = stick ? stick.t1 : fin.t0 + 1.2
        for (const [e, sign] of [[e1, -1], [e2, 1]] as const) {
          const E = electrons[e]!
          E.move = { t0, t1, bond: { a: b.a, b: b.b, slot: p, n: nn, sign, k } }
          E.tOut = tOut
          E.kind = 'pair'
        }
      }
    })
  }
  // Переход электронов (ионное): каждый e⁻ отдельно и по очереди (≈ 1,2 с, перекрытие соседних ≤ 30 %).
  let transferred = 0
  const ts = st('transfer')
  if (ionic && ts) {
    const moves = plannedMoves.map(({ from, to }) => ({ e: take(from) ?? phantom(from), to }))
    const m = moves.length
    const per = E_PER
    const step = m <= 1 ? 0 : Math.max(0.7 * per, (ts.dur - 0.8 - per) / (m - 1))
    moves.forEach(({ e, to }, j) => {
      const t0 = ts.t0 + 0.4 + j * step
      const k = pool[to]!.length + j
      electrons[e]!.move = { t0, t1: t0 + per, toAtom: to, toOff: lewisOff(to, 7 - (k % 8), 8) }
      electrons[e]!.kind = 'transfer'
      transferred++
    })
  }

  // Фрагмент решётки: появление по слоям (k) в этапе «Решётка» (ионные) или «Готово» (молекулярная, цепь).
  const latticeStage = st('lattice') ?? fin
  const latticeAtoms = lat.atoms
  const latticeWin: [number, number] = lat.kind === 'ionic' ? [latticeStage.t0 + 0.3, latticeStage.t0 + 0.75 * latticeStage.dur] : [fin.t0 + 0.2, fin.t0 + 2.2]

  const tr = st('transfer')
  return withHud(plan.formula, {
    stages,
    total: t,
    P: [P0, P1, P2, P3, PF],
    assembleWin,
    innerWin,
    sticks,
    reagentSticks,
    ghosts,
    electrons,
    latticeAtoms,
    latticeKind: lat.kind,
    latticeWin,
    type,
    routeStage,
    ionLabelsFrom: tr ? tr.t0 + tr.dur - 0.2 : Infinity,
    eR,
    transferred,
    sharedPairs,
    valenceE,
    atomEl: model.atoms.map((a) => a.el),
    rNeutral: model.atoms.map((_, i) => rNeutralOf(i)),
    ionWin: tr ? [tr.t0 + 0.45 * tr.dur, tr.t0 + tr.dur] : [Infinity, Infinity],
  })
}

/**
 * ОВР-разложение (story/redoxDecomposition.ts): до «Итога» — только частицы routeStage (фрагмент исходного по уравнению),
 * атомы модели карточки стоят на своих местах (PF) и проявляются в «Итоге»; e⁻ Льюиса и фрагмент «облака» решётки не рисуются.
 */
function redoxStory(plan: FormationPlan, model: SchoolHeroModel, r: NonNullable<ReturnType<typeof buildRedoxDecomposition>>): FormationStory {
  const PF = model.atoms.map((a) => [...a.pos] as V3)
  const fin = r.stages.find((s) => s.key === 'final')!
  const avgR = model.atoms.reduce((s, a) => s + a.r, 0) / Math.max(1, model.atoms.length)
  const sticks: StoryStick[] = []
  model.bonds.forEach((b, k) => {
    const nn = Math.max(1, Math.min(3, Math.round(b.order)))
    for (let s = 0; s < nn; s++) sticks.push({ a: b.a, b: b.b, n: nn, s, t0: fin.t0, t1: fin.t0 + 0.6, bond: k })
  })
  const lat = latticeFor(formationScript(plan.compoundId), plan, model, (sv) => screenToModel(model, sv))
  const win = PF.map(() => [fin.t0, fin.t0] as [number, number])
  return {
    hud: r.hud,
    chargeSteps: r.chargeSteps,
    scenario: 'redoxDecomposition',
    redox: r.info,
    stages: r.stages,
    total: r.total,
    P: [PF, PF, PF, PF, PF],
    assembleWin: win,
    innerWin: win.map((w) => [...w] as [number, number]),
    sticks,
    reagentSticks: [],
    ghosts: [],
    electrons: [],
    latticeAtoms: [],
    latticeKind: lat.kind,
    latticeWin: [fin.t0, fin.t0],
    type: formationScript(plan.compoundId)?.type ?? null,
    routeStage: r.route,
    ionLabelsFrom: fin.t0 + 0.3,
    eR: clamp(0.2 * avgR, 0.012, 0.05),
    transferred: r.route.electrons.length,
    sharedPairs: 0,
    valenceE: model.atoms.map(() => 0),
    atomEl: model.atoms.map((a) => a.el),
    rNeutral: model.atoms.map((a) => a.r),
    ionWin: [Infinity, Infinity],
  }
}

/** HUD для всех сценариев: текст бывших 3D-плашек пути и подпись решётки (story/hud.ts). */
function withHud(formula: string, s: FormationStory): FormationStory {
  if (!s.hud) s.hud = buildStoryHud(s, formula)
  return s
}

/** Радиус шара атома i в момент t: нейтральный атом → ион во время перехода e⁻. */
export function atomRadiusAt(story: FormationStory, i: number, t: number, rFinal: number): number {
  const rn = story.rNeutral[i]!
  if (rn === rFinal) return rFinal
  const u = easeInOut((t - story.ionWin[0]) / Math.max(1e-6, story.ionWin[1] - story.ionWin[0]))
  return rn + (rFinal - rn) * u
}

export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x)
export const easeInOut = (x: number): number => {
  const u = clamp01(x)
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2
}

export function stageIndexAt(story: FormationStory, t: number): number {
  let k = 0
  for (let i = 0; i < story.stages.length; i++) if (t >= story.stages[i]!.t0) k = i
  return k
}

const lerp3 = (out: V3, a: V3, b: V3, u: number) => {
  out[0] = a[0] + (b[0] - a[0]) * u
  out[1] = a[1] + (b[1] - a[1]) * u
  out[2] = a[2] + (b[2] - a[2]) * u
}
const winU = (t: number, w: readonly [number, number]) => easeInOut((t - w[0]) / Math.max(1e-6, w[1] - w[0]))

/** Положение атома i в момент t (пишет в out). */
export function atomPosAt(story: FormationStory, i: number, t: number, out: V3): V3 {
  const [P0, P1, P2, P3, PF] = story.P
  const sb = story.stages.find((s) => s.key === 'break')
  const sa = story.stages.find((s) => s.key === 'approach')
  if (!sa) {
    // ОВР-разложение: атомы модели — сразу на своих местах (появляются в «Итоге»).
    out[0] = PF[i]![0]
    out[1] = PF[i]![1]
    out[2] = PF[i]![2]
    return out
  }
  if (t < (sb ? sb.t0 : sa.t0)) {
    out[0] = P0[i]![0]
    out[1] = P0[i]![1]
    out[2] = P0[i]![2]
    return out
  }
  if (sb && t < sa.t0) {
    lerp3(out, P0[i]!, P1[i]!, easeInOut((t - sb.t0 - 0.6) / (sb.dur - 0.9)))
    return out
  }
  if (t < sa.t0 + sa.dur) {
    // Сближение — с небольшим разбросом по атомам (не строем).
    const lag = 0.25 * ((i * 0.618) % 1)
    lerp3(out, P1[i]!, P2[i]!, easeInOut((t - sa.t0 - lag) / (sa.dur - 0.3)))
    return out
  }
  const iw = story.innerWin[i]!
  const aw = story.assembleWin[i]!
  if (t < aw[0]) {
    lerp3(out, P2[i]!, P3[i]!, winU(t, iw))
    return out
  }
  lerp3(out, P3[i]!, PF[i]!, winU(t, aw))
  return out
}

// ─── Сценарий по id вещества (кэш): план + модель карточки + уравнение ───

const storyCache = new Map<string, FormationStory | null>()
export function formationStoryFor(compoundId: string): FormationStory | null {
  if (storyCache.has(compoundId)) return storyCache.get(compoundId)!
  const c = compoundById[compoundId]
  const plan = formationPlan(compoundId)
  const model = c ? buildSchoolHeroModel(c) : null
  const s = c && plan && model ? buildFormationStory(plan, model, formationEquation(compoundId)) : null
  storyCache.set(compoundId, s)
  return s
}
