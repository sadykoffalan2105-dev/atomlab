// Разбирает вещества учебников, которых нет в каталоге (отчёт build-whitelist.mts):
// проверка формулы (символы элементов, баланс степеней окисления), неорганика/органика, дедуп по составу.
// Пишет .smoke/textbook-inventory/missing-classified.json и печатает компактную таблицу.
import fs from 'node:fs'
import { parseComposition } from './formula.mts'

type U = { formula: string | null; nameRu: string | null; kind: string; grades: number[]; sections: number }
const rep = JSON.parse(fs.readFileSync('.smoke/textbook-inventory/whitelist-report.json', 'utf8')) as { unmapped: U[] }

const SYMBOLS = new Set(
  'H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U'.split(' '),
)
const OX: Record<string, number[]> = {
  H: [1, -1], O: [-2, -1], F: [-1], Cl: [-1, 1, 3, 4, 5, 7], Br: [-1, 1, 5], I: [-1, 1, 5, 7], S: [-2, 4, 6, 2], Se: [-2, 4, 6], Te: [-2, 4, 6],
  N: [-3, 3, 5, 1, 2, 4], P: [-3, 3, 5], As: [-3, 3, 5], Sb: [-3, 3, 5], Bi: [3, 5], C: [-4, -3, -2, -1, 0, 1, 2, 3, 4], Si: [4, -4], B: [3],
  Li: [1], Na: [1], K: [1], Rb: [1], Cs: [1], Be: [2], Mg: [2], Ca: [2], Sr: [2], Ba: [2], Ra: [2], Al: [3], Ga: [3], In: [3], Tl: [1, 3],
  Zn: [2], Cd: [2], Hg: [1, 2], Cu: [1, 2], Ag: [1], Au: [1, 3], Fe: [2, 3], Co: [2, 3], Ni: [2, 3], Mn: [2, 3, 4, 6, 7], Cr: [2, 3, 6],
  V: [2, 3, 4, 5], Ti: [2, 3, 4], W: [4, 6], Mo: [4, 6], Sn: [2, 4], Pb: [2, 4], Ge: [2, 4], Xe: [2, 4, 6], Pt: [2, 4], Zr: [4], U: [4, 6],
}
const MIXED_OK = new Set(['Fe3O4', 'Mn3O4', 'Pb3O4', 'KO2', 'NaO2', 'CsO2', 'RbO2', 'K2[Fe(CN)6]'])

function balanced(comp: Record<string, number>): boolean {
  const els = Object.keys(comp)
  if (els.length === 1) return true
  if (els.some((e) => !OX[e])) return false
  const rec = (i: number, sum: number): boolean => {
    if (i === els.length) return sum === 0
    const e = els[i]!
    return OX[e]!.some((s) => rec(i + 1, sum + s * comp[e]!))
  }
  return rec(0, 0)
}

const key = (c: Record<string, number>) =>
  Object.entries(c)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([e, n]) => `${e}${n}`)
    .join('')
const ORGANIC_EXCEPT = /^(CO|CO2|CS2|HCN|KCN|NaCN|SiC|CaC2|Al4C3|COCl2|CF4|CCl4)$/
const INORG_C_ANION = /(CO3|HCO3|C2O4|CN|SCN)/

type Row = { formula: string; nameRu: string; kind: string; grades: number[]; mentions: number; comp: Record<string, number>; group: string }
const byKey = new Map<string, Row>()
const rejected: string[] = []
for (const u of rep.unmapped) {
  if (!u.formula) continue
  const f = u.formula.replace(/\s+/g, '')
  if (/\^|[+-]$|[a-z]\d*$/.test(f) && !/[A-Z][a-z]\d*$/.test(f)) {
    rejected.push(`${f} (ion/general)`)
    continue
  }
  const comp = parseComposition(f)
  if (!comp || Object.keys(comp).some((e) => !SYMBOLS.has(e))) {
    rejected.push(`${f} (parse)`)
    continue
  }
  const els = Object.keys(comp)
  const isOrganic = els.includes('C') && els.includes('H') && !ORGANIC_EXCEPT.test(f) && !INORG_C_ANION.test(f.replace(/COO/g, ''))
  const organicPure = isOrganic && els.every((e) => ['C', 'H', 'O', 'N', 'Cl'].includes(e))
  let group: string
  if (els.length === 1) group = 'simple'
  else if (isOrganic) group = organicPure ? 'organic' : 'organic-salt'
  else group = balanced(comp) || MIXED_OK.has(f) ? 'inorganic' : 'inorganic-unbalanced'
  const k = key(comp)
  const prev = byKey.get(k)
  if (prev) {
    prev.mentions += u.sections
    for (const g of u.grades) if (!prev.grades.includes(g)) prev.grades.push(g)
    if ((!/[а-яё]/i.test(prev.nameRu) || /[А-Я][а-я]?\d/.test(prev.nameRu)) && u.nameRu && /[а-яё]{3}/i.test(u.nameRu)) prev.nameRu = u.nameRu
    continue
  }
  byKey.set(k, { formula: f, nameRu: u.nameRu ?? '', kind: u.kind, grades: [...u.grades], mentions: u.sections, comp, group })
}

const rows = [...byKey.values()].sort((a, b) => a.group.localeCompare(b.group) || b.mentions - a.mentions)
fs.writeFileSync('.smoke/textbook-inventory/missing-classified.json', JSON.stringify({ rows, rejected }, null, 1))
const counts: Record<string, number> = {}
for (const r of rows) counts[r.group] = (counts[r.group] ?? 0) + 1
console.log(counts, 'rejected', rejected.length)
const only = process.argv[2]
for (const r of rows) {
  if (only && r.group !== only) continue
  console.log(`${r.group[0]}|${r.formula}|${r.nameRu.slice(0, 40)}|${r.grades.join('')}|${r.mentions}`)
}
