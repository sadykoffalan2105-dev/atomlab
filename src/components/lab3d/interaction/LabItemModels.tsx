/**
 * Модели предметов «руки»: склянки и банки реактивов (толщина стекла, раствор с мениском, порошок/гранулы/кристаллы,
 * притёртые пробки и крышки, этикетки с пиктограммами), посуда § 1.4 и спиртовка, лучинки, спички.
 * Начало координат — дно предмета, ось Y вверх, этикетка смотрит в +Z.
 */
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { LabItemId } from '../labEvents'
import type { LabLang } from '../labContract'
import { lathe, type LabMaterials } from '../scene/labMaterials'
import { matchboxTexture, reagentLabelTexture } from './itemTextures'
import type { LabItemDef, ReagentFill } from './labItems'

type P = ReadonlyArray<readonly [number, number]>

/** Геометрии — один раз на модуль. Стекло с толщиной: профиль идёт вверх снаружи и вниз внутри. */
const G = (() => {
  const bottle: P = [[0.0001, 0], [0.029, 0], [0.032, 0.005], [0.032, 0.115], [0.027, 0.133], [0.0135, 0.15], [0.012, 0.166], [0.0145, 0.17], [0.0145, 0.176], [0.0105, 0.176], [0.0095, 0.15], [0.024, 0.132], [0.0295, 0.115], [0.0295, 0.008], [0.0001, 0.007]]
  const bottleLiquid: P = [[0.0001, 0.008], [0.0288, 0.009], [0.0288, 0.098], [0.0262, 0.0957], [0.016, 0.0946], [0.0001, 0.0943]]
  const stopper: P = [[0.0001, 0.156], [0.0088, 0.156], [0.0102, 0.177], [0.0165, 0.179], [0.0168, 0.188], [0.012, 0.192], [0.0001, 0.193]]
  const jar: P = [[0.0001, 0], [0.033, 0], [0.036, 0.004], [0.036, 0.1], [0.031, 0.115], [0.021, 0.12], [0.021, 0.131], [0.0185, 0.131], [0.0185, 0.118], [0.0285, 0.113], [0.0335, 0.1], [0.0335, 0.007], [0.0001, 0.006]]
  const heap: P = [[0.0001, 0.007], [0.032, 0.007], [0.0325, 0.05], [0.026, 0.057], [0.012, 0.062], [0.0001, 0.063]]
  const lowHeap: P = [[0.0001, 0.007], [0.032, 0.007], [0.0325, 0.03], [0.0001, 0.033]]
  const beaker: P = [[0.0001, 0], [0.034, 0], [0.036, 0.004], [0.036, 0.092], [0.0395, 0.097], [0.039, 0.0995], [0.0335, 0.095], [0.0335, 0.006], [0.0001, 0.005]]
  const conical: P = [[0.0001, 0], [0.05, 0], [0.054, 0.006], [0.016, 0.105], [0.015, 0.138], [0.0182, 0.143], [0.0182, 0.146], [0.0125, 0.146], [0.0122, 0.105], [0.0508, 0.0075], [0.0001, 0.006]]
  const roundPts: Array<[number, number]> = []
  for (let i = 0; i <= 16; i++) {
    const a = -Math.PI / 2 + (i / 16) * (Math.PI * 0.86)
    roundPts.push([Math.max(0.0001, Math.cos(a) * 0.056), 0.056 + Math.sin(a) * 0.056])
  }
  roundPts.push([0.015, 0.135], [0.015, 0.172], [0.018, 0.177], [0.018, 0.18], [0.0125, 0.18], [0.0125, 0.135])
  const tube: P = [[0.0001, 0], [0.006, 0.001], [0.0085, 0.007], [0.0085, 0.15], [0.0098, 0.153], [0.0098, 0.155], [0.0072, 0.155], [0.0072, 0.008], [0.0001, 0.0025]]
  const cyl: P = [[0.0001, 0.012], [0.0145, 0.012], [0.0145, 0.25], [0.0175, 0.256], [0.0175, 0.258], [0.0125, 0.258], [0.0125, 0.016], [0.0001, 0.015]]
  const funnel: P = [[0.0045, 0], [0.0055, 0.06], [0.013, 0.07], [0.05, 0.118], [0.053, 0.123], [0.0505, 0.124], [0.0115, 0.072], [0.0035, 0.062], [0.003, 0]]
  const dish: P = [[0.0001, 0], [0.025, 0], [0.05, 0.015], [0.062, 0.035], [0.065, 0.037], [0.0615, 0.038], [0.047, 0.02], [0.024, 0.006], [0.0001, 0.005]]
  const watch: P = [[0.0001, 0.003], [0.025, 0.0055], [0.045, 0.0115], [0.05, 0.0145], [0.0495, 0.0165], [0.044, 0.0135], [0.025, 0.0075], [0.0001, 0.005]]
  const lamp: P = [[0.0001, 0], [0.045, 0], [0.05, 0.02], [0.046, 0.055], [0.018, 0.075], [0.016, 0.078], [0.0001, 0.078]]
  const lampCap: P = [[0.0001, 0.125], [0.012, 0.124], [0.019, 0.115], [0.021, 0.08], [0.0225, 0.078], [0.0195, 0.078], [0.017, 0.112], [0.011, 0.12], [0.0001, 0.121]]
  return {
    bottle: lathe(bottle, 32),
    bottleLiquid: lathe(bottleLiquid, 28),
    stopper: lathe(stopper, 20),
    jar: lathe(jar, 32),
    heap: lathe(heap, 28),
    lowHeap: lathe(lowHeap, 24),
    beaker: lathe(beaker, 32),
    beakerLiquid: lathe([[0.0001, 0.006], [0.033, 0.0065], [0.033, 0.04], [0.031, 0.0388], [0.0001, 0.0385]], 28),
    conical: lathe(conical, 32),
    round: lathe(roundPts, 32),
    tube: lathe(tube, 18),
    cyl: lathe(cyl, 24),
    funnel: lathe(funnel, 28),
    dish: lathe(dish, 32),
    watch: lathe(watch, 32),
    lamp: lathe(lamp, 28),
    lampCap: lathe(lampCap, 20),
    granule: new THREE.IcosahedronGeometry(0.0058, 0),
    crystal: new THREE.BoxGeometry(0.0075, 0.0075, 0.0075),
    lump: new THREE.DodecahedronGeometry(0.0095, 0),
    pellet: new THREE.SphereGeometry(0.0062, 8, 6),
  }
})()

