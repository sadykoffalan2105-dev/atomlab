import * as THREE from 'three'
import { halfLine, oxPlain, type ReactionStory, type StoryOxChange } from '../../../../chemistry/reactionStory'
import { schoolAtomColor, schoolAtomHex, schoolLabelDark } from '../../../../components/lab/hero/schoolHeroStyle'
import type { DomLabelSource } from '../../react/CinemaDomLabels'
import type { SceneLocale } from '../kit/sceneKit'
import { naclHaloTexture, naclSphereGeometry, NACL_RIM, withNaclRim } from '../nacl/naclLatticeView'
import type { SchoolRuntimeOptions, SchoolRuntimeScene, SchoolRuntimeStatus } from '../school/schoolRuntime'
import { buildStoryLayout, smooth, storyAtomPos, storyAtomRadius, STORY_LAYER_BRIGHT, type StoryLayout } from './storyLayout'
import { STORY_FX_HZ, storyPulse, storyVibOffset, storyVibWindow } from './storyMotion'
import {
  buildStoryPairs,
  pairsVisibility,
  storyBondDot,
  storyBondVis,
  storyFlightPoint,
  storyLoneDot,
  storyLoneVis,
  STORY_E_R,
  type StoryPairs,
} from './storyPairs'
import { buildStoryEnv, envDrift, type StoryEnv } from './storyPhase'

/**
 * СЦЕНА «СЮЖЕТ РЕАКЦИИ» — анимация после синтеза для реакций без своей школьной сцены (интерфейс
 * SchoolRuntimeScene: её крутит тот же R3F-адаптер SchoolCinemaScene, панель урока — clo2StepStore).
 *
 * Шаги (13–20 с): Исходные → Разрыв → Перенос электронов (только ОВР) → Образование → Итог.
 * Школьный вид: матовые CPK-шары с символом внутри (DOM-подписи), серые палочки-связи, ионы ионных веществ
 * касаются друг друга (фрагмент решётки, без палочек).
 * Перенос e⁻ — главный момент: восстановитель светится тёплым, окислитель — холодным, остальные атомы притушены;
 * электроны — яркие точки с хвостом, летят по дуге по одному (у больших чисел — волнами с подписью «e⁻ ×n»);
 * чип степени окисления над атомом «щёлкает» в момент отлёта/прилёта; рядом — стеклянная карточка полуреакций
 * и «отдано = принято», после последнего прилёта — пауза-акцент.
 * Образование: новые связи — по одной, с мягкой вспышкой; сохранённая группа (SO₄²⁻ …) подсвечена целиком.
 * Номер шага и уравнение — в панели урока, в кадре их не дублируем.
 * Кадр — чистая функция времени (storyLayout.storyAtomPos): перемотка и повтор шага дают тот же кадр.
 * Атомы одни и те же весь ролик — ни один не исчезает и не появляется из ниоткуда.
 * Огромные реакции (lay.compact): у члена читается одна лицевая копия, остальные — тёмная стопка позади; подписи,
 * чипы, свечение ролей и вспышки — только у лицевых копий, e⁻ летят волной «×n» от стопки к стопке.
 * Производительность: атомы, палочки, электроны — три InstancedMesh; ноль аллокаций в update.
 *
 * v2 (как «Как образуется» v2): без тряски — тепловые колебания только на «Исходных» (≤ 4 пм, ≤ 1,5 Гц, плавный
 * разгон, затухание за 1 с на разрыве; storyMotion.ts), прочие пульсы ≤ 1,5 Гц, в «Итоге» — неподвижно;
 * электронные пары и облака-лепестки у участников связей на «Разрыве / Переносе e⁻ / Образовании» (storyPairs.ts:
 * σ на оси, π сбоку, неподелённые пары наружу; лепестки — один InstancedMesh, один аддитивный материал, без
 * источников света); «Итог» как в жизни при 25 °C (storyPhase.ts): кристалл — фрагмент решётки своего типа позади
 * продукта, газ — молекулы расходятся и поднимаются, жидкость — плотно, раствор — частицы среди молекул воды.
 */

const BG = new THREE.Color('#0a0b10')
const MATTE = { roughness: 0.84, metalness: 0, clearcoat: 0, clearcoatRoughness: 0.4, specularIntensity: 0.16 } as const
const ELECTRON_COLOR = new THREE.Color(0x9ee4ff)
/** облака-лепестки (аддитивно: тусклее цвет — прозрачнее) */
const PETAL_COLOR = new THREE.Color(0x6fb8ff)
const PETAL_GAIN = 0.32
/** окружение итога темнее продукта (глубина) */
const ENV_DIM = 0.78
/** электрон пары */
const PAIR_E_R = STORY_E_R
const DONOR_COLOR = new THREE.Color(0xff9a3c)
const ACCEPTOR_COLOR = new THREE.Color(0x4fb2ff)
const KEPT_COLOR = new THREE.Color(0xb48cff)
const BOND_FLASH_COLOR = new THREE.Color(0xfff0c8)
const STICK_R = 0.052
const MAX_ATOM_LABELS_ALL = 52
const MAX_OX_CHIPS_ALL = 6
const MAX_E_TOKENS = 6
/** хвост электрона: столько «призраков» позади точки */
const TAIL = 7

/** Доля пути e⁻ в момент t: плавный разгон и торможение (easeInOutCubic) — без «телепорта» в начале и конце. */
function flightU(t0: number, t1: number, t: number): number {
  const x = t <= t0 ? 0 : t >= t1 ? 1 : (t - t0) / (t1 - t0)
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
}
/** притушить атомы-зрители на шаге переноса (доля яркости) */
const SPECTATOR_DIM = 0.42

const HALF_TAGS: Readonly<Record<SceneLocale, { reducer: string; oxidizer: string; balance: (g: string, a: string) => string }>> = {
  ru: { reducer: 'восстановитель', oxidizer: 'окислитель', balance: (g, a) => `отдано ${g}e⁻ = принято ${a}e⁻` },
  en: { reducer: 'reducing agent', oxidizer: 'oxidizing agent', balance: (g, a) => `given ${g}e⁻ = accepted ${a}e⁻` },
  uz: { reducer: 'qaytaruvchi', oxidizer: 'oksidlovchi', balance: (g, a) => `berildi ${g}e⁻ = qabul qilindi ${a}e⁻` },
}

type Cue = { at: number; id: 'embryo' | 'birth' | 'complete' }

export class ReactionStoryScene implements SchoolRuntimeScene {
  readonly root = new THREE.Group()
  readonly background = BG.clone()
  readonly labels: DomLabelSource[] = []
  readonly model: { readonly timing: { stepIndexAt: (t: number) => number }; readonly finish: { readonly from: number; readonly to: number } }

  private readonly story: ReactionStory
  private readonly lay: StoryLayout
  private readonly opts: SchoolRuntimeOptions
  private locale: SceneLocale
  private status: SchoolRuntimeStatus = 'idle'
  private stepIndex = 0
  private t = 0
  private lastCueT = -1
  private readonly cues: Cue[]
  private disposed = false
  private hostBackground: THREE.Color | null = null
  private endResolve: (() => void) | null = null

