import * as THREE from 'three'
import * as GSAP from 'gsap'
import { cpkHex, pmToScene } from '../../kit/cpkAtoms'
import { liquidProfile, roundTestTubeProfile } from '../../kit/glassware'
import { localizeLabelText, type SceneLocale } from '../../kit/sceneKit'
import { naclSphereGeometry, NACL_RIM, withNaclRim } from '../../nacl/naclLatticeView'
import { SCHOOL_SCENE_BG, type SchoolLightRig, type SchoolSceneLabel, type SchoolStatus } from '../SchoolReactionScene'
import type { SchoolLabelKind } from '../schoolModel'
import {
  buildSolutionModel,
  createSolutionState,
  sampleSolutionState,
  solutionExtentAt,
  solutionSmooth,
  SOLUTION_DRAW,
  type SolutionCueId,
  type SolutionModel,
  type SolutionState,
} from './solutionModel'
import type { SolutionSceneSpec } from './solutionSpec'

/**
 * ШКОЛЬНАЯ СЦЕНА «ОБМЕН В РАСТВОРЕ» (BaCl₂ + H₂SO₄ → BaSO₄↓ + 2HCl) — класс на Three.js + GSAP с тем же
 * интерфейсом, что у SchoolReactionScene (адаптер SchoolCinemaScene работает с обоими). Кадр — чистая
 * функция времени sampleSolutionState (solutionModel.ts); класс только переносит состояние в объекты three.
 *
 * Слои:
 *   • макро — пробирки (lathe по профилю kit/glassware), жидкость, струя при сливании, белая муть
 *     (точки) и слой осадка на дне;
 *   • микро — ионы и частицы школьным языком (SCHOOL-материалы: матовые CPK-шары, символ внутри шара,
 *     серые палочки связей внутри частиц), вода — полупрозрачные уголки O + 2H; пунктир притяжения
 *     Ba²⁺ ↔ SO₄²⁻, граница двух растворов; заряды — подписями; точек-электронов на ионах нет.
 * Переход макро ↔ микро — «лупа»: один слой гаснет и растёт, другой проявляется из меньшего масштаба.
 * Производительность: шары и палочки — InstancedMesh (отдельно для воды), ноль аллокаций в update.
 */

const gsap: typeof GSAP.gsap =
  (GSAP as unknown as { gsap?: typeof GSAP.gsap }).gsap ?? (GSAP as unknown as { default: { gsap: typeof GSAP.gsap } }).default.gsap

const K = pmToScene(1)
const MATTE = { roughness: 0.84, metalness: 0, clearcoat: 0, clearcoatRoughness: 0.4, specularIntensity: 0.16 } as const
const WATER_OPACITY = 0.62

export type SolutionSceneOptions = {
  locale?: SceneLocale
  lowPower?: boolean
  onCue?: (id: SolutionCueId) => void
  onStatus?: (status: SchoolStatus, step: number) => void
  lights?: SchoolLightRig
}

function atomColor(el: string, water: boolean): THREE.Color {
  const c = new THREE.Color(cpkHex(el as never))
  if (el === 'H') c.multiplyScalar(0.9)
  // Ba (0x00c900) и Cl (0x1ff01f) в CPK оба зелёные: барий темнее, чтобы ионы различались и без подписи.
  if (el === 'Ba') c.multiplyScalar(0.72)
  if (water) c.lerp(new THREE.Color(0x9fb4c8), 0.3)
  return c
}

export class SolutionExchangeScene {
  readonly root = new THREE.Group()
  readonly background = SCHOOL_SCENE_BG.clone()
  private hostBackground: THREE.Color | null = null
  readonly labels: SchoolSceneLabel[]
  readonly model: SolutionModel

  private readonly opts: SolutionSceneOptions
  private locale: SceneLocale
  private readonly state: SolutionState
  private readonly clock = { t: 0 }
  private tween: gsap.core.Tween | null = null
  private speed = 1
  private status: SchoolStatus = 'idle'
  private stepIndex = 0
  private lastCueT = -1
  private appliedT = NaN
  private lastDt = 1 / 60
  private pendingResolve: (() => void) | null = null
  private disposed = false
  private viewportH = 800
  private viewportFov = 46

