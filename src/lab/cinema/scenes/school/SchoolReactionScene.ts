import * as THREE from 'three'
import * as GSAP from 'gsap'
import { cpkHex, pmToScene } from '../kit/cpkAtoms'
import { localizeLabelText, type SceneLocale } from '../kit/sceneKit'
import { createElectronClouds, type ElectronCloudView } from '../kit/electronClouds'
import { naclHaloTexture, naclSphereGeometry, NACL_RIM, withNaclRim } from '../nacl/naclLatticeView'
import type { ElementSymbol } from '../../../../chemistry/data/atomicData'
import {
  buildSchoolModel,
  createSchoolState,
  sampleSchoolState,
  schoolExtentAt,
  schoolSmooth,
  SCHOOL_DRAW,
  type SchoolCueId,
  type SchoolLabelKind,
  type SchoolModel,
  type SchoolState,
} from './schoolModel'
import type { SchoolSceneSpec } from './schoolSpec'

/**
 * ШКОЛЬНАЯ СЦЕНА «образование молекулы» — фреймворк-независимый класс на Three.js + GSAP (по образцу
 * NaClReactionScene). Сцену задаёт спецификация (schoolSpec.ts), кадр — чистая функция времени
 * sampleSchoolState (schoolModel.ts); класс только переносит состояние в объекты three.
 *
 * Хост кладёт `root` в свою сцену и каждый кадр зовёт `update(dt, camera)`. Машина состояний по шагам:
 * goToStep / next / prev / replay / finish / seek / pause / resume / setSpeed. Время ведёт GSAP-твин
 * одного числа (время сюжета = экранное время).
 *
 * Визуальный язык — как NaCl: матовые шары CPK с символом внутри (DOM-подписи kind 'atom'), облака
 * внешнего слоя (kit/electronClouds), электроны внешнего слоя — светящиеся точки, общая пара — две
 * точки между ядрами, неподелённая пара — две точки у атома, неспаренный электрон — точка с
 * ореолом; связь — штрих (кратная — 2–3 штриха). Энергетических чисел нет.
 *
 * Производительность: атомы, штрихи и электроны — три InstancedMesh; ореолы — спрайты; ноль
 * аллокаций в update; прогрев шейдеров warmup() до первого шага.
 */

export type SchoolStatus = 'idle' | 'playing' | 'paused' | 'finishing' | 'done'

export type SchoolSceneLabel = { id: string; kind: SchoolLabelKind; pos: THREE.Vector3; opacity: number; text: string }

export type SchoolLightRig = { ambient: THREE.AmbientLight; key: THREE.DirectionalLight; point: THREE.PointLight }

export type SchoolSceneOptions = {
  locale?: SceneLocale
  lowPower?: boolean
  onCue?: (id: SchoolCueId) => void
  onStatus?: (status: SchoolStatus, step: number) => void
  onProgress?: (step: number, progress: number) => void
  /** Готовый свет хоста (число источников у хоста не меняется при размонтировании). */
  lights?: SchoolLightRig
}

const gsap: typeof GSAP.gsap =
  (GSAP as unknown as { gsap?: typeof GSAP.gsap }).gsap ?? (GSAP as unknown as { default: { gsap: typeof GSAP.gsap } }).default.gsap

/** Мировых единиц на пикометр (1 Å = 0,285). */
const K = pmToScene(1)
const LIGHT = { ambient: 0.34, key: 0.9, point: 0.45 } as const
const ELECTRON_COLOR = new THREE.Color(0x9ee4ff)
/** Матовый шар: без лака, высокая шероховатость, лёгкий блик. */
const MATTE = { roughness: 0.84, metalness: 0, clearcoat: 0, clearcoatRoughness: 0.4, specularIntensity: 0.16 } as const

export class SchoolReactionScene {
  readonly root = new THREE.Group()
  readonly labels: SchoolSceneLabel[]
  readonly model: SchoolModel

  private readonly opts: SchoolSceneOptions
  private locale: SceneLocale
  private readonly state: SchoolState
  private readonly clock = { t: 0 }
  private tween: gsap.core.Tween | null = null
  private speed = 1
  private status: SchoolStatus = 'idle'
  private stepIndex = 0
  private lastCueT = -1
  private appliedT = NaN
  private visual = 0
  private lastDt = 1 / 60
  private pendingResolve: (() => void) | null = null
  private disposed = false
  private viewportH = 800
  private viewportFov = 46

