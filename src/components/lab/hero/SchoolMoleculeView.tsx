import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { pmToScene } from '../../../lab/cinema/scenes/kit/cpkAtoms'
import { SCHOOL_DRAW } from '../../../lab/cinema/scenes/school/schoolModel'
import { useLocale } from '../../../i18n/useLocale'
import { CinemaDomLabels, type DomLabelSource } from '../../../lab/cinema/react/CinemaDomLabels'
import { localizeLabelText, toSceneLocale } from '../../../lab/cinema/scenes/kit/sceneKit'
import { useAppTheme } from '../../../theme/appTheme'
import { CAPTION_GAP_PX, CAPTION_LINE_PX, heroCaptionLines, HERO_ORBIT_RAD_PER_SEC } from './heroFrame'
import { NaclHeroBody } from './NaclHeroBody'
import { SchoolBallLabels } from './SchoolBallLabels'
import type { SchoolHeroModel } from './schoolHeroModel'
import {
  createSchoolMatteMaterial,
  SCHOOL_EDGE_HEX,
  SCHOOL_STICK_HEX,
  schoolAtomColor,
  schoolSphereGeometry,
  schoolStickGeometry,
} from './schoolHeroStyle'

/**
 * ЕДИНЫЙ школьный 3D-вид вещества: герой продукта в лаборатории и 3D карточки каталога.
 * Матовые CPK-шары (0,62 ковалентного радиуса, у ионов — ионный), символ ВНУТРИ шара (SchoolBallLabels),
 * серые палочки связей по кратности (двойная — две, тройная — три; шаг и толщина — SCHOOL_DRAW),
 * рёбра ячеек у кристалла. Без свечения, ауры и полупрозрачных «газовых» шаров.
 *
 * Поза: молекула стоит так, как в итоге школьной сцены (линейная — по горизонтали, плоская — в плоскости
 * экрана), и медленно покачивается вокруг этой позы (линейная молекула не «схлопывается» в торец); кристалл — медленный
 * облёт вокруг вертикали с наклоном верхом к зрителю, как прежний герой и решётка сцены NaCl.
 * NaCl рисует тело сцены урока (NaclHeroBody): передача кадра «сцена → герой» без второй решётки.
 *
 * Модель нормируется одним множителем под радиус fitRadius (отношения размеров честные).
 */

const K = pmToScene(1)
/** Покачивание молекулы: амплитуда (рад) и период (с). Начальный кадр — ровно поза конца сцены. */
const SWAY_AMP = 0.3
const SWAY_PERIOD = 14

const _q = new THREE.Quaternion()
const _m = new THREE.Matrix4()
const _p = new THREE.Vector3()
const _sc = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)

/** Нормаль плоскости молекулы или null (не плоская / меньше трёх атомов / линейная). */
function planeNormal(model: SchoolHeroModel): THREE.Vector3 | null {
  const at = model.atoms
  if (at.length < 3) return null
  const o = new THREE.Vector3(...at[0]!.pos)
  let n: THREE.Vector3 | null = null
  for (let i = 1; i < at.length && !n; i++) {
    for (let j = i + 1; j < at.length && !n; j++) {
      const u = new THREE.Vector3(...at[i]!.pos).sub(o)
      const v = new THREE.Vector3(...at[j]!.pos).sub(o)
      const c = u.clone().cross(v)
      if (c.length() > 1e-3 * u.length() * v.length()) n = c.normalize()
    }
  }
  if (!n) return null
  const tol = 6 * K
  for (const a of at) if (Math.abs(new THREE.Vector3(...a.pos).sub(o).dot(n)) > tol) return null
  return n
}

