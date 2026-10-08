/**
 * Установка опыта на рабочем месте стола (локальные координаты: начало — WORK_AREA_CENTER, верх столешницы — y = 0;
 * ничего не выходит за WORK_AREA_SIZE). Цель текущего шага подсвечена; действие — руками:
 *  • нажать (tap) — проигрывается действие шага;
 *  • перетащить / провести (drag / swipe) — палец или мышь ведут прогресс шага (предмет идёт за рукой по своей
 *    траектории); отпустил дальше половины пути или в «магните» у цели — действие засчитано и доигрывается само.
 * Призрачная рука показывает траекторию жеста, пока ученик не начал. Шаги, где нужен реактив со стеллажа,
 * публикуют labEvents 'need' и засчитываются по 'picked'/'placed' этого предмета (или жестом на столе).
 * В момент реакции — labEvents 'focus' (крупный план) и стеклянные подписи наблюдений.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { HOOD_WORK_CENTER, WORK_AREA_CENTER, type ExperimentRigProps, type LabExperimentId } from '../labContract'
import { labEvents, type LabItemId } from '../labEvents'
import { getLabExperiment, LAB_STEP_ACTIONS } from '../../../data/labWorks/labExperiments'
import { RigContext, type RigContextValue } from './rigCore'
import { RIG_FOCUS, RIG_GESTURES, RIG_STEP_SECONDS } from './rigTargets'
import { GestureGhost, ObsLabels } from './rigGuides'
import { auditRig, auditSelfTest } from './dev/rigAudit'
import { Baso4Rig } from './rigs/Baso4Rig'
import { Ch4BurnRig } from './rigs/Ch4BurnRig'
import { H2PracticalRig } from './rigs/H2PracticalRig'
import { ZnHclRig } from './rigs/ZnHclRig'
import { SaltPurifyRig } from './rigs/SaltPurifyRig'
import { Nh3Rig } from './rigs/Nh3Rig'
import { HalogensRig } from './rigs/HalogensRig'
import { WaterOxidesRig } from './rigs/WaterOxidesRig'
import { Co2Rig } from './rigs/Co2Rig'
import { MetalsAcidsRig } from './rigs/MetalsAcidsRig'
import { taskRigFor } from './rigs/tasks/TaskRig'
import { RigScope } from './rigs/tasks/rigSweep'
import { LAB_TASKS } from '../../../data/labTasks/labTasks'
import { LAB_TASK_IDS, type LabTaskId } from '../labContract'

const RIGS: Record<LabExperimentId, ComponentType> = {
  baso4: Baso4Rig,
  'ch4-burn': Ch4BurnRig,
  'zn-hcl': ZnHclRig,
  'h2-practical': H2PracticalRig,
  'salt-purify': SaltPurifyRig,
  nh3: Nh3Rig,
  halogens: HalogensRig,
  'water-oxides': WaterOxidesRig,
  co2: Co2Rig,
  'metals-acids': MetalsAcidsRig,
  ...(Object.fromEntries(LAB_TASK_IDS.map((id) => [id, taskRigFor(id)])) as Record<LabTaskId, ComponentType>),
}

/** Доля пути, после которой отпускание засчитывается; «магнит» — дальше этой доли действие засчитывается сразу. */
const RELEASE_OK = 0.5
const MAGNET = 0.9

export function ExperimentRig(props: ExperimentRigProps) {
  // новый опыт — новая установка (прогресс и анимации с нуля)
  return <RigRunner key={props.experimentId} {...props} />
}

interface Scrub {
  step: number
  target: string
  start: THREE.Vector3
  normal: THREE.Vector3
  dir: THREE.Vector3
  len2: number
  lead: number
  k: number
}

const tmpRay = new THREE.Ray()
const tmpPlane = new THREE.Plane()
const tmpHit = new THREE.Vector3()
const tmpNdc = new THREE.Vector2()
const tmpCaster = new THREE.Raycaster()
const tmpInv = new THREE.Matrix4()

