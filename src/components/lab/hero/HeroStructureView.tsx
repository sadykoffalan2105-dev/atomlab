import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useLocale } from '../../../i18n/useLocale'
import { createAtomPool, createBondPool } from '../../../lab/cinema/core/pools'
import { smoothstep } from '../../../lab/cinema/core/easing'
import { InstancedAtoms } from '../../../lab/cinema/react/InstancedAtoms'
import { InstancedBonds } from '../../../lab/cinema/react/InstancedBonds'
import { CinemaCellEdges } from '../../../lab/cinema/react/CinemaCellEdges'
import { CinemaDomLabels, type DomLabelSource } from '../../../lab/cinema/react/CinemaDomLabels'
import { commitPool, cpkHex, writeAtom, writeBond } from '../../../lab/cinema/scenes/kit/cpkAtoms'
import { materialFor } from '../../../lab/cinema/scenes/kit/materials'
import { writeBondVisual } from '../../../lab/cinema/scenes/kit/bondVisual'
import { createEdgePool, setCellEdgesAmount, writeCellEdges } from '../../../lab/cinema/scenes/kit/lattice'
import type { SceneWorld } from '../../../lab/cinema/scenes/kit/sceneKit'
import { localizeLabelText, toSceneLocale } from '../../../lab/cinema/scenes/kit/sceneKit'
import type { HeroModel } from './heroGeometry'
import { CAPTION_GAP_PX, CAPTION_LINE_PX, HERO_FIT_RADIUS, HERO_ORBIT_RAD_PER_SEC, heroCaptionLines } from './heroFrame'
import { NaclHeroBody } from './NaclHeroBody'

/**
 * Общий рендер героя: атомы — один InstancedAtoms (материалы kit: ion / polar / covalent / gas),
 * связи — один InstancedBonds (σ, кратные, водородные пунктиром), рёбра ячеек — CinemaCellEdges,
 * подписи — DOM-слой CinemaDomLabels (только символы, заряды, числа и токены единиц).
 *
 * Без свечения и ауры: emissive 0, свет только сценический (LabReactorLights + освещение шейдера).
 * Пулы пишутся ОДИН раз при монтировании; в кадре — только поворот группы (медленный облёт)
 * и прозрачность подписей, без аллокаций.
 *
 * Модель нормируется одним множителем под радиус HERO_FIT_RADIUS: отношения размеров
 * (Na⁺ меньше Cl⁻, длины связей) остаются честными.
 */

/** Толщина σ-связи в мире кино-ядра — та же, что у сцен (kit/bondVisual по умолчанию). */
const BOND_RADIUS = 0.05

const _scale = new THREE.Vector3()
const _target = new THREE.Vector3()

/**
 * Подпись кристалла над узлом: высота над центром в радиусах шара. Подъём заметный — между
 * текстом и шаром должна помещаться ВИДИМАЯ выноска (при подъёме в два радиуса отрезок выходил
 * короче самой надписи и прятался под ней).
 */
const CRYSTAL_LABEL_LIFT = 4.2
/** Цвет выноски «подпись → её ион» (приёмка: «Na⁺» и «Cl⁻» висели рядом над решёткой без выносок). */
const LEADER_COLOR = 0xcfe4ff

/** Подпись кристалла: текущий узел-якорь и кандидаты верхнего слоя (см. HeroLabel.candidates). */
type CrystalLabelTrack = { candidates: number[]; current: number; minSep: number }

/**
 * Кристалл: каждый кадр подпись сорта переезжает (плавно, без моргания) к узлу верхнего слоя,
 * который после облёта дальше всех от зрителя, — над ним нет чужих сфер. Разные сорта не садятся
 * на соседние узлы (minSep). Гистерезис: якорь меняется, только если новый заметно дальше.
 *
 * Заодно пишется ВЫНОСКА от текста к своему шару: без неё «Na⁺» и «Cl⁻» стояли в шестидесяти
 * пикселях друг от друга над верхним краем решётки, и какой ион назван — понять было нельзя.
 */
