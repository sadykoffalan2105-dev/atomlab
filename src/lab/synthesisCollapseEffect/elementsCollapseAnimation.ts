/**
 * Эффект коллапса атомов → вспышка частиц.
 * Верный порт vendor/expl_threejs_effect_v02gm_dev (index.html demo quality).
 * Без собственного RAF / renderer.render — тикает из R3F useFrame.
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
  /** Мир: куда стягивать атомы и где вспышка (по умолчанию origin родителя FX). */
  center?: THREE.Vector3
}

export type ElementsCollapseController = {
  /** @returns true когда эффект полностью завершён */
  tick: (dt: number) => boolean
  dispose: () => void
  readonly done: boolean
  readonly phase: string
}

const DEFAULT_GRADIENT = [
  { stop: 0.0, color: 'rgba(255, 255, 255, 1.0)' },
  { stop: 0.1, color: 'rgba(255, 255, 255, 0.9)' },
  { stop: 0.3, color: 'rgba(100, 180, 255, 0.7)' },
  { stop: 0.6, color: 'rgba(30, 80, 255, 0.2)' },
  { stop: 1.0, color: 'rgba(0, 0, 0, 0.0)' },
]

/** Демо-профиль из vendor index.html — «WOW» качество. */
export const COLLAPSE_DEMO_QUALITY: Required<
  Omit<ElementsCollapseOptions, 'core_gradient' | 'center' | 'particle_colors'>
> & {
  particle_colors: number[]
  core_gradient: Array<{ stop: number; color: string }>
} = {
  atom_collapse_time: 1.2,
  atom_delay_max: 0.3,
  burst_time: 1.5,
  hold_after_grow: 0.5,
  fade_out: 1.0,
  end_scale: 3,
  particles_per_sec: 350,
  max_particles: 2000,
  particle_base_size: 60,
  particle_speed: 12,
  particle_stretch: 3,
  particle_colors: [0xffffff, 0xaaddff, 0x4488ff, 0xffaa00, 0xffffff],
  core_gradient: DEFAULT_GRADIENT,
}

/** Оценённая длительность (сек). */
export function estimateCollapseDurationSec(opts: ElementsCollapseOptions = {}): number {
  const d = { ...COLLAPSE_DEMO_QUALITY, ...opts }
  return (
    d.atom_collapse_time +
    d.atom_delay_max +
    d.burst_time +
    d.hold_after_grow +
    d.fade_out
  )
}

function makeGlowTexture(core_gradient: Array<{ stop: number; color: string }>) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128)
    core_gradient.forEach((g) => gradient.addColorStop(g.stop, g.color))
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 256, 256)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

/**
 * @param parent — группа FX в R3F (частицы/glow как дети). Обычно origin реактора.
 * @param atoms_array — Object3D Bohr-слотов (позиции анимируются в world → local parent).
 */
