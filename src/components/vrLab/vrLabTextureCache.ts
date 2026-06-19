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
