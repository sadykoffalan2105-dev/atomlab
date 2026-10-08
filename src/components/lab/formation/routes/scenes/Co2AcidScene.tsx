/** Сцена «Мрамор + соляная кислота: CaCO₃ + 2HCl → CaCl₂ + CO₂↑ + H₂O» — модель models/co2Acid.ts + подписи, пузырёк. */
import { AngleArc, Burst, Glow, Lobe, Tag, win } from '../../showcase/kit/core'
import { SURF_Y } from '../models/co2Acid'
import { RouteAtoms } from '../RouteAtoms'
import { Bubble, RisingBubbles, fixed, midOf, posOf, type RouteSceneProps } from './common'

const PI = '#f0abfc'
const O_LOBE = '#fda4af'
const AQ = '#67e8f9'

export function Co2AcidScene({ model, L, tags, lowPower }: RouteSceneProps) {
  const W = model.stages.W
  const R = W('reagents')
  const D = W('dissociate')
  const P1 = W('protonate1')
  const P2 = W('protonate2')
  const Dc = W('decompose')
  const G = W('gas')
  const F = W('final')
  const tx = (k: string) => tags[k]![L]
  const pC = posOf(model, 'C')
  const end = F.t1 + 1
  return (
    <group>
      <RouteAtoms model={model} lowPower={lowPower} />
      {/* неподелённые пары O, к которым садятся H⁺ */}
      <Lobe kind="lone" center={posOf(model, 'O3')} axis={() => [0.77, 0.64, 0.2]} r={0.15} color={O_LOBE} k={(t) => win(t, P1.t0 + 0.6, P1.t0 + 3.4)} />
      <Lobe kind="lone" center={posOf(model, 'O2')} axis={() => [0.17, -0.98, 0.2]} r={0.15} color={O_LOBE} k={(t) => win(t, P2.t0 + 0.6, P2.t0 + 3.4)} />
      {/* новая π-связь C=O из пары O–H */}
      <Lobe kind="p" center={midOf(model, 'C', 'O2')} axis={() => [0, 0, 1]} r={0.13} color={PI} k={(t) => win(t, Dc.t0 + 2.6, Dc.t1 + 0.6)} />
      <Burst pos={midOf(model, 'H1', 'Cl1')} t0={D.t0 + 2.0} dur={1.1} r={0.3} color="#bbf7d0" />
      <Burst pos={midOf(model, 'H2', 'Cl2')} t0={D.t0 + 2.6} dur={1.1} r={0.3} color="#bbf7d0" />
      <Burst pos={midOf(model, 'C', 'O3')} t0={Dc.t0 + 1.3} dur={1.2} r={0.34} color="#ffd7a8" />
      {/* пузырёк CO₂ и мелкие пузырьки от мрамора */}
      <Bubble pos={pC} r={0.52} k={(t) => win(t, G.t0 + 0.2, F.t0 + 1.6, 0.7)} />
      <RisingBubbles n={lowPower ? 6 : 12} from={[0.1, SURF_Y + 0.1, -0.25]} height={1.6} spread={0.8} k={(t) => win(t, G.t0 - 0.4, end, 1.2)} />
      {/* ионы в растворе окружены водой (гидратация) */}
      <Glow pos={posOf(model, 'Ca')} r={0.42} color={AQ} k={(t) => 0.4 * win(t, G.t0 + 1.2, end, 1)} />
      <Glow pos={posOf(model, 'Cl1')} r={0.55} color={AQ} k={(t) => 0.3 * win(t, G.t0 + 1.4, end, 1)} />
      <Glow pos={posOf(model, 'Cl2')} r={0.55} color={AQ} k={(t) => 0.3 * win(t, G.t0 + 1.4, end, 1)} />
      {/* подписи */}
      <Tag pos={fixed([0.85, SURF_Y - 0.26, 0.15])} text={tx('marble')} k={(t) => win(t, R.t0 + 0.5, D.t0 + 0.6)} />
      <Tag pos={posOf(model, 'C', [0, 0.22, 0.42])} text={tx('carbonate')} k={(t) => win(t, R.t0 + 1.6, P1.t0 + 0.6)} />
      <Tag pos={midOf(model, 'H1', 'Cl1', [0, 0.3, 0])} text={tx('hcl')} k={(t) => win(t, R.t0 + 1.0, D.t0 + 1.2)} />
      <Tag pos={midOf(model, 'H2', 'Cl2', [0, 0.3, 0])} text={tx('hcl')} k={(t) => win(t, R.t0 + 1.4, D.t0 + 1.2)} />
      <Tag pos={posOf(model, 'wO0', [0, 0.25, 0])} text={tx('water')} k={(t) => win(t, R.t0 + 2.6, D.t0 + 0.8)} />
      <Tag pos={posOf(model, 'Cl1', [0, 0.42, 0])} text={tx('pairToCl')} tone="minus" k={(t) => win(t, D.t0 + 1.2, D.t0 + 3.4)} />
      <Tag pos={posOf(model, 'O3', [0.2, -0.28, 0])} text={tx('lone')} tone="minus" k={(t) => win(t, P1.t0 + 0.9, P1.t0 + 3.0)} />
      <Tag pos={posOf(model, 'C', [0, -0.55, 0])} text={tx('hco3')} tone="key" k={(t) => win(t, P1.t0 + 3.4, P2.t0 + 1.2)} />
      <Tag pos={posOf(model, 'Ca', [0, 0.32, 0])} text={tx('caq')} k={(t) => win(t, P1.t0 + 2.4, P2.t0 + 2.4)} />
      <Tag pos={posOf(model, 'C', [0, -0.62, 0])} text={tx('h2co3')} tone="key" k={(t) => win(t, P2.t0 + 3.4, Dc.t0 + 1.0)} />
      <Tag pos={posOf(model, 'H2', [0, -0.22, 0])} text={tx('hJump')} k={(t) => win(t, Dc.t0 + 0.5, Dc.t0 + 2.3)} />
      <Tag pos={midOf(model, 'C', 'O3', [0.22, 0.12, 0])} text={tx('breakCO')} tone="heat" k={(t) => win(t, Dc.t0 + 0.8, Dc.t0 + 2.5)} />
      <Tag pos={midOf(model, 'C', 'O2', [-0.25, 0, 0])} text={tx('newPi')} tone="key" k={(t) => win(t, Dc.t0 + 2.7, Dc.t1 + 0.4)} />
      <AngleArc v={pC} a={posOf(model, 'O1')} b={posOf(model, 'O2')} r={0.2} label={() => tx('angle')} k={(t) => win(t, Dc.t0 + 2.2, G.t0 + 1.0)} />
      <Tag pos={posOf(model, 'O3', [0, 0.3, 0])} text={tx('h2o')} k={(t) => win(t, Dc.t0 + 3.6, end)} />
      <Tag pos={posOf(model, 'C', [0, -0.35, 0])} text={tx('notRedox')} tone="key" k={(t) => win(t, Dc.t0 + 4.0, G.t0 + 2.4)} />
      <Tag pos={posOf(model, 'C', [0.55, 0.15, 0])} text={tx('bubble')} k={(t) => win(t, G.t0 + 1.0, end)} />
      <Tag pos={posOf(model, 'Ca', [0, -0.32, 0])} text={tx('cacl2')} tone="key" k={(t) => win(t, G.t0 + 1.6, end)} />
      <Tag pos={posOf(model, 'Cl1', [0, -0.42, 0])} text={tx('clq')} k={(t) => win(t, G.t0 + 2.2, end)} />
    </group>
  )
}
