/** Органика v2 · узбекские названия веществ для «Как образуется» (латиница, как в учебнике Kimyo). */
import type { SynthUiLang } from './synthesisUi'

/** частые тривиальные названия */
const UZ_COMMON: Readonly<Record<string, string>> = {
  'acetic acid': 'sirka kislota',
  'formic acid': 'chumoli kislota',
  'oxalic acid': 'oksalat kislota',
  'citric acid': 'limon kislota',
  'lactic acid': 'sut kislota',
  'benzoic acid': 'benzoy kislota',
  'stearic acid': 'stearin kislota',
  'palmitic acid': 'palmitin kislota',
  'oleic acid': 'olein kislota',
  glycerol: 'glitserin',
  glycerin: 'glitserin',
  glucose: 'glyukoza',
  fructose: 'fruktoza',
  sucrose: 'saxaroza',
  cellulose: 'sellyuloza',
  starch: 'kraxmal',
}

/**
 * Узбекское название по ИЮПАК-названию на английском — для веществ, у которых в реестре нет своего nameUz
 * (там стоит английское): ethane → etan, chloromethane → xlormetan, ethanoic acid → etan kislota.
 */
export function uzFromIupac(en: string): string {
  const low = en.trim().toLowerCase()
  if (UZ_COMMON[low]) return UZ_COMMON[low]
  let s = low
    .replace(/(\w+?)o?ic acid/g, '$1 kislota')
    .replace(/\bacid\b/g, 'kislota')
    .replace(/\balcohol\b/g, 'spirt')
    .replace(/\bether\b/g, 'efir')
    .replace(/fluoro/g, 'ftor')
    .replace(/chloro/g, 'chlor')
    .replace(/bromo/g, 'brom')
    .replace(/iodo/g, 'yod')
    .replace(/hydr/g, 'gidr')
    .replace(/hex/g, 'geks')
    .replace(/hept/g, 'gept')
    .replace(/x/g, 'ks')
    .replace(/ph/g, 'f')
    .replace(/th/g, 't')
    .replace(/ch/g, 'x')
    .replace(/qu/g, 'kv')
    .replace(/([aeiou])c(?=[eiy])/g, '$1ts')
    .replace(/c(?=[eiy])/g, 's')
    .replace(/c/g, 'k')
    .replace(/w/g, 'v')
    .replace(/([^aeiou])y/g, '$1i')
  // окончания -ane/-ene/-yne/-one/-ole/-ate/-ide/-ine: конечная e не пишется
  s = s.replace(/([^aeiou\s-])e\b/g, '$1')
  return s
}

/** название вещества реестра на языке интерфейса; узбекское — своё или транслитерация ИЮПАК (не русское) */
export function regName(reg: { readonly nameRu: string; readonly nameEn: string; readonly nameUz?: string }, lang: SynthUiLang): string {
  if (lang === 'en') return reg.nameEn
  if (lang === 'ru') return reg.nameRu
  const uz = reg.nameUz && reg.nameUz !== reg.nameEn ? reg.nameUz : ''
  return uz || uzFromIupac(reg.nameEn)
}
