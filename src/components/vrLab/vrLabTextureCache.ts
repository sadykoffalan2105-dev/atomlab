import * as THREE from 'three'

/** Общий «стеклянный» материал — один инстанс на всю сцену (быстрее). */
let sharedGlassMaterial: THREE.MeshPhysicalMaterial | null = null

export function getSharedGlassMaterial(): THREE.MeshPhysicalMaterial {
  if (!sharedGlassMaterial) {
    sharedGlassMaterial = new THREE.MeshPhysicalMaterial({
      color: '#f8fbff',
      roughness: 0.06,
      metalness: 0,
      transmission: 0.75,
      thickness: 0.35,
      transparent: true,
      opacity: 0.55,
      ior: 1.52,
      envMapIntensity: 0.8,
    })
  }
  return sharedGlassMaterial
}

/** Ленивый кэш canvas-текстур — создаётся один раз, не блокирует каждый mount. */
const textureCache = new Map<string, THREE.CanvasTexture>()

/** Procedural scratch normal for glass realism. */
export function getGlassScratchNormal(): THREE.CanvasTexture {
  return getCachedCanvasTexture('glass-scratch-normal', () => {
    const size = 256
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#8080ff'
    ctx.fillRect(0, 0, size, size)
    for (let i = 0; i < 120; i++) {
      ctx.strokeStyle = `rgba(${120 + Math.random() * 40},${120 + Math.random() * 40},255,${0.08 + Math.random() * 0.12})`
      ctx.lineWidth = 0.5 + Math.random()
      ctx.beginPath()
      ctx.moveTo(Math.random() * size, Math.random() * size)
      ctx.lineTo(Math.random() * size, Math.random() * size)
      ctx.stroke()
    }
    const tex = new THREE.CanvasTexture(canvas)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(2, 2)
    return tex
  })
}

/** Shared low-poly sphere for molecule LOD dots. */
let moleculeDotGeo: THREE.SphereGeometry | null = null

export function getMoleculeDotGeometry(): THREE.SphereGeometry {
  if (!moleculeDotGeo) moleculeDotGeo = new THREE.SphereGeometry(0.012, 6, 6)
  return moleculeDotGeo
}


export function getCachedCanvasTexture(key: string, factory: () => THREE.CanvasTexture): THREE.CanvasTexture {
  let tex = textureCache.get(key)
  if (!tex) {
    tex = factory()
    textureCache.set(key, tex)
  }
  return tex
}

/** Прогреваем лёгкие текстуры после первого кадра UI. */
export function warmupVrLabTextures(factories: Array<{ key: string; factory: () => THREE.CanvasTexture }>) {
  if (typeof window === 'undefined') return
  const run = () => {
    for (const { key, factory } of factories) {
      if (!textureCache.has(key)) {
        textureCache.set(key, factory())
      }
    }
  }
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(run, { timeout: 1200 })
  } else {
    setTimeout(run, 80)
  }
}
