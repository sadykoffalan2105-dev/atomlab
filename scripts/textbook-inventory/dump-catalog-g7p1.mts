/**
 * Read-only dump of catalog data (compounds, organic molecules, school reactions)
 * used by the textbook inventory mapper. Output path is given as argv[2].
 * Run: npx tsx scripts/textbook-inventory/dump-catalog-g7p1.mts <out.json>
 */
import { writeFileSync } from 'node:fs'
import { compoundById } from '../../src/data/compounds'
import { ORGANIC_MOLECULES } from '../../src/data/organicLab/organicMoleculeRegistry'
import { SCHOOL_REACTION_BANK } from '../../src/chemistry/schoolReactionBank'

const out = process.argv[2] ?? 'catalog-dump.json'
const compounds = Object.values(compoundById).map((c: any) => ({
  id: c.id,
  formulaUnicode: c.formulaUnicode,
  nameRu: c.nameRu,
  category: c.category,
  composition: c.composition,
}))
const organic = ORGANIC_MOLECULES.map((m: any) => ({ id: m.id, formula: m.formula, nameRu: m.nameRu }))
const reactions = SCHOOL_REACTION_BANK.map((r: any) => ({
  id: r.id,
  equationRu: r.equationRu,
  grades: r.grades,
  reactants: r.reactants,
  compoundIds: r.compoundIds,
}))
writeFileSync(out, JSON.stringify({ compounds, organic, reactions }, null, 1), 'utf8')
console.log('compounds', compounds.length, 'organic', organic.length, 'reactions', reactions.length)
