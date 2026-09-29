import * as THREE from 'three'
import { pmToScene } from '../../kit/cpkAtoms'
import { liquidProfile } from '../../kit/glassware'
import { DROP_N, STREAM_N, type SolutionModel, type SolutionState } from './solutionModel'

/**
 * МАКРО-ДЕТАЛИ сцены «обмен в растворе» (живут в макро-слое SolutionExchangeScene):
 *   • жидкость — объём внутри пробирки, срезанный горизонтальной плоскостью (у наклонённой пробирки
 *     поверхность остаётся горизонтальной), почти бесцветная, кромки чуть светлее (френель);
 *   • мениск у стоящей пробирки A — вогнутая поверхность и светлый ободок у стенки;
 *   • струя — трубка по параболе из модели, сужается к низу;
 *   • пипетка HNO₃ и капли;
 *   • выноски шага «осадок» — линия от своего места в пробирке к подписи.
 * «Лупа» (круг и диск фона под миром частиц) — в своей группе между макро и микро (renderOrder групп).
 * Ноль аллокаций в update.
 */

const K = pmToScene(1)
const RING = 8

const LIQUID_VERT = /* glsl */ `
  uniform mat4 uToLayer;
  varying float vY;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vY = (uToLayer * vec4(position, 1.0)).y;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`
const LIQUID_FRAG = /* glsl */ `
  uniform float uSurface;
  uniform float uOpacity;
  uniform float uMilk;
  varying float vY;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    if (vY > uSurface) discard;
    float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
    vec3 clear = vec3(0.84, 0.92, 1.0);
    vec3 col = mix(clear, vec3(0.97, 0.98, 1.0), uMilk);
    float a = 0.06 + 0.3 * pow(f, 2.0) + 0.5 * uMilk;
    // тонкая светлая полоска у самой поверхности — граница жидкости читается и у наклонённой пробирки
    float edge = 1.0 - smoothstep(0.0, 0.012, uSurface - vY);
    col = mix(col, vec3(1.0), 0.6 * edge);
    a = max(a, 0.5 * edge);
    gl_FragColor = vec4(col, a * uOpacity);
  }
`

function liquidMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uToLayer: { value: new THREE.Matrix4() }, uSurface: { value: 0 }, uOpacity: { value: 1 }, uMilk: { value: 0 } },
    vertexShader: LIQUID_VERT,
    fragmentShader: LIQUID_FRAG,
  })
}

/** Мягкая круглая точка для хлопьев мути (вместо квадратных точек). */
export function softDotTexture(): THREE.DataTexture {
  const n = 32
  const data = new Uint8Array(n * n * 4)
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = (x + 0.5) / n - 0.5
      const dy = (y + 0.5) / n - 0.5
      const r = Math.hypot(dx, dy) * 2
      const a = Math.max(0, 1 - r) ** 1.6
      const o = (y * n + x) * 4
      data[o] = 255
      data[o + 1] = 255
      data[o + 2] = 255
      data[o + 3] = Math.round(255 * a)
    }
  }
  const tex = new THREE.DataTexture(data, n, n)
  tex.needsUpdate = true
  return tex
}

export class SolutionMacroView {
  /** жидкость пробирок A и B (объём, срезанный плоскостью) */
  readonly liquidA: THREE.Mesh
  readonly liquidB: THREE.Mesh
  readonly meniscus: THREE.Group
  readonly stream: THREE.Mesh
  readonly pipette = new THREE.Group()
  readonly drops: THREE.InstancedMesh
  readonly callouts: THREE.LineSegments
  /** «лупа»: диск фона и оправа — своя группа между макро и микро */
  readonly lens = new THREE.Group()

