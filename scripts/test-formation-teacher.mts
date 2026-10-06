/**
 * Проверка «учителя» «Как образуется» (src/chemistry/formationTeacher.ts) для всех 200 веществ каталога:
 * каждая фраза каждого этапа на RU / EN / UZ непустая, без «undefined» / «NaN» / «null»; в EN и UZ нет кириллицы
 * (UZ — латиница проекта: oʻ, gʻ); у каждого вещества есть ссылка на § и «особенность» на трёх языках; схемы перехода e⁻
 * совпадают с планом (заряд каждого иона металла = числу отданных e⁻, у анионов — принятых; отдано = принято); числа
 * в фразе этапа «Переход электронов» — из плана; этапы, которых учитель не знает, получают общую фразу по виду пути.
 *
 *   npx tsx scripts/test-formation-teacher.mts
 */
import { CATALOG_TOP200 } from '../src/data/catalog/catalogTop200.ts'
import { formationPlan, isMetal } from '../src/chemistry/formationPlan.ts'
import { formationScript } from '../src/chemistry/formationScripts.ts'
import { redoxDecomposition } from '../src/chemistry/formationRedoxDecomposition.ts'
import {
  FORMATION_TEACHER_STAGES,
  formationTeacherBoard,
  formationTeacherLines,
  formationTeacherRef,
  formationTeacherSpecial,
  routeKindLabel,
  transferSchemes,
  type TeacherLang,
} from '../src/chemistry/formationTeacher.ts'