/** Псевдослучайные числа с зерном — одинаковая раскладка гранул при каждом показе. */
function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
}

const GRAIN_GEO: Partial<Record<ReagentFill, THREE.BufferGeometry>> = {
  granules: G.granule,
  crystals: G.crystal,
  lumps: G.lump,
  pellets: G.pellet,
}

function Grains({ fill, material, count, seed }: { fill: ReagentFill; material: THREE.Material; count: number; seed: number }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const geo = GRAIN_GEO[fill] ?? G.granule
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const r = rng(seed)
    const o = new THREE.Object3D()
    for (let i = 0; i < count; i++) {
      const a = r() * Math.PI * 2
      const rad = Math.sqrt(r()) * 0.025
      const layer = Math.floor(i / Math.max(1, count / 4))
      o.position.set(Math.cos(a) * rad, 0.034 + layer * 0.0085 + r() * 0.004 - (rad / 0.025) * 0.002 * layer, Math.sin(a) * rad)
      o.rotation.set(r() * 3, r() * 3, r() * 3)
      const s = 0.8 + r() * 0.5
      o.scale.set(s, fill === 'pellets' ? s * 0.5 : s, s)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  }, [count, seed, fill])
  return <instancedMesh ref={ref} args={[geo, material, count]} />
}

function ReagentModel({ def, mats, lang, quality }: { def: LabItemDef; mats: LabMaterials; lang: LabLang; quality: 'low' | 'high' }) {
  const info = def.reagent!
  const label = useMemo(() => reagentLabelTexture(info, def.name, lang), [info, def.name, lang])
  const fillMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: info.color,
        roughness: info.fill === 'crystals' ? 0.35 : info.fill === 'granules' || info.fill === 'filings' ? 0.5 : 0.92,
        metalness: info.fill === 'granules' || info.fill === 'filings' ? 0.55 : 0,
      }),
    [info],
  )
  const labelMat = useMemo(() => new THREE.MeshStandardMaterial({ map: label, roughness: 0.62 }), [label])
  useEffect(
    () => () => {
      label.dispose()
      fillMat.dispose()
      labelMat.dispose()
    },
    [label, fillMat, labelMat],
  )
  const bottle = info.vessel !== 'jar'
  const glass = info.vessel === 'amber' ? mats.amberGlass : mats.glass
  const grains = info.fill in GRAIN_GEO
  const seed = def.id.length * 131 + info.formula.charCodeAt(0)
  return (
    <group>
      <mesh geometry={bottle ? G.bottle : G.jar} material={glass} castShadow={false} />
      {bottle ? (
        <>
          {/* name="liquid" — рука находит раствор и колышет его поверхность при движении */}
          <mesh name="liquid" geometry={G.bottleLiquid} material={mats.water} />
          {/* Притёртая стеклянная пробка */}
          <mesh geometry={G.stopper} material={glass} />
        </>
      ) : (
        <>
          <mesh geometry={grains ? G.lowHeap : G.heap} material={fillMat} />
          {grains && <Grains fill={info.fill} material={fillMat} count={quality === 'high' ? 46 : 22} seed={seed} />}
          {/* Винтовая крышка с рифлением */}
          <mesh position-y={0.1385} material={mats.blackPlastic}>
            <cylinderGeometry args={[0.0232, 0.0232, 0.019, 28]} />
          </mesh>
          <mesh position-y={0.1483} material={mats.blackPlastic}>
            <cylinderGeometry args={[0.021, 0.0232, 0.0016, 28]} />
          </mesh>
        </>
      )}
      {/* Этикетка, обёрнутая вокруг передней части */}
      <mesh position-y={bottle ? 0.062 : 0.056} material={labelMat}>
        <cylinderGeometry args={[(bottle ? 0.032 : 0.036) + 0.0009, (bottle ? 0.032 : 0.036) + 0.0009, bottle ? 0.054 : 0.05, 24, 1, true, -1.05, 2.1]} />
      </mesh>
    </group>
  )
}