/** Матрицы палочек: кратная связь — параллельные палочки в плоскости молекулы или к зрителю боком. */
function writeSticks(model: SchoolHeroModel, mesh: THREE.InstancedMesh): number {
  const plane = planeNormal(model)
  // Направление на зрителя в системе модели при начальной позе (для линейных и двухатомных молекул).
  const view = new THREE.Vector3(0, 0, 1)
  const pose = new THREE.Euler(model.pitch, model.yaw, 0, model.motion === 'orbit' ? 'XYZ' : 'YXZ')
  view.applyQuaternion(new THREE.Quaternion().setFromEuler(pose).invert())
  const nbrs: number[][] = model.atoms.map(() => [])
  for (const b of model.bonds) {
    nbrs[b.a]!.push(b.b)
    nbrs[b.b]!.push(b.a)
  }
  const r = SCHOOL_DRAW.stickR * K
  const step = SCHOOL_DRAW.stickSpacing * K
  let k = 0
  for (const b of model.bonds) {
    const A = new THREE.Vector3(...model.atoms[b.a]!.pos)
    const B = new THREE.Vector3(...model.atoms[b.b]!.pos)
    const axis = B.clone().sub(A)
    const len = axis.length()
    if (len < 1e-9) continue
    axis.divideScalar(len)
    const n = Math.max(1, Math.min(3, Math.round(b.order)))
    let side: THREE.Vector3 | null = null
    if (n > 1) {
      if (plane) side = plane.clone().cross(axis)
      if (!side || side.lengthSq() < 1e-6) {
        // Сосед одного из концов: смещение в плоскости σ-скелета (как bondOffset каталога).
        for (const [end, other] of [[b.a, b.b], [b.b, b.a]] as const) {
          for (const nb of nbrs[end]!) {
            if (nb === other) continue
            const v = new THREE.Vector3(...model.atoms[nb]!.pos).sub(new THREE.Vector3(...model.atoms[end]!.pos))
            v.addScaledVector(axis, -v.dot(axis))
            if (v.lengthSq() > 1e-8) {
              side = v
              break
            }
          }
          if (side) break
        }
      }
      if (!side || side.lengthSq() < 1e-8) side = view.clone().cross(axis)
      if (side.lengthSq() < 1e-8) side = new THREE.Vector3(0, 0, 1).cross(axis)
      side.normalize()
    }
    _q.setFromUnitVectors(_up, axis)
    for (let s = 0; s < n; s++) {
      _p.copy(A).add(B).multiplyScalar(0.5)
      if (side) _p.addScaledVector(side, (s - (n - 1) / 2) * step)
      _m.compose(_p, _q, _sc.set(r, len, r))
      mesh.setMatrixAt(k++, _m)
    }
  }
  mesh.count = k
  mesh.instanceMatrix.needsUpdate = true
  return k
}

