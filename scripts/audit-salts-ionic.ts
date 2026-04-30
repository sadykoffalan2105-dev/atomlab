import { compoundById } from '../src/data/compounds'

const SEPARATE_CATIONS = new Set(['Na', 'K', 'Li', 'Cs', 'Mg', 'Ca', 'Ba', 'Sr', 'Ag'])

type Row = { id: string; formula: string; nameRu: string; atomsLen: number; bondsLen: number; details: string }

const badInterIon: Row[] = []
const missingInternal: Row[] = []

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

  // B) If salt has 4+ atoms and zero bonds → likely missing internal polyatomic bonds
  if (atoms.length >= 4 && bonds.length === 0) {
    missingInternal.push({
      id: c.id,
      formula: c.formulaUnicode,
      nameRu: c.nameRu,
      atomsLen: atoms.length,
      bondsLen: bonds.length,
      details: `symbols=${atoms.slice(0, 10).map((a) => a.symbol).join(',')}`,
    })
  }
}

badInterIon.sort((a, b) => a.id.localeCompare(b.id))
missingInternal.sort((a, b) => a.id.localeCompare(b.id))

console.log(`Forbidden inter-ion bonds (touching Na/K/Li/Cs/Mg/Ca/Ba/Sr/Ag): ${badInterIon.length}`)
for (const r of badInterIon) console.log(`${r.id}\t${r.formula}\t${r.nameRu}\t${r.details}`)

console.log('')
console.log(`Likely missing internal bonds (atoms>=4 and bonds=0): ${missingInternal.length}`)
for (const r of missingInternal) console.log(`${r.id}\t${r.formula}\t${r.nameRu}\t${r.details}`)