function trackCrystalLabels(model: HeroModel, labels: DomLabelSource[], tracks: (CrystalLabelTrack | null)[], spinY: number, d: number, leader?: Float32Array): void {
  const s = Math.sin(spinY)
  const c = Math.cos(spinY)
  const k = 1 - Math.exp(-d * 5)
  for (let li = 0; li < tracks.length; li++) {
    const tr = tracks[li]
    const label = labels[li]
    if (!tr || !label) continue
    const depth = (i: number) => {
      const p = model.atoms[i]!.pos
      return -p[0] * s + p[2] * c
    }
    const clash = (i: number) => {
      const p = model.atoms[i]!.pos
      for (let lj = 0; lj < li; lj++) {
        const o = tracks[lj]
        if (!o) continue
        const q = model.atoms[o.current]!.pos
        if (Math.hypot(p[0] - q[0], p[2] - q[2]) < tr.minSep) return true
      }
      return false
    }
    let best = tr.current
    let bestDepth = clash(best) ? Infinity : depth(best) - tr.minSep * 0.15
    for (const i of tr.candidates) {
      if (clash(i)) continue
      const z = depth(i)
      if (z < bestDepth) {
        bestDepth = z
        best = i
      }
    }
    tr.current = best
    const a = model.atoms[best]!
    _target.set(a.pos[0], a.pos[1] + a.radius * CRYSTAL_LABEL_LIFT, a.pos[2])
    label.pos.lerp(_target, k)
    if (leader) {
      const o = li * 6
      leader[o] = a.pos[0]
      leader[o + 1] = a.pos[1] + a.radius * 1.05
      leader[o + 2] = a.pos[2]
      leader[o + 3] = label.pos.x
      leader[o + 4] = label.pos.y - a.radius * 1.15
      leader[o + 5] = label.pos.z
    }
  }
}
const _rootPos = new THREE.Vector3()

/**
 * Кадр героя без аллокаций: облёт, проявление подписей по росту героя и раскладка строк подписи
 * под моделью в CSS-пикселях. Вынесено из компонента: подписи — изменяемые буферы CinemaDomLabels.
 */
