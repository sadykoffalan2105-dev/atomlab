import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { NaClReactionScene, type NaclSceneOptions } from './NaClReactionScene'

/**
 * Демо сцены NaCl вне лаборатории: WebGLRenderer + EffectComposer (UnrealBloomPass) + OrbitControls
 * и свой цикл кадров. В маршруты приложения НЕ подключено — для запуска на любой странице:
 *
 *   const demo = mountNaClDemo(canvas)
 *   demo.scene.next()      // следующий шаг
 *   demo.dispose()
 *
 * Подписи рисуются простым DOM-слоем поверх канваса (в лаборатории это делает CinemaDomLabels
 * с раскладкой по свободной области).
 */
export function mountNaClDemo(
  canvas: HTMLCanvasElement,
  opts: NaclSceneOptions & { autoplay?: boolean } = {},
): { scene: NaClReactionScene; dispose: () => void } {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  const three = new THREE.Scene()
  three.background = new THREE.Color('#0a0b10')
  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 100)
  camera.position.set(0, 0.4, 9)
  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = true
  controls.target.set(0, 0, 0)

  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(three, camera))
  // Порог высокий: светятся только электрон, его ореол и след (яркость > 1), а не шары ионов.
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.9, 0.5, 0.85)
  composer.addPass(bloom)
  composer.addPass(new OutputPass())

  const scene = new NaClReactionScene({
    ...opts,
    onStatus: (status, step) => {
      opts.onStatus?.(status, step)
      if (opts.autoplay !== false && status === 'paused') window.setTimeout(() => void scene.next(), 1200)
    },
  })
  // Сцена рассчитана на камеру, смотрящую вдоль −z: root остаётся в начале координат.
  three.add(scene.root)

  // ——— DOM-подписи ———
  const host = canvas.parentElement ?? document.body
  const layer = document.createElement('div')
  layer.style.cssText = 'position:absolute; inset:0; pointer-events:none; overflow:hidden; font: 600 13px/1.1 Inter, system-ui, sans-serif;'
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative'
  host.appendChild(layer)
  const nodes = scene.labels.map(() => {
    const el = document.createElement('div')
    el.style.cssText =
      'position:absolute; left:0; top:0; white-space:nowrap; color:#eef6ff; padding:2px 6px; border-radius:6px; background:rgba(6,12,26,0.7); will-change:transform,opacity;'
    layer.appendChild(el)
    return el
  })
  const v = new THREE.Vector3()

  const resize = () => {
    const w = canvas.clientWidth || 800
    const h = canvas.clientHeight || 600
    renderer.setSize(w, h, false)
    composer.setSize(w, h)
    bloom.resolution.set(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  resize()
  const ro = new ResizeObserver(resize)
  ro.observe(canvas)

  const clock = new THREE.Clock()
  let raf = 0
  const loop = () => {
    raf = requestAnimationFrame(loop)
    const dt = clock.getDelta()
    controls.update()
    scene.update(dt, camera)
    composer.render(dt)
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    for (let i = 0; i < nodes.length; i++) {
      const l = scene.labels[i]!
      const el = nodes[i]!
      if (l.opacity <= 0.01) {
        el.style.opacity = '0'
        continue
      }
      v.copy(l.pos).applyMatrix4(scene.root.matrixWorld).project(camera)
      el.textContent = l.text
      el.style.opacity = String(l.opacity)
      el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, -50%)`
    }
  }

  void scene.warmup(renderer, camera, three).then(() => {
    void scene.goToStep(0)
    loop()
  })

  return {
    scene,
    dispose() {
      cancelAnimationFrame(raf)
      ro.disconnect()
      controls.dispose()
      scene.dispose()
      composer.dispose()
      renderer.dispose()
      layer.remove()
    },
  }
}