  private readonly atomMat: THREE.MeshPhysicalMaterial
  private readonly atoms: THREE.InstancedMesh
  private readonly stickGeo: THREE.CylinderGeometry
  private readonly stickMat: THREE.MeshPhysicalMaterial
  private readonly sticks: THREE.InstancedMesh
  private readonly eMat: THREE.MeshBasicMaterial
  private readonly eMesh: THREE.InstancedMesh
  private readonly tailMat: THREE.MeshBasicMaterial
  private readonly tailMesh: THREE.InstancedMesh
  private readonly halos: THREE.Sprite[] = []
  private readonly haloMats: THREE.SpriteMaterial[] = []
  /** свечение ролей: донор — тёплое, акцептор — холодное (+ вспышка при смене степени окисления) */
  private readonly glows: THREE.Sprite[] = []
  private readonly glowMats: THREE.SpriteMaterial[] = []
  private readonly glowAtoms: number[]
  /** вспышки новых связей и подсветка сохранённых групп */
  private readonly bondFlashes: { sprite: THREE.Sprite; mat: THREE.SpriteMaterial; stick: number }[] = []
  private readonly keptGlows: { sprite: THREE.Sprite; mat: THREE.SpriteMaterial; atoms: readonly number[] }[] = []
  private readonly roleOf: Int8Array
  private readonly baseColors: THREE.Color[] = []
  /** сила притушения зрителя: у тёмных шаров (Cu, Fe, Mn) меньше — символ остаётся читаемым */
  private readonly specDim: Float32Array
  private readonly _c = new THREE.Color()
  private readonly _tail = new THREE.Color()

  /** текущие положения атомов (n×3) */
  private readonly pos: Float32Array
  /** текущие радиусы шаров */
  private readonly rad: Float32Array
  private readonly atomLabelIdx: Int32Array
  private readonly oxLabelIdx: { atom: number; label: number }[] = []
  private readonly fragLabelIdx: number[] = []
  private readonly termLabelIdx: number[] = []
  private readonly eLabelIdx: number[] = []
  private readonly waveLabelIdx: number[] = []
  private halfIdx = -1
  /** текущая яркость атома (слой стопки × притушение зрителей) — цвет пишется, только когда она изменилась */
  private readonly bright: Float32Array
  private readonly stickBright: Float32Array

  private readonly _m = new THREE.Matrix4()
  private readonly _q = new THREE.Quaternion()
  private readonly _v = new THREE.Vector3()
  private readonly _w = new THREE.Vector3()
  private readonly _s = new THREE.Vector3()
  private readonly _a = new THREE.Vector3()
  private readonly _b = new THREE.Vector3()
  private readonly _up = new THREE.Vector3(0, 1, 0)
  private readonly _off = new Float32Array(3)
  private readonly _arc = new Float32Array(3)
  private readonly _dot = new Float32Array(3)

  /** окно тепловых колебаний (только «Исходные») */
  private readonly vibWin: ReturnType<typeof storyVibWindow>
  /** «Итог» как в жизни: окружение продукта (решётка / газ / жидкость / вода) */
  private readonly env: StoryEnv
  private readonly envAtoms: THREE.InstancedMesh
  private readonly envSticks: THREE.InstancedMesh
  private readonly envPos: Float32Array
  private readonly envBox: { w: number; h: number; cx: number; cy: number }
  /** электронные пары и облака-лепестки */
  private readonly pairs: StoryPairs
  private readonly pairDots: THREE.InstancedMesh
  private readonly petalMat: THREE.MeshBasicMaterial
  private readonly petals: THREE.InstancedMesh

