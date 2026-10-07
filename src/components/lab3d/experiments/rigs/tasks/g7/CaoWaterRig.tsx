/**
 * task-g7-cao-water (Kimyo 7, с. 148, задача 1): гашение 2,80 г CaO водой в фарфоровой чашке.
 * Шаги: 0 защита · 1 чашка на весы · 2 тара · 3 CaO шпателем · 4 чашка на плитку под термометр · 5 термометр в порошок
 * (t₀) · 6 5,0 мл воды в цилиндр 10 мл · 7 вода в чашку: шипение, пар, разогрев (t макс) · 8 сушильный шкаф 120 °C
 * (ускорено) · 9 остывшая чашка на весы: m(Ca(OH)₂) · 10 щепотка продукта в воду с фенолфталеином — малиновый.
 * Весы помнят тару (чашку): без чашки показывают «−m(чашки)», с продуктом — m(продукта). Числа — из попытки.
 */
import * as THREE from 'three'
import { BOTTLE_H, ReagentBottle } from '../../../parts/glassware'
import { PourStream } from '../../../parts/effects'
import { DISH_H, DropperBottle, Falling, PorcelainDish, PpeTray, Puffs } from '../../../parts/practicalware'
import { Pose, Target, ease, hill, mix, useRig, useSoundAt, type PFn, type V3 } from '../../../rigCore'
import { Spatula } from '../../worksKit'
import { useGearStep } from '../../useGearStep'
import { useLabTaskValues } from '../../../../measure/labTaskSession'
import { fmtNum } from '../../../../measure/instruments'
import { DigitalScales, Readout, SCALES } from '../../../../measure/devices/Scales'
import { MeasuringCylinder, cylinderTop } from '../../../../measure/devices/Glass'
import { DryingOven, PowderJar } from '../../../../measure/devices/Bench'
import { CW, CW_DISH_G, CW_PAN, CW_SHELF } from '../../../../../../data/labTasks/g7/caoWater'
import { carry } from './kitG7'
import { HeatTile, LimeHeap, TILE, ThermoStand, WatchDish, pourPath, via } from './kitG7b'

const ID = 'task-g7-cao-water' as const
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
/** Низ ножки чашки — на 2 мм ниже её начала координат. */
const FOOT = 0.002
const DISH_REST: V3 = [CW.dish[0], FOOT, CW.dish[2]]
const DISH_PAN: V3 = [CW_PAN[0], CW_PAN[1] + FOOT, CW_PAN[2]]
const DISH_TILE: V3 = [CW.tile[0], TILE.h + FOOT, CW.tile[2]]
const DISH_SHELF: V3 = [CW_SHELF[0], CW_SHELF[1] + FOOT, CW_SHELF[2]]
const RIM_TILE = DISH_TILE[1] + DISH_H
const OVEN_FRONT_Z = CW.oven[2] + 0.26
const CYL_TOP = cylinderTop(10)
/** Термометр в лапке: низ шарика над плиткой — вверху, в порошке, поднят перед сушкой. */
const BULB_HIGH = 0.075
const BULB_LOW = DISH_TILE[1] + 0.004
const BULB_UP = 0.17
const PINCH = 0.03
const C_WATER = '#e6f2ff'

