/**
 * Оборудование лаборатории (декор, § 1.4 учебника Kimyo 7): штатив с лапкой и кольцом, спиртовка, газовая горелка,
 * электроплитка, штатив с пробирками, химические стаканы, колбы, мерный цилиндр, воронка, фарфоровая чашка,
 * ступка с пестиком, промывалка, электронные весы, защитные очки, перчатки, банки с реактивами на полках.
 * Всё стоит вне рабочего места (WORK_AREA) — опыту не мешает.
 */
import { RoundedBox } from '@react-three/drei'
import { useEffect, useMemo, type ReactNode } from 'react'
import * as THREE from 'three'
import { BENCH_TOP_Y, WORK_AREA_SIZE, type LabLang } from '../labContract'
import { BENCH, COUNTER, HOOD, ROOM, SINK_X } from './labSceneLayout'
import { lathe, type LabMaterials } from './labMaterials'
import { scalesDisplayTexture } from './labTextures'

type V3 = readonly [number, number, number]
interface ItemProps {
  readonly mats: LabMaterials
  readonly position: V3
  readonly rotationY?: number
  readonly scale?: number
}

function Place({ position, rotationY = 0, scale = 1, children }: { position: V3; rotationY?: number; scale?: number; children: ReactNode }) {
  return (
    <group position={position as unknown as THREE.Vector3Tuple} rotation-y={rotationY} scale={scale}>
      {children}
    </group>
  )
}

/** Геометрии посуды — создаются один раз на модуль. */
const GEO = (() => {
  const beaker = lathe([
    [0.0, 0.0],
    [0.034, 0.0],
    [0.036, 0.004],
    [0.036, 0.09],
    [0.04, 0.096],
  ])
  const beakerLiquid = lathe([
    [0, 0.003],
    [0.033, 0.003],
    [0.033, 0.045],
    [0, 0.045],
  ])
  const conical = lathe([
    [0, 0],
    [0.05, 0],
    [0.054, 0.006],
    [0.016, 0.105],
    [0.015, 0.14],
    [0.018, 0.145],
  ])
  const conicalLiquid = lathe([
    [0, 0.004],
    [0.05, 0.004],
    [0.035, 0.045],
    [0, 0.045],
  ])
  const roundPts: Array<[number, number]> = []
  for (let i = 0; i <= 14; i++) {
    const a = -Math.PI / 2 + (i / 14) * (Math.PI * 0.86)
    roundPts.push([Math.cos(a) * 0.055, 0.055 + Math.sin(a) * 0.055])
  }
  roundPts.push([0.015, 0.13], [0.015, 0.17], [0.018, 0.175])
  roundPts[0] = [0.0001, 0]
  const round = lathe(roundPts)
  const tube = lathe([
    [0.0001, 0],
    [0.006, 0.001],
    [0.008, 0.006],
    [0.008, 0.15],
    [0.009, 0.152],
  ], 16)
  const tubeLiquid = lathe([
    [0.0001, 0.002],
    [0.0065, 0.004],
    [0.0068, 0.05],
    [0, 0.05],
  ], 12)
  const cylinder = lathe([
    [0.0001, 0],
    [0.014, 0],
    [0.014, 0.25],
    [0.017, 0.255],
  ], 20)
  const funnel = lathe([
    [0.005, 0],
    [0.005, 0.06],
    [0.012, 0.07],
    [0.05, 0.12],
    [0.052, 0.124],
  ], 24)
  const dish = lathe([
    [0.0001, 0.0],
    [0.025, 0.0],
    [0.05, 0.015],
    [0.062, 0.035],
    [0.064, 0.036],
  ], 28)
  const mortar = lathe([
    [0.0001, 0],
    [0.04, 0],
    [0.055, 0.03],
    [0.06, 0.055],
    [0.054, 0.057],
    [0.03, 0.03],
    [0.0001, 0.022],
  ], 28)
  const lampBody = lathe([
    [0.0001, 0],
    [0.045, 0],
    [0.05, 0.02],
    [0.045, 0.055],
    [0.016, 0.075],
    [0.0001, 0.075],
  ], 28)
  const jar = lathe([
    [0.0001, 0],
    [0.034, 0],
    [0.036, 0.006],
    [0.036, 0.1],
    [0.03, 0.118],
    [0.018, 0.124],
    [0.018, 0.135],
  ], 24)
  const bottle = lathe([
    [0.0001, 0],
    [0.03, 0],
    [0.032, 0.006],
    [0.032, 0.12],
    [0.014, 0.15],
    [0.011, 0.17],
  ], 24)
  const washBottle = lathe([
    [0.0001, 0],
    [0.036, 0],
    [0.04, 0.01],
    [0.04, 0.14],
    [0.026, 0.165],
    [0.012, 0.175],
  ], 24)
  return {
    beaker,
    beakerLiquid,
    conical,
    conicalLiquid,
    round,
    tube,
    tubeLiquid,
    cylinder,
    funnel,
    dish,
    mortar,
    lampBody,
    jar,
    bottle,
    washBottle,
  }
})()

