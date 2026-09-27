import { particleLevels } from '../../../../chemistry/data/electronLevels'
import { defineSceneTiming, type SceneFinish, type SceneStep, type SceneTiming } from '../kit/sceneKit'
import { analyzeSchoolSpec, angleDegOf, shellElectronsOfAtom, type ElectronPlace, type Phase, type SchoolAnalysis, type V3 } from './schoolAnalysis'
import { SCHOOL_STEP_IDS, type SchoolLocale, type SchoolSceneSpec, type SchoolStepId, type SchoolText } from './schoolSpec'

/**
 * МОДЕЛЬ КАДРА школьной сцены — единственный источник правды состояния кадра: sampleSchoolState(m, t).
 * Чистые функции без three: класс SchoolReactionScene только переносит состояние в объекты, тест
 * scripts/test-school-scene.mts проверяет его на любом t. Все длины — пм (система сцены).
 *
 * Сюжет по шагам (SCHOOL_STEP_IDS):
 *   reactants — молекулы реагентов со штрихами связей и подписями формул;
 *   atoms     — облака внешнего слоя, электроны точками (пары связи между ядрами, неподелённые пары
 *               у атомов), штрихи бледнеют, схемы слоёв (O +8 )2 )6);
 *   breaking  — каждая разрываемая пара расходится по одному электрону к своим атомам (гомолиз),
 *               атомы расходятся в split; облака «худеют» (внешний слой не завершён);
 *   pairs     — атомы сближаются, облака тянутся к партнёру и перекрываются, по электрону от
 *               каждого атома сходятся в общую пару между ядрами; облако заполняется (слой завершён);
 *   molecule  — геометрия встаёт точно по ядру, общие пары стягиваются в штрихи, угол подписан;
 *   result    — мягкий облёт, уравнение, наблюдение.
 */

export type SchoolCueId = 'bondBreak' | 'pairs' | 'molecule' | 'embryo' | 'birth' | 'complete'

/** Параметры рисунка (пм): шар — доля ковалентного радиуса, точки, зазоры. */
export const SCHOOL_DRAW = {
  /** Доля ковалентного радиуса (Cordero) для шара: меньше, чем 0,72 у ball-and-stick, чтобы между ядрами
   * было место для общей пары. Доля одна на все атомы — отношения размеров честные. */
  ballScale: 0.62,
  dotR: 6,
  /** Расстояние между двумя электронами пары. */
  dotSep: 13,
  /** Шаг между парами кратной связи (поперёк оси) — и между штрихами. */
  pairSpacing: 19,
  stickSpacing: 15,
  stickR: 5.2,
  /** Зазор точек неподелённых пар / неспаренных электронов над поверхностью шара. */
  shellGap: 12,
  /** Добавка к зазору для пар, смотрящих от зрителя (× доля направления на −z), — чтобы шар их не закрывал. */
  backLift: 34,
  /** Облако внешнего слоя: радиус-параметр kit/electronClouds = max(k · r_шара, min). */
  cloudK: 1.25,
  cloudMin: 30,
  /** Во сколько раз молекула «рыхлее» итоговой в конце шага pairs (геометрия встаёт на шаге molecule). */
  loose: 1.14,
} as const

export type SchoolLabelKind = 'atom' | 'atomDark' | 'species' | 'measure' | 'token' | 'equation'

/** Разделитель частей уравнения «левая часть ␟ стрелка ␟ условие ␟ правая часть» (подпись kind 'equation'). */
export const EQUATION_PART_SEP = '␟'

/**
 * Уравнение с условием НАД стрелкой: «2SO₂ + O₂ ⇄ 2SO₃» + «t°, кат. V₂O₅» → части через EQUATION_PART_SEP
 * (CinemaDomLabels рисует условие мелко над стрелкой). Без условия или без стрелки — уравнение как есть.
 */
export function equationWithCondition(equation: string, condition: string | undefined): string {
  const m = /^(.*?)\s*([→⇄⇌])\s*(.*)$/.exec(equation)
  if (!condition || !m) return equation
  return [m[1], m[2], condition, m[3]].join(EQUATION_PART_SEP)
}

export type SchoolLabelAnchor =
  | { readonly kind: 'atom'; readonly atom: number }
  | { readonly kind: 'layers'; readonly atom: number }
  | { readonly kind: 'molR'; readonly mol: number }
  | { readonly kind: 'molP'; readonly mol: number }
  /** others — прочие соседи центрального атома в продукте (SO₃: третий O); при трёх соседях и больше подпись угла — над молекулой. */
  | { readonly kind: 'angle'; readonly a: number; readonly center: number; readonly b: number; readonly others: readonly number[] }
  /** Середина связи продукта (подпись донорно-акцепторной пары «O → C»), сдвиг поперёк оси. */
  | { readonly kind: 'bond'; readonly bond: number }
  | { readonly kind: 'top' }
  | { readonly kind: 'bottom' }
  | { readonly kind: 'center' }

export type SchoolLabelDef = {
  readonly id: string
  readonly kind: SchoolLabelKind
  readonly text: SchoolText
  readonly anchor: SchoolLabelAnchor
  /** Видна на [from, to] (время сюжета) с мягкими краями. */
  readonly from: number
  readonly to: number
}

export type SchoolStick = {
  readonly phase: 'r' | 'p'
  readonly bond: number
  readonly pair: number
  /** Номер разорванной пары (SchoolAnalysis.broken) для штриха реагента, иначе −1. */
  readonly broken: number
}

type Win = { t0: number; t1: number }

