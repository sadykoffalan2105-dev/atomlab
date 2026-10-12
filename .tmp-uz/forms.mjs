import fs from 'node:fs'
const f = new URL('../brain/persona/uzGlossary.ts', import.meta.url)
let s = fs.readFileSync(f, 'utf8')
const forms = {
  "ru: 'молярный объём', en: 'molar volume'": ['молярным объёмом'],
  "ru: 'p-электроны', en: 'p-electrons'": ['p электроны'],
  "ru: 's-орбиталь', en: 's-orbital'": ['s орбиталь'],
  "ru: 'f-элементы', en: 'f-elements'": ['f элементы'],
  "ru: 'винильный радикал', en: 'vinyl radical'": ['винильным радикалом'],
  "ru: 'фенильный радикал', en: 'phenyl radical'": ['фенильным радикалом'],
  "ru: 'изолированные диены', en: 'isolated dienes'": ['изолированными диенами'],
  "ru: 'бутадиен', en: 'butadiene'": ['бутадиеном'],
  "ru: 'дивинил', en: 'divinyl'": ['дивинилом'],
  "ru: 'сахар-сырец', en: 'raw sugar'": ['сахаром-сырцом'],
  "ru: 'молярный объём газов', en: 'molar volume of gases'": ['молярным объёмом газов'],
}
for (const [k, v] of Object.entries(forms)) {
  const from = `${k} },`
  if (!s.includes(from)) throw new Error('нет: ' + k)
  s = s.replace(from, `${k}, forms: [${v.map((x) => `'${x}'`).join(', ')}] },`)
}
const anchor = "  { uz: 'suyuqlanmalar elektrolizi', ru: 'электролиз расплавов', en: 'electrolysis of melts' },\n"
if (!s.includes(anchor)) throw new Error('нет якоря')
s = s.replace(
  anchor,
  anchor +
    "  { uz: 'mis birikmalari', ru: 'соединения меди', en: 'copper compounds' },\n" +
    "  { uz: 'mis guruhchasi elementlari', ru: 'элементы подгруппы меди', en: 'copper subgroup elements', forms: ['элементами подгруппы меди'] },\n" +
    "  { uz: 'vodorod atomining yadrosi', ru: 'ядро атома водорода', en: 'hydrogen nucleus' },\n",
)
fs.writeFileSync(f, s)
console.log('forms', (s.match(/forms: \[/g) ?? []).length)
