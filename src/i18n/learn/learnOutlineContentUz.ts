import { learnGradesOutlineUz } from './gradesOutlineUz'
import { buildFullSectionSlides } from './g7PilotSlideBuilder'

const G7_PILOT_PREFIXES = new Set([
  ...Array.from({ length: 10 }, (_, i) => `learn.g7.c1.s${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 6 }, (_, i) => `learn.g7.c2.s${String(i + 1).padStart(2, '0')}`),
])

function stripSectionTitle(title: string): string {
  return title.replace(/^§\d+\.\s*/, '')
}

export const learnOutlineContentUz: Record<string, string> = (() => {
  const out: Record<string, string> = {}
  for (const [key, title] of Object.entries(learnGradesOutlineUz)) {
    if (!key.endsWith('.title') || !/^learn\.g(7|8|9|10|11)\./.test(key)) continue
    const prefix = key.slice(0, -'.title'.length)
    if (G7_PILOT_PREFIXES.has(prefix)) continue
    const topic = stripSectionTitle(title)
    Object.assign(
      out,
      buildFullSectionSlides(
        'uz',
        prefix,
        topic,
        `${topic}: darslikdagi paragrafni o'qing va ATOMLAB 3D modeli bilan solishtiring.`,
        `«${topic}» mavzusiga qaysi gap mos keladi?`,
        ['Paragrafdagi ta\'rif', 'Aloqasiz tushuncha', 'Faqat biologiya', 'Faqat fizika'],
        0,
        `«${topic}» mavzusini ATOMLAB laboratoriyasi yoki masalalar bo'limida mustahkamlang.`,
        {
          bullets0: [
            `Paragraf: ${topic}`,
            'Qiziqarli fakt: kimyo hamma joyda — havadan ovqatgacha.',
            'Nazariyani 3D panel bilan bog\'lang',
            'Bitta ta\'rif va hayotdan bitta misol o\'rganing',
          ],
          callout0: 'Sinfdagi misollar muhokama qiling: atrofdagi aralashmalar va toza moddalar.',
          bullets3: [`Asosiy g'oya: ${topic}`, 'Asosiy atamalarni takrorlang', 'Quyida o\'zingizni tekshiring'],
        },
      ),
    )
  }
  return out
})()
