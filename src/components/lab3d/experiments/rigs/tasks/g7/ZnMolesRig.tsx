/**
 * Kimyo 7, с. 62, задание 6 — 26 г цинка: количество вещества и число атомов.
 * Шаги: 0 весы ON · 1 лодочка на чашу · 2 тара «T» · 3 гранулы шпателем до 26 г · 4 снять показание · 5 цинк в стакан.
 * Все числа на дисплее весов — из попытки (useLabTaskValues): масса лодочки, ступеньки гранул, итог m(Zn), −m₀ в конце.
 */
import { useMemo } from 'react'
import * as THREE from 'three'
import { Pose, Target, ease, useRig, useSoundAt, type V3 } from '../../../rigCore'
import { Falling } from '../../../parts/practicalware'
import { DigitalScales, SCALES } from '../../../../measure/devices/Scales'
import { BEAKERS, MeasuringBeaker } from '../../../../measure/devices/Glass'
import { JAR, PowderJar, WeighBoat } from '../../../../measure/devices/Bench'
import { quantize } from '../../../../measure/quantities'
import { useLabTaskValues } from '../../../../measure/labTaskSession'
import { BandLabel, GranuleBed, Scoop, carry, hash01, track, type Key } from './kitG7'

const SC: V3 = [0, 0, -0.04]
const PAN: V3 = [0, SCALES.panY, -0.052]
const BOAT_REST: V3 = [-0.2, 0, 0.1]
const BOAT_END: V3 = [-0.1, 0, 0.135]
const JAR_P: V3 = [0.2, 0, -0.06]
const SPAT: V3 = [0.13, 0, 0.13]
const BK: V3 = [-0.24, 0, -0.1]
const OVER_BK: V3 = [BK[0] + 0.045, 0.118, BK[2]]
const ZN = '#a7b0b8'

/** Когда пустая лодочка легла на чашу и когда её подняли с чаши. */
const BOAT_ON = 1.78
const BOAT_OFF = 5.1
const TARED = 2.35
/** Четыре больших порции шпателем и пять отдельных гранул у 26 г: моменты, когда они ложатся в лодочку. */
const SCOOP_AT = [0, 1, 2, 3].map((k) => 3.08 + 0.13 * k)
const SCOOP_LAND = SCOOP_AT.map((a) => a + 0.095)
const FINE_LAND = [0, 1, 2, 3, 4].map((j) => 3.705 + 0.034 * j)

/** Масса порций (г): сумма — ровно m(Zn) попытки; последние гранулы — по 0,2–0,5 г. */
function portions(mZn: number): { at: number; m: number }[] {
  const key = Math.round(mZn * 100)
  const fine = FINE_LAND.map((_, j) => quantize(0.2 + 0.3 * hash01(key, j), 0.01))
  // перешли 26 г только последней гранулой: до неё на весах было меньше 26
  fine[4] = Math.min(0.5, Math.max(fine[4]!, quantize(mZn - 26 + 0.05, 0.01)))
  const big = mZn - fine.reduce((s, x) => s + x, 0)
  const frac = [0.31, 0.27, 0.24]
  const s = frac.map((f) => quantize(big * f, 0.01))
  s.push(quantize(big - s.reduce((a, x) => a + x, 0), 0.01))
  return [...SCOOP_LAND.map((at, k) => ({ at, m: s[k]! })), ...FINE_LAND.map((at, j) => ({ at, m: fine[j]! }))]
}

const REST_ROT: V3 = [0, 0, 0]
const DIG: V3 = [0, 0, 0.9]
const CARRY: V3 = [0, 0, 0.42]
const DUMP: V3 = [1.25, 0, 0.42]
const ABOVE_JAR: V3 = [JAR_P[0] - 0.004, 0.13, JAR_P[2]]
const IN_JAR: V3 = [JAR_P[0] - 0.004, 0.053, JAR_P[2]]
const HIGH_BOAT: V3 = [PAN[0] + 0.006, 0.13, PAN[2]]
const AT_BOAT: V3 = [PAN[0] + 0.006, PAN[1] + 0.032, PAN[2]]

/** Шпатель: со стола → 4 порции из банки в лодочку → гранулы по одной → на стол. */
const SPAT_KEYS: readonly Key[] = (() => {
  const k: Key[] = [
    [3.02, SPAT, REST_ROT],
    [3.05, [SPAT[0], 0.13, SPAT[2]], DIG],
    [3.08, ABOVE_JAR, DIG],
  ]
  for (const a of SCOOP_AT) {
    k.push([a + 0.025, IN_JAR, DIG], [a + 0.045, ABOVE_JAR, DIG], [a + 0.072, HIGH_BOAT, CARRY], [a + 0.085, AT_BOAT, CARRY], [a + 0.1, AT_BOAT, DUMP], [a + 0.13, ABOVE_JAR, DIG])
  }
  k.push([3.625, IN_JAR, DIG], [3.645, ABOVE_JAR, DIG], [3.675, HIGH_BOAT, CARRY], [3.695, AT_BOAT, CARRY])
  FINE_LAND.forEach((t) => k.push([t - 0.006, AT_BOAT, [0.55, 0, 0.42]], [t + 0.012, AT_BOAT, CARRY]))
  k.push([3.88, HIGH_BOAT, CARRY], [3.92, [SPAT[0], 0.1, SPAT[2]], REST_ROT], [3.96, SPAT, REST_ROT])
  return k
})()