export type SchoolModel = {
  readonly a: SchoolAnalysis
  readonly spec: SchoolSceneSpec
  readonly timing: SceneTiming<SchoolStepId, SchoolCueId>
  readonly finish: SceneFinish
  readonly step: Readonly<Record<SchoolStepId, { from: number; to: number }>>
  readonly ballR: number[]
  readonly cloudR: number[]
  readonly breakWin: Win[]
  readonly formWin: Win[]
  readonly moveBreak: Win[]
  readonly movePairs: Win[]
  /** Позиции «рыхлой» молекулы продукта (конец шага pairs). */
  readonly loose: V3[]
  /** Место (центр) молекулы продукта, в которую входит атом, пм: вокруг него молекула поворачивается. */
  readonly pPlace: V3[]
  /** Место каждой образуемой пары (для вспышки в её центре). */
  readonly formedPlace: ElectronPlace[]
  readonly sticks: SchoolStick[]
  readonly labels: SchoolLabelDef[]
  readonly fillR: number[]
  readonly fillS: number[]
  readonly fillP: number[]
  /**
   * Акцепторы донорно-акцепторных пар (CO: атом C): «окошко» в облаке — свободное место для чужой пары —
   * смотрит на донора с шага atoms, пока пара не встанет между ядрами (окно формирования пары).
   */
  readonly acceptors: { readonly atom: number; readonly donor: number; readonly closeAt: number }[]
  /** Габарит кадра по шагам (пм, система сцены без поворота): w, h, cx, cy. */
  readonly extent: { w: number; h: number; cx: number; cy: number }[]
}

export type SchoolState = {
  t: number
  step: number
  /** Проявление атомов в начале (0…1) и затухание хвоста (1 → 0). */
  appear: number
  fade: number
  atomPos: Float32Array
  elPos: Float32Array
  elAlpha: Float32Array
  /** Свечение электрона: 1 — неспаренный, меньше — в паре. */
  elGlow: Float32Array
  stickA: Float32Array
  stickB: Float32Array
  stickAlpha: Float32Array
  cloudAmount: number
  cloudFill: Float32Array
  cloudStretch: Float32Array
  cloudDir: Float32Array
  /** «Окошко» свободного места в облаке акцептора (0…1) и его направление. */
  cloudHole: Float32Array
  cloudHoleDir: Float32Array
  labelPos: Float32Array
  labelOpacity: Float32Array
  yaw: number
  pitch: number
  /** Поворот КАЖДОЙ молекулы продукта вокруг своего центра (шаги molecule, result): рыскание и наклон. */
  molYaw: number
  molPitch: number
  /** Вспышка-кольцо в момент, когда общая пара встала между ядрами: позиция (пм), размер (пм), яркость. */
  flashPos: Float32Array
  flashSize: Float32Array
  flashAmount: Float32Array
}

export function schoolSmooth(a: number, b: number, t: number): number {
  if (b <= a) return t >= b ? 1 : 0
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)))
  return x * x * (3 - 2 * x)
}

const lerp = (a: number, b: number, u: number) => a + (b - a) * u

/** Схема слоёв для подписи: «O +8 )2 )6». */
export function layersText(element: string, z: number): string {
  return `${element} +${z} )${particleLevels(z).join(' )')}`
}

