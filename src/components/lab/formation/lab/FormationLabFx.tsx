/**
 * «Как образуется» v2 прямо на большой 3D-сцене лаборатории (вместо маленького окна карточки каталога):
 * FormationMoleculeView + электронные облака + сцена фазы (или showcase H₂O / CO₂ / SiO₂) внутри Canvas лаборатории.
 * Камеру лаборатории не трогаем: группа вписывается в свободную от панелей часть кадра (без панели этапов справа /
 * сверху, реактора снизу и HUD-карточек) и поворачивается к камере (ракурс как в карточке; у showcase — yaw/pitch
 * сцены). Время — общее с панелью этапов (formationLabStore): пауза, скорость, перемотка.
 * synth: в конце — продукт (embryo → birth → complete), сторож лаборатории ждёт конца показа.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { formationPlan } from '../../../../chemistry/formationPlan'
import { compoundById } from '../../../../data/compounds'
import { buildSchoolHeroModel } from '../../hero/schoolHeroModel'
import { useCloudsOn } from '../board/cloudsStore'
import { FormationClouds } from '../FormationClouds'
import { FormationMoleculeView } from '../FormationMoleculeView'
import { FormationPhaseScene } from '../FormationPhaseScene'
import { easeInOut, formationStoryFor, type FormationStory, type StageKey } from '../formationStory'
import { ShowcaseBounds, ShowcaseClock } from '../showcase/kit/core'
import { showcaseSceneFor } from '../showcase/registry'
import type { CamCtl } from '../showcase/types'
import { formationLab, type FormationLabMode } from './formationLabStore'
import { showDirector } from './showDirector'

/** Доля меньшей стороны свободной части кадра под описанную сферу — как у карточки каталога. */
const FILL = 0.86
/**
 * Угол обзора на время показа — как у карточки каталога (38°). У камеры лаборатории 75°: модель в пол-экрана при таком
 * угле сильно искажена перспективой (ближние шары — овалы вдвое больше дальних). Вне показа — прежний угол.
 */
const SHOW_FOV = 38
const _m4 = new THREE.Matrix4()
const ORIGIN = new THREE.Vector3()
const _right = new THREE.Vector3()
const _up = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _qv = new THREE.Quaternion()
const _e = new THREE.Euler()
const _fwd = new THREE.Vector3()
const _a = new THREE.Vector3()
const _n = new THREE.Vector3()

/**
 * Окно показа как у карточки каталога: всё, что вне свободной части кадра (под панелями) и ближе к камере, чем 3 радиуса
 * модели (в карточке — ближняя плоскость камеры), отсекается плоскостями — только у материалов показа, фон лаборатории цел.
 * Порядок: ближняя, левая, правая, верхняя, нижняя.
 */
function makeClip(): THREE.Plane[] {
  return [0, 1, 2, 3, 4].map(() => new THREE.Plane(new THREE.Vector3(0, 0, -1), 1e6))
}
/** Материалы показа получают общие плоскости отсечения (один раз на материал); used — чтобы снять их при закрытии
 *  (общие кэшированные материалы, например подписей шаров, не должны остаться обрезанными в лаборатории). */
function applyClip(obj: THREE.Object3D | null | undefined, planes: THREE.Plane[], used: Set<THREE.Material>) {
  obj?.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined
    if (!m) return
    for (const mm of Array.isArray(m) ? m : [m]) {
      if (mm.clippingPlanes === planes) continue
      mm.clippingPlanes = planes
      mm.needsUpdate = true
      used.add(mm)
    }
  })
}

/** Приближение по этапам — как в карточке (FormationCanvas): к центру на разрыве / переходе e⁻, дальше на решётке. */
function stageZoom(key: StageKey, crystal: boolean): number {
  if (key === 'transfer') return crystal ? 1.28 : 1.06
  if (key === 'break' || key === 'release') return 1.06
  if (key === 'heat') return 1.04
  if (key === 'lattice') return 0.94
  return 1
}
function zoomAt(story: FormationStory, t: number, crystal: boolean): number {
  const st = story.stages
  let k = 0
  for (let i = 0; i < st.length; i++) if (t >= st[i]!.t0) k = i
  const cur = stageZoom(st[k]!.key, crystal)
  if (k === 0) return cur
  const prev = stageZoom(st[k - 1]!.key, crystal)
  return prev + (cur - prev) * easeInOut((t - st[k]!.t0) / 1.2)
}