/** Сколько CaO уже в чашке (доля навески): два захода шпателем. */
const portion: PFn = (p) => 0.57 * ease(p, 3.47, 3.56) + 0.43 * ease(p, 3.84, 3.9)
const bulbY: PFn = (p) => mix(mix(BULB_HIGH, BULB_LOW, ease(p, 5.1, 5.75)), BULB_UP, ease(p, 8.0, 8.1))
/** Вода в чашке (м над началом чашки): налили → впиталась в кашицу → испарилась в шкафу. */
const dishWater: PFn = (p) => 0.0062 * ease(p, 7.46, 7.74) * (1 - 0.5 * ease(p, 7.7, 7.95)) * (1 - ease(p, 8.7, 9.25))
const swell: PFn = (p) => ease(p, 7.52, 7.85)
const wet: PFn = (p) => ease(p, 7.48, 7.6) * (1 - ease(p, 8.7, 9.4))
const steam: PFn = (p) => ease(p, 7.56, 7.62) * (1 - ease(p, 7.95, 8.15))
const door: PFn = (p) => 0.75 * (ease(p, 8.08, 8.2) * (1 - ease(p, 8.56, 8.66)) + ease(p, 9.04, 9.16) * (1 - ease(p, 9.86, 9.96)))
const ovenOn: PFn = (p) => ease(p, 8.64, 8.68) * (1 - 0.94 * ease(p, 9.46, 9.52))
function ovenLines(p: number): readonly string[] {
  if (p < 9.5) {
    const T = Math.round(mix(24, 120, ease(p, 8.66, 8.82)))
    const mm = Math.round(30 * ease(p, 8.82, 9.45))
    return [`${T} °C`, `${String(mm).padStart(2, '0')}:00`]
  }
  return [`${Math.round(mix(120, 28, ease(p, 9.5, 9.95)))} °C`, 'OFF']
}

function dishPose(p: number) {
  if (p < 4) return { pos: carry(p, 1.15, 1.75, DISH_REST, DISH_PAN, 0.12) }
  if (p < 8) {
    return {
      pos: via(p, DISH_PAN, [
        [4.12, 4.26, [DISH_PAN[0], 0.13, DISH_PAN[2]]],
        [4.24, 4.5, [DISH_TILE[0], 0.13, DISH_TILE[2] + 0.13]],
        [4.48, 4.62, [DISH_TILE[0], DISH_TILE[1] + 0.003, DISH_TILE[2] + 0.13]],
        [4.62, 4.8, DISH_TILE],
      ]),
    }
  }
  if (p < 9) {
    return {
      pos: via(p, DISH_TILE, [
        [8.12, 8.18, [DISH_TILE[0], 0.1, DISH_TILE[2]]],
        [8.17, 8.26, [0.08, 0.17, 0.1]],
        [8.25, 8.36, [DISH_SHELF[0], 0.17, OVEN_FRONT_Z]],
        [8.35, 8.42, [DISH_SHELF[0], 0.09, OVEN_FRONT_Z]],
        [8.41, 8.5, [DISH_SHELF[0], 0.09, DISH_SHELF[2]]],
        [8.5, 8.54, DISH_SHELF],
      ]),
    }
  }
  return {
    pos: via(p, DISH_SHELF, [
      [9.14, 9.2, [DISH_SHELF[0], 0.09, DISH_SHELF[2]]],
      [9.19, 9.32, [DISH_SHELF[0], 0.09, OVEN_FRONT_Z]],
      [9.31, 9.4, [DISH_SHELF[0], 0.17, OVEN_FRONT_Z]],
      [9.39, 9.68, [DISH_PAN[0], 0.17, DISH_PAN[2] + 0.05]],
      [9.67, 9.77, [DISH_PAN[0], 0.1, DISH_PAN[2]]],
      [9.76, 9.84, DISH_PAN],
    ]),
  }
}

