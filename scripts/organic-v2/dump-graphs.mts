/**
 * Органика v2, шаг 0: выгрузка ИСХОДНЫХ графов реестра (топология без раскладки) для RDKit.
 * Граф строится так же, как его строил старый реестр (набор атомов + скелет + водороды по валентности),
 * а не из готовых координат v2 — иначе конвейер зависел бы сам от себя.
 *   npx tsx scripts/organic-v2/dump-graphs.mts  →  .tmp/organic-v2/graphs-src.json
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { ORGANIC_BUILD_CHALLENGES } from '../../src/data/researchLab/organicBuildCatalog'
import { TEXTBOOK_ORGANIC_SPECS } from '../../src/data/organicLab/textbookOrganic.data'
import {
  applySkeletonBonds,
  autoBondKitHydrogens,
  createFormulaKit,
  type OrganicGraph,
} from '../../src/chemistry/organic/organicGraph'
import {
  fructoseOpenGraph,
  glucosePyranoseGraph,
  sucroseSimplifiedGraph,
} from '../../src/data/organicLab/geometries/carbGeometries'
import { triacetinGraph } from '../../src/data/organicLab/geometries/fatGeometries'
import { ORGANIC_MOLECULES } from '../../src/data/organicLab/organicMoleculeRegistry'

const topo = new Map<string, { g: OrganicGraph; src: string; stereo?: unknown }>()
for (const c of ORGANIC_BUILD_CHALLENGES) {
  const g = autoBondKitHydrogens(applySkeletonBonds(createFormulaKit(c.kit), c.skeleton))
  topo.set(c.id, { g, src: 'catalog', stereo: c.skeleton.stereo })
}
const extras: Record<string, () => OrganicGraph> = {
  'glucose-pyranose': glucosePyranoseGraph,
  fructose: fructoseOpenGraph,
  sucrose: sucroseSimplifiedGraph,
  triacetin: triacetinGraph,
}
for (const [id, f] of Object.entries(extras)) if (!topo.has(id)) topo.set(id, { g: f(), src: 'extra' })
for (const s of TEXTBOOK_ORGANIC_SPECS) {
  if (topo.has(s.id)) continue
  const g = autoBondKitHydrogens(applySkeletonBonds(createFormulaKit(s.kit), s.skeleton))
  topo.set(s.id, { g, src: 'textbook' })
}
const tbGrade = new Map(TEXTBOOK_ORGANIC_SPECS.map((s) => [s.id, s.grade]))

const out = ORGANIC_MOLECULES.map((m) => {
  const t = topo.get(m.id)
  if (!t) throw new Error(`нет исходного графа: ${m.id}`)
  return {
    id: m.id,
    formula: m.formula,
    nameRu: m.nameRu,
    classId: m.classId,
    src: t.src,
    textbookGrade: tbGrade.get(m.id) ?? null,
    stereo: t.stereo ?? null,
    atoms: t.g.atoms.map((a) => ({ id: a.id, el: a.element, v: a.valence ?? null })),
    bonds: t.g.bonds.map((b) => [b.a, b.b, b.order]),
  }
})
mkdirSync('.tmp/organic-v2', { recursive: true })
writeFileSync('.tmp/organic-v2/graphs-src.json', JSON.stringify(out))
console.log(out.length, 'графов → .tmp/organic-v2/graphs-src.json')