/**
 * Сколько px холста занимают панели: справа (панель этапов), сверху (она же на телефоне), снизу (реактор).
 * Прямоугольники ведут наблюдатели (formationLab.rects / panelRect) — в кадре DOM не опрашивается.
 */
function overlaps(c: { left: number; top: number; width: number; height: number }): { dx: number; dy: number; db: number } {
  const out = { dx: 0, dy: 0, db: 0 }
  const right = c.left + c.width
  const bottom = c.top + c.height
  const p = formationLab.panelRect
  if (p && p.width > 0) {
    if (p.left > c.left + c.width / 2) out.dx = Math.max(0, right - p.left + 12)
    else out.dy = Math.max(0, p.bottom - c.top + 8)
  }
  const r = formationLab.rects.reactor
  if (r && r.height > 0 && r.top < bottom) out.db = Math.max(0, bottom - r.top + 8)
  // свёрнутый реактор (телефон): кнопка «Показать реактор» внизу
  const f = formationLab.rects.fab
  if (f && f.height > 0 && f.top < bottom && f.bottom > c.top + c.height / 2) out.db = Math.max(out.db, bottom - f.top + 6)
  return out
}

/** Сжатие группы показа после конца (продукт уже передан): 250 мс. */
const SHRINK_MS = 250
/** Копии молекул итога в лаборатории: не больше 6 и только при свободной высоте кадра от 480 px. */
const COPIES_CAP = 6
const COPIES_MIN_H = 480

export type FormationLabFxProps = {
  compoundId: string
  mode: FormationLabMode
  lowPower?: boolean
  /** номер запуска синтеза (synth): новый запуск того же вещества, пока прежний показ доживает, — показ заново */
  runKey?: number
  onEmbryoReady?: () => void
  onBirthReady?: () => void
  onComplete?: () => void
}

