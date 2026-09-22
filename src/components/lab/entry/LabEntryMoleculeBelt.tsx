import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { InstancedAtoms, InstancedBonds } from '../../../lab/cinema'
import type { AtomRenderMode } from '../../../lab/cinema/core/atomImpostorShader'
import { pmToAngstrom, SCENE_PER_ANGSTROM } from '../../../lab/cinema/core/atoms'
import { writeHexLinear, type AtomPool, type BondPool } from '../../../lab/cinema/core/pools'
import { createBentFrame, writeBent, writeDiatomic, writeLinear } from '../../../lab/cinema/core/vsepr'
import { ATOMIC_DATA, bondAngleDeg, bondLengthPm, type ElementSymbol } from '../../../chemistry/data'
import type { AppThemeId } from '../../../theme/appTheme'
import { entryAtomCpk } from './labEntryPalette'
import { damp } from '../../../lab/cinema/core/spring'
import { BELT_COMPOUNDS } from './labEntryBelt'
import { emitLabEntryIntent } from './labEntryIntent'

/**
 * Задний пояс экрана входа — четыре настоящих вещества вокруг реакции.
 *
 * Центральный процесс говорит «здесь получают вещества» наполовину; пояс
 * готовых молекул закрывает вторую половину и служит входом в каталог.
 *
 * Пул пишется ОДИН раз при монтировании: пояс крутится поворотом родительской
 * группы, поэтому `version` не растёт и InstancedAtoms пропускает заливку
 * каждый кадр. Невидимые хит-сферы живут в той же группе и едут вместе
 * с молекулами — синхронизировать клик с картинкой не нужно вовсе.
 */

const DEG = Math.PI / 180

function scene(pm: number): number {
  return pmToAngstrom(pm) * SCENE_PER_ANGSTROM
}

const VDW_SHARE = 0.27
const rOf = (s: keyof typeof ATOMIC_DATA) => scene(ATOMIC_DATA[s].vdwRadiusPm) * VDW_SHARE

const BELT_ATOM_COUNT = 12
const BELT_BOND_COUNT = 8

/**
 * Слоты пула по веществам — по ним подсвечивается молекула под указателем.
 * Порядок тот же, что в `writeBelt`: H₂O, CO₂, NH₃, HCl.
 */
const BELT_SLOTS: ReadonlyArray<{ a0: number; a1: number }> = [
  { a0: 0, a1: 3 },
  { a0: 3, a1: 6 },
  { a0: 6, a1: 10 },
  { a0: 10, a1: 12 },
]

/** Дежурное свечение молекулы пояса и свечение молекулы под указателем. */
const BELT_EMISSIVE = 0.11
const BELT_EMISSIVE_HOVER = 0.95

const _origin = new THREE.Vector3()
const _bent = createBentFrame()
const _a = new THREE.Vector3()
const _b = new THREE.Vector3()
const _axis = new THREE.Vector3()

function putAtom(pool: AtomPool, i: number, v: THREE.Vector3, hex: number, radius: number): void {
  pool.position[i * 3] = v.x
  pool.position[i * 3 + 1] = v.y
  pool.position[i * 3 + 2] = v.z
  writeHexLinear(pool.color, i, hex)
  pool.radius[i] = radius
  // Непрозрачность строго 1: у импостеров любая полупрозрачность — screen-door,
  // и фоновые молекулы покрылись бы узором точек. Глубину даёт размер и свечение.
  pool.opacity[i] = 1
  pool.emissive[i] = BELT_EMISSIVE
  pool.charge[i] = 0
}

function putBond(
  pool: BondPool,
  i: number,
  from: THREE.Vector3,
  to: THREE.Vector3,
  hexA: number,
  hexB: number,
  order: number,
  radius: number,
  polarity: number,
): void {
  pool.a[i * 3] = from.x
  pool.a[i * 3 + 1] = from.y
  pool.a[i * 3 + 2] = from.z
  pool.b[i * 3] = to.x
  pool.b[i * 3 + 1] = to.y
  pool.b[i * 3 + 2] = to.z
  writeHexLinear(pool.colorA, i, hexA)
  writeHexLinear(pool.colorB, i, hexB)
  pool.order[i] = order
  pool.radius[i] = radius
  pool.opacity[i] = 1
  pool.form[i] = 1
  pool.polarity[i] = polarity
}

/**
 * Разовая запись пояса. Геометрия — настоящая: угол H–O–H и угол H–N–H
 * тригональной пирамиды NH₃ берутся из ядра (bondAngleDeg), CO₂ линейна.
 * Цвета — CPK ядра через entryAtomCpk: в тёмной теме как есть, в светлой
 * слишком светлые (водород) приглушаются до порога контраста с небом.
 */