export function buildSchoolModel(spec: SchoolSceneSpec): SchoolModel {
  const a = analyzeSchoolSpec(spec)
  if (spec.steps.length !== SCHOOL_STEP_IDS.length) throw new Error(`school scene «${spec.id}»: нужно ровно 6 шагов`)
  spec.steps.forEach((s, i) => {
    if (s.id !== SCHOOL_STEP_IDS[i]) throw new Error(`school scene «${spec.id}»: шаг ${i + 1} должен быть «${SCHOOL_STEP_IDS[i]}», а не «${s.id}»`)
  })
  const step = Object.fromEntries(spec.steps.map((s) => [s.id, { from: s.from, to: s.to }])) as Record<SchoolStepId, { from: number; to: number }>
  const last = spec.steps[spec.steps.length - 1]!
  const finish: SceneFinish = { from: last.to, to: last.to + 1.5, wall: 1.5, ease: 'none' }
  const steps: SceneStep<SchoolStepId>[] = spec.steps.map((s) => ({ id: s.id, from: s.from, to: s.to, wall: s.to - s.from, ease: 'none' }))
  const timing = defineSceneTiming<SchoolStepId, SchoolCueId>({
    steps,
    finish,
    cues: [
      { at: step.breaking.from + 0.9, id: 'bondBreak' },
      { at: step.pairs.from + 0.6, id: 'pairs' },
      { at: step.molecule.from + 0.2, id: 'molecule' },
      { at: finish.from + 0.2, id: 'embryo' },
      { at: finish.from + 0.2, id: 'birth' },
      { at: finish.to, id: 'complete' },
    ],
  })
  timing.validate()

  const n = a.atoms.length
  const ballR = a.atoms.map((x) => x.covalentPm * SCHOOL_DRAW.ballScale)
  const cloudR = ballR.map((r) => Math.max(r * SCHOOL_DRAW.cloudK, SCHOOL_DRAW.cloudMin))

  // ——— окна разрыва: по связям, пары одной связи — с небольшим сдвигом ———
  const bk = step.breaking
  const brokenBonds = [...new Set(a.broken.map((b) => b.rBond))]
  const bSpan = Math.max(0.1, bk.to - bk.from - 0.9 - 0.6 - 1.8)
  const bStep = brokenBonds.length > 1 ? Math.min(0.9, bSpan / (brokenBonds.length - 1)) : 0
  const breakWin: Win[] = a.broken.map((b) => {
    const j = brokenBonds.indexOf(b.rBond)
    const t0 = bk.from + 0.9 + j * bStep + b.pair * 0.3
    return { t0, t1: t0 + 1.5 }
  })
  const moveBreak: Win[] = a.atoms.map((_, i) => {
    let t0 = Infinity
    let t1 = -Infinity
    a.broken.forEach((b, k) => {
      const rb = a.R.bonds[b.rBond]!
      if (rb.a === i || rb.b === i) {
        t0 = Math.min(t0, breakWin[k]!.t0)
        t1 = Math.max(t1, breakWin[k]!.t1)
      }
    })
    if (!Number.isFinite(t0)) return { t0: bk.from + 0.9, t1: bk.to - 0.5 }
    return { t0: t0 - 0.1, t1: Math.min(bk.to - 0.3, t1 + 0.4) }
  })

  // ——— окна образования пар: по связям продукта ———
  const pr = step.pairs
  const formedBonds = [...new Set(a.formed.map((f) => f.pBond))]
  const fDur = 2.2
  const fSpan = Math.max(0.1, pr.to - pr.from - 0.6 - fDur - 0.5)
  const fStep = formedBonds.length > 1 ? Math.min(1.6, fSpan / (formedBonds.length - 1)) : 0
  const formWin: Win[] = a.formed.map((f) => {
    const j = formedBonds.indexOf(f.pBond)
    const t0 = pr.from + 0.6 + j * fStep + (f.pair - a.persistPairs[f.pBond]!) * 0.35
    return { t0, t1: t0 + fDur }
  })
  const movePairs: Win[] = a.atoms.map((_, i) => {
    let t0 = Infinity
    let t1 = -Infinity
    a.formed.forEach((f, k) => {
      const pb = a.P.bonds[f.pBond]!
      if (pb.a === i || pb.b === i) {
        t0 = Math.min(t0, formWin[k]!.t0)
        t1 = Math.max(t1, formWin[k]!.t1)
      }
    })
    if (!Number.isFinite(t0)) return { t0: pr.from + 0.4, t1: pr.to - 0.4 }
    return { t0: t0 - 0.2, t1: Math.min(pr.to - 0.2, t1 - 0.3) }
  })

  // ——— «рыхлые» позиции продукта: координаты молекулы × loose от места молекулы ———
  const loose: V3[] = new Array(n)
  const pPlace: V3[] = new Array(n)
  for (const mol of spec.products) {
    for (const id of mol.atoms) {
      const i = a.index.get(id)!
      const c = mol.coords[id]!
      pPlace[i] = [mol.place[0], mol.place[1], mol.place[2]]
      loose[i] = [mol.place[0] + c[0] * SCHOOL_DRAW.loose, mol.place[1] + c[1] * SCHOOL_DRAW.loose, mol.place[2] + c[2] * SCHOOL_DRAW.loose]
    }
  }

  // ——— штрихи: по одному на пару ———
  const sticks: SchoolStick[] = []
  a.R.bonds.forEach((b, k) =>
    b.pairs.forEach((_, q) => sticks.push({ phase: 'r', bond: k, pair: q, broken: a.broken.findIndex((x) => x.rBond === k && x.pair === q) })),
  )
  a.P.bonds.forEach((b, k) => b.pairs.forEach((_, q) => sticks.push({ phase: 'p', bond: k, pair: q, broken: -1 })))

  const fill = (ph: Phase) => a.atoms.map((x, i) => Math.min(1, shellElectronsOfAtom(ph, i) / x.capacity))

  // ——— подписи ———
  const labels: SchoolLabelDef[] = []
  const all = (s: string): SchoolText => ({ ru: s, en: s, uz: s })
  const end = finish.to
  a.atoms.forEach((x, i) => {
    // На белом (H) и светлых шарах символ — тёмный.
    const light = x.element === 'H' || x.element === 'S' || x.element === 'Cl'
    labels.push({ id: `atom-${x.id}`, kind: light ? 'atomDark' : 'atom', text: all(x.element), anchor: { kind: 'atom', atom: i }, from: 0, to: end })
  })
  const seenEl = new Set<string>()
  a.atoms.forEach((x, i) => {
    if (seenEl.has(x.element)) return
    seenEl.add(x.element)
    labels.push({
      id: `layers-${x.element}`,
      kind: 'measure',
      text: all(layersText(x.element, x.z)),
      anchor: { kind: 'layers', atom: i },
      from: step.atoms.from + 1.6,
      to: step.breaking.from + 1.0,
    })
  })
  spec.reactants.forEach((m, k) => {
    // Состояние вещества — токеном ({g} → «г.» / «g» / «gaz»), как у подписей NaCl.
    labels.push({ id: `molR-${m.id}`, kind: 'species', text: all(`${m.formula} ({${m.state}})`), anchor: { kind: 'molR', mol: k }, from: 0.3, to: step.breaking.from + 0.7 })
  })
  spec.products.forEach((m, k) => {
    labels.push({ id: `molP-${m.id}`, kind: 'species', text: all(m.formula), anchor: { kind: 'molP', mol: k }, from: step.molecule.from + 1.0, to: end })
  })
  // Угол — у первой молекулы каждой формулы (у одинаковых молекул он одинаков): N₂O и H₂O — оба.
  const angled = new Set<string>()
  const angleMols = spec.products.filter((mol) => !angled.has(mol.formula) && angled.add(mol.formula))
  for (const ang of angleMols.flatMap((mol) => (mol.angles ?? []).filter((x) => x.label !== false))) {
    const deg = angleDegOf(spec, ang)
    const txt = `∠${ang.a.replace(/\d+$/, '')}${ang.center.replace(/\d+$/, '')}${ang.b.replace(/\d+$/, '')} = ${deg}°`
    const [ia, ic, ib] = [a.index.get(ang.a)!, a.index.get(ang.center)!, a.index.get(ang.b)!]
    const others = a.P.bonds
      .filter((b) => b.a === ic || b.b === ic)
      .map((b) => (b.a === ic ? b.b : b.a))
      .filter((j) => j !== ia && j !== ib)
    labels.push({
      id: `angle-${ang.a}-${ang.center}-${ang.b}`,
      kind: 'measure',
      text: all(txt),
      anchor: { kind: 'angle', a: ia, center: ic, b: ib, others },
      from: step.molecule.from + 1.8,
      to: end,
    })
  }
  // Донорно-акцепторная пара (у первой молекулы продукта): стрелка «O → C» над связью, пока пара
  // целиком переходит от донора к связи.
  const acceptors: { atom: number; donor: number; closeAt: number }[] = []
  a.formed.forEach((fp, k) => {
    const b = a.P.bonds[fp.pBond]!
    const o = b.pairs[fp.pair]!
    if (o === 'ab') return
    const donor = o === 'a' ? b.a : b.b
    const acc = donor === b.a ? b.b : b.a
    acceptors.push({ atom: acc, donor, closeAt: formWin[k]!.t1 })
    if (b.molecule !== 0) return
    const D = a.atoms[donor]!.element
    const A = a.atoms[acc]!.element
    labels.push({
      id: `dative-${fp.pBond}-${fp.pair}`,
      kind: 'token',
      text: { ru: `донорная пара ${D} → ${A}`, en: `donor pair ${D} → ${A}`, uz: `donor juft ${D} → ${A}` },
      anchor: { kind: 'bond', bond: fp.pBond },
      from: formWin[k]!.t0,
      to: step.molecule.from + 0.6,
    })
  })
  labels.push({ id: 'caption-reactants', kind: 'species', text: spec.captions.reactants, anchor: { kind: 'top' }, from: 0.3, to: step.atoms.to - 0.2 })
  if (spec.captions.condition) {
    labels.push({ id: 'condition', kind: 'token', text: spec.captions.condition, anchor: { kind: 'center' }, from: step.breaking.from + 0.1, to: step.breaking.from + 2.4 })
  }
  labels.push({ id: 'caption-result', kind: 'species', text: spec.captions.result, anchor: { kind: 'top' }, from: step.result.from + 0.3, to: end })
  // Итог: уравнение, условие реакции — над стрелкой (как в учебнике: →t°, ⇄ кат. V₂O₅).
  const cond = spec.captions.condition
  labels.push({
    id: 'equation',
    kind: 'equation',
    text: {
      ru: equationWithCondition(spec.equation, cond?.ru),
      en: equationWithCondition(spec.equation, cond?.en),
      uz: equationWithCondition(spec.equation, cond?.uz),
    },
    anchor: { kind: 'bottom' },
    from: step.result.from + 0.8,
    to: end,
  })

  // ——— габарит кадра по шагам ———
  const extent = spec.steps.map((s) => {
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    const probe = (P: readonly V3[]) => {
      P.forEach((p, i) => {
        const r = cloudR[i]! * 1.35
        const rx = Math.max(Math.abs(p[0]), Math.abs(p[2]))
        minX = Math.min(minX, -rx - r, p[0] - r)
        maxX = Math.max(maxX, rx + r, p[0] + r)
        minY = Math.min(minY, p[1] - r)
        maxY = Math.max(maxY, p[1] + r)
      })
    }
    if (s.id === 'reactants' || s.id === 'atoms') probe(a.R.pos)
    if (s.id === 'breaking') {
      probe(a.R.pos)
      probe(a.S.pos)
    }
    if (s.id === 'pairs') {
      probe(a.S.pos)
      probe(loose)
    }
    if (s.id === 'molecule' || s.id === 'result') probe(a.P.pos)
    // Полосы подписей сверху и снизу; на шагах molecule / result — и формулы продуктов по бокам.
    const pad = 48
    const side = s.id === 'molecule' || s.id === 'result' ? 70 : 0
    return { w: maxX - minX + 2 * side, h: maxY - minY + 2 * pad, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 }
  })

  // Кадр не «прыгает» по масштабу между шагами: габарит шага — не меньше 0,8 общего.
  const gw = Math.max(...extent.map((e) => e.w))
  const gh = Math.max(...extent.map((e) => e.h))
  for (const e of extent) {
    e.w = Math.max(e.w, 0.8 * gw)
    e.h = Math.max(e.h, 0.8 * gh)
  }

  return {
    a,
    spec,
    timing,
    finish,
    step,
    ballR,
    cloudR,
    breakWin,
    formWin,
    moveBreak,
    movePairs,
    loose,
    pPlace,
    formedPlace: a.formed.map((fp) => ({ kind: 'bond', bond: fp.pBond, pair: fp.pair, slot: 0 }) as const),
    sticks,
    labels,
    fillR: fill(a.R),
    fillS: fill(a.S),
    fillP: fill(a.P),
    acceptors,
    extent,
  }
}

