import { compoundById } from '../src/data/compounds'

const SEPARATE_CATIONS = new Set(['Na', 'K', 'Li', 'Cs', 'Mg', 'Ca', 'Ba', 'Sr'])
const ALWAYS_CATIONS = new Set(['Ag']) // treat as separate unless you decide otherwise later

const separate = new Set([...SEPARATE_CATIONS, ...ALWAYS_CATIONS])
const isSeparateCation = (sym: string) => separate.has(sym)

const transitionMetals = new Set(['Fe', 'Cu', 'Zn', 'Co', 'Ni', 'Mn', 'Cr', 'Al', 'Pb', 'Sn'])
const isTransitionLike = (sym: string) => transitionMetals.has(sym)

type BadCationBond = { id: string; formula: string; nameRu: string; cation: string; cationIdx: number; touched: [number, number][] }
type NoMetalBonds = { id: string; formula: string; nameRu: string; metal: string; metalIdx: number }

const badCationBonds: BadCationBond[] = []
const noMetalBonds: NoMetalBonds[] = []

for (const c of Object.values(compoundById)) {
  if (c.category !== 'salt') continue
  const atoms = c.atoms ?? []
  const bonds = c.bonds ?? []
  if (atoms.length <= 1) continue

  // Rule A: alkali/alkaline-earth (and Ag) should be separate (no bonds touching them)
  for (let i = 0; i < atoms.length; i++) {
    const sym = atoms[i]!.symbol
    if (!isSeparateCation(sym)) continue
    const touched = bonds.filter(([a, b]) => a === i || b === i)
    if (touched.length > 0) {
      badCationBonds.push({
        id: c.id,
        formula: c.formulaUnicode,
        nameRu: c.nameRu,
        cation: sym,
        cationIdx: i,
        touched: touched.slice(0, 12),
      })
    }
  }

  // Rule B: transition-like metals are allowed/expected to have some bonds
  for (let i = 0; i < atoms.length; i++) {
    const sym = atoms[i]!.symbol
    if (!isTransitionLike(sym)) continue
    const deg = bonds.reduce((acc, [a, b]) => acc + (a === i || b === i ? 1 : 0), 0)
    if (deg === 0) {
      noMetalBonds.push({ id: c.id, formula: c.formulaUnicode, nameRu: c.nameRu, metal: sym, metalIdx: i })
    }
  }
}

badCationBonds.sort((a, b) => a.id.localeCompare(b.id) || a.cation.localeCompare(b.cation))
noMetalBonds.sort((a, b) => a.id.localeCompare(b.id) || a.metal.localeCompare(b.metal))

console.log(`Bad cation bonds (should be separate): ${badCationBonds.length}`)
for (const r of badCationBonds) {
  console.log(`${r.id}\t${r.formula}\t${r.cation}@${r.cationIdx}\t${r.nameRu}\t${JSON.stringify(r.touched)}`)
}

console.log('')
console.log(`Transition-like metals with zero bonds: ${noMetalBonds.length}`)
for (const r of noMetalBonds) {
  console.log(`${r.id}\t${r.formula}\t${r.metal}@${r.metalIdx}\t${r.nameRu}`)
}

