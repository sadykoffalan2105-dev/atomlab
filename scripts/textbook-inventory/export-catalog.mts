/** Export catalog formulas (inorganic compounds, organic molecules, school reaction bank) to JSON for inventory mapping. */
import fs from 'node:fs'
const out = process.argv[2]
const { compoundById } = await import('../../src/data/compounds.ts')
const { ORGANIC_MOLECULES } = await import('../../src/data/organicLab/organicMoleculeRegistry.ts')
const { SCHOOL_REACTION_BANK } = await import('../../src/chemistry/schoolReactionBank.ts')
const compounds = Object.values(compoundById).map((c: any) => ({ id: c.id, formulaUnicode: c.formulaUnicode, nameRu: c.nameRu, category: c.category, composition: c.composition }))
const organics = ORGANIC_MOLECULES.map((m: any) => ({ id: m.id, formula: m.formula, nameRu: m.nameRu }))
const reactions = SCHOOL_REACTION_BANK.map((r: any) => ({ id: r.id, equationRu: r.equationRu, reactants: r.reactants, grades: r.grades }))
fs.writeFileSync(out, JSON.stringify({ compounds, organics, reactions }, null, 1))
console.log(compounds.length, organics.length, reactions.length)
