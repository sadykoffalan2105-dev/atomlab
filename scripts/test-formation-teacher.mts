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
    }
    const sp = formationTeacherSpecial(id, lang)
    if (!sp) fail(`${id}/${lang}: нет «особенности»`)
    else if (lang !== 'ru' && CYR.test(sp)) fail(`${id}/${lang}: «особенность» с кириллицей`)
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
  if (ionic) {
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
