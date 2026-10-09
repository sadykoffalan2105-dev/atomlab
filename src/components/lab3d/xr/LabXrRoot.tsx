/**
 * VR-слой лаборатории (внутри <Canvas>, без пропсов): регистрирует рендерер для входа в сессию, контроллеры
 * (свой «пульт» и луч, без загрузки моделей из сети), взаимодействие лучом, площадки телепорта, поворот рывком,
 * затемнение при перемещении, VR-доску и наручный HUD. Эмуляция без шлема — …?xrEmulate=1: луч из камеры через
 * мышь, нажатие кнопки мыши = select, колесо = squeeze (следующая площадка).
 */
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { labEvents } from '../labEvents'
import { labAudio } from '../audio/labAudio'
import { getLabExperiment, isLabExperimentId } from '../../../data/labWorks/labExperiments'
import { labXr, useXrState, type LabXrStand } from './labXrStore'
import { XrRayInput, makePointer, type XrHand, type XrPointerState } from './xrRayInput'
import { registerXrRenderer, xrEmulateRequested } from './xrSession'
import { XR_STANDS, XR_STAND_ORDER, addSnapTurn, applyStand, emuLook, emulatedCameraPose } from './xrLocomotion'
import { XrBoardPanel } from './XrBoardPanel'
import { XrWristHud } from './XrWristHud'

const RAY_COLOR = new THREE.Color('#2f7cf6')
const RAY_HIT_COLOR = new THREE.Color('#ffb020')
const RAY_MAX = 3
const FADE_MS = 150
const SNAP = Math.PI / 6

interface Ctrl {
  ptr: XrPointerState
  source: XRInputSource | null
  armed: boolean
}

function pulse(source: XRInputSource | null, intensity: number, ms: number) {
  const act = source?.gamepad?.hapticActuators?.[0] as unknown as { pulse?: (v: number, d: number) => Promise<boolean> } | undefined
  void act?.pulse?.(intensity, ms)?.catch?.(() => {})
}

/** Луч и курсор-кольцо одного указателя: линия 0 → расстояние до попадания (макс. 3 м), цвет при попадании в цель. */
function RayVisual({ ptr, origin }: { ptr: XrPointerState; origin: () => THREE.Vector3 }) {
  const line = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3))
    const m = new THREE.LineBasicMaterial({ color: RAY_COLOR, transparent: true, opacity: 0.9, depthTest: false, toneMapped: false })
    const l = new THREE.Line(g, m)
    l.renderOrder = 998
    l.frustumCulled = false
    l.name = 'xr-ray'
    return l
  }, [])
  const cursor = useRef<THREE.Mesh>(null)
  useEffect(() => () => {
    line.geometry.dispose()
    ;(line.material as THREE.Material).dispose()
  }, [line])
  const nrm = useMemo(() => new THREE.Vector3(), [])
  const end = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    const o = origin()
    const hit = ptr.hit
    const d = hit ? Math.min(hit.distance, RAY_MAX) : RAY_MAX
    end.copy(ptr.ray.direction).multiplyScalar(d).add(ptr.ray.origin)
    const a = line.geometry.getAttribute('position') as THREE.BufferAttribute
    a.setXYZ(0, o.x, o.y, o.z)
    a.setXYZ(1, end.x, end.y, end.z)
    a.needsUpdate = true
    ;(line.material as THREE.LineBasicMaterial).color.copy(ptr.hover ? RAY_HIT_COLOR : RAY_COLOR)
    const c = cursor.current
    if (c) {
      c.visible = !!hit
      if (hit) {
        c.position.copy(hit.point)
        if (hit.face) nrm.copy(hit.face.normal).transformDirection(hit.object.matrixWorld)
        else nrm.copy(ptr.ray.direction).negate()
        c.lookAt(nrm.add(hit.point))
        ;(c.material as THREE.MeshBasicMaterial).color.copy(ptr.hover ? RAY_HIT_COLOR : RAY_COLOR)
      }
    }
  })
  return (
    <>
      <primitive object={line} />
      <mesh ref={cursor} renderOrder={999} name="xr-cursor">
        <ringGeometry args={[0.008, 0.012, 24]} />
        <meshBasicMaterial color={RAY_COLOR} depthTest={false} transparent toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
    </>
  )
}

