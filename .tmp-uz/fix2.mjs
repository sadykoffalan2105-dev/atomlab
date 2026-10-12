import fs from 'node:fs'
const f = new URL('../brain/persona/uzGlossary.ts', import.meta.url)
let s = fs.readFileSync(f, 'utf8')
const rep = (a, b) => {
  if (!s.includes(a)) throw new Error('нет: ' + a)
  s = s.replace(a, b)
}
// p/s/f: русский термин с пробелом — его стемы «p электрон» (дефис отрезает букву, ключ «электрон»/«элемент» заняли бы чужие термины)
rep("  { uz: 'p-elektronlar', ru: 'p-электроны', en: 'p-electrons', forms: ['p электроны'] },\n", "  { uz: 'p-elektronlar', ru: 'p электроны', en: 'p-electrons' },\n")
rep("  { uz: 's-orbital', ru: 's-орбиталь', en: 's-orbital', forms: ['s орбиталь'] },\n", "  { uz: 's-orbital', ru: 's орбиталь', en: 's-orbital' },\n")
rep("  { uz: 'f-elementlar', ru: 'f-элементы', en: 'f-elements', forms: ['f элементы'] },\n", '')
rep("  { uz: 'elektrolit', ru: 'электролит', en: 'electrolyte' },", "  { uz: 'elektrolit', ru: 'электролит', en: 'electrolyte', forms: ['электролитами'] },")
const anchor = "  { uz: 'suyuqlanmalar elektrolizi', ru: 'электролиз расплавов', en: 'electrolysis of melts' },\n"
rep(
  anchor,
  anchor +
    '  // неверные переводы терминов карты из глоссария базы (kb-glossary: «Ацетилен» → «Alkinlar», «Кетонами» → «Aldegidlar»,\n' +
    '  // «Крахмал» → «Uglevodlar»): этот словарь читается картой первым, так что точный перевод здесь их перекрывает\n' +
    "  { uz: 'bugʻlatish', ru: 'выпаривание', en: 'evaporation' },\n" +
    "  { uz: 'metan', ru: 'метан', en: 'methane' },\n" +
    "  { uz: 'etilen', ru: 'этилен', en: 'ethylene' },\n" +
    "  { uz: 'atsetilen', ru: 'ацетилен', en: 'acetylene' },\n" +
    "  { uz: 'benzol', ru: 'бензол', en: 'benzene' },\n" +
    "  { uz: 'kraxmal', ru: 'крахмал', en: 'starch' },\n" +
    "  { uz: 'kreking', ru: 'крекинг', en: 'cracking' },\n" +
    "  { uz: 'polimerlanish', ru: 'полимеризация', en: 'polymerization' },\n" +
    "  { uz: 'ketonlar', ru: 'кетоны', en: 'ketones' },\n" +
    "  { uz: 'toʻyingan uglevodorodlar', ru: 'предельные углеводороды', en: 'saturated hydrocarbons' },\n" +
    "  { uz: 'gomologik qator', ru: 'гомологический ряд', en: 'homologous series' },\n" +
    "  { uz: 'yadro reaksiyalari', ru: 'ядерные реакции', en: 'nuclear reactions' },\n" +
    "  { uz: 'fermentlar', ru: 'ферменты', en: 'enzymes' },\n" +
    "  { uz: 'noelektrolitlar', ru: 'неэлектролиты', en: 'non-electrolytes' },\n" +
    "  { uz: 'izomerlar', ru: 'изомеры', en: 'isomers' },\n" +
    "  { uz: 'elektron qobiq', ru: 'электронная оболочка', en: 'electron shell' },\n" +
    "  { uz: 'eritma konsentratsiyasi', ru: 'концентрация раствора', en: 'solution concentration' },\n",
)
rep("'бутадиен', 'дивинил', 'фенилметанол'])", "'бутадиен', 'дивинил', 'фенилметанол', 'метан', 'этилен', 'ацетилен', 'бензол', 'крахмал'])")
fs.writeFileSync(f, s)
console.log('ok')
