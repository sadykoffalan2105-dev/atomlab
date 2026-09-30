import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

/**
 * ФОТОРЕАЛИСТИЧНЫЙ ВИД сцены «обмен в растворе» (BaSO₄), docs/plans/baso4-modes.md § 5:
 *   • окружение PMREM(RoomEnvironment) — только материалам макро-слоя (стекло, жидкость, капли, осадок),
 *     scene.environment и свет других сцен не трогаем; строится один раз на рендерер;
 *   • стекло и жидкость (desktop) — MeshPhysicalMaterial с transmission; жидкость срезана горизонтальной
 *     плоскостью поверхности (у наклонённой пробирки поверхность горизонтальна) и белеет от мути;
 *   • капли на стенках — инстансы полусфер на внутренней стенке над жидкостью (брызги при сливании);
 *   • муть — мягкие спрайты рассеяния (сложение цвета), ярче в луче бокового света; луч Тиндаля —
 *     светлая полоса поперёк пробирки, видна только в мутной жидкости (истинный раствор луч не рассеивает);
 *   • «объём раствора» микромира (школьный режим без воды) — голубоватая глубина и редкие блики.
 * На телефоне (lowPower) — прежнее френель-стекло и шейдер жидкости: без transmission-пасса.
 * Ноль аллокаций в update.
 */

// ─── окружение ───────────────────────────────────────────────────────────────

const envCache = new WeakMap<THREE.WebGLRenderer, THREE.Texture>()

/** PMREM комнаты (RoomEnvironment) для рендерера: один раз, дальше из кэша; после потери контекста — заново. */
export function macroEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const hit = envCache.get(renderer)
  if (hit) return hit
  const pmrem = new THREE.PMREMGenerator(renderer)
  const room = new RoomEnvironment()
  const rt = pmrem.fromScene(room, 0.04)
  room.traverse((o) => {
    const m = o as THREE.Mesh
    m.geometry?.dispose()
    const mat = m.material as THREE.Material | THREE.Material[] | undefined
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
    else mat?.dispose()
  })
  pmrem.dispose()
  envCache.set(renderer, rt.texture)
  renderer.domElement.addEventListener(
    'webglcontextrestored',
    () => {
      envCache.delete(renderer)
      rt.dispose()
    },
    { once: true },
  )
  return rt.texture
}

// ─── стекло и жидкость (desktop) ─────────────────────────────────────────────

/** Параметры стекла пробирки (план § 5); толщина — 0,6 стенки (стенка ≈ 0,07 радиуса). */
export function createPhotoGlassMaterial(wall: number): THREE.MeshPhysicalMaterial {
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0.05,
    transmission: 0.98,
    ior: 1.52,
    thickness: 0.6 * wall,
    clearcoat: 0.3,
    clearcoatRoughness: 0.05,
    attenuationColor: new THREE.Color(0xeaf6ff),
    attenuationDistance: 3,
    envMapIntensity: 1.1,
    specularIntensity: 1,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  })
  mat.name = 'solution-photo-glass'
  return mat
}

/** Кромка устья: то же стекло, но толще и ярче в отражениях. */
export function createPhotoRimMaterial(wall: number): THREE.MeshPhysicalMaterial {
  const mat = createPhotoGlassMaterial(wall * 2.2)
  mat.transmission = 0.9
  mat.roughness = 0.08
  mat.clearcoat = 0.6
  mat.envMapIntensity = 1.6
  mat.side = THREE.FrontSide
  mat.name = 'solution-photo-rim'
  return mat
}

export type PhotoLiquidUniforms = {
  uToLayer: { value: THREE.Matrix4 }
  uSurface: { value: number }
  uMilk: { value: number }
}

