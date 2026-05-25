/** Редirect старых `/learn/:topicId` на новую иерархию классов. */
export const LEARN_LEGACY_TOPIC_REDIRECTS: Readonly<Record<string, string>> = {
  periodicity: '/learn/g/g8/c/c2/s/s05',
  bond_types: '/learn/g/g8/c/c3/s/s14',
  oxides_acidic: '/learn/g/g8/c/c1/s/s02',
  oxides_basic: '/learn/g/g8/c/c1/s/s03',
  oxides_amphoteric: '/learn/g/g9/c/c2/s/s08',
  acids_strong: '/learn/g/g8/c/c4/s/s27',
  acids_weak: '/learn/g/g8/c/c4/s/s28',
  bases_alkali: '/learn/g/g8/c/c1/s/s04',
  salts_ionic: '/learn/g/g8/c/c3/s/s16',
  salts_solubility: '/learn/g/g9/c/c4/s/s12',
  gases_nitrogen: '/learn/g/g8/c/c4/s/s29',
  gases_sulfur: '/learn/g/g8/c/c4/s/s30',
  halogens_intro: '/learn/g/g8/c/c4/s/s22',
  metals_activity: '/learn/g/g9/c/c1/s/s05',
  redox_intro: '/learn/g/g8/c/c3/s/s19',
  electrolysis_intro: '/learn/g/g9/c/c3/s/s10',
  water_chemistry: '/learn/g/g7/c/c4/s/s02',
  qual_analysis: '/learn/g/g9/c/c4/s/s15',
  industrial_touch: '/learn/g/g9/c/c5/s/s03',
  safety_lab: '/learn/g/g7/c/c1/s/s03',
}

export function legacyTopicRedirect(topicId: string): string | null {
  return LEARN_LEGACY_TOPIC_REDIRECTS[topicId] ?? null
}
