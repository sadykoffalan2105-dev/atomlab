/**
 * «Как образуется» в реакторе: окно показа пути получения вещества именно этой реакцией (CO₂: горение угля,
 * мрамор + кислота, обжиг известняка). 3D-сцена — чистые функции времени; шкала этапов, подписи, карточка фактов,
 * ⏮ ⏯ ⏭, скорость 0,5× / 1× / 1,5×, ползунок, переключатель путей. Esc — закрыть, ← → — этапы, пробел — пауза.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { createPortal } from 'react-dom'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useLocale } from '../../../../i18n/useLocale'
import { CanvasErrorBoundary } from '../../../common/CanvasErrorBoundary'
import { CanvasSceneErrorFallback } from '../../../common/CanvasSceneErrorFallback'
import { SCHOOL_CATALOG_BG } from '../../hero/SchoolCatalogCanvas'
import { Backdrop, ShowcaseClock } from '../showcase/kit/core'
import type { CamCtl } from '../showcase/types'
import { camAt, type RouteModel } from './geom'
import { ROUTE_SCENES } from './registry'
import { siblingRoutes, type ReactorRouteId } from './routeIndex'
import { ROUTE_TEXTS, ROUTE_UI } from './texts/co2Routes'
import { RouteStagePanel } from './RouteStagePanel'
import styles from './RouteFormation.module.css'

type Clock = { t: number; playing: boolean }
const FILL = 0.86
const FOV = 38
/** Телефон / сенсорный экран: облегчённый показ (без следов электронов, меньше частиц фона). */
function isLowPowerDevice(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(max-width: 700px), (pointer: coarse)').matches
}

/** Камера и «фокус» сцены: ведёт сцена (ключи модели), пользователь может крутить — 3 с сцена не вмешивается. */
function RouteRig({ model, clock, cam, focusRef }: { model: RouteModel; clock: MutableRefObject<Clock>; cam: MutableRefObject<CamCtl>; focusRef: MutableRefObject<THREE.Group | null> }) {
  const dir = useRef(new THREE.Vector3(0, 0, 1))
  const want = useRef(new THREE.Vector3())
  const cur = useRef<{ z: number; f: THREE.Vector3 } | null>(null)
  useFrame((state, dt) => {
    const camera = state.camera as THREE.PerspectiveCamera
    const t = clock.current.t
    const k = camAt(model.cam, t)
    const d = Math.min(0.1, Math.max(0.001, dt))
    const c = cur.current ?? (cur.current = { z: k.zoom, f: new THREE.Vector3(...k.focus) })
    const kk = 1 - Math.exp(-d * 4)
    c.z += (k.zoom - c.z) * kk
    c.f.lerp(want.current.set(...k.focus), kk)
    if (focusRef.current) focusRef.current.position.set(-c.f.x, -c.f.y, -c.f.z)
    const L0 = camera.position.length() || 4
    if (performance.now() > cam.current.userUntil) {
      const yaw = k.yaw + 0.08 * Math.sin(0.33 * t)
      const pitch = Math.max(-1.2, Math.min(1.2, k.pitch + 0.03 * Math.sin(0.27 * t + 1)))
      want.current.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch))
      dir.current.copy(camera.position).divideScalar(L0)
      dir.current.lerp(want.current, 1 - Math.exp(-d * 2.2)).normalize()
    } else dir.current.copy(camera.position).divideScalar(L0)
    const aspect = state.size.width / Math.max(1, state.size.height)
    const tanH = Math.tan((FOV * Math.PI) / 360)
    const dist = model.fit / (FILL * tanH * Math.min(1, aspect) * Math.max(0.5, c.z))
    camera.position.copy(dir.current).multiplyScalar(dist)
    camera.lookAt(0, 0, 0)
    camera.near = Math.max(0.01, dist - 4)
    camera.far = dist + 8
    camera.updateProjectionMatrix()
  })
  return null
}

function useRouteClock(total: number) {
  const clock = useRef<Clock>({ t: 0, playing: true })
  const speedRef = useRef(1)
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeedState] = useState(1)
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000))
      last = now
      const c = clock.current
      if (c.playing) {
        c.t = Math.min(total, c.t + dt * speedRef.current)
        if (c.t >= total) {
          c.playing = false
          setPlaying(false)
        }
      }
      const shown = Math.round(c.t * 10) / 10
      setTime((p) => (p === shown ? p : shown))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [total])
  const toggle = useCallback(() => {
    const c = clock.current
    if (!c.playing && c.t >= total) c.t = 0
    c.playing = !c.playing
    setPlaying(c.playing)
  }, [total])
  const seek = useCallback((t: number) => {
    clock.current.t = Math.max(0, Math.min(total, t))
  }, [total])
  const replay = useCallback(() => {
    clock.current = { t: 0, playing: true }
    setPlaying(true)
  }, [])
  const setSpeed = useCallback((x: number) => {
    speedRef.current = x
    setSpeedState(x)
  }, [])
  return { clock, time, playing, speed, toggle, seek, replay, setSpeed }
}

