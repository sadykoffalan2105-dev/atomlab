import * as THREE from 'three'
import * as GSAP from 'gsap'
import { cpkHex } from '../kit/cpkAtoms'
import { estimateLabelSize } from '../../core/labelLayout'
import { localizeLabelText, type SceneLocale } from '../kit/sceneKit'
import { NACL_LADDER, NACL_LATTICE_KJ } from './naclEnergetics'
import {
  createNaclLatticeView,
  createNaclMetalMaterial,
  naclHaloTexture,
  naclMetalColor,
  naclSphereGeometry,
  setNaclSiteTint,
  NACL_EDGE_COLOR,
  NACL_GLOSS,
  NACL_MATTE_METAL,
  NACL_RIM,
  withNaclRim,
  writeNaclSite,
  type NaclLatticeView,
  type NaclRim,
} from './naclLatticeView'
import { getNaclMechanismText } from './naclMechanismText'
import { createNaclElectronClouds, naclRingTexture, NACL_NA_OUTER_FILL, type NaclCloudView } from './naclElectronCloud'
import {
  createNaclState,
  I_CLA,
  I_CLB,
  METAL_FRAG,
  naclLatticeIonAt,
  naclMetalPos,
  naclShellPoint,
  naclSingleAngle,
  NACL_CL2_CENTER,
  NACL_CL_ARRIVE_ANGLE,
  NACL_CL_DOT_ANGLES,
  NACL_DIM_A,
  NACL_DIM_GAS_DROP,
  NACL_ELECTRON_CURVES,
  NACL_LABELS,
  NACL_LATTICE_DIR,
  NACL_LATTICE_R,
  naclMetalPoint,
  naclSmooth,
  NACL_METAL_CENTER,
  NACL_METAL_REST,
  NACL_OCTA,
  NACL_OCTA_SHELLS,
  NACL_PAIRS,
  NACL_R,
  NACL_STORY,
  NACL_T,
  SALT_FRAG,
  sampleNaclState,
  type NaclLabelOutside,
  type NaclState,
} from './naclModel'
import { NACL_CUES, NACL_END, NACL_STEPS, type NaclCueId, type NaclStepId } from './naclSteps'

export * from './naclModel'
export { NACL_CUES, NACL_END, NACL_FINISH, NACL_STEPS, NACL_STEP_IDS, NACL_TIMING, NACL_ELECTRONS, NACL_MORPH_S } from './naclSteps'

/**
 * Сцена «ионная связь и решётка NaCl» — ФРЕЙМВОРК-НЕЗАВИСИМЫЙ класс на Three.js + GSAP (без React).
 *
 * Хост кладёт `root` в свою сцену и каждый кадр зовёт `update(dt, camera)`; всё остальное —
 * внутри: машина состояний по шагам (goToStep / next / prev / replay / pause / resume / setSpeed),
 * свет сцены, объекты шести шагов (создаются ОДИН раз и включаются масштабом/прозрачностью),
 * подписи (массив `labels` для DOM-слоя хоста), события урока и контракт лаборатории.
 *
 * Состояние кадра — чистая функция времени сюжета (naclModel.sampleNaclState): класс только
 * переносит его в объекты three. Время ведёт GSAP-твин одного числа (story time = экранное время),
 * поэтому пауза, скорость и перемотка — операции над одним твином.
 *
 * Производительность: ноль аллокаций в update (все векторы, матрицы и цвета — поля класса),
 * решётка — два InstancedMesh с общей геометрией, прогрев шейдеров warmup() до первого шага.
 */

export type NaclLocale = SceneLocale

export type NaclStepInfo = {
  index: number
  id: NaclStepId
  title: string
  equation: string
  text: string
  note: string
  safety?: string
  /** ступень цикла Борна — Габера, пройденная за шаг, и накопленная сумма, кДж/моль */
  dH: { stageKJ: number; cumulativeKJ: number }
  /** энергия решётки ядра, кДж/моль (−787,0) */
  latticeU: number
}

export type NaclStatus = 'idle' | 'playing' | 'paused' | 'finishing' | 'done'

export type NaclSceneState = { step: number; progress: number; playing: boolean; status: NaclStatus; t: number }

/** Подпись для DOM-слоя хоста: позиция — в системе `root`. */
export type NaclSceneLabel = { id: string; kind: string; pos: THREE.Vector3; opacity: number; text: string }

/** Свет сцены. Хост может передать СВОИ объекты света (см. опцию lights) — тогда dispose их не удаляет. */
export type NaclLightRig = { ambient: THREE.AmbientLight; key: THREE.DirectionalLight; point: THREE.PointLight }

export type NaclSceneOptions = {
  locale?: NaclLocale
  lowPower?: boolean
  onStep?: (info: NaclStepInfo) => void
  onCue?: (id: NaclCueId) => void
  onProgress?: (step: number, progress: number) => void
  onStatus?: (status: NaclStatus, step: number) => void
  /**
   * Готовые источники света вместо своих. Хосту это нужно, когда число источников в сцене
   * не должно меняться при размонтировании (смена числа источников перекомпилирует ВСЕ
   * освещённые материалы хоста — длинный кадр). Сцена ставит им интенсивность и позицию.
   */
  lights?: NaclLightRig
}

/**
 * gsap: в сборке Vite — именованный экспорт ESM, в Node (тест сцены) — поле CommonJS-сборки,
 * у которой Node не видит именованных экспортов.
 */
const gsap: typeof GSAP.gsap =
  (GSAP as unknown as { gsap?: typeof GSAP.gsap }).gsap ?? (GSAP as unknown as { default: { gsap: typeof GSAP.gsap } }).default.gsap

/** Интенсивности сценического света (параметры рисунка). */
const LIGHT = { ambient: 0.32, key: 0.85, point: 0.55 } as const
const DOT_R = 0.034
const ELECTRON_R = 0.05
const TRAIL_N = 14
const FIELD_ARCS = 4
const FIELD_DOTS = 12
/** Во сколько гаснут ионы вне выделенных октаэдров (параметр рисунка). */
const NACL_OCTA_DIM = 0.16
const FIELD_COLOR = new THREE.Color(0x8fd6ff)
const ELECTRON_COLOR = new THREE.Color(0x9ee4ff)
const DIM_COLOR = 0xcfeeff
/** Цвет выносок к октаэдрам (тот же, что у размерных линий, — это тоже «чертёж», а не связи). */
const CALLOUT_COLOR = 0xbfe3ff

/**
 * Вершины рамки фрагмента, расширенной на радиус самого крупного иона: по ним считается экранный
 * габарит решётки, за который выносятся подписи шага 5–6.
 */
const LATTICE_CORNERS: readonly (readonly [number, number, number])[] = (() => {
  const b = SALT_FRAG.boundsScene
  const r = NACL_LATTICE_R.clIon
  const out: [number, number, number][] = []
  for (const x of [b.min[0] - r, b.max[0] + r]) for (const y of [b.min[1] - r, b.max[1] + r]) for (const z of [b.min[2] - r, b.max[2] + r]) out.push([x, y, z])
  return out
})()

const _labelSize = { w: 0, h: 0 }

/** Накопленная энергия цикла к концу каждого шага (ступени — по времени сюжета). */
const STEP_DH: readonly { stageKJ: number; cumulativeKJ: number }[] = (() => {
  let prev = 0
  return NACL_STEPS.map((s) => {
    const cum = Math.round(NACL_LADDER.stages.filter((x) => x.at <= s.to).reduce((a, x) => a + x.dH, 0) * 10) / 10
    const out = { stageKJ: Math.round((cum - prev) * 10) / 10, cumulativeKJ: cum }
    prev = cum
    return out
  })
})()