/**
 * Жидкость (план § 5: ior 1.333, roughness 0.02, оттенок 0xdcefff): физический материал — блики окружения,
 * лак поверхности, френель. Пропускание — через прозрачность (alpha по френелю), а НЕ transmission: объект с
 * transmission внутри стеклянной пробирки с transmission не попадает в её «снимок» пропускания, и стекло
 * закрашивает жидкость фоном. Прозрачная жидкость рисуется после стекла — видна сквозь него. Объём lathe срезан
 * горизонтальной плоскостью поверхности (y в системе макро-слоя — uToLayer), у поверхности — светлая полоса;
 * муть (uMilk) — белое рассеяние: жидкость белеет и теряет прозрачность.
 */
export function createPhotoLiquidMaterial(tag: string): { mat: THREE.MeshPhysicalMaterial; uniforms: PhotoLiquidUniforms } {
  const uniforms: PhotoLiquidUniforms = { uToLayer: { value: new THREE.Matrix4() }, uSurface: { value: 0 }, uMilk: { value: 0 } }
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x1a2433,
    metalness: 0,
    roughness: 0.02,
    ior: 1.333,
    clearcoat: 0.2,
    clearcoatRoughness: 0.04,
    envMapIntensity: 0.65,
    specularIntensity: 1,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  })
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform mat4 uToLayer;\nvarying float vLayerY;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLayerY = ( uToLayer * vec4( transformed, 1.0 ) ).y;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uSurface;\nuniform float uMilk;\nvarying float vLayerY;')
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif ( vLayerY > uSurface ) discard;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
float edgeL = 1.0 - smoothstep( 0.0, 0.012, uSurface - vLayerY );
float frL = 1.0 - saturate( abs( dot( normalize( normal ), normalize( vViewPosition ) ) ) );
// светлая полоса у поверхности; толща воды слегка светится голубым к кромкам; муть — белое рассеяние
totalEmissiveRadiance += vec3( 0.5 ) * edgeL;
totalEmissiveRadiance += vec3( 0.55, 0.72, 0.95 ) * ( 0.03 + 0.14 * pow( frL, 1.8 ) ) * ( 1.0 - uMilk );
totalEmissiveRadiance += vec3( 0.9, 0.93, 0.97 ) * ( 0.3 + 0.2 * frL ) * uMilk;`,
      )
      .replace(
        '#include <opaque_fragment>',
        `diffuseColor.a *= clamp( 0.06 + 0.3 * pow( frL, 2.0 ) + 0.62 * uMilk + 0.5 * edgeL, 0.0, 1.0 );
#include <opaque_fragment>`,
      )
  }
  // своя программа у каждой пробирки: при общей программе three не зовёт onBeforeCompile второму материалу,
  // и его uniform-ы (uToLayer, uSurface) не попали бы в шейдер
  mat.customProgramCacheKey = () => `solution-photo-liquid-4-${tag}`
  mat.name = 'solution-photo-liquid'
  return { mat, uniforms }
}

/** Муть в жидкости (0…1): белая взвесь рассеивает свет — поверхность «матовеет». */
export function setPhotoLiquidMilk(mat: THREE.MeshPhysicalMaterial, uniforms: PhotoLiquidUniforms, milk: number): void {
  uniforms.uMilk.value = milk
  mat.roughness = 0.02 + 0.3 * milk
  // чистая вода почти не рассеивает (тёмно-голубой диффуз — видны блики и кромки), взвесь — белая
  const k = Math.min(1, milk * 1.6)
  mat.color.setRGB(0.1 + 0.85 * k, 0.14 + 0.83 * k, 0.2 + 0.8 * k)
}

// ─── капли на стенках ────────────────────────────────────────────────────────

const WALL_DROPS = 30

/**
 * Брызги при сливании: полусферы на внутренней стенке пробирки над уровнем жидкости, куполом к оси.
 * Координаты — в системе пробирки (дно — y = 0), единицы сцены.
 */
export class WallDrops {
  readonly mesh: THREE.InstancedMesh
  private readonly geo: THREE.SphereGeometry
  private readonly mat: THREE.MeshPhysicalMaterial
  private readonly base: THREE.Matrix4[]
  /** момент появления капли (доля отрезка сливания 0…1) */
  private readonly born: Float32Array
  private readonly size: Float32Array
  private readonly _m = new THREE.Matrix4()
  private readonly _s = new THREE.Matrix4()
  private applied = -1