export function CaoWaterRig() {
  const { lang } = useRig()
  const v = useLabTaskValues(ID)
  const { mCaO, t0, vW, tMax, mProd } = v as Record<string, number>

  useGearStep(ID, 0)
  useSoundAt(0.2, 'click', CW.ppe, 0.5)
  useSoundAt(1.75, 'glass-place', DISH_PAN, 0.35)
  useSoundAt(2.35, 'click', add(CW.scales, [SCALES.tareBtn[0], 0.02, SCALES.tareBtn[2]]), 0.5)
  useSoundAt(3.5, 'glass-clink', DISH_PAN, 0.2)
  useSoundAt(4.8, 'glass-place', DISH_TILE, 0.35)
  useSoundAt(6.46, 'pour', [CW.cylinder[0], CYL_TOP, CW.cylinder[2]], 0.45)
  useSoundAt(7.46, 'pour', [CW.tile[0], RIM_TILE, CW.tile[2]], 0.45)
  useSoundAt(7.55, 'sizzle', [CW.tile[0], RIM_TILE, CW.tile[2]], 0.8)
  useSoundAt(7.62, 'fizz', [CW.tile[0], RIM_TILE, CW.tile[2]], 0.6)
  useSoundAt(8.08, 'door-open', [CW.oven[0], 0.1, CW.oven[2] + 0.11], 0.4)
  useSoundAt(8.54, 'glass-place', DISH_SHELF, 0.3)
  useSoundAt(8.6, 'door-close', [CW.oven[0], 0.1, CW.oven[2] + 0.11], 0.4)
  useSoundAt(8.66, 'click', [CW.oven[0] - 0.04, 0.02, CW.oven[2] + 0.11], 0.4)
  useSoundAt(9.04, 'door-open', [CW.oven[0], 0.1, CW.oven[2] + 0.11], 0.4)
  useSoundAt(9.84, 'glass-place', DISH_PAN, 0.35)
  useSoundAt(10.56, 'success', CW.watch, 0.4)

  /* ── весы: чашка → тара → CaO → без чашки «−m(чашки)» → продукт → минус щепотка ── */
  const reading = (p: number) => {
    const onPan = (p >= 1.75 && p < 4.14) || p >= 9.84
    const content = p < 9.84 ? mCaO! * portion(p) : p >= 10.26 ? mProd! - PINCH : mProd!
    const gross = onPan ? CW_DISH_G + content : 0
    return Math.round((gross - (p >= 2.35 ? CW_DISH_G : 0)) * 100) / 100
  }
  /* ── термометр: комната → разогрев при гашении → в воздухе остывает ── */
  const temp: PFn = (p) => {
    const hot = mix(t0!, tMax!, ease(p, 7.5, 7.66))
    return mix(hot, t0!, ease(p, 8.05, 9))
  }

  /* ── шпатель: CaO (шаг 3) и щепотка продукта (шаг 10) ── */
  const spoon = (p: number) => {
    const rest: V3 = [CW.spatula[0], 0, CW.spatula[2]]
    const overJar: V3 = [CW.jar[0], 0.15, CW.jar[2]]
    const inJar: V3 = [CW.jar[0], 0.048, CW.jar[2]]
    const overDish: V3 = [CW_PAN[0] + 0.004, 0.088, CW_PAN[2]]
    const hi: V3 = [CW_PAN[0], 0.15, CW_PAN[2]]
    if (p < 9) {
      const pos = via(p, rest, [
        [3.08, 3.14, [rest[0], 0.12, rest[2]]],
        [3.12, 3.2, overJar],
        [3.2, 3.26, inJar],
        [3.26, 3.32, overJar],
        [3.32, 3.4, hi],
        [3.4, 3.46, overDish],
        [3.56, 3.6, hi],
        [3.6, 3.66, overJar],
        [3.66, 3.71, inJar],
        [3.71, 3.75, overJar],
        [3.75, 3.8, hi],
        [3.8, 3.84, overDish],
        [3.9, 3.94, [rest[0], 0.12, rest[2]]],
        [3.94, 3.99, rest],
      ])
      const up = ease(p, 3.1, 3.18) * (1 - ease(p, 3.92, 3.98))
      const tip = hill(p, 3.46, 3.56, 0.3) + hill(p, 3.84, 3.9, 0.3)
      return { pos, rot: [-1.1 * tip, 0, 0.9 * up - 0.5 * tip] as V3 }
    }
    const inDish: V3 = [CW_PAN[0] + 0.006, CW_PAN[1] + FOOT + 0.009, CW_PAN[2]]
    const overWatch: V3 = [CW.watch[0], 0.05, CW.watch[2]]
    const pos = via(p, rest, [
      [10.06, 10.12, [rest[0], 0.12, rest[2]]],
      [10.11, 10.2, [inDish[0], 0.12, inDish[2]]],
      [10.2, 10.25, inDish],
      [10.26, 10.31, [inDish[0], 0.12, inDish[2]]],
      [10.3, 10.46, [overWatch[0], 0.1, overWatch[2]]],
      [10.45, 10.5, overWatch],
      [10.6, 10.66, [overWatch[0], 0.1, overWatch[2]]],
      [10.65, 10.88, [rest[0], 0.1, rest[2]]],
      [10.88, 10.96, rest],
    ])
    const up = ease(p, 10.08, 10.16) * (1 - ease(p, 10.9, 10.96))
    const tip = hill(p, 10.5, 10.6, 0.3)
    return { pos, rot: [-1.1 * tip, 0, 0.9 * up - 0.5 * tip] as V3 }
  }
  const spoonFull: PFn = (p) =>
    ease(p, 3.22, 3.24) * (1 - ease(p, 3.47, 3.54)) + ease(p, 3.67, 3.69) * (1 - ease(p, 3.85, 3.89)) + 0.4 * ease(p, 10.22, 10.25) * (1 - ease(p, 10.51, 10.58))

  const bottle = pourPath(CW.bottle, 6, [CW.cylinder[0] + 0.004, CYL_TOP + 0.012, CW.cylinder[2]], BOTTLE_H, 1.85, 0.029)
  const cyl = pourPath(CW.cylinder, 7, [CW.tile[0] + 0.022, RIM_TILE + 0.012, CW.tile[2] + 0.008], CYL_TOP, 1.9, 0.016)
  const cylVol: PFn = (p) => vW! * ease(p, 6.46, 6.74) * (1 - ease(p, 7.46, 7.74))
  const crimson: PFn = (p) => ease(p, 10.56, 10.8)
  const watchColor = (p: number) => (crimson(p) > 0.5 ? (crimson(p) > 0.85 ? '#d31f7a' : '#e2669f') : crimson(p) > 0.1 ? '#efc3da' : '#eef6ff')

  return (
    <group>
      <group position={CW.ppe as unknown as THREE.Vector3Tuple}>
        <PpeTray worn={(p) => ease(p, 0, 0.95)} />
        <Target name="ppe" size={[0.16, 0.05, 0.1]} center={[0, 0.02, 0]} hintY={0.08} />
      </group>

      {/* Весы (включены с начала урока) */}
      <group position={CW.scales as unknown as THREE.Vector3Tuple}>
        <DigitalScales reading={reading} readout={(p) => ((p >= 1.6 && p < 4.6) || (p >= 9.6 && p < 10.2) ? 1 : 0)} />
        <Target name="scales-tare" size={[0.03, 0.03, 0.03]} center={[SCALES.tareBtn[0], 0.02, SCALES.d / 2 + 0.004]} hintY={0.07} ring={false} />
      </group>

      {/* Фарфоровая чашка с известью */}
      <Pose pose={dishPose}>
        <PorcelainDish level={dishWater} crystals={() => 0} boil={(p) => hill(p, 7.55, 7.98, 0.2)} liquidColor={C_WATER} />
        <LimeHeap amount={portion} swell={swell} wet={wet} />
        <Target name="dish" size={[0.1, 0.04, 0.1]} center={[0, 0.015, 0]} hintY={0.07} ring={false} />
      </Pose>
      <Falling from={[CW_PAN[0] + 0.004, 0.085, CW_PAN[2]]} toY={() => CW_PAN[1] + 0.006} a={3.47} b={3.56} n={6} color="#ecebe3" size={0.0016} />
      <Falling from={[CW_PAN[0] + 0.004, 0.085, CW_PAN[2]]} toY={() => CW_PAN[1] + 0.006} a={3.84} b={3.9} n={4} color="#ecebe3" size={0.0016} />

      {/* Банка CaO и шпатель */}
      <group position={CW.jar as unknown as THREE.Vector3Tuple}>
        <PowderJar formula="CaO" name={{ ru: 'оксид кальция', en: 'calcium oxide', uz: 'kalsiy oksidi' }[lang]} sub={{ ru: 'негашёная известь', en: 'quicklime', uz: 'so‘ndirilmagan ohak' }[lang]} color="#ecebe3" open={(p) => ease(p, 3, 3.1) * (1 - ease(p, 3.9, 3.99))} />
      </group>
      <Pose pose={spoon}>
        <Spatula full={spoonFull} color="#f2f1ea" />
        <group position={[0.06, 0, 0]}>
          <Target name="spatula" size={[0.14, 0.03, 0.04]} center={[0, 0.005, 0]} hintY={0.05} />
        </group>
      </Pose>

      {/* Плитка и термометр в лапке штатива */}
      <group position={CW.tile as unknown as THREE.Vector3Tuple}>
        <HeatTile />
        <ThermoStand rodDx={-0.12} bulbY={bulbY} temp={temp} />
      </group>
      <Pose pose={(p) => ({ pos: [CW.tile[0], bulbY(p), CW.tile[2]] })}>
        <Target name="thermometer" size={[0.03, 0.2, 0.03]} center={[0, 0.17, 0]} hintY={0.29} ring={false} />
      </Pose>
      <Readout
        position={[CW.tile[0] + 0.06, 0.21, CW.tile[2] + 0.04]}
        label={{ ru: 'термометр', en: 'thermometer', uz: 'termometr' }}
        text={(p, l) => (p > 5.8 && p < 6.4 ? `t₀ = ${fmtNum(t0!, 1, l)} °C` : p > 7.82 && p < 8.05 ? `t = ${fmtNum(tMax!, 1, l)} °C` : null)}
      />
      <Puffs origin={[CW.tile[0], RIM_TILE, CW.tile[2]]} rate={steam} color="#f6f7f8" count={26} rise={0.16} spread={0.022} drift={[0.015, 0, 0.02]} size={0.006} opacity={0.28} life={1.5} />

      {/* Вода: склянка → мерный цилиндр 10 мл → чашка */}
      <Pose pose={bottle}>
        <group position={[0, BOTTLE_H, 0]}>
          <ReagentBottle formula="H₂O" name={{ ru: 'вода дистил.', en: 'distilled water', uz: 'distillangan suv' }[lang]} level={(p) => mix(0.85, 0.83, ease(p, 6.46, 6.74))} />
        </group>
        <Target name="bottle-water" size={[0.07, 0.13, 0.07]} center={[0, 0.06, 0]} hintY={0.16} />
      </Pose>
      <PourStream x={CW.cylinder[0] + 0.004} z={CW.cylinder[2]} top={() => CYL_TOP + 0.01} bottom={(p) => 0.011 + (cylVol(p) / 10) * 0.075} show={(p) => hill(p, 6.46, 6.74, 0.15)} color={C_WATER} />
      <Pose pose={cyl}>
        <MeasuringCylinder capacity={10} volume={cylVol} color={C_WATER} />
        <Target name="cylinder" size={[0.04, 0.12, 0.04]} center={[0, 0.06, 0]} hintY={0.14} />
      </Pose>
      <PourStream x={CW.tile[0] + 0.022} z={CW.tile[2] + 0.008} top={() => RIM_TILE + 0.012} bottom={(p) => DISH_TILE[1] + Math.max(0.004, dishWater(p))} show={(p) => hill(p, 7.46, 7.74, 0.15)} color={C_WATER} />
      <Readout
        position={[CW.cylinder[0] + 0.05, 0.11, CW.cylinder[2]]}
        label={{ ru: 'цилиндр', en: 'cylinder', uz: 'silindr' }}
        text={(p, l) => (p > 6.8 && p < 7.35 ? `${fmtNum(vW!, 1, l)} ${l === 'ru' ? 'мл' : 'ml'}` : null)}
      />

      {/* Сушильный шкаф */}
      <group position={CW.oven as unknown as THREE.Vector3Tuple}>
        <DryingOven door={door} on={ovenOn} lines={ovenLines} />
      </group>

      {/* Часовое стекло с водой и каплей фенолфталеина, капельница */}
      <group position={CW.watch as unknown as THREE.Vector3Tuple}>
        <WatchDish color={watchColor} show={() => 1} />
      </group>
      <Falling from={[CW.watch[0], 0.045, CW.watch[2]]} toY={() => 0.004} a={10.51} b={10.6} n={4} color="#fbfbf9" size={0.0014} jitter={0.003} />
      <group position={CW.dropper as unknown as THREE.Vector3Tuple}>
        <DropperBottle color="#fbfbff" label={{ ru: 'фенолфт.', en: 'phenolph.', uz: 'fenolft.' }[lang]} />
      </group>
    </group>
  )
}
