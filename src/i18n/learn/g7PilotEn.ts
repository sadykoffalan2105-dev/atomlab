import { buildFullSectionSlides } from './g7PilotRu'

const sections: [string, string][] = [
  ['learn.g7.c1.s01', 'Chemistry as a science'],
  ['learn.g7.c1.s02', 'Matter and properties'],
  ['learn.g7.c1.s03', 'Lab safety'],
  ['learn.g7.c1.s04', 'Lab equipment'],
  ['learn.g7.c1.s05', 'Pure substances and mixtures'],
  ['learn.g7.c1.s06', 'Separating mixtures'],
  ['learn.g7.c1.s07', 'States of matter'],
  ['learn.g7.c1.s08', 'Physical vs chemical changes'],
  ['learn.g7.c1.s09', 'Chemistry in daily life'],
  ['learn.g7.c1.s10', 'Review: substances'],
  ['learn.g7.c2.s01', 'The atom'],
  ['learn.g7.c2.s02', 'Atomic structure'],
  ['learn.g7.c2.s03', 'Chemical element and symbol'],
  ['learn.g7.c2.s04', 'Relative atomic mass'],
  ['learn.g7.c2.s05', 'Isotopes'],
  ['learn.g7.c2.s06', 'Formula and valency'],
]

const built = Object.assign(
  {},
  ...sections.map(([prefix, topic]) =>
    buildFullSectionSlides(
      prefix,
      topic,
      `Explore ${topic.toLowerCase()} with the interactive 3D panel.`,
      `Quick check: ${topic}?`,
      ['Wrong', 'Correct definition', 'Only theory', 'None'],
      1,
      'Open the laboratory and try the topic in the reactor.',
    ),
  ),
)

export const learnG7PilotEn = built as Record<string, string>
