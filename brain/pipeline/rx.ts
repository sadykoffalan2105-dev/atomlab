/**
 * В JS «\b» знает только ASCII-буквы: для «привет\b» граница не находится. ub() заменяет \b на
 * Юникод-границу слова (буквы и цифры любых алфавитов) и включает флаг u.
 */
const UB = '(?:(?<![\\p{L}\\p{N}])(?=[\\p{L}\\p{N}])|(?<=[\\p{L}\\p{N}])(?![\\p{L}\\p{N}]))'

export function ub(re: RegExp): RegExp {
  const flags = re.flags.includes('u') ? re.flags : re.flags + 'u'
  return new RegExp(re.source.replace(/\\b/g, UB), flags)
}
