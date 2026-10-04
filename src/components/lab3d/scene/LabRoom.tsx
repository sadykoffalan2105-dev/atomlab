/**
 * Комната светлой школьной лаборатории: пол-плитка, стены, окно с дневным светом, потолочные панели,
 * лабораторный остров с белой химстойкой столешницей, вытяжной шкаф, столешница с раковиной и полками,
 * плакаты, огнетушитель, аптечка, часы. Только процедурная геометрия.
 */
import { RoundedBox, useCursor } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { LabLang } from '../labContract'
import { BenchCabinet, WallCabinet } from '../interaction/LabCabinets'
import { labHand } from '../interaction/labHandStore'
import { SHELF_BOARD_Y, SHELF_X0 } from '../interaction/labItems'
import { BENCH, COUNTER, HOOD, ROOM, SINK_X } from './labSceneLayout'
import type { LabMaterials } from './labMaterials'
import {
  ceilingTexture,
  floorTexture,
  periodicPosterTexture,
  safetyPosterTexture,
  signTexture,
  windowViewTexture,
} from './labTextures'

/**
 * Планки-подписи на кромке полок с реактивами — по реальному порядку банок (labItems: шаг 0,152 м от SHELF_X0):
 * нижняя полка — HCl, H₂SO₄ | NaOH, Ca(OH)₂ | BaCl₂, NaCl, CuSO₄; верхняя — Zn, Fe, Al | CuO, CaO | спирт.
 */
const SHELF_GROUPS: ReadonlyArray<{ shelf: 0 | 1; from: number; to: number; color: string; text: Readonly<Record<LabLang, string>> }> = [
  { shelf: 0, from: 0, to: 1, color: '#c8352b', text: { ru: 'Кислоты', en: 'Acids', uz: 'Kislotalar' } },
  { shelf: 0, from: 2, to: 3, color: '#2a6fd6', text: { ru: 'Щёлочи', en: 'Alkalis', uz: 'Ishqorlar' } },
  { shelf: 0, from: 4, to: 6, color: '#2b8a52', text: { ru: 'Соли', en: 'Salts', uz: 'Tuzlar' } },
  { shelf: 1, from: 0, to: 2, color: '#5d6875', text: { ru: 'Металлы', en: 'Metals', uz: 'Metallar' } },
  { shelf: 1, from: 3, to: 4, color: '#7a5a2e', text: { ru: 'Оксиды', en: 'Oxides', uz: 'Oksidlar' } },
  { shelf: 1, from: 5, to: 5, color: '#c97a10', text: { ru: 'Спирт', en: 'Ethanol', uz: 'Spirt' } },
]
const SHELF_STEP = 0.152
const SHELF_TAG_H = 0.03

/** Подписи групп реактивов на кромке полок (одна текстура на группу, перерисовываются при смене языка). */
function ShelfLabels({ lang }: { lang: LabLang }) {
  const tags = useMemo(
    () =>
      SHELF_GROUPS.map((g) => {
        const w = (g.to - g.from) * SHELF_STEP + 0.12
        const tex = signTexture(g.text[lang], g.color, '#ffffff', Math.round((64 * w) / SHELF_TAG_H), 64)
        tex.anisotropy = 4
        const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 })
        return { g, w, x: SHELF_X0 + ((g.from + g.to) / 2) * SHELF_STEP, tex, mat }
      }),
    [lang],
  )
  useEffect(
    () => () => {
      for (const t of tags) {
        t.tex.dispose()
        t.mat.dispose()
      }
    },
    [tags],
  )
  return (
    <>
      {tags.map((t) => (
        <mesh key={`${t.g.shelf}:${t.g.from}`} position={[t.x, SHELF_BOARD_Y[t.g.shelf], ROOM.frontZ + 0.3 + 0.0015]} material={t.mat} raycast={() => null}>
          <planeGeometry args={[t.w, SHELF_TAG_H]} />
        </mesh>
      ))}
    </>
  )
}

const DEPTH = ROOM.backZ - ROOM.frontZ
const MID_Z = (ROOM.backZ + ROOM.frontZ) / 2
/** Проём окна в левой стене. */
const WIN = { z0: -0.45, z1: 2.75, y0: 0.95, y1: 2.6 } as const