function writeBelt(atoms: AtomPool, bonds: BondPool, radius: number, scale: number, theme: AppThemeId): void {
  const cpk = (s: ElementSymbol) => entryAtomCpk(ATOMIC_DATA[s].cpk, theme)
  const H = cpk('H')
  const O = cpk('O')
  const C = cpk('C')
  const N = cpk('N')
  const Cl = cpk('Cl')
  const rH = rOf('H') * scale
  const rO = rOf('O') * scale
  const rC = rOf('C') * scale
  const rN = rOf('N') * scale
  const rCl = rOf('Cl') * scale
  const bondR = 0.03 * scale
  const dOH = scene(bondLengthPm('O-H')) * scale
  const dCO = scene(bondLengthPm('C=O(CO2)')) * scale
  const dNH = scene(bondLengthPm('N-H')) * scale
  const dHCl = scene(bondLengthPm('H-Cl')) * scale

  const slot = (i: number) => beltSlotPosition(i, radius, _origin)

  // --- H₂O ---
  writeBent(_bent, slot(0), bondAngleDeg('water'), dOH, 0.7, 0.35)
  putAtom(atoms, 0, _bent.center, O, rO)
  putAtom(atoms, 1, _bent.l0, H, rH)
  putAtom(atoms, 2, _bent.l1, H, rH)
  putBond(bonds, 0, _bent.center, _bent.l0, O, H, 1, bondR, -0.68)
  putBond(bonds, 1, _bent.center, _bent.l1, O, H, 1, bondR, -0.68)

  // --- CO₂ ---
  writeLinear(_bent, slot(1), dCO, -0.5, 0.22)
  putAtom(atoms, 3, _bent.center, C, rC)
  putAtom(atoms, 4, _bent.l0, O, rO)
  putAtom(atoms, 5, _bent.l1, O, rO)
  putBond(bonds, 2, _bent.center, _bent.l0, C, O, 2, bondR, 0.5)
  putBond(bonds, 3, _bent.center, _bent.l1, C, O, 2, bondR, 0.5)

  // --- NH₃: три связи под полярным углом φ, cos θ = cos²φ − ½·sin²φ ---
  const theta = bondAngleDeg('ammonia') * DEG
  const cosPhi = Math.sqrt((Math.cos(theta) + 0.5) / 1.5)
  const sinPhi = Math.sqrt(Math.max(0, 1 - cosPhi * cosPhi))
  const nCenter = slot(2)
  _a.copy(nCenter)
  putAtom(atoms, 6, _a, N, rN)
  for (let k = 0; k < 3; k++) {
    const az = (k / 3) * Math.PI * 2 + 0.4
    _b.set(sinPhi * Math.cos(az) * dNH, -cosPhi * dNH, sinPhi * Math.sin(az) * dNH).add(_a)
    putAtom(atoms, 7 + k, _b, H, rH)
    putBond(bonds, 4 + k, _a, _b, N, H, 1, bondR, -0.6)
  }

  // --- HCl ---
  _axis.set(0.72, 0.5, -0.48)
  writeDiatomic(_a, _b, slot(3), dHCl, _axis)
  putAtom(atoms, 10, _a, Cl, rCl)
  putAtom(atoms, 11, _b, H, rH)
  putBond(bonds, 7, _a, _b, Cl, H, 1, bondR, -0.62)

  atoms.count = BELT_ATOM_COUNT
  bonds.count = BELT_BOND_COUNT
  atoms.version += 1
  bonds.version += 1
}

/** Центр молекулы пояса в координатах группы — туда же ставится невидимая хит-сфера. */
function beltSlotPosition(i: number, radius: number, out: THREE.Vector3): THREE.Vector3 {
  const a = (i / BELT_COMPOUNDS.length) * Math.PI * 2 + 0.55
  return out.set(Math.cos(a) * radius, Math.sin(a * 2) * 0.22, Math.sin(a) * radius)
}

/**
 * Кольцо отодвинуто назад и наклонено. Наклон задаётся пропом группы, а не
 * первым кадром: при prefers-reduced-motion кадров не будет вовсе, и кольцо
 * осталось бы ребром к зрителю — молекулы слиплись бы в кучу у центра.
 *
 * Камера лаборатории стоит всего в ~3.6 мировых единицах от центра, поэтому
 * кольцо радиуса 4 без сдвига ушло бы ближней половиной ЗА камеру. Сдвиг назад
 * оставляет весь пояс перед камерой, а наклон уводит ближнюю молекулу ВНИЗ,
 * под героя: пояс проходит мимо реакции, а не поперёк неё.
 */
const BELT_GROUP_Z = (radius: number) => -1.02 * radius
const BELT_TILT = 0.72
/**
 * Подъём кольца. Нижняя молекула пояса иначе приходит ровно в полосу подписей
 * (название продукта стоит на 14 % от низа кадра) и спорит с ней за внимание.
 */
const BELT_GROUP_Y = 0.34

