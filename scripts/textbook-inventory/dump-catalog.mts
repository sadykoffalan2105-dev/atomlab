// Dumps catalog (compounds, organic molecules, school reactions) to a JSON cache for inventory mapping. Read-only for repo sources.
import { writeFileSync, mkdirSync } from 'node:fs'
import { compoundById } from '../../src/data/compounds'
import { ORGANIC_MOLECULES } from '../../src/data/organicLab/organicMoleculeRegistry'
import { SCHOOL_REACTION_BANK } from '../../src/chemistry/schoolReactionBank'

const compounds = Object.values(compoundById).map((c: any) => ({
  id: c.id, formulaUnicode: c.formulaUnicode, nameRu: c.nameRu, category: c.category, composition: c.composition,
}))
const organic = ORGANIC_MOLECULES.map((m: any) => ({ id: m.id, formula: m.formula, nameRu: m.nameRu }))
const reactions = SCHOOL_REACTION_BANK.map((r: any) => ({ id: r.id, equationRu: r.equationRu, grades: r.grades, compoundIds: r.compoundIds, reactants: r.reactants }))
mkdirSync(new URL('./.cache/', import.meta.url), { recursive: true })
writeFileSync(new URL('./.cache/catalog.json', import.meta.url), JSON.stringify({ compounds, organic, reactions }, null, 1))
console.log('compounds', compounds.length, 'organic', organic.length, 'reactions', reactions.length)
