import { compoundById } from '../src/data/compounds'

type Row = { id: string; atomsLen: number; bondsLen: number; formula: string; nameRu: string }

const rows: Row[] = []
for (const c of Object.values(compoundById)) {
  if (c.category !== 'salt') continue
  const atomsLen = c.atoms?.length ?? 0
  const bondsLen = c.bonds?.length ?? 0
  if (atomsLen > 1 && bondsLen === 0) {
    rows.push({ id: c.id, atomsLen, bondsLen, formula: c.formulaUnicode, nameRu: c.nameRu })
  }
}

rows.sort((a, b) => a.id.localeCompare(b.id))

console.log(`Salts with atoms>1 and bonds=0: ${rows.length}`)
for (const r of rows) {
  console.log(`${r.id}\t${r.formula}\t${r.atomsLen} atoms\t${r.nameRu}`)
}