function Beaker({ mats, position, scale = 1, liquid }: ItemProps & { liquid?: THREE.Material }) {
  return (
    <Place position={position} scale={scale}>
      <mesh geometry={GEO.beaker} material={mats.glass} />
      {liquid && <mesh geometry={GEO.beakerLiquid} material={liquid} />}
    </Place>
  )
}

function ConicalFlask({ mats, position, scale = 1, liquid }: ItemProps & { liquid?: THREE.Material }) {
  return (
    <Place position={position} scale={scale}>
      <mesh geometry={GEO.conical} material={mats.glass} />
      {liquid && <mesh geometry={GEO.conicalLiquid} material={liquid} />}
    </Place>
  )
}

function RoundFlask({ mats, position, scale = 1 }: ItemProps) {
  return (
    <Place position={position} scale={scale}>
      {/* Пробковое кольцо-подставка */}
      <mesh position-y={0.006} rotation-x={Math.PI / 2} material={mats.wood}>
        <torusGeometry args={[0.032, 0.008, 8, 24]} />
      </mesh>
      <mesh geometry={GEO.round} material={mats.glass} position-y={0.004} />
    </Place>
  )
}

function GraduatedCylinder({ mats, position, scale = 1 }: ItemProps) {
  return (
    <Place position={position} scale={scale}>
      <mesh position-y={0.005} material={mats.glass}>
        <cylinderGeometry args={[0.03, 0.034, 0.01, 6]} />
      </mesh>
      <mesh geometry={GEO.cylinder} material={mats.glass} position-y={0.01} />
      <mesh position-y={0.07} material={mats.water}>
        <cylinderGeometry args={[0.012, 0.012, 0.12, 16]} />
      </mesh>
    </Place>
  )
}

function Funnel({ mats, position }: ItemProps) {
  return (
    <Place position={position}>
      <mesh geometry={GEO.funnel} material={mats.glass} />
    </Place>
  )
}

function TestTubeRack({ mats, position, rotationY }: ItemProps) {
  const liquids = [mats.blueLiquid, null, mats.water, mats.pinkLiquid, null, mats.water]
  return (
    <Place position={position} rotationY={rotationY}>
      {/* Две планки и стойки */}
      {[0.015, 0.075].map((y) => (
        <RoundedBox key={y} args={[0.26, 0.012, 0.06]} radius={0.004} position-y={y} material={mats.whitePlastic} castShadow />
      ))}
      {[-0.125, 0.125].map((x) => (
        <mesh key={x} position={[x, 0.045, 0]} material={mats.whitePlastic}>
          <boxGeometry args={[0.012, 0.09, 0.06]} />
        </mesh>
      ))}
      {liquids.map((liq, i) => {
        const x = -0.1 + i * 0.04
        return (
          <group key={i} position={[x, 0.012, 0]}>
            <mesh geometry={GEO.tube} material={mats.glass} />
            {liq && <mesh geometry={GEO.tubeLiquid} material={liq} />}
          </group>
        )
      })}
    </Place>
  )
}

