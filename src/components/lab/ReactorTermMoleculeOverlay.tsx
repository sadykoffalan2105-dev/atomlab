import { useMemo } from 'react'
import { Billboard, Text } from '@react-three/drei'
import type { ReactorEquationTerm } from '../../chemistry/reactorEquationBalance'
import { resolveReactorTermMolecule } from '../../lab/reactorPreviewMolecule'
import { getTermGroupCenters } from './reactorPreviewLayout'
import { ReactorPreviewAtomSlot } from './ReactorPreviewAtomSlot'
import { BondCylinder } from './MoleculeMesh'

const BOND_COLOR = '#bcd6ff'

function CoeffBadge({ value, y }: { value: number; y: number }) {
  return (
    <Billboard position={[0, y, 0]}>
      <Text
        fontSize={0.16}
        fontWeight={800}
        color="#eaf2ff"
        outlineWidth={0.018}
        outlineColor="#0b1220"
        outlineOpacity={0.9}
        anchorX="center"
        anchorY="middle"
      >
        {`×${value}`}
      </Text>
    </Billboard>
  )
}

/**
 * Настоящие молекулы (атомы формулы + связи между ними) для слагаемых
 * уравнения реактора — вместо N одинаковых шаров одного «заглавного»
 * элемента. Коэффициент показан бэйджем «×N», а не N копиями: копия
 * молекулы на слагаемое с коэффициентом 20 никто не читает.
 */
export function ReactorTermMoleculeOverlay({
  terms,
  scale,
  visible,
}: {
  terms: readonly ReactorEquationTerm[]
  scale: number
  visible: boolean
}) {
  const activeTerms = useMemo(() => terms.filter((t) => Math.floor(t.coeff) > 0), [terms])
  const centers = useMemo(() => getTermGroupCenters(terms), [terms])

  const entries = useMemo(
    () =>
      activeTerms
        .map((term, termIndex) => {
          const template = resolveReactorTermMolecule(term)
          if (!template) return null
          const center = centers.find((c) => c.termIndex === termIndex)?.pos ?? [0, 0.12, 0.24]
          return { term, template, center }
        })
        .filter((e): e is NonNullable<typeof e> => e !== null),
    [activeTerms, centers],
  )

  if (!visible || entries.length === 0) return null

  return (
    <>
      {entries.map(({ term, template, center }) => {
        const topY = template.atoms.reduce((m, a) => Math.max(m, a.pos[1]), 0) + 0.26
        return (
          <group key={term.id} position={center} scale={scale}>
            {template.atoms.map((atom, ai) => (
              <group key={ai} position={atom.pos}>
                <ReactorPreviewAtomSlot
                  z={atom.z}
                  animate={false}
                  previewStatic
                  useFullDetail={false}
                  synthesisGlass={false}
                  previewLite
                  electronFrameSkip={6}
                  hideOrbitRings
                  localLight={false}
                />
              </group>
            ))}
            {template.bonds.map(([bi, bj], k) => {
              const from = template.atoms[bi]?.pos
              const to = template.atoms[bj]?.pos
              if (!from || !to) return null
              return <BondCylinder key={k} from={from} to={to} color={BOND_COLOR} />
            })}
            {term.coeff > 1 ? <CoeffBadge value={Math.floor(term.coeff)} y={topY} /> : null}
          </group>
        )
      })}
    </>
  )
}
