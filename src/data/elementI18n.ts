const GROUP: Record<string, string> = {
  nonmetal: 'Неметалл',
  'noble gas': 'Благородный газ',
  'alkali metal': 'Щелочной металл',
  'alkaline earth metal': 'Щёлочноземельный металл',
  metalloid: 'Металлоид (полуметалл)',
  halogen: 'Галоген',
  'post-transition metal': 'Постпереходный металл',
  'transition metal': 'Переходный металл',
  lanthanide: 'Лантаноид',
  actinide: 'Актинид',
  unknown: 'Не классифицировано',
}

const STATE: Record<string, string> = {
  gas: 'Газ (при н. у.)',
  solid: 'Твёрдое вещество (при н. у.)',
  liquid: 'Жидкость (при н. у.)',
  'expected to be a solid': 'Предположительно твёрдое тело (при н. у.)',
  'expected to be a gas': 'Предположительно газ (при н. у.)',
}

const GROUP_EN: Record<string, string> = {
  nonmetal: 'Nonmetal',
  'noble gas': 'Noble gas',
  'alkali metal': 'Alkali metal',
  'alkaline earth metal': 'Alkaline earth metal',
  metalloid: 'Metalloid',
  halogen: 'Halogen',
  'post-transition metal': 'Post-transition metal',
  'transition metal': 'Transition metal',
  lanthanide: 'Lanthanide',
  actinide: 'Actinide',
  unknown: 'Unknown / not classified',
}

const STATE_EN: Record<string, string> = {
  gas: 'Gas (s.t.p.)',
  solid: 'Solid (s.t.p.)',
  liquid: 'Liquid (s.t.p.)',
  'expected to be a solid': 'Expected solid (s.t.p.)',
  'expected to be a gas': 'Expected gas (s.t.p.)',
}

export function groupBlockLabelRu(groupBlockEn: string): string {
  const k = groupBlockEn.trim().toLowerCase()
  if (k in GROUP) return GROUP[k]!
  if (!k || k === '—') return '—'
  return groupBlockEn
}

export function groupBlockLabelEn(groupBlockEn: string): string {
  const k = groupBlockEn.trim().toLowerCase()
  if (k in GROUP_EN) return GROUP_EN[k]!
  if (!k || k === '—') return '—'
  return groupBlockEn
}

export function standardStateLabelRu(standardStateEn: string): string {
  const k = standardStateEn.trim().toLowerCase()
  if (k in STATE) return STATE[k]!
  if (!k || k === '—') return '—'
  return standardStateEn
}

export function standardStateLabelEn(standardStateEn: string): string {
  const k = standardStateEn.trim().toLowerCase()
  if (k in STATE_EN) return STATE_EN[k]!
  if (!k || k === '—') return '—'
  return standardStateEn
}