/** Штатив: основание, стержень, муфты, лапка и кольцо (§ 1.4). */
function RetortStand({ mats, position, rotationY }: ItemProps) {
  return (
    <Place position={position} rotationY={rotationY}>
      <RoundedBox args={[0.16, 0.014, 0.24]} radius={0.004} position={[0, 0.007, 0]} material={mats.darkMetal} castShadow />
      <mesh position={[0, 0.31, -0.08]} material={mats.chrome} castShadow>
        <cylinderGeometry args={[0.006, 0.006, 0.6, 12]} />
      </mesh>
      {/* Кольцо */}
      <group position={[0, 0.24, -0.08]}>
        <mesh material={mats.darkMetal}>
          <boxGeometry args={[0.03, 0.03, 0.03]} />
        </mesh>
        <mesh position={[0, 0, 0.05]} rotation-x={Math.PI / 2} material={mats.metal}>
          <cylinderGeometry args={[0.004, 0.004, 0.06, 8]} />
        </mesh>
        <mesh position={[0, 0, 0.12]} rotation-x={Math.PI / 2} material={mats.metal}>
          <torusGeometry args={[0.042, 0.004, 8, 32]} />
        </mesh>
        {/* Сетка на кольце */}
        <mesh position={[0, 0.005, 0.12]} rotation-x={-Math.PI / 2} material={mats.steel}>
          <circleGeometry args={[0.05, 24]} />
        </mesh>
      </group>
      {/* Лапка с пробиркой */}
      <group position={[0, 0.44, -0.08]}>
        <mesh material={mats.darkMetal}>
          <boxGeometry args={[0.03, 0.03, 0.03]} />
        </mesh>
        <mesh position={[0, 0, 0.06]} rotation-x={Math.PI / 2} material={mats.metal}>
          <cylinderGeometry args={[0.004, 0.004, 0.09, 8]} />
        </mesh>
        <mesh position={[0, 0, 0.12]} material={mats.rubberBlue}>
          <boxGeometry args={[0.035, 0.02, 0.025]} />
        </mesh>
        <mesh position={[0, -0.09, 0.12]} geometry={GEO.tube} material={mats.glass} />
      </group>
    </Place>
  )
}

/** Газовая горелка (Бунзена): основание, трубка, регулятор воздуха, штуцер шланга. */
function GasBurner({ mats, position }: ItemProps) {
  return (
    <Place position={position}>
      <mesh position-y={0.008} material={mats.darkMetal} castShadow>
        <cylinderGeometry args={[0.045, 0.05, 0.016, 24]} />
      </mesh>
      <mesh position-y={0.09} material={mats.chrome} castShadow>
        <cylinderGeometry args={[0.009, 0.01, 0.15, 16]} />
      </mesh>
      <mesh position-y={0.04} material={mats.steel}>
        <cylinderGeometry args={[0.014, 0.014, 0.025, 16]} />
      </mesh>
      <mesh position={[0.03, 0.025, 0]} rotation-z={Math.PI / 2} material={mats.chrome}>
        <cylinderGeometry args={[0.004, 0.005, 0.04, 8]} />
      </mesh>
    </Place>
  )
}

/** Электроплитка: белый корпус, чёрная стеклокерамика, ручка, индикатор. */
function HotPlate({ mats, position, rotationY }: ItemProps) {
  return (
    <Place position={position} rotationY={rotationY}>
      <RoundedBox args={[0.2, 0.06, 0.24]} radius={0.01} position-y={0.03} material={mats.whitePlastic} castShadow />
      <mesh position={[0, 0.061, -0.02]} material={mats.screenBlack}>
        <cylinderGeometry args={[0.08, 0.08, 0.004, 32]} />
      </mesh>
      <mesh position={[0.06, 0.03, 0.121]} rotation-x={Math.PI / 2} material={mats.blackPlastic}>
        <cylinderGeometry args={[0.014, 0.014, 0.014, 16]} />
      </mesh>
      <mesh position={[-0.06, 0.035, 0.1205]}>
        <circleGeometry args={[0.005, 12]} />
        <meshBasicMaterial color="#ff5a3c" toneMapped={false} />
      </mesh>
    </Place>
  )
}

