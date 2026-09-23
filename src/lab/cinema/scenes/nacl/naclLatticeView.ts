import * as THREE from 'three'
import { cpkHex } from '../kit/cpkAtoms'
import { NACL_LATTICE_R, SALT_FRAG } from './naclModel'

/**
 * Решётка NaCl и материалы сцены — ОБЩИЕ для сцены урока и героя продукта.
 *
 * Сцена кончается той же решёткой, которую потом показывает герой (hero/HeroStructureView для
 * nacl): тот же фрагмент (heroStructures.cells), те же шары, материалы и рёбра. Поэтому передача
 * кадра «сцена → герой» не видна: в кадр поглощения решётки сцены герой стоит ровно на её месте и
 * выглядит так же (одна программа шейдера, одна геометрия — та уже загружена в GPU сценой).
 *
 * Материалы:
 *   • ионы Na⁺/Cl⁻ и Cl₂ — MeshPhysicalMaterial, глянец (roughness 0,2, clearcoat 0,5,
 *     clearcoatRoughness 0,15), свечение по краям — ФРЕНЕЛЕВСКАЯ ЭМИССИЯ, добавленная в шейдер
 *     (onBeforeCompile). Transmission не используется: на сотнях сфер он требует отдельного прохода
 *     рендера сцены в текстуру и роняет кадр ниже 60 FPS;
 *   • металлический натрий — МАТОВЫЙ: без clearcoat, шероховатость 0,7, лёгкая металличность,
 *     без карты окружения — никаких полос-отражений «горизонта»;
 *   • цвета — CPK ядра (Na фиолетовый, Cl зелёный).
 * Туман сцены на материалы не действует (fog: false): вид решётки не зависит от того, чей туман
 * включён — сцены или лаборатории.
 */

// ─── Геометрии (кэш модуля: одна на сцену и героя) ───

let sphereHi: THREE.SphereGeometry | null = null
let sphereLo: THREE.SphereGeometry | null = null

/** Единичная сфера (масштаб = радиус шара). Живёт весь сеанс — её делят сцена и герой. */
export function naclSphereGeometry(lowPower = false): THREE.SphereGeometry {
  if (lowPower) return (sphereLo ??= new THREE.SphereGeometry(1, 18, 12))
  return (sphereHi ??= new THREE.SphereGeometry(1, 30, 20))
}

let edgeGeo: THREE.BufferGeometry | null = null

/** Рёбра элементарных ячеек фрагмента (отрезки), общие для сцены и героя. */
export function naclCellEdgeGeometry(): THREE.BufferGeometry {
  if (edgeGeo) return edgeGeo
  const edges = SALT_FRAG.cellEdges
  const pos = new Float32Array(edges.length * 6)
  edges.forEach(([p, q], i) => {
    pos.set([p[0], p[1], p[2], q[0], q[1], q[2]], i * 6)
  })
  edgeGeo = new THREE.BufferGeometry()
  edgeGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  return edgeGeo
}

// ─── Френелевская кромка ───

export type NaclRim = { color: { value: THREE.Color }; strength: { value: number }; power: { value: number } }

/**
 * Добавляет к эмиссии кромку по Френелю: ярче там, где поверхность уходит от взгляда.
 * Ключ программы один на все материалы с кромкой — общий шейдер у сцены и героя.
 */
export function withNaclRim<M extends THREE.MeshPhysicalMaterial>(mat: M, color: THREE.ColorRepresentation, strength: number, power = 2.6): M & { userData: { rim: NaclRim } } {
  const rim: NaclRim = { color: { value: new THREE.Color(color) }, strength: { value: strength }, power: { value: power } }
  mat.userData.rim = rim
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uRimColor = rim.color
    shader.uniforms.uRimStrength = rim.strength
    shader.uniforms.uRimPower = rim.power
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRimColor;\nuniform float uRimStrength;\nuniform float uRimPower;')
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n{\n  float rimF = 1.0 - saturate( dot( normalize( normal ), normalize( vViewPosition ) ) );\n  totalEmissiveRadiance += uRimColor * ( uRimStrength * pow( rimF, uRimPower ) );\n}',
      )
  }
  mat.customProgramCacheKey = () => 'nacl-rim-1'
  return mat as M & { userData: { rim: NaclRim } }
}

/** Параметры глянца ионов (ТЗ: roughness 0,2, clearcoat 0,5, clearcoatRoughness 0,15). */
export const NACL_GLOSS = { roughness: 0.2, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.15 } as const
/** Матовый металл: без clearcoat, высокая шероховатость, лёгкая металличность, приглушённый блик. */
export const NACL_MATTE_METAL = { roughness: 0.7, metalness: 0.22, clearcoat: 0, clearcoatRoughness: 0.15, specularIntensity: 0.45 } as const

