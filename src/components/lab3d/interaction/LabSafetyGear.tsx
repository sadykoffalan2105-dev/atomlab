/**
 * Средства защиты: очки и перчатки на краю стола, халат на крючке на правой стене. Нажал — надел
 * (labEvents 'safety'), предмет исчезает с места; снять можно в интерфейсе (бейджи). Опыт просит надеть
 * ('needGear') — нужное пульсирует и подписано «Наденьте».
 * HeldHand — рука, держащая предмет перед камерой: в перчатке (если надеты), рукав халата (если надет).
 */
import { RoundedBox, useCursor } from '@react-three/drei'
import { LabLabel } from '../scene/labOccluders'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { labAudio } from '../audio/labAudio'
import { BENCH_TOP_Y, type LabLang, type LabText } from '../labContract'
import { labEvents, type LabGearId } from '../labEvents'
import type { LabMaterials } from '../scene/labMaterials'
import { ROOM } from '../scene/labSceneLayout'
import { labHand, useHand } from './labHandStore'
import css from './labInteraction.module.css'

const WEAR_LABEL: LabText = { ru: 'Наденьте', en: 'Put on', uz: 'Kiying' }

/** Где лежат/висят средства защиты (мир): позиция и поворот. */
export const GEAR_PLACES: Readonly<Record<LabGearId, { pos: readonly [number, number, number]; rotY: number }>> = {
  goggles: { pos: [-1.07, BENCH_TOP_Y, 0.305], rotY: 0.2 },
  gloves: { pos: [-1.1, BENCH_TOP_Y, 0.0], rotY: 0.3 },
  coat: { pos: [ROOM.w / 2 - 0.02, 1.86, 0.12], rotY: -Math.PI / 2 },
}

const SKIN = '#e9b996'
const SLEEVE_SCHOOL = '#2d3e5c'

/** Рука, держащая предмет (в системе предмета: +z к камере). Пальцы обхватывают сосуд спереди. */
export function HeldHand({ r, h, gloved, coat, mats }: { r: number; h: number; gloved: boolean; coat: boolean; mats: LabMaterials }) {
  const skin = useMemo(() => new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.62 }), [])
  const sleeve = useMemo(() => new THREE.MeshStandardMaterial({ color: SLEEVE_SCHOOL, roughness: 0.85 }), [])
  useEffect(() => () => [skin, sleeve].forEach((m) => m.dispose()), [skin, sleeve])
  const hand = gloved ? mats.rubberBlue : skin
  const gy = Math.max(0.012, Math.min(h * 0.42, 0.09))
  const gr = r + 0.007
  return (
    <group position-y={gy}>
      {/* Ладонь — справа от сосуда */}
      <mesh position={[gr + 0.012, 0, -0.004]} scale={[0.55, 1, 1]} material={hand}>
        <capsuleGeometry args={[0.022, 0.045, 6, 12]} />
      </mesh>
      {/* Четыре пальца обхватывают сосуд спереди (дуги вокруг стенки) */}
      {[0.022, 0.008, -0.006, -0.019].map((dy, i) => (
        <mesh key={i} position-y={dy} rotation-x={Math.PI / 2} material={hand}>
          <torusGeometry args={[gr + 0.002, i === 3 ? 0.0068 : 0.0078, 6, 14, 1.35 - i * 0.08]} />
        </mesh>
      ))}
      {/* Большой палец — сзади */}
      <mesh position={[gr * 0.55, 0.018, -gr * 0.85]} rotation={[0, 0.6, 1.25]} material={hand}>
        <capsuleGeometry args={[0.0085, 0.032, 4, 8]} />
      </mesh>
      {/* Запястье и рукав (белый халат — если надет) уходят вправо-вниз за край кадра */}
      <mesh position={[gr + 0.05, -0.045, -0.02]} rotation-z={0.95} material={hand}>
        <capsuleGeometry args={[0.019, 0.05, 4, 10]} />
      </mesh>
      {gloved && (
        <mesh position={[gr + 0.072, -0.06, -0.02]} rotation-z={0.95} material={mats.rubberBlue}>
          <cylinderGeometry args={[0.024, 0.023, 0.03, 14]} />
        </mesh>
      )}
      <mesh position={[gr + 0.13, -0.11, -0.03]} rotation-z={0.95} material={coat ? mats.whitePlastic : sleeve}>
        <cylinderGeometry args={[0.036, 0.04, 0.16, 16]} />
      </mesh>
    </group>
  )
}

function GogglesModel({ mats }: { mats: LabMaterials }) {
  return (
    <group>
      <RoundedBox args={[0.16, 0.05, 0.06]} radius={0.02} position-y={0.026} material={mats.glass} />
      <RoundedBox args={[0.165, 0.054, 0.012]} radius={0.005} position={[0, 0.027, 0.03]} material={mats.rubberBlue} />
      <mesh position={[0, 0.006, -0.04]} rotation-x={Math.PI / 2} material={mats.blackPlastic}>
        <torusGeometry args={[0.07, 0.004, 6, 24, Math.PI]} />
      </mesh>
    </group>
  )
}

