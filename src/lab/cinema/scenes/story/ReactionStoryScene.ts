import * as THREE from 'three'
import { halfLine, oxPlain, type ReactionStory } from '../../../../chemistry/reactionStory'
import { schoolAtomColor, schoolAtomHex, schoolLabelDark } from '../../../../components/lab/hero/schoolHeroStyle'
import type { DomLabelSource } from '../../react/CinemaDomLabels'
import type { SceneLocale } from '../kit/sceneKit'
import { naclHaloTexture, naclSphereGeometry, NACL_RIM, withNaclRim } from '../nacl/naclLatticeView'
import type { SchoolRuntimeOptions, SchoolRuntimeScene, SchoolRuntimeStatus } from '../school/schoolRuntime'
import { buildStoryLayout, smooth, storyAtomPos, storyAtomRadius, type StoryLayout } from './storyLayout'

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
 * Производительность: атомы, палочки, электроны — три InstancedMesh; ноль аллокаций в update.
 */

const BG = new THREE.Color('#0a0b10')
const MATTE = { roughness: 0.84, metalness: 0, clearcoat: 0, clearcoatRoughness: 0.4, specularIntensity: 0.16 } as const
const ELECTRON_COLOR = new THREE.Color(0x9ee4ff)
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
  private lastDim = 0

  private readonly _m = new THREE.Matrix4()
  private readonly _q = new THREE.Quaternion()
  private readonly _v = new THREE.Vector3()
  private readonly _w = new THREE.Vector3()
  private readonly _s = new THREE.Vector3()
  private readonly _a = new THREE.Vector3()
  private readonly _b = new THREE.Vector3()
  private readonly _up = new THREE.Vector3(0, 1, 0)

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
    }
    this.roleOf = new Int8Array(n)
    for (const i of lay.donors) this.roleOf[i] = 1
    for (const i of lay.acceptors) this.roleOf[i] = -1
    this.root.add(this.atoms)

    // ——— палочки ———
    this.stickGeo = new THREE.CylinderGeometry(1, 1, 1, opts.lowPower ? 8 : 14, 1, true)
    this.stickMat = withNaclRim(new THREE.MeshPhysicalMaterial({ color: 0xc9d1dc, ...MATTE, transparent: true, fog: false }), 0xffffff, NACL_RIM.atom)
    this.sticks = new THREE.InstancedMesh(this.stickGeo, this.stickMat, Math.max(1, lay.sticks.reduce((n, x) => n + x.order, 0)))
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
    this.glowAtoms = [...lay.donors, ...lay.acceptors].slice(0, opts.lowPower ? 10 : 48)
    for (const i of this.glowAtoms) {
      const { s, m } = sprite(this.roleOf[i]! > 0 ? DONOR_COLOR : ACCEPTOR_COLOR, 2)
      this.glows.push(s)
      this.glowMats.push(m)
    }
    // вспышки новых связей (каждая палочка-«formed»; если их много — каждая k-я, не больше 40 / 8 на слабом)
    const formed = lay.sticks.map((x, k) => (x.kind === 'formed' ? k : -1)).filter((k) => k >= 0)
    const flashCap = opts.lowPower ? 8 : 40
    const every = Math.max(1, Math.ceil(formed.length / flashCap))
    formed.forEach((k, q) => {
      if (q % every) return
      const { s, m } = sprite(BOND_FLASH_COLOR, 3)
      this.bondFlashes.push({ sprite: s, mat: m, stick: k })
    })
    for (const g of lay.keptGroups.slice(0, opts.lowPower ? 4 : 12)) {
      const { s, m } = sprite(KEPT_COLOR, 1)
      this.keptGlows.push({ sprite: s, mat: m, atoms: g.atoms })
    }

    // ——— подписи ———
    this.atomLabelIdx = new Int32Array(n).fill(-1)
    const many = n > MAX_ATOM_LABELS_ALL
    const oxSet = new Set(lay.oxAtoms)
    for (let i = 0; i < n; i++) {
      const e = lay.el[i]!
      if (many && (e === 'H' || e === 'O') && !oxSet.has(i)) continue
      this.atomLabelIdx[i] = this.labels.length
      this.labels.push({ id: `a${i}`, kind: schoolLabelDark(schoolAtomHex(e)) ? 'atomDark' : 'atom', pos: new THREE.Vector3(), opacity: 0, text: lay.labelL[i]!, avoidR: lay.radius[i]! })
    }
    // чипы степеней окисления — у меняющих её атомов (по два на строку изменения, если атомов много)
    // у многих атомов — по два чипа на строку изменения (остальные доноры/акцепторы видны по свечению)
    const chipAtoms: number[] = []
    if (lay.oxAtoms.length <= MAX_OX_CHIPS_ALL) chipAtoms.push(...lay.oxAtoms)
    else {
      const per = new Map<string, number>()
      for (const i of lay.oxAtoms) {
        const k = `${lay.el[i]}|${lay.oxL[i]}|${lay.oxR[i]}`
        const c = per.get(k) ?? 0
        if (c < 2) chipAtoms.push(i)
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
      this.labels.push({ id: 'half', kind: 'glassHalf', pos: new THREE.Vector3(lay.extent.cx, lay.top - 0.42, 0.4), opacity: 0, text: this.halfText() })
    }

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
    if (this.halfIdx >= 0) this.labels[this.halfIdx]!.text = this.halfText()
    this.apply(this.t)
  }

  extentAt(_t: number, out: { w: number; h: number; cx: number; cy: number }): { w: number; h: number; cx: number; cy: number } {
    const e = this.lay.extent
    out.w = e.w
    out.h = e.h
    out.cx = e.cx
    out.cy = e.cy
    return out
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
  private halfText(): string {
    const s = this.story
    const tg = HALF_TAGS[this.locale]
    const rows = [
      ...s.oxidations.map((c) => `o␟${halfLine(c, true)}␟${tg.reducer}`),
      ...s.reductions.map((c) => `r␟${halfLine(c, false)}␟${tg.oxidizer}`),
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
    const sway = 1 - smooth(lay.breakFrom - 0.4, lay.breakFrom, t) + smooth(lay.fateTo, lay.fateTo + 0.6, t)
    this._q.identity()
    const R = this.rad
    for (let i = 0; i < n; i++) {
      storyAtomPos(lay, i, t, P, i * 3)
      R[i] = storyAtomRadius(lay, i, t)
      // лёгкое «дыхание» частиц на исходных и итоге (детерминированно по времени сюжета)
      P[i * 3 + 1] = P[i * 3 + 1]! + Math.sin(t * 1.6 + i * 0.9) * 0.018 * sway
      const r = R[i]! * (0.6 + 0.4 * appear)
      this._v.set(P[i * 3]!, P[i * 3 + 1]!, P[i * 3 + 2]!)
      this._s.set(r, r, r)
      this._m.compose(this._v, this._q, this._s)
      this.atoms.setMatrixAt(i, this._m)
    }
    this.atoms.instanceMatrix.needsUpdate = true
    // шаг переноса: атомы-зрители притушены — доноры и акцепторы читаются сразу
    const dimU = Number.isFinite(lay.eOn) ? smooth(lay.eOn, lay.eOn + 0.5, t) * (1 - smooth(lay.eOff - 0.2, lay.eOff + 0.5, t)) : 0
    if (Math.abs(dimU - this.lastDim) > 0.004 || (dimU === 0 && this.lastDim !== 0)) {
      this.lastDim = dimU
      for (let i = 0; i < n; i++) this.atoms.setColorAt(i, this._c.copy(this.baseColors[i]!).multiplyScalar(this.roleOf[i] ? 1 : 1 - SPECTATOR_DIM * dimU))
      if (this.atoms.instanceColor) this.atoms.instanceColor.needsUpdate = true
    }
    this.atomMat.opacity = fade
    this.atoms.visible = fade > 0.002

    // ——— палочки ———
    const sticks = lay.sticks
    let inst = 0
    for (let k = 0; k < sticks.length; k++) {
      const s = sticks[k]!
      const alpha = s.kind === 'kept' ? 1 : s.kind === 'broken' ? 1 - smooth(s.t0, s.t1, t) : smooth(s.t0, s.t1, t)
      // кратная связь — параллельные палочки потоньше (как в школьной сцене: двойная — две, тройная — три)
      const rad = STICK_R * alpha * (s.order > 1 ? 0.72 : 1)
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
    this.stickMat.opacity = fade
    this.sticks.visible = fade > 0.002 && sticks.length > 0

    // ——— электроны: точка + хвост + ореол, по дуге от донора к акцептору ———
    const es = lay.electrons
    const tailCol = this._tail
    for (let k = 0; k < es.length; k++) {
      const e = es[k]!
      const pre = smooth(e.t0 - 0.25, e.t0, t)
      const u = smooth(e.t0, e.t1, t)
      const post = 1 - smooth(e.t1, e.t1 + 0.22, t)
      const vis = pre * post * fade
      const flying = smooth(e.t0, e.t0 + 0.08, t) * (1 - smooth(e.t1 - 0.03, e.t1 + 0.12, t))
      this.arcPoint(e.from, e.to, u, this._v)
      const er = 0.088 * pre * post * (1 + 0.14 * Math.min(4, e.n - 1)) * (1 + 0.12 * Math.sin(t * 17 + k))
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
          this.arcPoint(e.from, e.to, uj, this._w)
          const tr = 0.088 * (0.35 + 0.6 * w)
          this._s.set(tr, tr, tr)
          tailCol.copy(ELECTRON_COLOR).multiplyScalar(0.8 * w * w * flying * vis)
        }
        this._m.compose(this._w, this._q, this._s)
        this.tailMesh.setMatrixAt(ii, this._m)
        this.tailMesh.setColorAt(ii, tailCol)
      }
      // точка — заново (хвост переписал _v)
      this.arcPoint(e.from, e.to, u, this._v)
      const halo = this.halos[k]
      if (halo) {
        // после прилёта ореол вспыхивает у акцептора и гаснет
        const arrive = smooth(e.t1 - 0.05, e.t1 + 0.3, t)
        halo.visible = vis > 0.01
        halo.position.copy(this._v)
        const sc = 0.5 + 0.12 * Math.min(4, e.n - 1) + arrive * 0.55
        halo.scale.set(sc, sc, sc)
        this.haloMats[k]!.opacity = 0.85 * vis
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
        this.arcPoint(e.from, e.to, smooth(e.t0, e.t1, t), this._w)
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
      const a = (0.62 * roleOn * (0.86 + 0.14 * Math.sin(t * 3.4 + i)) + 0.55 * pulse * roleOn) * fade
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
      g.mat.opacity = 0.42 * keptOn * fade * (0.88 + 0.12 * Math.sin(t * 2.6))
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
      // символ атома-зрителя на шаге переноса притушен вместе с шаром
      L.opacity = fade * (this.roleOf[i] ? 1 : 1 - 0.45 * dimU)
    }
    // чип степени окисления: над шаром на шаге переноса; в момент отлёта/прилёта — «щелчок» и новое значение
    for (const { atom, label } of this.oxLabelIdx) {
      const L = this.labels[label]!
      const r = R[atom]!
      L.pos.set(P[atom * 3]!, P[atom * 3 + 1]! + r + 0.2, P[atom * 3 + 2]! + r)
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
      L.opacity = smooth(lay.breakFrom + 0.6, lay.breakFrom + 1.1, t) * (1 - smooth(mf, mf + 0.4, t)) * fade * (1 - 0.5 * dimU)
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
    }
    void stepId
    void stepFrom
  }

  /** Точка дуги электрона (u ∈ [0, 1]) от поверхности донора к поверхности акцептора, приподнята к зрителю. */
  private arcPoint(from: number, to: number, u: number, out: THREE.Vector3): void {
    const P = this.pos
    const ra = this.rad[from]!
    const rb = this.rad[to]!
    // выход — с той стороны донора, что смотрит на акцептор (чуть выше экватора), вход — так же у акцептора:
    // чипы степеней окисления над шарами остаются свободными
    const fx = P[from * 3]!
    const fy = P[from * 3 + 1]!
    const tx = P[to * 3]!
    const ty = P[to * 3 + 1]!
    let dx = tx - fx
    let dy = ty - fy
    const d = Math.hypot(dx, dy) || 1
    dx /= d
    dy /= d
    const ax = fx + (dx * 0.8) * ra
    const ay = fy + (dy * 0.8 + 0.6) * ra
    const az = P[from * 3 + 2]! + ra * 0.55
    const bx = tx - (dx * 0.8) * rb
    const by = ty + (-dy * 0.8 + 0.6) * rb
    const bz = P[to * 3 + 2]! + rb * 0.55
    const cx = (ax + bx) / 2
    const cy = (ay + by) / 2 + Math.abs(by - ay) * 0.5 + 0.38 + Math.min(0.7, d * 0.2)
    const cz = (az + bz) / 2 + 0.55
    const w0 = (1 - u) * (1 - u)
    const w1 = 2 * u * (1 - u)
    const w2 = u * u
    out.set(w0 * ax + w1 * cx + w2 * bx, w0 * ay + w1 * cy + w2 * by, w0 * az + w1 * cz + w2 * bz)
  }
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}
