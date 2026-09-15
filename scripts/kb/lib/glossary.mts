/**
 * ru ↔ en ↔ uz terminology (+ formulas): hand-written core list (data/glossaryCore.mts, key terms and compound
 * classes), all 118 element names, catalog compounds, organic molecules and organic class names from app data.
 * Entries with the same Russian term and source are merged.
 */
import fs from 'node:fs'
import path from 'node:path'
import { GLOSSARY_CORE } from '../data/glossaryCore.mts'

export type GlossaryEntry = {
  ru: string
  en: string[]
  uz: string[]
  formula: string[]
  source: 'core' | 'element' | 'compound' | 'organic' | 'class'
}

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..')

const split = (s: string | undefined) =>
  (s ?? '')
    .split('|')
    .map((x) => x.trim())
    .filter(Boolean)

export async function buildGlossary(): Promise<GlossaryEntry[]> {
  const out: GlossaryEntry[] = []
  const byKey = new Map<string, GlossaryEntry>()
  const add = (e: GlossaryEntry) => {
    if (!e.ru?.trim()) return
    const key = `${e.source}|${e.ru.toLowerCase()}`
    const prev = byKey.get(key)
    if (prev) {
      for (const f of ['en', 'uz', 'formula'] as const) prev[f] = [...new Set([...prev[f], ...e[f]])]
      return
    }
    const entry = { ...e, en: [...new Set(e.en)], uz: [...new Set(e.uz)], formula: [...new Set(e.formula)] }
    byKey.set(key, entry)
    out.push(entry)
  }
  for (const [ru, en, uz, formula] of GLOSSARY_CORE) {
    add({ ru, en: split(en), uz: split(uz), formula: split(formula), source: 'core' })
  }
  const { ELEMENT_NAMES_RU } = await import('../../../src/data/elementNamesRu.ts')
  const { ELEMENT_NAMES_EN } = await import('../../../src/data/elementNamesEn.ts')
  const { ELEMENT_NAMES_UZ } = await import('../../../src/data/elementNamesUz.ts')
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/periodicTableRaw.json'), 'utf8')) as {
    atomicNumber: number
    symbol: string
  }[]
  for (const e of raw) {
    const i = e.atomicNumber - 1
    add({
      ru: ELEMENT_NAMES_RU[i],
      en: [ELEMENT_NAMES_EN[i]].filter(Boolean),
      uz: [ELEMENT_NAMES_UZ[i]].filter(Boolean),
      formula: [e.symbol],
      source: 'element',
    })
  }
  const { compoundById } = await import('../../../src/data/compounds.ts')
  const { resolveCompoundName } = await import('../../../src/i18n/compoundNameResolver.ts')
  for (const c of Object.values(compoundById)) {
    add({
      ru: c.nameRu,
      en: [resolveCompoundName(c.id, 'en') ?? ''].filter(Boolean),
      uz: [resolveCompoundName(c.id, 'uz') ?? ''].filter(Boolean),
      formula: [c.formulaUnicode],
      source: 'compound',
    })
  }
  const { ORGANIC_MOLECULES } = await import('../../../src/data/organicLab/organicMoleculeRegistry.ts')
  for (const m of ORGANIC_MOLECULES) {
    add({
      ru: m.nameRu,
      en: [m.nameEn].filter((x) => x && x !== m.nameRu),
      uz: [m.nameUz].filter((x) => x && x !== m.nameRu),
      formula: [m.formula],
      source: 'organic',
    })
  }
  const { ORGANIC_CLASS_LABELS } = await import('../../../src/data/researchLab/organicBuildCatalog.ts')
  for (const l of Object.values(ORGANIC_CLASS_LABELS)) {
    add({ ru: l.ru, en: [l.en], uz: [l.uz], formula: [], source: 'class' })
  }
  return out
}
