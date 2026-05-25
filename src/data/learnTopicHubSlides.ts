import type { MessageKey } from '../i18n/messagesRu'
import { compoundById } from './compounds'
import { LEARN_TOPIC_CORE_IDS, type LearnTopicCoreId, type LearnTopicHubSlide } from '../types/learn'

/** Три вещества на слайд хаба (реальные id каталога), по смыслу текста слайда. */
export const HUB_SLIDE_PREVIEW_COMPOUNDS: Record<LearnTopicCoreId, readonly [string, string, string]> = {
  periodicity: ['h2o', 'co2', 'nacl'],
  bond_types: ['h2o', 'nacl', 'hcl'],
  oxides_acidic: ['co2', 'so2', 'h2so4'],
  oxides_basic: ['cao', 'naoh', 'h2o'],
  oxides_amphoteric: ['al2o3', 'zno', 'h2so4'],
  acids_strong: ['h2so4', 'hcl', 'hno3'],
  acids_weak: ['h2co3', 'co2', 'h2o'],
  bases_alkali: ['naoh', 'koh', 'h2o'],
  salts_ionic: ['nacl', 'salt_nahco3', 'h2o'],
  salts_solubility: ['salt_nahco3', 'nacl', 'h2co3'],
  gases_nitrogen: ['no', 'no2', 'hno3'],
  gases_sulfur: ['so2', 'so3', 'h2so4'],
  halogens_intro: ['hcl', 'mno2', 'nacl'],
  metals_activity: ['cuo', 'zno', 'h2so4'],
  redox_intro: ['mno2', 'h2so4', 'nacl'],
  electrolysis_intro: ['nacl', 'h2o', 'naoh'],
  water_chemistry: ['h2o', 'nacl', 'h2co3'],
  qual_analysis: ['salt_k2cr2o7', 'h2so4', 'nacl'],
  industrial_touch: ['so3', 'so2', 'h2so4'],
  safety_lab: ['h2o', 'hcl', 'nacl'],
}

for (const topicId of LEARN_TOPIC_CORE_IDS) {
  for (const cid of HUB_SLIDE_PREVIEW_COMPOUNDS[topicId]) {
    if (!compoundById[cid]) {
      throw new Error(`learnTopicHubSlides: unknown preview compound "${cid}" for topic "${topicId}"`)
    }
  }
}

/** Три слайда хаба на тему; ключи i18n `learn.T.<topicId>.hub{n}_title|body`. */
export function buildHubSlides(topicId: LearnTopicCoreId): LearnTopicHubSlide[] {
  const previews = HUB_SLIDE_PREVIEW_COMPOUNDS[topicId]
  return ([0, 1, 2] as const).map((i) => ({
    titleKey: `learn.T.${topicId}.hub${i}_title` as MessageKey,
    bodyKey: `learn.T.${topicId}.hub${i}_body` as MessageKey,
    artId: topicId,
    previewCompoundId: previews[i]!,
  }))
}