  /** r, h — радиус и высота пробирки; yLo…yHi — полоса стенки, где оседают брызги (единицы сцены). */
  constructor(r: number, yLo: number, yHi: number, lowPower: boolean) {
    this.geo = new THREE.SphereGeometry(1, lowPower ? 8 : 12, lowPower ? 4 : 6, 0, Math.PI * 2, 0, Math.PI / 2)
    this.mat = lowPower
      ? new THREE.MeshPhysicalMaterial({ color: 0xeaf4ff, roughness: 0.06, metalness: 0, clearcoat: 1, transparent: true, opacity: 0.55, depthWrite: false, fog: false })
      : new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          roughness: 0.03,
          metalness: 0,
          transmission: 0.92,
          ior: 1.333,
          thickness: r * 0.05,
          attenuationColor: new THREE.Color(0xdcefff),
          attenuationDistance: 3,
          clearcoat: 1,
          clearcoatRoughness: 0.03,
          envMapIntensity: 1.4,
          specularIntensity: 1,
          transparent: true,
          depthWrite: false,
          fog: false,
        })
    this.mat.name = 'solution-wall-drops'
    this.mesh = new THREE.InstancedMesh(this.geo, this.mat, WALL_DROPS)
    this.mesh.name = 'solution-wall-drops'
    this.mesh.frustumCulled = false
    this.base = []
    this.born = new Float32Array(WALL_DROPS)
    this.size = new Float32Array(WALL_DROPS)
    // детерминированный «случай»: одна и та же раскладка в каждом прогоне
    let seed = 7
    const rnd = () => {
      seed = (seed * 16807) % 2147483647
      return (seed - 1) / 2147483646
    }
    const n = new THREE.Vector3()
    const tan = new THREE.Vector3()
    const down = new THREE.Vector3(0, -1, 0)
    for (let i = 0; i < WALL_DROPS; i++) {
      // больше брызг ближе к жидкости, на передней и боковых стенках (видны сквозь стекло)
      const a = (rnd() - 0.5) * Math.PI * 1.7 + Math.PI / 2
      const y = yLo + (yHi - yLo) * Math.pow(rnd(), 1.7)
      const rr = r * 0.975
      const pos = new THREE.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr)
      // базис капли: x — по стенке (касательная), y — купол к оси пробирки, z — вниз по стенке
      n.set(-Math.cos(a), 0, -Math.sin(a))
      tan.set(-Math.sin(a), 0, Math.cos(a))
      const s = r * (0.028 + 0.05 * Math.pow(rnd(), 2))
      this.size[i] = s
      this.base.push(new THREE.Matrix4().makeBasis(tan, n, down).setPosition(pos))
      this.born[i] = rnd()
    }
  }

  /** splash — доля отрезка сливания (0…1), alpha — прозрачность макро-слоя. */
  update(splash: number, alpha: number): void {
    this.mat.opacity = (this.mat.transmission > 0 ? 1 : 0.55) * alpha
    this.mesh.visible = splash > 0.001 && alpha > 0.01
    if (!this.mesh.visible) return
    const key = Math.round(splash * 200)
    if (key === this.applied) return
    this.applied = key
    for (let i = 0; i < WALL_DROPS; i++) {
      const g = Math.min(1, Math.max(0, (splash - this.born[i]! * 0.85) / 0.15))
      const s = this.size[i]! * g
      // капля приплюснута к стенке (купол низкий) и чуть вытянута вниз — стекает
      this._s.makeScale(s, s * 0.45, s * 1.25)
      this._m.multiplyMatrices(this.base[i]!, this._s)
      this.mesh.setMatrixAt(i, this._m)
    }
    this.mesh.instanceMatrix.needsUpdate = true
  }

  setEnvMap(env: THREE.Texture | null): void {
    this.mat.envMap = env
    this.mat.needsUpdate = true
  }

  dispose(): void {
    this.geo.dispose()
    this.mat.dispose()
    this.mesh.dispose()
  }
}