/** Риски шкалы на мерной посуде. */
function Marks({ r, y0, y1, n, mat }: { r: number; y0: number; y1: number; n: number; mat: THREE.Material }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <mesh key={i} position={[0, y0 + ((y1 - y0) * i) / Math.max(1, n - 1), r + 0.0006]} material={mat}>
          <boxGeometry args={[i % 2 ? 0.006 : 0.012, 0.0012, 0.0004]} />
        </mesh>
      ))}
    </>
  )
}

function MatchesModel({ mats }: { mats: LabMaterials }) {
  const tex = useMemo(() => matchboxTexture(), [])
  const top = useMemo(() => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }), [tex])
  const side = useMemo(() => new THREE.MeshStandardMaterial({ color: '#5a3a24', roughness: 0.95 }), [])
  const body = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e8d9b0', roughness: 0.85 }), [])
  useEffect(() => () => [tex, top, side, body].forEach((x) => x.dispose()), [tex, top, side, body])
  // Материалы граней коробки: +x, −x (тёрки), +y (этикетка), −y, +z, −z
  return (
    <group rotation-y={0.4}>
      <mesh position-y={0.009} material={[side, side, top, body, body, body]}>
        <boxGeometry args={[0.052, 0.017, 0.036]} />
      </mesh>
      <mesh position={[0.012, 0.009, 0]} material={mats.wood}>
        <boxGeometry args={[0.03, 0.012, 0.03]} />
      </mesh>
    </group>
  )
}

