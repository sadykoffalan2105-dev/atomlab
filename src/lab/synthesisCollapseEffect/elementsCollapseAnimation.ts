/**
 * Порт vendor/expl_threejs_effect_v02gm_dev для лаборатории:
 * коллапс атомов → вспышка ядра → разлёт искр → hold → fade.
 *
 * Искры: InstancedMesh (не gl_PointSize Points) — на Windows/ANGLE
 * кастомный Points-шейдер часто не рисуется.
 *
 * Lab-профиль короче и легче демо (~1.6 с, ≤380 искр) — без зависаний
 * при 200+ молекулах; dense/lowPower режут ещё сильнее.
 */
import * as THREE from 'three'

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}
function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3)
}
function clamp01(x: number) {
  return Math.max(0, Math.min(1, x))
}

export type ElementsCollapseOptions = {
  atom_collapse_time?: number
  atom_delay_max?: number
  burst_time?: number
  hold_after_grow?: number
  fade_out?: number
  end_scale?: number
  particles_per_sec?: number
  max_particles?: number
  particle_base_size?: number
  particle_speed?: number
  particle_stretch?: number
  particle_colors?: number[]
  core_gradient?: Array<{ stop: number; color: string }>
  /** Цвет кольца / ядра / света — под accent молекулы. */
  accent_hex?: number
  ring_color?: number
  core_mesh_color?: number
  light_color?: number
  flash_tint?: number
  center?: THREE.Vector3
}

export type ElementsCollapseDisposeOpts = {
  /** true = обрыв (watchdog/unmount) — вернуть атомы на старт. */
  interrupted?: boolean
}

export type ElementsCollapseController = {
  tick: (dt: number) => boolean
  dispose: (opts?: ElementsCollapseDisposeOpts) => void
  readonly done: boolean
  readonly phase: string
  /** Burst стартовал — можно греть GPU молекулы (micro) внутри круга. */
  readonly embryoReady: boolean
  /** Hold/пик свечения — молекула растёт из круга (видимое рождение). */
  readonly birthReady: boolean
}

export type CollapseAccentTheme = {
  particle_colors: number[]
  core_gradient: Array<{ stop: number; color: string }>
  accent_hex: number
  ring_color: number
  core_mesh_color: number
  light_color: number
  flash_tint: number
}

function parseAccentHex(hex: string | undefined | null): number | null {
  if (!hex) return null
  const raw = hex.replace('#', '').trim()
  if (!raw) return null
  const full = raw.length === 3 ? raw.replace(/(.)/g, '$1$1') : raw
  const n = Number.parseInt(full, 16)
  return Number.isFinite(n) ? n : null
}