export function createSchoolState(m: SchoolModel): SchoolState {
  const n = m.a.atoms.length
  const e = m.a.electrons.length
  const k = m.sticks.length
  const l = m.labels.length
  return {
    t: 0,
    step: 0,
    appear: 0,
    fade: 1,
    atomPos: new Float32Array(n * 3),
    elPos: new Float32Array(e * 3),
    elAlpha: new Float32Array(e),
    elGlow: new Float32Array(e),
    stickA: new Float32Array(k * 3),
    stickB: new Float32Array(k * 3),
    stickAlpha: new Float32Array(k),
    cloudAmount: 0,
    cloudFill: new Float32Array(n),
    cloudStretch: new Float32Array(n),
    cloudDir: new Float32Array(n * 3),
    cloudHole: new Float32Array(n),
    cloudHoleDir: new Float32Array(n * 3),
    labelPos: new Float32Array(l * 3),
    labelOpacity: new Float32Array(l),
    yaw: 0,
    pitch: 0,
    molYaw: 0,
    molPitch: 0,
    flashPos: new Float32Array(m.a.formed.length * 3),
    flashSize: new Float32Array(m.a.formed.length),
    flashAmount: new Float32Array(m.a.formed.length),
  }
}

/** Поворот вектора (x, y, z) наклоном p вокруг x, затем рысканием y вокруг вертикали → out. */
function rotYX(x: number, y: number, z: number, yaw: number, pitch: number, out: number[]): void {
  const cp = Math.cos(pitch)
  const sp = Math.sin(pitch)
  const cy = Math.cos(yaw)
  const sy = Math.sin(yaw)
  const y1 = y * cp - z * sp
  const z1 = y * sp + z * cp
  out[0] = x * cy + z1 * sy
  out[1] = y1
  out[2] = -x * sy + z1 * cy
}
const _r: number[] = [0, 0, 0]
const _sq: number[] = [0, 0, 0]
/** Доля z у неподелённой пары, смотрящей в камеру (см. electronPlace): 1 — как есть, 0 — в плоскости кадра. */
const FRONT_SQUASH = 0.35

// ——— рабочие буферы (ноль аллокаций в кадре) ———
/** Текущий поворот молекул продукта (ставит sampleSchoolState до расчёта мест электронов). */
const rot = { yaw: 0, pitch: 0 }
const _p: number[] = [0, 0, 0]
const _q: number[] = [0, 0, 0]

