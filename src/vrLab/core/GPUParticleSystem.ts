import * as THREE from 'three'

export type GPUParticleMode = 'steam' | 'dust'

export type GPUParticleSeed = {
  x: number
  y: number
  z: number
  speed: number
  phase: number
  size: number
  drift: number
}

const DUMMY = new THREE.Object3D()

/** CPU-matrix instanced particles — zero alloc per frame. */
export class GPUParticleSystem {
  readonly mesh: THREE.InstancedMesh
  readonly seeds: GPUParticleSeed[]
  private readonly mode: GPUParticleMode
  private tickAcc = 0

  constructor(
    count: number,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    mode: GPUParticleMode,
    initFn: (i: number, count: number) => GPUParticleSeed,
  ) {
    this.mode = mode
    this.seeds = Array.from({ length: count }, (_, i) => initFn(i, count))
    this.mesh = new THREE.InstancedMesh(geometry, material, count)
    this.mesh.count = count
    this.mesh.frustumCulled = mode === 'steam'
  }

  tick(elapsed: number, dt: number, intensity: number, spread: number, gasPlume: boolean) {
    if (intensity < 0.02) {
      this.mesh.count = 0
      return
    }

    this.tickAcc += dt
    const throttle = this.mode === 'dust' ? 1 / 20 : 1 / 30
    if (this.tickAcc < throttle) return
    this.tickAcc = 0

    this.mesh.count = this.seeds.length
    const maxY = this.mode === 'steam' ? 0.42 + spread * 0.3 : 1.35
    const minY = this.mode === 'dust' ? 0.12 : 0
    const speedMul = intensity * (gasPlume ? 1.35 : 1)

    for (let i = 0; i < this.seeds.length; i++) {
      const s = this.seeds[i]!
      if (this.mode === 'steam') {
        s.y += s.speed * speedMul * 0.033
        const curl =
          Math.sin(elapsed * 1.8 + s.phase) * 0.012 * intensity +
          Math.cos(elapsed * 1.3 + s.phase * 1.7) * 0.008 * intensity
        s.x += Math.sin(elapsed * 1.8 + s.phase) * 0.0004 * intensity
        s.z += Math.cos(elapsed * 2.1 + s.phase) * 0.0004 * intensity
        if (s.y > maxY) {
          s.y = 0
          s.x = (Math.random() - 0.5) * spread * 0.8
          s.z = (Math.random() - 0.5) * spread * 0.8
        }
        DUMMY.position.set(s.x + curl, s.y + 0.06, s.z)
        DUMMY.scale.setScalar(s.size * (0.8 + intensity * 0.5))
      } else {
        s.y += dt * s.speed
        s.x += Math.sin(elapsed * 0.4 + s.phase) * dt * s.drift
        if (s.y > maxY) s.y = minY
        DUMMY.position.set(s.x, s.y, s.z)
        DUMMY.scale.setScalar(s.size)
      }
      DUMMY.updateMatrix()
      this.mesh.setMatrixAt(i, DUMMY.matrix)
    }
    this.mesh.instanceMatrix.needsUpdate = true

    const mat = this.mesh.material as THREE.MeshStandardMaterial
    if (this.mode === 'steam') {
      mat.opacity = Math.min(1, intensity * (gasPlume ? 0.38 : 0.28))
      mat.emissiveIntensity = 0.4 + intensity * 0.6
    }
  }

  dispose() {
    this.mesh.geometry.dispose()
    if (Array.isArray(this.mesh.material)) {
      this.mesh.material.forEach((m) => m.dispose())
    } else {
      this.mesh.material.dispose()
    }
  }
}
