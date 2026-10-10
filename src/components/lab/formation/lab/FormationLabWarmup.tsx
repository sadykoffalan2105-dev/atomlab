/**
 * Прогрев GPU показа «Как образуется» в лаборатории: пока реактор открыт и простаивает, вещество кнопки
 * (formationWarm) монтируется крошечной группой перед камерой (scale 1e-4 — меньше пикселя) с теми же 5
 * плоскостями отсечения, что у показа, и gl.compileAsync отдаёт его программы драйверу без блокировки кадров.
 *
 * Почему с плоскостями: ключ программы three включает число плоскостей отсечения; compile() берёт его из
 * состояния последней отрисовки, поэтому перед compileAsync рисуется пустышка с 5 плоскостями (gl.localClippingEnabled).
 * Почему группа живёт после прогрева (скрытая): при размонтировании материалы освобождаются, и программы
 * с нулём пользователей удаляются — боевой показ должен успеть их забрать. Через 1,5 с после старта показа
 * (или при смене вещества) группа уходит.
 */
import { Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { formationPlan } from '../../../../chemistry/formationPlan'
import { compoundById } from '../../../../data/compounds'
import { buildSchoolHeroModel } from '../../hero/schoolHeroModel'
import { useCloudsOn } from '../board/cloudsStore'
import { FormationClouds } from '../FormationClouds'
import { FormationMoleculeView } from '../FormationMoleculeView'
import { FormationPhaseScene } from '../FormationPhaseScene'
import { formationStoryFor } from '../formationStory'
import type { FormationClock } from '../formationTimeline'
import { ShowcaseBounds, ShowcaseClock } from '../showcase/kit/core'
import { showcaseSceneFor } from '../showcase/registry'
import type { CamCtl } from '../showcase/types'
import { formationGpuReady, formationWarm } from './formationLabIndex'

/** Страховка: дольше прогрев не держит группу (compileAsync завис / нет расширения). */
const WARM_TIMEOUT_MS = 4000
/** Сколько группа живёт после старта показа — боевые материалы забирают готовые программы. */
const HOLD_AFTER_SHOW_MS = 1500

const _f = new THREE.Vector3()

function useWarmTarget(): string | null {
  return useSyncExternalStore(formationWarm.subscribe, formationWarm.get, formationWarm.get)
}

export default function FormationLabWarmup({ lowPower, busy }: { lowPower: boolean; busy: boolean }) {
  const id = useWarmTarget()
  const [hold, setHold] = useState(!busy)
  const [rev, setRev] = useState(0)
  // Показ / синтез стартовал — через 1,5 с прогревочная группа уходит; кончился — греем снова (материалы показа
  // освобождены вместе с программами), но не сразу: рождение продукта важнее.
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      if (!busy) return
    }
    const timer = busy
      ? window.setTimeout(() => setHold(false), HOLD_AFTER_SHOW_MS)
      : window.setTimeout(() => {
          formationGpuReady.clear()
          setHold(true)
          setRev((n) => n + 1)
        }, 2500)
    return () => window.clearTimeout(timer)
  }, [busy])
  if (!id || !hold) return null
  return <WarmOne key={`${id}-${rev}`} id={id} lowPower={lowPower} />
}