export default function RouteFormationModal({ routeId, onClose }: { routeId: ReactorRouteId; onClose: () => void }) {
  const [id, setId] = useState<ReactorRouteId>(routeId)
  return <RoutePlayer key={id} id={id} onSwitch={setId} onClose={onClose} />
}

function RoutePlayer({ id, onSwitch, onClose }: { id: ReactorRouteId; onSwitch: (id: ReactorRouteId) => void; onClose: () => void }) {
  const { locale } = useLocale()
  const L: 0 | 1 | 2 = locale === 'en' ? 1 : locale === 'uz' ? 2 : 0
  const def = ROUTE_SCENES[id]
  const model = useMemo(() => def.model(), [def])
  const tx = ROUTE_TEXTS[id]
  const total = model.stages.total
  const { clock, time, playing, speed, toggle, seek, replay, setSpeed } = useRouteClock(total)
  const cam = useRef<CamCtl>({ active: true, yaw: 0, pitch: 0, zoom: 1, userUntil: 0 })
  const focusRef = useRef<THREE.Group | null>(null)
  const clockFn = useMemo(() => () => clock.current.t, [clock])
  const lowPower = useMemo(() => isLowPowerDevice(), [])
  const closeBtn = useRef<HTMLButtonElement>(null)
  const stages = model.stages.list
  const prev = useCallback(() => {
    const t = clock.current.t
    let k = 0
    for (let j = 0; j < stages.length; j++) if (t >= stages[j]!.t0) k = j
    const j = t - stages[k]!.t0 > 1.2 ? k : Math.max(0, k - 1)
    clock.current.t = stages[j]!.t0
  }, [clock, stages])
  const next = useCallback(() => {
    const t = clock.current.t
    let k = 0
    for (let j = 0; j < stages.length; j++) if (t >= stages[j]!.t0) k = j
    clock.current.t = k + 1 < stages.length ? stages[k + 1]!.t0 : total
  }, [clock, stages, total])

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    closeBtn.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        next()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        prev()
      } else if (e.key === ' ' && el?.tagName !== 'BUTTON') {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      before?.focus?.()
    }
  }, [onClose, next, prev, toggle])

  const Scene = def.Scene
  return createPortal(
    <div className={styles.backdrop} onClick={(e) => e.target === e.currentTarget && onClose()} data-route-formation={id}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="route-formation-title">
        <header className={styles.head}>
          <div className={styles.headText}>
            <h2 id="route-formation-title" className={styles.title}>
              {ROUTE_UI.heading[L]} · {tx.title[L]}
            </h2>
            <p className={styles.equation}>{tx.equation}</p>
          </div>
          <button ref={closeBtn} type="button" className={styles.close} onClick={onClose} aria-label={ROUTE_UI.close[L]} title={ROUTE_UI.close[L]}>
            ×
          </button>
        </header>
        <div className={styles.body}>
          <div className={styles.stage}>
            <CanvasErrorBoundary fallback={<CanvasSceneErrorFallback />} resetKey={`route-${id}`}>
              <Canvas camera={{ position: [0, 0.3, 4], fov: FOV }} gl={{ antialias: !lowPower, alpha: false, powerPreference: lowPower ? 'default' : 'high-performance' }} dpr={lowPower ? [1, 1.25] : [1, 1.75]}>
                <color attach="background" args={[SCHOOL_CATALOG_BG]} />
                <ShowcaseClock value={clockFn}>
                  <RouteRig model={model} clock={clock} cam={cam} focusRef={focusRef} />
                  <Backdrop lowPower={lowPower} />
                  <group ref={focusRef}>
                    <Scene model={model} L={L} tags={tx.tags} lowPower={lowPower} />
                  </group>
                </ShowcaseClock>
                <OrbitControls enableZoom={false} enablePan={false} rotateSpeed={0.6} onStart={() => { cam.current.userUntil = performance.now() + 3000 }} />
              </Canvas>
            </CanvasErrorBoundary>
          </div>
          <RouteStagePanel id={id} model={model} L={L} time={time} playing={playing} speed={speed} toggle={toggle} seek={seek} replay={replay} setSpeed={setSpeed} prev={prev} next={next} siblings={siblingRoutes(id)} onSwitch={onSwitch} />
        </div>
      </div>
    </div>,
    document.body,
  )
}
