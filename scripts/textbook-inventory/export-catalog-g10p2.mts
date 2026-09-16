// Snapshot of catalog (compounds, organic molecules, school reaction bank) for textbook mapping.
import fs from 'node:fs'
import { compoundById } from '../../src/data/compounds'
import { ORGANIC_MOLECULES } from '../../src/data/organicLab/organicMoleculeRegistry'
import { SCHOOL_REACTION_BANK } from '../../src/chemistry/schoolReactionBank'
const compounds = Object.values(compoundById).map((c: any) => ({ id: c.id, formulaUnicode: c.formulaUnicode, nameRu: c.nameRu, category: c.category, composition: c.composition }))
const organic = ORGANIC_MOLECULES.map((m: any) => ({ id: m.id, formula: m.formula, nameRu: m.nameRu, classId: m.classId }))
const bank = SCHOOL_REACTION_BANK.map((r: any) => ({ id: r.id, equationRu: r.equationRu, reactants: r.reactants, compoundIds: r.compoundIds, grades: r.grades }))
fs.mkdirSync('.smoke/textbook-inventory', { recursive: true })
fs.writeFileSync('.smoke/textbook-inventory/catalog-snapshot-g10p2.json', JSON.stringify({ compounds, organic, bank }, null, 1))
console.log(compounds.length, organic.length, bank.length)
