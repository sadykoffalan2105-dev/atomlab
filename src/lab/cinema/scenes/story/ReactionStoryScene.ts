import * as THREE from 'three'
import { oxPlain, type ReactionStory } from '../../../../chemistry/reactionStory'
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
 * Шаги (без пауз, 13–16 с): Исходные → Разрыв → Перенос электронов (только ОВР) → Образование → Итог.
 * Школьный вид: матовые CPK-шары с символом внутри (DOM-подписи), серые палочки-связи, ионы ионных веществ
 * касаются друг друга (фрагмент решётки, без палочек), электроны — светящиеся точки с мягким ореолом.
 * Кадр — чистая функция времени (storyLayout.storyAtomPos): перемотка и повтор шага дают тот же кадр.
 * Атомы одни и те же весь ролик — ни один не исчезает и не появляется из ниоткуда.
 * Производительность: атомы, палочки, электроны — три InstancedMesh; ноль аллокаций в update.
 */

const BG = new THREE.Color('#0a0b10')
const MATTE = { roughness: 0.84, metalness: 0, clearcoat: 0, clearcoatRoughness: 0.4, specularIntensity: 0.16 } as const
const ELECTRON_COLOR = new THREE.Color(0x9ee4ff)
const STICK_R = 0.052
const MAX_ATOM_LABELS_ALL = 52
const MAX_OX_CHIPS = 14
const MAX_E_TOKENS = 6

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
  private readonly halos: THREE.Sprite[] = []
  private readonly haloMats: THREE.SpriteMaterial[] = []
  private readonly flashes: THREE.Sprite[] = []
  private readonly flashMats: THREE.SpriteMaterial[] = []
  private readonly flashAtoms: number[]

  /** текущие положения атомов (n×3) */
  private readonly pos: Float32Array
  /** текущие радиусы шаров */
  private readonly rad: Float32Array
  private readonly atomLabelIdx: Int32Array
  private readonly oxLabelIdx: { atom: number; label: number }[] = []
  private readonly fragLabelIdx: number[] = []
  private readonly termLabelIdx: number[] = []
  private readonly eLabelIdx: number[] = []
  private captionIdx = -1
  private equationIdx = -1
  private balanceIdx = -1

  private readonly _m = new THREE.Matrix4()
  private readonly _q = new THREE.Quaternion()
  private readonly _v = new THREE.Vector3()
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
    const col = new THREE.Color()
    for (let i = 0; i < n; i++) this.atoms.setColorAt(i, schoolAtomColor(lay.el[i]!, col))
    this.root.add(this.atoms)

    // ——— палочки ———
    this.stickGeo = new THREE.CylinderGeometry(1, 1, 1, opts.lowPower ? 8 : 14, 1, true)
    this.stickMat = withNaclRim(new THREE.MeshPhysicalMaterial({ color: 0xc9d1dc, ...MATTE, transparent: true, fog: false }), 0xffffff, NACL_RIM.atom)
    this.sticks = new THREE.InstancedMesh(this.stickGeo, this.stickMat, Math.max(1, lay.sticks.length))
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
    const halo = naclHaloTexture()
    const haloCount = opts.lowPower ? Math.min(lay.electrons.length, 6) : lay.electrons.length
    for (let k = 0; k < haloCount; k++) {
      const m = new THREE.SpriteMaterial({ map: halo, color: ELECTRON_COLOR, blending: THREE.AdditiveBlending, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, fog: false })
      const s = new THREE.Sprite(m)
      s.visible = false
      s.renderOrder = 11
      this.halos.push(s)
      this.haloMats.push(m)
      this.root.add(s)
    }
    // вспышка у атома, когда меняется его степень окисления (мягкое свечение)
    this.flashAtoms = lay.oxAtoms.slice(0, opts.lowPower ? 6 : 16)
    for (let k = 0; k < this.flashAtoms.length; k++) {
      const m = new THREE.SpriteMaterial({ map: halo, color: 0xffd58a, blending: THREE.AdditiveBlending, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, fog: false })
      const s = new THREE.Sprite(m)
      s.visible = false
      s.renderOrder = 9
      this.flashes.push(s)
      this.flashMats.push(m)
      this.root.add(s)
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
    const chipAtoms: number[] = []
    if (lay.oxAtoms.length <= MAX_OX_CHIPS) chipAtoms.push(...lay.oxAtoms)
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
    for (let k = 0; k < Math.min(MAX_E_TOKENS, lay.electrons.length); k++) {
      this.eLabelIdx.push(this.labels.length)
      this.labels.push({ id: `e${k}`, kind: 'token', pos: new THREE.Vector3(), opacity: 0, text: 'e⁻' })
    }
    this.captionIdx = this.labels.length
    this.labels.push({ id: 'caption', kind: 'glassNote', pos: new THREE.Vector3(lay.extent.cx, lay.top - 0.32, 0), opacity: 0, text: '' })
    this.balanceIdx = this.labels.length
    this.labels.push({ id: 'balance', kind: 'glassNote', pos: new THREE.Vector3(lay.extent.cx, lay.bottom + 0.98, 0), opacity: 0, text: this.balanceText() })
    this.equationIdx = this.labels.length
    this.labels.push({ id: 'equation', kind: 'glassEquation', pos: new THREE.Vector3(lay.extent.cx, lay.bottom + 0.4, 0), opacity: 0, text: story.equation })

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
    this.labels[this.balanceIdx]!.text = this.balanceText()
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
    for (const m of this.haloMats) m.dispose()
    for (const m of this.flashMats) m.dispose()
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

  private balanceText(): string {
    const s = this.story
    const atoms = s.atomBalance.map((b) => `${b.el} ${b.left} = ${b.right}`).join(' · ')
    const e = s.redox ? ` · e⁻ ${fmt(s.given)} = ${fmt(s.accepted)}` : ''
    return `${atoms}${e}`
  }

  private stepCaption(i: number): string {
    const id = this.lay.steps[i]!.id
    return `${i + 1}/${this.lay.steps.length} · ${this.story.text[this.locale][id].title}`
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
    this.atomMat.opacity = fade
    this.atoms.visible = fade > 0.002

    // ——— палочки ———
    const sticks = lay.sticks
    for (let k = 0; k < sticks.length; k++) {
      const s = sticks[k]!
      const alpha = s.kind === 'kept' ? 1 : s.kind === 'broken' ? 1 - smooth(s.t0, s.t1, t) : smooth(s.t0, s.t1, t)
      const rad = STICK_R * alpha
      this._a.set(P[s.a * 3]!, P[s.a * 3 + 1]!, P[s.a * 3 + 2]!)
      this._b.set(P[s.b * 3]!, P[s.b * 3 + 1]!, P[s.b * 3 + 2]!)
      const len = this._a.distanceTo(this._b)
      if (rad < 0.002 || len < 1e-4) {
        this._s.set(0, 0, 0)
        this._m.compose(this._a, this._q.identity(), this._s)
      } else {
        this._v.subVectors(this._b, this._a).divideScalar(len)
        this._q.setFromUnitVectors(this._up, this._v)
        this._v.addVectors(this._a, this._b).multiplyScalar(0.5)
        this._s.set(rad, len, rad)
        this._m.compose(this._v, this._q, this._s)
      }
      this.sticks.setMatrixAt(k, this._m)
    }
    this.sticks.instanceMatrix.needsUpdate = true
    this.stickMat.opacity = fade
    this.sticks.visible = fade > 0.002 && sticks.length > 0

    // ——— электроны ———
    const es = lay.electrons
    for (let k = 0; k < es.length; k++) {
      const e = es[k]!
      const pre = smooth(e.t0 - 0.35, e.t0, t)
      const u = smooth(e.t0, e.t1, t)
      const post = 1 - smooth(e.t1, e.t1 + 0.35, t)
      const vis = pre * post
      const ra = R[e.from]!
      const rb = R[e.to]!
      // дуга от поверхности донора к поверхности акцептора, приподнята к зрителю
      const ax = P[e.from * 3]!
      const ay = P[e.from * 3 + 1]! + ra * 0.85
      const az = P[e.from * 3 + 2]! + ra * 0.5
      const bx = P[e.to * 3]!
      const by = P[e.to * 3 + 1]! + rb * 0.85
      const bz = P[e.to * 3 + 2]! + rb * 0.5
      const cx = (ax + bx) / 2
      const cy = Math.max(ay, by) + 0.55 + Math.min(0.6, Math.abs(bx - ax) * 0.15)
      const cz = (az + bz) / 2 + 0.45
      const w0 = (1 - u) * (1 - u)
      const w1 = 2 * u * (1 - u)
      const w2 = u * u
      this._v.set(w0 * ax + w1 * cx + w2 * bx, w0 * ay + w1 * cy + w2 * by, w0 * az + w1 * cz + w2 * bz)
      const er = 0.065 * vis * (1 + 0.25 * Math.sin(t * 18 + k))
      this._s.set(er, er, er)
      this._m.compose(this._v, this._q.identity(), this._s)
      this.eMesh.setMatrixAt(k, this._m)
      const halo = this.halos[k]
      if (halo) {
        // после прилёта ореол вспыхивает у акцептора и гаснет
        const arrive = smooth(e.t1 - 0.05, e.t1 + 0.3, t)
        halo.visible = vis > 0.01
        halo.position.copy(this._v)
        const sc = 0.42 + arrive * 0.5
        halo.scale.set(sc, sc, sc)
        this.haloMats[k]!.opacity = 0.75 * vis * fade
      }
      const li = this.eLabelIdx[k]
      if (li != null) {
        const L = this.labels[li]!
        L.pos.set(this._v.x, this._v.y + 0.17, this._v.z)
        L.opacity = vis * smooth(e.t0, e.t0 + 0.15, t) * (1 - smooth(e.t1 - 0.2, e.t1, t)) * fade
      }
    }
    if (es.length) this.eMesh.instanceMatrix.needsUpdate = true
    this.eMat.opacity = fade
    this.eMesh.visible = es.length > 0 && fade > 0.002

    // ——— вспышки при смене степени окисления ———
    for (let k = 0; k < this.flashAtoms.length; k++) {
      const i = this.flashAtoms[k]!
      const tf = lay.flipAt[i]!
      const sp = this.flashes[k]!
      if (!Number.isFinite(tf)) {
        sp.visible = false
        continue
      }
      const x = (t - tf) / 0.32
      const pulse = Math.exp(-x * x)
      sp.visible = pulse > 0.02
      sp.position.set(P[i * 3]!, P[i * 3 + 1]!, P[i * 3 + 2]! + 0.05)
      const sc = R[i]! * (2.6 + 1.6 * pulse)
      sp.scale.set(sc, sc, sc)
      this.flashMats[k]!.opacity = 0.6 * pulse * fade
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
      L.opacity = fade
    }
    const sE = steps.find((s) => s.id === 'electrons')
    for (const { atom, label } of this.oxLabelIdx) {
      const L = this.labels[label]!
      const r = R[atom]!
      L.pos.set(P[atom * 3]! + r * 0.8, P[atom * 3 + 1]! + r + 0.13, P[atom * 3 + 2]! + r)
      L.text = t >= lay.flipAt[atom]! ? oxPlain(lay.oxR[atom]!) : oxPlain(lay.oxL[atom]!)
      const on = sE ? smooth(sE.from - 0.1, sE.from + 0.4, t) * (1 - smooth(lay.moveFrom[atom]! + 0.2, lay.moveFrom[atom]! + 0.7, t)) : 0
      const back = smooth(lay.fateTo, lay.fateTo + 0.5, t)
      L.opacity = Math.max(on, back) * fade
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
      L.opacity = smooth(lay.breakFrom + 0.6, lay.breakFrom + 1.1, t) * (1 - smooth(mf, mf + 0.4, t)) * fade
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
    const cap = this.labels[this.captionIdx]!
    cap.text = this.stepCaption(idx)
    cap.opacity = fade * (0.55 + 0.45 * smooth(stepFrom, stepFrom + 0.35, t))
    const eq = this.labels[this.equationIdx]!
    eq.opacity = fade * (stepId === 'result' ? 1 : 0.88)
    const bal = this.labels[this.balanceIdx]!
    bal.opacity = stepId === 'result' ? fade * smooth(stepFrom + 0.2, stepFrom + 0.7, t) : 0
  }
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}