/** Свой «пульт» на рукоятке: капсула 3 × 10 см (без загрузки моделей контроллеров из сети). */
function Remote() {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.02]}>
      <capsuleGeometry args={[0.015, 0.07, 4, 12]} />
      <meshStandardMaterial color="#d7dde6" roughness={0.5} metalness={0.1} />
    </mesh>
  )
}

/** Площадки телепорта: светящееся кольцо r 0,28 м на полу у каждой точки стояния (один общий материал). */
function TeleportPads({ current, onPick }: { current: LabXrStand; onPick: (s: LabXrStand) => void }) {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#2f7cf6', transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }), [])
  useEffect(() => () => mat.dispose(), [mat])
  useFrame((s) => {
    mat.opacity = 0.42 + 0.18 * Math.sin(s.clock.elapsedTime * 3)
  })
  return (
    <group name="xr-teleport-pads">
      {XR_STAND_ORDER.map((id) => {
        const p = XR_STANDS[id].pos
        return (
          <group key={id} position={[p[0], 0.006, p[2]]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} material={mat} visible={id !== current} renderOrder={4}>
              <ringGeometry args={[0.22, 0.28, 40]} />
            </mesh>
            {/* зона нажатия — диск (луч на пол под острым углом попадает и между кольцами) */}
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              userData={{ interactive: true, xrStand: id }}
              onClick={(e) => {
                e.stopPropagation()
                if (id !== current) onPick(id)
              }}
            >
              <circleGeometry args={[0.3, 24]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

export function LabXrRoot() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const setEvents = useThree((s) => s.setEvents)
  const st = useXrState()
  const presenting = st.presenting
  const emulated = st.emulated

  // рендерер — для входа в сессию из кнопки вне <Canvas>; xr.enabled безопасно и без сессии
  useEffect(() => {
    gl.xr.enabled = true
    registerXrRenderer(gl)
    return () => registerXrRenderer(null)
  }, [gl])

  // эмуляция без шлема
  useEffect(() => {
    if (!xrEmulateRequested()) return
    labXr.set({ supported: true, presenting: true, emulated: true })
    return () => labXr.set({ presenting: false, emulated: false })
  }, [])

  // в VR собственные события R3F выключены — нажимает луч (иначе в эмуляции мышь нажимала бы дважды)
  useEffect(() => {
    if (!presenting) return
    setEvents({ enabled: false })
    return () => setEvents({ enabled: true })
  }, [presenting, setEvents])

  const input = useMemo(() => new XrRayInput(scene, () => camera, () => gl.domElement), [scene, camera, gl])
  const emu = useMemo<Ctrl>(() => ({ ptr: makePointer('right'), source: null, armed: true }), [])
  const ctrls = useMemo<Ctrl[]>(() => [0, 1].map(() => ({ ptr: makePointer('none'), source: null, armed: true })), [])
  const [grips, setGrips] = useState<{ c: THREE.Group[]; g: THREE.Group[] } | null>(null)
  const [leftGrip, setLeftGrip] = useState<THREE.Object3D | null>(null)

  // затемнение при телепорте/повороте: сфера на голове, 0 → 0,9 → 0 за 150 мс; перемещение — на пике
  const fade = useRef<{ t0: number; apply: (() => void) | null } | null>(null)
  const fadeMesh = useRef<THREE.Mesh>(null)
  const move = (apply: () => void) => {
    fade.current = { t0: performance.now(), apply }
  }
  const teleport = (stand: LabXrStand) => move(() => labXr.set({ stand }))
  const teleportRef = useRef(teleport)
  teleportRef.current = teleport

  // смена площадки → пространство (шлем) или поза камеры (эмуляция)
  useEffect(() => {
    if (!presenting || emulated) return
    applyStand(gl, st.stand)
  }, [presenting, emulated, st.stand, gl])

  // опыт под тягой (NH₃, Cl₂, Br₂) — площадка у вытяжки; другой опыт — обратно к столу
  const expId = st.run?.experimentId
  useEffect(() => {
    if (!presenting || !expId || !isLabExperimentId(expId)) return
    const hood = getLabExperiment(expId).place === 'hood'
    const cur = labXr.get().stand
    if (hood && cur !== 'hood') teleportRef.current('hood')
    else if (!hood && cur === 'hood') teleportRef.current('desk')
  }, [presenting, expId])

  // контроллеры шлема
  useEffect(() => {
    if (!presenting || emulated) return
    const c = [0, 1].map((i) => gl.xr.getController(i))
    const g = [0, 1].map((i) => gl.xr.getControllerGrip(i))
    c.forEach((x) => scene.add(x))
    g.forEach((x) => scene.add(x))
    setGrips({ c, g })
    const offs: (() => void)[] = []
    c.forEach((ctl, i) => {
      const st = ctrls[i]!
      const on = (type: string, fn: (e: { data?: XRInputSource }) => void) => {
        const h = fn as unknown as THREE.EventListener<object, string, THREE.Object3D>
        ctl.addEventListener(type as never, h as never)
        offs.push(() => ctl.removeEventListener(type as never, h as never))
      }
      on('connected', (e) => {
        st.source = e.data ?? null
        ;(st.ptr as { hand: XrHand }).hand = (e.data?.handedness as XrHand) ?? 'none'
        if (e.data?.handedness === 'left') setLeftGrip(g[i]!)
      })
      on('disconnected', () => {
        st.source = null
        setLeftGrip((cur) => (cur === g[i] ? null : cur))
      })
      on('selectstart', () => {
        labAudio.unlockNow()
        input.selectStart(st.ptr, performance.now())
      })
      on('selectend', () => {
        const done = input.selectEnd(st.ptr, performance.now())
        if (done) pulse(st.source, 0.8, 80)
        // обработчики, ждущие pointerup на window (дверцы шкафов), — отпустить
        window.dispatchEvent(new PointerEvent('pointerup'))
      })
      on('squeezestart', () => {
        const order = XR_STAND_ORDER
        teleportRef.current(order[(order.indexOf(labXr.get().stand) + 1) % order.length]!)
      })
    })
    return () => {
      offs.forEach((f) => f())
      c.forEach((x) => scene.remove(x))
      g.forEach((x) => scene.remove(x))
      setGrips(null)
      setLeftGrip(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presenting, emulated, gl, scene, input, ctrls])

  // эмуляция: мышь = луч из камеры, кнопка = select, колесо = squeeze
  const emuNdc = useMemo(() => new THREE.Vector2(0, 0), [])
  const caster = useMemo(() => new THREE.Raycaster(), [])
  useEffect(() => {
    if (!presenting || !emulated) return
    const el = gl.domElement
    const aim = (x: number, y: number) => {
      const r = el.getBoundingClientRect()
      emuNdc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1)
      caster.setFromCamera(emuNdc, camera)
      emu.ptr.ray.copy(caster.ray)
    }
    const move = (e: PointerEvent) => aim(e.clientX, e.clientY)
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return
      aim(e.clientX, e.clientY)
      labAudio.unlockNow()
      input.selectStart(emu.ptr, performance.now())
    }
    const up = (e: PointerEvent) => {
      if (e.button !== 0 || !emu.ptr.pressed) return
      aim(e.clientX, e.clientY)
      input.update(emu.ptr, performance.now())
      input.selectEnd(emu.ptr, performance.now())
    }
    let lastWheel = 0
    const wheel = (e: WheelEvent) => {
      const now = performance.now()
      if (now - lastWheel < 450) return
      lastWheel = now
      const order = XR_STAND_ORDER
      const i = order.indexOf(labXr.get().stand)
      teleportRef.current(order[(i + (e.deltaY > 0 ? 1 : order.length - 1)) % order.length]!)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointerup', up)
    window.addEventListener('wheel', wheel, { passive: true })
    // в шлеме DOM-доска (drei <Html>) не видна — в эмуляции тоже прячем её, видна VR-доска на canvas-текстуре
    const host = el.parentElement
    host?.setAttribute('data-xr-emulated', '')
    const css = document.createElement('style')
    css.textContent = '[data-xr-emulated] [data-lab3d-board]{visibility:hidden!important}'
    document.head.appendChild(css)
    return () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('wheel', wheel)
      host?.removeAttribute('data-xr-emulated')
      css.remove()
    }
  }, [presenting, emulated, gl, camera, emu, emuNdc, caster, input])

  // отладка и проверки: …?debugLab=1 — window.__labXr и журнал команд доски
  useEffect(() => {
    if (typeof window === 'undefined' || !/[?&]debugLab=1/.test(window.location.hash)) return
    const w = window as unknown as { __labXr?: unknown; __labXrLog?: unknown[] }
    w.__labXrLog = []
    const off = labEvents.on('uiCommand', (e) => (w.__labXrLog as unknown[]).push({ cmd: e.cmd, view: e.view, experimentId: e.experimentId, quality: e.quality }))
    w.__labXr = {
      state: () => labXr.get(),
      /** Эмуляция: повернуть «голову» (градусы) — например, посмотреть вниз на площадки. */
      look: (yawDeg = 0, pitchDeg = 0) => {
        emuLook.yaw = (yawDeg * Math.PI) / 180
        emuLook.pitch = (pitchDeg * Math.PI) / 180
      },
      teleport: (s: LabXrStand) => teleportRef.current(s),
      /** Нажать «курок» туда, куда сейчас смотрит луч эмуляции (или в экранную точку x, y). */
      select: (x?: number, y?: number) => {
        if (x != null && y != null) {
          const r = gl.domElement.getBoundingClientRect()
          emuNdc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1)
          caster.setFromCamera(emuNdc, camera)
          emu.ptr.ray.copy(caster.ray)
        }
        input.selectStart(emu.ptr, performance.now())
        input.update(emu.ptr, performance.now())
        return input.selectEnd(emu.ptr, performance.now())
      },
      hover: () => {
        const h = emu.ptr.hover
        return h ? { name: h.name, userData: { ...h.userData } } : null
      },
      /** Экранная точка (CSS px) кнопки VR-доски: next / back / restart / card:<id> / prev-page / next-page. */
      boardPoint: (id: string) => {
        let pt: number[] | null = null
        scene.traverse((o) => {
          if (pt || (o.userData as { xrBoard?: string }).xrBoard !== id) return
          const p = o.getWorldPosition(new THREE.Vector3()).project(camera)
          const r = gl.domElement.getBoundingClientRect()
          pt = [r.left + ((p.x + 1) / 2) * r.width, r.top + ((1 - p.y) / 2) * r.height]
        })
        return pt
      },
      padPoint: (id: LabXrStand) => {
        let pt: number[] | null = null
        scene.traverse((o) => {
          if (pt || (o.userData as { xrStand?: string }).xrStand !== id) return
          const p = o.getWorldPosition(new THREE.Vector3()).project(camera)
          const r = gl.domElement.getBoundingClientRect()
          pt = Math.abs(p.z) < 1 ? [r.left + ((p.x + 1) / 2) * r.width, r.top + ((1 - p.y) / 2) * r.height] : null
        })
        return pt
      },
    }
    return () => {
      off()
      delete w.__labXr
    }
  }, [gl, scene, camera, emu, emuNdc, caster, input])

  const warned = useRef(false)
  const tmpO = useMemo(() => new THREE.Vector3(), [])
  const tmpD = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    if (!presenting) return
    const now = performance.now()
    // затемнение
    const f = fade.current
    const fm = fadeMesh.current
    if (fm) {
      fm.position.copy(camera.position)
      if (f) {
        const k = (now - f.t0) / FADE_MS
        if (k >= 0.5 && f.apply) {
          f.apply()
          f.apply = null
        }
        const op = k < 0.5 ? 0.9 * (k / 0.5) : 0.9 * Math.max(0, 1 - (k - 0.5) / 0.5)
        ;(fm.material as THREE.MeshBasicMaterial).opacity = op
        fm.visible = op > 0.001
        if (k >= 1) fade.current = null
      } else fm.visible = false
    }
    if (emulated) {
      emulatedCameraPose(camera, labXr.get().stand)
      // луч из камеры через последнюю точку мыши (камера могла переехать)
      caster.setFromCamera(emuNdc, camera)
      emu.ptr.ray.copy(caster.ray)
      try {
        input.update(emu.ptr, now)
      } catch (err) {
        // ошибка луча не должна останавливать кадр (цикл R3F)
        if (!warned.current) console.warn('[xr] луч', err)
        warned.current = true
      }
      return
    }
    if (!grips) return
    grips.c.forEach((ctl, i) => {
      const cs = ctrls[i]!
      if (!cs.source) return
      ctl.updateMatrixWorld()
      tmpO.setFromMatrixPosition(ctl.matrixWorld)
      tmpD.set(0, 0, -1).transformDirection(ctl.matrixWorld)
      cs.ptr.ray.set(tmpO, tmpD)
      const prevHover = cs.ptr.hover
      try {
        input.update(cs.ptr, now)
      } catch (err) {
        if (!warned.current) console.warn('[xr] луч', err)
        warned.current = true
      }
      if (cs.ptr.hover && cs.ptr.hover !== prevHover) pulse(cs.source, 0.4, 40)
      // поворот рывком ±30° по стику (порог 0,7, повтор — после возврата в 0,3)
      const ax = cs.source.gamepad?.axes?.[2] ?? 0
      if (cs.armed && Math.abs(ax) > 0.7) {
        cs.armed = false
        move(() => {
          addSnapTurn(ax > 0 ? -SNAP : SNAP)
          applyStand(gl, labXr.get().stand)
        })
      } else if (!cs.armed && Math.abs(ax) < 0.3) cs.armed = true
    })
  })

  // начало луча для отрисовки: у контроллера — сам контроллер, в эмуляции — «рука» справа внизу перед камерой
  const emuOrigin = useMemo(() => new THREE.Vector3(), [])
  const emuHand = () => emuOrigin.set(0.14, -0.16, -0.3).applyMatrix4(camera.matrixWorld)

  if (!presenting) return null
  return (
    <group name="lab3d-xr">
      <XrBoardPanel />
      <TeleportPads current={st.stand} onPick={teleport} />
      <mesh ref={fadeMesh} renderOrder={999} visible={false} frustumCulled={false} name="xr-fade">
        <sphereGeometry args={[0.5, 16, 12]} />
        <meshBasicMaterial color="#000000" side={THREE.BackSide} transparent opacity={0} depthTest={false} depthWrite={false} />
      </mesh>
      {emulated ? (
        <>
          <RayVisual ptr={emu.ptr} origin={emuHand} />
          <XrWristHud grip={null} />
        </>
      ) : grips ? (
        <>
          {grips.c.map((ctl, i) => (
            <RayVisual key={i} ptr={ctrls[i]!.ptr} origin={() => tmpO.setFromMatrixPosition(ctl.matrixWorld)} />
          ))}
          {grips.g.map((g, i) => (
            <Fragment key={`remote-${i}`}>{createPortal(<Remote />, g)}</Fragment>
          ))}
          {leftGrip ? <XrWristHud grip={leftGrip} /> : null}
        </>
      ) : null}
    </group>
  )
}
