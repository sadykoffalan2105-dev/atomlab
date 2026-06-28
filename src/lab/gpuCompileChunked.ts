import type * as THREE from 'three'

const MESHES_PER_FRAME = 3

/**
 * Разбивает compile молекулы на несколько кадров — меньше hitch на main thread.
 * Завершает compileAsync(root) когда все меши прошли gl.compile по частям.
 */
export function compileObjectTreeChunked(
  gl: THREE.WebGLRenderer,
  root: THREE.Object3D,
  camera: THREE.Camera,
  scene: THREE.Scene,
  invalidate: () => void,
  onDone: () => void,
  opts?: { skipCompileAsync?: boolean },
): () => void {
  const meshes: THREE.Object3D[] = []
  root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) meshes.push(obj)
  })

  if (meshes.length === 0) {
    onDone()
    return () => {}
  }

  let idx = 0
  let cancelled = false

  const finish = () => {
    if (cancelled) return
    if (opts?.skipCompileAsync) {
      onDone()
      return
    }
    const compileAsync = gl.compileAsync?.bind(gl)
    if (compileAsync) {
      compileAsync(root, camera, scene)
        .then(() => {
          if (!cancelled) onDone()
        })
        .catch(() => {
          if (!cancelled) onDone()
        })
    } else {
      onDone()
    }
  }

  const step = () => {
    if (cancelled) return
    const end = Math.min(idx + MESHES_PER_FRAME, meshes.length)
    for (; idx < end; idx++) {
      try {
        gl.compile(meshes[idx]!, camera, scene)
      } catch {
        /* ignore single mesh compile errors */
      }
    }
    invalidate()
    if (idx >= meshes.length) {
      finish()
      return
    }
    requestAnimationFrame(step)
  }

  requestAnimationFrame(step)
  return () => {
    cancelled = true
  }
}