export function naclStepInfo(index: number, locale: NaclLocale): NaclStepInfo {
  const step = NACL_STEPS[index]!
  const text = getNaclMechanismText(locale)
  const st = text.steps[step.id]
  return {
    index,
    id: step.id,
    title: st.title,
    equation: st.equation,
    text: st.body,
    note: st.note ?? '',
    safety: step.id === 'energy' ? text.safety : undefined,
    dH: STEP_DH[index]!,
    latticeU: NACL_LATTICE_KJ,
  }
}

type StoryMat = THREE.MeshPhysicalMaterial & { userData: { rim: NaclRim } }

export class NaClReactionScene {
  readonly root = new THREE.Group()
  /** подписи (только формулы, заряды, числа и символы единиц) — хост рисует их DOM-слоем */
  readonly labels: NaclSceneLabel[]

  private readonly opts: NaclSceneOptions
  private locale: NaclLocale
  private readonly state: NaclState = createNaclState()
  private readonly clock = { t: 0 }
  private tween: gsap.core.Tween | null = null
  private speed = 1
  private status: NaclStatus = 'idle'
  private stepIndex = 0
  private lastCueT = -1
  private appliedT = NaN
  private visual = 0
  private pendingResolve: (() => void) | null = null
  private disposed = false
  private handoffTarget: THREE.Object3D | null = null
  private handoffCaptured = false
  private latticeReleased = false
  private lastLatticeKey = NaN
  private octaFocus = NaN
  /** Узлы, которые фокус октаэдров НЕ гасит: два центра и их по шесть противоионов. */
  private readonly octaFocusSites = new Set<number>([...NACL_OCTA.map((o) => o.center), ...NACL_OCTA_SHELLS.flatMap((s) => s.neighbors)])
  /** Экранный габарит решётки в проективных единицах (см. measureLatticeSpan). */
  private readonly span = { ready: false, minX: 0, maxX: 0, minY: 0, maxY: 0 }
  private viewportH = 800
  private viewportFov = 46
  private readonly octaLabelIndex = NACL_OCTA.map((_, k) => NACL_LABELS.findIndex((l) => l.id === (k === 0 ? 'octaNa' : 'octaCl')))

  // ——— объекты ———
  private readonly stage = new THREE.Group()
  private readonly lights: NaclLightRig
  private readonly ownLights: boolean
  private readonly geo: THREE.SphereGeometry
  private readonly story: THREE.Mesh[] = []
  private readonly storyMat: StoryMat[] = []
  private readonly metalGroup = new THREE.Group()
  private readonly metalRest: THREE.InstancedMesh
  private readonly metalMat: StoryMat
  private readonly metalEdges: THREE.LineSegments
  private readonly metalEdgeMat: THREE.LineBasicMaterial
  private readonly bond: THREE.Mesh
  private readonly bondMat: StoryMat
  private readonly bondGeo: THREE.CylinderGeometry
  private readonly dots: THREE.InstancedMesh
  private readonly dotMat: THREE.MeshBasicMaterial
  private readonly electrons: THREE.Mesh[] = []
  private readonly electronMat: THREE.MeshBasicMaterial
  private readonly halos: THREE.Sprite[] = []
  private readonly haloMats: THREE.SpriteMaterial[] = []
  private readonly trail: THREE.Points
  private readonly trailGeo: THREE.BufferGeometry
  private readonly trailMat: THREE.PointsMaterial
  private readonly field: THREE.Points
  private readonly fieldGeo: THREE.BufferGeometry
  private readonly fieldMat: THREE.PointsMaterial
  private readonly dimGas: THREE.LineSegments
  private readonly dimGasMat: THREE.LineBasicMaterial
  private readonly dimA: THREE.LineSegments
  private readonly dimAMat: THREE.LineBasicMaterial
  private readonly lattice: NaclLatticeView
  private readonly octa: { faces: THREE.Mesh; edges: THREE.LineSegments; faceMat: THREE.MeshBasicMaterial; edgeMat: THREE.LineBasicMaterial }[] = []
  private readonly octaGeo: THREE.OctahedronGeometry
  private readonly octaEdgeGeo: THREE.EdgesGeometry
  private readonly callout: THREE.LineSegments
  private readonly calloutGeo: THREE.BufferGeometry
  private readonly calloutMat: THREE.LineBasicMaterial
  private readonly ownGeos: THREE.BufferGeometry[] = []
  /** Электронные облака внешнего уровня 4 частиц сюжета (школьная модель строения атома). */
  private readonly clouds: NaclCloudView
  /** Кольца-вспышки: отрыв электрона (Na) и захват (Cl). */
  private readonly rings: THREE.Sprite[] = []
  private readonly ringMats: THREE.SpriteMaterial[] = []
  /** Направление «окна» в облаке Cl — туда прилетает восьмой электрон (в плоскости кадра). */
  private readonly holeDir = new THREE.Vector3(Math.cos(NACL_CL_ARRIVE_ANGLE), Math.sin(NACL_CL_ARRIVE_ANGLE), 0)
  /** Куда тянется облако Na перед отрывом: касательная к пути электрона в начале. */
  private readonly stretchDir = NACL_ELECTRON_CURVES.map((c) => c.v1.clone().sub(c.v0).normalize())
  /** Видимость символов внутри шаров (плавно: шар заслонён другим — символ гаснет). */
  private readonly insideVis = new Float32Array(NACL_LABELS.length).fill(1)
  /** Экранные круги шаров: x, y, глубина, радиус (проективные единицы); 4 сюжета + 7 металла. */
  private readonly discs = new Float32Array((4 + NACL_METAL_REST.length) * 4)
  private lastDt = 1 / 60

  // ——— рабочие объекты (ноль аллокаций в кадре) ———
  private readonly _v = new THREE.Vector3()
  private readonly _w = new THREE.Vector3()
  private readonly _u = new THREE.Vector3()
  private readonly _m = new THREE.Matrix4()
  private readonly _m2 = new THREE.Matrix4()
  private readonly _q = new THREE.Quaternion()
  private readonly _e = new THREE.Euler(0, 0, 0, 'YXZ')
  private readonly _up = new THREE.Vector3(0, 1, 0)
  private readonly _lat = { grow: 0, travel: 0 }
  private readonly hStartPos = new THREE.Vector3()
  private readonly hStartQuat = new THREE.Quaternion()
  private readonly hStartScale = new THREE.Vector3()
  private readonly hEndPos = new THREE.Vector3()
  private readonly hEndQuat = new THREE.Quaternion()
  private readonly hEndScale = new THREE.Vector3()
  private readonly colorNaMetal = naclMetalColor()
  private readonly colorNaIon = new THREE.Color(cpkHex('Na'))
  private readonly colorClAtom = new THREE.Color(cpkHex('Cl')).multiplyScalar(0.82)
  private readonly colorClIon = new THREE.Color(cpkHex('Cl'))