// ─── муть: спрайты рассеяния и луч Тиндаля ───────────────────────────────────

/** Луч бокового света (система пробирки): высота центра, наклон, полуширина. */
export type TyndallBeamSpec = { y: number; slope: number; halfW: number; r: number }

const TURBID_VERT = /* glsl */ `
  attribute float aSeed;
  uniform float uSize;
  uniform float uScale;
  uniform vec4 uBeam;
  varying float vA;
  varying float vBeam;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float s = fract(aSeed * 7.13);
    gl_PointSize = uSize * length(modelViewMatrix[0].xyz) * (0.55 + 1.1 * aSeed) * uScale / max(0.001, -mv.z);
    // яркость хлопьев: разброс, в луче бокового света — сильнее (рассеяние Тиндаля)
    float d = (position.y - (uBeam.x + uBeam.y * position.x)) / uBeam.z;
    vBeam = exp(-d * d * 1.6) * step(abs(position.x), uBeam.w);
    vA = 0.35 + 0.65 * s;
    gl_Position = projectionMatrix * mv;
  }
`
const TURBID_FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uOpacity;
  uniform float uBeamOn;
  varying float vA;
  varying float vBeam;
  void main() {
    float t = texture2D(uMap, gl_PointCoord).a;
    float b = vBeam * uBeamOn;
    vec3 col = mix(vec3(0.82, 0.88, 0.96), vec3(1.0, 0.99, 0.96), b);
    gl_FragColor = vec4(col * (0.6 + 0.9 * b), t * vA * uOpacity);
  }
`

/** Материал хлопьев мути: мягкие спрайты со сложением цвета, размер — в единицах сцены (перспектива). */
export function createTurbidMaterial(map: THREE.Texture, size: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uMap: { value: map },
      uSize: { value: size },
      uScale: { value: 400 },
      uOpacity: { value: 0 },
      uBeam: { value: new THREE.Vector4(0, 0, 1, 1) },
      uBeamOn: { value: 0 },
    },
    vertexShader: TURBID_VERT,
    fragmentShader: TURBID_FRAG,
  })
}

/** Случайные «семена» хлопьев (размер и яркость) — атрибут aSeed. */
export function turbidSeeds(n: number): THREE.BufferAttribute {
  const a = new Float32Array(n)
  let seed = 11
  for (let i = 0; i < n; i++) {
    seed = (seed * 16807) % 2147483647
    a[i] = (seed - 1) / 2147483646
  }
  return new THREE.BufferAttribute(a, 1)
}

const BEAM_VERT = /* glsl */ `
  uniform mat4 uToLayer;
  varying vec2 vUv;
  varying float vLayerY;
  void main() {
    vUv = uv;
    vLayerY = (uToLayer * vec4(position, 1.0)).y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const BEAM_FRAG = /* glsl */ `
  uniform float uOn;
  uniform float uSurface;
  varying vec2 vUv;
  varying float vLayerY;
  void main() {
    if (vLayerY > uSurface) discard;
    float u = vUv.x;
    // луч расходится: к правой стенке шире и чуть тусклее; края по длине мягкие (стекло стенок)
    float w = mix(0.55, 1.0, u);
    float v = (vUv.y - 0.5) * 2.0 / w;
    float core = 0.55 * exp(-v * v * 4.5) + 0.45 * exp(-v * v * 22.0);
    float ends = smoothstep(0.0, 0.1, u) * smoothstep(0.0, 0.1, 1.0 - u);
    float fall = mix(1.0, 0.7, u);
    vec3 col = mix(vec3(1.0, 0.97, 0.9), vec3(0.9, 0.95, 1.0), u);
    gl_FragColor = vec4(col, uOn * core * ends * fall);
  }
`

/** Светлая полоса бокового света в мутной жидкости (сложение цвета), плоскость в системе пробирки. */
export class TyndallBeam {
  readonly mesh: THREE.Mesh
  readonly spec: TyndallBeamSpec
  private readonly geo: THREE.PlaneGeometry
  private readonly mat: THREE.ShaderMaterial

  constructor(spec: TyndallBeamSpec) {
    this.spec = spec
    const len = 2 * spec.r
    this.geo = new THREE.PlaneGeometry(len, 2 * spec.halfW * 1.5, 1, 1)
    this.geo.rotateZ(Math.atan(spec.slope))
    this.geo.translate(0, spec.y, 0.001)
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uOn: { value: 0 }, uSurface: { value: 0 }, uToLayer: { value: new THREE.Matrix4() } },
      vertexShader: BEAM_VERT,
      fragmentShader: BEAM_FRAG,
    })
    this.mesh = new THREE.Mesh(this.geo, this.mat)
    this.mesh.name = 'solution-tyndall-beam'
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 4
  }

  /** on — яркость (∝ мутности), surface — уровень поверхности в системе макро-слоя, toLayer — матрица пробирки. */
  update(on: number, surface: number, toLayer: THREE.Matrix4): void {
    this.mat.uniforms.uOn!.value = on
    this.mat.uniforms.uSurface!.value = surface
    ;(this.mat.uniforms.uToLayer!.value as THREE.Matrix4).copy(toLayer)
    this.mesh.visible = on > 0.004
  }

  dispose(): void {
    this.geo.dispose()
    this.mat.dispose()
  }
}