/** Электронные весы с дисплеем. */
function Scales({ mats, position, rotationY, display }: ItemProps & { display: THREE.Texture }) {
  return (
    <Place position={position} rotationY={rotationY}>
      <RoundedBox args={[0.18, 0.04, 0.24]} radius={0.008} position-y={0.02} material={mats.whitePlastic} castShadow />
      <mesh position={[0, 0.045, -0.02]} material={mats.steel}>
        <cylinderGeometry args={[0.065, 0.065, 0.006, 32]} />
      </mesh>
      <mesh position={[0, 0.028, 0.121]} material={mats.screenBlack}>
        <boxGeometry args={[0.12, 0.03, 0.002]} />
      </mesh>
      <mesh position={[0, 0.028, 0.1225]}>
        <planeGeometry args={[0.07, 0.022]} />
        <meshBasicMaterial map={display} toneMapped={false} />
      </mesh>
    </Place>
  )
}

function PorcelainDish({ mats, position }: ItemProps) {
  return (
    <Place position={position}>
      <mesh geometry={GEO.dish} material={mats.porcelain} castShadow />
    </Place>
  )
}

function MortarPestle({ mats, position }: ItemProps) {
  return (
    <Place position={position}>
      <mesh geometry={GEO.mortar} material={mats.porcelain} castShadow />
      <mesh position={[0.02, 0.07, 0]} rotation-z={-0.5} material={mats.porcelain}>
        <capsuleGeometry args={[0.009, 0.09, 6, 12]} />
      </mesh>
    </Place>
  )
}

function WashBottle({ mats, position }: ItemProps) {
  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.175, 0),
        new THREE.Vector3(0, 0.21, 0),
        new THREE.Vector3(0.03, 0.225, 0),
        new THREE.Vector3(0.07, 0.205, 0),
      ]),
    [],
  )
  return (
    <Place position={position}>
      <mesh geometry={GEO.washBottle} material={mats.porcelain} castShadow />
      <mesh position-y={0.18} material={mats.rubberBlue}>
        <cylinderGeometry args={[0.016, 0.016, 0.016, 16]} />
      </mesh>
      <mesh material={mats.whitePlastic}>
        <tubeGeometry args={[curve, 16, 0.003, 6, false]} />
      </mesh>
    </Place>
  )
}

function Goggles({ mats, position, rotationY }: ItemProps) {
  return (
    <Place position={position} rotationY={rotationY}>
      <RoundedBox args={[0.16, 0.05, 0.06]} radius={0.02} position-y={0.026} material={mats.glass} />
      <RoundedBox args={[0.165, 0.054, 0.012]} radius={0.005} position={[0, 0.027, 0.03]} material={mats.rubberBlue} />
      <mesh position={[0, 0.006, -0.04]} rotation-x={Math.PI / 2} material={mats.blackPlastic}>
        <torusGeometry args={[0.07, 0.004, 6, 24, Math.PI]} />
      </mesh>
    </Place>
  )
}

function Gloves({ mats, position, rotationY }: ItemProps) {
  return (
    <Place position={position} rotationY={rotationY}>
      {[0, 0.05].map((dx, i) => (
        <group key={i} position={[dx, 0.008, i * 0.02]} rotation-y={i * 0.3}>
          <mesh rotation-z={Math.PI / 2} scale={[1, 1, 0.35]} material={mats.rubberBlue}>
            <capsuleGeometry args={[0.03, 0.1, 6, 12]} />
          </mesh>
          {[-0.02, -0.007, 0.007, 0.02].map((fz) => (
            <mesh key={fz} position={[-0.1, 0, fz]} rotation-z={Math.PI / 2} scale={[1, 1, 0.8]} material={mats.rubberBlue}>
              <capsuleGeometry args={[0.006, 0.04, 4, 8]} />
            </mesh>
          ))}
        </group>
      ))}
    </Place>
  )
}

interface EquipmentProps {
  readonly mats: LabMaterials
  readonly lang: LabLang
}