  private readonly stage = new THREE.Group()
  private readonly micro = new THREE.Group()
  private readonly macro = new THREE.Group()
  private readonly lights: SchoolLightRig
  private readonly ownLights: boolean
  private readonly sphere: THREE.SphereGeometry
  private readonly stickGeo: THREE.CylinderGeometry
  /** индекс атома → [меш, слот] */
  private readonly slotOf: Int32Array
  private readonly isWaterAtom: Uint8Array
  private readonly ions: THREE.InstancedMesh
  private readonly ionMat: THREE.MeshPhysicalMaterial
  private readonly waterAtoms: THREE.InstancedMesh
  private readonly waterAtomMat: THREE.MeshPhysicalMaterial
  private readonly sticks: THREE.InstancedMesh
  private readonly stickMat: THREE.MeshPhysicalMaterial
  private readonly waterSticks: THREE.InstancedMesh
  private readonly waterStickMat: THREE.MeshPhysicalMaterial
  private readonly stickSlot: Int32Array
  private readonly attract: THREE.Line
  private readonly attractMat: THREE.LineDashedMaterial
  private readonly divider: THREE.Line
  private readonly dividerMat: THREE.LineDashedMaterial
  /** рёбра ячеек кристаллика (система кристалла: центр и поворот вокруг вертикали) */
  private readonly crystalFrame = new THREE.Group()
  private readonly edges: THREE.LineSegments
  private readonly edgeMat: THREE.LineBasicMaterial
  // макро
  private readonly glassGeo: THREE.LatheGeometry
  private readonly glassMat: THREE.MeshPhysicalMaterial
  private readonly rimMat: THREE.MeshBasicMaterial
  private readonly tubeA = new THREE.Group()
  private readonly tubeB = new THREE.Group()
  private readonly liquidGeo: THREE.LatheGeometry
  private readonly columnGeo: THREE.CylinderGeometry
  private readonly liquidMatA: THREE.MeshPhysicalMaterial
  private readonly liquidMatB: THREE.MeshPhysicalMaterial
  private readonly liquidA = new THREE.Group()
  private readonly liquidB = new THREE.Group()
  private readonly columnA: THREE.Mesh
  private readonly columnB: THREE.Mesh
  private readonly sedimentGeo: THREE.LatheGeometry
  private readonly sedimentMat: THREE.MeshStandardMaterial
  private readonly sediment: THREE.Mesh
  private readonly turbidGeo: THREE.BufferGeometry
  private readonly turbidMat: THREE.PointsMaterial
  private readonly turbid: THREE.Points
  private readonly streamGeo: THREE.CylinderGeometry
  private readonly streamMat: THREE.MeshPhysicalMaterial
  private readonly stream: THREE.Mesh
  private readonly insideVis: Float32Array
  private readonly discs: Float32Array
  private readonly labelIndexOfAtom: Int32Array

  private readonly _v = new THREE.Vector3()
  private readonly _w = new THREE.Vector3()
  private readonly _c = new THREE.Vector3()
  private readonly _s = new THREE.Vector3()
  private readonly _q = new THREE.Quaternion()
  private readonly _m = new THREE.Matrix4()
  private readonly _inv = new THREE.Matrix4()
  private readonly _up = new THREE.Vector3(0, 1, 0)

