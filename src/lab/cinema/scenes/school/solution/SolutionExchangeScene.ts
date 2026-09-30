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
  solutionMoments,
  solutionSmooth,
  SOLUTION_DRAW,
  SOLUTION_HALO_BALL,
  type SolutionCueId,
  type SolutionModel,
  type SolutionState,
} from './solutionModel'
import type { SolutionSceneSpec } from './solutionSpec'
import { SolutionMacroView, softDotTexture } from './solutionMacroView'

/**
 * ШКОЛЬНАЯ СЦЕНА «ОБМЕН В РАСТВОРЕ» (BaCl₂ + H₂SO₄ → BaSO₄↓ + 2HCl) — класс на Three.js + GSAP с тем же
 * интерфейсом, что у SchoolReactionScene (адаптер SchoolCinemaScene работает с обоими). Кадр — чистая
 * функция времени sampleSolutionState (solutionModel.ts); класс только переносит состояние в объекты three.
 *
 * Слои:
 *   • макро — пробирки (lathe по профилю kit/glassware), жидкость, струя при сливании, белая муть
 *     (точки) и слой осадка на дне;
 *   • микро — ионы и частицы школьным языком (SCHOOL-материалы: матовые CPK-шары, символ внутри шара,
 *     серые палочки связей внутри частиц), вода — непрозрачные уголки O + 2H, приглушённые к цвету фона
 *     (второй план), ближняя оболочка у ионов чуть ярче; заряд — мягким свечением по краю шара (френель)
 *     цветом знака и ореолом без кромки; притяжение Ba²⁺ ↔ SO₄²⁻ — светящийся «мост» между облаками ионов
 *     с импульсами к середине (не палочки); в кристалле группы SO₄ — полупрозрачные жёлтые тетраэдры
 *     (координационные полиэдры), рёбра ячеек — тонкие светящиеся линии; точек-электронов на ионах нет.
 * Переход макро ↔ микро — «лупа»: один слой гаснет и растёт, другой проявляется из меньшего масштаба.
 * Производительность: шары и палочки — InstancedMesh (отдельно для воды), ноль аллокаций в update.
 */

const gsap: typeof GSAP.gsap =
  (GSAP as unknown as { gsap?: typeof GSAP.gsap }).gsap ?? (GSAP as unknown as { default: { gsap: typeof GSAP.gsap } }).default.gsap

const K = pmToScene(1)
const MATTE = { roughness: 0.84, metalness: 0, clearcoat: 0, clearcoatRoughness: 0.4, specularIntensity: 0.16 } as const
/** Ореол заряда: + тёплый (янтарь), − холодный (голубой); H⁺ в H₃O⁺ — ярче; соседи Ba²⁺ в кристалле — белые. */
const HALO_COLOR = { plus: 0xffa64d, minus: 0x4fc3ff, proton: 0xffd27a, neighbor: 0xeaf6ff } as const
/** Сила ореола (billboard) и френель-кромки шара по виду подсветки. */
const HALO_GAIN = { plus: 0.5, minus: 0.5, proton: 0.75, neighbor: 0.55 } as const
const RIM_GAIN = { plus: 0.8, minus: 0.85, proton: 1.3, neighbor: 0.9 } as const
/** Вода: доля смешения с цветом фона (глубина) — фон сильнее, ближняя оболочка у ионов слабее. */
const WATER_FOG = { bg: 0.68, shell: 0.38 } as const
/** В кристалле (тетраэдры видны) шары O и S группы мельче — грани полиэдра читаются, как в кристаллографии. */
const POLY_SHRINK = { O: 0.4, S: 0.3 } as const
/** Тетраэдр SO₄ в кристалле: грани (индексы O группы 0…3). */
const TETRA_FACES = [
  [0, 1, 2],
  [0, 3, 1],
  [0, 2, 3],
  [1, 3, 2],
] as const

