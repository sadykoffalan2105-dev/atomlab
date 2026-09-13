import * as THREE from 'three'

/**
 * ATOMLAB Cinema — окружение «лабораторный софтбокс».
 *
 * Вместо точечных источников (каждый меняет ключ шейдера и умножает стоимость
 * фрагмента) весь свет сцены — это окружение из нескольких светящихся панелей:
 *   • тёплый ключ сверху-спереди-слева;
 *   • холодный циановый контровой сзади-справа;
 *   • тёмный пол и слабый холодный верх.
 *
 * Из одного и того же описания панелей строятся ДВА представления:
 *   1) PMREM (cubeUV-текстура) — для scene.environment, стандартные материалы
 *      получают честные отражения. Строится один раз на WebGLRenderer, офлайн,
 *      без HDR-загрузок из сети.
 *   2) 9 коэффициентов сферических гармоник (SH, L2) — для инстансных атомов.
 *      Считаются на CPU трассировкой тех же панелей по направлениям кубмапы
 *      (ровно то, что увидела бы кубокамера PMREM из центра), поэтому не нужен
 *      readback с GPU, результат детерминирован и проверяется в Node.
 *
 * Базис и нормировка SH совпадают с three.js (SphericalHarmonics3 /
 * shGetIrradianceAt): свёртка с косинусом даёт облучённость E(n),
 * ламбертов диффуз = albedo · E / π.
 */

export type Vec3Tuple = readonly [number, number, number]

export type SoftboxPanel = {
  name: string
  /** центр панели; панель всегда повёрнута лицом к началу координат */
  center: Vec3Tuple
  /** ширина (вдоль «right») и высота (вдоль «up») */
  size: readonly [number, number]
  /** линейный RGB */
  color: Vec3Tuple
  /** яркость (radiance) — множитель к color, может быть > 1 (HDR) */
  intensity: number
}

export type SoftboxSpec = {
  panels: readonly SoftboxPanel[]
  /** radiance фона там, где луч не попал ни в одну панель */
  background: Vec3Tuple
}

/**
 * Стандартный софтбокс урока. Зритель лаборатории смотрит примерно с +Z,
 * поэтому ключ — спереди-сверху-слева, контровой — сзади-справа.
 * Первая панель считается ключевой (из неё берётся направление блика).
 */
export const LAB_SOFTBOX: SoftboxSpec = {
  panels: [
    { name: 'key', center: [-3.2, 3.6, 4.6], size: [3.6, 2.6], color: [1.0, 0.86, 0.7], intensity: 9 },
    { name: 'rim', center: [4.4, 1.2, -4.2], size: [1.8, 4.6], color: [0.32, 0.82, 1.0], intensity: 5 },
    { name: 'floor', center: [0, -3.2, 0], size: [30, 30], color: [0.03, 0.035, 0.045], intensity: 1 },
    { name: 'top', center: [0, 6, 0], size: [9, 9], color: [0.55, 0.62, 0.78], intensity: 0.28 },
  ],
  background: [0.006, 0.008, 0.014],
}

/** Базис L2 в той же нормировке, что SphericalHarmonics3.getBasisAt. */
function shBasis(x: number, y: number, z: number, out: Float64Array): void {
  out[0] = 0.282095
  out[1] = 0.488603 * y
  out[2] = 0.488603 * z
  out[3] = 0.488603 * x
  out[4] = 1.092548 * x * y
  out[5] = 1.092548 * y * z
  out[6] = 0.315392 * (3 * z * z - 1)
  out[7] = 1.092548 * x * z
  out[8] = 0.546274 * (x * x - y * y)
}

type PanelFrame = {
  cx: number
  cy: number
  cz: number
  /** нормаль к началу координат */
  nx: number
  ny: number
  nz: number
  rx: number
  ry: number
  rz: number
  ux: number
  uy: number
  uz: number
  halfW: number
  halfH: number
  r: number
  g: number
  b: number
}

/**
 * Базис панели: n к началу координат, right = up₀ × n, up = n × right.
 * Для панелей строго над/под центром up₀ = +X (иначе векторное произведение
 * вырождается). Тем же базисом ориентируются меши PMREM-сцены.
 */
