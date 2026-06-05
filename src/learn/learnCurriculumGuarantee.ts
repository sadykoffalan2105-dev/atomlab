import { compoundById } from '../data/compounds'
import { LEARN_GRADES } from '../data/learnCurriculumUz'
import { learnGradePackRu } from '../i18n/learnGradePacks'
import { messagesRu } from '../i18n/messagesRu'
import { isKnownVisualId } from '../learn/learnVisualRegistry'
import type { LearnSlide } from '../types/learn'

const ruText = { ...messagesRu, ...learnGradePackRu } as Record<string, string>

export function validateLearnCurriculum(): string[] {
  const errors: string[] = []

  for (const grade of LEARN_GRADES) {
    for (const chapter of grade.chapters) {
      if (!compoundById[chapter.totemCompoundId]) {
        errors.push(`unknown totemCompoundId ${chapter.totemCompoundId} in ${grade.id}/${chapter.id}`)
      }
      for (const section of chapter.sections) {
        if (!(section.titleKey in ruText)) {
          errors.push(`missing i18n key ${section.titleKey}`)
        }
        for (const slide of section.slides) {
          if (slide.type === 'theory' || slide.type === 'example') {
            if (!(slide.titleKey in ruText)) errors.push(`missing ${slide.titleKey}`)
            if (!(slide.bodyKey in ruText)) errors.push(`missing ${slide.bodyKey}`)
          } else if (slide.type === 'interactive3d') {
            if (!(slide.captionKey in ruText)) errors.push(`missing ${slide.captionKey}`)
            if (!isKnownVisualId(slide.visualId)) errors.push(`unknown visual ${slide.visualId}`)
          } else if (slide.type === 'checkpoint') {
            if (!(slide.questionKey in ruText)) errors.push(`missing ${slide.questionKey}`)
            for (const ck of slide.choiceKeys) {
              if (!(ck in ruText)) errors.push(`missing ${ck}`)
            }
          } else if (slide.type === 'visual') {
            const v = slide as Extract<LearnSlide, { type: 'visual' }>
            if (!(v.titleKey in ruText)) errors.push(`missing ${v.titleKey}`)
            if (v.bodyKey && !(v.bodyKey in ruText)) errors.push(`missing ${v.bodyKey}`)
          } else if (slide.type === 'labInvite') {
            if (!(slide.bodyKey in ruText)) errors.push(`missing ${slide.bodyKey}`)
          }
          const vid = 'visualId' in slide ? slide.visualId : undefined
          if (vid && !isKnownVisualId(vid)) errors.push(`unknown visual ${vid}`)
        }
      }
    }
  }

  return errors
}
