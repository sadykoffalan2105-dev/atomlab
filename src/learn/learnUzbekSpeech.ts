/** Подготовка узбекского (lotin) текста для TTS — SardorNeural. */

const UZ_CHEM_TERMS: Record<string, string> = {
  Kimyo: 'Kimyo',
  kimyo: 'kimyo',
  ATOMLAB: 'Atomlab',
  pH: 'pé aş',
  NaCl: 'natriy xlorid',
  H2O: 'suv',
  CO2: 'karbonat angidrid',
  O2: 'kislorod',
  H2: 'vodorod',
  N2: 'azot',
  Cl2: 'xlor',
  H2SO4: 'kukurt kislotasi',
  HCl: 'xlor vodorod',
  NaOH: 'natriy gidroksid',
  Fe: 'temir',
  Cu: 'mis',
  Zn: 'rux',
  Ag: 'kumush',
  Au: 'oltin',
  Ca: 'kalsiy',
  K: 'kaliy',
  Na: 'natriy',
  Mg: 'magniy',
  Al: 'alyuminiy',
  PDF: 'pí dí ef',
}

const SORTED_UZ = Object.keys(UZ_CHEM_TERMS).sort((a, b) => b.length - a.length)

export function applyUzbekSpeechLexicon(text: string): string {
  let out = text
  for (const key of SORTED_UZ) {
    const spoken = UZ_CHEM_TERMS[key]!
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`(?<![\\p{L}\\d])${escaped}(?![\\p{L}\\d])`, 'gu')
    out = out.replace(re, spoken)
  }
  return out
}

export function sanitizeUzbekTtsSurface(text: string): string {
  return text
    .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '')
    .replace(/[''`]/g, 'ʻ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}