/** Порошок/гранулы в ложечке: зачерпнули — несут — высыпали. */
function spatFull(p: number): number {
  for (const a of SCOOP_AT) if (p >= a + 0.03 && p < a + 0.095) return 1
  return p >= 3.63 && p < FINE_LAND[4]! ? 1 : 0
}

export function ZnMolesRig() {
  const { lang } = useRig()
  const v = useLabTaskValues('task-g7-zn-moles')
  const boat = v.boat!
  const mZn = v.mZn!
  const parts = useMemo(() => portions(mZn), [mZn])
  const zincAt = useMemo(() => (p: number) => parts.reduce((s, x) => (p >= x.at ? s + x.m : s), 0), [parts])
  const reading = useMemo(
    () => (p: number) => {
      if (p < 0.35) return null
      const on = p >= BOAT_ON && p < BOAT_OFF
      const gross = on ? boat + zincAt(p) : 0
      return Math.round((gross - (p >= TARED ? boat : 0)) * 100) / 100
    },
    [boat, zincAt],
  )

  useSoundAt(0.2, 'click', [SC[0] + SCALES.onBtn[0], 0.02, SC[2] + SCALES.onBtn[2]], 0.5)
  useSoundAt(BOAT_ON, 'click', PAN, 0.3)
  useSoundAt(2.2, 'click', [SC[0] + SCALES.tareBtn[0], 0.02, SC[2] + SCALES.tareBtn[2]], 0.5)
  useSoundAt(3.04, 'glass-clink', JAR_P, 0.3)
  useSoundAt(SCOOP_LAND[0]!, 'glass-clink', PAN, 0.3)
  useSoundAt(SCOOP_LAND[2]!, 'glass-clink', PAN, 0.3)
  useSoundAt(FINE_LAND[4]!, 'click', PAN, 0.2)
  useSoundAt(4.3, 'success', PAN, 0.3)
  useSoundAt(5.45, 'glass-clink', BK, 0.45)

  const boatPose = (p: number) => {
    if (p < 3) return { pos: carry(p, 1.02, BOAT_ON, BOAT_REST, PAN, 0.11) }
    if (p < 5.31) return { pos: carry(p, 5.0, 5.3, PAN, OVER_BK, 0.15) }
    const tilt = ease(p, 5.31, 5.42) * (1 - ease(p, 5.62, 5.7))
    return { pos: p < 5.7 ? OVER_BK : carry(p, 5.7, 5.97, OVER_BK, BOAT_END, 0.15), rot: [0, 0, 1.0 * tilt] as V3 }
  }
  const boatFill = (p: number) => (p < 5 ? zincAt(p) / mZn : 1 - ease(p, 5.4, 5.6))
  const name = { ru: 'для опытов', en: 'for experiments', uz: 'tajribalar uchun' }[lang]
  const jarName = { ru: 'цинк, гранулы', en: 'zinc granules', uz: 'rux, granula' }[lang]

  return (
    <group>
      {/* Электронные весы: кнопки ON и T, дисплей */}
      <group position={SC as unknown as THREE.Vector3Tuple}>
        <DigitalScales reading={reading} readout={(p) => (p >= 1.6 ? 1 : 0)} />
        <Target name="scales-power" size={[0.03, 0.03, 0.03]} center={[SCALES.onBtn[0], 0.02, SCALES.d / 2 + 0.004]} hintY={0.07} ring={false} />
        <Target name="scales-tare" size={[0.03, 0.03, 0.03]} center={[SCALES.tareBtn[0], 0.02, SCALES.d / 2 + 0.004]} hintY={0.07} ring={false} />
        <Target name="scales-display" size={[0.07, 0.03, 0.03]} center={[0, 0.021, SCALES.d / 2 + 0.004]} hintY={0.075} ring={false} />
      </group>

      {/* Лодочка: стол → чаша → (после взвешивания) над стаканом, наклон → на стол */}
      <Pose pose={boatPose}>
        <WeighBoat fill={boatFill} kind="granules" color={ZN} maxPieces={34} />
        <Target name="boat" size={[0.07, 0.04, 0.06]} center={[0, 0.012, 0]} hintY={0.06} ring={false} />
      </Pose>
      <Falling from={[BK[0] + 0.012, 0.1, BK[2]]} toY={() => 0.01} a={5.42} b={5.6} n={8} color={ZN} size={0.0028} box />

      {/* Банка с гранулами цинка и шпатель */}
      <group position={JAR_P as unknown as THREE.Vector3Tuple}>
        <PowderJar formula="Zn" name={jarName} color={ZN} fill={0.75} granules open={(p) => ease(p, 3.0, 3.07) * (1 - ease(p, 3.93, 4.0))} />
        <Target name="zn-jar" size={[0.07, 0.1, 0.07]} center={[0, JAR.h / 2, 0]} hintY={0.12} />
      </group>
      <Pose pose={(p) => track(p, SPAT_KEYS)}>
        <Scoop full={spatFull} kind="granules" color={ZN} />
      </Pose>

      {/* Стакан «Zn для опытов» */}
      <group position={BK as unknown as THREE.Vector3Tuple}>
        <MeasuringBeaker size={BEAKERS[100]} volume={() => 0} color={() => '#eef6ff'} />
        <GranuleBed r={BEAKERS[100].ri} show={(p) => ease(p, 5.44, 5.62)} n={34} color={ZN} />
        <group rotation={[0, 1.2, 0]}>
          <BandLabel r={BEAKERS[100].ri + 0.0019} y={0.036} formula="Zn" name={name} h={0.024} />
        </group>
      </group>
    </group>
  )
}
