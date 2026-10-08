/** Сцена «Горение угля: C + O₂ → CO₂» — модель models/co2Combustion.ts + облака, энергия, подписи. */
import { AngleArc, Burst, DipoleArrow, Glow, Lobe, MeasureLine, Tag, win } from '../../showcase/kit/core'
import { seg } from '../geom'
import { SHEET_Y } from '../models/co2Combustion'
import { RouteAtoms } from '../RouteAtoms'
import { fixed, midOf, posOf, type RouteSceneProps } from './common'

const SIG = '#a5f3fc'
const PI = '#f0abfc'
const O_LOBE = '#fda4af'
const FIRE = '#fb923c'

export function Co2CombustionScene({ model, L, tags, lowPower }: RouteSceneProps) {
  const W = model.stages.W
  const R = W('reagents')
  const I = W('ignite')
  const A = W('attack')
  const T = W('transfer')
  const Bo = W('bonds')
  const Re = W('release')
  const F = W('final')
  const tx = (k: string) => tags[k]![L]
  const pC = posOf(model, 'C')
  const midOO = midOf(model, 'Oa', 'Ob')
  const midA = midOf(model, 'C', 'Oa')
  const midB = midOf(model, 'C', 'Ob')
  const oo = (t: number) => seg(t, R.t0 + 0.4, R.t0 + 1.2) * (1 - seg(t, I.t0 + 2.3, I.t0 + 3.0))
  const lone = (t: number) => win(t, A.t1 - 0.6, Re.t0 + 0.8, 0.6)
  return (
    <group>
      <RouteAtoms model={model} lowPower={lowPower} />
      {/* O₂: σ между ядрами и π над осью — до разрыва */}
      <Lobe kind="s" center={midOO} r={0.1} color={SIG} k={oo} />
      <Lobe kind="p" center={midOO} axis={() => [0, 1, 0]} r={0.16} color={PI} k={oo} />
      {/* неподелённые пары O после разрыва (по две у каждого O) */}
      <Lobe kind="lone" center={posOf(model, 'Oa')} axis={() => [-0.55, 0.6, 0.58]} r={0.15} color={O_LOBE} k={lone} />
      <Lobe kind="lone" center={posOf(model, 'Oa')} axis={() => [-0.55, -0.6, 0.58]} r={0.15} color={O_LOBE} k={lone} />
      <Lobe kind="lone" center={posOf(model, 'Ob')} axis={() => [0.55, 0.6, 0.58]} r={0.15} color={O_LOBE} k={lone} />
      <Lobe kind="lone" center={posOf(model, 'Ob')} axis={() => [0.55, -0.6, 0.58]} r={0.15} color={O_LOBE} k={lone} />
      {/* σ и π новых связей */}
      <Lobe kind="s" center={midA} r={0.09} color={SIG} k={(t) => win(t, Bo.t0 + 0.6, Re.t0 + 0.6)} />
      <Lobe kind="p" center={midA} axis={() => [0, 1, 0]} r={0.13} color={PI} k={(t) => win(t, Bo.t0 + 0.8, Re.t0 + 0.6)} />
      <Lobe kind="s" center={midB} r={0.09} color={SIG} k={(t) => win(t, Bo.t0 + 1.2, Re.t0 + 0.6)} />
      <Lobe kind="p" center={midB} axis={() => [0, 0, 1]} r={0.13} color={PI} k={(t) => win(t, Bo.t0 + 1.4, Re.t0 + 0.6)} />
      {/* огонь: поджиг и горение края */}
      <Glow pos={fixed([0, SHEET_Y + 0.05, 0.05])} r={0.55} color={FIRE} k={(t) => 0.75 * win(t, I.t0 + 0.2, A.t0 + 1.4, 0.8) * (0.85 + 0.15 * Math.sin(11 * t))} />
      <Glow pos={fixed([0, SHEET_Y + 0.05, 0.05])} r={0.8} color="#f97316" k={(t) => 0.6 * win(t, Re.t0 + 0.4, F.t0 + 0.8, 0.8) * (0.85 + 0.15 * Math.sin(9 * t + 1))} />
      <Burst pos={midOO} t0={I.t0 + 2.6} dur={1.4} r={0.45} color="#ffb86b" />
      <Burst pos={midA} t0={Bo.t0 + 1.3} dur={1.1} r={0.32} />
      <Burst pos={midB} t0={Bo.t0 + 1.9} dur={1.1} r={0.32} />
      <Glow pos={pC} r={0.55} color="#fff1c4" k={(t) => 0.45 * win(t, Bo.t0 + 2.3, Bo.t0 + 3.4, 0.4)} />
      {/* подписи */}
      <Tag pos={fixed([0.8, SHEET_Y - 0.08, 0.1])} text={tx('coal')} k={(t) => win(t, R.t0 + 0.6, I.t0 + 1.2)} />
      <Tag pos={midOf(model, 'Oa', 'Ob', [0, 0.28, 0])} text={tx('o2')} k={(t) => win(t, R.t0 + 1.4, I.t0 + 1.8)} />
      <Tag pos={fixed([0, SHEET_Y - 0.3, 0.25])} text={tx('ignite')} tone="heat" k={(t) => win(t, I.t0 + 0.3, I.t1)} />
      <Tag pos={midOf(model, 'Oa', 'Ob', [0, 0.26, 0])} text={tx('breakOO')} tone="heat" k={(t) => win(t, I.t0 + 2.6, A.t0 + 0.8)} />
      <Tag pos={posOf(model, 'C', [0, -0.3, 0.1])} text={tx('tearOff')} tone="heat" k={(t) => win(t, A.t0 + 0.8, A.t1)} />
      <Tag pos={posOf(model, 'C', [0, 0.3, 0])} text={tx('c0')} tone="plus" k={(t) => win(t, T.t0 + 0.3, T.t0 + 2.9)} />
      <Tag pos={posOf(model, 'C', [0, 0.3, 0])} text={tx('c4')} tone="plus" k={(t) => win(t, T.t0 + 3.0, Bo.t0 + 1.4)} />
      <Tag pos={posOf(model, 'Oa', [0, 0.28, 0])} text={tx('o0')} tone="minus" k={(t) => win(t, T.t0 + 0.3, T.t0 + 2.9)} />
      <Tag pos={posOf(model, 'Oa', [0, 0.28, 0])} text={tx('om2')} tone="minus" k={(t) => win(t, T.t0 + 3.0, Bo.t0 + 1.4)} />
      <Tag pos={posOf(model, 'Ob', [0, 0.28, 0])} text={tx('o0')} tone="minus" k={(t) => win(t, T.t0 + 0.3, T.t0 + 2.9)} />
      <Tag pos={posOf(model, 'Ob', [0, 0.28, 0])} text={tx('om2')} tone="minus" k={(t) => win(t, T.t0 + 3.0, Bo.t0 + 1.4)} />
      <Tag pos={posOf(model, 'C', [0, -0.32, 0])} text={tx('shift')} tone="key" k={(t) => win(t, T.t0 + 1.2, T.t0 + 3.4)} />
      <Tag pos={posOf(model, 'C', [0, -0.32, 0])} text={tx('reducer')} tone="plus" k={(t) => win(t, T.t0 + 3.5, Bo.t0 + 1.2)} />
      <Tag pos={posOf(model, 'Oa', [0, -0.3, 0])} text={tx('oxidizer')} tone="minus" k={(t) => win(t, T.t0 + 3.5, Bo.t0 + 1.2)} />
      <Tag pos={midOf(model, 'C', 'Oa', [0, 0.27, 0])} text={tx('sp')} k={(t) => win(t, Bo.t0 + 1.6, Re.t0 + 0.4)} />
      <Tag pos={midOf(model, 'C', 'Ob', [0, 0.27, 0])} text={tx('sp')} k={(t) => win(t, Bo.t0 + 2.2, Re.t0 + 0.4)} />
      <MeasureLine a={pC} b={posOf(model, 'Ob')} offset={-0.2} text={tx('length')} k={(t) => win(t, Bo.t0 + 2.6, Re.t0 + 1.0)} />
      <Tag pos={posOf(model, 'C', [0, 0.36, 0])} text={tx('heat')} tone="heat" k={(t) => win(t, Re.t0 + 0.8, F.t0 + 0.6)} />
      <Tag pos={fixed([0.95, SHEET_Y + 0.1, 0.25])} text={tx('burn')} tone="heat" k={(t) => win(t, Re.t0 + 1.3, F.t0 + 0.4)} />
      <Tag pos={posOf(model, 'C', [0.42, 0.18, 0])} text={tx('gas')} k={(t) => win(t, Re.t0 + 2.0, F.t0 + 0.6)} />
      {/* финал: 180°, 116 пм, диполи гасят друг друга */}
      <AngleArc v={pC} a={posOf(model, 'Oa')} b={posOf(model, 'Ob')} r={0.2} label={() => tx('angle')} k={(t) => win(t, F.t0 + 0.6, F.t1 + 1)} />
      <DipoleArrow from={posOf(model, 'C', [0, 0.2, 0])} to={posOf(model, 'Oa', [0, 0.2, 0])} width={0.022} k={(t) => win(t, F.t0 + 1.6, F.t1 + 1)} />
      <DipoleArrow from={posOf(model, 'C', [0, 0.2, 0])} to={posOf(model, 'Ob', [0, 0.2, 0])} width={0.022} k={(t) => win(t, F.t0 + 1.6, F.t1 + 1)} />
      <Tag pos={posOf(model, 'C', [0, -0.3, 0])} text={tx('co2')} tone="key" k={(t) => win(t, F.t0 + 0.8, F.t1 + 1)} />
    </group>
  )
}