export function LabEquipment({ mats }: EquipmentProps) {
  const display = useMemo(() => scalesDisplayTexture(), [])
  useEffect(() => () => display.dispose(), [display])
  const top = BENCH_TOP_Y
  // Края стола вне рабочего места: x ∈ ±[0.7, 1.25]
  const edgeL = -(WORK_AREA_SIZE.w / 2 + 0.33)
  const edgeR = WORK_AREA_SIZE.w / 2 + 0.33
  const frontZ = BENCH.centerZ + BENCH.d / 2 - 0.12
  const backZ = BENCH.centerZ - BENCH.d / 2 + 0.16
  const counterTop = BENCH_TOP_Y
  const cz = ROOM.frontZ + COUNTER.d / 2
  const hoodZ = ROOM.frontZ + 0.33
  return (
    <group>
      {/* Левый край стола: штатив с пробирками, очки, перчатки (спиртовка — в тумбе, её берут рукой) */}
      <TestTubeRack mats={mats} position={[edgeL - 0.0, top, backZ + 0.03]} rotationY={0.15} />
      <Gloves mats={mats} position={[edgeL - 0.12, top, 0.0]} rotationY={0.3} />
      <Goggles mats={mats} position={[edgeL - 0.09, top, frontZ - 0.03]} rotationY={0.2} />
      {/* Правый край: штатив с кольцом и лапкой (свободные места стола — для предметов из шкафов) */}
      <RetortStand mats={mats} position={[edgeR + 0.12, top, backZ + 0.02]} rotationY={-0.25} />

      {/* Столешница у мойки: весы, плитка, ступка, чашка, промывалка */}
      <Scales mats={mats} position={[COUNTER.x0 + 0.2, counterTop, cz + 0.04]} display={display} />
      <HotPlate mats={mats} position={[COUNTER.x0 + 0.5, counterTop, cz + 0.02]} />
      <Beaker mats={mats} position={[COUNTER.x0 + 0.5, counterTop + 0.065, cz]} scale={1.2} liquid={mats.water} />
      <MortarPestle mats={mats} position={[COUNTER.x0 + 0.78, counterTop, cz + 0.08]} />
      <PorcelainDish mats={mats} position={[COUNTER.x0 + 0.95, counterTop, cz - 0.08]} />
      <WashBottle mats={mats} position={[SINK_X + 0.36, counterTop, cz - 0.1]} />

      {/* Банки реактивов на полках и посуда в шкафах — интерактивные (interaction/LabInteractiveItems) */}
      <ConicalFlask mats={mats} position={[COUNTER.x0 + 0.95, counterTop, cz + 0.12]} scale={0.85} liquid={mats.blueLiquid} />
      <GraduatedCylinder mats={mats} position={[COUNTER.x0 + 0.08, counterTop, cz - 0.16]} scale={0.8} />
      <Funnel mats={mats} position={[COUNTER.x0 + 0.34, counterTop, cz - 0.17]} />

      {/* В вытяжном шкафу: горелка, штатив с колбой */}
      <GasBurner mats={mats} position={[HOOD.x - 0.3, top, hoodZ]} />
      <RetortStand mats={mats} position={[HOOD.x + 0.15, top, hoodZ]} />
      <RoundFlask mats={mats} position={[HOOD.x + 0.4, top, hoodZ + 0.1]} scale={1.2} />
      <Beaker mats={mats} position={[HOOD.x - 0.05, top, hoodZ + 0.15]} liquid={mats.pinkLiquid} />

      {/* Подоконник: растение */}
      <group position={[-ROOM.w / 2 + 0.14, 0.95, 1.9]}>
        <mesh position-y={0.06} material={mats.porcelain}>
          <cylinderGeometry args={[0.07, 0.055, 0.12, 20]} />
        </mesh>
        {[
          [0, 0.17, 0, 0.08],
          [0.05, 0.22, 0.03, 0.06],
          [-0.04, 0.21, -0.03, 0.065],
          [0.01, 0.27, -0.01, 0.05],
        ].map(([x, y, z, r], i) => (
          <mesh key={i} position={[x, y, z]} material={mats.green}>
            <icosahedronGeometry args={[r, 1]} />
          </mesh>
        ))}
      </group>
    </group>
  )
}