function panelFrame(p: SoftboxPanel): PanelFrame {
  const [cx, cy, cz] = p.center
  const len = Math.hypot(cx, cy, cz) || 1
  const nx = -cx / len
  const ny = -cy / len
  const nz = -cz / len
  let rx: number
  let ry: number
  let rz: number
  if (Math.abs(ny) > 0.999) {
    rx = 1
    ry = 0
    rz = 0
  } else {
    // (0,1,0) × n
    rx = nz
    ry = 0
    rz = -nx
    const rl = Math.hypot(rx, rz) || 1
    rx /= rl
    rz /= rl
  }
  // up = n × right
  const ux = ny * rz - nz * ry
  const uy = nz * rx - nx * rz
  const uz = nx * ry - ny * rx
  return {
    cx,
    cy,
    cz,
    nx,
    ny,
    nz,
    rx,
    ry,
    rz,
    ux,
    uy,
    uz,
    halfW: p.size[0] / 2,
    halfH: p.size[1] / 2,
    r: p.color[0] * p.intensity,
    g: p.color[1] * p.intensity,
    b: p.color[2] * p.intensity,
  }
}

/**
 * Radiance софтбокса в направлении (dx,dy,dz) из центра (вектор не обязан быть
 * единичным). Ближайшая панель перекрывает дальние, как в растеризации.
 */
export function sampleSoftboxRadiance(
  spec: SoftboxSpec,
  dx: number,
  dy: number,
  dz: number,
  out: Float32Array | Float64Array | number[],
  offset = 0,
): void {
  const frames = framesOf(spec)
  let bestT = Infinity
  let r = spec.background[0]
  let g = spec.background[1]
  let b = spec.background[2]
  for (let k = 0; k < frames.length; k++) {
    const f = frames[k]!
    // плоскость: dot(p − c, n) = 0, луч p = d·t
    const denom = dx * f.nx + dy * f.ny + dz * f.nz
    if (denom >= -1e-9) continue // панель смотрит от луча или луч параллелен
    const t = (f.cx * f.nx + f.cy * f.ny + f.cz * f.nz) / denom
    if (t <= 0 || t >= bestT) continue
    const lx = dx * t - f.cx
    const ly = dy * t - f.cy
    const lz = dz * t - f.cz
    const u = lx * f.rx + ly * f.ry + lz * f.rz
    const v = lx * f.ux + ly * f.uy + lz * f.uz
    if (Math.abs(u) > f.halfW || Math.abs(v) > f.halfH) continue
    bestT = t
    r = f.r
    g = f.g
    b = f.b
  }
  out[offset] = r
  out[offset + 1] = g
  out[offset + 2] = b
}

const frameCache = new WeakMap<SoftboxSpec, PanelFrame[]>()

function framesOf(spec: SoftboxSpec): PanelFrame[] {
  let frames = frameCache.get(spec)
  if (!frames) {
    frames = spec.panels.map(panelFrame)
    frameCache.set(spec, frames)
  }
  return frames
}

/**
 * Проекция софтбокса на SH L2: 27 чисел (9 × rgb), порядок как у
 * SphericalHarmonics3.coefficients. Интегрирование — по сетке граней куба
 * с весом телесного угла пикселя (как LightProbeGenerator).
 */
export function projectSoftboxSH(spec: SoftboxSpec, samplesPerFace = 32): Float32Array {
  const acc = new Float64Array(27)
  const basis = new Float64Array(9)
  const rad = new Float64Array(3)
  let totalWeight = 0
  const n = Math.max(2, Math.floor(samplesPerFace))
  const px = 2 / n
  for (let face = 0; face < 6; face++) {
    for (let j = 0; j < n; j++) {
      const v = -1 + (j + 0.5) * px
      for (let i = 0; i < n; i++) {
        const u = -1 + (i + 0.5) * px
        let x: number
        let y: number
        let z: number
        switch (face) {
          case 0:
            x = 1; y = v; z = u
            break
          case 1:
            x = -1; y = v; z = u
            break
          case 2:
            x = u; y = 1; z = v
            break
          case 3:
            x = u; y = -1; z = v
            break
          case 4:
            x = u; y = v; z = 1
            break
          default:
            x = u; y = v; z = -1
        }
        const lenSq = x * x + y * y + z * z
        const len = Math.sqrt(lenSq)
        const w = 4 / (len * lenSq)
        totalWeight += w
        const ix = x / len
        const iy = y / len
        const iz = z / len
        sampleSoftboxRadiance(spec, ix, iy, iz, rad)
        shBasis(ix, iy, iz, basis)
        for (let c = 0; c < 9; c++) {
          const bw = basis[c]! * w
          acc[c * 3] += bw * rad[0]!
          acc[c * 3 + 1] += bw * rad[1]!
          acc[c * 3 + 2] += bw * rad[2]!
        }
      }
    }
  }
  const norm = (4 * Math.PI) / totalWeight
  const out = new Float32Array(27)
  for (let k = 0; k < 27; k++) out[k] = acc[k]! * norm
  return out
}