  constructor(spec: SolutionSceneSpec, opts: SolutionSceneOptions = {}) {
    this.opts = opts
    this.locale = opts.locale ?? 'ru'
    this.model = buildSolutionModel(spec)
    this.state = createSolutionState(this.model)
    const m = this.model
    this.root.name = `school-${spec.id}-root`
    this.root.add(this.stage)
    this.stage.add(this.macro, this.micro)
    this.sphere = naclSphereGeometry(opts.lowPower)

    this.ownLights = !opts.lights
    this.lights = opts.lights ?? {
      ambient: new THREE.AmbientLight(0xdfe8ff, 0.34),
      key: new THREE.DirectionalLight(0xffffff, 0.9),
      point: new THREE.PointLight(0xbfe6ff, 0.45, 12, 1.6),
    }
    if (this.ownLights) {
      this.lights.key.position.set(3.5, 5, 6)
      this.root.add(this.lights.ambient, this.lights.key, this.lights.key.target, this.lights.point)
    }

    // ——— микро: шары ионов/частиц и воды (два InstancedMesh) ———
    const n = m.atoms.length
    this.slotOf = new Int32Array(n)
    this.isWaterAtom = new Uint8Array(n)
    let nIon = 0
    let nWater = 0
    m.atoms.forEach((a, i) => {
      const water = m.bodies[a.body]!.kind === 'water'
      this.isWaterAtom[i] = water ? 1 : 0
      this.slotOf[i] = water ? nWater++ : nIon++
    })
    this.ionMat = withNaclRim(new THREE.MeshPhysicalMaterial({ color: 0xffffff, ...MATTE, transparent: true, fog: false }), 0xffffff, NACL_RIM.atom)
    this.ions = new THREE.InstancedMesh(this.sphere, this.ionMat, Math.max(1, nIon))
    this.waterAtomMat = withNaclRim(new THREE.MeshPhysicalMaterial({ color: 0xffffff, ...MATTE, transparent: true, depthWrite: false, fog: false }), 0xffffff, NACL_RIM.atom)
    this.waterAtoms = new THREE.InstancedMesh(this.sphere, this.waterAtomMat, Math.max(1, nWater))
    this.ions.name = 'solution-ions'
    this.waterAtoms.name = 'solution-water'
    this.ions.frustumCulled = false
    this.waterAtoms.frustumCulled = false
    this.waterAtoms.renderOrder = 2
    m.atoms.forEach((a, i) => {
      const mesh = this.isWaterAtom[i] ? this.waterAtoms : this.ions
      mesh.setColorAt(this.slotOf[i]!, atomColor(a.el, this.isWaterAtom[i] === 1))
    })
    this.micro.add(this.ions, this.waterAtoms)

    // ——— палочки ———
    this.stickGeo = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true)
    this.stickMat = withNaclRim(new THREE.MeshPhysicalMaterial({ color: 0xd4dce6, ...MATTE, transparent: true, fog: false }), 0xffffff, NACL_RIM.atom)
    this.waterStickMat = withNaclRim(new THREE.MeshPhysicalMaterial({ color: 0xc4ccd6, ...MATTE, transparent: true, depthWrite: false, fog: false }), 0xffffff, NACL_RIM.atom)
    this.stickSlot = new Int32Array(m.sticks.length)
    let sIon = 0
    let sWater = 0
    m.sticks.forEach((s, k) => {
      this.stickSlot[k] = s.water ? sWater++ : sIon++
    })
    this.sticks = new THREE.InstancedMesh(this.stickGeo, this.stickMat, Math.max(1, sIon))
    this.waterSticks = new THREE.InstancedMesh(this.stickGeo, this.waterStickMat, Math.max(1, sWater))
    this.sticks.frustumCulled = false
    this.waterSticks.frustumCulled = false
    this.waterSticks.renderOrder = 2
    this.micro.add(this.sticks, this.waterSticks)

