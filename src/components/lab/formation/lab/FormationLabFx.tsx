/**
 * «Как образуется» v2 прямо на большой 3D-сцене лаборатории (вместо маленького окна карточки каталога):
 * FormationMoleculeView + электронные облака + сцена фазы (или showcase H₂O / CO₂ / SiO₂) внутри Canvas лаборатории.
 * Камеру лаборатории не трогаем: группа вписывается в свободную от панелей часть кадра (без панели этапов справа /
 * сверху, реактора снизу и HUD-карточек) и поворачивается к камере (ракурс как в карточке; у showcase — yaw/pitch
 * сцены). Время — общее с панелью этапов (formationLabStore): пауза, скорость, перемотка.
 * synth: в конце — продукт (embryo → birth → complete), сторож лаборатории ждёт конца показа.
 */
import { useEffect, useMemo, useRef } from 'react'
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

/** Доля меньшей стороны свободной части кадра под описанную сферу — как у карточки каталога. */
const FILL = 0.86
const ORIGIN = new THREE.Vector3()
const _right = new THREE.Vector3()
const _up = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _qv = new THREE.Quaternion()
const _e = new THREE.Euler()

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

/** Сколько px холста занимают панели: справа (панель этапов), сверху (она же на телефоне), снизу (реактор). */
function overlaps(c: DOMRect): { dx: number; dy: number; db: number } {
  const out = { dx: 0, dy: 0, db: 0 }
  const p = formationLab.panelRect
  if (p && p.width > 0) {
    if (p.left > c.left + c.width / 2) out.dx = Math.max(0, c.right - p.left + 12)
    else out.dy = Math.max(0, p.bottom - c.top + 8)
  }
  const r = document.querySelector('[data-lab-reactor][data-open="true"]')?.getBoundingClientRect()
  if (r && r.height > 0 && r.top < c.bottom) out.db = Math.max(0, c.bottom - r.top + 8)
  return out
}

export type FormationLabFxProps = {
  compoundId: string
  mode: FormationLabMode
  lowPower?: boolean
  onEmbryoReady?: () => void
  onBirthReady?: () => void
  onComplete?: () => void
}

export default function FormationLabFx({ compoundId, mode, lowPower = false, onEmbryoReady, onBirthReady, onComplete }: FormationLabFxProps) {
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
  const ov = useRef({ dx: 0, dy: 0, db: 0, at: 0 })
  const sm = useRef<{ s: number; x: number; y: number; q: THREE.Quaternion } | null>(null)
  const end = useRef({ at: 0, done: false })
  const clock = formationLab.clock
  const clockFn = useMemo(() => () => formationLab.clock.current.t, [])
  const total = story?.total ?? 0
  const ok = Boolean(model && plan && story)
  const cbs = useRef({ onEmbryoReady, onBirthReady, onComplete })
  cbs.current = { onEmbryoReady, onBirthReady, onComplete }

  // Показ при синтезе открывает сцена; по кнопке — панель реактора. Этапы для панели — из истории.
  useEffect(() => {
    if (mode === 'synth') formationLab.open(compoundId, 'synth')
    if (story) formationLab.setStages(compoundId, story.stages.map((s) => ({ key: s.key, t0: s.t0, dur: s.dur })), story.total)
    return () => formationLab.close(compoundId)
  }, [compoundId, mode, story])

  const finish = () => {
    if (end.current.done) return
    end.current.done = true
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
    const camera = state.camera as THREE.PerspectiveCamera
    const target = (state.controls as unknown as { target?: THREE.Vector3 } | null)?.target ?? ORIGIN
    const now = performance.now()
    const W = Math.max(1, state.size.width)
    const H = Math.max(1, state.size.height)
    if (now - ov.current.at > 300) {
      const rect = gl.domElement.getBoundingClientRect()
      Object.assign(ov.current, overlaps(rect), { at: now })
      const { dx, dy, db } = ov.current
      formationLab.setFree({ left: rect.left, top: rect.top + dy, width: Math.max(120, rect.width - dx), height: Math.max(120, rect.height - dy - db) })
    }
    const { dx, dy, db } = ov.current
    // свободная часть холста (px холста): x ∈ [0, aW], y ∈ [dy, dy + aH]
    const aW = Math.max(120, W - dx)
    const aH = Math.max(120, H - dy - db)
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
    // ракурс: модель смотрит на камеру как в карточке; showcase ведёт yaw/pitch (камера «облетает» модель)
    _q.copy(camera.quaternion)
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
          <FormationPhaseScene model={model} story={story} clock={clock} lowPower={lowPower} />
        )}
      </FormationMoleculeView>
    </group>
    {/* Облака — вне группы: их матрица = мировая матрица группы атомов (родитель должен быть без смещения). */}
    {cloudsOn && !Scene ? <FormationClouds model={model} story={story} clock={clock} lowPower={lowPower} /> : null}
    </>
  )
}