export default function FormationLabFx({ compoundId, mode, lowPower = false, runKey = 0, onEmbryoReady, onBirthReady, onComplete }: FormationLabFxProps) {
  const shape = compoundById[compoundId]
  const model = useMemo(() => (shape ? buildSchoolHeroModel(shape) : null), [shape])
  const plan = useMemo(() => formationPlan(compoundId), [compoundId])
  const story = useMemo(() => formationStoryFor(compoundId), [compoundId])
  const Scene = useMemo(() => showcaseSceneFor(compoundId), [compoundId])
  const cloudsOn = useCloudsOn()
  const gl = useThree((s) => s.gl)
  const root = useRef<THREE.Group>(null)
  const cam = useRef<CamCtl>({ active: false, yaw: 0, pitch: 0.12, zoom: 1, userUntil: 0 })
  const bounds = useRef({ dx: 0, dy: 0 })
  const ov = useRef({ dx: 0, dy: 0, db: 0, at: 0, rev: -1, w: 0, h: 0 })
  // Прямоугольник холста в окне: холст лаборатории двигается только при ресайзе — меряем наблюдателем, не в кадре.
  const canvasRect = useRef({ left: 0, top: 0, width: 0, height: 0 })
  const firstFrame = useRef(false)
  const [copiesCap, setCopiesCap] = useState(COPIES_CAP)
  const clipStep = useRef(-1)
  const sm = useRef<{ s: number; x: number; y: number; q: THREE.Quaternion } | null>(null)
  const end = useRef({ at: 0, done: false, doneAt: 0 })
  const clip = useMemo(makeClip, [])
  const clipUsed = useMemo(() => new Set<THREE.Material>(), [])
  const camera0 = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const fovKeep = useRef<number | null>(null)
  // Прежний угол обзора лаборатории — назад при закрытии показа.
  useEffect(
    () => () => {
      const f = fovKeep.current
      if (f != null && camera0.isPerspectiveCamera && camera0.fov === SHOW_FOV) {
        camera0.fov = f
        camera0.updateProjectionMatrix()
      }
      fovKeep.current = null
    },
    [camera0],
  )
  const scene = useThree((s) => s.scene)
  const clock = formationLab.clock
  const clockFn = useMemo(() => () => formationLab.clock.current.t, [])
  const total = story?.total ?? 0
  const ok = Boolean(model && plan && story)
  const cbs = useRef({ onEmbryoReady, onBirthReady, onComplete })
  cbs.current = { onEmbryoReady, onBirthReady, onComplete }

  // Показ при синтезе открывает сцена (или режиссёр — передачей из preview); по кнопке — панель реактора.
  // Смена режима preview → synth не размонтирует показ: закрытие — только при уходе сцены / смене вещества.
  // Новый запуск синтеза того же вещества, пока прежний показ ещё доживает (сжат) — показ заново.
  const runSeen = useRef(runKey)
  useEffect(() => {
    if (mode === 'synth' && end.current.done && runKey !== runSeen.current) {
      end.current = { at: 0, done: false, doneAt: 0 }
      if (root.current) root.current.visible = true
    }
    runSeen.current = runKey
    if (mode === 'synth' && !end.current.done) formationLab.open(compoundId, 'synth')
    if (story) formationLab.setStages(compoundId, story.stages.map((s) => ({ key: s.key, t0: s.t0, dur: s.dur })), story.total)
  }, [compoundId, mode, story, runKey])
  useEffect(() => () => formationLab.close(compoundId), [compoundId])

  // Холст в окне — наблюдателем (ресайз), а не getBoundingClientRect в каждом кадре.
  useEffect(() => {
    const el = gl.domElement
    const upd = () => {
      const r = el.getBoundingClientRect()
      canvasRect.current = { left: r.left, top: r.top, width: r.width, height: r.height }
      ov.current.rev = -1
    }
    upd()
    const ro = new ResizeObserver(upd)
    ro.observe(el)
    window.addEventListener('resize', upd)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', upd)
    }
  }, [gl])

  // Отсечение — только у материалов показа (локальное); при закрытии показа — как было.
  useEffect(() => {
    const prev = gl.localClippingEnabled
    gl.localClippingEnabled = true
    return () => {
      gl.localClippingEnabled = prev
      for (const m of clipUsed) {
        m.clippingPlanes = null
        m.needsUpdate = true
      }
      clipUsed.clear()
    }
  }, [gl, clipUsed])

  // Конец показа при синтезе: сначала режиссёр → 'none' (панель исчезает, группа сжимается за 250 мс), и только
  // потом продукт — в кадре никогда нет двух моделей (показ + герой продукта).
  const finish = () => {
    if (end.current.done) return
    end.current.done = true
    end.current.doneAt = performance.now()
    showDirector.finish('formation-synth', compoundId)
    cbs.current.onEmbryoReady?.()
    cbs.current.onBirthReady?.()
    cbs.current.onComplete?.()
  }
  // Нет истории (не должно быть у 200) — синтез не зависает: сразу продукт.
  useEffect(() => {
    if (!ok && mode === 'synth') finish()
  })

  useFrame((state, dt) => {
    if (!ok || !story || !model) return
    const c = clock.current
    const d = Math.min(0.1, Math.max(0.001, dt))
    const speed = formationLab.get().speed
    if (c.playing) {
      c.t = Math.min(total, c.t + d * speed)
      if (c.t >= total) c.playing = false
    }
    formationLab.tick()
    // конец показа при синтезе: 1,2 с на последнем кадре, затем продукт («Закрыть» — сразу)
    if (mode === 'synth' && !end.current.done) {
      if (formationLab.skipToEnd) finish()
      else if (c.t >= total - 1e-3) {
        const now = performance.now()
        if (!end.current.at) end.current.at = now
        if (now - end.current.at > 1200) finish()
      } else end.current.at = 0
    }

    const g = root.current
    if (!g) return
    if (end.current.done && sm.current) {
      // продукт передан: группа показа уходит (scale → 0), затем скрыта до размонтирования
      const k = 1 - Math.min(1, (performance.now() - end.current.doneAt) / SHRINK_MS)
      if (k <= 0) {
        g.visible = false
        return
      }
      g.scale.setScalar(Math.max(1e-4, sm.current.s * k * k))
      return
    }
    const camera = state.camera as THREE.PerspectiveCamera
    if (camera.isPerspectiveCamera && camera.fov !== SHOW_FOV) {
      // угол сменил кто-то другой (переход камеры лаборатории) — его и вернём после показа
      fovKeep.current = camera.fov
      camera.fov = SHOW_FOV
      camera.updateProjectionMatrix()
      camera.updateMatrixWorld()
    }
    const target = (state.controls as unknown as { target?: THREE.Vector3 } | null)?.target ?? ORIGIN
    const now = performance.now()
    const W = Math.max(1, state.size.width)
    const H = Math.max(1, state.size.height)
    // свободная часть кадра — только когда сменились прямоугольники панелей (rev) или размер холста
    const pr = formationLab.panelRect
    const rev = formationLab.rects.rev * 1e6 + (pr ? Math.round(pr.left + pr.bottom * 7 + pr.width * 13) : 0)
    if (rev !== ov.current.rev || W !== ov.current.w || H !== ov.current.h) {
      const rect = canvasRect.current
      Object.assign(ov.current, overlaps(rect), { at: now, rev, w: W, h: H })
      const { dx, dy, db } = ov.current
      formationLab.setFree({ left: rect.left, top: rect.top + dy, width: Math.max(120, rect.width - dx), height: Math.max(120, rect.height - dy - db) }, rect.top)
    }
    const { dx, dy, db } = ov.current
    // свободная часть холста (px холста): x ∈ [0, aW], y ∈ [dy, dy + aH]
    const aW = Math.max(120, W - dx)
    const aH = Math.max(120, H - dy - db)
    // копии молекул итога («как в жизни») — только если свободной части хватает (иначе они «вторым фоном» у краёв)
    const cap = aH >= COPIES_MIN_H ? COPIES_CAP : 0
    if (cap !== copiesCap) setCopiesCap(cap)
    // HUD-карточки — в правом верхнем углу свободной части: модель слева от них или под ними (где больше места)
    const hud = formationLab.hudLayout.current
    const left = Math.min(aW - hud.dx, aH)
    const below = Math.min(aW, aH - hud.dy)
    const hdx = hud.dx > 0 && left >= below ? Math.min(hud.dx, aW - 60) : 0
    const hdy = hud.dy > 0 && left < below ? Math.min(hud.dy, aH - 60) : 0
    bounds.current = { dx: dx + hdx, dy: dy + hdy }
    const rW = aW - hdx
    const rH = aH - hdy
    const cx = rW / 2
    const cy = dy + hdy + rH / 2

    const cc = cam.current
    const z = zoomAt(story, c.t, model.kind === 'crystal') * (cc.active ? Math.max(0.5, Math.min(2, cc.zoom)) : 1)
    const dist = Math.max(0.5, camera.position.distanceTo(target))
    const fov = camera.isPerspectiveCamera ? camera.fov : 40
    const wpp = (2 * dist * Math.tan((fov * Math.PI) / 360)) / H
    const sT = ((FILL * Math.min(rW, rH)) / 2) * wpp * z
    const xT = (cx - W / 2) * wpp
    const yT = (H / 2 - cy) * wpp
    // ракурс: модель повёрнута к камере (из своего места в кадре — без косого взгляда сбоку), как в карточке;
    // showcase ведёт yaw/pitch (камера «облетает» модель)
    _right.setFromMatrixColumn(camera.matrixWorld, 0)
    _up.setFromMatrixColumn(camera.matrixWorld, 1)
    _dir.copy(target).addScaledVector(_right, xT).addScaledVector(_up, yT)
    _m4.lookAt(camera.position, _dir, _up)
    _q.setFromRotationMatrix(_m4)
    if (cc.active) {
      const p = Math.max(-1.2, Math.min(1.2, cc.pitch))
      _qv.setFromEuler(_e.set(-p, cc.yaw, 0, 'YXZ'))
      _q.multiply(_qv.invert())
    }
    const s0 = sm.current ?? (sm.current = { s: sT, x: xT, y: yT, q: _q.clone() })
    const k = 1 - Math.exp(-d * 4)
    s0.s += (sT - s0.s) * k
    s0.x += (xT - s0.x) * k
    s0.y += (yT - s0.y) * k
    s0.q.slerp(_q, 1 - Math.exp(-d * 2.6))
    g.quaternion.copy(s0.q)
    g.scale.setScalar(Math.max(1e-4, s0.s))
    _right.setFromMatrixColumn(camera.matrixWorld, 0)
    _up.setFromMatrixColumn(camera.matrixWorld, 1)
    _dir.copy(target).addScaledVector(_right, s0.x).addScaledVector(_up, s0.y)
    g.position.copy(_dir)

    // ── отсечение: окно = свободная часть кадра, ближняя плоскость — 3 радиуса модели перед центром ──
    camera.getWorldDirection(_fwd)
    const D = Math.max(0.5, _a.copy(_dir).sub(camera.position).dot(_fwd))
    const wD = (2 * D * Math.tan((fov * Math.PI) / 360)) / H
    clip[0]!.normal.copy(_fwd)
    clip[0]!.constant = -(_fwd.dot(camera.position) + Math.max(0.05, D - 3 * s0.s))
    const edge = (i: number, px: number, py: number, nx: 'L' | 'R' | 'T' | 'B') => {
      // направление из камеры на край окна (px холста) на глубине D
      _a.copy(_fwd).multiplyScalar(D).addScaledVector(_right, (px - W / 2) * wD).addScaledVector(_up, (H / 2 - py) * wD)
      if (nx === 'L') _n.crossVectors(_a, _up)
      else if (nx === 'R') _n.crossVectors(_up, _a)
      else if (nx === 'T') _n.crossVectors(_a, _right)
      else _n.crossVectors(_right, _a)
      _n.normalize()
      clip[i]!.normal.copy(_n)
      clip[i]!.constant = -_n.dot(camera.position)
    }
    edge(1, 0, H / 2, 'L')
    edge(2, aW, H / 2, 'R')
    edge(3, W / 2, dy, 'T')
    edge(4, W / 2, dy + aH, 'B')
    // плоскости — новым материалам показа: на первом кадре и при смене этапа (части сцены монтируются по этапам)
    // и облаков — без обхода дерева каждые полсекунды
    const step = formationLab.get().step * 2 + (cloudsOn ? 1 : 0)
    if (step !== clipStep.current) {
      clipStep.current = step
      applyClip(g, clip, clipUsed)
      applyClip((g.parent ?? scene).getObjectByName('formation-clouds'), clip, clipUsed)
    }
    if (!firstFrame.current) {
      firstFrame.current = true
      try {
        performance.mark('formation-lab:first-frame')
      } catch {
        /* нет User Timing */
      }
    }
  })

  if (!ok || !model || !plan || !story) return null
  return (
    <>
    <group ref={root} name="formation-lab-fx">
      {/* Кристалл на экране меньше описанной сферы — как в карточке каталога. */}
      <FormationMoleculeView model={model} plan={plan} story={story} clock={clock} fitRadius={model.kind === 'crystal' ? 1.1 : 1} lowPower={lowPower} hideElectrons={!!Scene && Scene.hideElectrons !== false}>
        {Scene ? (
          <ShowcaseClock value={clockFn}>
            <ShowcaseBounds value={bounds}>
              <Scene model={model} plan={plan} story={story} clock={clock} cam={cam} lowPower={lowPower} />
            </ShowcaseBounds>
          </ShowcaseClock>
        ) : (
          <FormationPhaseScene model={model} story={story} clock={clock} lowPower={lowPower} copiesCap={copiesCap} />
        )}
      </FormationMoleculeView>
    </group>
    {/* Облака — вне группы: их матрица = мировая матрица группы атомов (родитель должен быть без смещения). */}
    {cloudsOn && !Scene ? <FormationClouds model={model} story={story} clock={clock} lowPower={lowPower} /> : null}
    </>
  )
}