function rgbaFromHex(hex: number, a: number): string {
  const r = (hex >> 16) & 0xff
  const g = (hex >> 8) & 0xff
  const b = hex & 0xff
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

function mixHex(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff
  const ag = (a >> 8) & 0xff
  const ab = a & 0xff
  const br = (b >> 16) & 0xff
  const bg = (b >> 8) & 0xff
  const bb = b & 0xff
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const bl = Math.round(ab + (bb - ab) * t)
  return (r << 16) | (g << 8) | bl
}

/** Полная палитра FX под accentColor вещества (не только синий). */
export function buildCollapseAccentTheme(accentHex?: string | null): CollapseAccentTheme | null {
  const accent = parseAccentHex(accentHex)
  if (accent == null) return null
  const soft = mixHex(accent, 0xffffff, 0.35)
  const deep = mixHex(accent, 0x000000, 0.35)
  const warm = mixHex(accent, 0xffaa44, 0.28)
  return {
    particle_colors: [0xffffff, soft, accent, warm, deep],
    core_gradient: [
      { stop: 0.0, color: 'rgba(255, 255, 255, 1.0)' },
      { stop: 0.12, color: rgbaFromHex(soft, 0.95) },
      { stop: 0.35, color: rgbaFromHex(accent, 0.78) },
      { stop: 0.62, color: rgbaFromHex(deep, 0.28) },
      { stop: 1.0, color: 'rgba(0, 0, 0, 0.0)' },
    ],
    accent_hex: accent,
    ring_color: soft,
    core_mesh_color: accent,
    light_color: soft,
    flash_tint: mixHex(accent, 0xffffff, 0.55),
  }
}

const DEFAULT_GRADIENT = [
  { stop: 0.0, color: 'rgba(255, 255, 255, 1.0)' },
  { stop: 0.1, color: 'rgba(255, 255, 255, 0.9)' },
  { stop: 0.3, color: 'rgba(100, 180, 255, 0.7)' },
  { stop: 0.6, color: 'rgba(30, 80, 255, 0.2)' },
  { stop: 1.0, color: 'rgba(0, 0, 0, 0.0)' },
]

/** Демо из vendor index.html — полный WOW (референс, не для lab run). */
export const COLLAPSE_DEMO_QUALITY = {
  atom_collapse_time: 1.2,
  atom_delay_max: 0.3,
  burst_time: 1.5,
  hold_after_grow: 0.5,
  fade_out: 1.0,
  end_scale: 3,
  particles_per_sec: 350,
  max_particles: 1600,
  particle_base_size: 60,
  particle_speed: 12,
  particle_stretch: 3,
  particle_colors: [0xffffff, 0xaaddff, 0x4488ff, 0xffaa00, 0xffffff] as number[],
  core_gradient: DEFAULT_GRADIENT,
}

/**
 * Профиль лаборатории: тот же FX, но быстрее и дешевле по GPU.
 * ~1.56 с вместо ~4.5 с; ≤380 искр вместо 1600.
 */
/**
 * Lab-профиль: hold/fade длиннее — молекула рождается ИЗ круга, пока он ещё светит.
 * ~2.1 с; ≤400 искр.
 */
export const COLLAPSE_LAB_QUALITY = {
  atom_collapse_time: 0.5,
  atom_delay_max: 0.09,
  burst_time: 0.48,
  hold_after_grow: 0.38,
  fade_out: 0.78,
  end_scale: 2.45,
  particles_per_sec: 155,
  max_particles: 360,
  particle_base_size: 50,
  particle_speed: 13,
  particle_stretch: 2.6,
  particle_colors: [0xffffff, 0xaaddff, 0x4488ff, 0xffaa00, 0xffffff] as number[],
  core_gradient: DEFAULT_GRADIENT,
}

/** GSAP-рождение молекулы — совпадает с hold+fade круга. */
export const PRODUCT_BIRTH_FROM_COLLAPSE_SEC = 0.95

export function estimateCollapseDurationSec(opts: ElementsCollapseOptions = {}): number {
  const d = { ...COLLAPSE_LAB_QUALITY, ...opts }
  return (
    d.atom_collapse_time +
    d.atom_delay_max +
    d.burst_time +
    d.hold_after_grow +
    d.fade_out
  )
}

let sharedGlowTex: THREE.CanvasTexture | null = null

function makeGlowTexture(core_gradient: Array<{ stop: number; color: string }>) {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
    core_gradient.forEach((g) => gradient.addColorStop(g.stop, g.color))
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 128, 128)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

function acquireGlowTexture(core_gradient: Array<{ stop: number; color: string }>) {
  const isDefault = core_gradient === DEFAULT_GRADIENT
  if (isDefault) {
    if (!sharedGlowTex) sharedGlowTex = makeGlowTexture(DEFAULT_GRADIENT)
    return { tex: sharedGlowTex, shared: true as const }
  }
  return { tex: makeGlowTexture(core_gradient), shared: false as const }
}

export function createElementsCollapseAnimation(
  atoms_array: THREE.Object3D[],
  parent: THREE.Object3D,
  options: ElementsCollapseOptions = {},
): ElementsCollapseController {
  const {
    atom_collapse_time = COLLAPSE_LAB_QUALITY.atom_collapse_time,
    atom_delay_max = COLLAPSE_LAB_QUALITY.atom_delay_max,
    burst_time = COLLAPSE_LAB_QUALITY.burst_time,
    hold_after_grow = COLLAPSE_LAB_QUALITY.hold_after_grow,
    fade_out = COLLAPSE_LAB_QUALITY.fade_out,
    end_scale = COLLAPSE_LAB_QUALITY.end_scale,
    particles_per_sec = COLLAPSE_LAB_QUALITY.particles_per_sec,
    max_particles = COLLAPSE_LAB_QUALITY.max_particles,
    particle_base_size = COLLAPSE_LAB_QUALITY.particle_base_size,
    particle_speed = COLLAPSE_LAB_QUALITY.particle_speed,
    particle_stretch = COLLAPSE_LAB_QUALITY.particle_stretch,
    particle_colors = COLLAPSE_LAB_QUALITY.particle_colors,
    core_gradient = DEFAULT_GRADIENT,
    accent_hex = 0xaaddff,
    ring_color = 0xaaddff,
    core_mesh_color = 0xaaddff,
    light_color = 0xaaddff,
    flash_tint = 0xffffff,
  } = options

  const centerLocal = options.center?.clone() ?? new THREE.Vector3(0, 0, 0)
  const sparkSize = Math.max(0.04, particle_base_size / 900)
  const collapsedScale = new THREE.Vector3(0.001, 0.001, 0.001)
  const coreSoft = new THREE.Color(core_mesh_color)
  const coreHot = new THREE.Color(0xffffff)
  const lightCol = new THREE.Color(light_color)
  void accent_hex

  // --- Искры: InstancedMesh-стрики ---
  const sparkGeo = new THREE.BoxGeometry(sparkSize * 0.35, sparkSize * 0.35, sparkSize * particle_stretch)
  const sparkMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 1,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
  })
  const sparks = new THREE.InstancedMesh(sparkGeo, sparkMat, max_particles)
  sparks.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  sparks.count = 0
  sparks.frustumCulled = false
  sparks.renderOrder = 42
  if (!sparks.instanceColor) {
    sparks.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max_particles * 3), 3)
  }
  parent.add(sparks)

  const positions = new Float32Array(max_particles * 3)
  const velocities = new Float32Array(max_particles * 3)
  const birthTimes = new Float32Array(max_particles)
  const lifetimes = new Float32Array(max_particles)
  const stretches = new Float32Array(max_particles)
  const dummy = new THREE.Object3D()
  const colorObj = new THREE.Color()
  const lookTarget = new THREE.Vector3()

  function resetParticle(i: number, time: number) {
    positions[i * 3] = centerLocal.x + (Math.random() - 0.5) * 0.08
    positions[i * 3 + 1] = centerLocal.y + (Math.random() - 0.5) * 0.08
    positions[i * 3 + 2] = centerLocal.z + (Math.random() - 0.5) * 0.08
    colorObj.set(particle_colors[Math.floor(Math.random() * particle_colors.length)]!)
    sparks.setColorAt(i, colorObj)
    const speed = particle_speed * 0.55 + Math.random() * particle_speed
    const theta = Math.random() * 2 * Math.PI
    const phi = Math.acos(Math.random() * 2 - 1)
    velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * speed
    velocities[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * speed
    velocities[i * 3 + 2] = Math.cos(phi) * speed
    stretches[i] = 0.7 + Math.random() * particle_stretch
    birthTimes[i] = time
    lifetimes[i] = 0.22 + Math.random() * 0.42
  }

  function writeSparkMatrix(i: number, opacityFade: number) {
    const px = positions[i * 3]!
    const py = positions[i * 3 + 1]!
    const pz = positions[i * 3 + 2]!
    const vx = velocities[i * 3]!
    const vy = velocities[i * 3 + 1]!
    const vz = velocities[i * 3 + 2]!
    dummy.position.set(px, py, pz)
    lookTarget.set(px + vx, py + vy, pz + vz)
    dummy.lookAt(lookTarget)
    const len = Math.max(0.35, stretches[i]!) * opacityFade
    const thick = sparkSize * (0.55 + 0.45 * opacityFade)
    dummy.scale.set(thick, thick, sparkSize * len * 2.2)
    dummy.updateMatrix()
    sparks.setMatrixAt(i, dummy.matrix)
  }

  // --- Ядро / шоквейв ---
  const glowAcq = acquireGlowTexture(core_gradient)
  const glowTex = glowAcq.tex
  const glowMat = new THREE.SpriteMaterial({
    map: glowTex,
    color: flash_tint,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
  })
  glowMat.opacity = 0
  const glow = new THREE.Sprite(glowMat)
  glow.position.copy(centerLocal)
  glow.scale.setScalar(0.0001)
  glow.renderOrder = 40
  parent.add(glow)

  const flashMat = new THREE.SpriteMaterial({
    map: glowTex,
    color: flash_tint,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
  })
  flashMat.opacity = 0
  const shockwaveFlash = new THREE.Sprite(flashMat)
  shockwaveFlash.position.copy(centerLocal)
  shockwaveFlash.scale.setScalar(0.0001)
  shockwaveFlash.renderOrder = 41
  parent.add(shockwaveFlash)

  const coreGeo = new THREE.SphereGeometry(0.4, 16, 12)
  const coreMat = new THREE.MeshBasicMaterial({
    color: core_mesh_color,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
  })
  const coreMesh = new THREE.Mesh(coreGeo, coreMat)
  coreMesh.position.copy(centerLocal)
  coreMesh.renderOrder = 39
  parent.add(coreMesh)

  const ringGeo = new THREE.RingGeometry(0.55, 0.85, 32)
  const ringMat = new THREE.MeshBasicMaterial({
    color: ring_color,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
  })
  const ring = new THREE.Mesh(ringGeo, ringMat)
  ring.position.copy(centerLocal)
  ring.rotation.x = Math.PI / 2
  ring.renderOrder = 38
  parent.add(ring)

  const burstLight = new THREE.PointLight(light_color, 0, 16, 2)
  burstLight.position.copy(centerLocal)
  parent.add(burstLight)

  parent.updateWorldMatrix(true, false)
  const centerWorld = centerLocal.clone().applyMatrix4(parent.matrixWorld)

  type AtomTrack = {
    obj: THREE.Object3D
    startLocal: THREE.Vector3
    startScale: THREE.Vector3
    delay: number
    duration: number
  }

  const atomData: AtomTrack[] = atoms_array.map((atom) => ({
    obj: atom,
    startLocal: atom.position.clone(),
    startScale: atom.scale.clone(),
    delay: Math.random() * atom_delay_max,
    duration: atom_collapse_time,
  }))

  const atomTargets = atoms_array.map((atom) => {
    const target = centerWorld.clone()
    if (atom.parent) atom.parent.worldToLocal(target)
    else target.set(0, 0, 0)
    return target
  })

  let elapsed = 0
  let spawnAccumulator = 0
  let activeCount = 0
  let phase: 'collapse' | 'burst' | 'hold' | 'fadeout' = 'collapse'
  let finished = false
  let disposed = false
  let embryoReady = false
  let birthReady = false

  const collapseEnd = atom_collapse_time + atom_delay_max
  const burstEnd = collapseEnd + burst_time
  const holdEnd = burstEnd + hold_after_grow
  const fadeEnd = holdEnd + fade_out
  const collapseMaxScale = 0.22
  const earlySparkT = collapseEnd - Math.min(0.28, atom_collapse_time * 0.25)
  /** Micro-молекула внутри круга — как только burst начался (GPU warm). */
  const embryoAt = collapseEnd
  /** Видимое рождение — на пике круга (середина burst → hold). */
  const birthAt = collapseEnd + burst_time * 0.55

  function restoreAtoms() {
    for (const data of atomData) {
      data.obj.position.copy(data.startLocal)
      data.obj.scale.copy(data.startScale)
      data.obj.visible = true
    }
  }

  function dispose(opts?: ElementsCollapseDisposeOpts) {
    if (disposed) return
    disposed = true
    finished = true
    if (opts?.interrupted) restoreAtoms()
    parent.remove(sparks)
    parent.remove(glow)
    parent.remove(shockwaveFlash)
    parent.remove(coreMesh)
    parent.remove(ring)
    parent.remove(burstLight)
    sparkGeo.dispose()
    sparkMat.dispose()
    glowMat.dispose()
    flashMat.dispose()
    if (!glowAcq.shared) glowTex.dispose()
    coreGeo.dispose()
    coreMat.dispose()
    ringGeo.dispose()
    ringMat.dispose()
  }

  function tick(dtRaw: number): boolean {
    if (finished || disposed) return true
    // Cap dt — после таба/stall не «перепрыгиваем» фазы одним кадром.
    const dt = Math.min(0.033, Math.max(0.0005, dtRaw))
    elapsed += dt

    if (elapsed >= embryoAt) embryoReady = true
    if (elapsed >= birthAt) birthReady = true

    if (elapsed >= fadeEnd) {
      dispose()
      return true
    }

    let burstScale = 0
    let fadeMul = 1
    let spawning = false

    if (elapsed < collapseEnd) {
      phase = 'collapse'
      let minAtomT = 1
      if (atomData.length === 0) {
        const t = clamp01(elapsed / Math.max(0.01, collapseEnd))
        minAtomT = t
        burstScale = t > 0.7 ? ((t - 0.7) / 0.3) * collapseMaxScale : 0
      } else {
        for (let i = 0; i < atomData.length; i++) {
          const data = atomData[i]!
          const target = atomTargets[i]!
          const t = clamp01((elapsed - data.delay) / data.duration)
          if (t < minAtomT) minAtomT = t
          const easeT = easeInOutCubic(t)
          data.obj.position.lerpVectors(data.startLocal, target, easeT)
          data.obj.scale.lerpVectors(data.startScale, collapsedScale, easeT)
          data.obj.visible = true
        }
        if (minAtomT > 0.85) {
          burstScale = ((minAtomT - 0.85) / 0.15) * collapseMaxScale
        }
      }
      if (elapsed >= earlySparkT) {
        spawning = true
        const earlyT = clamp01((elapsed - earlySparkT) / Math.max(0.01, collapseEnd - earlySparkT))
        spawnAccumulator += particles_per_sec * 0.35 * earlyT * dt
      }
    } else if (elapsed < burstEnd) {
      phase = 'burst'
      spawning = true
      for (const data of atomData) data.obj.visible = false
      const burstGrowT = clamp01((elapsed - collapseEnd) / burst_time)
      burstScale = collapseMaxScale + easeOutCubic(burstGrowT) * (end_scale - collapseMaxScale)
      spawnAccumulator += particles_per_sec * (0.15 + 0.95 * burstGrowT) * dt
      if (burstGrowT < 0.35) {
        const flashT = burstGrowT / 0.35
        shockwaveFlash.scale.setScalar(18 * easeOutCubic(flashT))
        flashMat.opacity = 1.0 - easeInOutCubic(flashT)
      } else {
        flashMat.opacity = 0
      }
    } else if (elapsed < holdEnd) {
      phase = 'hold'
      spawning = true
      burstScale = end_scale
      // После birthReady круг чуть сжимается — молекула «выходит» из ядра.
      if (birthReady) {
        const holdT = clamp01((elapsed - birthAt) / Math.max(0.01, holdEnd - birthAt))
        burstScale = end_scale * (1 - 0.22 * easeOutCubic(holdT))
      }
      spawnAccumulator += particles_per_sec * 0.55 * dt
      flashMat.opacity = 0
    } else {
      phase = 'fadeout'
      birthReady = true
      const fadeT = clamp01((elapsed - holdEnd) / fade_out)
      fadeMul = 1 - easeInOutCubic(fadeT)
      // Круг уходит быстрее в центре — молекула остаётся в кадре как единое целое.
      burstScale = end_scale * 0.78 * fadeMul
      flashMat.opacity = 0
    }

    if (spawning) {
      while (spawnAccumulator >= 1 && activeCount < max_particles) {
        resetParticle(activeCount, elapsed)
        activeCount++
        spawnAccumulator -= 1
      }
    }

    for (let i = 0; i < activeCount; i++) {
      const age = elapsed - birthTimes[i]!
      const life = lifetimes[i]!
      if (age > life) {
        if (spawning && phase !== 'fadeout') {
          resetParticle(i, elapsed)
        } else {
          dummy.position.set(0, -999, 0)
          dummy.scale.setScalar(0.0001)
          dummy.updateMatrix()
          sparks.setMatrixAt(i, dummy.matrix)
          continue
        }
      }
      positions[i * 3]! += velocities[i * 3]! * dt
      positions[i * 3 + 1]! += velocities[i * 3 + 1]! * dt
      positions[i * 3 + 2]! += velocities[i * 3 + 2]! * dt
      const lifeFade = clamp01(1 - age / life) * fadeMul
      writeSparkMatrix(i, lifeFade)
    }

    sparks.count = activeCount
    sparks.instanceMatrix.needsUpdate = true
    if (sparks.instanceColor) sparks.instanceColor.needsUpdate = true
    sparkMat.opacity = fadeMul

    const glowScalar = Math.max(0.0001, 5.5 * Math.max(burstScale, 0.001))
    glow.scale.setScalar(glowScalar)
    // После birth круг чуть прозрачнее — молекула видна «внутри» свечения.
    const glowCap = birthReady ? 0.62 : 0.9
    glowMat.opacity = Math.min(1, Math.max(burstScale, 0) * glowCap) * fadeMul

    coreMesh.scale.setScalar(Math.max(0.001, 0.35 + burstScale * 0.7))
    coreMat.opacity = Math.min(1, (birthReady ? 0.12 : 0.2) + burstScale * (birthReady ? 0.22 : 0.35)) * fadeMul
    coreMat.color.copy(burstScale > 1.15 ? coreHot : coreSoft)

    const ringS = Math.max(0.001, 0.4 + burstScale * 1.15)
    ring.scale.set(ringS, ringS, ringS)
    ringMat.opacity = Math.min(0.85, burstScale * (birthReady ? 0.18 : 0.28)) * fadeMul
    ring.rotation.z = elapsed * 1.2

    burstLight.intensity = Math.min(6.5, burstScale * (birthReady ? 1.4 : 2.1)) * fadeMul
    burstLight.color.copy(lightCol)

    return false
  }

  return {
    tick,
    dispose,
    get done() {
      return finished
    },
    get phase() {
      return phase
    },
    get embryoReady() {
      return embryoReady
    },
    get birthReady() {
      return birthReady
    },
  }
}