/** Сила кромки у иона и у нейтрального атома/металла. */
export const NACL_RIM = { ion: 0.34, atom: 0.12, metal: 0.05 } as const

/** Материал иона решётки (Na⁺ или Cl⁻). */
export function createNaclIonMaterial(el: 'Na' | 'Cl'): THREE.MeshPhysicalMaterial & { userData: { rim: NaclRim } } {
  const color = new THREE.Color(cpkHex(el))
  const mat = new THREE.MeshPhysicalMaterial({
    color,
    ...NACL_GLOSS,
    fog: false,
  })
  return withNaclRim(mat, color.clone().lerp(new THREE.Color(0xffffff), 0.35), NACL_RIM.ion)
}

/** Матовый металлический натрий (для прозрачного затухания ячейки — transparent). */
export function createNaclMetalMaterial(transparent: boolean): THREE.MeshPhysicalMaterial & { userData: { rim: NaclRim } } {
  const color = naclMetalColor()
  const mat = new THREE.MeshPhysicalMaterial({
    color,
    ...NACL_MATTE_METAL,
    transparent,
    fog: false,
  })
  return withNaclRim(mat, color.clone().lerp(new THREE.Color(0xffffff), 0.3), NACL_RIM.metal)
}

/** Цвет металла: CPK натрия, чуть приглушённый к серому — фиолетовый узнаётся. */
export function naclMetalColor(): THREE.Color {
  return new THREE.Color(cpkHex('Na')).lerp(new THREE.Color(0x9aa0b4), 0.28)
}

/** Цвет рёбер ячеек. */
export const NACL_EDGE_COLOR = 0xa9d8ff

// ─── Решётка ───

export type NaclLatticeView = {
  group: THREE.Group
  na: THREE.InstancedMesh
  cl: THREE.InstancedMesh
  edges: THREE.LineSegments
  edgeMaterial: THREE.LineBasicMaterial
  /** узел фрагмента для инстанса: naSites[k] — индекс узла k-го Na⁺ */
  naSites: number[]
  clSites: number[]
  /** инстанс узла фрагмента: [меш 0 — Na, 1 — Cl, индекс] */
  instanceOf: Int32Array
  dispose(): void
}

/**
 * Яркость инстанса узла (1 — обычный ион, меньше — приглушённый). Нужна шагу 5: на время показа
 * координационного октаэдра остальные ионы гаснут, и шесть соседей выделенного иона стоят в
 * чистом поле — иначе октаэдр теряется среди сотен шаров.
 *
 * Атрибут instanceColor создаётся ВСЕГДА (и у героя тоже, весь белый): ключ программы шейдера у
 * сцены и героя обязан совпадать, иначе передача кадра компилировала бы новую программу.
 */
export function setNaclSiteTint(view: NaclLatticeView, siteIndex: number, k: number): void {
  const mesh = view.instanceOf[siteIndex * 2] === 0 ? view.na : view.cl
  const i = view.instanceOf[siteIndex * 2 + 1]!
  const arr = mesh.instanceColor!.array as Float32Array
  arr[i * 3] = k
  arr[i * 3 + 1] = k
  arr[i * 3 + 2] = k
}

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()

/** Пишет инстанс узла siteIndex: позиция (x, y, z), радиус шара r (0 — скрыт). Без аллокаций. */
export function writeNaclSite(view: NaclLatticeView, siteIndex: number, x: number, y: number, z: number, r: number): void {
  const mesh = view.instanceOf[siteIndex * 2] === 0 ? view.na : view.cl
  const k = view.instanceOf[siteIndex * 2 + 1]!
  _p.set(x, y, z)
  _s.set(r, r, r)
  _m.compose(_p, _q, _s)
  mesh.setMatrixAt(k, _m)
}

/**
 * Решётка каменной соли из фрагмента ядра: два InstancedMesh (Na⁺ и Cl⁻, общая геометрия) и рёбра
 * ячеек. `settled` — все ионы сразу на местах (герой); иначе шары нулевые, их растит сцена.
 */