  constructor(story: ReactionStory, opts: SchoolRuntimeOptions = {}) {
    this.story = story
    this.opts = opts
    this.locale = opts.locale ?? 'ru'
    const lay = buildStoryLayout(story, { lowPower: opts.lowPower })
    this.lay = lay
    const steps = lay.steps
    this.model = {
      timing: {
        stepIndexAt: (t: number) => {
          for (let i = steps.length - 1; i >= 0; i--) if (t >= steps[i]!.from) return i
          return 0
        },
      },
      finish: lay.finish,
    }
    this.cues = [
      { at: lay.finish.from + 0.2, id: 'embryo' },
      { at: lay.finish.from + 0.25, id: 'birth' },
      { at: lay.finish.to, id: 'complete' },
    ]
    this.root.name = 'reaction-story-root'
    const n = lay.n
    this.pos = new Float32Array(n * 3)
    this.rad = new Float32Array(n)
    this.bright = new Float32Array(n).fill(-1)
    this.specDim = new Float32Array(n)
    const sphere = naclSphereGeometry(opts.lowPower)

    // ——— атомы ———
    this.atomMat = withNaclRim(new THREE.MeshPhysicalMaterial({ color: 0xffffff, ...MATTE, transparent: true, fog: false }), 0xffffff, NACL_RIM.atom)
    this.atoms = new THREE.InstancedMesh(sphere, this.atomMat, Math.max(1, n))
    this.atoms.name = 'reaction-story-atoms'
    this.atoms.frustumCulled = false
    for (let i = 0; i < n; i++) {
      const c = schoolAtomColor(lay.el[i]!, new THREE.Color())
      this.baseColors.push(c)
      this.atoms.setColorAt(i, c)
      const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b
      this.specDim[i] = SPECTATOR_DIM * Math.min(1, Math.max(0.25, (lum - 0.08) / 0.4))
    }
    // роль (свечение, полная яркость на шаге переноса) — у доноров и акцепторов лицевых копий
    this.roleOf = new Int8Array(n)
    for (const i of lay.donors) if (!lay.layerL[i]) this.roleOf[i] = 1
    for (const i of lay.acceptors) if (!lay.layerL[i]) this.roleOf[i] = -1
    this.root.add(this.atoms)

    // ——— палочки ———
    this.stickGeo = new THREE.CylinderGeometry(1, 1, 1, opts.lowPower ? 8 : 14, 1, true)
    this.stickMat = withNaclRim(new THREE.MeshPhysicalMaterial({ color: 0xc9d1dc, ...MATTE, transparent: true, fog: false }), 0xffffff, NACL_RIM.atom)
    const stickCount = Math.max(1, lay.sticks.reduce((n, x) => n + x.order, 0))
    this.sticks = new THREE.InstancedMesh(this.stickGeo, this.stickMat, stickCount)
    this.stickBright = new Float32Array(stickCount).fill(-1)
    // палочки стопки (компактный вид) темнее — цвет экземпляра
    if (lay.compact) for (let k = 0; k < stickCount; k++) this.sticks.setColorAt(k, this._c.setRGB(1, 1, 1))
    this.sticks.name = 'reaction-story-bonds'
    this.sticks.frustumCulled = false
    this.root.add(this.sticks)

    // ——— электроны: яркие точки + ореолы ———
    this.eMat = new THREE.MeshBasicMaterial({ color: ELECTRON_COLOR.clone().lerp(new THREE.Color(0xffffff), 0.45), toneMapped: false, fog: false, transparent: true })
    this.eMesh = new THREE.InstancedMesh(sphere, this.eMat, Math.max(1, lay.electrons.length))
    this.eMesh.name = 'reaction-story-electrons'
    this.eMesh.frustumCulled = false
    this.eMesh.renderOrder = 10
    this.root.add(this.eMesh)
    // хвост: призраки позади точки, аддитивно (темнее цвет — прозрачнее)
    this.tailMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, fog: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
    this.tailMesh = new THREE.InstancedMesh(sphere, this.tailMat, Math.max(1, lay.electrons.length * TAIL))
    this.tailMesh.name = 'reaction-story-electron-tails'
    this.tailMesh.frustumCulled = false
    this.tailMesh.renderOrder = 9
    for (let k = 0; k < lay.electrons.length * TAIL; k++) this.tailMesh.setColorAt(k, this._tail.setRGB(0, 0, 0))
    this.root.add(this.tailMesh)
    const halo = naclHaloTexture()
    const sprite = (color: THREE.Color, order: number) => {
      const m = new THREE.SpriteMaterial({ map: halo, color, blending: THREE.AdditiveBlending, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, fog: false })
      const s = new THREE.Sprite(m)
      s.visible = false
      s.renderOrder = order
      this.root.add(s)
      return { s, m }
    }
    const haloCount = opts.lowPower ? Math.min(lay.electrons.length, 8) : lay.electrons.length
    for (let k = 0; k < haloCount; k++) {
      const { s, m } = sprite(ELECTRON_COLOR, 11)
      this.halos.push(s)
      this.haloMats.push(m)
    }
    // свечение ролей: все доноры и акцепторы (на слабом устройстве — первые 10)
    this.glowAtoms = [...lay.donors, ...lay.acceptors].filter((i) => this.roleOf[i]).slice(0, opts.lowPower ? 10 : 48)
    for (const i of this.glowAtoms) {
      const { s, m } = sprite(this.roleOf[i]! > 0 ? DONOR_COLOR : ACCEPTOR_COLOR, 2)
      this.glows.push(s)
      this.glowMats.push(m)
    }
    // вспышки новых связей (каждая палочка-«formed»; если их много — каждая k-я, не больше 40 / 8 на слабом)
    const formed = lay.sticks.map((x, k) => (x.kind === 'formed' && !lay.layerR[x.a] && !lay.layerR[x.b] ? k : -1)).filter((k) => k >= 0)
    const flashCap = opts.lowPower ? 8 : 40
    const every = Math.max(1, Math.ceil(formed.length / flashCap))
    formed.forEach((k, q) => {
      if (q % every) return
      const { s, m } = sprite(BOND_FLASH_COLOR, 3)
      this.bondFlashes.push({ sprite: s, mat: m, stick: k })
    })
    for (const g of lay.keptGroups.filter((x) => x.atoms.every((i) => !lay.layerL[i] && !lay.layerR[i])).slice(0, opts.lowPower ? 4 : 12)) {
      const { s, m } = sprite(KEPT_COLOR, 1)
      this.keptGlows.push({ sprite: s, mat: m, atoms: g.atoms })
    }

    // ——— подписи ———
    this.atomLabelIdx = new Int32Array(n).fill(-1)
    // символ — у атомов лицевых копий (слева или справа); у стопки подписей нет
    const front = (i: number) => !lay.layerL[i] || !lay.layerR[i]
    let frontCount = 0
    for (let i = 0; i < n; i++) if (front(i)) frontCount++
    const many = frontCount > MAX_ATOM_LABELS_ALL
    const oxSet = new Set(lay.oxAtoms)
    for (let i = 0; i < n; i++) {
      const e = lay.el[i]!
      if (!front(i)) continue
      if (many && (e === 'H' || e === 'O') && !oxSet.has(i)) continue
      this.atomLabelIdx[i] = this.labels.length
      this.labels.push({ id: `a${i}`, kind: schoolLabelDark(schoolAtomHex(e)) ? 'atomDark' : 'atom', pos: new THREE.Vector3(), opacity: 0, text: lay.labelL[i]!, avoidR: lay.radius[i]! })
    }
    // чипы степеней окисления — у меняющих её атомов (по два на строку изменения, если атомов много)
    // у многих атомов — по два чипа на строку изменения (остальные доноры/акцепторы видны по свечению)
    const chipAtoms: number[] = []
    const oxFront = lay.oxAtoms.filter((i) => !lay.layerL[i])
    if (oxFront.length <= (opts.lowPower ? 4 : MAX_OX_CHIPS_ALL)) chipAtoms.push(...oxFront)
    else {
      const per = new Map<string, number>()
      for (const i of oxFront) {
        const k = `${lay.el[i]}|${lay.oxL[i]}|${lay.oxR[i]}`
        const c = per.get(k) ?? 0
        if (c < (opts.lowPower ? 1 : 2)) chipAtoms.push(i)
        per.set(k, c + 1)
      }
    }
    for (const i of chipAtoms) {
      this.oxLabelIdx.push({ atom: i, label: this.labels.length })
      this.labels.push({ id: `ox${i}`, kind: 'ox', pos: new THREE.Vector3(), opacity: 0, text: oxPlain(lay.oxL[i]!) })
    }
    lay.fragments.forEach((f, k) => {
      this.fragLabelIdx.push(this.labels.length)
      this.labels.push({ id: `frag${k}`, kind: 'species', pos: new THREE.Vector3(), opacity: 0, text: f.label })
    })
    lay.termLabels.forEach((tl, k) => {
      this.termLabelIdx.push(this.labels.length)
      this.labels.push({ id: `term${k}`, kind: 'species', pos: new THREE.Vector3(), opacity: 0, text: tl.text })
    })
    if (lay.eSingle) {
      for (let k = 0; k < Math.min(MAX_E_TOKENS, lay.electrons.length); k++) {
        this.eLabelIdx.push(this.labels.length)
        this.labels.push({ id: `e${k}`, kind: 'token', pos: new THREE.Vector3(), opacity: 0, text: 'e⁻' })
      }
    } else {
      lay.waves.forEach((w, k) => {
        this.waveLabelIdx.push(this.labels.length)
        this.labels.push({ id: `wave${k}`, kind: 'eGroup', pos: new THREE.Vector3(), opacity: 0, text: `e⁻ ×${fmt(w.n)}` })
      })
    }
    if (story.redox) {
      this.halfIdx = this.labels.length
      this.refreshHalfTexts()
      // карточка привязана центром: точка — на полкарточки ниже верха кадра, иначе её верх вылезает за край, раскладчик
      // подписей сдвигает карточку вниз — на атомы (особенно на телефоне)
      this.labels.push({ id: 'half', kind: 'glassHalf', pos: new THREE.Vector3(lay.extentL.cx, lay.extentL.cy + lay.extentL.h / 2 - 1.02, 0.4), opacity: 0, text: this.halfTexts.n })
    }

    // ——— v2: колебания, пары и облака, окружение итога ———
    this.vibWin = storyVibWindow(lay.steps, lay.breakFrom)
    this.pairs = buildStoryPairs(story, lay, { lowPower: opts.lowPower })
    const dotCount = Math.max(1, (this.pairs.lone.length + this.pairs.bond.length) * 2)
    this.pairDots = new THREE.InstancedMesh(sphere, this.eMat, dotCount)
    this.pairDots.name = 'reaction-story-pair-electrons'
    this.pairDots.frustumCulled = false
    this.pairDots.renderOrder = 8
    this.root.add(this.pairDots)
    this.petalMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, fog: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
    const sigmaCount = this.pairs.bond.filter((b) => b.kind === 'sigma').length
    const petalCount = Math.max(1, this.pairs.lone.length + sigmaCount * 2 + (this.pairs.bond.length - sigmaCount))
    this.petals = new THREE.InstancedMesh(sphere, this.petalMat, petalCount)
    this.petals.name = 'reaction-story-petals'
    this.petals.frustumCulled = false
    this.petals.renderOrder = 7
    for (let k = 0; k < petalCount; k++) this.petals.setColorAt(k, this._tail.setRGB(0, 0, 0))
    this.root.add(this.petals)

    this.env = buildStoryEnv(story, lay, { lowPower: opts.lowPower })
    const ne = this.env.particles.length
    this.envPos = new Float32Array(Math.max(1, ne) * 3)
    this.envAtoms = new THREE.InstancedMesh(sphere, this.atomMat, Math.max(1, ne))
    this.envAtoms.name = 'reaction-story-env-atoms'
    this.envAtoms.frustumCulled = false
    this.env.particles.forEach((q, k) => this.envAtoms.setColorAt(k, schoolAtomColor(q.el, this._c).multiplyScalar(ENV_DIM)))
    this.root.add(this.envAtoms)
    this.envSticks = new THREE.InstancedMesh(this.stickGeo, this.stickMat, Math.max(1, this.env.bonds.length))
    this.envSticks.name = 'reaction-story-env-bonds'
    this.envSticks.frustumCulled = false
    for (let k = 0; k < this.env.bonds.length; k++) this.envSticks.setColorAt(k, this._c.setRGB(ENV_DIM, ENV_DIM, ENV_DIM))
    this.root.add(this.envSticks)
    // кадр итога: продукт + его окружение (не шире 1,35× кадра продукта)
    const R0 = lay.extentR
    const eb = this.env.box
    if (eb) {
      const x0 = Math.min(R0.cx - R0.w / 2, eb.minX - 0.3)
      const x1 = Math.max(R0.cx + R0.w / 2, eb.maxX + 0.3)
      const y0 = Math.min(R0.cy - R0.h / 2, eb.minY - 0.3)
      const y1 = Math.max(R0.cy + R0.h / 2, eb.maxY + 0.3)
      const w = Math.min(x1 - x0, R0.w * 1.35)
      const h = Math.min(y1 - y0, R0.h * 1.35)
      const cx = Math.min(Math.max((x0 + x1) / 2, R0.cx - (w - R0.w) / 2), R0.cx + (w - R0.w) / 2)
      const cy = Math.min(Math.max((y0 + y1) / 2, R0.cy - (h - R0.h) / 2), R0.cy + (h - R0.h) / 2)
      this.envBox = { w, h, cx, cy }
    } else this.envBox = { w: R0.w, h: R0.h, cx: R0.cx, cy: R0.cy }

    this.apply(0)
  }

