import { useMemo } from 'react'
import { Html, Line } from '@react-three/drei'
import {
  scoreBondAngles,
  type AngleScore,
} from '../../../chemistry/organic/organicLayout'
import type { OrganicGraph } from '../../../chemistry/organic/organicGraph'
import styles from './OrganicBuilderCanvas.module.css'

/** Подписи углов и векторы связей в 3D — для правильной сборки по химии. */
export function AngleVectorGuides({
  graph,
  scale,
  selectedId,
}: {
  graph: OrganicGraph
  scale: number
  selectedId: string | null
}) {
  const scores = useMemo(() => scoreBondAngles(graph), [graph])

  const focused = useMemo(() => {
    if (!selectedId) return scores.filter((s) => s.status !== 'ok').slice(0, 8)
    const around = scores.filter((s) => s.centerId === selectedId)
    return around.length > 0 ? around : scores.slice(0, 6)
  }, [scores, selectedId])

  const bondLines = useMemo(() => {
    const out: { key: string; a: [number, number, number]; b: [number, number, number] }[] = []
    for (const b of graph.bonds) {
      const A = graph.atoms.find((x) => x.id === b.a)
      const B = graph.atoms.find((x) => x.id === b.b)
      if (!A || !B) continue
      out.push({
        key: b.id,
        a: [A.pos[0] * scale, A.pos[1] * scale, A.pos[2] * scale],
        b: [B.pos[0] * scale, B.pos[1] * scale, B.pos[2] * scale],
      })
    }
    return out
  }, [graph, scale])

  return (
    <group>
      {bondLines.map((L) => (
        <Line
          key={`v-${L.key}`}
          points={[L.a, L.b]}
          color="#67e8f9"
          lineWidth={1}
          transparent
          opacity={0.35}
        />
      ))}
      {focused.map((s) => (
        <AngleBadge key={`${s.centerId}-${s.aId}-${s.bId}`} score={s} graph={graph} scale={scale} />
      ))}
    </group>
  )
}

function AngleBadge({
  score,
  graph,
  scale,
}: {
  score: AngleScore
  graph: OrganicGraph
  scale: number
}) {
  const c = graph.atoms.find((a) => a.id === score.centerId)
  const a = graph.atoms.find((x) => x.id === score.aId)
  const b = graph.atoms.find((x) => x.id === score.bId)
  if (!c || !a || !b) return null

  const mid: [number, number, number] = [
    ((c.pos[0] + (a.pos[0] + b.pos[0]) / 2) / 2) * scale,
    ((c.pos[1] + (a.pos[1] + b.pos[1]) / 2) / 2) * scale + 0.25 * scale,
    ((c.pos[2] + (a.pos[2] + b.pos[2]) / 2) / 2) * scale,
  ]

  const ok = score.status === 'ok'
  const close = score.status === 'close'
  const cls = ok ? styles.angleOk : close ? styles.angleClose : styles.angleBad

  return (
    <Html position={mid} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
      <span className={`${styles.angleBadge} ${cls}`}>
        {Math.round(score.measured)}°
        <small> / {Math.round(score.target)}°</small>
      </span>
    </Html>
  )
}