  private readonly liquidGeo: THREE.LatheGeometry
  private readonly matA: THREE.ShaderMaterial
  private readonly matB: THREE.ShaderMaterial
  private readonly meniscusGeo: THREE.LatheGeometry
  private readonly meniscusMat: THREE.MeshBasicMaterial
  private readonly meniscusRingGeo: THREE.TorusGeometry
  private readonly meniscusRingMat: THREE.MeshBasicMaterial
  private readonly streamGeo: THREE.BufferGeometry
  private readonly streamMat: THREE.MeshPhysicalMaterial
  private readonly pipGeo: THREE.LatheGeometry
  private readonly pipMat: THREE.MeshPhysicalMaterial
  private readonly bulbGeo: THREE.SphereGeometry
  private readonly bulbMat: THREE.MeshStandardMaterial
  private readonly dropGeo: THREE.SphereGeometry
  private readonly dropMat: THREE.MeshPhysicalMaterial
  private readonly calloutMat: THREE.LineBasicMaterial
  private readonly discGeo: THREE.CircleGeometry
  private readonly discMat: THREE.MeshBasicMaterial
  private readonly disc: THREE.Mesh
  private readonly ringGeo: THREE.RingGeometry
  private readonly ringMat: THREE.MeshBasicMaterial
  private readonly ring: THREE.Mesh
  private readonly glowGeo: THREE.RingGeometry
  private readonly glowMat: THREE.MeshBasicMaterial
  private readonly glow: THREE.Mesh
  private readonly _m = new THREE.Matrix4()
  private readonly _v = new THREE.Vector3()
  private readonly _t = new THREE.Vector3()
  private readonly _n = new THREE.Vector3()
  private readonly _b = new THREE.Vector3(0, 0, 1)

