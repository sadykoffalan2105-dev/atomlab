/** Сцена «Обжиг известняка: CaCO₃ → CaO + CO₂↑» — модель models/co2Calcination.ts + жар печи, подписи, рёбра CaO. */
import { useMemo } from 'react'
import { AngleArc, Burst, Glow, Lobe, MeasureLine, Tag, win } from '../../showcase/kit/core'
import { seg } from '../geom'
import { CAO_H, UNITS, caoSites } from '../models/co2Calcination'
import { RouteAtoms } from '../RouteAtoms'
import { Edges, fixed, midOf, posOf, type RouteSceneProps } from './common'

const PI = '#f0abfc'

export function Co2CalcinationScene({ model, L, tags, lowPower }: RouteSceneProps) {
  const W = model.stages.W
  const R = W('reagents')
  const H = W('heat')
  const B = W('break')
  const E = W('escape')
  const C = W('cao')
  const F = W('final')
  const tx = (k: string) => tags[k]![L]
  const end = F.t1 + 1
  const b0 = B.t0 + 0.6
  // рёбра фрагмента CaO: соседние узлы куба (Ca–O, 240 пм)
  const edges = useMemo(() => {
    const nodes = UNITS.flatMap((u, k) => {
      const s = caoSites(u.sx, u.sz)
      return [
        { id: `Ca${k}`, p: s.ca },
        { id: `Of${k}`, p: s.o },
      ]
    })
    const out: [string, string][] = []
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]!.p
        const b = nodes[j]!.p
        const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
        if (Math.abs(d - 2 * CAO_H) < 0.01) out.push([nodes[i]!.id, nodes[j]!.id])
      }
    return out
  }, [])
  const heat = (t: number) => (0.25 + 0.55 * seg(t, H.t0, H.t0 + 2.5) - 0.35 * seg(t, C.t0, F.t1)) * (0.88 + 0.12 * Math.sin(8 * t))
  return (
    <group>
      <RouteAtoms model={model} lowPower={lowPower} />
      {/* жар печи снизу */}
      <Glow pos={fixed([0, -0.95, 0.1])} r={1.4} color="#f97316" k={(t) => heat(t) * seg(t, R.t0 + 0.5, H.t0 + 1)} />
      <Glow pos={fixed([0, -0.7, 0.4])} r={0.7} color="#fdba74" k={(t) => 0.6 * heat(t) * win(t, H.t0, E.t1, 1.5)} />
      {/* разрыв C–O у единицы 0: вспышка, новая π-связь */}
      <Burst pos={midOf(model, 'C0', 'Of0')} t0={b0 + 1.0} dur={1.2} r={0.3} color="#ffd7a8" />
      <Lobe kind="p" center={midOf(model, 'C0', 'Ob0')} axis={() => [0, 1, 0]} r={0.12} color={PI} k={(t) => win(t, b0 + 1.8, E.t0 + 0.8)} />
      <Edges model={model} pairs={edges} k={(t) => seg(t, C.t0 + 3.0, C.t0 + 4.2)} />
      {/* подписи */}
      <Tag pos={fixed([0.95, 0.55, 0.55])} text={tx('crystal')} k={(t) => win(t, R.t0 + 0.8, H.t0 + 0.6)} />
      <Tag pos={posOf(model, 'C0', [0, 0.26, 0])} text={tx('carbonate')} k={(t) => win(t, R.t0 + 1.8, H.t0 + 1.6)} />
      <Tag pos={fixed([0, -0.9, 0.7])} text={tx('heat')} tone="heat" k={(t) => win(t, H.t0 + 0.5, B.t0 + 0.8)} />
      <Tag pos={fixed([0.9, -0.55, 0.6])} text={tx('absorb')} tone="heat" k={(t) => win(t, H.t0 + 1.6, B.t0 + 0.4)} />
      <Tag pos={posOf(model, 'Of0', [0.3, 0.1, 0])} text={tx('pairToO')} tone="minus" k={(t) => win(t, b0 + 0.3, b0 + 1.9)} />
      <Tag pos={posOf(model, 'Of0', [0, -0.34, 0])} text={tx('o2m')} tone="minus" k={(t) => win(t, b0 + 1.9, E.t0 + 1.2)} />
      <AngleArc v={posOf(model, 'C0')} a={posOf(model, 'Oa0')} b={posOf(model, 'Ob0')} r={0.2} label={() => tx('angle')} k={(t) => win(t, b0 + 1.0, E.t0 + 0.6)} />
      <Tag pos={midOf(model, 'C0', 'Ob0', [0, 0.3, 0])} text={tx('newPi')} tone="key" k={(t) => win(t, b0 + 1.9, b0 + 3.6)} />
      <Tag pos={posOf(model, 'C0', [0, 0.36, 0])} text={tx('notRedox')} tone="key" k={(t) => win(t, b0 + 3.4, E.t0 + 1.4)} />
      <Tag pos={posOf(model, 'C0', [0.4, 0.12, 0])} text={tx('gas')} k={(t) => win(t, E.t0 + 1.0, end)} />
      <Tag pos={fixed([0.7, -0.95, 0.6])} text={tx('cao')} tone="key" k={(t) => win(t, C.t0 + 3.2, end)} />
      <MeasureLine a={posOf(model, 'Ca0')} b={posOf(model, 'Of0')} offset={-0.2} text={tx('len240')} k={(t) => win(t, C.t0 + 3.6, F.t0 + 2.4)} />
      <Tag pos={fixed([-0.75, 0.55, 0.4])} text={tx('endo')} tone="heat" k={(t) => win(t, F.t0 + 0.6, end)} />
    </group>
  )
}