function WarmOne({ id, lowPower }: { id: string; lowPower: boolean }) {
  const shape = compoundById[id]
  const model = useMemo(() => (shape ? buildSchoolHeroModel(shape) : null), [shape])
  const plan = useMemo(() => formationPlan(id), [id])
  const story = useMemo(() => formationStoryFor(id), [id])
  const Scene = useMemo(() => showcaseSceneFor(id), [id])
  const cloudsOn = useCloudsOn()
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const invalidate = useThree((s) => s.invalidate)
  const wrap = useRef<THREE.Group>(null)
  // часы прогрева стоят на итоге: видны и решётка, и копии фазы, и облака
  const clock = useRef<FormationClock>({ t: story ? Math.max(0, story.total - 0.5) : 0, playing: false })
  const clockFn = useMemo(() => () => clock.current.t, [])
  const cam = useRef<CamCtl>({ active: false, yaw: 0, pitch: 0.12, zoom: 1, userUntil: 0 })
  const bounds = useRef({ dx: 0, dy: 0 })
  const st = useRef({ frame: 0, started: false, done: false })
  const dummy = useMemo(() => {
    const planes = [0, 1, 2, 3, 4].map(() => new THREE.Plane(new THREE.Vector3(0, 0, -1), 1e6))
    const mat = new THREE.MeshBasicMaterial({ clippingPlanes: planes })
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1e-6, 1e-6), mat)
    mesh.frustumCulled = false
    const sc = new THREE.Scene()
    sc.add(mesh)
    return { planes, mat, mesh, sc }
  }, [])
  useEffect(
    () => () => {
      dummy.mat.dispose()
      dummy.mesh.geometry.dispose()
    },
    [dummy],
  )
  // кадры, пока идёт прогрев (сцена лаборатории может рисовать по требованию)
  useEffect(() => {
    let raf = 0
    const tick = () => {
      if (st.current.done) return
      invalidate()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [invalidate])

  useFrame((state) => {
    const g = wrap.current
    if (!g || st.current.done) return
    // крошечная группа прямо перед камерой: в кадре её не видно, но она в пирамиде видимости
    state.camera.getWorldDirection(_f)
    g.position.copy(state.camera.position).addScaledVector(_f, 2)
    g.scale.setScalar(1e-4)
    st.current.frame++
    // 2 кадра — дети заполняют инстансы (цвета, матрицы), потом один раз компилируем
    if (st.current.frame < 3 || st.current.started) return
    st.current.started = true
    const used: THREE.Material[] = []
    g.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined
      if (!m) return
      for (const mm of Array.isArray(m) ? m : [m]) {
        if (mm.clippingPlanes === dummy.planes) continue
        mm.clippingPlanes = dummy.planes
        mm.needsUpdate = true
        used.push(mm)
      }
    })
    const prevLocal = gl.localClippingEnabled
    gl.localClippingEnabled = true
    let p: Promise<unknown> = Promise.resolve()
    try {
      // пустышка с 5 плоскостями: compile() возьмёт число плоскостей из этой отрисовки
      const autoClear = gl.autoClear
      gl.autoClear = false
      gl.render(dummy.sc, state.camera)
      gl.autoClear = autoClear
      p = gl.compileAsync ? gl.compileAsync(g, state.camera, scene) : Promise.resolve(gl.compile(g, state.camera, scene))
    } catch {
      /* прогрев — не обязанность: показ скомпилирует сам */
    }
    gl.localClippingEnabled = prevLocal
    // общие (кешированные) материалы — назад без плоскостей сразу: программы с плоскостями уже в кеше
    for (const m of used) {
      m.clippingPlanes = null
      m.needsUpdate = true
    }
    const finish = () => {
      if (st.current.done) return
      st.current.done = true
      g.visible = false
      formationGpuReady.add(id)
      try {
        performance.mark('formation-lab:gpu-ready')
      } catch {
        /* нет User Timing */
      }
    }
    const timer = window.setTimeout(finish, WARM_TIMEOUT_MS)
    void p.then(finish, finish).finally(() => window.clearTimeout(timer))
  })

  if (!model || !plan || !story) return null
  return (
    <group ref={wrap} name="formation-lab-warmup" scale={1e-4}>
      <Suspense fallback={null}>
        <FormationMoleculeView model={model} plan={plan} story={story} clock={clock} fitRadius={model.kind === 'crystal' ? 1.1 : 1} lowPower={lowPower} hideElectrons={!!Scene && Scene.hideElectrons !== false}>
          {Scene ? (
            <ShowcaseClock value={clockFn}>
              <ShowcaseBounds value={bounds}>
                <Scene model={model} plan={plan} story={story} clock={clock} cam={cam} lowPower={lowPower} />
              </ShowcaseBounds>
            </ShowcaseClock>
          ) : (
            <FormationPhaseScene model={model} story={story} clock={clock} lowPower={lowPower} />
          )}
        </FormationMoleculeView>
        {cloudsOn && !Scene ? <FormationClouds model={model} story={story} clock={clock} lowPower={lowPower} /> : null}
      </Suspense>
    </group>
  )
}