  constructor(model: SolutionModel, lowPower: boolean, background: THREE.Color) {
    const R = model.tube.r
    const H = model.tube.h
    const seg = lowPower ? 28 : 48
    this.liquidGeo = new THREE.LatheGeometry(
      liquidProfile(R, H * 0.985, 0.9).map(([x, y]) => new THREE.Vector2(x * K, y * K)),
      seg,
    )
    this.matA = liquidMaterial()
    this.matB = liquidMaterial()
    this.liquidA = new THREE.Mesh(this.liquidGeo, this.matA)
    this.liquidB = new THREE.Mesh(this.liquidGeo, this.matB)
    this.liquidA.name = 'solution-liquid-a'
    this.liquidB.name = 'solution-liquid-b'

    // мениск: вода смачивает стекло — поверхность вогнутая, у стенки чуть приподнята
    const pts: THREE.Vector2[] = []
    for (let i = 0; i <= 8; i++) {
      const x = (i / 8) * 0.9 * R
      pts.push(new THREE.Vector2(x * K, 0.14 * R * Math.pow(i / 8, 3) * K))
    }
    this.meniscusGeo = new THREE.LatheGeometry(pts, seg)
    this.meniscusMat = new THREE.MeshBasicMaterial({ color: 0xeaf4ff, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide, fog: false })
    this.meniscusRingGeo = new THREE.TorusGeometry(0.9 * R * K, 0.018 * R * K, 6, seg)
    this.meniscusRingGeo.rotateX(Math.PI / 2)
    this.meniscusRingGeo.translate(0, 0.14 * R * K, 0)
    this.meniscusRingMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false, fog: false })
    this.meniscus = new THREE.Group()
    this.meniscus.add(new THREE.Mesh(this.meniscusGeo, this.meniscusMat), new THREE.Mesh(this.meniscusRingGeo, this.meniscusRingMat))

    // струя: кольца по осевой линии модели
    this.streamGeo = new THREE.BufferGeometry()
    this.streamGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(STREAM_N * RING * 3), 3))
    this.streamGeo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(STREAM_N * RING * 3), 3))
    const idx: number[] = []
    for (let i = 0; i < STREAM_N - 1; i++) {
      for (let j = 0; j < RING; j++) {
        const a = i * RING + j
        const b = i * RING + ((j + 1) % RING)
        const c = a + RING
        const d = b + RING
        idx.push(a, c, b, b, c, d)
      }
    }
    this.streamGeo.setIndex(idx)
    this.streamMat = new THREE.MeshPhysicalMaterial({ color: 0xe6f2ff, roughness: 0.08, metalness: 0, transparent: true, opacity: 0, depthWrite: false, fog: false, clearcoat: 1, clearcoatRoughness: 0.1 })
    this.stream = new THREE.Mesh(this.streamGeo, this.streamMat)
    this.stream.frustumCulled = false
    this.stream.name = 'solution-stream'

    // пипетка: стеклянная трубочка с оттянутым кончиком и резиновая груша
    const pipProfile: THREE.Vector2[] = [
      [0.001, 0],
      [5, 0],
      [7, 25],
      [13, 70],
      [14, 85],
      [14, 230],
      [0.001, 230],
    ].map(([x, y]) => new THREE.Vector2(x! * K, y! * K))
    this.pipGeo = new THREE.LatheGeometry(pipProfile, lowPower ? 14 : 22)
    this.pipMat = new THREE.MeshPhysicalMaterial({ color: 0xe8f4ff, roughness: 0.1, transparent: true, opacity: 0.35, depthWrite: false, fog: false })
    this.bulbGeo = new THREE.SphereGeometry(34 * K, lowPower ? 14 : 22, lowPower ? 10 : 16)
    this.bulbGeo.scale(1, 1.35, 1)
    this.bulbGeo.translate(0, 268 * K, 0)
    this.bulbMat = new THREE.MeshStandardMaterial({ color: 0x9c3b34, roughness: 0.7, transparent: true, fog: false })
    this.pipette.add(new THREE.Mesh(this.pipGeo, this.pipMat), new THREE.Mesh(this.bulbGeo, this.bulbMat))
    this.pipette.name = 'solution-pipette'

    this.dropGeo = new THREE.SphereGeometry(1, 12, 10)
    this.dropMat = new THREE.MeshPhysicalMaterial({ color: 0xe6f2ff, roughness: 0.08, transparent: true, opacity: 0.8, depthWrite: false, fog: false, clearcoat: 1 })
    this.drops = new THREE.InstancedMesh(this.dropGeo, this.dropMat, DROP_N)
    this.drops.frustumCulled = false

    // выноски: две ломаные «цель → колено → полка»
    this.calloutMat = new THREE.LineBasicMaterial({ color: 0xdcecff, transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false })
    const cg = new THREE.BufferGeometry()
    cg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(2 * 4 * 3), 3))
    this.callouts = new THREE.LineSegments(cg, this.calloutMat)
    this.callouts.frustumCulled = false
    this.callouts.renderOrder = 9

    // лупа: диск фона сцены (под миром частиц) и светлая оправа с мягким ореолом
    this.discGeo = new THREE.CircleGeometry(1, lowPower ? 48 : 96)
    this.discMat = new THREE.MeshBasicMaterial({ color: background, transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false, toneMapped: false })
    this.disc = new THREE.Mesh(this.discGeo, this.discMat)
    this.ringGeo = new THREE.RingGeometry(0.985, 1, lowPower ? 64 : 128)
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false })
    this.ring = new THREE.Mesh(this.ringGeo, this.ringMat)
    this.glowGeo = new THREE.RingGeometry(1, 1.06, lowPower ? 64 : 128)
    this.glowMat = new THREE.MeshBasicMaterial({ color: 0x7fb6ff, transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })
    this.glow = new THREE.Mesh(this.glowGeo, this.glowMat)
    for (const o of [this.disc, this.ring, this.glow]) o.frustumCulled = false
    this.disc.renderOrder = 0
    this.glow.renderOrder = 1
    this.ring.renderOrder = 2
    this.lens.add(this.disc, this.glow, this.ring)
    this.lens.name = 'solution-lens'
  }

  /** Перенос состояния кадра (s — модель, tubeA/tubeB — группы пробирок в макро-слое). */
  update(s: SolutionState, m: SolutionModel, tubeA: THREE.Group, tubeB: THREE.Group, milk: number): void {
    void m
    const ma = s.macroAlpha
    // жидкость: плоскость поверхности — в системе макро-слоя (горизонтальна при любом наклоне)
    tubeA.updateMatrix()
    tubeB.updateMatrix()
    this.matA.uniforms.uToLayer!.value.copy(tubeA.matrix)
    this.matB.uniforms.uToLayer!.value.copy(tubeB.matrix)
    this.matA.uniforms.uSurface!.value = s.tubeA.surface * K
    this.matB.uniforms.uSurface!.value = s.tubeB.surface * K
    this.matA.uniforms.uOpacity!.value = ma
    this.matB.uniforms.uOpacity!.value = ma * s.tubeB.alpha
    this.matA.uniforms.uMilk!.value = milk
    this.matB.uniforms.uMilk!.value = 0
    this.meniscus.position.set(0, (s.tubeA.surface - s.tubeA.y) * K, 0)
    this.meniscusMat.opacity = (0.14 + 0.3 * milk) * ma
    this.meniscusRingMat.opacity = 0.4 * ma

    // струя
    this.streamMat.opacity = 0.62 * s.stream.alpha * ma
    this.stream.visible = this.streamMat.opacity > 0.01
    if (this.stream.visible) {
      const pos = this.streamGeo.getAttribute('position') as THREE.BufferAttribute
      const nor = this.streamGeo.getAttribute('normal') as THREE.BufferAttribute
      const P = s.stream.pts
      for (let i = 0; i < STREAM_N; i++) {
        const i0 = Math.max(0, i - 1)
        const i1 = Math.min(STREAM_N - 1, i + 1)
        this._t.set(P[i1 * 3]! - P[i0 * 3]!, P[i1 * 3 + 1]! - P[i0 * 3 + 1]!, 0)
        if (this._t.lengthSq() < 1e-9) this._t.set(0, -1, 0)
        this._t.normalize()
        this._n.crossVectors(this._t, this._b).normalize()
        const r = s.stream.rad[i]! * K
        for (let j = 0; j < RING; j++) {
          const a = (j / RING) * Math.PI * 2
          const c = Math.cos(a)
          const sn = Math.sin(a)
          const nx = this._n.x * c
          const ny = this._n.y * c
          const nz = sn
          const o = i * RING + j
          pos.setXYZ(o, P[i * 3]! * K + nx * r, P[i * 3 + 1]! * K + ny * r, nz * r)
          nor.setXYZ(o, nx, ny, nz)
        }
      }
      pos.needsUpdate = true
      nor.needsUpdate = true
    }

    // пипетка и капли
    this.pipette.visible = s.pipette.alpha > 0.01
    this.pipette.position.set(s.pipette.x * K, s.pipette.y * K, 0)
    this.pipMat.opacity = 0.35 * s.pipette.alpha * ma
    this.bulbMat.opacity = s.pipette.alpha * ma
    let anyDrop = false
    for (let d = 0; d < DROP_N; d++) {
      const r = s.drops[d * 4 + 3]! * K
      if (r > 0) anyDrop = true
      this._v.set(s.drops[d * 4]! * K, s.drops[d * 4 + 1]! * K, s.drops[d * 4 + 2]! * K)
      this._m.makeScale(r, r * 1.15, r).setPosition(this._v)
      this.drops.setMatrixAt(d, this._m)
    }
    this.drops.instanceMatrix.needsUpdate = true
    this.drops.visible = anyDrop && ma > 0.01
    this.dropMat.opacity = 0.8 * ma

    // выноски
    const ca = s.calloutAlpha
    this.calloutMat.opacity = 0.75 * Math.max(ca[0]!, ca[1]!)
    this.callouts.visible = this.calloutMat.opacity > 0.01
    if (this.callouts.visible) {
      const pos = this.callouts.geometry.getAttribute('position') as THREE.BufferAttribute
      const co = s.callouts
      for (let c = 0; c < 2; c++) {
        const b = c * 6
        // пока выноска не видна — сжимаем её в точку цели
        const vis = ca[c]! > 0.02 ? 1 : 0
        const x0 = co[b]!
        const y0 = co[b + 1]!
        const kx = vis ? co[b + 2]! : x0
        const ky = vis ? co[b + 3]! : y0
        const ex = vis ? co[b + 4]! : x0
        const ey = vis ? co[b + 5]! : y0
        pos.setXYZ(c * 4, x0 * K, y0 * K, 0)
        pos.setXYZ(c * 4 + 1, kx * K, ky * K, 0)
        pos.setXYZ(c * 4 + 2, kx * K, ky * K, 0)
        pos.setXYZ(c * 4 + 3, ex * K, ey * K, 0)
      }
      pos.needsUpdate = true
    }

    // лупа (в системе сцены)
    const L = s.lens
    const u = L.u
    const on = u > 0.001 && u < 0.999
    this.lens.visible = on
    if (on) {
      const r = L.r * K
      this.lens.position.set(L.c[0] * K, L.c[1] * K, 0)
      this.lens.scale.set(r, r, 1)
      // диск фона под частицами: проявляется быстрее частиц, к концу растворяется в фоне
      this.discMat.opacity = 0.94 * Math.min(1, u * 6) * (1 - smoothstep(0.82, 0.99, u))
      this.ringMat.opacity = 0.85 * L.alpha
      this.glowMat.opacity = 0.35 * L.alpha
    }
  }

  dispose(): void {
    for (const g of [this.liquidGeo, this.meniscusGeo, this.meniscusRingGeo, this.streamGeo, this.pipGeo, this.bulbGeo, this.dropGeo, this.callouts.geometry, this.discGeo, this.ringGeo, this.glowGeo]) g.dispose()
    for (const x of [this.matA, this.matB, this.meniscusMat, this.meniscusRingMat, this.streamMat, this.pipMat, this.bulbMat, this.dropMat, this.calloutMat, this.discMat, this.ringMat, this.glowMat]) x.dispose()
    this.drops.dispose()
  }
}

function smoothstep(a: number, b: number, x: number): number {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return u * u * (3 - 2 * u)
}