function stepHeroFrame(
  state: { camera: THREE.Camera; size: { height: number } },
  dt: number,
  f: {
    root: THREE.Group | null
    spin: THREE.Group | null
    time: { current: number }
    showLabels: boolean
    scale: number
    model: HeroModel
    atomLabels: DomLabelSource[]
    captionLabels: DomLabelSource[]
    labelTracks: (CrystalLabelTrack | null)[]
    leader: { geometry: THREE.BufferGeometry; material: THREE.LineBasicMaterial } | null
  },
): void {
  const d = Math.min(0.1, Math.max(0, dt))
  f.time.current += d
  if (f.spin) {
    f.spin.rotation.y += d * HERO_ORBIT_RAD_PER_SEC
    if (f.labelTracks.length > 0) {
      const buf = f.leader ? ((f.leader.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array) : undefined
      trackCrystalLabels(f.model, f.atomLabels, f.labelTracks, f.spin.rotation.y, d, buf)
      if (f.leader) f.leader.geometry.getAttribute('position').needsUpdate = true
    }
  }
  // Подписи проявляются, когда герой вырос почти до полного размера (после «рождения»).
  let op = 0
  const root = f.root
  if (f.showLabels && root) {
    root.getWorldScale(_scale)
    op = smoothstep(0.82 * f.scale, 0.98 * f.scale, _scale.x)
  }
  for (let i = 0; i < f.atomLabels.length; i++) f.atomLabels[i]!.opacity = op
  if (f.leader) f.leader.material.opacity = op * 0.7
  // Подпись под моделью: строки через фиксированные CSS-пиксели при любом масштабе кадра.
  if (root && f.captionLabels.length > 0 && op > 0) {
    const cam = state.camera as THREE.PerspectiveCamera
    root.getWorldPosition(_rootPos)
    const dist = cam.position.distanceTo(_rootPos)
    const h = Math.max(1, state.size.height)
    const worldPerPx = (2 * dist * Math.tan(((cam.fov || 46) * Math.PI) / 360)) / h
    const localPerPx = worldPerPx / Math.max(1e-6, _scale.x)
    for (let i = 0; i < f.captionLabels.length; i++) {
      f.captionLabels[i]!.pos.y = -f.model.radius - (CAPTION_GAP_PX + (i + 0.5) * CAPTION_LINE_PX) * localPerPx
    }
  }
  for (let i = 0; i < f.captionLabels.length; i++) f.captionLabels[i]!.opacity = op * 0.92
}

export function HeroStructureView({
  model,
  showLabels,
  lowPower = false,
  handoff = false,
}: {
  model: HeroModel
  /** DOM-подписи: только когда герой реально в кадре (не прогрев, не зародыш) */
  showLabels: boolean
  lowPower?: boolean
  /** слот, на который сцена урока заявила передачу кадра (hero/heroHandoff) */
  handoff?: boolean
}) {
  const locale = toSceneLocale(useLocale().locale)
  const rootRef = useRef<THREE.Group>(null)
  const spinRef = useRef<THREE.Group>(null)
  const time = useRef(0)
  const scale = HERO_FIT_RADIUS / Math.max(1e-6, model.radius)

  const pools = useMemo(() => {
    // NaCl рисует своё тело (NaclHeroBody) — пулы кино-ядра ему не нужны: не тратим кадр embryo.
    if (model.compoundId === 'nacl') return { atoms: createAtomPool(1), bonds: createBondPool(1), edges: createEdgePool(1) }
    const atoms = createAtomPool(Math.max(1, model.atoms.length))
    const bonds = createBondPool(Math.max(1, model.bonds.length))
    const edges = createEdgePool(Math.max(1, model.cellEdges.length))
    const v = new THREE.Vector3()
    const w = new THREE.Vector3()
    model.atoms.forEach((a, i) => {
      writeAtom(atoms, i, {
        pos: v.set(a.pos[0], a.pos[1], a.pos[2]),
        radius: a.radius,
        colorHex: cpkHex(a.el),
        // Кромка по знаку заряда только у ионов; у ковалентных — нейтральная.
        charge: a.charge === 0 ? 0 : Math.sign(a.charge) * 0.6,
        emissive: 0,
        // Непрозрачно: полупрозрачный импостор рисуется «сеткой» (screen-door) и выглядит браком.
        opacity: 1,
        surface: materialFor(a.surface),
      })
    })
    commitPool(atoms, model.atoms.length)
    // Для hbond writeBondVisual пишет только world.bonds — остальные поля мира не нужны.
    const world = { bonds } as unknown as SceneWorld
    model.bonds.forEach((b, i) => {
      const A = model.atoms[b.a]!
      const B = model.atoms[b.b]!
      v.set(A.pos[0], A.pos[1], A.pos[2])
      w.set(B.pos[0], B.pos[1], B.pos[2])
      if (b.kind === 'hbond') {
        writeBondVisual(world, i, v, w, 'hbond', 1, 0.9, undefined, { radius: BOND_RADIUS * 0.7 })
      } else {
        writeBond(bonds, i, {
          a: v,
          b: w,
          radius: BOND_RADIUS,
          colorA: cpkHex(A.el),
          colorB: cpkHex(B.el),
          order: b.order,
          opacity: 1,
        })
      }
    })
    commitPool(bonds, model.bonds.length)
    if (model.cellEdges.length > 0) {
      writeCellEdges(edges, model.cellEdges)
      setCellEdgesAmount(edges, 1)
    }
    return { atoms, bonds, edges }
  }, [model])

  // Подписи: на атомах (вращаются с моделью) и строка-подпись под моделью (не вращается).
  const atomLabels = useMemo<DomLabelSource[]>(
    () =>
      model.labels
        .filter((l) => l.atom >= 0)
        .map((l, i) => {
          const a = model.atoms[l.atom]!
          // Молекула: подпись сбоку и чуть выше шара — не закрывает сам атом и соседа по вертикальной оси (CO₂).
          // Кристалл: подпись над атомом верхнего слоя (см. heroGeometry) — снаружи фрагмента.
          const crystal = model.cellEdges.length > 0
          return {
            id: `hero-atom-${i}`,
            kind: l.kind,
            pos: crystal
              ? new THREE.Vector3(a.pos[0], a.pos[1] + a.radius * CRYSTAL_LABEL_LIFT, a.pos[2])
              : new THREE.Vector3(a.pos[0] + a.radius * 1.25, a.pos[1] + a.radius * 0.6, a.pos[2]),
            opacity: 0,
            // Десятичная запятая на ru/uz — то же соглашение, что у подписей сцены урока.
            text: localizeLabelText(l.text, locale, true),
          }
        }),
    [model, locale],
  )
  const captionLabels = useMemo<DomLabelSource[]>(
    () =>
      heroCaptionLines(model.caption).map((text, i) => ({
        id: `hero-caption-${i}`,
        kind: 'species',
        // Y пересчитывается в кадре: отступ и шаг строк заданы в пикселях, а не в долях модели.
        pos: new THREE.Vector3(0, -model.radius, 0),
        opacity: 0,
        text: localizeLabelText(text, locale, true),
      })),
    [model, locale],
  )

  // Якоря подписей кристалла (по одному на подпись атома; у молекулы — нет).
  const labelTracks = useMemo<(CrystalLabelTrack | null)[]>(() => {
    if (model.cellEdges.length === 0) return []
    const list = model.labels.filter((l) => l.atom >= 0)
    return list.map((l) => {
      const cand = l.candidates && l.candidates.length > 0 ? l.candidates : [l.atom]
      // Минимальное расстояние между подписями разных сортов — полтора расстояния до ближайшего узла.
      let nn = Infinity
      for (const i of cand) for (const j of cand) {
        if (i === j) continue
        const p = model.atoms[i]!.pos
        const q = model.atoms[j]!.pos
        nn = Math.min(nn, Math.hypot(p[0] - q[0], p[2] - q[2]))
      }
      // Разные сорта разводятся на полтора шага сетки: раньше «Na⁺» и «Cl⁻» садились на соседние
      // узлы и на экране оказывались в шестидесяти пикселях друг от друга.
      return { candidates: cand, current: l.atom, minSep: Number.isFinite(nn) ? nn * 1.6 : 0 }
    })
  }, [model])

  /** Выноски «подпись → её ион» (только у кристалла): отрезок на подпись, буфер пишется в кадре. */
  const leader = useMemo(() => {
    if (labelTracks.length === 0) return null
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(labelTracks.length * 6), 3))
    // depthTest выключен намеренно: выноска — это «чертёж» поверх модели; с тестом глубины отрезок
    // от ДАЛЬНЕГО узла верхнего слоя (над ним нет чужих сфер) полностью прятался за кристаллом.
    const material = new THREE.LineBasicMaterial({ color: LEADER_COLOR, transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false })
    return { geometry, material }
  }, [labelTracks])

  useEffect(() => {
    if (!leader) return
    return () => {
      leader.geometry.dispose()
      leader.material.dispose()
    }
  }, [leader])

  useEffect(() => {
    time.current = 0
  }, [model])

  useFrame((state, dt) => {
    stepHeroFrame(state, dt, { root: rootRef.current, spin: spinRef.current, time, showLabels, scale, model, atomLabels, captionLabels, labelTracks, leader })
  })

  return (
    <group ref={rootRef} scale={scale} name="lab-product-hero-structure">
      {/* Наклон к зрителю снаружи, облёт — вращение вокруг собственной вертикали внутри. */}
      <group rotation={[0.32, 0, 0]}>
        <group ref={spinRef} rotation={[0, 0.55, 0]}>
          {model.compoundId === 'nacl' ? (
            // NaCl — та же решётка, что в финале сцены урока (без второй решётки при передаче кадра).
            <NaclHeroBody lowPower={lowPower} handoff={handoff} />
          ) : (
            <>
              <InstancedAtoms pool={pools.atoms} mode={lowPower ? 'mesh' : 'impostor'} renderOrder={9} />
              {model.bonds.length > 0 ? <InstancedBonds pool={pools.bonds} time={time} renderOrder={10} lite={lowPower} /> : null}
              {model.cellEdges.length > 0 ? <CinemaCellEdges pool={pools.edges} renderOrder={11} /> : null}
            </>
          )}
          {showLabels && leader ? <lineSegments geometry={leader.geometry} material={leader.material} renderOrder={12} frustumCulled={false} /> : null}
          {showLabels && atomLabels.length > 0 ? <CinemaDomLabels labels={atomLabels} layout={false} /> : null}
        </group>
      </group>
      {showLabels && captionLabels.length > 0 ? <CinemaDomLabels labels={captionLabels} layout={false} /> : null}
    </group>
  )
}
