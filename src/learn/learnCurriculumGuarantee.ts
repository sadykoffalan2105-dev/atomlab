import { compoundById } from '../data/compounds'
import { LEARN_GRADES } from '../data/learnCurriculumUz'
import { messagesRu } from '../i18n/messagesRu'
import { isKnownVisualId } from '../learn/learnVisualRegistry'

export function validateLearnCurriculum(): string[] {
  const errors: string[] = []

  for (const grade of LEARN_GRADES) {
    for (const chapter of grade.chapters) {
      if (!compoundById[chapter.totemCompoundId]) {
        errors.push(`unknown totemCompoundId ${chapter.totemCompoundId} in ${grade.id}/${chapter.id}`)
      }
      for (const section of chapter.sections) {
        if (!(section.titleKey in messagesRu)) {
          errors.push(`missing i18n key ${section.titleKey}`)
        }
        for (const slide of section.slides) {
          if (slide.type === 'theory' || slide.type === 'example') {
            if (!(slide.titleKey in messagesRu)) errors.push(`missing ${slide.titleKey}`)
            if (!(slide.bodyKey in messagesRu)) errors.push(`missing ${slide.bodyKey}`)
          } else if (slide.type === 'interactive3d') {
            if (!(slide.captionKey in messagesRu)) errors.push(`missing ${slide.captionKey}`)
            if (!isKnownVisualId(slide.visualId)) errors.push(`unknown visual ${slide.visualId}`)
          } else if (slide.type === 'checkpoint') {
            if (!(slide.questionKey in messagesRu)) errors.push(`missing ${slide.questionKey}`)
            for (const ck of slide.choiceKeys) {
              if (!(ck in messagesRu)) errors.push(`missing ${ck}`)
            }
          } else if (slide.type === 'labInvite') {
            if (!(slide.bodyKey in messagesRu)) errors.push(`missing ${slide.bodyKey}`)
          }
          const vid = 'visualId' in slide ? slide.visualId : undefined
          if (vid && !isKnownVisualId(vid)) errors.push(`unknown visual ${vid}`)
        }
      }
    }
  }

  return errors
}
