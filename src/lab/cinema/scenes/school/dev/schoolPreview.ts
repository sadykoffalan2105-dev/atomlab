import * as THREE from 'three'
import { SchoolReactionScene } from '../SchoolReactionScene'
import { H2O_SPEC } from '../../h2o/h2oSpec'
import { FIX_CO, FIX_NH4CL, FIX_NO2 } from '../schoolFixtures'
import { EQUATION_PART_SEP } from '../schoolModel'
import { NO_SCENE_SPEC } from '../../no/noSpec'
import { NO2_SCENE_SPEC } from '../../no2/no2Spec'
import { N2O_SCENE_SPEC } from '../../n2o/n2oSpec'
import { N2O5_SCENE_SPEC } from '../../n2o5/n2o5Spec'
import type { SchoolSceneSpec } from '../schoolSpec'
import { CO2_SCHOOL_SPEC } from '../../co2/co2Spec'
import { CO_SCHOOL_SPEC } from '../../co/coSpec'
import { SO2_SCHOOL_SPEC } from '../../so2/so2Spec'
import { SO3_SCHOOL_SPEC } from '../../so3/so3Spec'
import type { SchoolRuntimeScene } from '../schoolRuntime'
import { SolutionExchangeScene } from '../solution/SolutionExchangeScene'
import { BASO4_SOLUTION_SPEC } from '../solution/solutionSpec'

/**
 * ПРЕДПРОСМОТР школьной сцены без лаборатории (только для разработки: `npx vite` →
 * /school-preview.html?spec=h2o&t=12.5&lang=ru, ?play — проиграть все шаги подряд).
 * Нужен, чтобы автор спецификации сразу видел кадр: сцену рисует тот же класс SchoolReactionScene,
 * подписи — простой DOM-слой. Новая спецификация добавляется в SPECS одной строкой.
 */

const SPECS: Record<string, SchoolSceneSpec> = {
  h2o: H2O_SPEC,
  co2: CO2_SCHOOL_SPEC,
  co: CO_SCHOOL_SPEC,
  so2: SO2_SCHOOL_SPEC,
  so3: SO3_SCHOOL_SPEC,
  no: NO_SCENE_SPEC,
  no2: NO2_SCENE_SPEC,
  n2o: N2O_SCENE_SPEC,
  n2o5: N2O5_SCENE_SPEC,
  'fixture-co': FIX_CO,
  'fixture-no2': FIX_NO2,
  'fixture-nh4cl': FIX_NH4CL,
}

const q = new URLSearchParams(location.search)
const specId = q.get('spec') ?? 'h2o'
const spec = SPECS[specId] ?? H2O_SPEC
const lang = q.get('lang')
const locale = lang === 'en' || lang === 'uz' ? lang : 'ru'
const t0 = Number(q.get('t') ?? '0')

const LABEL_STYLE: Record<string, string> = {
  atom: 'font:700 16px/1 Inter,system-ui,sans-serif;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.9),0 0 8px rgba(0,0,0,.55);',
  atomDark: 'font:700 16px/1 Inter,system-ui,sans-serif;color:#111822;text-shadow:0 0 3px rgba(255,255,255,.75);',
  species: 'font:600 14px/1.1 Inter,system-ui,sans-serif;color:#f4f8ff;text-shadow:0 0 6px rgba(0,0,0,.95);',
  measure:
    'font:600 12.5px/1 Inter,system-ui,sans-serif;color:#cfeeff;padding:3px 7px;border-radius:6px;background:rgba(6,12,26,.78);border:1px solid rgba(150,205,255,.35);',
  token: 'font:700 13px/1 Inter,system-ui,sans-serif;color:#fff3c4;text-shadow:0 0 10px rgba(255,190,80,.9);',
  equation: 'font:600 15px/1.1 Inter,system-ui,sans-serif;color:#f4f8ff;text-shadow:0 0 6px rgba(0,0,0,.95);',
}

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.toneMapping = THREE.ACESFilmicToneMapping
document.body.style.cssText = 'margin:0;background:#0a0b10;overflow:hidden'
document.body.appendChild(renderer.domElement)
const layer = document.createElement('div')
layer.style.cssText = 'position:fixed;inset:0;pointer-events:none'
document.body.appendChild(layer)

const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 400)
camera.position.set(0, 0, 9)
camera.lookAt(0, 0, 0)
const scene = new THREE.Scene()
scene.background = new THREE.Color('#0a0b10')
// Сцены «обмен в растворе» (school/solution) — свой класс с тем же интерфейсом.
const sch: SchoolRuntimeScene = specId === 'baso4' ? new SolutionExchangeScene(BASO4_SOLUTION_SPEC, { locale }) : new SchoolReactionScene(spec, { locale })
scene.add(sch.root)

const els = sch.labels.map((l) => {
  const el = document.createElement('div')
  el.style.cssText = `position:absolute;left:0;top:0;white-space:nowrap;${LABEL_STYLE[l.kind] ?? LABEL_STYLE.species}`
  layer.appendChild(el)
  return el
})

const ext = { w: 1, h: 1, cx: 0, cy: 0 }
const v = new THREE.Vector3()
function fit(): void {
  const w = window.innerWidth
  const h = window.innerHeight
  const px = h / (2 * 9 * Math.tan((camera.fov * Math.PI) / 360))
  sch.extentAt(sch.time, ext)
  const s = 0.9 * Math.min(w / px / ext.w, h / px / ext.h)
  sch.root.position.set(-ext.cx * s, -ext.cy * s, 0)
  sch.root.scale.setScalar(s)
  sch.setViewport(h, camera.fov)
}

let last = performance.now()
function frame(now: number): void {
  const dt = (now - last) / 1000
  last = now
  fit()
  sch.update(dt, camera)
  renderer.render(scene, camera)
  const w = window.innerWidth
  const h = window.innerHeight
  sch.root.updateMatrixWorld()
  sch.labels.forEach((l, i) => {
    const el = els[i]!
    if (l.opacity < 0.01) {
      el.style.display = 'none'
      return
    }
    v.copy(l.pos).applyMatrix4(sch.root.matrixWorld).project(camera)
    el.style.display = 'block'
    // Уравнение итога: условие над стрелкой в предпросмотре — в скобках после стрелки.
    const parts = l.text.split(EQUATION_PART_SEP)
    el.textContent = parts.length === 4 ? `${parts[0]} ${parts[1]}(${parts[2]}) ${parts[3]}` : l.text
    el.style.opacity = String(l.opacity)
    el.style.transform = `translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px) translate(-50%, -50%)`
  })
  requestAnimationFrame(frame)
}

const w = window as unknown as Record<string, unknown>
w.__schoolSeek = (t: number) => sch.seek(t)
void sch.warmup(renderer, camera, scene).then(async () => {
  sch.seek(t0)
  w.__schoolReady = true
  if (q.has('play')) {
    for (let i = sch.model.timing.stepIndexAt(t0); i < sch.stepCount; i++) await sch.goToStep(i)
    await sch.finish()
  }
})
requestAnimationFrame(frame)