  private readonly stage = new THREE.Group()
  private readonly lights: SchoolLightRig
  private readonly ownLights: boolean
  private readonly sphere: THREE.SphereGeometry
  private readonly atoms: THREE.InstancedMesh
  private readonly atomMat: THREE.MeshPhysicalMaterial
  private readonly sticks: THREE.InstancedMesh
  private readonly stickMat: THREE.MeshPhysicalMaterial
  private readonly stickGeo: THREE.CylinderGeometry
  private readonly electrons: THREE.InstancedMesh
  private readonly electronMat: THREE.MeshBasicMaterial
  private readonly halos: THREE.Sprite[] = []
  private readonly haloMats: THREE.SpriteMaterial[] = []
  private readonly clouds: ElectronCloudView
  /** Видимость символов внутри шаров (плавно). */
  private readonly insideVis: Float32Array
  /** Экранные круги атомов: x, y, глубина, радиус (проективные единицы). */
  private readonly discs: Float32Array
  private readonly labelIndexOfAtom: Int32Array

  private readonly _v = new THREE.Vector3()
  private readonly _w = new THREE.Vector3()
  private readonly _c = new THREE.Vector3()
  private readonly _s = new THREE.Vector3()
  private readonly _q = new THREE.Quaternion()
  private readonly _m = new THREE.Matrix4()
  private readonly _inv = new THREE.Matrix4()
  private readonly _e = new THREE.Euler(0, 0, 0, 'YXZ')
  private readonly _up = new THREE.Vector3(0, 1, 0)
  private readonly _hole = new THREE.Vector3(1, 0, 0)