/** Пальцы плоской нитриловой перчатки: z — поперёк ладони, длина (м). Средний — самый длинный. */
const GLOVE_FINGERS: ReadonlyArray<readonly [number, number]> = [
  [-0.03, 0.04],
  [-0.01, 0.052],
  [0.01, 0.056],
  [0.03, 0.048],
]

/** Одна нитриловая перчатка, лежит плашмя на столе (низ = столешница), пальцы к −x. mirror — левая/правая. */
function Glove({ mats, mirror }: { mats: LabMaterials; mirror: boolean }) {
  const m = mats.rubberBlue
  return (
    <group scale-z={mirror ? -1 : 1}>
      {/* Ладонь: сплющенная капсула толщиной ~2 см */}
      <mesh position={[0, 0.0095, 0]} rotation-z={Math.PI / 2} scale={[0.32, 1, 1.42]} material={m} castShadow>
        <capsuleGeometry args={[0.03, 0.06, 6, 14]} />
      </mesh>
      {/* Четыре пальца разной длины */}
      {GLOVE_FINGERS.map(([fz, len]) => (
        <mesh key={fz} position={[-0.062 - len / 2, 0.0055, fz]} rotation-z={Math.PI / 2} scale={[0.62, 1, 1]} material={m} castShadow>
          <capsuleGeometry args={[0.0088, len - 0.0176, 4, 10]} />
        </mesh>
      ))}
      {/* Большой палец — в сторону, под углом */}
      <group position={[-0.03, 0.0055, 0.05]} rotation-y={-0.75}>
        <mesh position-x={-0.022} rotation-z={Math.PI / 2} scale={[0.62, 1, 1]} material={m} castShadow>
          <capsuleGeometry args={[0.0095, 0.03, 4, 10]} />
        </mesh>
      </group>
      {/* Манжета с закатанным валиком */}
      <mesh position={[0.088, 0.008, 0]} rotation-z={Math.PI / 2} scale={[0.26, 1, 1.5]} material={m}>
        <capsuleGeometry args={[0.031, 0.04, 4, 12]} />
      </mesh>
      <mesh position={[0.127, 0.006, 0]} rotation-x={Math.PI / 2} material={m}>
        <cylinderGeometry args={[0.006, 0.006, 0.094, 8]} />
      </mesh>
    </group>
  )
}

/** Пара перчаток рядом (правая и левая), чуть развёрнуты — как их кладут на стол. */
function GlovesModel({ mats }: { mats: LabMaterials }) {
  return (
    <group position-z={-0.052}>
      <Glove mats={mats} mirror={false} />
      <group position={[0.025, 0, 0.105]} rotation-y={0.14}>
        <Glove mats={mats} mirror />
      </group>
    </group>
  )
}

/**
 * «Надевание»: средство защиты не исчезает мгновенно — за 0,55 с поднимается со стола к ученику (к камере) и
 * уменьшается, затем пропадает (на руке уже перчатки, см. HeldHand). При снятии — снова лежит на месте.
 */
function WearAway({ worn, children }: { worn: boolean; children: ReactNode }) {
  const g = useRef<THREE.Group>(null)
  const [gone, setGone] = useState(worn)
  const anim = useRef<{ t: number; to: THREE.Vector3 } | null>(null)
  useEffect(() => {
    if (worn) return
    anim.current = null
    setGone(false)
    g.current?.position.set(0, 0, 0)
    g.current?.scale.setScalar(1)
  }, [worn])
  useFrame((s, dt) => {
    const grp = g.current
    if (!worn || gone || !grp?.parent) return
    if (!anim.current) {
      // Куда лететь: чуть ниже и впереди камеры — в локальных координатах места предмета
      const to = s.camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(0.35).add(s.camera.position)
      to.y -= 0.18
      anim.current = { t: 0, to: grp.parent.worldToLocal(to) }
    }
    const a = anim.current
    a.t = Math.min(1, a.t + dt / 0.55)
    const e = a.t * a.t * (3 - 2 * a.t)
    grp.position.copy(a.to).multiplyScalar(e * 0.8)
    grp.position.y += Math.sin(Math.PI * a.t) * 0.08
    grp.scale.setScalar(1 - 0.55 * e)
    if (a.t >= 1) setGone(true)
  })
  if (gone) return null
  return <group ref={g}>{children}</group>
}