function RigRunner({ experimentId, step, onAdvance, quality, lang }: ExperimentRigProps) {
  const def = getLabExperiment(experimentId)
  const total = def.steps.length
  // начало координат установки: рабочее место стола или вытяжного шкафа (опыты с NH₃, Cl₂, Br₂ — под тягой);
  // крупные планы и звуки считаются от фактического положения группы установки (её ставит сцена)
  const center = def.place === 'hood' ? HOOD_WORK_CENTER : WORK_AREA_CENTER
  const p = useRef(Math.min(step, total))
  const forceP = useRef<number | null>(null)
  const time = useRef(0)
  const anim = useRef<{ from: number; dur: number } | null>(null)
  const advanced = useRef<{ step: number; t: number } | null>(null)
  const scrub = useRef<Scrub | null>(null)
  const root = useRef<THREE.Group>(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const stepRef = useRef(step)
  const advanceRef = useRef(onAdvance)
  useLayoutEffect(() => {
    stepRef.current = step
    advanceRef.current = onAdvance
  })
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const controls = useThree((s) => s.controls)
  const controlsRef = useRef(controls)
  useLayoutEffect(() => {
    controlsRef.current = controls
  })

  const toWorld = useCallback(
    (v: readonly [number, number, number]): [number, number, number] => {
      const g = root.current
      if (!g) return [center.x + v[0], center.y + v[1], center.z + v[2]]
      g.updateWorldMatrix(true, false)
      const w = g.localToWorld(new THREE.Vector3(v[0], v[1], v[2]))
      return [w.x, w.y, w.z]
    },
    [center],
  )

  /** Запустить доигрывание действия шага s с текущего прогресса. */
  const play = useCallback(
    (s: number) => {
      if (anim.current || s >= total) return
      const start = Math.max(s, Math.min(p.current, s + 0.999))
      p.current = start
      const full = RIG_STEP_SECONDS[experimentId][s] ?? 2
      anim.current = { from: s, dur: Math.max(0.35, full) }
      setBusy(true)
    },
    [experimentId, total],
  )

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    time.current += dt
    // отладочный аудит (debugLab=1) держит прогресс на заданном значении
    if (forceP.current != null) {
      p.current = forceP.current
      return
    }
    const a = anim.current
    if (a) {
      if (stepRef.current !== a.from) {
        // шаг сменили на доске во время действия — действие отменяется, прогресс плавно догоняет шаг
        anim.current = null
        setBusy(false)
      } else {
        p.current = Math.min(a.from + 1, p.current + dt / a.dur)
        if (p.current >= a.from + 1 - 1e-6) {
          anim.current = null
          setBusy(false)
          advanced.current = { step: a.from, t: time.current }
          advanceRef.current()
        }
        return
      }
    }
    const sc = scrub.current
    if (sc && sc.step === stepRef.current) {
      // палец ведёт действие: прогресс плавно идёт за ним
      const want = sc.step + sc.k * sc.lead
      p.current += (want - p.current) * (1 - Math.exp(-dt * 16))
      return
    }
    // шаг доигран, а страница ещё не засчитала его (кадр-другой) — прогресс не откатывается назад к старому шагу
    // (иначе он на миг заходит обратно в диапазон крупного плана и камера дёргается)
    const adv = advanced.current
    if (adv) {
      if (stepRef.current === adv.step && time.current - adv.t < 0.6) return
      advanced.current = null
    }
    const target = Math.min(stepRef.current, total)
    const d = target - p.current
    if (Math.abs(d) < 1e-4) p.current = target
    else p.current += d * (1 - Math.exp(-dt * (Math.abs(d) > 1.5 ? 4 : 2.2)))
  })

  const act = useCallback(
    (name: string) => {
      const s = stepRef.current
      if (anim.current || s >= total) return
      if (def.steps[s]?.target !== name) return
      p.current = s
      play(s)
    },
    [def, play, total],
  )

  /** Луч указателя → точка на плоскости жеста (локальные координаты установки). */
  const hitOnPlane = useCallback(
    (clientX: number, clientY: number, sc: Scrub): THREE.Vector3 | null => {
      const g = root.current
      if (!g) return null
      const r = gl.domElement.getBoundingClientRect()
      tmpNdc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1)
      tmpCaster.setFromCamera(tmpNdc, camera)
      tmpInv.copy(g.matrixWorld).invert()
      tmpRay.copy(tmpCaster.ray).applyMatrix4(tmpInv)
      tmpPlane.setFromNormalAndCoplanarPoint(sc.normal, sc.start)
      return tmpRay.intersectPlane(tmpPlane, tmpHit)
    },
    [camera, gl],
  )

  const beginGesture = useCallback(
    (name: string, e: ThreeEvent<PointerEvent>) => {
      const s = stepRef.current
      const gst = RIG_GESTURES[experimentId][s]
      const g = root.current
      if (anim.current || s >= total || !g || !gst || gst.kind === 'tap' || def.steps[s]?.target !== name) return
      const dir = new THREE.Vector3(gst.to[0] - gst.from[0], gst.to[1] - gst.from[1], gst.to[2] - gst.from[2])
      const len2 = Math.max(1e-6, dir.lengthSq())
      // плоскость жеста: содержит направление пути и как можно сильнее обращена к камере
      g.updateWorldMatrix(true, false)
      tmpInv.copy(g.matrixWorld).invert()
      const view = camera.getWorldDirection(new THREE.Vector3()).transformDirection(tmpInv)
      const dn = dir.clone().normalize()
      const normal = view.clone().sub(dn.clone().multiplyScalar(view.dot(dn)))
      if (normal.lengthSq() < 1e-6) normal.set(0, 0, 1)
      normal.normalize()
      const start = g.worldToLocal(e.point.clone())
      const sc: Scrub = { step: s, target: name, start, normal, dir, len2, lead: gst.lead, k: 0 }
      scrub.current = sc
      setDragging(true)
      const ctl = controlsRef.current as unknown as { enabled?: boolean } | null
      if (ctl) ctl.enabled = false
      document.body.style.cursor = 'grabbing'

      const finish = (ok: boolean) => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onCancel)
        if (ctl) ctl.enabled = true
        document.body.style.cursor = ''
        scrub.current = null
        setDragging(false)
        if (ok && stepRef.current === sc.step) play(sc.step)
      }
      const onMove = (ev: PointerEvent) => {
        const hit = hitOnPlane(ev.clientX, ev.clientY, sc)
        if (!hit) return
        const k = hit.sub(sc.start).dot(sc.dir) / sc.len2
        sc.k = Math.max(0, Math.min(1, k))
        // «магнит» в последних сантиметрах — действие засчитано без точного попадания
        if (sc.k >= MAGNET) finish(true)
      }
      const onUp = () => finish(sc.k >= RELEASE_OK)
      const onCancel = () => finish(false)
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onCancel)
    },
    [camera, def, experimentId, hitOnPlane, play, total],
  )

  // Для автоматической проверки жестов (Playwright): …#/vr-lab?debugLab=1 — window.__labGesture() отдаёт экранные
  // точки начала и конца жеста текущего шага (CSS px), как их проходит палец ученика
  useEffect(() => {
    if (typeof window === 'undefined' || !/[?&]debugLab=1/.test(window.location.hash)) return
    const w = window as unknown as { __labGesture?: () => unknown; __labTaskIds?: () => string[] }
    // список готовых задач-опытов — для проверки жестами всех опытов подряд
    w.__labTaskIds = () => LAB_TASKS.map((x) => x.id)
    // ответы учебника текущей задачи-опыта — для автоматической проверки ввода ответа
    ;(window as unknown as { __labTaskBook?: () => number[] | null }).__labTaskBook = () => LAB_TASKS.find((x) => x.id === experimentId)?.answers.map((a) => a.book) ?? null
    w.__labGesture = () => {
      const s = stepRef.current
      const gst = RIG_GESTURES[experimentId][s]
      const g = root.current
      if (!gst || !g || s >= total) return null
      const r = gl.domElement.getBoundingClientRect()
      const px = (v: readonly number[]) => {
        const p = g.localToWorld(new THREE.Vector3(v[0], v[1], v[2])).project(camera)
        return [r.left + ((p.x + 1) / 2) * r.width, r.top + ((1 - p.y) / 2) * r.height]
      }
      // центр невидимой «зоны нажатия» цели (mesh с userData.labTarget) — туда нажимает ученик
      const name = def.steps[s]?.target
      let hit: number[] | null = null
      g.traverse((o) => {
        if (hit || (o.userData as { labTarget?: string }).labTarget !== name) return
        const p = o.getWorldPosition(new THREE.Vector3()).project(camera)
        hit = [r.left + ((p.x + 1) / 2) * r.width, r.top + ((1 - p.y) / 2) * r.height]
      })
      return gst.kind === 'tap' ? { kind: 'tap', step: s, target: name, at: hit } : { kind: gst.kind, step: s, target: name, at: hit, from: px(gst.from), to: px(gst.to) }
    }
    // аудит физики установки: прогресс ставится вручную (setP), audit() — «сквозь стекло» / «висит» по мешам,
    // view() — камера на точку установки (кадры с разных ракурсов)
    const wr = window as unknown as { __labRig?: unknown }
    wr.__labRig = {
      total,
      setP: (v: number | null) => {
        forceP.current = v
        if (v != null) p.current = v
      },
      audit: () => (root.current ? auditRig(root.current) : []),
      selfTest: () => (root.current ? auditSelfTest(root.current) : null),
      view: (pos: readonly number[], target: readonly number[]) =>
        labEvents.emit({ type: 'focus', position: toWorld([pos[0]!, pos[1]!, pos[2]!]), target: toWorld([target[0]!, target[1]!, target[2]!]) }),
    }
    return () => {
      delete w.__labGesture
      delete wr.__labRig
    }
  }, [camera, def, experimentId, gl, total, toWorld])

  // реактив со стеллажа: сцена подсвечивает его; взял/поставил — шаг засчитан
  const need = step < total ? (LAB_STEP_ACTIONS[experimentId][step]?.need ?? null) : null
  useEffect(() => {
    labEvents.emit({ type: 'need', itemIds: need ? [need] : [] })
    if (!need) return
    const onItem = (e: { itemId: LabItemId }) => {
      if (e.itemId !== need) return
      const s = stepRef.current
      const tg = def.steps[s]?.target
      if (tg) act(tg)
    }
    const off1 = labEvents.on('picked', onItem)
    const off2 = labEvents.on('placed', onItem)
    return () => {
      off1()
      off2()
    }
  }, [need, act, def])
  useEffect(() => () => labEvents.emit({ type: 'need', itemIds: [] }), [])

  // крупный план реакции: камера наезжает, потом обратно.
  // focusIdx — крупный план, который сейчас на экране (−1 — общий вид). Новый крупный план — только при действии
  // (доигрывание шага, а не перемотка доской и не середина перетаскивания: камера не уезжает из-под пальца).
  // Общий вид возвращается, только когда крупного плана больше нет: между двумя крупными планами одного действия
  // камера ждёт на первом и перелетает ко второму; на стыке шагов — тоже, если цель следующего жеста видна в кадре.
  const focusIdx = useRef(-1)
  const inViewCache = useRef({ key: '', value: false })
  /** Цель шага s (и конец жеста) видна в середине кадра текущей камеры — ученик сделает жест, не уходя с крупного плана. */
  const stepTargetInView = useCallback(
    (s: number) => {
      // пересчёт, когда камера сдвинулась (≈5 см) — пока она летит к крупному плану, ответ меняется
      const c = camera.position
      const key = `${focusIdx.current}:${s}:${Math.round(c.x * 20)},${Math.round(c.y * 20)},${Math.round(c.z * 20)}`
      if (inViewCache.current.key === key) return inViewCache.current.value
      const g = root.current
      const name = def.steps[s]?.target
      let value = false
      if (g && name && !LAB_STEP_ACTIONS[experimentId][s]?.need) {
        const pts: THREE.Vector3[] = []
        g.traverse((o) => {
          if (!pts.length && (o.userData as { labTarget?: string }).labTarget === name) pts.push(o.getWorldPosition(new THREE.Vector3()))
        })
        const gst = RIG_GESTURES[experimentId][s]
        if (pts.length && gst && gst.kind !== 'tap') pts.push(g.localToWorld(new THREE.Vector3(gst.to[0], gst.to[1], gst.to[2])))
        value =
          pts.length > 0 &&
          pts.every((w) => {
            w.project(camera)
            return Math.abs(w.z) < 1 && Math.abs(w.x) < 0.6 && w.y > -0.55 && w.y < 0.7
          })
      }
      inViewCache.current = { key, value }
      return value
    },
    [camera, def, experimentId],
  )
  useFrame(() => {
    if (forceP.current != null) return
    const v = p.current
    const list = RIG_FOCUS[experimentId]
    let idx = -1
    for (let i = 0; i < list.length; i++) if (v >= list[i]!.from && v < list[i]!.to) idx = i
    const a = anim.current
    const shown = focusIdx.current
    if (idx >= 0 && a) {
      if (idx !== shown) {
        focusIdx.current = idx
        const f = list[idx]!
        const target = toWorld(f.point)
        const position: [number, number, number] = [target[0] + f.dist * 0.18, target[1] + f.dist * 0.42, target[2] + f.dist * 0.9]
        labEvents.emit({ type: 'focus', position, target })
      }
      return
    }
    if (shown < 0 || idx === shown) return
    // крупный план на экране, а прогресс вышел из его диапазона: ждать следующий или вернуть общий вид
    let next = Infinity
    for (const f of list) if (f.from > v - 1e-6 && f.from < next) next = f.from
    const sc = scrub.current
    const rest = !a && !sc && Math.abs(v - Math.round(v)) < 0.02
    // шаг, в котором сейчас прогресс: действие, перетаскивание или покой после шага
    const s = a ? a.from : sc ? sc.step : rest ? Math.round(v) : -1
    let hold = false
    if (s >= 0 && next < s + 1) hold = a != null || sc != null || stepTargetInView(s)
    else if (a && next < s + 1.35) hold = stepTargetInView(s + 1)
    if (hold) return
    focusIdx.current = -1
    labEvents.emit({ type: 'focusReset' })
  })
  useEffect(
    () => () => {
      if (focusIdx.current >= 0) labEvents.emit({ type: 'focusReset' })
    },
    [],
  )

  const gesture = step < total ? (RIG_GESTURES[experimentId][step] ?? null) : null
  const activeTarget = !busy && step < total ? (def.steps[step]?.target ?? null) : null
  const ctx = useMemo<RigContextValue>(
    () => ({ p, time, quality, lang, activeTarget, act, gesture, beginGesture, dragging, toWorld }),
    [quality, lang, activeTarget, act, gesture, beginGesture, dragging, toWorld],
  )
  const Rig = RIGS[experimentId]
  return (
    <RigContext.Provider value={ctx}>
      <group ref={root} name={`lab3d-rig:${experimentId}`}>
        {/* RigScope: после смены опыта освобождает материалы прошлой установки (их программы шейдеров) */}
        <RigScope key={experimentId}>
          <Rig />
        </RigScope>
        {activeTarget && gesture && gesture.kind !== 'tap' && !dragging ? <GestureGhost gesture={gesture} /> : null}
        <ObsLabels experimentId={experimentId} />
      </group>
    </RigContext.Provider>
  )
}
