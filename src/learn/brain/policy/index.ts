/**
 * Браузерная политика ИИ-учителя (контракт «Локальный мозг» v1). Применяется ДО любого запроса
 * (правило владельца R1, модерация R2, светская беседа) и к любому ответу (R3 — ensureNoUnknown).
 * Сервер выполняет те же правила — двойная проверка допустима.
 */
import { detectQuestionLang, type PolicyLang } from './lang'
import { MODERATION_NOTICE, moderateText } from './moderation'
import { matchesOwnerRule, ownerRuleReply } from './ownerRule'
import { detectSmalltalk } from './smalltalk'

export { detectQuestionLang, foldForPolicy, type PolicyLang } from './lang'
export { MODERATION_NOTICE, moderateText, withModerationNotice, type ModerationResult } from './moderation'
export { matchesOwnerRule, ownerRuleReply, OWNER_RULE_TEXT } from './ownerRule'
export { detectSmalltalk, SMALLTALK_PATTERN_COUNT, type SmalltalkKind, type SmalltalkMatch } from './smalltalk'
export { ensureNoUnknown, hasUnknownPhrase, isReasonedLead, reasonFromBasics, type ReasonedOptions } from './noUnknown'

const BRIDGE: Record<PolicyLang, string> = {
  ru: 'Давай вернёмся к химии — какой у тебя вопрос?',
  en: 'Let us get back to chemistry — what is your question?',
  uz: 'Keling, kimyoga qaytamiz — savolingiz qanday?',
}

export type PolicyStep =
  /** Ответ готов без мозга/LLM (R1, светская беседа, одна грубость без вопроса). */
  | { kind: 'reply'; text: string; route: 'rule' | 'smalltalk' | 'moderation'; lang: PolicyLang; moderated: boolean }
  /** Продолжить маршрут с очищенным вопросом; `prefix` (R2 + пустая строка) — в начало ответа. */
  | { kind: 'continue'; text: string; prefix: string; lang: PolicyLang; moderated: boolean }

/** Политика для реплики ученика. `fallbackLang` — язык интерфейса (если язык реплики неясен). */
export function applyInputPolicy(text: string, fallbackLang: PolicyLang, seed?: number): PolicyStep {
  const src = (text ?? '').trim()
  const lang = detectQuestionLang(src, fallbackLang)
  if (matchesOwnerRule(src)) return { kind: 'reply', text: ownerRuleReply(), route: 'rule', lang, moderated: false }
  const mod = moderateText(src, fallbackLang)
  const cleaned = mod.flagged ? mod.cleaned : src
  const prefix = mod.flagged ? `${MODERATION_NOTICE[mod.lang]}\n\n` : ''
  if (mod.flagged && matchesOwnerRule(cleaned)) {
    return { kind: 'reply', text: `${prefix}${ownerRuleReply()}`, route: 'rule', lang: mod.lang, moderated: true }
  }
  if (mod.flagged && cleaned.replace(/[^\p{L}\p{N}]+/gu, '').length < 2) {
    return { kind: 'reply', text: `${prefix}${BRIDGE[mod.lang]}`, route: 'moderation', lang: mod.lang, moderated: true }
  }
  const small = detectSmalltalk(cleaned, { seed, fallbackLang: lang })
  if (small) return { kind: 'reply', text: `${prefix}${small.reply}`, route: 'smalltalk', lang: small.lang, moderated: mod.flagged }
  return { kind: 'continue', text: cleaned, prefix, lang: mod.flagged ? mod.lang : lang, moderated: mod.flagged }
}