  constructor(opts: NaclSceneOptions = {}) {
    this.opts = opts
    this.locale = opts.locale ?? 'ru'
    this.root.name = 'nacl-reaction-root'
    this.stage.name = 'nacl-stage'
    this.root.add(this.stage)
    this.geo = naclSphereGeometry(opts.lowPower)

    // ——— свет: мягкий ключевой, общий и слабая точка в центре действия ———
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

    // ——— частицы сюжета: 2 Na (сначала — вершины ячейки металла) и 2 Cl (молекула Cl₂) ———
    for (let i = 0; i < NACL_STORY.length; i++) {
      const na = NACL_STORY[i]!.el === 'Na'
      const mat: StoryMat = na
        ? withNaclRim(new THREE.MeshPhysicalMaterial({ color: this.colorNaMetal.clone(), ...NACL_MATTE_METAL, fog: false }), this.colorNaIon.clone().lerp(new THREE.Color(0xffffff), 0.35), NACL_RIM.metal)
        : withNaclRim(new THREE.MeshPhysicalMaterial({ color: this.colorClAtom.clone(), ...NACL_GLOSS, fog: false }), this.colorClIon.clone().lerp(new THREE.Color(0xffffff), 0.35), NACL_RIM.atom)
      const mesh = new THREE.Mesh(this.geo, mat)
      mesh.name = `nacl-${NACL_STORY[i]!.id}`
      this.story.push(mesh)
      this.storyMat.push(mat)
      this.stage.add(mesh)
    }

    // ——— металл: 7 атомов ячейки ОЦК, которые не уходят в реакцию, + рёбра ячейки ———
    this.metalMat = createNaclMetalMaterial(true)
    this.metalRest = new THREE.InstancedMesh(this.geo, this.metalMat, NACL_METAL_REST.length)
    this.metalRest.name = 'nacl-metal'
    this.metalRest.frustumCulled = false
    this.metalGroup.add(this.metalRest)
    const me = METAL_FRAG.cellEdges
    const mpos = new Float32Array(me.length * 6)
    // Рёбра ячейки доворачиваются тем же поворотом, что и её атомы (naclMetalPoint): куб виден
    // в трёхчетвертном ракурсе, а не вырожденным в квадрат.
    me.forEach(([p, q], i) => {
      const a0 = naclMetalPoint(p)
      const b0 = naclMetalPoint(q)
      mpos.set([a0[0], a0[1], a0[2], b0[0], b0[1], b0[2]], i * 6)
    })
    const metalEdgeGeo = new THREE.BufferGeometry()
    metalEdgeGeo.setAttribute('position', new THREE.BufferAttribute(mpos, 3))
    this.ownGeos.push(metalEdgeGeo)
    this.metalEdgeMat = new THREE.LineBasicMaterial({ color: NACL_EDGE_COLOR, transparent: true, opacity: 0, depthWrite: false, fog: false })
    this.metalEdges = new THREE.LineSegments(metalEdgeGeo, this.metalEdgeMat)
    this.metalGroup.add(this.metalEdges)
    this.stage.add(this.metalGroup)

    // ——— σ-связь Cl–Cl: ОДИН цилиндр (одинарная связь) ———
    this.bondGeo = new THREE.CylinderGeometry(1, 1, 1, 18, 1, true)
    this.ownGeos.push(this.bondGeo)
    this.bondMat = withNaclRim(new THREE.MeshPhysicalMaterial({ color: this.colorClAtom.clone().lerp(new THREE.Color(0xffffff), 0.25), ...NACL_GLOSS, transparent: true, fog: false }), 0xffffff, NACL_RIM.atom)
    this.bond = new THREE.Mesh(this.bondGeo, this.bondMat)
    this.bond.name = 'nacl-cl-cl'
    this.stage.add(this.bond)

    // ——— валентные точки Cl: 6 неподелённых + одиночный (из общей пары Cl–Cl) на каждый атом ———
    this.dotMat = new THREE.MeshBasicMaterial({ color: 0xcfefff, toneMapped: false, fog: false })
    this.dots = new THREE.InstancedMesh(this.geo, this.dotMat, 14)
    this.dots.name = 'nacl-valence'
    this.dots.frustumCulled = false
    this.stage.add(this.dots)

    // ——— электроны: яркое ядро + аддитивный ореол + след (подхватывает bloom хоста) ———
    this.electronMat = new THREE.MeshBasicMaterial({ color: ELECTRON_COLOR.clone().multiplyScalar(1.6), toneMapped: false, fog: false })
    const halo = naclHaloTexture()
    for (let k = 0; k < 2; k++) {
      const e = new THREE.Mesh(this.geo, this.electronMat)
      e.name = `nacl-electron-${k}`
      this.electrons.push(e)
      this.stage.add(e)
      const hm = new THREE.SpriteMaterial({ map: halo, color: ELECTRON_COLOR, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false, fog: false })
      const s = new THREE.Sprite(hm)
      s.renderOrder = 12
      this.halos.push(s)
      this.haloMats.push(hm)
      this.stage.add(s)
    }
    this.trailGeo = new THREE.BufferGeometry()
    this.trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_N * 2 * 3), 3))
    this.trailGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(TRAIL_N * 2 * 3), 3))
    this.ownGeos.push(this.trailGeo)
    this.trailMat = new THREE.PointsMaterial({ map: halo, size: 0.24, vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false, fog: false })
    this.trail = new THREE.Points(this.trailGeo, this.trailMat)
    this.trail.frustumCulled = false
    this.trail.renderOrder = 11
    this.stage.add(this.trail)

    // ——— электронные облака внешнего уровня и кольца-вспышки отрыва/захвата ———
    this.clouds = createNaclElectronClouds({ lowPower: opts.lowPower, color: ELECTRON_COLOR })
    this.stage.add(this.clouds.points)
    const ringTex = naclRingTexture()
    for (let i = 0; i < 4; i++) {
      const rm = new THREE.SpriteMaterial({ map: ringTex, color: ELECTRON_COLOR, blending: THREE.AdditiveBlending, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, fog: false })
      const ring = new THREE.Sprite(rm)
      ring.visible = false
      ring.renderOrder = 12
      this.rings.push(ring)
      this.ringMats.push(rm)
      this.stage.add(ring)
    }

    // ——— линии поля газовых пар (точки по дугам, без «палочки») ———
    const nField = 2 * FIELD_ARCS * FIELD_DOTS
    this.fieldGeo = new THREE.BufferGeometry()
    this.fieldGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nField * 3), 3))
    this.fieldGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(nField * 3), 3))
    this.ownGeos.push(this.fieldGeo)
    this.fieldMat = new THREE.PointsMaterial({ map: halo, size: 0.12, vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false, fog: false })
    this.field = new THREE.Points(this.fieldGeo, this.fieldMat)
    this.field.frustumCulled = false
    this.field.renderOrder = 10
    this.stage.add(this.field)

    // ——— размерные линии: газовая пара (stage) и ребро a (в системе решётки) ———
    const dimGeoGas = new THREE.BufferGeometry()
    dimGeoGas.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 6), 3))
    this.ownGeos.push(dimGeoGas)
    this.dimGasMat = new THREE.LineBasicMaterial({ color: DIM_COLOR, transparent: true, opacity: 0, depthWrite: false, fog: false })
    this.dimGas = new THREE.LineSegments(dimGeoGas, this.dimGasMat)
    this.dimGas.frustumCulled = false
    this.dimGas.renderOrder = 13
    this.stage.add(this.dimGas)

    // ——— решётка 2×2×2 ячейки (125 ионов): два InstancedMesh + рёбра ячеек (общий код с героем) ———
    this.lattice = createNaclLatticeView({ settled: false, lowPower: opts.lowPower })
    this.stage.add(this.lattice.group)

    const dimGeoA = new THREE.BufferGeometry()
    const { from, to, drop, tick } = NACL_DIM_A
    const y = from[1] - drop
    // Размерная линия ребра a: сама линия, две засечки и ДВЕ ВЫНОСНЫЕ линии от концов того самого
    // ребра нижнего переднего ряда — по кадру видно, какое ребро равно a.
    dimGeoA.setAttribute(
      'position',
      new THREE.BufferAttribute(
        new Float32Array([
          from[0], y, from[2], to[0], y, to[2],
          from[0], y - tick, from[2], from[0], y + tick, from[2],
          to[0], y - tick, to[2], to[0], y + tick, to[2],
          from[0], from[1], from[2], from[0], y + tick, from[2],
          to[0], to[1], to[2], to[0], y + tick, to[2],
        ]),
        3,
      ),
    )
    this.ownGeos.push(dimGeoA)
    this.dimAMat = new THREE.LineBasicMaterial({ color: DIM_COLOR, transparent: true, opacity: 0, depthWrite: false, fog: false })
    this.dimA = new THREE.LineSegments(dimGeoA, this.dimAMat)
    this.dimA.renderOrder = 13
    this.lattice.group.add(this.dimA)

    // ——— октаэдры КЧ 6:6: ЗАЛИВКА граней + мягкий контур того же цвета ———
    // Тонкие белые цилиндры-рёбра школьник читал как связи в решётке, где урок прямо пишет
    // «связей нет»: заливка с заметной альфой читается как МНОГОГРАННИК ОКРУЖЕНИЯ, а контур
    // взят цветом вершин и вполсилы — он обводит фигуру, а не рисует палочки между ионами.
    this.octaGeo = new THREE.OctahedronGeometry(1, 0)
    this.octaEdgeGeo = new THREE.EdgesGeometry(this.octaGeo)
    this.ownGeos.push(this.octaGeo, this.octaEdgeGeo)
    NACL_OCTA.forEach((o, k) => {
      const c = SALT_FRAG.sites[o.center]!.posScene
      // Грани окрашены по ВЕРШИНАМ: у Na⁺ вершины — Cl⁻ (зелёный), у Cl⁻ — Na⁺ (фиолетовый).
      const tint = new THREE.Color(cpkHex(o.el === 'Na' ? 'Cl' : 'Na'))
      const faceMat = new THREE.MeshBasicMaterial({ color: tint.clone().lerp(new THREE.Color(0xffffff), 0.3), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false })
      const edgeMat = new THREE.LineBasicMaterial({ color: tint.clone().lerp(new THREE.Color(0xffffff), 0.2), transparent: true, opacity: 0, depthWrite: false, fog: false })
      const faces = new THREE.Mesh(this.octaGeo, faceMat)
      const edges = new THREE.LineSegments(this.octaEdgeGeo, edgeMat)
      // Октаэдр вписан в 6 соседей: вершины OctahedronGeometry(1) лежат на осях — масштаб = расстояние
      // от центра до ближайшего соседа во фрагменте (d(Na⁺–Cl⁻) ядра, без чисел в сцене).
      const nb = SALT_FRAG.sites[NACL_OCTA_SHELLS[k]!.neighbors[0]!]!.posScene
      const s = Math.hypot(nb[0] - c[0], nb[1] - c[1], nb[2] - c[2])
      faces.position.set(c[0], c[1], c[2])
      edges.position.set(c[0], c[1], c[2])
      faces.scale.setScalar(s)
      edges.scale.setScalar(s)
      faces.renderOrder = 4
      edges.renderOrder = 5
      this.lattice.group.add(faces, edges)
      this.octa.push({ faces, edges, faceMat, edgeMat })
    })

    // ——— выноски «октаэдр → его подпись»: два отрезка прямо в системе root ———
    this.calloutGeo = new THREE.BufferGeometry()
    this.calloutGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NACL_OCTA.length * 6), 3))
    this.ownGeos.push(this.calloutGeo)
    this.calloutMat = new THREE.LineBasicMaterial({ color: CALLOUT_COLOR, transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false })
    this.callout = new THREE.LineSegments(this.calloutGeo, this.calloutMat)
    this.callout.name = 'nacl-octa-callout'
    this.callout.frustumCulled = false
    this.callout.renderOrder = 14
    this.callout.visible = false
    this.root.add(this.callout)

    this.labels = NACL_LABELS.map((l) => ({ id: `nacl-${l.id}`, kind: l.kind, pos: new THREE.Vector3(), opacity: 0, text: this.localize(l.keys[0]!.text) }))
    this.apply(0, true)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Машина состояний
  // ─────────────────────────────────────────────────────────────────────────

  /** Текущее время сюжета, с. */
  get time(): number {
    return this.clock.t
  }

  getState(): NaclSceneState {
    const s = NACL_STEPS[this.stepIndex]!
    const progress = Math.min(1, Math.max(0, (this.clock.t - s.from) / (s.to - s.from)))
    return { step: this.stepIndex, progress, playing: this.status === 'playing' || this.status === 'finishing', status: this.status, t: this.clock.t }
  }

  /**
   * Перейти к шагу index и сыграть его (с начала шага, если сейчас мы вне него; внутри шага —
   * доиграть). instant — сразу встать на конец шага (миниатюры, тесты). Текущий твин отменяется.
   */
  goToStep(index: number, opts: { instant?: boolean } = {}): Promise<void> {
    const i = Math.max(0, Math.min(NACL_STEPS.length - 1, index))
    const step = NACL_STEPS[i]!
    this.killTween()
    this.stepIndex = i
    this.opts.onStep?.(naclStepInfo(i, this.locale))
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

  /** Следующий шаг; после последнего — хвост сцены и контракт лаборатории (embryo → birth → complete). */
  next(): Promise<void> {
    if (this.status === 'finishing' || this.status === 'done') return Promise.resolve()
    if (this.stepIndex >= NACL_STEPS.length - 1 && this.status === 'paused') return this.finish()
    if (this.status === 'playing') return this.goToStep(this.stepIndex + 1)
    return this.goToStep(this.status === 'idle' ? 0 : this.stepIndex + 1)
  }

  prev(): Promise<void> {
    return this.goToStep(this.stepIndex - 1)
  }

  /** Повторить текущий шаг с начала. */
  replay(): Promise<void> {
    if (this.status === 'finishing' || this.status === 'done') return Promise.resolve()
    const step = NACL_STEPS[this.stepIndex]!
    this.killTween()
    const i = this.stepIndex
    this.seek(step.from)
    this.stepIndex = i
    this.setStatus('playing')
    return this.playTo(step.to, () => this.setStatus('paused'))
  }

  /** Доиграть хвост: подписи гаснут, решётка встаёт на место героя, события лаборатории. */
  finish(): Promise<void> {
    if (this.status === 'finishing' || this.status === 'done') return Promise.resolve()
    this.killTween()
    const lastTo = NACL_STEPS[NACL_STEPS.length - 1]!.to
    if (this.clock.t < lastTo - 1e-3) this.seek(lastTo)
    this.stepIndex = NACL_STEPS.length - 1
    this.setStatus('finishing')
    return this.playTo(NACL_END, () => this.setStatus('done'))
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

  /** Мгновенно встать на момент сюжета t (без твина). События между старым и новым t стреляют при движении вперёд. */
  seek(t: number): void {
    const c = Math.max(0, Math.min(NACL_END, t))
    if (c < this.clock.t) {
      this.lastCueT = c
      this.handoffCaptured = false
      this.latticeReleased = false
      this.lattice.group.visible = true
    }
    this.clock.t = c
    this.stepIndex = this.stepIndexFor(c)
    this.apply(c, true)
  }

  setLocale(locale: NaclLocale): void {
    this.locale = locale
    this.appliedT = NaN
  }

  /**
   * Объект, на место которого решётка встаёт в хвосте (герой продукта хоста). Его matrixWorld
   * читается каждый кадр хвоста: к кадру complete решётка совпадает с ним по положению,
   * масштабу и ориентации.
   */
  setHandoffTarget(target: THREE.Object3D | null): void {
    this.handoffTarget = target
  }

  /** Группа решётки сцены (для проверок передачи кадра хостом и в тестах). */
  get latticeObject(): THREE.Object3D {
    return this.lattice.group
  }

  /** Герой показан — решётку сцены выключаем (в кадре остаётся ровно одна решётка). */
  releaseLatticeToHero(): void {
    this.latticeReleased = true
    this.lattice.group.visible = false
  }

  /** Прогрев шейдеров ДО первого шага: все объекты видимы, compileAsync по root (без рывков). */
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
      /* прогрев — не критичный путь: урок стартует и без него */
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
    for (const m of this.storyMat) m.dispose()
    this.metalMat.dispose()
    this.metalEdgeMat.dispose()
    this.metalRest.dispose()
    this.bondMat.dispose()
    this.dotMat.dispose()
    this.dots.dispose()
    this.electronMat.dispose()
    for (const m of this.haloMats) m.dispose()
    this.trailMat.dispose()
    this.clouds.dispose()
    for (const m of this.ringMats) m.dispose()
    this.fieldMat.dispose()
    this.dimGasMat.dispose()
    this.dimAMat.dispose()
    this.calloutMat.dispose()
    for (const o of this.octa) {
      o.faceMat.dispose()
      o.edgeMat.dispose()
    }
    for (const g of this.ownGeos) g.dispose()
    this.lattice.dispose()
    if (!this.ownLights) {
      // Чужой свет не удаляем (см. опцию lights): гасим — число источников у хоста не меняется.
      this.lights.ambient.intensity = 0
      this.lights.key.intensity = 0
      this.lights.point.intensity = 0
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Кадр
  // ─────────────────────────────────────────────────────────────────────────

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
    const s = NACL_STEPS[this.stepIndex]!
    this.opts.onProgress?.(this.stepIndex, Math.min(1, Math.max(0, (t - s.from) / (s.to - s.from))))
  }

  // ——— внутреннее ———

  private localize(text: string): string {
    return localizeLabelText(text, this.locale, true)
  }

  private stepIndexFor(t: number): number {
    // Конец шага (пауза на границе) принадлежит этому шагу.
    for (let i = 0; i < NACL_STEPS.length; i++) if (t <= NACL_STEPS[i]!.to + 1e-6) return i
    return NACL_STEPS.length - 1
  }

  private setStatus(status: NaclStatus): void {
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

  /** События урока и контракт лаборатории: всё, что лежит в (прошлое t, t]. */
  private fireCues(t: number): void {
    if (t <= this.lastCueT) {
      this.lastCueT = Math.min(this.lastCueT, t)
      return
    }
    const from = this.lastCueT
    this.lastCueT = t
    for (let i = 0; i < NACL_CUES.length; i++) {
      const c = NACL_CUES[i]!
      if (c.at > from && c.at <= t) this.opts.onCue?.(c.id)
    }
  }

  /** Переносит состояние момента t в объекты three (без аллокаций). */
  private apply(t: number, force: boolean): void {
    if (!force && t === this.appliedT && this.state.handoff === 0) return
    this.appliedT = t
    const s = sampleNaclState(t, this.state)

    // ——— план кадра: группа stage (зум, поворот, центр действия) ———
    const shot = s.shot
    this._e.set(shot.pitch, shot.yaw, 0, 'YXZ')
    this.stage.quaternion.setFromEuler(this._e)
    this.stage.scale.setScalar(shot.zoom)
    this._v.copy(shot.target).applyQuaternion(this.stage.quaternion).multiplyScalar(-shot.zoom)
    this.stage.position.copy(this._v)

    // ——— частицы сюжета ———
    for (let i = 0; i < 4; i++) {
      const mesh = this.story[i]!
      const r = s.radius[i]! * s.appear
      mesh.visible = s.storyOn && r > 1e-4
      mesh.position.copy(s.pos[i]!)
      mesh.scale.setScalar(Math.max(1e-6, r))
      const mat = this.storyMat[i]!
      const m = s.morph[i]!
      const rim = mat.userData.rim
      if (i < 2) {
        // Na: матовый металл → глянцевый ион Na⁺ (clearcoat появляется только с поглощением).
        mat.color.copy(this.colorNaMetal).lerp(this.colorNaIon, m)
        mat.roughness = NACL_MATTE_METAL.roughness + (NACL_GLOSS.roughness - NACL_MATTE_METAL.roughness) * m
        mat.metalness = NACL_MATTE_METAL.metalness * (1 - m)
        mat.clearcoat = NACL_GLOSS.clearcoat * m
        mat.specularIntensity = NACL_MATTE_METAL.specularIntensity + (1 - NACL_MATTE_METAL.specularIntensity) * m
        rim.strength.value = NACL_RIM.metal + (NACL_RIM.ion - NACL_RIM.metal) * m + 0.5 * s.flash[i]!
      } else {
        mat.color.copy(this.colorClAtom).lerp(this.colorClIon, m)
        rim.strength.value = NACL_RIM.atom + (NACL_RIM.ion - NACL_RIM.atom) * m + 0.5 * s.flash[i]!
      }
    }

    // ——— металл: гаснет до нуля и выключается ———
    const mo = s.metal.opacity
    this.metalRest.visible = mo > 0.002
    this.metalMat.opacity = mo
    this.metalMat.depthWrite = mo > 0.98
    this.metalGroup.position.x = s.metal.shiftX
    const rMetal = NACL_R.na * s.appear
    for (let k = 0; k < NACL_METAL_REST.length; k++) {
      const p = naclMetalPos(NACL_METAL_REST[k]!)
      this._m.makeScale(rMetal, rMetal, rMetal).setPosition(p[0], p[1], p[2])
      this.metalRest.setMatrixAt(k, this._m)
    }
    this.metalRest.instanceMatrix.needsUpdate = true
    this.metalEdgeMat.opacity = 0.55 * s.metal.edges
    this.metalEdges.visible = s.metal.edges > 0.002

    // ——— σ-связь Cl–Cl ———
    const a = s.pos[I_CLA]!
    const b = s.pos[I_CLB]!
    this._w.copy(b).sub(a)
    const len = this._w.length()
    this.bond.visible = s.bond.opacity > 0.002
    this.bond.position.copy(a).add(b).multiplyScalar(0.5)
    if (len > 1e-6) this.bond.quaternion.setFromUnitVectors(this._up, this._w.multiplyScalar(1 / len))
    const br = 0.055 * (1 - 0.4 * s.bond.stretch)
    this.bond.scale.set(br, len, br)
    this.bondMat.opacity = s.bond.opacity

    // ——— валентные точки Cl ———
    for (let c = 0; c < 2; c++) {
      const ci = c === 0 ? I_CLA : I_CLB
      const center = s.pos[ci]!
      const r = s.radius[ci]!
      for (let k = 0; k < 7; k++) {
        const slot = c * 7 + k
        let sc = DOT_R * (k === 6 ? s.single : s.valence)
        if (k === 6) {
          // Одиночный электрон: в молекуле — половина общей пары посередине связи, после гомолиза — у своего атома.
          naclShellPoint(center, r, naclSingleAngle(ci, t), this._v)
          this._w.copy(a).add(b).multiplyScalar(0.5)
          this._w.x += c === 0 ? -0.055 : 0.055
          if (s.split < 1) this._v.lerp(this._w, 1 - s.split)
        } else {
          naclShellPoint(center, r, NACL_CL_DOT_ANGLES[k]!, this._v)
        }
        if (sc < 1e-5) sc = 0
        this._m.makeScale(sc, sc, sc).setPosition(this._v.x, this._v.y, this._v.z)
        this.dots.setMatrixAt(slot, this._m)
      }
    }
    this.dots.instanceMatrix.needsUpdate = true

    // ——— решётка: рост ионов, рёбра, октаэдры, размер a ———
    const g = NACL_T.grow
    const key = t < g.from - 0.05 ? -1 : t > Math.max(g.to, NACL_T.handover) + 0.05 ? 2 : t
    if (force || key !== this.lastLatticeKey) {
      this.lastLatticeKey = key
      for (let i = 0; i < SALT_FRAG.sites.length; i++) {
        naclLatticeIonAt(i, t, this._lat)
        const p = SALT_FRAG.sites[i]!.posScene
        const off = g.reach * (1 - this._lat.travel)
        const r = (SALT_FRAG.sites[i]!.el === 'Na' ? NACL_LATTICE_R.naIon : NACL_LATTICE_R.clIon) * this._lat.grow
        writeNaclSite(this.lattice, i, p[0] + NACL_LATTICE_DIR[i * 3]! * off, p[1] + NACL_LATTICE_DIR[i * 3 + 1]! * off, p[2] + NACL_LATTICE_DIR[i * 3 + 2]! * off, r)
      }
      this.lattice.na.instanceMatrix.needsUpdate = true
      this.lattice.cl.instanceMatrix.needsUpdate = true
    }
    // Рёбра ячеек на время показа октаэдра тоже приглушаются: иначе светлая сетка спорит с
    // многогранником окружения и тоже читается как «связи».
    this.lattice.edgeMaterial.opacity = 0.5 * s.saltEdges * (1 - 0.7 * s.octa)
    this.lattice.edges.visible = this.lattice.edgeMaterial.opacity > 0.002
    for (const o of this.octa) {
      o.faceMat.opacity = 0.5 * s.octa
      o.edgeMat.opacity = 0.75 * s.octa
      o.faces.visible = s.octa > 0.002
      o.edges.visible = s.octa > 0.002
    }
    this.applyOctaFocus(s.octa)
    this.dimAMat.opacity = 0.9 * s.dimA
    this.dimA.visible = s.dimA > 0.002

    // ——— размер газовой пары ———
    this.dimGasMat.opacity = 0.9 * s.dimGas
    this.dimGas.visible = s.dimGas > 0.002
    if (this.dimGas.visible) {
      const na = s.pos[NACL_PAIRS[0][0]]!
      const cl = s.pos[NACL_PAIRS[0][1]]!
      const y = Math.min(na.y, cl.y) - NACL_DIM_GAS_DROP
      const arr = (this.dimGas.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array
      const tk = 0.06
      arr[0] = na.x; arr[1] = y; arr[2] = na.z; arr[3] = cl.x; arr[4] = y; arr[5] = cl.z
      arr[6] = na.x; arr[7] = y - tk; arr[8] = na.z; arr[9] = na.x; arr[10] = y + tk; arr[11] = na.z
      arr[12] = cl.x; arr[13] = y - tk; arr[14] = cl.z; arr[15] = cl.x; arr[16] = y + tk; arr[17] = cl.z
      this.dimGas.geometry.getAttribute('position').needsUpdate = true
    }

    // ——— электронные облака внешнего уровня и кольца отрыва/захвата ———
    this.applyClouds(t, s)

    // ——— свет ———
    this.lights.ambient.intensity = LIGHT.ambient * s.light
    this.lights.key.intensity = LIGHT.key * s.light
    this.lights.point.intensity = LIGHT.point * s.light

    // ——— подписи: текст (локализация кэширована) и прозрачность ———
    for (let i = 0; i < this.labels.length; i++) {
      const l = this.labels[i]!
      l.opacity = s.labelOpacity[i]!
      l.text = this.localize(s.labelText[i]!)
    }
  }

  /**
   * Фокус октаэдров: ионы ВНЕ двух выделенных окружений гаснут до NACL_OCTA_DIM, шесть соседей и
   * центр каждого октаэдра остаются в полную яркость. Без этого шесть соседей терялись среди
   * сотен шаров и посчитать их было нельзя (приёмка: «октаэдр нечитаем»). Яркость пишется в
   * instanceColor и обновляется, только когда доля фокуса реально сменилась.
   */
  /**
   * Облака: появляются, когда атомы свободны (шаг 2), и уходят, когда пары встают в решётку.
   * Na: 1 e⁻ из 8 (редкое облако) → перед отрывом тянется к хлору и уходит с электроном → в кадр
   * захвата проявляется завершённый второй уровень Na⁺ (8 e⁻) по мере сжатия шара.
   * Cl: 7 из 8 — плотное облако с «окном» под восьмой электрон; окно закрывается в кадр захвата.
   */
  private applyClouds(t: number, s: NaclState): void {
    const T = NACL_T
    const cin = s.storyOn ? naclSmooth(T.valenceIn[0] - 0.5, T.valenceIn[1], t) * (1 - naclSmooth(T.toLattice[0], T.toLattice[0] + 0.6, t)) : 0
    this.clouds.points.visible = cin > 0.002
    for (let k = 0 as 0 | 1; k < 2; k = (k + 1) as 0 | 1) {
      const [di, ai] = NACL_PAIRS[k]!
      const e = T.e[k]!
      const stretch = naclSmooth(e.leave - T.windUp, e.leave, t) * (1 - naclSmooth(e.leave, e.leave + 0.6, t))
      const fillNa = t < e.arrive ? NACL_NA_OUTER_FILL * (1 - naclSmooth(e.leave, e.leave + 0.55, t)) : naclSmooth(e.arrive, e.arrive + T.morph + 0.35, t)
      this.clouds.set(di, s.pos[di]!, s.radius[di]! * s.appear, fillNa, cin * (1 + 1.2 * stretch + 0.6 * s.flash[di]!), 0, this.holeDir, stretch, this.stretchDir[k]!)
      const hole = 1 - naclSmooth(e.arrive - 0.12, e.arrive + 0.3, t)
      this.clouds.set(ai, s.pos[ai]!, s.radius[ai]! * s.appear, 1, cin * (0.85 + 0.9 * s.flash[ai]!), hole, this.holeDir, 0, this.stretchDir[k]!)
      // кольца: у Na — в кадр отрыва, у Cl — в кадр захвата
      for (const [idx, at, dur] of [[di, e.leave, 0.6], [ai, e.arrive, 0.75]] as const) {
        const pr = (t - at) / dur
        const ring = this.rings[idx]!
        ring.visible = s.storyOn && pr >= 0 && pr < 1
        if (!ring.visible) continue
        const r = s.radius[idx]! * s.appear
        ring.position.copy(s.pos[idx]!)
        ring.scale.setScalar(2 * r * (1.1 + 1.5 * pr))
        this.ringMats[idx]!.opacity = 0.8 * Math.pow(1 - pr, 1.5)
      }
    }
  }

  private applyOctaFocus(amount: number): void {
    const k = Math.round(amount * 100) / 100
    if (k === this.octaFocus) return
    this.octaFocus = k
    const dim = 1 - (1 - NACL_OCTA_DIM) * k
    for (let i = 0; i < SALT_FRAG.sites.length; i++) setNaclSiteTint(this.lattice, i, this.octaFocusSites.has(i) ? 1 : dim)
    this.lattice.na.instanceColor!.needsUpdate = true
    this.lattice.cl.instanceColor!.needsUpdate = true
  }

  /** То, что живёт и на паузе: электрон, след, линии поля, облёт, передача герою, подписи. */
  private animate(camera: THREE.Camera): void {
    const s = this.state

    // ——— электроны: ядро, ореол, след по кривой Безье ———
    const tp = (this.trailGeo.getAttribute('position') as THREE.BufferAttribute).array as Float32Array
    const tc = (this.trailGeo.getAttribute('color') as THREE.BufferAttribute).array as Float32Array
    let trailCount = 0
    for (let k = 0 as 0 | 1; k < 2; k = (k + 1) as 0 | 1) {
      const el = s.electrons[k]
      const mesh = this.electrons[k]!
      const halo = this.halos[k]!
      const on = el.amount > 1e-3
      mesh.visible = on
      halo.visible = on && el.glow > 1e-3
      mesh.position.copy(el.pos)
      const pulse = 1 + 0.12 * Math.sin(this.visual * 9 + k)
      mesh.scale.setScalar((el.phase === 'flying' ? ELECTRON_R : DOT_R * (1 + 0.5 * el.glow)) * el.amount)
      halo.position.copy(el.pos)
      halo.scale.setScalar(0.75 * el.glow * pulse)
      this.haloMats[k]!.opacity = 0.85 * el.glow
      if (el.phase === 'flying') {
        const curve = NACL_ELECTRON_CURVES[k]
        for (let j = 1; j <= TRAIL_N; j++) {
          const u = el.u - j * 0.028
          if (u <= 0) break
          curve.getPoint(u, this._v)
          const o = trailCount * 3
          tp[o] = this._v.x
          tp[o + 1] = this._v.y
          tp[o + 2] = this._v.z
          const f = (1 - j / (TRAIL_N + 1)) * 0.8
          tc[o] = ELECTRON_COLOR.r * f
          tc[o + 1] = ELECTRON_COLOR.g * f
          tc[o + 2] = ELECTRON_COLOR.b * f
          trailCount++
        }
      }
    }
    this.trailGeo.setDrawRange(0, trailCount)
    this.trail.visible = trailCount > 0
    if (trailCount > 0) {
      this.trailGeo.getAttribute('position').needsUpdate = true
      this.trailGeo.getAttribute('color').needsUpdate = true
    }

    this.clouds.frame(this.visual, this.pxPerProjUnit())

    // ——— линии поля: точки текут от Na⁺ к Cl⁻ по дугам над и под парой ———
    const fp = (this.fieldGeo.getAttribute('position') as THREE.BufferAttribute).array as Float32Array
    const fc = (this.fieldGeo.getAttribute('color') as THREE.BufferAttribute).array as Float32Array
    const fa = s.field
    let n = 0
    if (fa > 0.002) {
      const rCl = s.radius[I_CLA]!
      for (let p = 0; p < 2; p++) {
        const na = s.pos[NACL_PAIRS[p]![0]]!
        const cl = s.pos[NACL_PAIRS[p]![1]]!
        const mx = (na.x + cl.x) / 2
        const my = (na.y + cl.y) / 2
        const half = Math.abs(cl.x - na.x) / 2
        for (let arc = 0; arc < FIELD_ARCS; arc++) {
          const side = arc % 2 === 0 ? 1 : -1
          const h = rCl * (arc < 2 ? 1.25 : 1.75)
          const ax = half + rCl * (arc < 2 ? 0.6 : 0.9)
          for (let j = 0; j < FIELD_DOTS; j++) {
            const ph = (j + ((this.visual * 0.6) % 1)) / FIELD_DOTS
            const phi = Math.PI * ph
            const o = n * 3
            fp[o] = mx - Math.cos(phi) * ax
            fp[o + 1] = my + side * Math.sin(phi) * h
            fp[o + 2] = na.z
            const f = fa * (0.55 + 0.85 * Math.sin(phi))
            fc[o] = FIELD_COLOR.r * f
            fc[o + 1] = FIELD_COLOR.g * f
            fc[o + 2] = FIELD_COLOR.b * f
            n++
          }
        }
      }
      this.fieldGeo.getAttribute('position').needsUpdate = true
      this.fieldGeo.getAttribute('color').needsUpdate = true
    }
    this.fieldGeo.setDrawRange(0, n)
    this.field.visible = n > 0

    // ——— облёт и передача кадра герою ———
    this.root.updateMatrixWorld(true)
    const lg = this.lattice.group
    if (s.handoff > 0 && this.handoffTarget) {
      const parent = this.stage
      if (!this.handoffCaptured) {
        lg.updateMatrixWorld(true)
        lg.matrixWorld.decompose(this.hStartPos, this.hStartQuat, this.hStartScale)
        this.handoffCaptured = true
      }
      this.handoffTarget.updateWorldMatrix(true, false)
      this.handoffTarget.matrixWorld.decompose(this.hEndPos, this.hEndQuat, this.hEndScale)
      const u = s.handoff
      this._v.copy(this.hStartPos).lerp(this.hEndPos, u)
      this._q.copy(this.hStartQuat).slerp(this.hEndQuat, u)
      this._w.copy(this.hStartScale).lerp(this.hEndScale, u)
      this._m.compose(this._v, this._q, this._w)
      this._m2.copy(parent.matrixWorld).invert()
      // Матрица решётки задана напрямую (мир героя → система stage), position/rotation не участвуют.
      lg.matrixAutoUpdate = false
      lg.matrix.multiplyMatrices(this._m2, this._m)
      lg.matrixWorldNeedsUpdate = true
    } else {
      if (s.handoff === 0) this.handoffCaptured = false
      lg.matrixAutoUpdate = true
      lg.position.set(0, 0, 0)
      lg.rotation.set(0, s.spin, 0)
      lg.updateMatrix()
    }
    lg.visible = !this.latticeReleased

    // Камера в системе root — она же система экрана: адаптер ставит root.quaternion = camera.quaternion,
    // поэтому локальные X и Y корня идут по экрану вправо и вверх, а Z — на зрителя.
    this._u.setFromMatrixPosition(camera.matrixWorld)
    this.root.worldToLocal(this._u)

    // ——— точка света следует за центром действия, чуть ближе к зрителю ———
    const lp = this.lights.point.position
    lp.copy(s.shot.target).applyMatrix4(this.stage.matrix)
    this._w.copy(this._u).sub(lp)
    const dl = this._w.length()
    if (dl > 1e-6) lp.addScaledVector(this._w, Math.min(1.6, dl * 0.3) / dl)
    // Чужой свет живёт в сцене хоста, а не в root: переводим позицию в мир.
    if (!this.ownLights) this.root.localToWorld(lp)

    // ——— экранный габарит решётки: за него выносятся подписи шагов 5–6 ———
    this.measureLatticeSpan(lg)

    // ——— позиции подписей (в системе root) ———
    for (let i = 0; i < NACL_LABELS.length; i++) {
      const def = NACL_LABELS[i]!
      const l = this.labels[i]!
      if (l.opacity <= 0) continue
      const an = def.anchor
      const p = l.pos
      switch (an.kind) {
        case 'octa': {
          // Центр октаэдра в системе root (он едет с облётом) — от него пойдёт выноска.
          const c = SALT_FRAG.sites[NACL_OCTA[an.index]!.center]!.posScene
          p.set(c[0], c[1], c[2]).applyMatrix4(lg.matrix).applyMatrix4(this.stage.matrix)
          break
        }
        case 'story': {
          const c = s.pos[an.index]!
          p.set(c.x, c.y + an.side * (s.radius[an.index]! + 0.2), c.z).applyMatrix4(this.stage.matrix)
          break
        }
        case 'inside':
          p.copy(s.pos[an.index]!).applyMatrix4(this.stage.matrix)
          break
        case 'metalAtom': {
          const mp = naclMetalPos(NACL_METAL_REST[an.index]!)
          p.set(mp[0] + s.metal.shiftX, mp[1], mp[2]).applyMatrix4(this.stage.matrix)
          break
        }
        case 'electron':
          p.copy(s.electrons[an.index].pos)
          p.y += an.index === 0 ? 0.2 : -0.2
          p.applyMatrix4(this.stage.matrix)
          break
        case 'stage':
          p.set(an.p[0], an.p[1], an.p[2]).applyMatrix4(this.stage.matrix)
          break
        case 'lattice':
          p.set(an.p[0], an.p[1], an.p[2]).applyMatrix4(lg.matrix).applyMatrix4(this.stage.matrix)
          break
        case 'metal':
          p.set(NACL_METAL_CENTER[0] + s.metal.shiftX, NACL_METAL_CENTER[1] + 1.12, NACL_METAL_CENTER[2]).applyMatrix4(this.stage.matrix)
          break
        case 'cl2':
          p.set(NACL_CL2_CENTER[0], NACL_CL2_CENTER[1] + NACL_R.cl + 0.62, NACL_CL2_CENTER[2]).applyMatrix4(this.stage.matrix)
          break
        case 'clBond':
          p.set(NACL_CL2_CENTER[0] + NACL_R.cl + 0.5, NACL_CL2_CENTER[1], NACL_CL2_CENTER[2]).applyMatrix4(this.stage.matrix)
          break
        case 'gasPair': {
          const na = s.pos[NACL_PAIRS[0][0]]!
          const cl = s.pos[NACL_PAIRS[0][1]]!
          p.set((na.x + cl.x) / 2, Math.min(na.y, cl.y) - NACL_DIM_GAS_DROP - 0.16, na.z).applyMatrix4(this.stage.matrix)
          break
        }
      }
      if (an.kind === 'octa') this.placeOutside(l, { side: an.dir < 0 ? 'left' : 'right' })
      else if (def.outside) this.placeOutside(l, def.outside)
    }

    this.applyInsideLabels()
    // ——— выноски к октаэдрам: от центра фигуры к её подписи ———
    this.writeCallouts(lg)
  }

  /**
   * Экранный габарит решётки в ПРОЕКТИВНЫХ единицах (тангенсах углов от оси камеры): 8 вершин
   * рамки фрагмента, расширенной на радиус самого крупного иона, с честным делением на глубину.
   * Система root повёрнута по камере, поэтому её X и Y — оси экрана.
   */
  private measureLatticeSpan(lg: THREE.Object3D): void {
    const sp = this.span
    sp.ready = false
    if (!lg.visible) return
    this._m.multiplyMatrices(this.stage.matrix, lg.matrix)
    const c = this._u
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (let i = 0; i < 8; i++) {
      const q = LATTICE_CORNERS[i]!
      this._v.set(q[0], q[1], q[2]).applyMatrix4(this._m)
      const d = c.z - this._v.z
      if (d < 1e-3) return
      const x = (this._v.x - c.x) / d
      const y = (this._v.y - c.y) / d
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
    sp.minX = minX
    sp.maxX = maxX
    sp.minY = minY
    sp.maxY = maxY
    sp.ready = true
  }

  /**
   * Вынести подпись за силуэт решётки. Запас считается в ПИКСЕЛЯХ (размер плашки оценивает
   * core/labelLayout, как и слой подписей) и переводится в проективные единицы по высоте канвы и
   * углу обзора — поэтому на 390 px запас такой же честный, как на 1280.
   */
  private placeOutside(l: NaclSceneLabel, rule: NaclLabelOutside): void {
    const sp = this.span
    if (!sp.ready) return
    const c = this._u
    const d = c.z - l.pos.z
    if (d < 1e-3) return
    estimateLabelSize(l.kind, l.text, 1, _labelSize)
    const perUnit = this.pxPerProjUnit()
    const padX = (_labelSize.w / 2 + 12) / perUnit
    const padY = (_labelSize.h / 2 + 10) / perUnit
    const rowH = (_labelSize.h + 8) / perUnit
    const row = rule.row ?? 0
    let x = (l.pos.x - c.x) / d
    let y = (l.pos.y - c.y) / d
    if (rule.side === 'above') {
      x = (sp.minX + sp.maxX) / 2
      y = sp.maxY + padY + row * rowH
    } else if (rule.side === 'below') {
      x = (sp.minX + sp.maxX) / 2
      y = sp.minY - padY - row * rowH
    } else if (rule.side === 'left') {
      x = sp.minX - padX
      y = Math.min(Math.max(y, sp.minY), sp.maxY)
    } else {
      x = sp.maxX + padX
      y = Math.min(Math.max(y, sp.minY), sp.maxY)
    }
    l.pos.x = c.x + x * d
    l.pos.y = c.y + y * d
  }

  /** Пикселей канвы на проективную единицу (тангенс угла): h / (2 tg(fov/2)). */
  private pxPerProjUnit(): number {
    return this.viewportH / (2 * Math.tan((this.viewportFov * Math.PI) / 360))
  }

  /**
   * Высота канвы и угол обзора хоста — только для перевода запаса подписей из пикселей в
   * проективные единицы (см. placeOutside). Хост зовёт это в кадре; по умолчанию — типичный кадр.
   */
  setViewport(heightPx: number, fovDeg: number): void {
    if (heightPx > 1) this.viewportH = heightPx
    if (fovDeg > 1) this.viewportFov = fovDeg
  }

  /**
   * Символ внутри шара виден, только если шар на экране достаточно крупный (радиус от ~12 px) и его
   * центр не заслонён более близким шаром (задние атомы ячейки металла): иначе DOM-надпись легла бы
   * на чужой шар. Экранные круги — в проективных единицах системы root (она повёрнута по камере).
   */
  private applyInsideLabels(): void {
    const s = this.state
    const cam = this._u
    const zoom = this.stage.scale.x
    const px = this.pxPerProjUnit()
    const D = this.discs
    const nStory = 4
    const put = (j: number, x: number, y: number, z: number, r: number, on: boolean) => {
      const o = j * 4
      const depth = cam.z - z
      if (!on || depth < 0.02 || r <= 0) {
        D[o + 2] = -1
        return
      }
      D[o] = (x - cam.x) / depth
      D[o + 1] = (y - cam.y) / depth
      D[o + 2] = depth
      D[o + 3] = r / depth
    }
    for (let i = 0; i < nStory; i++) {
      this._v.copy(s.pos[i]!).applyMatrix4(this.stage.matrix)
      put(i, this._v.x, this._v.y, this._v.z, s.radius[i]! * s.appear * zoom, this.story[i]!.visible)
    }
    for (let k = 0; k < NACL_METAL_REST.length; k++) {
      const mp = naclMetalPos(NACL_METAL_REST[k]!)
      this._v.set(mp[0] + s.metal.shiftX, mp[1], mp[2]).applyMatrix4(this.stage.matrix)
      put(nStory + k, this._v.x, this._v.y, this._v.z, NACL_R.na * s.appear * zoom, this.metalRest.visible)
    }
    const nDisc = D.length / 4
    const blend = Math.min(1, this.lastDt * 12)
    for (let i = 0; i < NACL_LABELS.length; i++) {
      const an = NACL_LABELS[i]!.anchor
      if (an.kind !== 'inside' && an.kind !== 'metalAtom') continue
      const own = an.kind === 'inside' ? an.index : nStory + an.index
      const o = own * 4
      let target = 0
      if (D[o + 2]! > 0) {
        target = naclSmooth(11, 16, D[o + 3]! * px)
        for (let j = 0; j < nDisc && target > 0; j++) {
          if (j === own) continue
          const q = j * 4
          if (!(D[q + 2]! > 0) || D[q + 2]! >= D[o + 2]!) continue
          if (Math.hypot(D[o]! - D[q]!, D[o + 1]! - D[q + 1]!) < 0.8 * D[q + 3]!) target = 0
        }
      }
      this.insideVis[i] = this.insideVis[i]! + (target - this.insideVis[i]!) * blend
      this.labels[i]!.opacity = s.labelOpacity[i]! * this.insideVis[i]!
    }
  }

  /** Выноска от центра каждого октаэдра к его подписи (обе точки — в системе root). */
  private writeCallouts(lg: THREE.Object3D): void {
    const op = this.labels[this.octaLabelIndex[0]!]?.opacity ?? 0
    this.calloutMat.opacity = 0.8 * op
    this.callout.visible = op > 0.01
    if (!this.callout.visible) return
    const arr = (this.calloutGeo.getAttribute('position') as THREE.BufferAttribute).array as Float32Array
    for (let k = 0; k < NACL_OCTA.length; k++) {
      const c = SALT_FRAG.sites[NACL_OCTA[k]!.center]!.posScene
      this._v.set(c[0], c[1], c[2]).applyMatrix4(lg.matrix).applyMatrix4(this.stage.matrix)
      const lab = this.labels[this.octaLabelIndex[k]!]!
      const o = k * 6
      arr[o] = this._v.x
      arr[o + 1] = this._v.y
      arr[o + 2] = this._v.z
      arr[o + 3] = lab.pos.x
      arr[o + 4] = lab.pos.y
      arr[o + 5] = lab.pos.z
    }
    this.calloutGeo.getAttribute('position').needsUpdate = true
  }
}
