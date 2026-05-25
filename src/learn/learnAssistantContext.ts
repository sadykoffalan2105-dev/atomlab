import type { LearnSection } from '../types/learn'
import type { AppLocale } from '../i18n/types'
import type { MessageKey } from '../i18n/messagesRu'

export type LearnAssistantContextPayload = {
  locale: AppLocale
  gradeId: string
  chapterId: string
  section: LearnSection
  slideIndex: number
  slideTitle: string
  slideBody: string
  mode: 'teacher' | 'helper'
}

export function buildLearnAssistantContext(input: {
  locale: AppLocale
  gradeId: string
  chapterId: string
  section: LearnSection
  slideIndex: number
  t: (key: MessageKey) => string
  mode: 'teacher' | 'helper'
}): LearnAssistantContextPayload {
  const slide = input.section.slides[input.slideIndex]
  let slideTitle = input.t(input.section.titleKey)
  let slideBody = ''

  if (slide) {
    if (slide.type === 'theory' || slide.type === 'example') {
      slideTitle = input.t(slide.titleKey)
      slideBody = input.t(slide.bodyKey)
    } else if (slide.type === 'interactive3d') {
      slideBody = input.t(slide.captionKey)
    } else if (slide.type === 'checkpoint') {
      slideTitle = input.t(slide.questionKey)
      slideBody = slide.choiceKeys.map((k) => input.t(k)).join('; ')
    } else if (slide.type === 'labInvite') {
      slideBody = input.t(slide.bodyKey)
    } else if (slide.type === 'practice') {
      slideBody = `practice:${slide.taskCategoryId}`
    }
  }

  return {
    locale: input.locale,
    gradeId: input.gradeId,
    chapterId: input.chapterId,
    section: input.section,
    slideIndex: input.slideIndex,
    slideTitle,
    slideBody,
    mode: input.mode,
  }
}

export function buildSystemPrompt(ctx: LearnAssistantContextPayload): string {
  const lang = ctx.locale === 'en' ? 'English' : 'Russian'
  return `You are a chemistry teacher for secondary school (grades 7-9).
Answer in ${lang}. Be accurate, concise, age-appropriate. Never invent formulas.
Current: grade ${ctx.gradeId}, chapter ${ctx.chapterId}, section §${ctx.section.kpNumber}.
Slide: ${ctx.slideTitle}. Content: ${ctx.slideBody.slice(0, 800)}.
Mode: ${ctx.mode === 'teacher' ? 'explain like a teacher' : 'give hints without full solution'}.
Refer to 3D models in ATOMLAB when helpful.`
}