export function createNaclLatticeView(opts: { settled: boolean; lowPower?: boolean }): NaclLatticeView {
  const sites = SALT_FRAG.sites
  const naSites: number[] = []
  const clSites: number[] = []
  const instanceOf = new Int32Array(sites.length * 2)
  sites.forEach((s, i) => {
    if (s.el === 'Na') {
      instanceOf[i * 2] = 0
      instanceOf[i * 2 + 1] = naSites.length
      naSites.push(i)
    } else {
      instanceOf[i * 2] = 1
      instanceOf[i * 2 + 1] = clSites.length
      clSites.push(i)
    }
  })
  const geo = naclSphereGeometry(opts.lowPower)
  const naMat = createNaclIonMaterial('Na')
  const clMat = createNaclIonMaterial('Cl')
  const na = new THREE.InstancedMesh(geo, naMat, naSites.length)
  const cl = new THREE.InstancedMesh(geo, clMat, clSites.length)
  na.name = 'nacl-lattice-na'
  cl.name = 'nacl-lattice-cl'
  na.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(naSites.length * 3).fill(1), 3)
  cl.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(clSites.length * 3).fill(1), 3)
  // Рамка инстансов меняется при росте — отсечение по сфере геометрии не годится.
  na.frustumCulled = false
  cl.frustumCulled = false
  const edgeMaterial = new THREE.LineBasicMaterial({ color: NACL_EDGE_COLOR, transparent: true, opacity: 0.5, depthWrite: false, fog: false })
  const edges = new THREE.LineSegments(naclCellEdgeGeometry(), edgeMaterial)
  edges.name = 'nacl-cell-edges'
  edges.renderOrder = 1
  const group = new THREE.Group()
  group.name = 'nacl-lattice'
  group.add(na, cl, edges)

  const view: NaclLatticeView = {
    group,
    na,
    cl,
    edges,
    edgeMaterial,
    naSites,
    clSites,
    instanceOf,
    dispose() {
      naMat.dispose()
      clMat.dispose()
      edgeMaterial.dispose()
      na.dispose()
      cl.dispose()
      // Геометрии — кэш модуля (их делят сцена и герой), здесь не освобождаются.
    },
  }
  sites.forEach((s, i) => {
    const r = opts.settled ? (s.el === 'Na' ? NACL_LATTICE_R.naIon : NACL_LATTICE_R.clIon) : 0
    writeNaclSite(view, i, s.posScene[0], s.posScene[1], s.posScene[2], r)
  })
  na.instanceMatrix.needsUpdate = true
  cl.instanceMatrix.needsUpdate = true
  if (!opts.settled) edgeMaterial.opacity = 0
  return view
}

// ─── Заготовка героя: создаётся и прогревается сценой урока ДО cue embryo ───

let prebuilt: { view: NaclLatticeView; lowPower: boolean } | null = null

/**
 * Решётка героя, собранная заранее (сцена урока кладёт её в свой прогрев шейдеров). Тогда в кадр
 * embryo, когда лаборатория монтирует героя, не создаётся ни одного буфера и материала и не
 * компилируется ни одна программа — герой берёт готовое (takeNaclHeroView).
 */
export function prebuildNaclHeroView(lowPower = false): NaclLatticeView {
  if (prebuilt && prebuilt.lowPower === lowPower) return prebuilt.view
  prebuilt?.view.dispose()
  prebuilt = { view: createNaclLatticeView({ settled: true, lowPower }), lowPower }
  return prebuilt.view
}

/**
 * Забрать заготовку (один раз); null — заготовки нет, герой собирает решётку сам. Заготовка берётся
 * с детализацией СЦЕНЫ (не героя): на передаче кадра шары обязаны совпасть с решёткой сцены.
 */
export function takeNaclHeroView(): NaclLatticeView | null {
  if (!prebuilt) return null
  const v = prebuilt.view
  prebuilt = null
  v.group.removeFromParent()
  v.group.traverse((o) => o.layers.set(0))
  return v
}

// ─── Ореол электрона (текстура без canvas: работает и в Node-тесте) ───

let haloTex: THREE.DataTexture | null = null

/** Радиальный ореол 64×64: яркий центр, мягкий спад к краю. */
export function naclHaloTexture(): THREE.DataTexture {
  if (haloTex) return haloTex
  const n = 64
  const data = new Uint8Array(n * n * 4)
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = (x + 0.5) / n - 0.5
      const dy = (y + 0.5) / n - 0.5
      const r = Math.min(1, Math.hypot(dx, dy) * 2)
      const a = Math.pow(1 - r, 2.2)
      const o = (y * n + x) * 4
      data[o] = 255
      data[o + 1] = 255
      data[o + 2] = 255
      data[o + 3] = Math.round(a * 255)
    }
  }
  haloTex = new THREE.DataTexture(data, n, n, THREE.RGBAFormat)
  haloTex.magFilter = THREE.LinearFilter
  haloTex.minFilter = THREE.LinearFilter
  haloTex.needsUpdate = true
  return haloTex
}