/** Lab FX: lowPower / dense режут искры и длительность (анти hitch / white-screen). */
export function resolveCollapseOptionsForDevice(
  lowPower: boolean,
  densePreview = false,
): ElementsCollapseOptions {
  let opts: ElementsCollapseOptions = {
    ...COLLAPSE_LAB_QUALITY,
    particle_colors: [...COLLAPSE_LAB_QUALITY.particle_colors],
  }

  if (densePreview) {
    opts = {
      ...opts,
      atom_collapse_time: 0.42,
      atom_delay_max: 0.08,
      burst_time: 0.4,
      hold_after_grow: 0.28,
      fade_out: 0.62,
      end_scale: 2.1,
      particles_per_sec: 95,
      max_particles: 200,
      particle_base_size: 44,
      particle_speed: 12,
    }
  }

  if (lowPower) {
    opts = {
      ...opts,
      particles_per_sec: Math.min(opts.particles_per_sec ?? 160, 80),
      max_particles: Math.min(opts.max_particles ?? 380, 160),
      particle_base_size: 40,
      burst_time: Math.min(opts.burst_time ?? 0.48, 0.34),
      hold_after_grow: Math.min(opts.hold_after_grow ?? 0.14, 0.1),
      fade_out: Math.min(opts.fade_out ?? 0.32, 0.22),
      end_scale: Math.min(opts.end_scale ?? 2.35, 1.85),
    }
  }

  return opts
}
