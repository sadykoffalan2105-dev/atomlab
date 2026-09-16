// Dumps catalog (compounds, organic registry, school reaction bank) to scratch JSON for mapping (read-only).
import { writeFileSync, mkdirSync } from 'node:fs'
import { compoundById } from '../../src/data/compounds'
import { ORGANIC_MOLECULES } from '../../src/data/organicLab/organicMoleculeRegistry'
import { SCHOOL_REACTION_BANK } from '../../src/chemistry/schoolReactionBank'
const out = process.argv[2] ?? '.smoke/textbook-inventory/g7p2-catalog.json'
const compounds = Object.values(compoundById).map((c: any) => ({ id: c.id, formulaUnicode: c.formulaUnicode, nameRu: c.nameRu, category: c.category, composition: c.composition }))
const organic = ORGANIC_MOLECULES.map((m: any) => ({ id: m.id, formula: m.formula, nameRu: m.nameRu, classId: m.classId }))
const reactions = SCHOOL_REACTION_BANK.map((r: any) => ({ id: r.id, equationRu: r.equationRu, grades: r.grades, compoundIds: r.compoundIds, reactants: r.reactants, productId: r.productId }))
writeFileSync(out, JSON.stringify({ compounds, organic, reactions }, null, 1))
console.log(compounds.length, organic.length, reactions.length)