export function SchoolMoleculeView({
  model,
  fitRadius,
  showLabels,
  lowPower = false,
  handoff = false,
  cancelParentRotation = false,
  motion = true,
  caption = false,
  tone,
}: {
  model: SchoolHeroModel
  /** радиус описанной сферы после нормировки, мир */
  fitRadius: number
  showLabels: boolean
  lowPower?: boolean
  /** слот героя, на который сцена урока заявила передачу кадра (NaCl) */
  handoff?: boolean
  /** лаборатория: поза не зависит от поворота слота (рождение героя вращало его) */
  cancelParentRotation?: boolean
  /** покачивание / облёт */
  motion?: boolean
  /** подпись кристалла под моделью (a, группа, КЧ) — в лаборатории */
  caption?: boolean
  /** тон фона, на котором стоит вид (каталог — тёмная карточка в обеих темах); по умолчанию — тема приложения */
  tone?: 'dark' | 'light'
}) {
  const locale = toSceneLocale(useLocale().locale)
  const { theme } = useAppTheme()
  const light = (tone ?? theme) === 'light'
  const outer = useRef<THREE.Group>(null)
  const turnA = useRef<THREE.Group>(null)
  const turnB = useRef<THREE.Group>(null)
  const time = useRef(0)
  const labelOpacity = useRef(0)
  const scale = fitRadius / Math.max(1e-6, model.radius)
  const crystal = model.kind === 'crystal'
  const naclBody = model.compoundId === 'nacl'

  const res = useMemo(() => {
    const atomMat = createSchoolMatteMaterial()
    const atoms = new THREE.InstancedMesh(schoolSphereGeometry(lowPower), atomMat, Math.max(1, model.atoms.length))
    atoms.name = 'school-hero-atoms'
    atoms.frustumCulled = false
    const col = new THREE.Color()
    model.atoms.forEach((a, i) => {
      _m.compose(_p.set(a.pos[0], a.pos[1], a.pos[2]), _q.identity(), _sc.setScalar(a.r))
      atoms.setMatrixAt(i, _m)
      atoms.setColorAt(i, schoolAtomColor(a.el, col))
    })
    atoms.count = model.atoms.length
    const stickMat = createSchoolMatteMaterial(SCHOOL_STICK_HEX.dark)
    let nSticks = 0
    for (const b of model.bonds) nSticks += Math.max(1, Math.min(3, Math.round(b.order)))
    const sticks = new THREE.InstancedMesh(schoolStickGeometry(), stickMat, Math.max(1, nSticks))
    sticks.name = 'school-hero-bonds'
    sticks.frustumCulled = false
    const drawn = writeSticks(model, sticks)
    let edges: THREE.LineSegments | null = null
    if (model.cellEdges.length > 0) {
      const pos = new Float32Array(model.cellEdges.length * 6)
      model.cellEdges.forEach(([p, q], i) => pos.set([p[0], p[1], p[2], q[0], q[1], q[2]], i * 6))
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      edges = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: SCHOOL_EDGE_HEX.dark, transparent: true, opacity: 0.55, depthWrite: false, fog: false }))
      edges.name = 'school-hero-cell-edges'
      edges.frustumCulled = false
    }
    return { atoms, atomMat, sticks, stickMat, drawn, edges }
  }, [model, lowPower])

  // Тема: палочки и рёбра темнее на светлом фоне.
  useEffect(() => {
    res.stickMat.color.setHex(light ? SCHOOL_STICK_HEX.light : SCHOOL_STICK_HEX.dark)
    if (res.edges) (res.edges.material as THREE.LineBasicMaterial).color.setHex(light ? SCHOOL_EDGE_HEX.light : SCHOOL_EDGE_HEX.dark)
  }, [res, light])

  useEffect(
    () => () => {
      res.atomMat.dispose()
      res.stickMat.dispose()
      res.atoms.dispose()
      res.sticks.dispose()
      if (res.edges) {
        res.edges.geometry.dispose()
        ;(res.edges.material as THREE.Material).dispose()
      }
    },
    [res],
  )

  useEffect(() => {
    time.current = 0
  }, [model])

  // Подпись кристалла под моделью: строки через фиксированные CSS-пиксели при любом масштабе кадра.
  const captionLabels = useMemo<DomLabelSource[]>(
    () =>
      caption
        ? heroCaptionLines(model.caption).map((text, i) => ({
            id: `school-hero-caption-${i}`,
            kind: 'species',
            pos: new THREE.Vector3(0, -model.radius, 0),
            opacity: 0,
            text: localizeLabelText(text, locale, true),
          }))
        : [],
    [model, locale, caption],
  )

  useFrame((state, dt) => {
    const d = Math.min(0.1, Math.max(0, dt))
    if (motion) time.current += d
    const t = time.current
    const a = turnA.current
    const b = turnB.current
    if (a && b) {
      if (model.motion === 'orbit') {
        // Кристалл: наклон снаружи, облёт вокруг собственной вертикали внутри (как прежний герой).
        a.rotation.set(model.pitch, 0, 0)
        b.rotation.set(0, model.yaw + t * HERO_ORBIT_RAD_PER_SEC, 0)
      } else {
        // Молекула: rotYX школьной сцены — сначала наклон (X), затем рыскание (Y) + покачивание.
        a.rotation.set(0, model.yaw + SWAY_AMP * Math.sin((2 * Math.PI * t) / SWAY_PERIOD), 0)
        b.rotation.set(model.pitch, 0, 0)
      }
    }
    const o = outer.current
    if (o && cancelParentRotation && o.parent) {
      o.parent.getWorldQuaternion(_q)
      o.quaternion.copy(_q.invert())
    }
    // Подписи проявляются, когда вид вырос почти до полного размера (после «рождения» героя).
    let op = 0
    if (showLabels && o) {
      o.getWorldScale(_sc)
      op = THREE.MathUtils.smoothstep(_sc.x, 0.82 * scale, 0.98 * scale)
    }
    labelOpacity.current = op
    if (captionLabels.length > 0 && o) {
      const cam = state.camera as THREE.PerspectiveCamera
      o.getWorldPosition(_p)
      const dist = cam.position.distanceTo(_p)
      const h = Math.max(1, state.size.height)
      const localPerPx = (2 * dist * Math.tan(((cam.fov || 46) * Math.PI) / 360)) / h / Math.max(1e-6, _sc.x || scale)
      for (let i = 0; i < captionLabels.length; i++) {
        const c = captionLabels[i]!
        c.pos.y = -model.radius - (CAPTION_GAP_PX + (i + 0.5) * CAPTION_LINE_PX) * localPerPx
        c.opacity = op * 0.92
      }
    }
  })

  return (
    <group ref={outer} scale={scale} name="school-hero-view">
      <group ref={turnA}>
        <group ref={turnB}>
          {naclBody ? (
            <NaclHeroBody lowPower={lowPower} handoff={handoff} />
          ) : (
            <>
              <primitive object={res.atoms} />
              {res.drawn > 0 ? <primitive object={res.sticks} /> : null}
              {res.edges ? <primitive object={res.edges} /> : null}
            </>
          )}
          {showLabels ? <SchoolBallLabels atoms={model.atoms} crystal={crystal} opacity={labelOpacity} /> : null}
        </group>
      </group>
      {showLabels && captionLabels.length > 0 ? <CinemaDomLabels labels={captionLabels} layout={false} /> : null}
    </group>
  )
}