export function LabItemModel({ def, mats, lang, quality }: { def: LabItemDef; mats: LabMaterials; lang: LabLang; quality: 'low' | 'high' }) {
  if (def.reagent) return <ReagentModel def={def} mats={mats} lang={lang} quality={quality} />
  const id: LabItemId = def.id
  switch (id) {
    case 'glass:beaker':
      return (
        <group>
          <mesh geometry={G.beaker} material={mats.glass} />
          <Marks r={0.036} y0={0.025} y1={0.075} n={5} mat={mats.whitePlastic} />
        </group>
      )
    case 'glass:conicalFlask':
      return <mesh geometry={G.conical} material={mats.glass} />
    case 'glass:roundFlask':
      return (
        <group>
          <mesh position-y={0.006} rotation-x={Math.PI / 2} material={mats.wood}>
            <torusGeometry args={[0.032, 0.008, 8, 24]} />
          </mesh>
          <mesh geometry={G.round} material={mats.glass} position-y={0.004} />
        </group>
      )
    case 'glass:cylinder':
      return (
        <group>
          <mesh position-y={0.006} material={mats.glass}>
            <cylinderGeometry args={[0.03, 0.034, 0.012, 6]} />
          </mesh>
          <mesh geometry={G.cyl} material={mats.glass} />
          <Marks r={0.0145} y0={0.04} y1={0.23} n={11} mat={mats.whitePlastic} />
        </group>
      )
    case 'glass:funnel':
      return (
        <group>
          {/* Воронка стоит в кольце-подставке */}
          <mesh position-y={0.002} rotation-x={Math.PI / 2} material={mats.whitePlastic}>
            <torusGeometry args={[0.02, 0.004, 6, 20]} />
          </mesh>
          <mesh geometry={G.funnel} material={mats.glass} />
        </group>
      )
    case 'glass:testTube':
      return (
        <group>
          {/* Пробирка в деревянной подставке на одну пробирку */}
          <mesh position-y={0.015} material={mats.wood}>
            <boxGeometry args={[0.05, 0.03, 0.05]} />
          </mesh>
          <mesh geometry={G.tube} material={mats.glass} position-y={0.005} />
        </group>
      )
    case 'glass:watchGlass':
      return <mesh geometry={G.watch} material={mats.glass} />
    case 'glass:porcelainDish':
      return <mesh geometry={G.dish} material={mats.porcelain} castShadow />
    case 'tool:spiritLamp':
      return (
        <group>
          <mesh geometry={G.lamp} material={mats.glass} />
          <mesh position-y={0.02} material={mats.water}>
            <cylinderGeometry args={[0.043, 0.046, 0.036, 24]} />
          </mesh>
          <mesh position-y={0.084} material={mats.metal}>
            <cylinderGeometry args={[0.017, 0.017, 0.014, 16]} />
          </mesh>
          <mesh position-y={0.098} material={mats.porcelain}>
            <cylinderGeometry args={[0.0045, 0.0045, 0.018, 8]} />
          </mesh>
          {/* Колпачок надет — спиртовку гасят и хранят только с колпачком */}
          <mesh geometry={G.lampCap} material={mats.glass} />
        </group>
      )
    case 'tool:splint':
      return (
        <group>
          <mesh position-y={0.025} material={mats.porcelain}>
            <cylinderGeometry args={[0.022, 0.019, 0.05, 20, 1, true]} />
          </mesh>
          <mesh position-y={0.002} material={mats.porcelain}>
            <cylinderGeometry args={[0.019, 0.019, 0.004, 20]} />
          </mesh>
          {[-0.008, 0, 0.008, -0.004, 0.005].map((x, i) => (
            <mesh key={i} position={[x, 0.08, (i % 2 ? 1 : -1) * 0.005]} rotation-z={x * 4} material={mats.wood}>
              <boxGeometry args={[0.004, 0.155, 0.004]} />
            </mesh>
          ))}
        </group>
      )
    case 'tool:matches':
      return <MatchesModel mats={mats} />
    default:
      return (
        <mesh position-y={0.04} material={mats.glass}>
          <cylinderGeometry args={[0.03, 0.03, 0.08, 16]} />
        </mesh>
      )
  }
}