  // ─── SchoolRuntimeScene ───

  get time(): number {
    return this.t
  }

  get stepCount(): number {
    return this.lay.steps.length
  }

  goToStep(index: number, opts: { instant?: boolean } = {}): Promise<void> {
    const steps = this.lay.steps
    const i = Math.max(0, Math.min(steps.length - 1, index))
    const s = steps[i]!
    if (opts.instant) {
      this.seek(s.to - 1e-3)
      this.stepIndex = i
      this.setStatus('paused')
      return Promise.resolve()
    }
    if (this.t < s.from - 1e-3 || this.t >= s.to - 1e-3) this.seek(s.from)
    this.stepIndex = i
    this.setStatus('playing')
    return this.untilEnd()
  }

  replay(): Promise<void> {
    if (this.status === 'finishing' || this.status === 'done') return Promise.resolve()
    const s = this.lay.steps[this.stepIndex]!
    this.seek(s.from)
    this.setStatus('playing')
    return this.untilEnd()
  }

  finish(): Promise<void> {
    if (this.status === 'finishing' || this.status === 'done') return Promise.resolve()
    if (this.t < this.lay.finish.from) this.seek(this.lay.finish.from)
    this.stepIndex = this.lay.steps.length - 1
    this.setStatus('finishing')
    return this.untilEnd()
  }

  seek(t: number): void {
    const c = Math.max(0, Math.min(this.lay.end, t))
    if (c < this.t) this.lastCueT = c
    this.t = c
    this.stepIndex = this.model.timing.stepIndexAt(Math.min(c, this.lay.finish.from - 1e-3))
    this.apply(c)
  }

  setLocale(locale: SceneLocale): void {
    this.locale = locale
    if (this.halfIdx >= 0) {
      this.refreshHalfTexts()
      this.labels[this.halfIdx]!.text = this.halfTexts.n
    }
    this.apply(this.t)
  }

  extentAt(t: number, out: { w: number; h: number; cx: number; cy: number }): { w: number; h: number; cx: number; cy: number } {
    // исходные и перенос e⁻ — свой кадр, итог — свой: камера плавно наезжает на продукт во время образования
    // в «Итоге» кадр плавно расширяется на окружение продукта (решётка, молекулы газа, вода)
    const a = this.lay.extentL
    const b = this.lay.extentR
    const u = smooth(this.lay.formFrom + 0.2, this.lay.formTo, t)
    const res = this.lay.steps.find((s) => s.id === 'result')
    const v = res ? smooth(res.from, res.from + 1.2, t) : 0
    const e = this.envBox
    const bw = b.w + (e.w - b.w) * v
    const bh = b.h + (e.h - b.h) * v
    const bx = b.cx + (e.cx - b.cx) * v
    const by = b.cy + (e.cy - b.cy) * v
    out.w = a.w + (bw - a.w) * u
    out.h = a.h + (bh - a.h) * u
    out.cx = a.cx + (bx - a.cx) * u
    out.cy = a.cy + (by - a.cy) * u
    return out
  }

  /** Видимость копии стопки: лицевая — 1, задние копии компактного вида скрыты (не «куча»), при перелёте — плавно. */
  private layerVis(i: number, t: number): number {
    const lay = this.lay
    if (!lay.compact) return 1
    const fl = lay.layerL[i] ? 0 : 1
    const fr = lay.layerR[i] ? 0 : 1
    if (fl === fr) return fl
    return fl + (fr - fl) * smooth(lay.moveFrom[i]!, lay.moveFrom[i]! + lay.moveDur, t)
  }

  setHostBackground(color: THREE.Color | null): void {
    this.hostBackground = color
  }

  setViewport(): void {
    /* размеры точек не зависят от высоты вида */
  }

  async warmup(renderer: THREE.WebGLRenderer, camera: THREE.Camera, targetScene?: THREE.Scene): Promise<void> {
    const hidden: THREE.Object3D[] = []
    this.root.traverse((o) => {
      if (!o.visible) {
        hidden.push(o)
        o.visible = true
      }
    })
    try {
      if (typeof renderer.compileAsync === 'function') await renderer.compileAsync(this.root, camera, targetScene ?? null)
      else renderer.compile(this.root, camera, targetScene ?? null)
    } catch {
      /* прогрев — не критичный путь */
    } finally {
      for (const o of hidden) o.visible = false
      this.apply(this.t)
    }
  }

