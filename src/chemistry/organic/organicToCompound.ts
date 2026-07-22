import type { CompoundDef } from '../../types/chemistry'
import { type OrganicGraph, toCompoundPreview } from './organicGraph'

/** Минимальный CompoundDef для MoleculeMesh / превью. */
export function organicGraphToCompoundDef(
  graph: OrganicGraph,
  id = 'organic-builder',
  accent = '#34d399',
): CompoundDef {
  const preview = toCompoundPreview(graph, id)
  return {
    id: preview.id,
    nameRu: 'Органика',
    formulaUnicode: Object.entries(preview.composition)
      .map(([el, n]) => el + (n > 1 ? String(n) : ''))
      .join(''),
    composition: preview.composition,
    atoms: preview.atoms,
    bonds: preview.bonds,
    accentColor: accent,
    descriptionRu: '',
    laboratoryRecipeRu: '',
    obtainingStepsRu: [],
    category: 'other',
    synthesisConditionsRu: {},
  }
}