interface Props {
  readonly mats: LabMaterials
  readonly lang: LabLang
  readonly quality: 'low' | 'high'
}

function useDisposable<T extends { dispose: () => void }>(make: () => T, deps: readonly unknown[]): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = useMemo(make, deps)
  useEffect(() => () => value.dispose(), [value])
  return value
}

export function LabRoom({ mats, lang }: Props) {
  const [posterHover, setPosterHover] = useState(false)
  useCursor(posterHover)
  const floorMap = useDisposable(() => {
    const t = floorTexture()
    t.repeat.set(ROOM.w / 2.4, DEPTH / 2.4)
    return t
  }, [])
  const ceilMap = useDisposable(() => {
    const t = ceilingTexture()
    t.repeat.set(ROOM.w / 0.6, DEPTH / 0.6)
    return t
  }, [])
  const viewMap = useDisposable(() => windowViewTexture(), [])
  const safetyMap = useDisposable(() => safetyPosterTexture(lang), [lang])
  const periodicMap = useDisposable(() => periodicPosterTexture(), [])

  const floorMat = useDisposable(
    () => new THREE.MeshStandardMaterial({ map: floorMap, roughness: 0.42, metalness: 0, envMapIntensity: 0.7 }),
    [floorMap],
  )
  const ceilMat = useDisposable(() => new THREE.MeshStandardMaterial({ map: ceilMap, roughness: 0.95 }), [ceilMap])

  const halfW = ROOM.w / 2
  return (
    <group>
      {/* Пол и потолок */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, MID_Z]} receiveShadow material={floorMat}>
        <planeGeometry args={[ROOM.w, DEPTH]} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position={[0, ROOM.h, MID_Z]} material={ceilMat}>
        <planeGeometry args={[ROOM.w, DEPTH]} />
      </mesh>

      {/* Передняя стена (с доской), задняя, правая */}
      <mesh position={[0, ROOM.h / 2, ROOM.frontZ]} material={mats.wall} receiveShadow>
        <planeGeometry args={[ROOM.w, ROOM.h]} />
      </mesh>
      <mesh position={[0, ROOM.h / 2, ROOM.backZ]} rotation-y={Math.PI} material={mats.wall}>
        <planeGeometry args={[ROOM.w, ROOM.h]} />
      </mesh>
      <mesh position={[halfW, ROOM.h / 2, MID_Z]} rotation-y={-Math.PI / 2} material={mats.wall} receiveShadow>
        <planeGeometry args={[DEPTH, ROOM.h]} />
      </mesh>
      <LeftWallWithWindow mats={mats} viewMap={viewMap} />

      {/* Мягкая акустическая панель за доской — светлый акцент передней стены */}
      <mesh position={[0, 1.66, ROOM.frontZ + 0.004]}>
        <planeGeometry args={[2.5, 1.5]} />
        <meshStandardMaterial color="#dbe7f3" roughness={0.95} />
      </mesh>
      {/* Плинтусы */}
      <mesh position={[0, 0.05, ROOM.frontZ + 0.006]} material={mats.whitePlastic}>
        <boxGeometry args={[ROOM.w, 0.1, 0.012]} />
      </mesh>
      <mesh position={[halfW - 0.006, 0.05, MID_Z]} material={mats.whitePlastic}>
        <boxGeometry args={[0.012, 0.1, DEPTH]} />
      </mesh>
      <mesh position={[-halfW + 0.006, 0.05, MID_Z]} material={mats.whitePlastic}>
        <boxGeometry args={[0.012, 0.1, DEPTH]} />
      </mesh>

      <CeilingLights mats={mats} />
      <StudentBench mats={mats} lang={lang} />
      <FumeHood mats={mats} />
      <SinkCounter mats={mats} />
      <ShelfLabels lang={lang} />

      {/* Плакат «Техника безопасности» слева от вытяжки — нажатие открывает правила § 1.3–1.4 */}
      <group
        position={[-halfW + 0.36, 1.62, ROOM.frontZ + 0.012]}
        onClick={(e) => {
          e.stopPropagation()
          labHand.setRulesOpen(true)
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          setPosterHover(true)
        }}
        onPointerOut={() => setPosterHover(false)}
        userData={{ interactive: true }}
      >
        <mesh material={mats.whitePlastic} position-z={-0.004}>
          <boxGeometry args={[0.5, 0.7, 0.008]} />
        </mesh>
        <mesh position-z={0.001}>
          <planeGeometry args={[0.47, 0.66]} />
          <meshStandardMaterial map={safetyMap} roughness={0.6} />
        </mesh>
      </group>

      {/* Таблица Менделеева на правой стене */}
      <group position={[halfW - 0.012, 1.72, 1.35]} rotation-y={-Math.PI / 2}>
        <mesh material={mats.metal} position-z={-0.004}>
          <boxGeometry args={[1.72, 1.1, 0.01]} />
        </mesh>
        <mesh position-z={0.002}>
          <planeGeometry args={[1.68, 1.05]} />
          <meshStandardMaterial map={periodicMap} roughness={0.5} />
        </mesh>
      </group>

      {/* Аптечка на правой стене над столешницей */}
      <group position={[halfW - 0.06, 1.62, -0.38]}>
        <RoundedBox args={[0.1, 0.28, 0.36]} radius={0.012} material={mats.whitePlastic} />
        <mesh position={[-0.051, 0, 0]} rotation-y={-Math.PI / 2} material={mats.green}>
          <planeGeometry args={[0.07, 0.2]} />
        </mesh>
        <mesh position={[-0.051, 0, 0]} rotation-y={-Math.PI / 2} material={mats.green}>
          <planeGeometry args={[0.2, 0.07]} />
        </mesh>
      </group>

      {/* Огнетушитель на крючке у передней стены — интерактивный (interaction/LabExtinguisher) */}

      {/* Часы над доской */}
      <group position={[0, 2.6, ROOM.frontZ + 0.03]}>
        <mesh rotation-x={Math.PI / 2} material={mats.whitePlastic}>
          <cylinderGeometry args={[0.16, 0.16, 0.04, 40]} />
        </mesh>
        <mesh position-z={0.021} material={mats.darkMetal}>
          <torusGeometry args={[0.16, 0.012, 8, 40]} />
        </mesh>
        <mesh position={[-0.035, 0.035, 0.024]} rotation-z={Math.PI / 4} material={mats.blackPlastic}>
          <boxGeometry args={[0.012, 0.1, 0.004]} />
        </mesh>
        <mesh position={[0.045, 0.045, 0.026]} rotation-z={-Math.PI / 4} material={mats.blackPlastic}>
          <boxGeometry args={[0.008, 0.13, 0.004]} />
        </mesh>
      </group>

      {/* Дверь в задней стене */}
      <group position={[2.0, 0, ROOM.backZ - 0.02]}>
        <mesh position-y={1.05} material={mats.wood}>
          <boxGeometry args={[0.9, 2.1, 0.04]} />
        </mesh>
        <mesh position={[-0.33, 1.0, -0.04]} material={mats.chrome}>
          <boxGeometry args={[0.14, 0.02, 0.03]} />
        </mesh>
      </group>
    </group>
  )
}