const LANGS: TeacherLang[] = ['ru', 'en', 'uz']
const CYR = /[А-Яа-яЁё]/
const BAD = /undefined|NaN(?![A-Za-z₀-₉])|\bnull\b|\[object/
const errors: string[] = []
/** Формулы в тексте: Na₂SO₄, Cr₂O₇²⁻, H⁺, NaCl (латиница с индексами / зарядами или из ≥ 2 символов элементов). */
const formulasOf = (t: string) =>
  new Set((t.match(/(?<![A-Za-z])[A-Z][A-Za-z₀-₉⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻()·]*[₀-₉⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]|(?<![A-Za-z])(?:[A-Z][a-z]?){2,}[₀-₉]*/g) ?? []).filter((x) => /[₀-₉⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]|[A-Z].*[A-Z]/.test(x)))
/** Числа (104,5 = 104.5) — отсортированный список. */
const numbersOf = (t: string) => (t.replace(/(\d)[,.](\d)/g, '$1$2').match(/\d+/g) ?? []).sort().join(',')
const fail = (m: string) => errors.push(m)
let phrases = 0

for (const id of CATALOG_TOP200) {
  const s = formationScript(id)
  if (!s) {
    fail(`${id}: нет в formationScripts`)
    continue
  }
  const plan = formationPlan(id)
  for (const lang of LANGS) {
    for (const st of [...FORMATION_TEACHER_STAGES, 'route']) {
      const t = formationTeacherLines(id, st, lang)
      if (!t) {
        fail(`${id}/${st}/${lang}: null`)
        continue
      }
      for (const [k, v] of Object.entries(t)) {
        phrases++
        if (!v || !v.trim()) fail(`${id}/${st}/${lang}.${k}: пусто`)
        if (BAD.test(v)) fail(`${id}/${st}/${lang}.${k}: «${v}»`)
        if (lang !== 'ru' && CYR.test(v)) fail(`${id}/${st}/${lang}.${k}: кириллица — «${v.slice(0, 120)}»`)
      }
      if (!/Kimyo \d/.test(t.ref) || !/§/.test(t.ref)) fail(`${id}/${st}/${lang}: ref без § — «${t.ref}»`)
      // ref — отдельной строкой на доске, не в пояснении (без дублей)
      if (t.sub.includes(t.ref)) fail(`${id}/${st}/${lang}: ref продублирован в пояснении`)
    }
    const sp = formationTeacherSpecial(id, lang)
    if (!sp) fail(`${id}/${lang}: нет «особенности»`)
    else if (lang !== 'ru' && CYR.test(sp)) fail(`${id}/${lang}: «особенность» с кириллицей`)
    else if (lang !== 'ru') {
      // Полный перевод: не короче 60 % русского, те же формулы и числа.
      const ru = formationTeacherSpecial(id, 'ru')
      if (sp.length < 0.6 * ru.length) fail(`${id}/${lang}: «особенность» короче 60 % RU (${sp.length} / ${ru.length})`)
      const lost = [...formulasOf(ru)].filter((f) => !sp.includes(f))
      if (lost.length) fail(`${id}/${lang}: в «особенности» нет формул ${lost.join(', ')}`)
      if (numbersOf(sp) !== numbersOf(ru)) fail(`${id}/${lang}: числа «особенности» ${numbersOf(sp)} ≠ RU ${numbersOf(ru)}`)
    }
    if (!/§/.test(formationTeacherRef(id, lang))) fail(`${id}/${lang}: нет ref`)
    if (!routeKindLabel(id, lang)) fail(`${id}/${lang}: нет вида пути`)
    const board = formationTeacherBoard(id, lang)
    if (!board || !board.lattice) fail(`${id}/${lang}: нет доски / решётки`)
    if (lang !== 'ru' && board && CYR.test(JSON.stringify(board))) fail(`${id}/${lang}: доска с кириллицей`)
  }

  // Числа и заряды — из плана.
  const ionic = s.type === 'IB' || s.type === 'IC' || s.type === 'IH'
  if (!plan) {
    fail(`${id}: нет плана`)
    continue
  }
  const redox = redoxDecomposition(id)
  if (redox) {
    // ОВР-разложение: электроны отдаёт кислород исходного (2O → O₂ + 4e⁻), принимают Mn / Cu / N; никаких «Mn⁰ − ne⁻».
    for (const lang of LANGS) {
      const all = ['reagents', 'heat', 'break', 'transfer', 'release', 'lattice', 'final'].map((k) => formationTeacherLines(id, k, lang)!)
      const txt = all.map((x) => x.main + ' ' + x.sub).join(' ')
      if (/(Mn|Cu|N|K|Na)⁰/.test(txt)) fail(`${id}/${lang}: в ОВР-разложении нейтральный атом металла / азота`)
      const tr = formationTeacherLines(id, 'transfer', lang)!
      const li = lang === 'ru' ? 0 : lang === 'en' ? 1 : 2
      if (!tr.main.includes(redox.oxidation[li]!) || redox.reduction.some((r) => !tr.main.includes(r[li]!))) fail(`${id}/${lang}: в «Переносе e⁻» нет полуреакций`)
      if (!/4e⁻ = .*4e⁻/.test(tr.sub)) fail(`${id}/${lang}: в «Переносе e⁻» нет баланса 4e⁻ = 4e⁻`)
      if (!/O₂/.test(tr.sub) || !/2/.test(tr.sub)) fail(`${id}/${lang}: в «Переносе e⁻» нет «по 2 электрона → O₂»`)
      if (!/O=O/.test(formationTeacherLines(id, 'release', lang)!.sub)) fail(`${id}/${lang}: «Выделение O₂» без O=O`)
      if (!formationTeacherLines(id, 'reagents', lang)!.main.includes(redox.equation)) fail(`${id}/${lang}: «Исходное» без уравнения пути`)
      const lat = formationTeacherLines(id, 'lattice', lang)!.main
      for (const p of redox.products) if (!lat.includes(p.check)) fail(`${id}/${lang}: в «Решётке продукта» нет проверки ${p.check}`)
      const sch = transferSchemes(id, lang)
      if (!sch.includes(redox.oxidation[li]!) || !sch.some((x) => /4e⁻ = 4e⁻/.test(x))) fail(`${id}/${lang}: схемы доски не полуреакции ОВР`)
    }
    const given = 4
    const taken = redox.gains.reduce((n, g) => n + g.from - g.to, 0)
    if (given !== taken) fail(`${id}: отдано ${given} ≠ принято ${taken}`)
  } else if (ionic) {
    const schemes = transferSchemes(id, 'ru')
    const cats = plan.species.filter((x) => x.charge > 0 && x.kind === 'ion' && isMetal(Object.keys(x.comp)[0]!))
    const ans = plan.species.filter((x) => x.charge < 0)
    for (const c of cats) {
      const el = Object.keys(c.comp)[0]!
      const want = `${el}⁰ − ${c.charge}e⁻ → ${c.formula}`
      if (!schemes.includes(want)) fail(`${id}: нет схемы «${want}» (${schemes.join(' | ')})`)
    }
    for (const a of ans) {
      if (a.kind === 'ion' && !cats.length) {
        if (!schemes.includes(`H${Object.keys(a.comp)[0]!} → H⁺ + ${a.formula}`)) fail(`${id}: нет схемы H–X → H⁺ + ${a.formula}`)
      } else if (a.kind === 'ion') {
        const el = Object.keys(a.comp)[0]!
        const want = `${el}⁰ + ${-a.charge}e⁻ → ${a.formula}`
        if (!schemes.includes(want)) fail(`${id}: нет схемы «${want}»`)
      } else if (!schemes.some((x) => x.startsWith(a.formula.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]+$/, '') + ':') && x.includes(`${-a.charge}`))) fail(`${id}: нет схемы иона ${a.formula}`)
    }
    const given = cats.reduce((n, x) => n + x.charge * x.count, 0)
    const posAll = plan.species.filter((x) => x.charge > 0).reduce((n, x) => n + x.charge * x.count, 0)
    const negAll = ans.reduce((n, x) => n - x.charge * x.count, 0)
    if (posAll !== negAll) fail(`${id}: заряды не сходятся ${posAll} ≠ ${negAll}`)
    const m = /(?:отдано|given) (\d+) e⁻/.exec(formationTeacherLines(id, 'transfer', 'ru')!.sub + formationTeacherLines(id, 'transfer', 'en')!.sub)
    if (cats.length && (!m || Number(m[1]) !== given)) fail(`${id}: в фразе перехода не ${given} e⁻ («${m?.[0]}»)`)
    // число e⁻ из таблицы («переход n e⁻») = заряд катионов металла + NH₄⁺
    const tab = /переход (\d+) e⁻/.exec(s.particles)
    if (tab && Number(tab[1]) !== posAll) fail(`${id}: таблица «переход ${tab[1]} e⁻», план ${posAll}`)
  } else {
    if (transferSchemes(id, 'ru').length) fail(`${id}: у ковалентного вещества схемы перехода e⁻`)
    const v = formationTeacherLines(id, 'valence', 'ru')!.main
    for (const el of new Set(plan.species.flatMap((x) => Object.keys(x.comp)))) if (!v.includes(el)) fail(`${id}: в «валентных» нет ${el}`)
  }
  const d = formationTeacherLines(id, 'valence', 'en')!.sub
  if (!d.includes(s.dEN.toFixed(2))) fail(`${id}: ΔEN ${s.dEN} нет в фразе «${d.slice(-40)}»`)
}

if (errors.length) {
  console.error(`test-formation-teacher: ${errors.length} ошибок`)
  for (const e of errors.slice(0, 60)) console.error('  ' + e)
  process.exit(1)
}
console.log(`test-formation-teacher: OK — 200 веществ × ${FORMATION_TEACHER_STAGES.length + 1} этапов × 3 языка, ${phrases} строк`)
