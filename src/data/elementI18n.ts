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

export function groupBlockLabelRu(groupBlockEn: string): string {
  const k = groupBlockEn.trim().toLowerCase()
  if (k in GROUP) return GROUP[k]!
  if (!k || k === '—') return '—'
  return groupBlockEn
}

export function standardStateLabelRu(standardStateEn: string): string {
  const k = standardStateEn.trim().toLowerCase()
  if (k in STATE) return STATE[k]!
  if (!k || k === '—') return '—'
  return standardStateEn
}