/** CPU-зеркало шейдерной atomIrradiance / three shGetIrradianceAt: облучённость E(n). */
export function evalSHIrradiance(
  sh: ArrayLike<number>,
  nx: number,
  ny: number,
  nz: number,
  out: Float32Array | Float64Array | number[],
  offset = 0,
): void {
  const k0 = 0.886227
  const k1 = 2 * 0.511664
  const k2 = 2 * 0.429043
  const b1 = k1 * ny
  const b2 = k1 * nz
  const b3 = k1 * nx
  const b4 = k2 * nx * ny
  const b5 = k2 * ny * nz
  const b6 = 0.743125 * nz * nz - 0.247708
  const b7 = k2 * nx * nz
  const b8 = 0.429043 * (nx * nx - ny * ny)
  for (let c = 0; c < 3; c++) {
    out[offset + c] =
      sh[c]! * k0 +
      sh[3 + c]! * b1 +
      sh[6 + c]! * b2 +
      sh[9 + c]! * b3 +
      sh[12 + c]! * b4 +
      sh[15 + c]! * b5 +
      sh[18 + c]! * b6 +
      sh[21 + c]! * b7 +
      sh[24 + c]! * b8
  }
}

export type SoftboxLighting = {
  /** 27 чисел: 9 коэффициентов SH × rgb (линейные) */
  sh: Float32Array
  /** единичное направление НА ключевую панель (мировые оси) */
  keyDir: Vec3Tuple
  /** облучённость от ключа на обращённую к нему поверхность: radiance × телесный угол */
  keyIrradiance: Vec3Tuple
}

/** Освещение из описания софтбокса: SH + параметры ключа для блика и wrap-диффуза. */
export function buildSoftboxLighting(spec: SoftboxSpec, samplesPerFace = 32): SoftboxLighting {
  const sh = projectSoftboxSH(spec, samplesPerFace)
  const key = spec.panels[0]
  if (!key) return { sh, keyDir: [0, 1, 0], keyIrradiance: [0, 0, 0] }
  const [cx, cy, cz] = key.center
  const d2 = cx * cx + cy * cy + cz * cz
  const d = Math.sqrt(d2) || 1
  // малая панель, обращённая к центру: Ω ≈ S / d²
  const omega = Math.min(2 * Math.PI, (key.size[0] * key.size[1]) / Math.max(d2, 1e-6))
  const e = key.intensity * omega
  return {
    sh,
    keyDir: [cx / d, cy / d, cz / d],
    keyIrradiance: [key.color[0] * e, key.color[1] * e, key.color[2] * e],
  }
}

let labLighting: SoftboxLighting | null = null

/** SH-освещение стандартного софтбокса (кэш модуля: не зависит от рендерера). */
export function getLabSoftboxLighting(): SoftboxLighting {
  if (!labLighting) labLighting = buildSoftboxLighting(LAB_SOFTBOX)
  return labLighting
}

// ——— PMREM (нужен WebGL) ———

export type LabEnvironment = {
  renderTarget: THREE.WebGLRenderTarget
  /** cubeUV-текстура для scene.environment / material.envMap */
  texture: THREE.Texture
}

type EnvEntry = {
  env: LabEnvironment
  listeners: Set<(env: LabEnvironment) => void>
  onRestore: () => void
  canvas: HTMLCanvasElement
}

const envCache = new WeakMap<THREE.WebGLRenderer, EnvEntry>()
/** Для disposeAll: WeakMap не перечисляется. */
const envRenderers = new Set<THREE.WebGLRenderer>()

