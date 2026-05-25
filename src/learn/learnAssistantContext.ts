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

/** @deprecated Use learnChatCore + buildAssistantSystemPrompt on server. */
export function buildSystemPrompt(ctx: LearnAssistantContextPayload): string {
  const lang = ctx.locale === 'en' ? 'English' : 'Russian'
  return `Chemistry tutor ATOMLAB. Answer in ${lang}. Any chemistry question allowed.
Lesson: ${ctx.gradeId} ${ctx.chapterId} §${ctx.section.kpNumber} — ${ctx.slideTitle}.
${ctx.slideBody.slice(0, 400)}`
}