function LeftWallWithWindow({ mats, viewMap }: { mats: LabMaterials; viewMap: THREE.Texture }) {
  const x = -ROOM.w / 2
  const below = WIN.y0
  const above = ROOM.h - WIN.y1
  const frontSeg = WIN.z0 - ROOM.frontZ
  const backSeg = ROOM.backZ - WIN.z1
  const winW = WIN.z1 - WIN.z0
  const winH = WIN.y1 - WIN.y0
  const winMidZ = (WIN.z0 + WIN.z1) / 2
  const winMidY = (WIN.y0 + WIN.y1) / 2
  const frame = 0.06
  return (
    <group>
      <mesh position={[x, below / 2, MID_Z]} rotation-y={Math.PI / 2} material={mats.wall}>
        <planeGeometry args={[DEPTH, below]} />
      </mesh>
      <mesh position={[x, WIN.y1 + above / 2, MID_Z]} rotation-y={Math.PI / 2} material={mats.wall}>
        <planeGeometry args={[DEPTH, above]} />
      </mesh>
      <mesh position={[x, winMidY, ROOM.frontZ + frontSeg / 2]} rotation-y={Math.PI / 2} material={mats.wall}>
        <planeGeometry args={[frontSeg, winH]} />
      </mesh>
      <mesh position={[x, winMidY, WIN.z1 + backSeg / 2]} rotation-y={Math.PI / 2} material={mats.wall}>
        <planeGeometry args={[backSeg, winH]} />
      </mesh>
      {/* Откосы */}
      {[WIN.z0, WIN.z1].map((z) => (
        <mesh key={z} position={[x - 0.1, winMidY, z]} material={mats.whitePlastic}>
          <boxGeometry args={[0.2, winH, 0.01]} />
        </mesh>
      ))}
      <mesh position={[x - 0.1, WIN.y1, winMidZ]} material={mats.whitePlastic}>
        <boxGeometry args={[0.2, 0.01, winW]} />
      </mesh>
      {/* Подоконник */}
      <mesh position={[x + 0.02, WIN.y0 - 0.015, winMidZ]} material={mats.whitePlastic} receiveShadow>
        <boxGeometry args={[0.44, 0.03, winW + 0.12]} />
      </mesh>
      {/* Рама: переплёт и импосты */}
      <group position={[x - 0.16, winMidY, winMidZ]}>
        {[-winW / 2, -winW / 6, winW / 6, winW / 2].map((dz) => (
          <mesh key={dz} position-z={dz} material={mats.whitePlastic}>
            <boxGeometry args={[0.07, winH, frame]} />
          </mesh>
        ))}
        {[-winH / 2, winH / 2, winH / 2 - 0.42].map((dy) => (
          <mesh key={dy} position-y={dy} material={mats.whitePlastic}>
            <boxGeometry args={[0.07, frame, winW]} />
          </mesh>
        ))}
      </group>
      {/* Вид наружу: яркое небо и деревья */}
      <mesh position={[x - 1.4, winMidY + 0.2, winMidZ]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[winW + 3.2, winH + 1.6]} />
        <meshBasicMaterial map={viewMap} toneMapped={false} color={new THREE.Color(1.12, 1.12, 1.12)} />
      </mesh>
      {/* Радиатор под окном */}
      <group position={[x + 0.06, 0.45, winMidZ]}>
        {Array.from({ length: 14 }, (_, i) => (
          <mesh key={i} position-z={(i - 6.5) * 0.085} material={mats.whitePlastic}>
            <boxGeometry args={[0.07, 0.52, 0.05]} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

function CeilingLights({ mats }: { mats: LabMaterials }) {
  const spots: Array<[number, number]> = [
    [-1.4, -0.1],
    [1.4, -0.1],
    [-1.4, 2.3],
    [1.4, 2.3],
    [0, 1.1],
  ]
  return (
    <group>
      {spots.map(([x, z]) => (
        <group key={`${x}:${z}`} position={[x, ROOM.h - 0.015, z]}>
          <mesh material={mats.whitePlastic}>
            <boxGeometry args={[1.24, 0.03, 0.64]} />
          </mesh>
          <mesh position-y={-0.016} rotation-x={Math.PI / 2} material={mats.emissivePanel}>
            <planeGeometry args={[1.18, 0.58]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** Шкаф-тумба с дверцами (фасад смотрит в +Z). */
function CabinetRun({
  mats,
  width,
  depth,
  x,
  z,
  doors,
  drawers = true,
}: {
  mats: LabMaterials
  width: number
  depth: number
  x: number
  z: number
  doors: number
  drawers?: boolean
}) {
  const bodyH = BENCH.topY - BENCH.topT - 0.1
  const frontZ = depth / 2
  const doorW = width / doors
  return (
    <group position={[x, 0, z]}>
      <mesh position-y={0.05} material={mats.plinth}>
        <boxGeometry args={[width - 0.06, 0.1, depth - 0.1]} />
      </mesh>
      <mesh position-y={0.1 + bodyH / 2} material={mats.benchBody} castShadow receiveShadow>
        <boxGeometry args={[width, bodyH, depth]} />
      </mesh>
      {Array.from({ length: doors }, (_, i) => {
        const cx = -width / 2 + doorW * (i + 0.5)
        const drawerH = drawers ? 0.15 : 0
        const doorH = bodyH - drawerH - 0.03
        return (
          <group key={i} position={[cx, 0, frontZ]}>
            <mesh position={[0, 0.115 + doorH / 2, 0.009]} material={mats.door} castShadow>
              <boxGeometry args={[doorW - 0.012, doorH, 0.018]} />
            </mesh>
            <mesh position={[0, 0.115 + doorH - 0.05, 0.026]} material={mats.handle}>
              <boxGeometry args={[0.12, 0.012, 0.016]} />
            </mesh>
            {drawers && (
              <>
                <mesh position={[0, 0.1 + bodyH - drawerH / 2 - 0.006, 0.009]} material={mats.door}>
                  <boxGeometry args={[doorW - 0.012, drawerH - 0.012, 0.018]} />
                </mesh>
                <mesh position={[0, 0.1 + bodyH - drawerH / 2 - 0.006, 0.026]} material={mats.handle}>
                  <boxGeometry args={[0.12, 0.012, 0.016]} />
                </mesh>
              </>
            )}
          </group>
        )
      })}
    </group>
  )
}

function StudentBench({ mats, lang }: { mats: LabMaterials; lang: LabLang }) {
  return (
    <group>
      <RoundedBox
        args={[BENCH.w, BENCH.topT, BENCH.d]}
        radius={0.012}
        smoothness={3}
        position={[0, BENCH.topY - BENCH.topT / 2, BENCH.centerZ]}
        material={mats.benchTop}
        castShadow
        receiveShadow
      />
      {/* Полая тумба с открывающимися дверцами — внутри посуда (interaction/LabCabinets) */}
      <BenchCabinet mats={mats} lang={lang} />
      {/* Газовые краны у задней кромки стола */}
      {[-1.0, 1.0].map((x) => (
        <group key={x} position={[x, BENCH.topY, BENCH.centerZ - BENCH.d / 2 + 0.07]}>
          <mesh position-y={0.05} material={mats.chrome}>
            <cylinderGeometry args={[0.012, 0.016, 0.1, 12]} />
          </mesh>
          <mesh position={[0, 0.09, 0.03]} rotation-x={Math.PI / 2} material={mats.chrome}>
            <cylinderGeometry args={[0.006, 0.006, 0.06, 8]} />
          </mesh>
          <mesh position={[0, 0.105, 0]} material={mats.red}>
            <boxGeometry args={[0.07, 0.012, 0.016]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function FumeHood({ mats }: { mats: LabMaterials }) {
  const z0 = ROOM.frontZ
  const cz = z0 + HOOD.d / 2
  const innerH = HOOD.h - BENCH.topY
  const canopyH = 0.42
  const sashTop = HOOD.h - canopyH
  const interior = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#eef3f9', emissive: '#dce9f8', emissiveIntensity: 0.35, roughness: 0.6 }),
    [],
  )
  useEffect(() => () => interior.dispose(), [interior])
  return (
    <group position={[HOOD.x, 0, 0]}>
      <CabinetRun mats={mats} width={HOOD.w} depth={HOOD.d - 0.04} x={0} z={cz - 0.02} doors={2} drawers={false} />
      <mesh position={[0, BENCH.topY - 0.02, cz]} material={mats.benchTop} receiveShadow>
        <boxGeometry args={[HOOD.w, 0.04, HOOD.d]} />
      </mesh>
      {/* Боковины, задняя стенка, козырёк */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (HOOD.w / 2 - 0.035), BENCH.topY + innerH / 2, cz]} material={mats.whitePlastic} castShadow>
          <boxGeometry args={[0.07, innerH, HOOD.d]} />
        </mesh>
      ))}
      <mesh position={[0, BENCH.topY + innerH / 2, z0 + 0.012]} material={interior}>
        <boxGeometry args={[HOOD.w - 0.1, innerH, 0.02]} />
      </mesh>
      <mesh position={[0, HOOD.h - canopyH / 2, cz]} material={mats.whitePlastic} castShadow>
        <boxGeometry args={[HOOD.w, canopyH, HOOD.d]} />
      </mesh>
      {/* Пульт: дисплей и индикатор тяги */}
      <mesh position={[HOOD.w / 2 - 0.2, HOOD.h - canopyH / 2, z0 + HOOD.d + 0.001]} material={mats.screenBlack}>
        <planeGeometry args={[0.22, 0.08]} />
      </mesh>
      {/* Подсветка внутри */}
      <mesh position={[0, sashTop - 0.012, cz - 0.05]} rotation-x={Math.PI / 2} material={mats.hoodLight}>
        <planeGeometry args={[HOOD.w - 0.18, 0.12]} />
      </mesh>
      {/* Подъёмная стеклянная створка и тумблер тяги — интерактивные (LabHood) */}
      {/* Воздуховод */}
      <mesh position={[0, HOOD.h + (ROOM.h - HOOD.h) / 2, z0 + 0.3]} material={mats.steel}>
        <cylinderGeometry args={[0.13, 0.13, ROOM.h - HOOD.h, 24]} />
      </mesh>
    </group>
  )
}

/** Капля воды из крана: срывается, падает в мойку, по дну расходится кружок. */
function SinkDrop({ mats, x, z, topY, bottomY }: { mats: LabMaterials; x: number; z: number; topY: number; bottomY: number }) {
  const drop = useRef<THREE.Mesh>(null)
  const ripple = useRef<THREE.Mesh>(null)
  const rippleMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#dfeefc', transparent: true, opacity: 0, depthWrite: false }), [])
  useEffect(() => () => rippleMat.dispose(), [rippleMat])
  useFrame((s) => {
    const period = 2.6
    const t = s.clock.elapsedTime % period
    const d = drop.current
    const r = ripple.current
    if (!d || !r) return
    const grow = 1.4
    const fall = Math.sqrt((2 * (topY - bottomY)) / 9.8)
    if (t < grow) {
      // Капля набухает на носике
      const k = t / grow
      d.visible = true
      d.position.set(x, topY - 0.004 * k, z)
      d.scale.set(0.6 + 0.4 * k, 0.6 + 0.6 * k, 0.6 + 0.4 * k)
    } else if (t < grow + fall) {
      const ft = t - grow
      d.position.set(x, topY - 4.9 * ft * ft, z)
      d.scale.set(0.85, 1.35, 0.85)
    } else {
      d.visible = false
    }
    const rt = t - grow - fall
    if (rt > 0 && rt < 0.7) {
      r.visible = true
      r.scale.setScalar(1 + rt * 14)
      rippleMat.opacity = 0.55 * (1 - rt / 0.7)
    } else r.visible = false
  })
  return (
    <group>
      <mesh ref={drop} material={mats.water}>
        <sphereGeometry args={[0.0045, 12, 10]} />
      </mesh>
      <mesh ref={ripple} position={[x, bottomY + 0.002, z]} rotation-x={-Math.PI / 2} material={rippleMat}>
        <ringGeometry args={[0.004, 0.0055, 24]} />
      </mesh>
    </group>
  )
}

function SinkCounter({ mats }: { mats: LabMaterials }) {
  const w = COUNTER.x1 - COUNTER.x0
  const cx = (COUNTER.x0 + COUNTER.x1) / 2
  const z0 = ROOM.frontZ
  const cz = z0 + COUNTER.d / 2
  const top = BENCH.topY
  const sw = 0.5
  const sd = 0.38
  const sinkZ = cz + 0.03
  const leftW = SINK_X - sw / 2 - COUNTER.x0
  const rightW = COUNTER.x1 - (SINK_X + sw / 2)
  const backD = sinkZ - sd / 2 - z0
  const frontD = z0 + COUNTER.d - (sinkZ + sd / 2)
  const faucetCurve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0.26, 0),
        new THREE.Vector3(0, 0.33, 0.06),
        new THREE.Vector3(0, 0.3, 0.16),
        new THREE.Vector3(0, 0.24, 0.19),
      ]),
    [],
  )
  return (
    <group>
      <CabinetRun mats={mats} width={w} depth={COUNTER.d - 0.04} x={cx} z={cz - 0.02} doors={3} drawers />
      {/* Столешница вокруг мойки */}
      <mesh position={[COUNTER.x0 + leftW / 2, top - 0.02, cz]} material={mats.benchTop} receiveShadow castShadow>
        <boxGeometry args={[leftW, 0.04, COUNTER.d]} />
      </mesh>
      <mesh position={[COUNTER.x1 - rightW / 2, top - 0.02, cz]} material={mats.benchTop} receiveShadow>
        <boxGeometry args={[rightW, 0.04, COUNTER.d]} />
      </mesh>
      <mesh position={[SINK_X, top - 0.02, z0 + backD / 2]} material={mats.benchTop}>
        <boxGeometry args={[sw, 0.04, backD]} />
      </mesh>
      <mesh position={[SINK_X, top - 0.02, z0 + COUNTER.d - frontD / 2]} material={mats.benchTop}>
        <boxGeometry args={[sw, 0.04, frontD]} />
      </mesh>
      {/* Чаша мойки из нержавейки */}
      <group position={[SINK_X, top, sinkZ]}>
        <mesh position-y={-0.2} material={mats.steel}>
          <boxGeometry args={[sw, 0.01, sd]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={`x${s}`} position={[(s * sw) / 2, -0.1, 0]} material={mats.steel}>
            <boxGeometry args={[0.01, 0.2, sd]} />
          </mesh>
        ))}
        {[-1, 1].map((s) => (
          <mesh key={`z${s}`} position={[0, -0.1, (s * sd) / 2]} material={mats.steel}>
            <boxGeometry args={[sw, 0.2, 0.01]} />
          </mesh>
        ))}
        <mesh position-y={-0.194} rotation-x={-Math.PI / 2} material={mats.darkMetal}>
          <circleGeometry args={[0.025, 20]} />
        </mesh>
      </group>
      {/* Смеситель «гусак» */}
      <group position={[SINK_X, top, sinkZ - sd / 2 - 0.06]}>
        <mesh position-y={0.02} material={mats.chrome}>
          <cylinderGeometry args={[0.025, 0.03, 0.04, 20]} />
        </mesh>
        <mesh material={mats.chrome}>
          <tubeGeometry args={[faucetCurve, 32, 0.012, 12, false]} />
        </mesh>
        <mesh position={[0.05, 0.06, 0]} rotation-z={-0.5} material={mats.chrome}>
          <boxGeometry args={[0.08, 0.012, 0.016]} />
        </mesh>
      </group>
      {/* Фартук из плитки */}
      <mesh position={[cx, top + 0.25, z0 + 0.004]} material={mats.wallAccent}>
        <planeGeometry args={[w, 0.5]} />
      </mesh>
      {/* Навесной шкаф со стеклянными дверцами (посуда) */}
      <WallCabinet mats={mats} />
      <SinkDrop mats={mats} x={SINK_X} topY={top + 0.235} z={sinkZ - 0.06} bottomY={top - 0.19} />
      {/* Настенные полки для реактивов */}
      {SHELF_BOARD_Y.map((y) => (
        <group key={y}>
          <mesh position={[(COUNTER.x0 + SINK_X - 0.3) / 2 + 0.02, y, z0 + 0.15]} material={mats.whitePlastic} castShadow receiveShadow>
            <boxGeometry args={[SINK_X - 0.3 - COUNTER.x0 - 0.04, 0.025, 0.3]} />
          </mesh>
          {[COUNTER.x0 + 0.12, SINK_X - 0.42].map((bx) => (
            <mesh key={bx} position={[bx, y - 0.05, z0 + 0.1]} material={mats.metal}>
              <boxGeometry args={[0.02, 0.08, 0.2]} />
            </mesh>
          ))}
        </group>
      ))}
      {/* Держатель бумажных полотенец над мойкой */}
      <group position={[SINK_X + 0.05, 1.5, z0 + 0.08]}>
        <RoundedBox args={[0.3, 0.36, 0.12]} radius={0.02} material={mats.whitePlastic} />
        <mesh position={[0, -0.16, 0.04]} material={mats.porcelain}>
          <boxGeometry args={[0.2, 0.04, 0.02]} />
        </mesh>
      </group>
    </group>
  )
}