// ─── «объём раствора» микромира ──────────────────────────────────────────────

const VOLUME_GLINTS = 36

const VOL_VERT = /* glsl */ `
  varying vec2 vP;
  void main() {
    vP = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const VOL_FRAG = /* glsl */ `
  uniform float uAlpha;
  uniform vec3 uLens;
  uniform vec2 uHalf;
  varying vec2 vP;
  void main() {
    // мягкая голубоватая глубина: светлее у центра и сверху (свет в толще раствора), к краям растворяется
    float r = length(vP * vec2(0.8, 1.0));
    float body = exp(-r * r * 2.2);
    float top = 0.55 + 0.45 * smoothstep(-0.9, 0.9, vP.y);
    vec3 deep = vec3(0.10, 0.22, 0.42);
    vec3 lit = vec3(0.30, 0.52, 0.80);
    vec3 col = mix(deep, lit, body * top);
    float a = uAlpha * (0.1 + 0.34 * body) * top;
    // «лупа»: объём виден только внутри круга перехода макро ↔ микро
    if (uLens.z > 0.0) a *= 1.0 - smoothstep(uLens.z * 0.94, uLens.z, length(vP * uHalf - uLens.xy));
    gl_FragColor = vec4(col, a);
  }
`
const GLINT_VERT = /* glsl */ `
  attribute vec3 aSeed;
  uniform float uTime;
  uniform float uScale;
  uniform float uSize;
  varying float vA;
  void main() {
    vec3 p = position;
    // медленный дрейф и мерцание: у каждого блика своя фаза
    p.x += sin(uTime * 0.21 + aSeed.x * 6.28) * 0.04;
    p.y += sin(uTime * 0.17 + aSeed.y * 6.28) * 0.05;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float tw = 0.5 + 0.5 * sin(uTime * (0.6 + aSeed.z) + aSeed.x * 20.0);
    vA = pow(tw, 3.0) * (0.35 + 0.65 * aSeed.z);
    gl_PointSize = uSize * length(modelViewMatrix[1].xyz) * (0.6 + 0.8 * aSeed.y) * uScale / max(0.001, -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`
const GLINT_FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uAlpha;
  varying float vA;
  void main() {
    float t = texture2D(uMap, gl_PointCoord).a;
    gl_FragColor = vec4(vec3(0.85, 0.93, 1.0), t * t * vA * uAlpha);
  }
`

/**
 * «Объём раствора» (школьный режим без молекул воды): мягкая голубоватая глубина за частицами и редкие
 * светлые блики, медленно дрейфующие в толще. Плоскость и точки — в системе слоя, 2 единицы = 1 «экран»
 * (масштаб задаёт вызывающий: group.scale = полуразмеры кадра микромира).
 */
export class SolutionVolume {
  readonly group = new THREE.Group()
  private readonly planeGeo: THREE.PlaneGeometry
  private readonly planeMat: THREE.ShaderMaterial
  private readonly glintGeo: THREE.BufferGeometry
  private readonly glintMat: THREE.ShaderMaterial
  private readonly glints: THREE.Points
  private readonly _v = new THREE.Vector2()

  constructor(map: THREE.Texture) {
    this.planeGeo = new THREE.PlaneGeometry(2, 2, 1, 1)
    this.planeMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uAlpha: { value: 0 }, uLens: { value: new THREE.Vector3(0, 0, -1) }, uHalf: { value: new THREE.Vector2(1, 1) } },
      vertexShader: VOL_VERT,
      fragmentShader: VOL_FRAG,
    })
    const plane = new THREE.Mesh(this.planeGeo, this.planeMat)
    plane.frustumCulled = false
    plane.renderOrder = -1
    const pos = new Float32Array(VOLUME_GLINTS * 3)
    const seed = new Float32Array(VOLUME_GLINTS * 3)
    let s = 29
    const rnd = () => {
      s = (s * 16807) % 2147483647
      return (s - 1) / 2147483646
    }
    for (let i = 0; i < VOLUME_GLINTS; i++) {
      pos[i * 3] = (rnd() * 2 - 1) * 0.95
      pos[i * 3 + 1] = (rnd() * 2 - 1) * 0.9
      pos[i * 3 + 2] = -0.2 - rnd() * 0.6
      seed[i * 3] = rnd()
      seed[i * 3 + 1] = rnd()
      seed[i * 3 + 2] = rnd()
    }
    this.glintGeo = new THREE.BufferGeometry()
    this.glintGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    this.glintGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3))
    this.glintMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uMap: { value: map }, uAlpha: { value: 0 }, uTime: { value: 0 }, uScale: { value: 400 }, uSize: { value: 0.03 } },
      vertexShader: GLINT_VERT,
      fragmentShader: GLINT_FRAG,
    })
    this.glints = new THREE.Points(this.glintGeo, this.glintMat)
    this.glints.frustumCulled = false
    this.glints.renderOrder = -1
    this.glints.onBeforeRender = (renderer) => {
      renderer.getDrawingBufferSize(this._v)
      this.glintMat.uniforms.uScale!.value = this._v.y * 0.5
    }
    this.group.add(plane, this.glints)
    this.group.name = 'solution-volume'
    this.group.visible = false
  }

  /**
   * alpha — сила (0 — выключен), time — время сюжета; cx, cy, hw, hh — центр и полуразмеры области в системе
   * родителя; lens — круг «лупы» в той же системе (r ≤ 0 — без маски).
   */
  update(alpha: number, time: number, cx: number, cy: number, z: number, hw: number, hh: number, lensX: number, lensY: number, lensR: number): void {
    this.group.visible = alpha > 0.004
    if (!this.group.visible) return
    this.group.position.set(cx, cy, z)
    this.group.scale.set(hw, hh, Math.min(hw, hh))
    this.planeMat.uniforms.uAlpha!.value = alpha
    const L = this.planeMat.uniforms.uLens!.value as THREE.Vector3
    ;(this.planeMat.uniforms.uHalf!.value as THREE.Vector2).set(hw, hh)
    // круг лупы — в системе родителя относительно центра области
    if (lensR > 0) L.set(lensX - cx, lensY - cy, lensR)
    else L.set(0, 0, -1)
    this.glintMat.uniforms.uAlpha!.value = alpha * (lensR > 0 ? 0 : 1)
    this.glintMat.uniforms.uTime!.value = time
  }

  dispose(): void {
    this.planeGeo.dispose()
    this.planeMat.dispose()
    this.glintGeo.dispose()
    this.glintMat.dispose()
  }
}