export function createElementsCollapseAnimation(
  atoms_array: THREE.Object3D[],
  parent: THREE.Object3D,
  options: ElementsCollapseOptions = {},
): ElementsCollapseController {
  const {
    atom_collapse_time = COLLAPSE_DEMO_QUALITY.atom_collapse_time,
    atom_delay_max = COLLAPSE_DEMO_QUALITY.atom_delay_max,
    burst_time = COLLAPSE_DEMO_QUALITY.burst_time,
    hold_after_grow = COLLAPSE_DEMO_QUALITY.hold_after_grow,
    fade_out = COLLAPSE_DEMO_QUALITY.fade_out,
    end_scale = COLLAPSE_DEMO_QUALITY.end_scale,
    particles_per_sec = COLLAPSE_DEMO_QUALITY.particles_per_sec,
    max_particles = COLLAPSE_DEMO_QUALITY.max_particles,
    particle_base_size = COLLAPSE_DEMO_QUALITY.particle_base_size,
    particle_speed = COLLAPSE_DEMO_QUALITY.particle_speed,
    particle_stretch = COLLAPSE_DEMO_QUALITY.particle_stretch,
    particle_colors = COLLAPSE_DEMO_QUALITY.particle_colors,
    core_gradient = DEFAULT_GRADIENT,
  } = options

  const centerLocal = options.center?.clone() ?? new THREE.Vector3(0, 0, 0)

  const geometry = new THREE.BufferGeometry()
  const positions = new Float32Array(max_particles * 3)
  const velocities = new Float32Array(max_particles * 3)
  const colors = new Float32Array(max_particles * 3)
  const randomScale = new Float32Array(max_particles * 2)
  const birthTimes = new Float32Array(max_particles)
  const lifetimes = new Float32Array(max_particles)

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.setAttribute('randomScale', new THREE.BufferAttribute(randomScale, 2))
  geometry.setDrawRange(0, 0)

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacityMul: { value: 1.0 },
      uPointSize: { value: particle_base_size },
    },
    vertexShader: /* glsl */ `
      attribute vec3 color;
      attribute vec3 velocity;
      attribute vec2 randomScale;
      uniform float uPointSize;
      varying vec3 vColor;
      varying vec2 vScale;
      varying vec2 vDirection;
      void main() {
        vColor = color;
        vScale = randomScale;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        vec4 nextProjected = projectionMatrix * modelViewMatrix * vec4(position + velocity * 0.1, 1.0);
        vec2 dir = (nextProjected.xy / nextProjected.w) - (gl_Position.xy / gl_Position.w);
        if (length(dir) < 0.0001) dir = vec2(0.0, 1.0);
        else dir = normalize(dir);
        vDirection = dir;
        float dist = max(0.35, -mvPosition.z);
        gl_PointSize = clamp((uPointSize * max(vScale.x, vScale.y)) / dist, 2.0, 180.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacityMul;
      varying vec3 vColor;
      varying vec2 vScale;
      varying vec2 vDirection;
      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float c = vDirection.x;
        float s = vDirection.y;
        mat2 rot = mat2(c, s, -s, c);
        vec2 rotatedUv = rot * uv;
        vec2 scaledUv = rotatedUv / vScale;
        float dist = length(scaledUv);
        if (dist > 0.5) discard;
        float alpha = pow(1.0 - (dist * 2.0), 3.0) * uOpacityMul;
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
  })

  const points = new THREE.Points(geometry, material)
  points.frustumCulled = false
  points.renderOrder = 40
  parent.add(points)

  const glowTex = makeGlowTexture(core_gradient)
  const glowMat = new THREE.SpriteMaterial({
    map: glowTex,
    color: 0xffffff,
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
  glow.renderOrder = 38
  parent.add(glow)

  const flashMat = new THREE.SpriteMaterial({
    map: glowTex,
    color: 0xffffff,
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
  shockwaveFlash.renderOrder = 39
  parent.add(shockwaveFlash)

  // Ядро-меш: всегда читается глазом (спрайты иногда «съедает» тонмап/масштаб).
  const coreGeo = new THREE.SphereGeometry(0.35, 24, 18)
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xaaddff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  })
  const coreMesh = new THREE.Mesh(coreGeo, coreMat)
  coreMesh.position.copy(centerLocal)
  coreMesh.renderOrder = 37
  parent.add(coreMesh)

  const colorObj = new THREE.Color()
  function resetParticle(i: number, time: number) {
    positions[i * 3] = centerLocal.x + (Math.random() - 0.5) * 0.05
    positions[i * 3 + 1] = centerLocal.y + (Math.random() - 0.5) * 0.05
    positions[i * 3 + 2] = centerLocal.z + (Math.random() - 0.5) * 0.05
    colorObj.set(particle_colors[Math.floor(Math.random() * particle_colors.length)]!)
    colors[i * 3] = colorObj.r
    colors[i * 3 + 1] = colorObj.g
    colors[i * 3 + 2] = colorObj.b
    const speed = particle_speed * 0.5 + Math.random() * particle_speed
    const theta = Math.random() * 2 * Math.PI
    const phi = Math.acos(Math.random() * 2 - 1)
    velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * speed
    velocities[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * speed
    velocities[i * 3 + 2] = Math.cos(phi) * speed
    randomScale[i * 2] = 0.5 + Math.random() * particle_stretch
    randomScale[i * 2 + 1] = 0.1 + Math.random() * 0.2
    birthTimes[i] = time
    lifetimes[i] = 0.2 + Math.random() * 0.5
  }

  parent.updateWorldMatrix(true, false)
  const parentInv = new THREE.Matrix4().copy(parent.matrixWorld).invert()
  const tmpWorld = new THREE.Vector3()
  const tmpLocal = new THREE.Vector3()
  const centerWorld = centerLocal.clone().applyMatrix4(parent.matrixWorld)

  type AtomTrack = {
    obj: THREE.Object3D
    startLocal: THREE.Vector3
    startScale: THREE.Vector3
    delay: number
    duration: number
  }

  const atomData: AtomTrack[] = atoms_array.map((atom) => {
    atom.getWorldPosition(tmpWorld)
    tmpLocal.copy(tmpWorld).applyMatrix4(parentInv)
    // Переводим атом в локаль FX-родителя только для трека; анимируем atom.position в его parent.
    const startLocal = atom.position.clone()
    return {
      obj: atom,
      startLocal,
      startScale: atom.scale.clone(),
      delay: Math.random() * atom_delay_max,
      duration: atom_collapse_time,
    }
  })

  // Цель коллапса: world center → local space каждого атома.
  const atomTargets = atoms_array.map((atom) => {
    const target = centerWorld.clone()
    if (atom.parent) {
      atom.parent.worldToLocal(target)
    } else {
      target.set(0, 0, 0)
    }
    return target
  })

  let elapsed = 0
  let spawnAccumulator = 0
  let activeCount = 0
  let phase: 'collapse' | 'burst' | 'hold' | 'fadeout' = 'collapse'
  let finished = false
  let disposed = false

  const collapseEnd = atom_collapse_time + atom_delay_max
  const burstEnd = collapseEnd + burst_time
  const holdEnd = burstEnd + hold_after_grow
  const fadeEnd = holdEnd + fade_out
  const collapseMaxScale = 0.22

  function dispose() {
    if (disposed) return
    disposed = true
    finished = true
    parent.remove(points)
    parent.remove(glow)
    parent.remove(shockwaveFlash)
    parent.remove(coreMesh)
    geometry.dispose()
    material.dispose()
    glowMat.dispose()
    flashMat.dispose()
    glowTex.dispose()
    coreGeo.dispose()
    coreMat.dispose()
  }

  function tick(dtRaw: number): boolean {
    if (finished || disposed) return true
    const dt = Math.min(0.05, Math.max(0.0005, dtRaw))
    elapsed += dt

    if (elapsed >= fadeEnd) {
      dispose()
      return true
    }

    let burstScale = 0
    let fadeMul = 1
    let needsAttribUpdate = false

    if (elapsed < collapseEnd) {
      phase = 'collapse'
      let minAtomT = 1
      if (atomData.length === 0) {
        // Нет Bohr — сразу готовим ядро (как «связь создаётся»).
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
          data.obj.scale.lerpVectors(data.startScale, new THREE.Vector3(0.001, 0.001, 0.001), easeT)
          data.obj.visible = true
        }
        if (minAtomT > 0.85) {
          burstScale = ((minAtomT - 0.85) / 0.15) * collapseMaxScale
        }
      }
    } else if (elapsed < burstEnd) {
      phase = 'burst'
      for (const data of atomData) data.obj.visible = false
      const burstGrowT = clamp01((elapsed - collapseEnd) / burst_time)
      burstScale = collapseMaxScale + easeOutCubic(burstGrowT) * (end_scale - collapseMaxScale)
      spawnAccumulator += particles_per_sec * (0.05 + 0.95 * burstGrowT) * dt
      if (burstGrowT < 0.35) {
        const flashT = burstGrowT / 0.35
        shockwaveFlash.scale.setScalar(20 * easeOutCubic(flashT))
        // opacity спрайта — у material (баг оригинала: shockwaveFlash.opacity)
        flashMat.opacity = 1.0 - easeInOutCubic(flashT)
      } else {
        flashMat.opacity = 0
      }
    } else if (elapsed < holdEnd) {
      phase = 'hold'
      burstScale = end_scale
      spawnAccumulator += particles_per_sec * dt
      flashMat.opacity = 0
    } else {
      phase = 'fadeout'
      const fadeT = clamp01((elapsed - holdEnd) / fade_out)
      fadeMul = 1 - easeInOutCubic(fadeT)
      burstScale = end_scale * fadeMul
      flashMat.opacity = 0
    }

    while (spawnAccumulator >= 1 && activeCount < max_particles) {
      resetParticle(activeCount, elapsed)
      activeCount++
      spawnAccumulator -= 1
      needsAttribUpdate = true
    }

    for (let i = 0; i < activeCount; i++) {
      const age = elapsed - birthTimes[i]!
      if (age > lifetimes[i]!) {
        resetParticle(i, elapsed)
        needsAttribUpdate = true
        continue
      }
      positions[i * 3]! += velocities[i * 3]! * dt
      positions[i * 3 + 1]! += velocities[i * 3 + 1]! * dt
      positions[i * 3 + 2]! += velocities[i * 3 + 2]! * dt
    }

    geometry.attributes.position!.needsUpdate = true
    if (needsAttribUpdate) {
      geometry.attributes.color!.needsUpdate = true
      geometry.attributes.velocity!.needsUpdate = true
      geometry.attributes.randomScale!.needsUpdate = true
    }
    geometry.setDrawRange(0, activeCount)
    material.uniforms.uOpacityMul!.value = phase === 'fadeout' ? fadeMul : 1

    const glowScalar = Math.max(0.0001, 5 * burstScale)
    glow.scale.setScalar(glowScalar)
    glowMat.opacity = Math.min(1, burstScale * 0.85) * fadeMul

    coreMesh.scale.setScalar(Math.max(0.001, burstScale * 0.55))
    coreMat.opacity = Math.min(0.95, burstScale * 0.55) * fadeMul

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
  }
}

/** Профиль: демо-качество / облегчённый для weak GPU. */
export function resolveCollapseOptionsForDevice(lowPower: boolean): ElementsCollapseOptions {
  if (lowPower) {
    return {
      atom_collapse_time: 0.9,
      atom_delay_max: 0.2,
      burst_time: 1.0,
      hold_after_grow: 0.3,
      fade_out: 0.6,
      end_scale: 2.4,
      particles_per_sec: 180,
      max_particles: 700,
      particle_base_size: 48,
      particle_speed: 9,
      particle_stretch: 2.6,
      particle_colors: [...COLLAPSE_DEMO_QUALITY.particle_colors],
    }
  }
  return {
    atom_collapse_time: COLLAPSE_DEMO_QUALITY.atom_collapse_time,
    atom_delay_max: COLLAPSE_DEMO_QUALITY.atom_delay_max,
    burst_time: COLLAPSE_DEMO_QUALITY.burst_time,
    hold_after_grow: COLLAPSE_DEMO_QUALITY.hold_after_grow,
    fade_out: COLLAPSE_DEMO_QUALITY.fade_out,
    end_scale: COLLAPSE_DEMO_QUALITY.end_scale,
    particles_per_sec: COLLAPSE_DEMO_QUALITY.particles_per_sec,
    max_particles: COLLAPSE_DEMO_QUALITY.max_particles,
    particle_base_size: COLLAPSE_DEMO_QUALITY.particle_base_size,
    particle_speed: COLLAPSE_DEMO_QUALITY.particle_speed,
    particle_stretch: COLLAPSE_DEMO_QUALITY.particle_stretch,
    particle_colors: [...COLLAPSE_DEMO_QUALITY.particle_colors],
  }
}