/** Матовый шар с белой кромкой и свечением заряда по краю (френель) — цвет и сила из атрибута экземпляра aGlow. */
function withChargeGlow(mat: THREE.MeshPhysicalMaterial): THREE.MeshPhysicalMaterial {
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aGlow;\nvarying vec3 vGlow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow;')
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vGlow;').replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
{
  float rimF = 1.0 - saturate( dot( normalize( normal ), normalize( vViewPosition ) ) );
  totalEmissiveRadiance += vec3( ${NACL_RIM.atom.toFixed(3)} ) * pow( rimF, 2.6 );
  totalEmissiveRadiance += vGlow * ( 0.16 * rimF + 1.35 * pow( rimF, 2.4 ) );
}`,
    )
  }
  mat.customProgramCacheKey = () => 'solution-charge-glow-1'
  return mat
}

export type SolutionSceneOptions = {
  locale?: SceneLocale
  lowPower?: boolean
  onCue?: (id: SolutionCueId) => void
  onStatus?: (status: SchoolStatus, step: number) => void
  lights?: SchoolLightRig
}

function atomColor(el: string, water: boolean, far = false): THREE.Color {
  // Ba (0x00c900) и Cl (0x1ff01f) в CPK оба зелёные: барий — насыщенный изумрудный, хлор — светлый
  // жёлто-зелёный (та же CPK-семья), плюс разные размеры по Шеннону — различимы и без подписи.
  if (el === 'Ba') return new THREE.Color(0x0fa860)
  if (el === 'Cl') return new THREE.Color(0xc9f266)
  const c = new THREE.Color(cpkHex(el as never))
  if (el === 'H') c.multiplyScalar(0.9)
  if (water) {
    // вода — второй план: приглушённый розовато-серый O и светло-серые H, смешаны с цветом фона
    // (глубина, как в тумане); фоновая — сильнее, ближняя оболочка у ионов — чуть ярче
    if (el === 'O') c.set(0xd99a9a)
    else c.set(0xdfe5ee)
    c.lerp(SCHOOL_SCENE_BG, far ? WATER_FOG.bg : WATER_FOG.shell)
  }
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
  /** передача кадра герою: тело героя (hero/heroHandoff), на место которого встаёт кристалл */
  private handoffTarget: THREE.Object3D | null = null
  /** цель — оценка места героя (центр кадра героя), тело ещё не смонтировано: масштаб считаем сами */
  private handoffEstimated = false
  private handedOff = false
  /** радиус описанной сферы одной ячейки кристалла (пм) — таким герой вписывается в кадр (HERO_FIT_RADIUS = 1) */
  private readonly heroCellRadiusPm: number
  private readonly _hp = new THREE.Vector3()
  private readonly _hq = new THREE.Quaternion()
  private readonly _hs = new THREE.Vector3()
  private readonly _rs = new THREE.Vector3()

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
  private readonly divider: THREE.Line
  private readonly dividerMat: THREE.LineDashedMaterial
  /** рёбра ячеек кристаллика (система кристалла: центр и поворот вокруг вертикали) */
  private readonly crystalFrame = new THREE.Group()
  private readonly edges: THREE.LineSegments
  private readonly edgeMat: THREE.LineBasicMaterial
  // макро
  private readonly glassGeo: THREE.LatheGeometry
  /** стекло: френель (кромки светлые, середина прозрачна), обе стороны стенки */
  private readonly glassMat: THREE.ShaderMaterial
  /** отогнутый край горлышка — тонкое кольцо */
  private readonly rimMat: THREE.MeshBasicMaterial
  private readonly rimGeo: THREE.TorusGeometry
  private readonly tubeA = new THREE.Group()
  private readonly tubeB = new THREE.Group()
  /** жидкость, мениск, струя, пипетка, выноски и «лупа» (solutionMacroView) */
  private readonly macroView: SolutionMacroView
  private readonly dotTex: THREE.DataTexture
  /** подпись макро-кадра (у неё нет «лупы» мира частиц) */
  private readonly isMacroLabel: Uint8Array
  private readonly calloutLabels: number[]
  private readonly sedimentGeo: THREE.LatheGeometry
  /** осадок по уровню (шаг 4 пм-единицы сцены): сжатая по высоте полусфера торчала бы «блином» за круглое дно */
  private readonly sedimentGeos = new Map<number, THREE.LatheGeometry>()
  private sedimentKey = -1
  private readonly latheSegments: number
  private readonly sedimentMat: THREE.MeshStandardMaterial
  private readonly sediment: THREE.Mesh
  private readonly turbidGeo: THREE.BufferGeometry
  private readonly turbidMat: THREE.PointsMaterial
  private readonly turbid: THREE.Points
  private readonly insideVis: Float32Array
  private readonly discs: Float32Array
  private readonly labelIndexOfAtom: Int32Array
  // фокус микромира: базовые цвета шаров (приглушение — множителем), ореолы зарядов, линии поля
  private readonly baseColor: Float32Array
  private readonly appliedDim: Float32Array
  private readonly viewK: Float32Array
  private readonly haloGeo: THREE.PlaneGeometry
  private readonly haloMat: THREE.ShaderMaterial
  private readonly halos: THREE.InstancedMesh
  private readonly haloBase: THREE.Color[]
  private readonly haloShape: THREE.InstancedBufferAttribute
  /** шары ионов: своя геометрия со свечением заряда по краю (aGlow на экземпляр) */
  private readonly ionGeo: THREE.BufferGeometry
  private readonly ionGlow: THREE.InstancedBufferAttribute
  /** «мост» притяжения Ba²⁺ ↔ SO₄²⁻: светящаяся лента между облаками ионов с импульсами к середине */
  private readonly bridgeMat: THREE.ShaderMaterial
  private readonly bridge: THREE.Mesh
  /** тетраэдры SO₄ кристалла (координационные полиэдры): тела групп, геометрия граней */
  private readonly polyBodies: number[]
  private readonly polyFrom: Float32Array
  /** проявление тетраэдра по телу (0…1) — шары O и S группы мельче на эту долю */
  private readonly polyOn: Float32Array
  private readonly polyGeo: THREE.BufferGeometry
  private readonly polyMat: THREE.ShaderMaterial
  private readonly poly: THREE.Mesh
  private readonly _col = new THREE.Color()

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
    {
      // габарит фрагмента ячеек (crystalCells) → одна ячейка → половина её диагонали (+ выступ шаров)
      const lo = [Infinity, Infinity, Infinity]
      const hi = [-Infinity, -Infinity, -Infinity]
      for (const [a, b] of this.model.cellEdges) {
        for (const p of [a, b]) {
          for (let k = 0; k < 3; k++) {
            lo[k] = Math.min(lo[k]!, p[k]!)
            hi[k] = Math.max(hi[k]!, p[k]!)
          }
        }
      }
      const cells = spec.crystalCells
      const d = [0, 1, 2].map((k) => (hi[k]! - lo[k]!) / cells[k]!)
      this.heroCellRadiusPm = Number.isFinite(d[0]!) ? 0.5 * Math.hypot(d[0]!, d[1]!, d[2]!) * 1.12 : 700
    }
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
    this.ionMat = withChargeGlow(new THREE.MeshPhysicalMaterial({ color: 0xffffff, ...MATTE, transparent: true, fog: false }))
    this.ionGeo = this.sphere.clone()
    this.ionGlow = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, nIon) * 3), 3)
    this.ionGlow.setUsage(THREE.DynamicDrawUsage)
    this.ionGeo.setAttribute('aGlow', this.ionGlow)
    this.ions = new THREE.InstancedMesh(this.ionGeo, this.ionMat, Math.max(1, nIon))
    // вода непрозрачная (палочки не просвечивают), кромка — слабая и холодная: второй план не спорит с ионами
    this.waterAtomMat = withNaclRim(new THREE.MeshPhysicalMaterial({ color: 0xffffff, ...MATTE, transparent: true, fog: false }), 0x8ea3c0, 0.05)
    this.waterAtoms = new THREE.InstancedMesh(this.sphere, this.waterAtomMat, Math.max(1, nWater))
    this.ions.name = 'solution-ions'
    this.waterAtoms.name = 'solution-water'
    this.ions.frustumCulled = false
    this.waterAtoms.frustumCulled = false
    this.waterAtoms.renderOrder = 2
    this.baseColor = new Float32Array(n * 3)
    this.appliedDim = new Float32Array(n).fill(1)
    this.viewK = new Float32Array(n)
    m.atoms.forEach((a, i) => {
      const water = this.isWaterAtom[i] === 1
      const mesh = water ? this.waterAtoms : this.ions
      // оболочка H₃O⁺ — тише прочей ближней воды: не читается «лишними связями» иона
      const c = atomColor(a.el, water, m.bodies[a.body]!.id.startsWith('wBg') || m.bodies[a.body]!.id.startsWith('wH3O'))
      c.toArray(this.baseColor, i * 3)
      mesh.setColorAt(this.slotOf[i]!, c)
      this.viewK[i] = m.viewK[i]!
    })
    this.micro.add(this.ions, this.waterAtoms)

    // ——— ореолы зарядов: мягкое свечение без кромки, всегда лицом к камере (billboard в шейдере) ———
    // 'ball' — вокруг шара: спадает от края шара наружу (внутри шара его закрывает сам шар);
    // 'cloud' — облако многоатомного иона (SO₄²⁻, H₃O⁺): мягкое радиальное, без резкой границы.
    this.haloGeo = new THREE.PlaneGeometry(2, 2)
    this.haloShape = new THREE.InstancedBufferAttribute(Float32Array.from({ length: Math.max(1, m.halos.length) }, (_, h) => (m.halos[h]?.shape === 'cloud' ? 1 : 0)), 1)
    this.haloGeo.setAttribute('aShape', this.haloShape)
    this.haloMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute float aShape;
        varying vec2 vP;
        varying vec3 vCol;
        varying float vShape;
        void main() {
          vP = position.xy;
          vCol = instanceColor;
          vShape = aShape;
          vec3 c = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          float r = length(instanceMatrix[0].xyz);
          vec4 mv = modelViewMatrix * vec4(c, 1.0);
          mv.xy += position.xy * r * length(modelViewMatrix[0].xyz);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec2 vP;
        varying vec3 vCol;
        varying float vShape;
        void main() {
          float d = length(vP);
          if (d > 1.0) discard;
          float a;
          if (vShape < 0.5) {
            float d0 = ${(1 / SOLUTION_HALO_BALL).toFixed(4)};
            float x = max(0.0, d - d0) / (1.0 - d0);
            a = exp(-x * x * 4.5) * (1.0 - smoothstep(0.82, 1.0, d)) * smoothstep(d0 - 0.2, d0, d);
          } else {
            a = 0.62 * exp(-d * d * 3.0) * (1.0 - smoothstep(0.75, 1.0, d));
          }
          gl_FragColor = vec4(vCol, a);
        }
      `,
    })
    this.halos = new THREE.InstancedMesh(this.haloGeo, this.haloMat, Math.max(1, m.halos.length))
    this.halos.name = 'solution-halos'
    this.halos.frustumCulled = false
    this.halos.renderOrder = 6
    // подсвеченный Ba²⁺ среди 12 соседних O — тёплым кольцом катиона, сами O — белыми
    this.haloBase = m.halos.map((h) => new THREE.Color(HALO_COLOR[h.kind === 'neighbor' && h.atom >= 0 && m.atoms[h.atom]!.el === 'Ba' ? 'plus' : h.kind]))
    for (let h = 0; h < Math.max(1, m.halos.length); h++) this.halos.setColorAt(h, this._col.setRGB(0, 0, 0))
    // ——— «мост» притяжения Ba²⁺ ↔ SO₄²⁻: лента лицом к камере между облаками ионов ———
    // Мягкий градиент тёплый → холодный без резких краёв; концы растворяются в облаках (ни одна линия не
    // упирается в атом S или O); по ленте от обоих ионов к середине бегут светлые импульсы — «тяга».
    this.bridgeMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uA: { value: new THREE.Vector3() },
        uB: { value: new THREE.Vector3(1, 0, 0) },
        uHalf: { value: 1 },
        uTime: { value: 0 },
        uAlpha: { value: 0 },
        uE0: { value: 0.2 },
        uE1: { value: 0.3 },
        uWarm: { value: new THREE.Color(HALO_COLOR.plus) },
        uCold: { value: new THREE.Color(HALO_COLOR.minus) },
      },
      vertexShader: /* glsl */ `
        uniform vec3 uA;
        uniform vec3 uB;
        uniform float uHalf;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec4 a = modelViewMatrix * vec4(uA, 1.0);
          vec4 b = modelViewMatrix * vec4(uB, 1.0);
          vec3 axis = b.xyz - a.xyz;
          vec3 mid = 0.5 * (a.xyz + b.xyz);
          vec3 side = normalize(cross(axis, mid));
          float sc = length(modelViewMatrix[0].xyz);
          vec3 p = mix(a.xyz, b.xyz, uv.x) + side * (uv.y - 0.5) * 2.0 * uHalf * sc;
          gl_Position = projectionMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uAlpha;
        uniform float uE0;
        uniform float uE1;
        uniform vec3 uWarm;
        uniform vec3 uCold;
        varying vec2 vUv;
        void main() {
          float u = vUv.x;
          float v = (vUv.y - 0.5) * 2.0;
          float w = 0.5 + 0.5 * pow(abs(u - 0.5) * 2.0, 2.0);
          float glow = exp(-pow(v / w, 2.0) * 2.6);
          float ends = smoothstep(0.0, uE0, u) * smoothstep(0.0, uE1, 1.0 - u);
          float pul = 0.0;
          for (int k = 0; k < 3; k++) {
            float ph = fract(uTime * 0.6 + float(k) / 3.0);
            float f = sin(3.14159 * ph);
            pul += f * (exp(-pow((u - 0.5 * ph) / 0.05, 2.0)) + exp(-pow((u - 1.0 + 0.5 * ph) / 0.05, 2.0)));
          }
          float thin = exp(-v * v * 30.0);
          vec3 col = mix(uWarm, uCold, smoothstep(0.2, 0.8, u));
          col = mix(col, vec3(1.0), clamp(0.45 * pul * thin, 0.0, 0.6));
          gl_FragColor = vec4(col, uAlpha * ends * (0.5 * glow + 0.85 * pul * thin));
        }
      `,
    })
    this.bridge = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.bridgeMat)
    this.bridge.name = 'solution-bridge'
    this.bridge.frustumCulled = false
    this.bridge.renderOrder = 7
    this.bridge.visible = false
    this.micro.add(this.halos, this.bridge)

    // ——— тетраэдры SO₄ кристалла: полупрозрачные жёлтые грани, O в вершинах, S внутри, светлые рёбра ———
    this.polyBodies = m.bodies.map((b, i) => ({ b, i })).filter((x) => x.b.kind === 'lattice-group' || x.i === m.roles.group).map((x) => x.i)
    const Tm = solutionMoments(m)
    this.polyFrom = Float32Array.from(this.polyBodies, (bi) => m.bodies[bi]!.land?.t ?? Tm.seed1)
    this.polyOn = new Float32Array(m.bodies.length)
    const nv = Math.max(1, this.polyBodies.length) * 12
    this.polyGeo = new THREE.BufferGeometry()
    this.polyGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nv * 3), 3).setUsage(THREE.DynamicDrawUsage))
    this.polyGeo.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(nv), 1).setUsage(THREE.DynamicDrawUsage))
    const bary = new Float32Array(nv * 3)
    for (let v = 0; v < nv; v++) bary[v * 3 + (v % 3)] = 1
    this.polyGeo.setAttribute('aBary', new THREE.BufferAttribute(bary, 3))
    this.polyMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { uColor: { value: new THREE.Color(0xffd94a) }, uEdge: { value: new THREE.Color(0xfff6c8) } },
      vertexShader: /* glsl */ `
        attribute vec3 aBary;
        attribute float aAlpha;
        varying vec3 vBary;
        varying float vAlpha;
        varying vec3 vView;
        void main() {
          vBary = aBary;
          vAlpha = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vView = mv.xyz;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform vec3 uEdge;
        varying vec3 vBary;
        varying float vAlpha;
        varying vec3 vView;
        void main() {
          if (vAlpha < 0.003) discard;
          vec3 n = normalize(cross(dFdx(vView), dFdy(vView)));
          float facing = abs(dot(n, normalize(-vView)));
          float lit = 0.62 + 0.38 * abs(dot(n, normalize(vec3(0.35, 0.8, 0.5))));
          float e = min(min(vBary.x, vBary.y), vBary.z);
          float edge = 1.0 - smoothstep(0.0, 0.05, e);
          vec3 col = mix(uColor * lit, uEdge, 0.85 * edge);
          gl_FragColor = vec4(col, vAlpha * (0.26 + 0.16 * (1.0 - facing) + 0.5 * edge));
          #include <colorspace_fragment>
        }
      `,
    })
    this.poly = new THREE.Mesh(this.polyGeo, this.polyMat)
    this.poly.name = 'solution-sulfate-tetrahedra'
    this.poly.frustumCulled = false
    this.poly.renderOrder = 3
    this.micro.add(this.poly)

    // ——— палочки ———
    this.stickGeo = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true)
    this.stickMat = withNaclRim(new THREE.MeshPhysicalMaterial({ color: 0xd4dce6, ...MATTE, transparent: true, fog: false }), 0xffffff, NACL_RIM.atom)
    this.waterStickMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, ...MATTE, transparent: true, fog: false })
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
    // палочки воды — тоже второй план: к цвету фона (фон — сильнее)
    m.sticks.forEach((st, k) => {
      if (!st.water) return
      const far = m.bodies[m.atoms[st.a]!.body]!.id.startsWith('wBg')
      this.waterSticks.setColorAt(this.stickSlot[k]!, this._col.set(0xb8c2ce).lerp(SCHOOL_SCENE_BG, far ? WATER_FOG.bg : WATER_FOG.shell))
    })
    this.micro.add(this.sticks, this.waterSticks)

    // ——— граница двух растворов ———
    this.dividerMat = new THREE.LineDashedMaterial({ color: 0x9fc4e8, dashSize: 40 * K, gapSize: 34 * K, transparent: true, opacity: 0, depthWrite: false, fog: false })
    this.divider = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -980 * K, -300 * K), new THREE.Vector3(0, 980 * K, -300 * K)]), this.dividerMat)
    this.divider.computeLineDistances()
    this.divider.frustumCulled = false
    this.micro.add(this.divider)
    const edgePts: THREE.Vector3[] = []
    for (const [a, b] of m.cellEdges) edgePts.push(new THREE.Vector3(a[0] * K, a[1] * K, a[2] * K), new THREE.Vector3(b[0] * K, b[1] * K, b[2] * K))
    // рёбра ячеек — тонкие светящиеся линии (сложение цвета), не серая «проволока»
    this.edgeMat = new THREE.LineBasicMaterial({ color: 0x7cc8ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })
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
    this.latheSegments = opts.lowPower ? 28 : 48
    this.glassGeo = lathe(roundTestTubeProfile(R, H))
    // Стекло без серой «заливки»: светятся только кромки (там взгляд идёт вдоль стенки), середина почти
    // прозрачна — пробирка читается как стекло, жидкость и осадок видны сквозь неё.
    this.glassMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { uColor: { value: new THREE.Color(0xe4f2ff) }, uOpacity: { value: 1 } },
      vertexShader: /* glsl */ `
        varying vec3 vN;
        varying vec3 vV;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal);
          vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uOpacity;
        varying vec3 vN;
        varying vec3 vV;
        void main() {
          vec3 n = normalize(vN);
          float f = 1.0 - abs(dot(n, normalize(vV)));
          float a = 0.035 + 0.62 * pow(f, 2.2);
          // мягкий вертикальный блик на стекле (отражение окна)
          float hl = exp(-pow((n.x + 0.42) * 6.0, 2.0)) * (1.0 - f);
          a += 0.14 * hl;
          gl_FragColor = vec4(mix(uColor, vec3(1.0), 0.5 * hl), a * uOpacity);
        }
      `,
    })
    this.rimMat = new THREE.MeshBasicMaterial({ color: 0xe8f4ff, transparent: true, opacity: 0.6, depthWrite: false, fog: false })
    this.rimGeo = new THREE.TorusGeometry(R * 1.1 * K, R * 0.045 * K, 8, opts.lowPower ? 28 : 48)
    this.rimGeo.rotateX(Math.PI / 2)
    this.rimGeo.translate(0, H * K, 0)
    // жидкость, мениск, струя, пипетка, выноски, «лупа» — solutionMacroView
    this.macroView = new SolutionMacroView(m, opts.lowPower === true, SCHOOL_SCENE_BG)
    this.sedimentGeo = lathe(liquidProfile(R, R * 0.25 + 0.2 * H, 0.9))
    this.sedimentMat = new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.95, transparent: true, opacity: 0.96, fog: false })
    this.sediment = new THREE.Mesh(this.sedimentGeo, this.sedimentMat)
    this.turbidGeo = new THREE.BufferGeometry()
    this.turbidGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(m.turbidPoints * 3), 3))
    // хлопья мути — мягкие круглые точки (не квадраты)
    this.dotTex = softDotTexture()
    this.turbidMat = new THREE.PointsMaterial({ color: 0xffffff, map: this.dotTex, size: 50 * K, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, fog: false })
    this.turbid = new THREE.Points(this.turbidGeo, this.turbidMat)
    this.turbid.frustumCulled = false
    const glassA = new THREE.Mesh(this.glassGeo, this.glassMat)
    const glassB = new THREE.Mesh(this.glassGeo, this.glassMat)
    const rimA = new THREE.Mesh(this.rimGeo, this.rimMat)
    const rimB = new THREE.Mesh(this.rimGeo, this.rimMat)
    const mv = this.macroView
    this.tubeA.add(mv.liquidA, mv.meniscus, this.sediment, this.turbid, glassA, rimA)
    this.tubeB.add(mv.liquidB, glassB, rimB)
    this.macro.add(this.tubeA, this.tubeB, mv.stream, mv.pipette, mv.drops, mv.callouts)
    // камера чуть выше пробирок: видны мениск и кромки устья
    this.macro.rotation.x = 0.1
    // порядок прозрачных слоёв: макро → «лупа» (диск фона) → мир частиц
    this.stage.add(mv.lens)
    mv.lens.renderOrder = 1
    this.micro.renderOrder = 2
    this.crystalFrame.renderOrder = 2

    // ——— подписи ———
    this.labels = m.labels.map((l) => ({ id: l.id, kind: l.kind as SchoolLabelKind, pos: new THREE.Vector3(), opacity: 0, text: this.localize(l.text[this.locale]) }))
    const macroIds = new Set(['tubeA', 'tubeB', 'precip', 'acid', 'nitric'])
    this.isMacroLabel = Uint8Array.from(m.labels, (l) => (macroIds.has(l.id) ? 1 : 0))
    this.calloutLabels = m.labels.map((l, k) => (l.id === 'precip' || l.id === 'acid' || l.id === 'nitric' ? k : -1)).filter((k) => k >= 0)
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

  setHandoffTarget(target: THREE.Object3D | null, estimated = false): void {
    this.handoffTarget = target
    this.handoffEstimated = estimated
  }

  /** Герой показан — кадр урока больше не нужен (в каждый момент виден ровно один кристалл). */
  releaseToHero(): void {
    if (this.handedOff) return
    this.handedOff = true
    this.root.visible = false
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
      // Синхронно: compileAsync опрашивает программы таймером и падает (isReady у undefined), если сцену
      // успели снять с экрана до конца опроса (быстрый перезапуск синтеза).
      renderer.compile(this.root, camera, targetScene ?? null)
      await Promise.resolve()
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
    for (const x of [this.edgeMat, this.ionMat, this.waterAtomMat, this.stickMat, this.waterStickMat, this.bridgeMat, this.polyMat, this.dividerMat, this.glassMat, this.rimMat, this.sedimentMat, this.turbidMat, this.dotTex]) x.dispose()
    this.macroView.dispose()
    for (const x of [this.ions, this.waterAtoms, this.sticks, this.waterSticks, this.halos]) x.dispose()
    this.haloGeo.dispose()
    this.haloMat.dispose()
    this.bridge.geometry.dispose()
    this.polyGeo.dispose()
    this.ionGeo.dispose()
    for (const g of this.sedimentGeos.values()) g.dispose()
    for (const g of [this.stickGeo, this.glassGeo, this.rimGeo, this.sedimentGeo, this.turbidGeo, this.divider.geometry]) g.dispose()
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
    this.followHero(t)
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
    this.micro.position.set(s.microOffset[0] * K, s.microOffset[1] * K, s.microOffset[2] * K)
    this.macro.position.set(s.macroOffset[0] * K, s.macroOffset[1] * K, s.macroOffset[2] * K)
    // «лупа»: мир частиц виден только внутри круга (шары за кромкой круга сжимаются в ноль)
    const lensOn = s.lens.u > 0.001 && s.lens.u < 0.999
    const reveal = (x: number, y: number) => (lensOn ? 1 - solutionSmooth(s.lens.r - 120, s.lens.r, Math.hypot(x - s.lens.c[0], y - s.lens.c[1])) : 1)
    if (lensOn) {
      for (let k = 0; k < this.labels.length; k++) if (!this.isMacroLabel[k]) s.labelOpacity[k] = s.labelOpacity[k]! * reveal(s.labelPos[k * 3]!, s.labelPos[k * 3 + 1]!)
    }
    // без передачи кадра герою мир частиц в хвосте гаснет; с передачей — кристалл остаётся до показа героя
    const hold = this.handoffTarget ? 1 : s.fade
    this.ionMat.opacity = s.microAlpha * hold
    this.stickMat.opacity = s.microAlpha * hold
    this.waterAtomMat.opacity = s.microAlpha * hold
    this.waterStickMat.opacity = s.microAlpha * hold
    this.ionMat.depthWrite = s.microAlpha > 0.98
    this.waterAtomMat.depthWrite = s.microAlpha * hold > 0.98
    this.waterStickMat.depthWrite = this.waterAtomMat.depthWrite

    // ——— шары ———
    this.polyAlphas(s, hold)
    this._q.identity()
    let dimIons = false
    let dimWater = false
    for (let i = 0; i < m.atoms.length; i++) {
      this._v.set(s.atomPos[i * 3]! * K, s.atomPos[i * 3 + 1]! * K, s.atomPos[i * 3 + 2]! * K)
      const po = this.polyOn[m.atoms[i]!.body]!
      const shrink = po > 0 ? 1 - po * (m.atoms[i]!.el === 'S' ? POLY_SHRINK.S : POLY_SHRINK.O) : 1
      const r = s.atomR[i]! * K * this.viewK[i]! * shrink * (lensOn ? reveal(s.atomPos[i * 3]! * s.microScale + s.microOffset[0], s.atomPos[i * 3 + 1]! * s.microScale + s.microOffset[1]) : 1)
      this._s.set(r, r, r)
      this._m.compose(this._v, this._q, this._s)
      const water = this.isWaterAtom[i] === 1
      const mesh = water ? this.waterAtoms : this.ions
      mesh.setMatrixAt(this.slotOf[i]!, this._m)
      // приглушение (фокус на паре / на соседях Ba²⁺) — множителем к базовому цвету, только при изменении
      const d = s.bodyDim[m.atoms[i]!.body]!
      if (Math.abs(d - this.appliedDim[i]!) > 0.004) {
        this.appliedDim[i] = d
        this._col.fromArray(this.baseColor, i * 3).multiplyScalar(d)
        mesh.setColorAt(this.slotOf[i]!, this._col)
        if (water) dimWater = true
        else dimIons = true
      }
    }
    this.ions.instanceMatrix.needsUpdate = true
    this.waterAtoms.instanceMatrix.needsUpdate = true
    if (dimIons && this.ions.instanceColor) this.ions.instanceColor.needsUpdate = true
    if (dimWater && this.waterAtoms.instanceColor) this.waterAtoms.instanceColor.needsUpdate = true
    this.applyFocus(s)

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
        const rr = (st.water ? (this.viewK[st.a]! < SOLUTION_DRAW.waterView ? SOLUTION_DRAW.bgWaterStickR : SOLUTION_DRAW.waterStickR) : SOLUTION_DRAW.stickR) * K * alpha
        this._s.set(rr, len, rr)
      }
      this._m.compose(this._c, this._q, this._s)
      ;(st.water ? this.waterSticks : this.sticks).setMatrixAt(this.stickSlot[k]!, this._m)
    }
    this.sticks.instanceMatrix.needsUpdate = true
    this.waterSticks.instanceMatrix.needsUpdate = true

    // ——— граница растворов, тетраэдры SO₄ кристалла ———
    this.applyPolyhedra(s, hold)
    this.dividerMat.opacity = 0.45 * s.divider.alpha * s.microAlpha
    this.divider.visible = this.dividerMat.opacity > 0.01
    this.crystalFrame.position.set(s.crystal.c[0] * K, s.crystal.c[1] * K, s.crystal.c[2] * K)
    this.crystalFrame.rotation.set(0, s.crystal.yaw, 0)
    this.edgeMat.opacity = 0.42 * s.edgeAlpha * s.microAlpha * hold
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
    this.glassMat.uniforms.uOpacity!.value = s.macroAlpha
    this.rimMat.opacity = 0.6 * s.macroAlpha
    // мутная жидкость белеет (облачко растекается), над осевшим осадком снова светлеет
    this.macroView.update(s, m, this.tubeA, this.tubeB, 0.5 * s.turbidity * solutionSmooth(solutionMoments(m).pour1 - 0.7, solutionMoments(m).pour1 + 1.1, s.t))
    const sedH = m.tube.r * 0.25 + s.sediment * H
    const sedKey = Math.max(1, Math.round(sedH / 4))
    if (sedKey !== this.sedimentKey) {
      let g = this.sedimentGeos.get(sedKey)
      if (!g) {
        g = new THREE.LatheGeometry(
          liquidProfile(m.tube.r, sedKey * 4, 0.9).map(([x, y]) => new THREE.Vector2(x * K, y * K)),
          this.latheSegments,
        )
        this.sedimentGeos.set(sedKey, g)
      }
      this.sediment.geometry = g
      this.sedimentKey = sedKey
    }
    this.sediment.visible = s.sediment > 0.0005
    this.sedimentMat.opacity = 0.96 * s.macroAlpha
    const tp = this.turbidGeo.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < m.turbidPoints; i++) tp.setXYZ(i, s.turbidPos[i * 3]! * K, s.turbidPos[i * 3 + 1]! * K, s.turbidPos[i * 3 + 2]! * K)
    tp.needsUpdate = true
    this.turbidMat.opacity = 0.95 * Math.min(1, 1.4 * s.turbidity) * s.macroAlpha
    this.turbid.visible = this.turbidMat.opacity > 0.01
    // ——— подписи ———
    for (let k = 0; k < this.labels.length; k++) {
      const l = this.labels[k]!
      l.pos.set(s.labelPos[k * 3]! * K, s.labelPos[k * 3 + 1]! * K, s.labelPos[k * 3 + 2]! * K)
      l.opacity = s.labelOpacity[k]! * (m.labels[k]!.kind === 'atom' || m.labels[k]!.kind === 'atomDark' ? this.insideVis[k]! : 1)
    }
  }

  /**
   * Хвост с передачей кадра: мир частиц (в нём остался только кристалл) плавно переезжает и масштабируется
   * так, что центр кристалла встаёт в центр тела героя, а пикометр — в его масштаб (шары того же размера).
   */
  private followHero(t: number): void {
    const s = this.state
    const fin = this.model.finish
    const body = this.handoffTarget
    const ms0 = s.microScale
    if (!body || t <= fin.from) return
    const u = solutionSmooth(fin.from, fin.to - 0.2, t)
    body.updateWorldMatrix(true, false)
    body.matrixWorld.decompose(this._hp, this._hq, this._hs)
    this.root.updateWorldMatrix(true, false)
    this._inv.copy(this.root.matrixWorld).invert()
    this._hp.applyMatrix4(this._inv)
    this.root.getWorldScale(this._rs)
    // тело героя: мир на пм = K · масштаб тела; оценка: герой (одна ячейка) вписан в сферу радиуса 1
    const bodyScale = this.handoffEstimated ? 1 / (this.heroCellRadiusPm * K) : this._hs.x
    const msT = bodyScale / Math.max(1e-9, this._rs.x)
    const ms = ms0 + (msT - ms0) * u
    const c = s.crystal.c
    for (let k = 0; k < 3; k++) {
      const off0 = s.microOffset[k]! * K
      const from = off0 + c[k]! * K * ms0
      const to = this._hp.getComponent(k)
      this.micro.position.setComponent(k, from + (to - from) * u - c[k]! * K * ms)
    }
    this.micro.scale.setScalar(ms)
  }

  /**
   * Заряды и притяжение (микромир), без аллокаций: мягкий ореол у шара / облако у многоатомного иона,
   * свечение по краю самих шаров (френель) цветом знака, «мост» Ba²⁺ ↔ SO₄²⁻.
   */
  private applyFocus(s: SolutionState): void {
    const m = this.model
    const glow = this.ionGlow.array as Float32Array
    glow.fill(0)
    for (let h = 0; h < m.halos.length; h++) {
      const def = m.halos[h]!
      const a = s.haloAlpha[h]!
      const r = a > 0.01 ? s.haloR[h]! * K : 0
      this._v.set(s.haloPos[h * 3]! * K, s.haloPos[h * 3 + 1]! * K, s.haloPos[h * 3 + 2]! * K)
      this._s.set(r, r, r)
      this._q.identity()
      this._m.compose(this._v, this._q, this._s)
      this.halos.setMatrixAt(h, this._m)
      const base = this.haloBase[h]!
      const cloud = def.shape === 'cloud'
      this.halos.setColorAt(h, this._col.copy(base).multiplyScalar(a * (def.ghost ? 0.8 : cloud ? 0.34 : HALO_GAIN[def.kind])))
      if (a <= 0.01) continue
      const g = a * RIM_GAIN[def.kind] * (cloud ? 0.8 : 1)
      for (const ai of def.rimAtoms) {
        if (this.isWaterAtom[ai]) continue
        const o = this.slotOf[ai]! * 3
        glow[o] = Math.min(1.2, glow[o]! + base.r * g)
        glow[o + 1] = Math.min(1.2, glow[o + 1]! + base.g * g)
        glow[o + 2] = Math.min(1.2, glow[o + 2]! + base.b * g)
      }
    }
    this.ionGlow.needsUpdate = true
    this.halos.instanceMatrix.needsUpdate = true
    if (this.halos.instanceColor) this.halos.instanceColor.needsUpdate = true
    this.halos.visible = m.halos.length > 0

    // «мост»: от края шара Ba²⁺ до края облака SO₄²⁻ (описанная сфера группы); концы гаснут в облаках
    const fa = s.field.alpha * s.microAlpha
    this.bridge.visible = fa > 0.01
    if (!this.bridge.visible) return
    const ba = m.bodies[m.roles.cation]!.atoms[0]!
    const sa = m.bodies[m.roles.group]!.atoms[0]!
    const A = this._c.set(s.atomPos[ba * 3]!, s.atomPos[ba * 3 + 1]!, s.atomPos[ba * 3 + 2]!)
    const dir = this._w.set(s.atomPos[sa * 3]!, s.atomPos[sa * 3 + 1]!, s.atomPos[sa * 3 + 2]!).sub(A)
    const len = dir.length()
    if (len < 1e-6) {
      this.bridge.visible = false
      return
    }
    dir.divideScalar(len)
    const rBa = s.atomR[ba]! * this.viewK[ba]!
    const rGroup = m.core.so + s.atomR[sa + 1]! * this.viewK[sa + 1]!
    const a0 = rBa * 0.8
    const b0 = len - rGroup * 0.55
    const span = Math.max(1, b0 - a0)
    const u = this.bridgeMat.uniforms
    ;(u.uA!.value as THREE.Vector3).copy(A).addScaledVector(dir, a0).multiplyScalar(K)
    ;(u.uB!.value as THREE.Vector3).copy(A).addScaledVector(dir, b0).multiplyScalar(K)
    u.uHalf!.value = rBa * 0.72 * K
    u.uE0!.value = Math.min(0.45, (rBa * 0.45) / span)
    u.uE1!.value = Math.min(0.6, (rGroup * 0.75) / span)
    u.uTime!.value = this.clock.t
    u.uAlpha!.value = fa
  }

  /** Проявление тетраэдров по телам: после посадки группы; в хвосте гаснут (у героя их нет) — шары возвращают размер. */
  private polyAlphas(s: SolutionState, hold: number): void {
    const fin = this.model.finish
    const tail = hold > 0 ? 1 - solutionSmooth(fin.from, fin.from + 1.1, s.t) : 0
    for (let k = 0; k < this.polyBodies.length; k++) this.polyOn[this.polyBodies[k]!] = solutionSmooth(this.polyFrom[k]!, this.polyFrom[k]! + 0.9, s.t) * tail
  }

  /** Тетраэдры SO₄ кристалла: вершины — атомы O группы, проявляются после посадки, в хвосте гаснут (у героя их нет). */
  private applyPolyhedra(s: SolutionState, hold: number): void {
    const m = this.model
    const pos = this.polyGeo.getAttribute('position') as THREE.BufferAttribute
    const al = this.polyGeo.getAttribute('aAlpha') as THREE.BufferAttribute
    const P = s.atomPos
    let any = false
    for (let k = 0; k < this.polyBodies.length; k++) {
      const bi = this.polyBodies[k]!
      const b = m.bodies[bi]!
      const a = this.polyOn[bi]! * s.bodyAppear[bi]! * s.bodyDim[bi]! * s.microAlpha * hold
      if (a > 0.003) any = true
      for (let f = 0; f < 4; f++) {
        for (let c = 0; c < 3; c++) {
          const v = k * 12 + f * 3 + c
          const ai = b.atoms[1 + TETRA_FACES[f]![c]!]!
          pos.setXYZ(v, P[ai * 3]! * K, P[ai * 3 + 1]! * K, P[ai * 3 + 2]! * K)
          al.setX(v, a)
        }
      }
    }
    pos.needsUpdate = true
    al.needsUpdate = true
    this.poly.visible = any
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
    const ms = this.micro.scale.x
    const mp = this.micro.position
    for (let i = 0; i < n; i++) {
      this._v.set(s.atomPos[i * 3]! * K * ms + mp.x, s.atomPos[i * 3 + 1]! * K * ms + mp.y, s.atomPos[i * 3 + 2]! * K * ms + mp.z)
      const o = i * 4
      const depth = cam.z - this._v.z
      if (depth < 0.02 || s.atomR[i]! <= 0) {
        D[o + 2] = -1
        continue
      }
      D[o] = (this._v.x - cam.x) / depth
      D[o + 1] = (this._v.y - cam.y) / depth
      D[o + 2] = depth
      const rDraw = s.atomR[i]! * K * ms * this.viewK[i]!
      D[o + 3] = rDraw / depth
      const li = this.labelIndexOfAtom[i]!
      if (li >= 0) {
        this._w.copy(cam).sub(this._v).normalize()
        this.labels[li]!.pos.copy(this._v).addScaledVector(this._w, rDraw)
        // шар — препятствие для подписей рядом (заряды групп, пояснения): на телефоне не ложатся на шары
        this.labels[li]!.avoidR = s.microAlpha > 0.05 ? rDraw * 1.05 : 0
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
    // подписи выносок: левый край текста — у конца полки (центр сдвинут на полширины текста)
    const depth = Math.max(0.05, cam.z)
    const pxPerUnit = px / depth
    for (const li of this.calloutLabels) {
      const l = this.labels[li]!
      const halfPx = (l.text.length * 6.9 + 18) / 2
      l.pos.x = s.labelPos[li * 3]! * K + (halfPx + 6) / pxPerUnit
    }
  }
}
