/**
 * Russian Snowball stemmer (Porter-style, snowballstem.org "russian" algorithm).
 *
 * Embedded implementation without dependencies. Verified against the reference
 * `snowball-stemmers` package on the whole textbook vocabulary (scripts/kb/test-stemmer.mts).
 * Input must be lowercase; ё is folded to е.
 */

const VOWELS = 'аеиоуыэюя'

function isVowel(ch: string): boolean {
  return VOWELS.includes(ch)
}

type Group = { suffixes: string[]; needsAYa: boolean }

function sortGroups(groups: Group[]): { suffix: string; needsAYa: boolean }[] {
  const flat: { suffix: string; needsAYa: boolean }[] = []
  for (const g of groups) for (const s of g.suffixes) flat.push({ suffix: s, needsAYa: g.needsAYa })
  flat.sort((a, b) => b.suffix.length - a.suffix.length)
  return flat
}

const PERFECTIVE_GERUND = sortGroups([
  { suffixes: ['в', 'вши', 'вшись'], needsAYa: true },
  { suffixes: ['ив', 'ивши', 'ившись', 'ыв', 'ывши', 'ывшись'], needsAYa: false },
])

const ADJECTIVE = sortGroups([
  {
    suffixes: [
      'ее', 'ие', 'ые', 'ое', 'ими', 'ыми', 'ей', 'ий', 'ый', 'ой', 'ем', 'им', 'ым', 'ом',
      'его', 'ого', 'ему', 'ому', 'их', 'ых', 'ую', 'юю', 'ая', 'яя', 'ою', 'ею',
    ],
    needsAYa: false,
  },
])

const PARTICIPLE = sortGroups([
  { suffixes: ['ем', 'нн', 'вш', 'ющ', 'щ'], needsAYa: true },
  { suffixes: ['ивш', 'ывш', 'ующ'], needsAYa: false },
])

const REFLEXIVE = sortGroups([{ suffixes: ['ся', 'сь'], needsAYa: false }])

const VERB = sortGroups([
  {
    suffixes: ['ла', 'на', 'ете', 'йте', 'ли', 'й', 'л', 'ем', 'н', 'ло', 'но', 'ет', 'ют', 'ны', 'ть', 'ешь', 'нно'],
    needsAYa: true,
  },
  {
    suffixes: [
      'ила', 'ыла', 'ена', 'ейте', 'уйте', 'ите', 'или', 'ыли', 'ей', 'уй', 'ил', 'ыл', 'им', 'ым', 'ен',
      'ило', 'ыло', 'ено', 'ят', 'ует', 'уют', 'ит', 'ыт', 'ены', 'ить', 'ыть', 'ишь', 'ую', 'ю',
    ],
    needsAYa: false,
  },
])

const NOUN = sortGroups([
  {
    suffixes: [
      'а', 'ев', 'ов', 'ие', 'ье', 'е', 'иями', 'ями', 'ами', 'еи', 'ии', 'и', 'ией', 'ей', 'ой', 'ий', 'й',
      'иям', 'ям', 'ием', 'ем', 'ам', 'ом', 'о', 'у', 'ах', 'иях', 'ях', 'ы', 'ь', 'ию', 'ью', 'ю', 'ия',
      'ья', 'я',
    ],
    needsAYa: false,
  },
])

/**
 * Snowball `[substring] among (...)` in backward mode, limited to [limit, word.length).
 * Returns the new word (suffix removed) or null when nothing matched / the condition failed.
 * Like Snowball, only the longest matching suffix is considered (no fallback to shorter ones).
 */
function removeAmong(
  word: string,
  limit: number,
  table: { suffix: string; needsAYa: boolean }[],
): string | null {
  for (const { suffix, needsAYa } of table) {
    const start = word.length - suffix.length
    if (start < limit) continue
    if (!word.endsWith(suffix)) continue
    if (needsAYa) {
      const prev = start - 1
      if (prev < limit) return null
      const ch = word[prev]
      if (ch !== 'а' && ch !== 'я') return null
    }
    return word.slice(0, start)
  }
  return null
}

function regions(word: string): { pV: number; p2: number } {
  const n = word.length
  let pV = n
  let p2 = n
  let i = 0
  while (i < n && !isVowel(word[i])) i += 1
  if (i >= n) return { pV, p2 }
  pV = i + 1
  i = pV
  // R1: after the first non-vowel following a vowel
  while (i < n && isVowel(word[i])) i += 1
  if (i >= n) return { pV, p2 }
  i += 1
  // R2: repeat inside R1
  while (i < n && !isVowel(word[i])) i += 1
  if (i >= n) return { pV, p2 }
  i += 1
  while (i < n && isVowel(word[i])) i += 1
  if (i >= n) return { pV, p2 }
  p2 = i + 1
  return { pV, p2 }
}

const stemCache = new Map<string, string>()

export function stemRussian(input: string): string {
  const cached = stemCache.get(input)
  if (cached !== undefined) return cached
  let word = input.replace(/ё/g, 'е')
  const { pV, p2 } = regions(word)
  if (pV < word.length) {
    // Step 1
    const gerund = removeAmong(word, pV, PERFECTIVE_GERUND)
    if (gerund !== null) {
      word = gerund
    } else {
      const refl = removeAmong(word, pV, REFLEXIVE)
      if (refl !== null) word = refl
      const adj = removeAmong(word, pV, ADJECTIVE)
      if (adj !== null) {
        word = adj
        const part = removeAmong(word, pV, PARTICIPLE)
        if (part !== null) word = part
      } else {
        const verb = removeAmong(word, pV, VERB)
        if (verb !== null) word = verb
        else {
          const noun = removeAmong(word, pV, NOUN)
          if (noun !== null) word = noun
        }
      }
    }
    // Step 2
    if (word.length - 1 >= pV && word.endsWith('и')) word = word.slice(0, -1)
    // Step 3: derivational (R2)
    for (const suffix of ['ость', 'ост']) {
      const start = word.length - suffix.length
      if (start >= pV && start >= p2 && word.endsWith(suffix)) {
        word = word.slice(0, start)
        break
      }
    }
    // Step 4: tidy up
    const tidy = ['ейше', 'ейш', 'н', 'ь']
    for (const suffix of tidy) {
      const start = word.length - suffix.length
      if (start < pV || !word.endsWith(suffix)) continue
      if (suffix === 'ейше' || suffix === 'ейш') {
        word = word.slice(0, start)
        if (word.length - 2 >= pV && word.endsWith('нн')) word = word.slice(0, -1)
      } else if (suffix === 'н') {
        if (start - 1 >= pV && word[start - 1] === 'н') word = word.slice(0, -1)
      } else {
        word = word.slice(0, -1)
      }
      break
    }
  }
  if (stemCache.size > 50000) stemCache.clear()
  stemCache.set(input, word)
  return word
}