/** Сцена софтбокса для кубокамеры PMREM. Возвращает функцию выгрузки. */
function buildSoftboxScene(spec: SoftboxSpec): { scene: THREE.Scene; dispose: () => void } {
  const scene = new THREE.Scene()
  const [br, bg, bb] = spec.background
  scene.background = new THREE.Color().setRGB(br, bg, bb, THREE.LinearSRGBColorSpace)
  const geometry = new THREE.PlaneGeometry(1, 1)
  const materials: THREE.Material[] = []
  const basis = new THREE.Matrix4()
  const right = new THREE.Vector3()
  const up = new THREE.Vector3()
  const normal = new THREE.Vector3()
  for (const panel of spec.panels) {
    const f = panelFrame(panel)
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color().setRGB(f.r, f.g, f.b, THREE.LinearSRGBColorSpace),
      side: THREE.DoubleSide,
      toneMapped: false,
      fog: false,
    })
    materials.push(material)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(f.cx, f.cy, f.cz)
    right.set(f.rx, f.ry, f.rz)
    up.set(f.ux, f.uy, f.uz)
    normal.set(f.nx, f.ny, f.nz)
    mesh.quaternion.setFromRotationMatrix(basis.makeBasis(right, up, normal))
    mesh.scale.set(panel.size[0], panel.size[1], 1)
    scene.add(mesh)
  }
  return {
    scene,
    dispose: () => {
      geometry.dispose()
      for (const m of materials) m.dispose()
    },
  }
}

function renderSoftboxPMREM(renderer: THREE.WebGLRenderer, spec: SoftboxSpec): LabEnvironment {
  const { scene, dispose } = buildSoftboxScene(spec)
  const pmrem = new THREE.PMREMGenerator(renderer)
  // Лёгкое размытие сцены до свёртки: края панелей мягче, как у настоящего софтбокса.
  const renderTarget = pmrem.fromScene(scene, 0.035, 0.1, 100, { size: 128 })
  pmrem.dispose()
  dispose()
  return { renderTarget, texture: renderTarget.texture }
}

/**
 * PMREM стандартного софтбокса для рендерера. Строится при первом вызове
 * (один рендер кубокамеры + свёртка, ~10–40 мс), дальше берётся из кэша.
 * После восстановления потерянного WebGL-контекста перестраивается сам и
 * оповещает подписчиков (subscribeLabEnvironment).
 */
export function getLabEnvironment(renderer: THREE.WebGLRenderer): LabEnvironment {
  const cached = envCache.get(renderer)
  if (cached) return cached.env
  const canvas = renderer.domElement
  const entry: EnvEntry = {
    env: renderSoftboxPMREM(renderer, LAB_SOFTBOX),
    listeners: new Set(),
    canvas,
    onRestore: () => {
      // Содержимое render target после потери контекста пропало — строим заново.
      entry.env.renderTarget.dispose()
      entry.env = renderSoftboxPMREM(renderer, LAB_SOFTBOX)
      entry.listeners.forEach((cb) => cb(entry.env))
    },
  }
  canvas.addEventListener('webglcontextrestored', entry.onRestore)
  envCache.set(renderer, entry)
  envRenderers.add(renderer)
  return entry.env
}

/** Подписка на пересборку PMREM (восстановление контекста). Возвращает отписку. */
export function subscribeLabEnvironment(
  renderer: THREE.WebGLRenderer,
  listener: (env: LabEnvironment) => void,
): () => void {
  getLabEnvironment(renderer)
  const entry = envCache.get(renderer)!
  entry.listeners.add(listener)
  return () => {
    entry.listeners.delete(listener)
  }
}

/**
 * Выгрузка PMREM: для одного рендерера или для всех (закрытие 3D-лаборатории).
 * Вызывать, когда текстура уже не назначена ни одной сцене.
 */
export function disposeLabEnvironment(renderer?: THREE.WebGLRenderer): void {
  const targets = renderer ? [renderer] : Array.from(envRenderers)
  for (const r of targets) {
    const entry = envCache.get(r)
    if (!entry) continue
    entry.canvas.removeEventListener('webglcontextrestored', entry.onRestore)
    entry.env.renderTarget.dispose()
    entry.listeners.clear()
    envCache.delete(r)
    envRenderers.delete(r)
  }
}