/** Халат на плечиках, крючок на стене. Локально: стена позади (−z), халат висит перед ней. */
function CoatModel({ mats, hidden }: { mats: LabMaterials; hidden: boolean }) {
  return (
    <group>
      {/* Крючок-вешалка на стене */}
      <mesh position={[0, 0.02, 0.01]} material={mats.chrome}>
        <boxGeometry args={[0.06, 0.1, 0.012]} />
      </mesh>
      <mesh position={[0, 0.04, 0.04]} rotation-x={Math.PI / 2} material={mats.chrome}>
        <cylinderGeometry args={[0.006, 0.006, 0.06, 8]} />
      </mesh>
      {!hidden && (
        <group position={[0, -0.02, 0.07]}>
          {/* Плечики */}
          <mesh rotation-z={Math.PI / 2} material={mats.wood}>
            <capsuleGeometry args={[0.008, 0.36, 4, 8]} />
          </mesh>
          {/* Плечи и полы халата */}
          <RoundedBox args={[0.42, 0.08, 0.1]} radius={0.035} position-y={-0.03} material={mats.whitePlastic} />
          <RoundedBox args={[0.38, 0.86, 0.07]} radius={0.03} position-y={-0.47} material={mats.whitePlastic} />
          {/* Рукава */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.205, -0.36, 0.005]} rotation-z={s * 0.08} material={mats.whitePlastic}>
              <capsuleGeometry args={[0.042, 0.52, 4, 12]} />
            </mesh>
          ))}
          {/* Воротник и пуговицы */}
          <mesh position={[0, -0.07, 0.04]} rotation-x={-0.3} material={mats.whitePlastic}>
            <coneGeometry args={[0.1, 0.12, 3]} />
          </mesh>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} position={[0.03, -0.2 - i * 0.16, 0.037]} rotation-x={Math.PI / 2} material={mats.blackPlastic}>
              <cylinderGeometry args={[0.008, 0.008, 0.004, 10]} />
            </mesh>
          ))}
          {/* Карман */}
          <mesh position={[-0.1, -0.62, 0.037]} material={mats.door}>
            <planeGeometry args={[0.1, 0.11]} />
          </mesh>
        </group>
      )}
    </group>
  )
}

function GearSpot({
  gear,
  lang,
  needed,
  worn,
  ringR,
  ringY,
  labelY,
  children,
}: {
  gear: LabGearId
  lang: LabLang
  needed: boolean
  worn: boolean
  ringR: number
  ringY: number
  labelY: number
  children: ReactNode
}) {
  const [hover, setHover] = useState(false)
  useCursor(hover && !worn)
  const ring = useRef<THREE.Mesh>(null)
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#2f7cf6', transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }), [])
  useEffect(() => () => ringMat.dispose(), [ringMat])
  useFrame((s) => {
    if (ring.current) ring.current.scale.setScalar(needed ? 1 + 0.15 * Math.sin(s.clock.elapsedTime * 4) : 1)
  })
  const place = GEAR_PLACES[gear]
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (worn) return
    labHand.wear(gear, true)
    labAudio.play('click', { at: place.pos, gain: 0.35 })
  }
  return (
    <group
      position={place.pos as unknown as THREE.Vector3Tuple}
      rotation-y={place.rotY}
      onClick={onClick}
      onDoubleClick={(e) => e.stopPropagation()}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHover(true)
      }}
      onPointerOut={() => setHover(false)}
      userData={{ interactive: true }}
    >
      {children}
      {!worn && (needed || hover) && (
        <mesh ref={ring} position={[0, ringY, gear === 'coat' ? 0.08 : 0]} rotation-x={gear === 'coat' ? 0 : -Math.PI / 2} material={ringMat} raycast={() => null}>
          <ringGeometry args={[ringR, ringR + 0.012, 40]} />
        </mesh>
      )}
      {!worn && needed && (
        <LabLabel position={[0, labelY, gear === 'coat' ? 0.1 : 0]}>
          <div className={css.tagGear}>{WEAR_LABEL[lang]}</div>
        </LabLabel>
      )}
    </group>
  )
}

export function LabSafetyGear({ mats, lang }: { mats: LabMaterials; lang: LabLang }) {
  const hand = useHand()
  // Опыт просит надеть средства защиты (и сцена, смонтированная позже, тоже узнаёт по событию)
  useEffect(() => labEvents.on('needGear', (e) => labHand.setGearNeed(e.gear)), [])
  const w = (g: LabGearId) => hand.worn.includes(g)
  const n = (g: LabGearId) => hand.gearNeed.includes(g)
  return (
    <group>
      <GearSpot gear="goggles" lang={lang} needed={n('goggles')} worn={w('goggles')} ringR={0.1} ringY={0.003} labelY={0.1}>
        <WearAway worn={w('goggles')}>
          <GogglesModel mats={mats} />
        </WearAway>
        {/* Невидимая зона нажатия */}
        <mesh position-y={0.03} visible={false}>
          <boxGeometry args={[0.2, 0.07, 0.12]} />
        </mesh>
      </GearSpot>
      <GearSpot gear="gloves" lang={lang} needed={n('gloves')} worn={w('gloves')} ringR={0.1} ringY={0.003} labelY={0.08}>
        <WearAway worn={w('gloves')}>
          <GlovesModel mats={mats} />
        </WearAway>
        <mesh position={[0, 0.02, 0]} visible={false}>
          <boxGeometry args={[0.28, 0.05, 0.2]} />
        </mesh>
      </GearSpot>
      <GearSpot gear="coat" lang={lang} needed={n('coat')} worn={w('coat')} ringR={0.3} ringY={-0.45} labelY={0.12}>
        <CoatModel mats={mats} hidden={w('coat')} />
        <mesh position={[0, -0.45, 0.08]} visible={false}>
          <boxGeometry args={[0.5, 0.95, 0.1]} />
        </mesh>
      </GearSpot>
    </group>
  )
}