/** Позиция места электрона в фазе ph при текущих позициях атомов pos (пм) → out[0..2]. */
function placePos(m: SchoolModel, ph: Phase, place: ElectronPlace, pos: Float32Array, collapse: number, out: number[]): void {
  const D = SCHOOL_DRAW
  if (place.kind === 'bond') {
    const b = ph.bonds[place.bond]!
    const ia = b.a * 3
    const ib = b.b * 3
    let ux = pos[ib]! - pos[ia]!
    let uy = pos[ib + 1]! - pos[ia + 1]!
    let uz = pos[ib + 2]! - pos[ia + 2]!
    const dist = Math.hypot(ux, uy, uz) || 1
    ux /= dist
    uy /= dist
    uz /= dist
    const ra = m.ballR[b.a]!
    const rb = m.ballR[b.b]!
    const gap = dist - ra - rb
    // Общая пара смещена к более электроотрицательному атому (ковалентная полярная связь).
    const dEn = m.a.atoms[b.b]!.en - m.a.atoms[b.a]!.en
    const shift = Math.max(-0.16, Math.min(0.16, 0.12 * dEn))
    const along = ra + gap * (0.5 + shift)
    // Поперёк оси — в плоскости кадра (перпендикуляр к оси и к z).
    let nx = uy
    let ny = -ux
    const nl = Math.hypot(nx, ny)
    if (nl < 1e-3) {
      nx = 1
      ny = 0
    } else {
      nx /= nl
      ny /= nl
    }
    const cnt = b.pairs.length
    const off = (place.pair - (cnt - 1) / 2) * D.pairSpacing
    const sep = ((place.slot === 0 ? -1 : 1) * D.dotSep * 0.5) * collapse
    out[0] = pos[ia]! + ux * (along + sep) + nx * off
    out[1] = pos[ia + 1]! + uy * (along + sep) + ny * off
    out[2] = pos[ia + 2]! + uz * (along + sep)
    return
  }
  const i = place.atom
  const pa = ph.atoms[i]!
  let d: readonly number[] = place.kind === 'lone' ? pa.loneDirs[place.pair]! : pa.singleDirs[place.index]!
  // Молекула продукта повёрнута вокруг своего центра — её неподелённые пары поворачиваются вместе с ней.
  if (ph === m.a.P && (rot.yaw !== 0 || rot.pitch !== 0)) {
    rotYX(d[0]!, d[1]!, d[2]!, rot.yaw, rot.pitch, _r)
    d = _r
  }
  // Пара объёмного атома (O в H₂O, в группе OH), смотрящая почти в камеру, ложилась на символ элемента:
  // прижимаем её к плоскости кадра (z × FRONT_SQUASH), как в точечной формуле учебника — пара остаётся
  // по ту же сторону плоскости (знак z) и с той же стороны атома, только не закрывает букву.
  // Прижатие плавное (по z и по доле направления в плоскости) — при повороте молекулы пара не прыгает.
  const sq = place.kind === 'lone' ? schoolSmooth(0.2, 0.5, d[2]!) * schoolSmooth(0.1, 0.3, Math.hypot(d[0]!, d[1]!)) : 0
  if (sq > 0) {
    const z = d[2]! * (1 - (1 - FRONT_SQUASH) * sq)
    const l = Math.hypot(d[0]!, d[1]!, z)
    _sq[0] = d[0]! / l
    _sq[1] = d[1]! / l
    _sq[2] = z / l
    d = _sq
  }
  // Пара, смотрящая от зрителя (−z), при перспективе прячется за свой шар: отодвигаем её от ядра
  // по тому же направлению (число и направление пар не меняются — только читаемость кадра).
  const r = m.ballR[i]! + D.shellGap + D.backLift * Math.max(0, -d[2]!)
  let cx = pos[i * 3]! + d[0]! * r
  let cy = pos[i * 3 + 1]! + d[1]! * r
  let cz = pos[i * 3 + 2]! + d[2]! * r
  if (place.kind === 'lone') {
    // Два электрона пары — поперёк направления пары.
    let tx = d[1]!
    let ty = -d[0]!
    let tz = 0
    let tl = Math.hypot(tx, ty)
    if (tl < 0.2) {
      tx = 0
      ty = d[2]!
      tz = -d[1]!
      tl = Math.hypot(ty, tz) || 1
    }
    const s = ((place.slot === 0 ? -1 : 1) * D.dotSep * 0.5) / tl
    cx += tx * s
    cy += ty * s
    cz += tz * s
  }
  out[0] = cx
  out[1] = cy
  out[2] = cz
}

function writeLerpPos(out: Float32Array, i: number, A: readonly number[], B: readonly number[], u: number): void {
  out[i * 3] = lerp(A[0]!, B[0]!, u)
  out[i * 3 + 1] = lerp(A[1]!, B[1]!, u)
  out[i * 3 + 2] = lerp(A[2]!, B[2]!, u)
}

function edge(t: number, from: number, to: number, fade = 0.45): number {
  return schoolSmooth(from, from + fade, t) * (1 - schoolSmooth(to - fade, to, t))
}

