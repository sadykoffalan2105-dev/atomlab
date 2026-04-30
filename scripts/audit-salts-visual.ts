import { compoundById } from '../src/data/compounds'

const SEPARATE_CATIONS = new Set(['Na', 'K', 'Li', 'Cs', 'Mg', 'Ca', 'Ba', 'Sr', 'Ag'])

type Row = {
  id: string
  formula: string
  nameRu: string
  atomsLen: number
  bondsLen: number
  details: string
}

const badInterIon: Row[] = []
const missingInternal: Row[] = []
const overlapping: Row[] = []

const R = 0.32
const MIN_OK_DIST = R * 2 * 1.02 // small margin to avoid visual "sticking"

function dist(a: readonly [number, number, number], b: readonly [number, number, number]) {
  const dx = a[0] - b[0]
  const dy = a[1] - b[1]
  const dz = a[2] - b[2]
  return Math.hypot(dx, dy, dz)
}

function bondKey(i: number, j: number) {
  const a = Math.min(i, j)
  const b = Math.max(i, j)
  return `${a}-${b}`
}

for (const c of Object.values(compoundById)) {
  if (c.category !== 'salt') continue
  const atoms = c.atoms ?? []
  const bonds = c.bonds ?? []
  if (atoms.length <= 1) continue

  // A) Any bond touching a separate cation is forbidden
  const bad = bonds.filter(([i, j]) => SEPARATE_CATIONS.has(atoms[i]?.symbol ?? '') || SEPARATE_CATIONS.has(atoms[j]?.symbol ?? ''))
  if (bad.length > 0) {
    badInterIon.push({
      id: c.id,
      formula: c.formulaUnicode,
      nameRu: c.nameRu,
      atomsLen: atoms.length,
      bondsLen: bonds.length,
      details: `badBonds=${JSON.stringify(bad.slice(0, 12))}`,
    })
  }

  // B) Polyatomic part must have internal sticks (ignore separated cations)
  const nonCatIdx = atoms.map((a, i) => (!SEPARATE_CATIONS.has(a.symbol) ? i : -1)).filter((i) => i >= 0)
  const bondsInternal = bonds.filter(([i, j]) => nonCatIdx.includes(i) && nonCatIdx.includes(j))
  if (nonCatIdx.length >= 3 && bondsInternal.length === 0) {
    missingInternal.push({
      id: c.id,
      formula: c.formulaUnicode,
      nameRu: c.nameRu,
      atomsLen: atoms.length,
      bondsLen: bonds.length,
      details: `nonCatSymbols=${nonCatIdx.slice(0, 10).map((i) => atoms[i]!.symbol).join(',')}`,
    })
  }

  // C) Visual overlap check (non-bonded too close)
  const bondSet = new Set(bonds.map(([i, j]) => bondKey(i, j)))
  let minAny = Infinity
  let minPair: [number, number] | null = null
  for (let i = 0; i < atoms.length; i++) {
    for (let j = i + 1; j < atoms.length; j++) {
      if (bondSet.has(bondKey(i, j))) continue // bonded can be closer; cylinder will show anyway
      const d = dist(atoms[i]!.pos, atoms[j]!.pos)
      if (d < minAny) {
        minAny = d
        minPair = [i, j]
      }
    }
  }
  if (Number.isFinite(minAny) && minAny < MIN_OK_DIST) {
    const [i, j] = minPair ?? [0, 1]
    overlapping.push({
      id: c.id,
      formula: c.formulaUnicode,
      nameRu: c.nameRu,
      atomsLen: atoms.length,
      bondsLen: bonds.length,
      details: `minNonBondedDist=${minAny.toFixed(3)} pair=${i}-${j} ${atoms[i]?.symbol}-${atoms[j]?.symbol}`,
    })
  }
}

badInterIon.sort((a, b) => a.id.localeCompare(b.id))
missingInternal.sort((a, b) => a.id.localeCompare(b.id))
overlapping.sort((a, b) => a.id.localeCompare(b.id))

console.log(`Forbidden inter-ion bonds (touching separate cations): ${badInterIon.length}`)
for (const r of badInterIon) console.log(`${r.id}\t${r.formula}\t${r.nameRu}\t${r.details}`)

console.log('')
console.log(`Missing internal sticks in polyatomic part: ${missingInternal.length}`)
for (const r of missingInternal) console.log(`${r.id}\t${r.formula}\t${r.nameRu}\t${r.details}`)

console.log('')
console.log(`Visually overlapping / stuck (min non-bonded dist < ${MIN_OK_DIST.toFixed(3)}): ${overlapping.length}`)
for (const r of overlapping) console.log(`${r.id}\t${r.formula}\t${r.nameRu}\t${r.details}`)