  update(dt: number): void {
    if (this.disposed) return
    const d = Math.min(0.1, Math.max(0, dt))
    if (this.status === 'playing' || this.status === 'finishing') {
      this.t = Math.min(this.lay.end, this.t + d)
      if (this.status === 'playing' && this.t >= this.lay.finish.from) {
        this.stepIndex = this.lay.steps.length - 1
        this.setStatus('finishing')
      }
      if (this.t >= this.lay.end - 1e-6) {
        this.setStatus('done')
        const r = this.endResolve
        this.endResolve = null
        r?.()
      }
    }
    if (this.status === 'playing') {
      const idx = this.model.timing.stepIndexAt(this.t)
      if (idx !== this.stepIndex) {
        this.stepIndex = idx
        this.opts.onStatus?.('playing', idx)
      }
    }
    this.fireCues(this.t)
    this.apply(this.t)
    if (this.hostBackground) {
      const u = smooth(this.lay.finish.from, this.lay.finish.to, this.t)
      this.background.copy(BG).lerp(this.hostBackground, u)
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.root.removeFromParent()
    this.atomMat.dispose()
    this.atoms.dispose()
    this.stickMat.dispose()
    this.stickGeo.dispose()
    this.sticks.dispose()
    this.eMat.dispose()
    this.eMesh.dispose()
    this.tailMat.dispose()
    this.tailMesh.dispose()
    this.pairDots.dispose()
    this.petalMat.dispose()
    this.petals.dispose()
    this.envAtoms.dispose()
    this.envSticks.dispose()
    for (const m of this.haloMats) m.dispose()
    for (const m of this.glowMats) m.dispose()
    for (const f of this.bondFlashes) f.mat.dispose()
    for (const g of this.keptGlows) g.mat.dispose()
    const r = this.endResolve
    this.endResolve = null
    r?.()
  }

  // ─── внутреннее ───

  private untilEnd(): Promise<void> {
    return new Promise<void>((resolve) => {
      const prev = this.endResolve
      this.endResolve = () => {
        prev?.()
        resolve()
      }
    })
  }

  private setStatus(s: SchoolRuntimeStatus): void {
    this.status = s
    this.opts.onStatus?.(s, this.stepIndex)
  }

  private fireCues(t: number): void {
    if (t <= this.lastCueT) {
      this.lastCueT = Math.min(this.lastCueT, t)
      return
    }
    const from = this.lastCueT
    this.lastCueT = t
    for (const c of this.cues) if (c.at > from && c.at <= t) this.opts.onCue?.(c.id)
  }

  /** Карточка полуреакций: «o␟Fe⁰ − 2e⁻ → Fe⁺²␟восстановитель», «r␟Cu⁺² + 2e⁻ → Cu⁰␟окислитель», «b␟отдано 2e⁻ = принято 2e⁻». */
  /** Тексты карточки: без подсветки (n), подсвечена отдача (o) или приём (r) e⁻. */
  private readonly halfTexts = { n: '', o: '', r: '' }

  private refreshHalfTexts(): void {
    this.halfTexts.n = this.halfText(null)
    this.halfTexts.o = this.halfText('o')
    this.halfTexts.r = this.halfText('r')
  }

  private halfText(active: 'o' | 'r' | null): string {
    const s = this.story
    const tg = HALF_TAGS[this.locale]
    // одинаковые полуреакции из разных веществ (2H⁺¹ из NaOH и 2H⁺¹ из H₂O) — одной строкой с суммой
    const merge = (list: readonly StoryOxChange[]) => {
      const out: StoryOxChange[] = []
      for (const c of list) {
        const k = out.findIndex((x) => x.el === c.el && x.from === c.from && x.to === c.to)
        if (k < 0) out.push(c)
        else out[k] = { ...out[k]!, count: out[k]!.count + c.count, electrons: out[k]!.electrons + c.electrons, atoms: [...out[k]!.atoms, ...c.atoms] }
      }
      return out
    }
    const rows = [
      ...merge(s.oxidations).map((c) => `${active === 'o' ? 'O' : 'o'}␟${halfLine(c, true)}␟${tg.reducer}`),
      ...merge(s.reductions).map((c) => `${active === 'r' ? 'R' : 'r'}␟${halfLine(c, false)}␟${tg.oxidizer}`),
      `b␟${tg.balance(fmt(s.given), fmt(s.accepted))}`,
    ]
    return rows.join('\n')
  }

  /** Кадр момента t (без аллокаций). */
  private apply(t: number): void {
    const lay = this.lay
    const n = lay.n
    const appear = smooth(0, 0.65, t)
    const fade = appear * (1 - smooth(lay.finish.from, lay.finish.to - 0.15, t))
    const steps = lay.steps
    const idx = this.model.timing.stepIndexAt(Math.min(t, lay.finish.from - 1e-3))
    const stepFrom = steps[idx]!.from
    const stepId = steps[idx]!.id

    // ——— атомы ———
    const P = this.pos
    this._q.identity()
    const off = this._off
    const R = this.rad
    for (let i = 0; i < n; i++) {
      storyAtomPos(lay, i, t, P, i * 3)
      R[i] = storyAtomRadius(lay, i, t)
      // тепловые колебания только на «Исходных»: ≤ 4 пм, ≤ 1,5 Гц, плавный разгон, затухание на разрыве (storyMotion)
      storyVibOffset(this.vibWin, i, t, off, 0)
      P[i * 3] = P[i * 3]! + off[0]!
      P[i * 3 + 1] = P[i * 3 + 1]! + off[1]!
      P[i * 3 + 2] = P[i * 3 + 2]! + off[2]!
      const r = R[i]! * (0.6 + 0.4 * appear) * this.layerVis(i, t)
      this._v.set(P[i * 3]!, P[i * 3 + 1]!, P[i * 3 + 2]!)
      this._s.set(r, r, r)
      this._m.compose(this._v, this._q, this._s)
      this.atoms.setMatrixAt(i, this._m)
    }
    this.atoms.instanceMatrix.needsUpdate = true
    // шаг переноса: атомы-зрители притушены — доноры и акцепторы читаются сразу; стопка копий — тёмная
    const dimU = Number.isFinite(lay.eOn) ? smooth(lay.eOn, lay.eOn + 0.5, t) * (1 - smooth(lay.eOff - 0.2, lay.eOff + 0.5, t)) : 0
    let colorDirty = false
    for (let i = 0; i < n; i++) {
      const bl = STORY_LAYER_BRIGHT[lay.layerL[i]!]!
      const br = STORY_LAYER_BRIGHT[lay.layerR[i]!]!
      const layerB = bl === br ? bl : bl + (br - bl) * smooth(lay.moveFrom[i]!, lay.moveFrom[i]! + lay.moveDur, t)
      const b = layerB * (this.roleOf[i] ? 1 : 1 - this.specDim[i]! * dimU)
      if (Math.abs(b - this.bright[i]!) > 0.004 || (b === 1 && this.bright[i] !== 1)) {
        this.bright[i] = b
        this.atoms.setColorAt(i, this._c.copy(this.baseColors[i]!).multiplyScalar(b))
        colorDirty = true
      }
    }
    if (colorDirty && this.atoms.instanceColor) this.atoms.instanceColor.needsUpdate = true
    this.atomMat.opacity = fade
    this.atoms.visible = fade > 0.002

    // ——— палочки ———
    const sticks = lay.sticks
    let inst = 0
    let stickDirty = false
    for (let k = 0; k < sticks.length; k++) {
      const s = sticks[k]!
      if (lay.compact) {
        // палочка стопки — темнее (по более тёмному из двух атомов, без притушения зрителей)
        const sb = Math.min(this.layerBright(s.a, t), this.layerBright(s.b, t))
        if (Math.abs(sb - this.stickBright[inst]!) > 0.004) {
          for (let o = 0; o < s.order; o++) {
            this.stickBright[inst + o] = sb
            this.sticks.setColorAt(inst + o, this._c.setRGB(sb, sb, sb))
          }
          stickDirty = true
        }
      }
      const alpha = s.kind === 'kept' ? 1 : s.kind === 'broken' ? 1 - smooth(s.t0, s.t1, t) : smooth(s.t0, s.t1, t)
      // кратная связь — параллельные палочки потоньше (как в школьной сцене: двойная — две, тройная — три)
      const rad = STICK_R * alpha * (s.order > 1 ? 0.72 : 1) * Math.min(this.layerVis(s.a, t), this.layerVis(s.b, t))
      this._a.set(P[s.a * 3]!, P[s.a * 3 + 1]!, P[s.a * 3 + 2]!)
      this._b.set(P[s.b * 3]!, P[s.b * 3 + 1]!, P[s.b * 3 + 2]!)
      const len = this._a.distanceTo(this._b)
      for (let o = 0; o < s.order; o++) {
        if (rad < 0.002 || len < 1e-4) {
          this._s.set(0, 0, 0)
          this._m.compose(this._a, this._q.identity(), this._s)
        } else {
          this._v.subVectors(this._b, this._a).divideScalar(len)
          this._q.setFromUnitVectors(this._up, this._v)
          // сдвиг поперёк связи в плоскости экрана: (dir × z); у связи «на зрителя» — вверх
          this._w.set(-this._v.y, this._v.x, 0)
          if (this._w.lengthSq() < 1e-6) this._w.set(0, 1, 0)
          this._w.normalize().multiplyScalar(STICK_R * 2.3 * (o - (s.order - 1) / 2))
          this._v.addVectors(this._a, this._b).multiplyScalar(0.5).add(this._w)
          this._s.set(rad, len, rad)
          this._m.compose(this._v, this._q, this._s)
        }
        this.sticks.setMatrixAt(inst++, this._m)
      }
    }
    this.sticks.instanceMatrix.needsUpdate = true
    if (stickDirty && this.sticks.instanceColor) this.sticks.instanceColor.needsUpdate = true
    this.stickMat.opacity = fade
    this.sticks.visible = fade > 0.002 && sticks.length > 0

    // ——— электроны: точка + хвост + ореол, по дуге от донора к акцептору ———
    const es = lay.electrons
    const tailCol = this._tail
    for (let k = 0; k < es.length; k++) {
      const e = es[k]!
      const pre = smooth(e.t0 - 0.25, e.t0, t)
      const u = flightU(e.t0, e.t1, t)
      const post = 1 - smooth(e.t1, e.t1 + 0.22, t)
      const vis = pre * post * fade
      const flying = smooth(e.t0, e.t0 + 0.08, t) * (1 - smooth(e.t1 - 0.03, e.t1 + 0.12, t))
      this.arcPoint(k, u, this._v)
      const er = 0.088 * pre * post * (1 + 0.14 * Math.min(4, e.n - 1)) * storyPulse(STORY_FX_HZ.electronPulse, t, k, 0.06)
      this._s.set(er, er, er)
      this._m.compose(this._v, this._q.identity(), this._s)
      this.eMesh.setMatrixAt(k, this._m)
      // шаг хвоста — по длине дуги: хвост ≈ 0.45 единицы сцены и у короткого, и у длинного перелёта
      const du = 0.065 / Math.max(0.6, Math.hypot(P[e.to * 3]! - P[e.from * 3]!, P[e.to * 3 + 1]! - P[e.from * 3 + 1]!) + 0.6)
      for (let j = 1; j <= TAIL; j++) {
        const uj = u - j * du
        const ii = k * TAIL + j - 1
        const w = 1 - j / (TAIL + 1)
        if (uj <= 0 || flying < 0.01 || vis < 0.01) {
          this._s.set(0, 0, 0)
          tailCol.setRGB(0, 0, 0)
        } else {
          this.arcPoint(k, uj, this._w)
          const tr = 0.088 * (0.35 + 0.6 * w)
          this._s.set(tr, tr, tr)
          tailCol.copy(ELECTRON_COLOR).multiplyScalar(0.8 * w * w * flying * vis)
        }
        this._m.compose(this._w, this._q, this._s)
        this.tailMesh.setMatrixAt(ii, this._m)
        this.tailMesh.setColorAt(ii, tailCol)
      }
      // точка — заново (хвост переписал _v)
      this.arcPoint(k, u, this._v)
      const halo = this.halos[k]
      if (halo) {
        // после прилёта ореол вспыхивает у акцептора и гаснет
        // в полёте — мягкий ореол; в момент прибытия — вспышка у акцептора: расширяется и гаснет (≈ 0,45 с)
        const after = t - e.t1
        const hv = pre * fade * (after > 0 ? Math.exp(-after / 0.2) : 1)
        halo.visible = hv > 0.01
        halo.position.copy(this._v)
        const grow = after > 0 ? 1 - Math.exp(-after / 0.12) : 0
        const sc = 0.5 + 0.12 * Math.min(4, e.n - 1) + grow * 0.95
        halo.scale.set(sc, sc, sc)
        this.haloMats[k]!.opacity = (after > 0 ? 0.95 : 0.8) * hv
      }
      const li = this.eLabelIdx[k]
      if (li != null) {
        const L = this.labels[li]!
        L.pos.set(this._v.x, this._v.y + 0.2, this._v.z)
        L.opacity = vis * smooth(e.t0, e.t0 + 0.15, t) * (1 - smooth(e.t1 - 0.2, e.t1, t))
      }
    }
    if (es.length) {
      this.eMesh.instanceMatrix.needsUpdate = true
      this.tailMesh.instanceMatrix.needsUpdate = true
      if (this.tailMesh.instanceColor) this.tailMesh.instanceColor.needsUpdate = true
    }
    this.eMat.opacity = fade
    this.eMesh.visible = es.length > 0 && fade > 0.002
    this.tailMesh.visible = es.length > 0 && fade > 0.002 && t > lay.eOn && t < lay.eOff + 0.5
    // волны (группы «e⁻ ×n»): подпись — над центром летящей группы
    lay.waves.forEach((w, k) => {
      const li = this.waveLabelIdx[k]
      if (li == null) return
      const L = this.labels[li]!
      let x = 0
      let y = -Infinity
      let z = 0
      for (const q of w.tokens) {
        const e = es[q]!
        this.arcPoint(q, flightU(e.t0, e.t1, t), this._w)
        x += this._w.x / w.tokens.length
        z += this._w.z / w.tokens.length
        y = Math.max(y, this._w.y)
      }
      L.pos.set(x, y + 0.34, z)
      L.opacity = smooth(w.t0, w.t0 + 0.2, t) * (1 - smooth(w.t1 - 0.1, w.t1 + 0.3, t)) * fade
    })

    // ——— роли: донор — тёплое свечение, акцептор — холодное; вспышка в момент смены степени окисления ———
    const roleOn = Number.isFinite(lay.eOn) ? smooth(lay.eOn, lay.eOn + 0.5, t) * (1 - smooth(lay.formFrom + 0.1, lay.formFrom + 0.8, t)) : 0
    for (let k = 0; k < this.glowAtoms.length; k++) {
      const i = this.glowAtoms[k]!
      const sp = this.glows[k]!
      const tf = lay.flipAt[i]!
      const x = Number.isFinite(tf) ? (t - tf) / 0.24 : 99
      const pulse = Math.exp(-x * x)
      // донор ярок, пока отдаёт, и притухает после отдачи; акцептор разгорается, когда к нему прибывают e⁻
      const fin = Number.isFinite(tf)
      const phase = this.roleOf[i]! > 0 ? (fin ? 1 - 0.55 * smooth(tf, tf + 0.5, t) : 1) : fin ? 0.4 + 0.6 * smooth(tf - 0.3, tf + 0.1, t) : 1
      const a = (0.62 * roleOn * phase * (0.86 + 0.14 * (storyPulse(STORY_FX_HZ.roleGlow, t, i, 1) - 1)) + 0.55 * pulse * roleOn) * fade
      sp.visible = a > 0.01
      if (!sp.visible) continue
      sp.position.set(P[i * 3]!, P[i * 3 + 1]!, P[i * 3 + 2]! + R[i]! * 0.35)
      const sc = R[i]! * (4.3 + 1.6 * pulse) + 0.2
      sp.scale.set(sc, sc, sc)
      this.glowMats[k]!.opacity = a
    }

    // ——— новые связи: мягкая вспышка у середины палочки, когда она выросла ———
    for (const f of this.bondFlashes) {
      const s = lay.sticks[f.stick]!
      const x = (t - (s.t1 - 0.04)) / 0.2
      const pulse = Math.exp(-x * x)
      f.sprite.visible = pulse > 0.02 && fade > 0.01
      if (!f.sprite.visible) continue
      f.sprite.position.set((P[s.a * 3]! + P[s.b * 3]!) / 2, (P[s.a * 3 + 1]! + P[s.b * 3 + 1]!) / 2, (P[s.a * 3 + 2]! + P[s.b * 3 + 2]!) / 2 + 0.15)
      const sc = 0.5 + 0.4 * pulse
      f.sprite.scale.set(sc, sc, sc)
      f.mat.opacity = 0.75 * pulse * fade
    }

    // ——— сохранённые группы (SO₄²⁻ …): общая подсветка, пока группа переходит целиком ———
    const keptOn = smooth(lay.breakTo - 0.7, lay.breakTo - 0.1, t) * (1 - smooth(lay.formTo - 0.3, lay.formTo + 0.5, t))
    for (const g of this.keptGlows) {
      g.sprite.visible = keptOn * fade > 0.01
      if (!g.sprite.visible) continue
      let x = 0
      let y = 0
      let z = 0
      for (const i of g.atoms) {
        x += P[i * 3]! / g.atoms.length
        y += P[i * 3 + 1]! / g.atoms.length
        z += P[i * 3 + 2]! / g.atoms.length
      }
      let rr = 0
      for (const i of g.atoms) rr = Math.max(rr, Math.hypot(P[i * 3]! - x, P[i * 3 + 1]! - y) + R[i]!)
      g.sprite.position.set(x, y, z - 0.2)
      const sc = rr * 2.7
      g.sprite.scale.set(sc, sc, sc)
      g.mat.opacity = 0.42 * keptOn * fade * (0.88 + 0.12 * (storyPulse(STORY_FX_HZ.keptGlow, t, 0, 1) - 1))
    }

    // ——— подписи ———
    const tLabelBreak = lay.breakFrom + 0.7
    for (let i = 0; i < n; i++) {
      const li = this.atomLabelIdx[i]!
      if (li < 0) continue
      const L = this.labels[li]!
      const arrived = t >= lay.moveFrom[i]! + lay.moveDur * 0.85
      L.text = t < tLabelBreak ? lay.labelL[i]! : t >= lay.flipAt[i]! || arrived ? lay.labelR[i]! : lay.labelB[i]!
      const r = R[i]!
      L.pos.set(P[i * 3]!, P[i * 3 + 1]!, P[i * 3 + 2]! + r)
      L.avoidR = r
      // символ атома-зрителя на шаге переноса притушен вместе с шаром; у атома, уходящего в стопку (или
      // приходящего из неё) символ гаснет при отлёте (проявляется при прилёте)
      const fl = lay.layerL[i] ? 0 : 1
      const fr = lay.layerR[i] ? 0 : 1
      const mf = lay.moveFrom[i]!
      const fm = fl === fr ? fl : fl ? 1 - smooth(mf, mf + 0.35 * lay.moveDur, t) : smooth(mf + 0.65 * lay.moveDur, mf + lay.moveDur, t)
      L.opacity = fade * fm * (this.roleOf[i] ? 1 : 1 - Math.min(0.45, this.specDim[i]!) * dimU)
    }
    // чип степени окисления: над шаром на шаге переноса; в момент отлёта/прилёта — «щелчок» и новое значение
    for (const { atom, label } of this.oxLabelIdx) {
      const L = this.labels[label]!
      const r = R[atom]!
      // над шаром, но в сторону от соседей (у N в NO₂ чип не ложится на кислород)
      const px = P[atom * 3]!
      const py = P[atom * 3 + 1]!
      let ax = 0
      let ay = 0.35
      for (let j = 0; j < n; j++) {
        if (j === atom) continue
        const dx = P[j * 3]! - px
        const dy = P[j * 3 + 1]! - py
        const d = Math.hypot(dx, dy)
        const lim = r + R[j]! + 0.6
        if (d > 1e-4 && d < lim) {
          const w = (lim - d) / lim
          ax -= (dx / d) * w
          ay -= (dy / d) * w
        }
      }
      const al = Math.hypot(ax, ay) || 1
      L.pos.set(px + (ax / al) * (r + 0.2), py + (ay / al) * (r + 0.2), P[atom * 3 + 2]! + r)
      const tf = lay.flipAt[atom]!
      L.text = t >= tf ? oxPlain(lay.oxR[atom]!) : oxPlain(lay.oxL[atom]!)
      const x = Number.isFinite(tf) ? (t - tf) / 0.16 : 99
      L.scale = 1 + 0.55 * Math.exp(-x * x)
      const on = Number.isFinite(lay.eOn) ? smooth(lay.eOn - 0.1, lay.eOn + 0.4, t) * (1 - smooth(lay.moveFrom[atom]! + 0.2, lay.moveFrom[atom]! + 0.7, t)) : 0
      L.opacity = on * fade
    }
    lay.fragments.forEach((f, k) => {
      const L = this.labels[this.fragLabelIdx[k]!]!
      let x = 0
      let y = -Infinity
      let z = 0
      for (const i of f.atoms) {
        x += P[i * 3]! / f.atoms.length
        z += P[i * 3 + 2]! / f.atoms.length
        y = Math.max(y, P[i * 3 + 1]! + R[i]!)
      }
      L.pos.set(x, y + 0.2, z + 0.3)
      let mf = Infinity
      for (const i of f.atoms) mf = Math.min(mf, lay.moveFrom[i]!)
      // на шаге переноса подписи осколков убраны: над атомами — чипы степеней окисления, лишнего в кадре нет
      L.opacity = smooth(lay.breakFrom + 0.6, lay.breakFrom + 1.1, t) * (1 - smooth(mf, mf + 0.4, t)) * fade * (1 - dimU)
    })
    lay.termLabels.forEach((tl, k) => {
      const L = this.labels[this.termLabelIdx[k]!]!
      let minY = Infinity
      let x = 0
      for (const i of tl.atoms) {
        x += P[i * 3]! / Math.max(1, tl.atoms.length)
        minY = Math.min(minY, P[i * 3 + 1]! - R[i]!)
      }
      L.pos.set(x, (Number.isFinite(minY) ? minY : 0) - 0.3, 0.3)
      L.opacity =
        (tl.side === 'left'
          ? 1 - smooth(lay.breakFrom, lay.breakFrom + 0.5, t)
          : smooth(lay.fateTo - 0.3, lay.fateTo + 0.3, t)) * fade
    })
    if (this.halfIdx >= 0) {
      const H = this.labels[this.halfIdx]!
      H.opacity = smooth(lay.eOn + 0.15, lay.eOn + 0.6, t) * (1 - smooth(lay.eOff - 0.1, lay.eOff + 0.35, t)) * fade
      // подсветка строки: пока e⁻ уходят от донора — отдача, когда прибывают к акцептору — приём
      const e0 = lay.electrons[0]
      const mid = e0 ? (e0.t0 + e0.t1) / 2 : Infinity
      H.text = t < lay.eOn + 0.2 ? this.halfTexts.n : t < mid ? this.halfTexts.o : t < lay.eLastArrive + 0.35 ? this.halfTexts.r : this.halfTexts.n
    }
    this.applyPairs(t, fade)
    this.applyEnv(t, fade)
    void stepId
    void stepFrom
  }

  /** Обнулить экземпляр (спрятать): масштаб 0 в точке p. */
  private hideAt(mesh: THREE.InstancedMesh, k: number, p: THREE.Vector3): void {
    this._s.set(0, 0, 0)
    this._m.compose(p, this._q.identity(), this._s)
    mesh.setMatrixAt(k, this._m)
  }

  /** Электронные пары и облака-лепестки (σ на оси, π сбоку, неподелённые пары наружу). */
  private applyPairs(t: number, fade: number): void {
    const lay = this.lay
    const pr = this.pairs
    const P = this.pos
    const R = this.rad
    const all = pairsVisibility(pr, t) * fade
    const has = pr.lone.length + pr.bond.length > 0
    this.pairDots.visible = has && all > 0.004
    this.petals.visible = this.pairDots.visible
    if (!this.pairDots.visible) return
    let d = 0
    let pt = 0
    const dot = (x: number, y: number, z: number, r: number) => {
      this._v.set(x, y, z)
      this._s.set(r, r, r)
      this._m.compose(this._v, this._q.identity(), this._s)
      this.pairDots.setMatrixAt(d++, this._m)
    }
    // лепесток: центр, ось, полудлина вдоль и поперёк, яркость (аддитивно — цвет экземпляра)
    const petal = (cx: number, cy: number, cz: number, ux: number, uy: number, uz: number, along: number, across: number, b: number) => {
      this._v.set(cx, cy, cz)
      this._w.set(ux, uy, uz)
      if (this._w.lengthSq() < 1e-8) this._w.set(0, 1, 0)
      this._w.normalize()
      this._q.setFromUnitVectors(this._up, this._w)
      this._s.set(across, along, across)
      this._m.compose(this._v, this._q, this._s)
      this.petals.setMatrixAt(pt, this._m)
      this.petals.setColorAt(pt++, this._tail.copy(PETAL_COLOR).multiplyScalar(PETAL_GAIN * b))
    }
    const hidePetal = () => {
      this.hideAt(this.petals, pt, this._a)
      this.petals.setColorAt(pt++, this._tail.setRGB(0, 0, 0))
    }
    const q3 = this._dot
    // неподелённые пары: точки — снаружи шара (r + GAP) в свободном слоте (storyPairs), лепесток — не на соседа
    for (const lp of pr.lone) {
      const i = lp.atom
      const v = fade * storyLoneVis(pr, lay, lp, t)
      const r = R[i]!
      const x = P[i * 3]!
      const y = P[i * 3 + 1]!
      const z = P[i * 3 + 2]!
      if (v < 0.01) {
        this._a.set(x, y, z)
        this.hideAt(this.pairDots, d++, this._a)
        this.hideAt(this.pairDots, d++, this._a)
        hidePetal()
        continue
      }
      const er = PAIR_E_R * (0.5 + 0.5 * v)
      storyLoneDot(lp, P, R, -1, q3)
      dot(q3[0]!, q3[1]!, q3[2]!, er)
      storyLoneDot(lp, P, R, 1, q3)
      dot(q3[0]!, q3[1]!, q3[2]!, er)
      // лепесток: длина не дальше 0,92 зазора до соседнего шара по его направлению
      let reach = r + 0.24
      for (let j = 0; j < lay.n; j++) {
        if (j === i) continue
        const rj = R[j]! * this.layerVis(j, t)
        if (rj < 0.005) continue
        const vx = P[j * 3]! - x
        const vy = P[j * 3 + 1]! - y
        const vz = P[j * 3 + 2]! - z
        const along = vx * lp.dx + vy * lp.dy + vz * lp.dz
        if (along <= 0) continue
        const perp2 = Math.max(0, vx * vx + vy * vy + vz * vz - along * along)
        const rw = rj + 0.115
        if (perp2 >= rw * rw) continue
        reach = Math.min(reach, 0.92 * (along - Math.sqrt(rw * rw - perp2)))
      }
      const half = (reach - r) / 2
      if (half < 0.04) hidePetal()
      else {
        const c = r + half
        petal(x + lp.dx * c, y + lp.dy * c, z + lp.dz * c, lp.dx, lp.dy, lp.dz, Math.min(0.17, half * 1.1), 0.115, v)
      }
    }
    // общие пары: σ — у оси в середине зазора между шарами (два e⁻ поперёк оси, перед палочкой), π — сбоку
    for (const bp of pr.bond) {
      const s = lay.sticks[bp.stick]!
      const v = fade * storyBondVis(pr, lay, bp, t)
      this._a.set(P[s.a * 3]!, P[s.a * 3 + 1]!, P[s.a * 3 + 2]!)
      this._b.set(P[s.b * 3]!, P[s.b * 3 + 1]!, P[s.b * 3 + 2]!)
      const len = this._a.distanceTo(this._b)
      if (v < 0.01 || len < 1e-4) {
        this.hideAt(this.pairDots, d++, this._a)
        this.hideAt(this.pairDots, d++, this._a)
        hidePetal()
        if (bp.kind === 'sigma') hidePetal()
        continue
      }
      const ux = (this._b.x - this._a.x) / len
      const uy = (this._b.y - this._a.y) / len
      const uz = (this._b.z - this._a.z) / len
      const er = PAIR_E_R * (0.5 + 0.5 * v)
      storyBondDot(lay, bp, P, R, -1, q3)
      dot(q3[0]!, q3[1]!, q3[2]!, er)
      const mx = q3[0]!
      const my = q3[1]!
      const mz = q3[2]!
      storyBondDot(lay, bp, P, R, 1, q3)
      dot(q3[0]!, q3[1]!, q3[2]!, er)
      if (bp.kind === 'sigma') {
        const ra = R[s.a]!
        const rb = R[s.b]!
        const ax = this._a.x
        const ay = this._a.y
        const az = this._a.z
        const bx = this._b.x
        const by = this._b.y
        const bz = this._b.z
        petal(ax + ux * ra * 0.8, ay + uy * ra * 0.8, az + uz * ra * 0.8, ux, uy, uz, ra * 0.62, ra * 0.42, v)
        petal(bx - ux * rb * 0.8, by - uy * rb * 0.8, bz - uz * rb * 0.8, -ux, -uy, -uz, rb * 0.62, rb * 0.42, v)
      } else {
        // лепесток π — между двумя точками пары, вдоль связи, за ними
        petal((mx + q3[0]!) / 2, (my + q3[1]!) / 2, (mz + q3[2]!) / 2 - 0.03, ux, uy, uz, Math.min(0.32, len * 0.3), 0.085, v)
      }
    }
    this.pairDots.instanceMatrix.needsUpdate = true
    this.petals.instanceMatrix.needsUpdate = true
    if (this.petals.instanceColor) this.petals.instanceColor.needsUpdate = true
  }

  /** «Итог» как в жизни: частицы окружения появляются слоями от продукта; газ плавно расходится вверх. */
  private applyEnv(t: number, fade: number): void {
    const env = this.env
    const ps = env.particles
    if (!ps.length) {
      this.envAtoms.visible = false
      this.envSticks.visible = false
      return
    }
    const dr = envDrift(env, t)
    const E = this.envPos
    let any = false
    for (let k = 0; k < ps.length; k++) {
      const q = ps[k]!
      const g = smooth(q.t0, q.t0 + 0.45, t)
      E[k * 3] = q.x + q.vx * dr
      E[k * 3 + 1] = q.y + q.vy * dr
      E[k * 3 + 2] = q.z + q.vz * dr
      const r = q.r * g
      if (g > 0) any = true
      this._v.set(E[k * 3]!, E[k * 3 + 1]!, E[k * 3 + 2]!)
      this._s.set(r, r, r)
      this._m.compose(this._v, this._q.identity(), this._s)
      this.envAtoms.setMatrixAt(k, this._m)
    }
    this.envAtoms.instanceMatrix.needsUpdate = true
    this.envAtoms.visible = any && fade > 0.002
    for (let k = 0; k < env.bonds.length; k++) {
      const b = env.bonds[k]!
      const g = Math.min(smooth(ps[b.a]!.t0 + 0.2, ps[b.a]!.t0 + 0.6, t), smooth(ps[b.b]!.t0 + 0.2, ps[b.b]!.t0 + 0.6, t))
      this._a.set(E[b.a * 3]!, E[b.a * 3 + 1]!, E[b.a * 3 + 2]!)
      this._b.set(E[b.b * 3]!, E[b.b * 3 + 1]!, E[b.b * 3 + 2]!)
      const len = this._a.distanceTo(this._b)
      if (g < 0.01 || len < 1e-4) {
        this.hideAt(this.envSticks, k, this._a)
        continue
      }
      this._v.subVectors(this._b, this._a).divideScalar(len)
      this._q.setFromUnitVectors(this._up, this._v)
      this._v.addVectors(this._a, this._b).multiplyScalar(0.5)
      this._s.set(STICK_R * 0.9 * g, len, STICK_R * 0.9 * g)
      this._m.compose(this._v, this._q, this._s)
      this.envSticks.setMatrixAt(k, this._m)
    }
    this.envSticks.instanceMatrix.needsUpdate = true
    this.envSticks.visible = any && env.bonds.length > 0 && fade > 0.002
  }


  /** Яркость атома по слою стопки в момент t (лицевая копия — 1). */
  private layerBright(i: number, t: number): number {
    const lay = this.lay
    const bl = STORY_LAYER_BRIGHT[lay.layerL[i]!]!
    const br = STORY_LAYER_BRIGHT[lay.layerR[i]!]!
    return bl === br ? bl : bl + (br - bl) * smooth(lay.moveFrom[i]!, lay.moveFrom[i]! + lay.moveDur, t)
  }

  /**
   * Точка дуги электрона k (u ∈ [0, 1]): из свободного слота донора (ближайшего по углу к акцептору) в свободный слот
   * акцептора, приподнята к зрителю на подобранную высоту — на всём пути вне всех шаров (storyPairs.storyFlightPoint).
   */
  private arcPoint(k: number, u: number, out: THREE.Vector3): void {
    const e = this.lay.electrons[k]!
    const fl = this.pairs.flights[k]!
    const o = this._arc
    storyFlightPoint(fl, e.from, e.to, this.pos, this.rad, u, o, 0)
    out.set(o[0]!, o[1]!, o[2]!)
  }
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}
