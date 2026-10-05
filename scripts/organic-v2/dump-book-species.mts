/**
 * Органика v2, шаг 1 (вспомогательный): разбор уравнений учебников 10–11 кл. тем же распознавателем, что у
 * реактора (pickOrganic: изомеры по структурной записи, подсказка страницы iso=). Результат — JSON для
 * scripts/organic-v2/build_reactions.py (RDKit). Общие схемы с R/Hal/Me подставляются конкретным примером.
 *
 * Run: npx tsx scripts/organic-v2/dump-book-species.mts <out.json>
 */
import fs from 'node:fs'
import { parseEquationText } from '../../src/chemistry/equationFormula.ts'
import { pickOrganic } from '../../src/data/labOrganicSpecies.ts'
import { isOrganicFormula, parseReactorLinkParams } from '../../src/lab/reactorDeepLink.ts'

type Rx = {
  id: string
  page: number | null
  equation: string
  equationAscii: string
  conditions: string | null
  type: string
  isGeneralScheme: boolean
  lab: { ok: boolean; href?: string; altHref?: string }
}
type Unit = { unitId: string; kp: string; chapterId: string; title: string; reactions: Rx[] }

/** Конкретный пример общей схемы: R → CH₃, R′ → C₂H₅, Hal/X → Cl, Me → Na. */
function concretize(ascii: string): string {
  return ascii
    .replace(/R[′'’]{2}/g, 'C3H7')
    .replace(/R[′'’]|R1|R2/g, 'C2H5')
    .replace(/Hal|(?<![A-Za-z])X(?![a-z])/g, 'Cl')
    .replace(/(?<![A-Za-z])Me(?![a-z])/g, 'Na')
    // жир C₃H₅(OCOR)₃ — R после O/C: пример — триацетин (R = CH₃)
    .replace(/(?<=OCO)R(?![a-z])/g, 'CH3')
    .replace(/(?<![A-Za-z])R(?![a-z])/g, 'CH3')
    .replace(/Ar(?![a-z])/g, 'C6H5')
}

const out: unknown[] = []
for (const grade of [10, 11]) {
  const book = JSON.parse(fs.readFileSync(`src/data/textbook/equations-g${grade}.json`, 'utf8')) as { units: Unit[] }
  for (const u of book.units) {
    for (const rx of u.reactions) {
      let hints: Record<number, string> = {}
      if (rx.lab.href) {
        const link = parseReactorLinkParams(new URLSearchParams(rx.lab.href.split('?')[1] ?? ''))
        if (link?.spec.isomers) hints = { ...link.spec.isomers }
      }
      let text = rx.equationAscii
      let generic = rx.isGeneralScheme
      let parsed = parseEquationText(text)
      const hasPlaceholder = /(?<![A-Za-z])(R|Hal|Me|X|Ar)(?![a-z])|R[′'’]/.test(text)
      if (hasPlaceholder) {
        generic = true
        text = concretize(text)
        parsed = parseEquationText(text)
      }
      const terms = parsed
        ? [
            ...parsed.reactants.map((s) => ({ s, side: 'L' as const })),
            ...parsed.products.map((s) => ({ s, side: 'R' as const })),
          ]
        : null
      const species = terms
        ? terms.map(({ s, side }, i) => {
            const organic = s.counts
              ? isOrganicFormula(s.formula, s.counts) ||
                ((s.counts.C ?? 0) > 0 && /COO|OOC/.test(s.formula) && !/CO3/.test(s.formula))
              : false
            const pick = s.counts && organic ? pickOrganic(s.formula, s.counts, hints[i]) : null
            return {
              formula: s.formula,
              coeff: s.coeff,
              side,
              counts: s.counts,
              organic,
              charge: s.charge,
              electron: s.electron,
              polymer: !!s.polymer,
              perUnit: !!s.perUnit,
              radical: !!s.radical,
              registryId: pick?.registryId ?? null,
              how: pick?.how ?? null,
              nameRu: pick?.nameRu ?? null,
              skeleton: pick && !pick.registryId ? pick.skeleton : null,
            }
          })
        : null
      out.push({
        grade,
        unitId: u.unitId,
        section: u.kp,
        chapterId: u.chapterId,
        id: rx.id,
        page: rx.page,
        equation: rx.equation,
        equationAscii: rx.equationAscii,
        concrete: text,
        conditions: rx.conditions ?? parsed?.conditions ?? null,
        dataType: rx.type,
        isGeneralScheme: rx.isGeneralScheme,
        generic,
        isScheme: parsed?.isScheme ?? true,
        isIonic: parsed?.isIonic ?? false,
        arrow: parsed?.arrow ?? null,
        species,
      })
    }
  }
}
fs.writeFileSync(process.argv[2] ?? 'book-species.json', JSON.stringify(out, null, 1))
console.log('reactions', out.length)