  constructor(spec: SchoolSceneSpec, opts: SchoolSceneOptions = {}) {
    this.opts = opts
    this.locale = opts.locale ?? 'ru'
    this.model = buildSchoolModel(spec)
    this.state = createSchoolState(this.model)
    const m = this.model
    const n = m.a.atoms.length
    const nE = m.a.electrons.length
    this.root.name = `school-${spec.id}-root`
    this.stage.name = `school-${spec.id}-stage`
    this.stage.matrixAutoUpdate = true
    this.root.add(this.stage)
    this.sphere = naclSphereGeometry(opts.lowPower)

    // ——— свет ———
    this.ownLights = !opts.lights
    this.lights = opts.lights ?? {
      ambient: new THREE.AmbientLight(0xdfe8ff, LIGHT.ambient),
      key: new THREE.DirectionalLight(0xffffff, LIGHT.key),
      point: new THREE.PointLight(0xbfe6ff, LIGHT.point, 12, 1.6),
    }
    if (this.ownLights) {
      this.lights.key.position.set(3.5, 5, 6)
      this.root.add(this.lights.ambient, this.lights.key, this.lights.key.target, this.lights.point)
    }

    // ——— атомы: один InstancedMesh, цвет CPK на экземпляр ———
    this.atomMat = withNaclRim(new THREE.MeshPhysicalMaterial({ color: 0xffffff, ...MATTE, transparent: true, fog: false }), 0xffffff, NACL_RIM.atom)
    this.atoms = new THREE.InstancedMesh(this.sphere, this.atomMat, n)
    this.atoms.name = 'school-atoms'
    this.atoms.frustumCulled = false
    const col = new THREE.Color()
    m.a.atoms.forEach((a, i) => {
      col.setHex(cpkHex(a.element as ElementSymbol))
      // Белый водород чуть приглушён: матовый шар под ключевым светом иначе «выгорает».
      if (a.element === 'H') col.multiplyScalar(0.9)
      this.atoms.setColorAt(i, col)
    })
    this.stage.add(this.atoms)

    // ——— штрихи связей ———
    this.stickGeo = new THREE.CylinderGeometry(1, 1, 1, 14, 1, true)
    this.stickMat = withNaclRim(new THREE.MeshPhysicalMaterial({ color: 0xd4dce6, ...MATTE, transparent: true, fog: false }), 0xffffff, NACL_RIM.atom)
    this.sticks = new THREE.InstancedMesh(this.stickGeo, this.stickMat, Math.max(1, m.sticks.length))
    this.sticks.name = 'school-bonds'
    this.sticks.frustumCulled = false
    this.stage.add(this.sticks)

    // ——— электроны: яркие точки (без тонмаппинга) + ореолы ———
    this.electronMat = new THREE.MeshBasicMaterial({ color: ELECTRON_COLOR.clone().lerp(new THREE.Color(0xffffff), 0.45), toneMapped: false, fog: false })
    this.electrons = new THREE.InstancedMesh(this.sphere, this.electronMat, Math.max(1, nE))
    this.electrons.name = 'school-electrons'
    this.electrons.frustumCulled = false
    this.electrons.renderOrder = 10
    this.stage.add(this.electrons)
    const halo = naclHaloTexture()
    for (let k = 0; k < nE; k++) {
      const hm = new THREE.SpriteMaterial({ map: halo, color: ELECTRON_COLOR, blending: THREE.AdditiveBlending, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, fog: false })
      const s = new THREE.Sprite(hm)
      s.renderOrder = 11
      s.visible = false
      this.halos.push(s)
      this.haloMats.push(hm)
      this.stage.add(s)
    }

    // ——— облака внешнего слоя ———
    this.clouds = createElectronClouds({ atoms: n, lowPower: opts.lowPower, color: ELECTRON_COLOR })
    // Облако — фон для точек-электронов: приглушено, чтобы считаемые электроны читались поверх.
    this.clouds.material.uniforms.uOpacity!.value = 0.36
    this.stage.add(this.clouds.points)

    // ——— подписи ———
    this.labels = m.labels.map((l) => ({ id: l.id, kind: l.kind, pos: new THREE.Vector3(), opacity: 0, text: this.localize(l.text[this.locale]) }))
    this.insideVis = new Float32Array(m.labels.length).fill(1)
    this.discs = new Float32Array(n * 4)
    this.labelIndexOfAtom = new Int32Array(n).fill(-1)
    m.labels.forEach((l, k) => {
      if (l.anchor.kind === 'atom') this.labelIndexOfAtom[l.anchor.atom] = k
    })

    this.apply(0, true)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Машина состояний
  // ─────────────────────────────────────────────────────────────────────────

  get time(): number {
    return this.clock.t
  }

  get stepCount(): number {
    return this.model.timing.steps.length
  }

  getState(): { step: number; progress: number; status: SchoolStatus; t: number } {
    const s = this.model.timing.steps[this.stepIndex]!
    const progress = Math.min(1, Math.max(0, (this.clock.t - s.from) / (s.to - s.from)))
    return { step: this.stepIndex, progress, status: this.status, t: this.clock.t }
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

  /** Хвост: сцена гаснет, события лаборатории embryo → birth → complete. */
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

  /** Мгновенно встать на момент t (без твина). */
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

  /** Габарит кадра (мировые единицы, система root) — хост вписывает его в свободную область. */
  extentAt(t: number, out: { w: number; h: number; cx: number; cy: number }): { w: number; h: number; cx: number; cy: number } {
    const e = schoolExtentAt(this.model, t)
    out.w = e.w * K
    out.h = e.h * K
    out.cx = e.cx * K
    out.cy = e.cy * K
    return out
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
    this.atomMat.dispose()
    this.atoms.dispose()
    this.stickMat.dispose()
    this.sticks.dispose()
    this.stickGeo.dispose()
    this.electronMat.dispose()
    this.electrons.dispose()
    for (const m of this.haloMats) m.dispose()
    this.clouds.dispose()
    if (!this.ownLights) {
      this.lights.ambient.intensity = 0
      this.lights.key.intensity = 0
      this.lights.point.intensity = 0
    }
  }

  /** Каждый кадр хоста. Ноль аллокаций. */
  update(dt: number, camera: THREE.Camera): void {
    if (this.disposed) return
    const d = Math.min(0.1, Math.max(0, dt))
    this.visual += d
    this.lastDt = d
    const t = this.clock.t
    this.fireCues(t)
    this.apply(t, false)
    this.animate(camera)
    const s = this.model.timing.steps[this.stepIndex]!
    this.opts.onProgress?.(this.stepIndex, Math.min(1, Math.max(0, (t - s.from) / (s.to - s.from))))
  }

  // ——— внутреннее ———

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
    const cues = this.model.timing.cues
    for (let i = 0; i < cues.length; i++) {
      const c = cues[i]!
      if (c.at > from && c.at <= t) this.opts.onCue?.(c.id)
    }
  }

  /** Состояние момента t → объекты three (без аллокаций). */
  private apply(t: number, force: boolean): void {
    if (!force && t === this.appliedT) return
    this.appliedT = t
    const s = sampleSchoolState(this.model, t, this.state)
    const m = this.model
    const n = m.a.atoms.length

    this._e.set(s.pitch, s.yaw, 0, 'YXZ')
    this.stage.quaternion.setFromEuler(this._e)
    this.stage.updateMatrix()

    // ——— атомы ———
    this._q.identity()
    for (let i = 0; i < n; i++) {
      this._v.set(s.atomPos[i * 3]! * K, s.atomPos[i * 3 + 1]! * K, s.atomPos[i * 3 + 2]! * K)
      const r = m.ballR[i]! * K * s.appear
      this._s.set(r, r, r)
      this._m.compose(this._v, this._q, this._s)
      this.atoms.setMatrixAt(i, this._m)
    }
    this.atoms.instanceMatrix.needsUpdate = true
    this.atomMat.opacity = s.fade

    // ——— штрихи ———
    for (let k = 0; k < m.sticks.length; k++) {
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
        const r = SCHOOL_DRAW.stickR * K * (0.35 + 0.65 * alpha)
        this._s.set(r, len, r)
      }
      this._m.compose(this._c, this._q, this._s)
      this.sticks.setMatrixAt(k, this._m)
    }
    this.sticks.instanceMatrix.needsUpdate = true
    this.stickMat.opacity = Math.min(1, s.fade)

    // ——— электроны и ореолы ———
    this._q.identity()
    for (let k = 0; k < m.a.electrons.length; k++) {
      const a = s.elAlpha[k]!
      this._v.set(s.elPos[k * 3]! * K, s.elPos[k * 3 + 1]! * K, s.elPos[k * 3 + 2]! * K)
      const r = a > 0.02 ? SCHOOL_DRAW.dotR * K * (0.45 + 0.55 * a) : 0
      this._s.set(r, r, r)
      this._m.compose(this._v, this._q, this._s)
      this.electrons.setMatrixAt(k, this._m)
      const h = this.halos[k]!
      const g = s.elGlow[k]!
      h.visible = a > 0.02
      h.position.copy(this._v)
      h.scale.setScalar((g > 0.6 ? 46 : 26) * K)
      this.haloMats[k]!.opacity = a * (0.35 + 0.55 * g)
    }
    this.electrons.instanceMatrix.needsUpdate = true

    // ——— облака ———
    for (let i = 0; i < n; i++) {
      this._v.set(s.atomPos[i * 3]! * K, s.atomPos[i * 3 + 1]! * K, s.atomPos[i * 3 + 2]! * K)
      this._w.set(s.cloudDir[i * 3]!, s.cloudDir[i * 3 + 1]!, s.cloudDir[i * 3 + 2]!)
      this.clouds.set(i, this._v, m.cloudR[i]! * K * s.appear, s.cloudFill[i]!, s.cloudAmount, 0, this._hole, s.cloudStretch[i]!, this._w)
    }
    this.clouds.points.visible = s.cloudAmount > 0.005

    // ——— подписи: позиция в системе root ———
    for (let k = 0; k < this.labels.length; k++) {
      const l = this.labels[k]!
      l.pos.set(s.labelPos[k * 3]! * K, s.labelPos[k * 3 + 1]! * K, s.labelPos[k * 3 + 2]! * K).applyMatrix4(this.stage.matrix)
      const an = this.model.labels[k]!.anchor
      // Символ — на передней точке шара (к зрителю в системе root), чтобы шар его не заслонял.
      if (an.kind === 'atom') l.pos.z += m.ballR[an.atom]! * K * s.appear
      l.opacity = s.labelOpacity[k]! * (an.kind === 'atom' ? this.insideVis[k]! : 1)
    }
  }