    // ——— пунктир притяжения и граница растворов ———
    this.attractMat = new THREE.LineDashedMaterial({ color: 0xffd98a, dashSize: 26 * K, gapSize: 18 * K, transparent: true, opacity: 0, depthTest: false, fog: false })
    this.attract = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(1, 0, 0)]), this.attractMat)
    this.attract.renderOrder = 8
    this.attract.frustumCulled = false
    this.dividerMat = new THREE.LineDashedMaterial({ color: 0x9fc4e8, dashSize: 40 * K, gapSize: 34 * K, transparent: true, opacity: 0, depthWrite: false, fog: false })
    this.divider = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -980 * K, -300 * K), new THREE.Vector3(0, 980 * K, -300 * K)]), this.dividerMat)
    this.divider.computeLineDistances()
    this.divider.frustumCulled = false
    this.micro.add(this.attract, this.divider)
    const edgePts: THREE.Vector3[] = []
    for (const [a, b] of m.cellEdges) edgePts.push(new THREE.Vector3(a[0] * K, a[1] * K, a[2] * K), new THREE.Vector3(b[0] * K, b[1] * K, b[2] * K))
    this.edgeMat = new THREE.LineBasicMaterial({ color: 0x8fb8e0, transparent: true, opacity: 0, depthWrite: false, fog: false })
    this.edges = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(edgePts), this.edgeMat)
    this.edges.frustumCulled = false
    this.crystalFrame.add(this.edges)
    this.micro.add(this.crystalFrame)

    // ——— макро: пробирки ———
    const R = m.tube.r
    const H = m.tube.h
    const lathe = (pts: readonly (readonly [number, number])[]) =>
      new THREE.LatheGeometry(
        pts.map(([x, y]) => new THREE.Vector2(x * K, y * K)),
        opts.lowPower ? 28 : 48,
      )
    this.glassGeo = lathe(roundTestTubeProfile(R, H))
    this.glassMat = new THREE.MeshPhysicalMaterial({ color: 0xe8f4ff, roughness: 0.05, metalness: 0, transmission: 0, transparent: true, opacity: 0.1, side: THREE.FrontSide, depthWrite: false, fog: false })
    this.rimMat = new THREE.MeshBasicMaterial({ color: 0xbfdcff, transparent: true, opacity: 0.3, side: THREE.BackSide, depthWrite: false, fog: false })
    // жидкость: полусферическое дно (не тянется) + столбик до уровня (масштаб по y)
    this.liquidGeo = lathe(liquidProfile(R, R))
    this.columnGeo = new THREE.CylinderGeometry(R * 0.9 * K, R * 0.9 * K, 1, opts.lowPower ? 28 : 48, 1, false)
    this.columnGeo.translate(0, 0.5, 0)
    this.liquidMatA = new THREE.MeshPhysicalMaterial({ color: 0xb3d6ff, roughness: 0.2, transparent: true, opacity: 0.3, depthWrite: false, fog: false })
    this.liquidMatB = this.liquidMatA.clone()
    this.columnA = new THREE.Mesh(this.columnGeo, this.liquidMatA)
    this.columnB = new THREE.Mesh(this.columnGeo, this.liquidMatB)
    this.columnA.position.y = R * K
    this.columnB.position.y = R * K
    this.liquidA.add(new THREE.Mesh(this.liquidGeo, this.liquidMatA), this.columnA)
    this.liquidB.add(new THREE.Mesh(this.liquidGeo, this.liquidMatB), this.columnB)
    this.sedimentGeo = lathe(liquidProfile(R, R * 0.25 + 0.2 * H, 0.9))
    this.sedimentMat = new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.95, transparent: true, opacity: 0.96, fog: false })
    this.sediment = new THREE.Mesh(this.sedimentGeo, this.sedimentMat)
    this.turbidGeo = new THREE.BufferGeometry()
    this.turbidGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(m.turbidPoints * 3), 3))
    this.turbidMat = new THREE.PointsMaterial({ color: 0xffffff, size: 16 * K, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, fog: false })
    this.turbid = new THREE.Points(this.turbidGeo, this.turbidMat)
    this.turbid.frustumCulled = false
    const glassA = new THREE.Mesh(this.glassGeo, this.glassMat)
    const glassB = new THREE.Mesh(this.glassGeo, this.glassMat)
    const rimA = new THREE.Mesh(this.glassGeo, this.rimMat)
    const rimB = new THREE.Mesh(this.glassGeo, this.rimMat)
    rimA.scale.setScalar(1.015)
    rimB.scale.setScalar(1.015)
    this.tubeA.add(this.liquidA, this.sediment, this.turbid, glassA, rimA)
    this.tubeB.add(this.liquidB, glassB, rimB)
    this.streamGeo = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true)
    this.streamMat = new THREE.MeshPhysicalMaterial({ color: 0xcfe6ff, roughness: 0.2, transparent: true, opacity: 0, depthWrite: false, fog: false })
    this.stream = new THREE.Mesh(this.streamGeo, this.streamMat)
    this.macro.add(this.tubeA, this.tubeB, this.stream)

    // ——— подписи ———
    this.labels = m.labels.map((l) => ({ id: l.id, kind: l.kind as SchoolLabelKind, pos: new THREE.Vector3(), opacity: 0, text: this.localize(l.text[this.locale]) }))
    this.insideVis = new Float32Array(m.labels.length).fill(1)
    this.discs = new Float32Array(n * 4)
    this.labelIndexOfAtom = new Int32Array(n).fill(-1)
    m.atoms.forEach((a, i) => {
      if (a.label >= 0) this.labelIndexOfAtom[i] = a.label
    })
    this.apply(0, true)
  }

  // ─── Машина состояний (как у SchoolReactionScene) ───────────────────────────

  get time(): number {
    return this.clock.t
  }

  get stepCount(): number {
    return this.model.timing.steps.length
  }

  goToStep(index: number, opts: { instant?: boolean } = {}): Promise<void> {
    const steps = this.model.timing.steps
    const i = Math.max(0, Math.min(steps.length - 1, index))
    const step = steps[i]!
    this.killTween()
    if (opts.instant) {
      this.seek(step.to)
      this.stepIndex = i
      this.setStatus('paused')
      return Promise.resolve()
    }
    const t = this.clock.t
    if (t < step.from - 1e-3 || t >= step.to - 1e-3) this.seek(step.from)
    this.stepIndex = i
    this.setStatus('playing')
    return this.playTo(step.to, () => this.setStatus('paused'))
  }

  next(): Promise<void> {
    if (this.status === 'finishing' || this.status === 'done') return Promise.resolve()
    const last = this.model.timing.steps.length - 1
    if (this.stepIndex >= last && this.status === 'paused') return this.finish()
    if (this.status === 'playing') return this.goToStep(this.stepIndex + 1)
    return this.goToStep(this.status === 'idle' ? 0 : this.stepIndex + 1)
  }

  prev(): Promise<void> {
    return this.goToStep(this.stepIndex - 1)
  }

  replay(): Promise<void> {
    if (this.status === 'finishing' || this.status === 'done') return Promise.resolve()
    const step = this.model.timing.steps[this.stepIndex]!
    this.killTween()
    const i = this.stepIndex
    this.seek(step.from)
    this.stepIndex = i
    this.setStatus('playing')
    return this.playTo(step.to, () => this.setStatus('paused'))
  }

  finish(): Promise<void> {
    if (this.status === 'finishing' || this.status === 'done') return Promise.resolve()
    this.killTween()
    const steps = this.model.timing.steps
    const lastTo = steps[steps.length - 1]!.to
    if (this.clock.t < lastTo - 1e-3) this.seek(lastTo)
    this.stepIndex = steps.length - 1
    this.setStatus('finishing')
    return this.playTo(this.model.timing.end, () => this.setStatus('done'))
  }

  pause(): void {
    this.tween?.pause()
  }

  resume(): void {
    this.tween?.resume()
  }

  setSpeed(k: number): void {
    this.speed = Math.max(0.05, k)
    this.tween?.timeScale(this.speed)
  }

  seek(t: number): void {
    const c = Math.max(0, Math.min(this.model.timing.end, t))
    if (c < this.clock.t) this.lastCueT = c
    this.clock.t = c
    this.stepIndex = this.model.timing.stepIndexAt(c)
    this.apply(c, true)
  }

  setLocale(locale: SceneLocale): void {
    this.locale = locale
    this.model.labels.forEach((l, k) => {
      this.labels[k]!.text = this.localize(l.text[locale])
    })
    this.appliedT = NaN
  }

  extentAt(t: number, out: { w: number; h: number; cx: number; cy: number }): { w: number; h: number; cx: number; cy: number } {
    const e = solutionExtentAt(this.model, t)
    out.w = e.w * K
    out.h = e.h * K
    out.cx = e.cx * K
    out.cy = e.cy * K
    return out
  }

  setHostBackground(color: THREE.Color | null): void {
    this.hostBackground = color
  }

  setViewport(heightPx: number, fovDeg: number): void {
    if (heightPx > 1) this.viewportH = heightPx
    if (fovDeg > 1) this.viewportFov = fovDeg
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
      this.appliedT = NaN
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.killTween()
    this.root.removeFromParent()
    this.edges.geometry.dispose()
    for (const x of [this.edgeMat, this.ionMat, this.waterAtomMat, this.stickMat, this.waterStickMat, this.attractMat, this.dividerMat, this.glassMat, this.rimMat, this.liquidMatA, this.liquidMatB, this.sedimentMat, this.turbidMat, this.streamMat]) x.dispose()
    for (const x of [this.ions, this.waterAtoms, this.sticks, this.waterSticks]) x.dispose()
    for (const g of [this.stickGeo, this.glassGeo, this.liquidGeo, this.columnGeo, this.sedimentGeo, this.turbidGeo, this.streamGeo, this.attract.geometry, this.divider.geometry]) g.dispose()
    if (!this.ownLights) {
      this.lights.ambient.intensity = 0
      this.lights.key.intensity = 0
      this.lights.point.intensity = 0
    }
  }

  update(dt: number, camera: THREE.Camera): void {
    if (this.disposed) return
    this.lastDt = Math.min(0.1, Math.max(0, dt))
    const t = this.clock.t
    this.fireCues(t)
    this.apply(t, false)
    this.animate(camera)
    if (this.hostBackground) {
      const fin = this.model.finish
      const u = Math.min(1, Math.max(0, (t - fin.from) / (fin.to - fin.from)))
      this.background.copy(SCHOOL_SCENE_BG).lerp(this.hostBackground, u)
    }
  }

  // ─── внутреннее ────────────────────────────────────────────────────────────

  private localize(text: string): string {
    return localizeLabelText(text, this.locale, true)
  }

  private setStatus(status: SchoolStatus): void {
    this.status = status
    this.opts.onStatus?.(status, this.stepIndex)
  }

  private killTween(): void {
    if (this.tween) {
      this.tween.kill()
      this.tween = null
    }
    const r = this.pendingResolve
    this.pendingResolve = null
    r?.()
  }

  private playTo(to: number, done: () => void): Promise<void> {
    const dur = Math.max(0, to - this.clock.t)
    return new Promise<void>((resolve) => {
      this.pendingResolve = resolve
      this.tween = gsap.to(this.clock, {
        t: to,
        duration: dur,
        ease: 'none',
        onComplete: () => {
          this.tween = null
          done()
          const r = this.pendingResolve
          this.pendingResolve = null
          r?.()
        },
      })
      this.tween.timeScale(this.speed)
    })
  }

  private fireCues(t: number): void {
    if (t <= this.lastCueT) {
      this.lastCueT = Math.min(this.lastCueT, t)
      return
    }
    const from = this.lastCueT
    this.lastCueT = t
    for (const c of this.model.timing.cues) if (c.at > from && c.at <= t) this.opts.onCue?.(c.id)
  }

  private apply(t: number, force: boolean): void {
    if (!force && t === this.appliedT) return
    this.appliedT = t
    const s = sampleSolutionState(this.model, t, this.state)
    const m = this.model

    // ——— слои ———
    this.micro.visible = s.microAlpha > 0.004
    this.macro.visible = s.macroAlpha > 0.004
    this.micro.scale.setScalar(s.microScale)
    this.macro.scale.setScalar(s.macroScale)
    this.ionMat.opacity = s.microAlpha
    this.stickMat.opacity = s.microAlpha
    this.waterAtomMat.opacity = WATER_OPACITY * s.microAlpha
    this.waterStickMat.opacity = WATER_OPACITY * s.microAlpha
    this.ionMat.depthWrite = s.microAlpha > 0.98

    // ——— шары ———
    this._q.identity()
    for (let i = 0; i < m.atoms.length; i++) {
      this._v.set(s.atomPos[i * 3]! * K, s.atomPos[i * 3 + 1]! * K, s.atomPos[i * 3 + 2]! * K)
      const r = s.atomR[i]! * K
      this._s.set(r, r, r)
      this._m.compose(this._v, this._q, this._s)
      ;(this.isWaterAtom[i] ? this.waterAtoms : this.ions).setMatrixAt(this.slotOf[i]!, this._m)
    }
    this.ions.instanceMatrix.needsUpdate = true
    this.waterAtoms.instanceMatrix.needsUpdate = true

    // ——— палочки ———
    for (let k = 0; k < m.sticks.length; k++) {
      const st = m.sticks[k]!
      const alpha = s.stickAlpha[k]!
      this._v.set(s.stickA[k * 3]! * K, s.stickA[k * 3 + 1]! * K, s.stickA[k * 3 + 2]! * K)
      this._w.set(s.stickB[k * 3]! * K, s.stickB[k * 3 + 1]! * K, s.stickB[k * 3 + 2]! * K)
      this._c.addVectors(this._v, this._w).multiplyScalar(0.5)
      this._w.sub(this._v)
      const len = this._w.length()
      if (alpha < 0.01 || len < 1e-6) {
        this._s.set(0, 0, 0)
        this._q.identity()
      } else {
        this._w.divideScalar(len)
        this._q.setFromUnitVectors(this._up, this._w)
        const rr = (st.water ? SOLUTION_DRAW.waterStickR : SOLUTION_DRAW.stickR) * K * alpha
        this._s.set(rr, len, rr)
      }
      this._m.compose(this._c, this._q, this._s)
      ;(st.water ? this.waterSticks : this.sticks).setMatrixAt(this.stickSlot[k]!, this._m)
    }
    this.sticks.instanceMatrix.needsUpdate = true
    this.waterSticks.instanceMatrix.needsUpdate = true

    // ——— пунктиры ———
    this.attractMat.opacity = 0.85 * s.attract.alpha * s.microAlpha
    this.attract.visible = this.attractMat.opacity > 0.01
    if (this.attract.visible) {
      const pos = this.attract.geometry.getAttribute('position') as THREE.BufferAttribute
      pos.setXYZ(0, s.attract.a[0] * K, s.attract.a[1] * K, s.attract.a[2] * K)
      pos.setXYZ(1, s.attract.b[0] * K, s.attract.b[1] * K, s.attract.b[2] * K)
      pos.needsUpdate = true
      this.attract.computeLineDistances()
    }
    this.dividerMat.opacity = 0.45 * s.divider.alpha * s.microAlpha
    this.divider.visible = this.dividerMat.opacity > 0.01
    this.crystalFrame.position.set(s.crystal.c[0] * K, s.crystal.c[1] * K, s.crystal.c[2] * K)
    this.crystalFrame.rotation.set(0, s.crystal.yaw, 0)
    this.edgeMat.opacity = 0.32 * s.crystal.alpha * s.microAlpha
    this.edges.visible = this.edgeMat.opacity > 0.01

    // ——— пробирки ———
    const H = m.tube.h
    const setTube = (g: THREE.Group, x: number, y: number, rot: number) => {
      g.position.set(x * K, y * K, 0)
      g.rotation.set(0, 0, rot)
    }
    setTube(this.tubeA, s.tubeA.x, s.tubeA.y, s.tubeA.rot)
    setTube(this.tubeB, s.tubeB.x, s.tubeB.y, s.tubeB.rot)
    this.tubeB.visible = s.tubeB.alpha > 0.01
    this.columnA.scale.set(1, Math.max(0.001, (s.tubeA.level * H - m.tube.r) * K), 1)
    this.columnB.scale.set(1, Math.max(0.001, (s.tubeB.level * H - m.tube.r) * K), 1)
    this.liquidB.visible = s.tubeB.liquid > 0.02
    this.glassMat.opacity = 0.1 * s.macroAlpha
    this.rimMat.opacity = 0.3 * s.macroAlpha
    // мутная жидкость белеет
    const milk = s.turbidity
    this.liquidMatA.color.setRGB(0.7 + 0.3 * milk, 0.84 + 0.16 * milk, 1)
    this.liquidMatA.opacity = (0.3 + 0.5 * milk) * s.macroAlpha
    this.liquidMatB.opacity = 0.3 * s.macroAlpha * s.tubeB.liquid
    const sedH = m.tube.r * 0.25 + s.sediment * H
    this.sediment.scale.set(1, Math.max(0.001, sedH / (m.tube.r * 0.25 + 0.2 * H)), 1)
    this.sediment.visible = s.sediment > 0.0005
    this.sedimentMat.opacity = 0.96 * s.macroAlpha
    const tp = this.turbidGeo.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < m.turbidPoints; i++) tp.setXYZ(i, s.turbidPos[i * 3]! * K, s.turbidPos[i * 3 + 1]! * K, s.turbidPos[i * 3 + 2]! * K)
    tp.needsUpdate = true
    this.turbidMat.opacity = 0.85 * s.turbidity * s.macroAlpha
    this.turbid.visible = this.turbidMat.opacity > 0.01
    // струя
    this.streamMat.opacity = 0.55 * s.stream.alpha * s.macroAlpha
    this.stream.visible = this.streamMat.opacity > 0.01
    if (this.stream.visible) {
      this._v.set(s.stream.a[0] * K, s.stream.a[1] * K, 0)
      this._w.set(s.stream.b[0] * K, s.stream.b[1] * K, 0)
      this._c.addVectors(this._v, this._w).multiplyScalar(0.5)
      this._w.sub(this._v)
      const len = this._w.length()
      this._w.divideScalar(Math.max(1e-6, len))
      this.stream.position.copy(this._c)
      this.stream.quaternion.setFromUnitVectors(this._up, this._w)
      this.stream.scale.set(9 * K, len, 9 * K)
    }

    // ——— подписи ———
    for (let k = 0; k < this.labels.length; k++) {
      const l = this.labels[k]!
      l.pos.set(s.labelPos[k * 3]! * K, s.labelPos[k * 3 + 1]! * K, s.labelPos[k * 3 + 2]! * K)
      l.opacity = s.labelOpacity[k]! * (m.labels[k]!.kind === 'atom' || m.labels[k]!.kind === 'atomDark' ? this.insideVis[k]! : 1)
    }
  }

  private pxPerProjUnit(): number {
    return this.viewportH / (2 * Math.tan((this.viewportFov * Math.PI) / 360))
  }

  /** Символ внутри шара виден, если шар крупный на экране и его центр не заслонён более близким шаром. */
  private animate(camera: THREE.Camera): void {
    const s = this.state
    const m = this.model
    const n = m.atoms.length
    this.root.updateMatrixWorld()
    this._inv.copy(this.root.matrixWorld).invert()
    camera.getWorldPosition(this._c).applyMatrix4(this._inv)
    const cam = this._c
    const px = this.pxPerProjUnit()
    const D = this.discs
    const ms = s.microScale
    for (let i = 0; i < n; i++) {
      this._v.set(s.atomPos[i * 3]! * K * ms, s.atomPos[i * 3 + 1]! * K * ms, s.atomPos[i * 3 + 2]! * K * ms)
      const o = i * 4
      const depth = cam.z - this._v.z
      if (depth < 0.02 || s.atomR[i]! <= 0) {
        D[o + 2] = -1
        continue
      }
      D[o] = (this._v.x - cam.x) / depth
      D[o + 1] = (this._v.y - cam.y) / depth
      D[o + 2] = depth
      D[o + 3] = (s.atomR[i]! * K * ms) / depth
      const li = this.labelIndexOfAtom[i]!
      if (li >= 0) {
        this._w.copy(cam).sub(this._v).normalize()
        this.labels[li]!.pos.copy(this._v).addScaledVector(this._w, s.atomR[i]! * K * ms)
      }
    }
    const blend = Math.min(1, this.lastDt * 12)
    for (let i = 0; i < n; i++) {
      const li = this.labelIndexOfAtom[i]!
      if (li < 0) continue
      const o = i * 4
      let target = 0
      if (D[o + 2]! > 0) {
        target = solutionSmooth(8, 12, D[o + 3]! * px)
        for (let j = 0; j < n && target > 0; j++) {
          if (j === i || this.isWaterAtom[j]) continue
          const q = j * 4
          if (!(D[q + 2]! > 0) || D[q + 2]! >= D[o + 2]!) continue
          if (Math.hypot(D[o]! - D[q]!, D[o + 1]! - D[q + 1]!) < 0.8 * D[q + 3]!) target = 0
        }
      }
      this.insideVis[li] = this.insideVis[li]! + (target - this.insideVis[li]!) * blend
      this.labels[li]!.opacity = s.labelOpacity[li]! * this.insideVis[li]!
    }
  }
}
