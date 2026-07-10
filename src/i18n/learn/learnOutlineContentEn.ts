import { learnGradesOutlineEn } from './gradesOutlineEn'
import { buildFullSectionSlides } from './g7PilotSlideBuilder'

const G7_PILOT_PREFIXES = new Set([
  ...Array.from({ length: 10 }, (_, i) => `learn.g7.c1.s${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 6 }, (_, i) => `learn.g7.c2.s${String(i + 1).padStart(2, '0')}`),
])

function stripSectionTitle(title: string): string {
  return title.replace(/^§\d+\.\s*/, '')
}

export const learnOutlineContentEn: Record<string, string> = (() => {
  const out: Record<string, string> = {}
  for (const [key, title] of Object.entries(learnGradesOutlineEn)) {
    if (!key.endsWith('.title') || !/^learn\.g(7|8|9|10|11)\./.test(key)) continue
    const prefix = key.slice(0, -'.title'.length)
    if (G7_PILOT_PREFIXES.has(prefix)) continue
    const topic = stripSectionTitle(title)
    Object.assign(
      out,
      buildFullSectionSlides(
        'en',
        prefix,
        topic,
        `${topic}: study the textbook section and compare with the ATOMLAB 3D model.`,
        `Which statement fits “${topic}”?`,
        ['Definition from the section', 'Unrelated concept', 'Biology only', 'Physics only'],
        0,
        `Practice “${topic}” in the ATOMLAB lab or task hub.`,
        {
          bullets0: [
            `Section: ${topic}`,
            `Fun fact: chemistry is everywhere — from air to food.`,
            'Match theory with the 3D panel',
            'Learn one definition and one real-life example',
          ],
          callout0: 'Discuss classroom examples: mixtures around you vs pure substances.',
          bullets3: [`Key idea: ${topic}`, 'Review key terms', 'Check yourself below'],
        },
      ),
    )
  }
  return out
})()