export function sampleSchoolState(m: SchoolModel, t: number, s: SchoolState): SchoolState {
  const { a, step } = m
  const D = SCHOOL_DRAW
  s.t = t
  s.step = m.timing.stepIndexAt(t)
  s.appear = schoolSmooth(0, 0.8, t)
  s.fade = 1 - schoolSmooth(m.finish.from, m.finish.to - 0.2, t)
  const n = a.atoms.length

  // ——— поворот каждой молекулы продукта вокруг своего центра (без общего облёта: у далёких от центра
  // молекул перспектива не раздувает размер). Наклон показывает обе неподелённые пары O (они вне
  // плоскости H–O–H), рыскание — объём молекулы. ———
  const mt = schoolSmooth(step.molecule.from + 1.0, step.molecule.to - 0.3, t)
  const turn = m.spec.productTurn ?? 1
  rot.pitch = lerp(0, 0.5 * turn, mt)
  rot.yaw = (t < step.result.from ? lerp(0, 0.42, mt) : lerp(0.42, -0.62, schoolSmooth(step.result.from, m.finish.from, t))) * turn
  s.molYaw = rot.yaw
  s.molPitch = rot.pitch

  // ——— атомы ———
  const inBreak = t < step.pairs.from
  for (let i = 0; i < n; i++) {
    const R = a.R.pos[i]!
    const S = a.S.pos[i]!
    const L = m.loose[i]!
    const P = a.P.pos[i]!
    if (inBreak) {
      const w = m.moveBreak[i]!
      writeLerpPos(s.atomPos, i, R, S, schoolSmooth(w.t0, w.t1, t))
    } else if (t < step.molecule.from) {
      const w = m.movePairs[i]!
      writeLerpPos(s.atomPos, i, S, L, schoolSmooth(w.t0, w.t1, t))
    } else {
      writeLerpPos(s.atomPos, i, L, P, schoolSmooth(step.molecule.from, step.molecule.from + 1.3, t))
      if (rot.yaw !== 0 || rot.pitch !== 0) {
        const c = m.pPlace[i]!
        const o = i * 3
        rotYX(s.atomPos[o]! - c[0], s.atomPos[o + 1]! - c[1], s.atomPos[o + 2]! - c[2], rot.yaw, rot.pitch, _r)
        s.atomPos[o] = c[0] + _r[0]!
        s.atomPos[o + 1] = c[1] + _r[1]!
        s.atomPos[o + 2] = c[2] + _r[2]!
      }
    }
  }

  // ——— электроны ———
  const eOn = schoolSmooth(step.atoms.from + 0.5, step.atoms.from + 1.5, t)
  const shrink = schoolSmooth(step.molecule.from + 0.5, step.molecule.from + 1.8, t)
  for (let k = 0; k < a.electrons.length; k++) {
    const e = a.electrons[k]!
    let alpha = eOn
    let glow: number
    if (t < step.breaking.from) {
      placePos(m, a.R, e.r, s.atomPos, 1, _p)
      s.elPos[k * 3] = _p[0]!
      s.elPos[k * 3 + 1] = _p[1]!
      s.elPos[k * 3 + 2] = _p[2]!
      // Пара, которая перед связыванием распарится (splitElectrons: C в CO₂, S в SO₂ / SO₃), подсвечена.
      glow = e.r.kind === 'single' ? 1 : e.r.kind === 'lone' && e.s.kind === 'single' ? 0.7 : 0.3
    } else if (t < step.pairs.from) {
      const w = e.broken >= 0 ? m.breakWin[e.broken]! : m.moveBreak[e.owner]!
      const u = schoolSmooth(w.t0 + 0.15, w.t1, t)
      placePos(m, a.R, e.r, s.atomPos, 1, _p)
      placePos(m, a.S, e.s, s.atomPos, 1, _q)
      writeLerpPos(s.elPos, k, _p, _q, u)
      glow = lerp(e.r.kind === 'single' ? 1 : e.r.kind === 'lone' && e.s.kind === 'single' ? 0.7 : 0.3, e.s.kind === 'single' ? 1 : 0.3, u)
    } else if (t < step.molecule.from) {
      const w = e.formed >= 0 ? m.formWin[e.formed]! : m.movePairs[e.owner]!
      const u = e.formed >= 0 ? schoolSmooth(w.t0 + 0.55, w.t1, t) : schoolSmooth(w.t0, w.t1, t)
      placePos(m, a.S, e.s, s.atomPos, 1, _p)
      placePos(m, a.P, e.p, s.atomPos, 1, _q)
      writeLerpPos(s.elPos, k, _p, _q, u)
      glow = lerp(e.s.kind === 'single' ? 1 : 0.3, e.p.kind === 'single' ? 1 : 0.3, u)
    } else {
      const bond = e.p.kind === 'bond'
      placePos(m, a.P, e.p, s.atomPos, bond ? 1 - shrink : 1, _p)
      s.elPos[k * 3] = _p[0]!
      s.elPos[k * 3 + 1] = _p[1]!
      s.elPos[k * 3 + 2] = _p[2]!
      // Общая пара стягивается в штрих связи.
      if (bond) alpha *= 1 - shrink
      glow = e.p.kind === 'single' ? 1 : 0.3
    }
    s.elAlpha[k] = alpha * s.fade
    s.elGlow[k] = glow
  }

  // ——— вспышка образования пары: кольцо расходится от середины пары, когда оба электрона на месте ———
  for (let k = 0; k < a.formed.length; k++) {
    const w = m.formWin[k]!
    const x = (t - (w.t1 - 0.25)) / 0.8
    if (x <= 0 || x >= 1 || t >= step.molecule.from) {
      s.flashAmount[k] = 0
      continue
    }
    placePos(m, a.P, m.formedPlace[k]!, s.atomPos, 0, _p)
    s.flashPos[k * 3] = _p[0]!
    s.flashPos[k * 3 + 1] = _p[1]!
    s.flashPos[k * 3 + 2] = _p[2]!
    s.flashSize[k] = 18 + 46 * x
    s.flashAmount[k] = Math.sin(Math.PI * Math.min(1, x * 1.6)) * (1 - x) * s.fade
  }

  // ——— штрихи ———
  const rDim = lerp(1, 0.22, schoolSmooth(step.atoms.from + 0.3, step.atoms.from + 1.3, t))
  const pOn = schoolSmooth(step.molecule.from + 0.5, step.molecule.from + 1.8, t)
  for (let k = 0; k < m.sticks.length; k++) {
    const st = m.sticks[k]!
    const ph = st.phase === 'r' ? a.R : a.P
    const b = ph.bonds[st.bond]!
    let alpha: number
    if (st.phase === 'r') {
      alpha = rDim
      const kept = st.pair < a.keptPairs[st.bond]!
      if (kept) alpha *= 1 - pOn
      else {
        const w = m.breakWin[st.broken]!
        alpha *= 1 - schoolSmooth(w.t0, w.t0 + 0.5, t)
      }
    } else alpha = pOn
    const ia = b.a * 3
    const ib = b.b * 3
    const ux = s.atomPos[ib]! - s.atomPos[ia]!
    const uy = s.atomPos[ib + 1]! - s.atomPos[ia + 1]!
    const dl = Math.hypot(ux, uy)
    let nx = dl > 1e-3 ? uy / dl : 1
    let ny = dl > 1e-3 ? -ux / dl : 0
    const off = (st.pair - (b.pairs.length - 1) / 2) * D.stickSpacing
    nx *= off
    ny *= off
    s.stickA[k * 3] = s.atomPos[ia]! + nx
    s.stickA[k * 3 + 1] = s.atomPos[ia + 1]! + ny
    s.stickA[k * 3 + 2] = s.atomPos[ia + 2]!
    s.stickB[k * 3] = s.atomPos[ib]! + nx
    s.stickB[k * 3 + 1] = s.atomPos[ib + 1]! + ny
    s.stickB[k * 3 + 2] = s.atomPos[ib + 2]!
    s.stickAlpha[k] = alpha * s.appear * s.fade
  }

  // ——— облака внешнего слоя ———
  s.cloudAmount =
    schoolSmooth(step.atoms.from, step.atoms.from + 1.1, t) * lerp(1, 0.14, schoolSmooth(step.molecule.from + 0.4, step.molecule.from + 1.8, t)) * s.fade
  for (let i = 0; i < n; i++) {
    let f: number
    let stretch = 0
    s.cloudDir[i * 3] = 1
    s.cloudDir[i * 3 + 1] = 0
    s.cloudDir[i * 3 + 2] = 0
    if (inBreak) {
      const w = m.moveBreak[i]!
      f = lerp(m.fillR[i]!, m.fillS[i]!, schoolSmooth(w.t0 + 0.3, w.t1, t))
    } else {
      // Заполнение растёт с каждой образованной парой атома; облако тянется к партнёру.
      let got = 0
      let need = 0
      for (let k = 0; k < a.formed.length; k++) {
        const fp = a.formed[k]!
        const b = a.P.bonds[fp.pBond]!
        if (b.a !== i && b.b !== i) continue
        need++
        const w = m.formWin[k]!
        got += schoolSmooth(w.t0 + 0.9, w.t1, t)
        const u = (t - w.t0) / (w.t1 - w.t0)
        if (u > 0 && u < 1) {
          const other = b.a === i ? b.b : b.a
          const dx = s.atomPos[other * 3]! - s.atomPos[i * 3]!
          const dy = s.atomPos[other * 3 + 1]! - s.atomPos[i * 3 + 1]!
          const dz = s.atomPos[other * 3 + 2]! - s.atomPos[i * 3 + 2]!
          const dl = Math.hypot(dx, dy, dz) || 1
          const k2 = Math.sin(Math.PI * u) * 0.32
          if (k2 > stretch) {
            stretch = k2
            s.cloudDir[i * 3] = dx / dl
            s.cloudDir[i * 3 + 1] = dy / dl
            s.cloudDir[i * 3 + 2] = dz / dl
          }
        }
      }
      f = need > 0 ? lerp(m.fillS[i]!, m.fillP[i]!, got / need) : lerp(m.fillS[i]!, m.fillP[i]!, schoolSmooth(step.pairs.from, step.molecule.from, t))
    }
    s.cloudFill[i] = f
    s.cloudStretch[i] = stretch
    s.cloudHole[i] = 0
  }
  // «Окошко» свободного места у акцептора — на донора; закрывается, когда донорная пара встала.
  for (const ac of m.acceptors) {
    const h = schoolSmooth(step.atoms.from + 1.2, step.atoms.from + 2.2, t) * (1 - schoolSmooth(ac.closeAt - 0.6, ac.closeAt, t))
    if (h <= s.cloudHole[ac.atom]!) continue
    const i = ac.atom
    const dx = s.atomPos[ac.donor * 3]! - s.atomPos[i * 3]!
    const dy = s.atomPos[ac.donor * 3 + 1]! - s.atomPos[i * 3 + 1]!
    const dz = s.atomPos[ac.donor * 3 + 2]! - s.atomPos[i * 3 + 2]!
    const dl = Math.hypot(dx, dy, dz) || 1
    s.cloudHole[i] = h
    s.cloudHoleDir[i * 3] = dx / dl
    s.cloudHoleDir[i * 3 + 1] = dy / dl
    s.cloudHoleDir[i * 3 + 2] = dz / dl
  }

  // ——— подписи (позиции в системе сцены, пм) ———
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (let i = 0; i < n; i++) {
    const r = m.cloudR[i]!
    minX = Math.min(minX, s.atomPos[i * 3]! - r)
    maxX = Math.max(maxX, s.atomPos[i * 3]! + r)
    minY = Math.min(minY, s.atomPos[i * 3 + 1]! - r)
    maxY = Math.max(maxY, s.atomPos[i * 3 + 1]! + r)
  }
  for (let k = 0; k < m.labels.length; k++) {
    const l = m.labels[k]!
    const o = k * 3
    const an = l.anchor
    let op = edge(t, l.from, l.to)
    if (an.kind === 'atom') {
      s.labelPos[o] = s.atomPos[an.atom * 3]!
      s.labelPos[o + 1] = s.atomPos[an.atom * 3 + 1]!
      // Сдвиг к зрителю на радиус шара добавляет сцена — в системе root (после поворота плана).
      s.labelPos[o + 2] = s.atomPos[an.atom * 3 + 2]!
      op = s.appear
    } else if (an.kind === 'layers') {
      s.labelPos[o] = s.atomPos[an.atom * 3]!
      s.labelPos[o + 1] = s.atomPos[an.atom * 3 + 1]! + m.cloudR[an.atom]! * 1.55 + 16
      s.labelPos[o + 2] = s.atomPos[an.atom * 3 + 2]!
    } else if (an.kind === 'molR' || an.kind === 'molP') {
      const mol = an.kind === 'molR' ? m.spec.reactants[an.mol]! : m.spec.products[an.mol]!
      let x0 = Infinity
      let x1 = -Infinity
      let y0 = Infinity
      let y1 = -Infinity
      const ids = mol.atoms
      for (let j = 0; j < ids.length; j++) {
        const i = a.index.get(ids[j]!)!
        x0 = Math.min(x0, s.atomPos[i * 3]! - m.cloudR[i]!)
        x1 = Math.max(x1, s.atomPos[i * 3]! + m.cloudR[i]!)
        y0 = Math.min(y0, s.atomPos[i * 3 + 1]! - m.cloudR[i]!)
        y1 = Math.max(y1, s.atomPos[i * 3 + 1]! + m.cloudR[i]!)
      }
      if (an.kind === 'molR') {
        s.labelPos[o] = (x0 + x1) / 2
        s.labelPos[o + 1] = y0 - 26
      } else {
        // Формула продукта — с внешней стороны: у левой молекулы слева, у правой (и центральной) справа,
        // чтобы подпись в промежутке не читалась как подпись соседней молекулы.
        s.labelPos[o] = mol.place[0] < -1 ? x0 - 46 : x1 + 46
        s.labelPos[o + 1] = (y0 + y1) / 2
      }
      s.labelPos[o + 2] = 0
    } else if (an.kind === 'angle') {
      const c = an.center * 3
      // Биссектриса — по ЕДИНИЧНЫМ векторам к соседям: у линейной молекулы с разными длинами связей
      // (N–N–O) середина соседей не совпадает с центром, но биссектрисы нет — подпись над центром.
      const ax = s.atomPos[an.a * 3]! - s.atomPos[c]!
      const ay = s.atomPos[an.a * 3 + 1]! - s.atomPos[c + 1]!
      const cx = s.atomPos[an.b * 3]! - s.atomPos[c]!
      const cy = s.atomPos[an.b * 3 + 1]! - s.atomPos[c + 1]!
      const al = Math.hypot(ax, ay) || 1
      const cl = Math.hypot(cx, cy) || 1
      const bx = ax / al + cx / cl
      const by = ay / al + cy / cl
      const bl = Math.hypot(bx, by) > 0.05 ? Math.hypot(bx, by) : 0
      // Подпись угла — с внешней стороны атома (против биссектрисы угла), над облаком. У линейной
      // молекулы (CO₂, 180°) биссектрисы нет — подпись над центральным атомом. Если у центра три
      // соседа и больше (N в HNO₃), снаружи стоит третий атом, а внутри угла — концевые атомы:
      // подпись — над всей молекулой (на телефоне плашка крупнее молекулы и закрыла бы атомы).
      let nb = 0
      for (const b of a.P.bonds) if (b.a === an.center || b.b === an.center) nb++
      if (nb >= 3) {
        const id = a.atoms[an.center]!.id
        const mol = m.spec.products.find((p) => p.atoms.includes(id))
        let top = s.atomPos[c + 1]! + m.cloudR[an.center]!
        for (const aid of mol?.atoms ?? []) {
          const i = a.index.get(aid)!
          top = Math.max(top, s.atomPos[i * 3 + 1]! + m.cloudR[i]!)
        }
        s.labelPos[o] = s.atomPos[c]!
        s.labelPos[o + 1] = top + 30
        s.labelPos[o + 2] = s.atomPos[c + 2]!
      } else {
        const r = m.cloudR[an.center]! * 1.6 + 20
        const ux = bl > 1e-3 ? -bx / bl : 0
        const uy = bl > 1e-3 ? -by / bl : 1
        s.labelPos[o] = s.atomPos[c]! + ux * r
        s.labelPos[o + 1] = s.atomPos[c + 1]! + uy * r
        s.labelPos[o + 2] = s.atomPos[c + 2]!
      }
    } else if (an.kind === 'bond') {
      const b = a.P.bonds[an.bond]!
      const ax = s.atomPos[b.a * 3]!
      const ay = s.atomPos[b.a * 3 + 1]!
      const bx = s.atomPos[b.b * 3]!
      const by = s.atomPos[b.b * 3 + 1]!
      // Над серединой связи, поперёк оси (вверх по кадру), за облаками атомов.
      let nx = -(by - ay)
      let ny = bx - ax
      const nl = Math.hypot(nx, ny) || 1
      nx /= nl
      ny /= nl
      if (ny < 0) {
        nx = -nx
        ny = -ny
      }
      const r = Math.max(m.cloudR[b.a]!, m.cloudR[b.b]!) * 1.25 + 14
      s.labelPos[o] = (ax + bx) / 2 + nx * r
      s.labelPos[o + 1] = (ay + by) / 2 + ny * r
      s.labelPos[o + 2] = (s.atomPos[b.a * 3 + 2]! + s.atomPos[b.b * 3 + 2]!) / 2
    } else if (an.kind === 'top') {
      s.labelPos[o] = (minX + maxX) / 2
      s.labelPos[o + 1] = maxY + 40
      s.labelPos[o + 2] = 0
    } else if (an.kind === 'bottom') {
      s.labelPos[o] = (minX + maxX) / 2
      s.labelPos[o + 1] = minY - 40
      s.labelPos[o + 2] = 0
    } else {
      s.labelPos[o] = (minX + maxX) / 2
      s.labelPos[o + 1] = (minY + maxY) / 2
      s.labelPos[o + 2] = 0
    }
    s.labelOpacity[k] = op * s.fade
  }

  // ——— план: лёгкий взгляд сверху, без облёта всей композиции ———
  s.pitch = 0.12
  s.yaw = -0.06
  return s
}

/** Габарит кадра на момент t (пм): шаг, в котором t. */
export function schoolExtentAt(m: SchoolModel, t: number): { w: number; h: number; cx: number; cy: number } {
  return m.extent[m.timing.stepIndexAt(t)]!
}

/** Текст подписи на языке. */
export function schoolLabelText(l: SchoolLabelDef, locale: SchoolLocale): string {
  return l.text[locale]
}