export type LabEntryMoleculeBeltProps = {
  pool: AtomPool
  bonds: BondPool
  radius: number
  scale: number
  mode: AtomRenderMode
  lite: boolean
  pausedRef: { current: boolean }
  /** состояние сцены: при prefers-reduced-motion пояс тоже замирает */
  runtime: { reduced: boolean }
  /** сюда пишется id вещества под указателем — подписи показывают подсказку каталога */
  hoverRef: { current: string | null }
  /** тема приложения: от неё зависит адаптация CPK под небо (entryAtomCpk) */
  theme: AppThemeId
}

export function LabEntryMoleculeBelt({
  pool,
  bonds,
  radius,
  scale,
  mode,
  lite,
  pausedRef,
  runtime,
  hoverRef,
  theme,
}: LabEntryMoleculeBeltProps) {
  const group = useRef<THREE.Group>(null)
  const timeRef = useRef(0)
  const hitGeometry = useMemo(() => new THREE.SphereGeometry(1, 12, 8), [])
  const hitMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
    [],
  )
  const slots = useMemo(() => {
    const v = new THREE.Vector3()
    return BELT_COMPOUNDS.map((c, i) => {
      beltSlotPosition(i, radius, v)
      return { id: c.id, x: v.x, y: v.y, z: v.z }
    })
  }, [radius])

  /** Базовые радиусы атомов пояса: подсветка их множит, а не переписывает. */
  const baseR = useMemo(() => new Float32Array(BELT_ATOM_COUNT), [])
  /** Текущая и записанная в пул сила подсветки каждой молекулы. */
  const hoverK = useMemo(() => new Float32Array(BELT_COMPOUNDS.length), [])
  const hoverWritten = useMemo(() => new Float32Array(BELT_COMPOUNDS.length).fill(-1), [])

  useEffect(() => {
    writeBelt(pool, bonds, radius, scale, theme)
    for (let i = 0; i < BELT_ATOM_COUNT; i++) baseR[i] = pool.radius[i]!
    hoverWritten.fill(-1)
  }, [pool, bonds, radius, scale, theme, baseR, hoverWritten])

  useEffect(() => {
    return () => {
      hitGeometry.dispose()
      hitMaterial.dispose()
      hoverRef.current = null
    }
  }, [hitGeometry, hitMaterial, hoverRef])

  useFrame((_, delta) => {
    const g = group.current
    if (!g || pausedRef.current || runtime.reduced) return
    const dt = delta > 0.05 ? 0.05 : delta
    timeRef.current += dt
    g.rotation.y += 0.055 * dt
    // Едва заметное дыхание крена: пояс не читается как жёсткий обруч.
    g.rotation.x = BELT_TILT + Math.sin(timeRef.current * 0.21) * 0.04

    // Отклик на указатель: молекула под ним разгорается и чуть вырастает.
    // Пул переписывается ТОЛЬКО пока идёт разгорание/затухание (доли секунды),
    // в покое версия не растёт и заливка атрибутов не повторяется.
    const hovered = hoverRef.current
    let dirty = false
    for (let i = 0; i < BELT_SLOTS.length; i++) {
      const target = BELT_COMPOUNDS[i]!.id === hovered ? 1 : 0
      const k = damp(hoverK[i]!, target, 9, dt)
      hoverK[i] = Math.abs(k - target) < 1e-3 ? target : k
      if (Math.abs(hoverK[i]! - hoverWritten[i]!) < 0.003) continue
      const s = BELT_SLOTS[i]!
      const kk = hoverK[i]!
      for (let a = s.a0; a < s.a1; a++) {
        pool.emissive[a] = BELT_EMISSIVE + (BELT_EMISSIVE_HOVER - BELT_EMISSIVE) * kk
        pool.radius[a] = baseR[a]! * (1 + 0.14 * kk)
      }
      hoverWritten[i] = kk
      dirty = true
    }
    if (dirty) pool.version += 1
  })

  return (
    <group ref={group} position={[0, BELT_GROUP_Y, BELT_GROUP_Z(radius)]} rotation={[BELT_TILT, 0, 0]}>
      <InstancedAtoms pool={pool} mode={mode} renderOrder={-1} />
      <InstancedBonds pool={bonds} time={timeRef} renderOrder={-1} lite={lite} />
      {slots.map((s) => (
        <mesh
          key={s.id}
          geometry={hitGeometry}
          material={hitMaterial}
          position={[s.x, s.y, s.z]}
          scale={0.34 * scale + 0.24}
          renderOrder={-1}
          onPointerOver={(e) => {
            e.stopPropagation()
            hoverRef.current = s.id
            document.body.style.cursor = 'pointer'
          }}
          onPointerOut={() => {
            if (hoverRef.current === s.id) hoverRef.current = null
            document.body.style.cursor = ''
          }}
          onPointerDown={(e) => {
            // Касание не даёт pointerover — подсветку зажигаем руками.
            e.stopPropagation()
            hoverRef.current = s.id
          }}
          onClick={(e) => {
            e.stopPropagation()
            emitLabEntryIntent('open-catalog', s.id)
          }}
        />
      ))}
    </group>
  )
}
