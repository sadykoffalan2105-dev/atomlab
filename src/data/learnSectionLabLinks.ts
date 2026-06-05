import { learnSectionPathKey } from './learnFgosMatrix'

/** Deep-link в лабораторию: реактор + продукт из каталога (если есть). */
export type LearnLabDeepLink = {
  openReactor: boolean
  productCompoundId?: string
  catalogOnly?: boolean
}

const LAB_BY_SECTION: Readonly<Record<string, LearnLabDeepLink>> = {
  [learnSectionPathKey('g7', 'c1', 's05')]: { openReactor: true, productCompoundId: 'nacl' },
  [learnSectionPathKey('g7', 'c2', 's06')]: { openReactor: true, productCompoundId: 'h2o' },
  [learnSectionPathKey('g7', 'c3', 's03')]: { openReactor: true, productCompoundId: 'co2' },
  [learnSectionPathKey('g7', 'c4', 's02')]: { openReactor: false, catalogOnly: true, productCompoundId: 'h2o' },
  [learnSectionPathKey('g8', 'c1', 's03')]: { openReactor: true, productCompoundId: 'co2' },
  [learnSectionPathKey('g8', 'c1', 's04')]: { openReactor: true, productCompoundId: 'hcl' },
  [learnSectionPathKey('g8', 'c1', 's05')]: { openReactor: true, productCompoundId: 'nacl' },
  [learnSectionPathKey('g8', 'c5', 's04')]: { openReactor: true, productCompoundId: 'co2' },
  [learnSectionPathKey('g9', 'c1', 's04')]: { openReactor: true, productCompoundId: 'al2o3' },
  [learnSectionPathKey('g9', 'c3', 's10')]: { openReactor: true, productCompoundId: 'nacl' },
}

export function getLearnLabDeepLink(
  gradeId: string,
  chapterId: string,
  sectionId: string,
): LearnLabDeepLink {
  return (
    LAB_BY_SECTION[learnSectionPathKey(gradeId, chapterId, sectionId)] ?? {
      openReactor: true,
    }
  )
}

export function buildLabUrl(link: LearnLabDeepLink): string {
  const params = new URLSearchParams()
  if (link.openReactor) params.set('reactor', '1')
  if (link.productCompoundId) params.set('product', link.productCompoundId)
  if (link.catalogOnly) params.set('catalog', link.productCompoundId ?? '1')
  const q = params.toString()
  return q ? `/?${q}` : '/'
}