  private pxPerProjUnit(): number {
    return this.viewportH / (2 * Math.tan((this.viewportFov * Math.PI) / 360))
  }

  /** Символ внутри шара виден, если шар на экране крупный и его центр не заслонён более близким шаром. */
  private animate(camera: THREE.Camera): void {
    const s = this.state
    const m = this.model
    const n = m.a.atoms.length
    this.root.updateMatrixWorld()
    this._inv.copy(this.root.matrixWorld).invert()
    camera.getWorldPosition(this._c).applyMatrix4(this._inv)
    const cam = this._c
    const px = this.pxPerProjUnit()
    const D = this.discs
    for (let i = 0; i < n; i++) {
      this._v.set(s.atomPos[i * 3]! * K, s.atomPos[i * 3 + 1]! * K, s.atomPos[i * 3 + 2]! * K).applyMatrix4(this.stage.matrix)
      const o = i * 4
      const depth = cam.z - this._v.z
      if (depth < 0.02) {
        D[o + 2] = -1
        continue
      }
      D[o] = (this._v.x - cam.x) / depth
      D[o + 1] = (this._v.y - cam.y) / depth
      D[o + 2] = depth
      D[o + 3] = (m.ballR[i]! * K * s.appear) / depth
    }
    const blend = Math.min(1, this.lastDt * 12)
    for (let i = 0; i < n; i++) {
      const li = this.labelIndexOfAtom[i]!
      if (li < 0) continue
      const o = i * 4
      let target = 0
      if (D[o + 2]! > 0) {
        target = schoolSmooth(8, 12, D[o + 3]! * px)
        for (let j = 0; j < n && target > 0; j++) {
          if (j === i) continue
          const q = j * 4
          if (!(D[q + 2]! > 0) || D[q + 2]! >= D[o + 2]!) continue
          if (Math.hypot(D[o]! - D[q]!, D[o + 1]! - D[q + 1]!) < 0.8 * D[q + 3]!) target = 0
        }
      }
      this.insideVis[li] = this.insideVis[li]! + (target - this.insideVis[li]!) * blend
      this.labels[li]!.opacity = s.labelOpacity[li]! * this.insideVis[li]!
    }
    this.clouds.frame(this.visual, px)
  }
}

export { K as SCHOOL_PM_TO_SCENE }
