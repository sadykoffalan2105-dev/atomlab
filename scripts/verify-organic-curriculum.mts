/**
 * Проверка учебной программы органической лаборатории (без UI).
 * Запуск: npx tsx scripts/verify-organic-curriculum.mts
 */
import {
  ORGANIC_CURRICULUM,
  equationsForLesson,
  lessonHasBuild,
  lessonHasEquation,
  resolveOrganicLessonFromLearn,
} from '../src/data/organicLab/organicCurriculum.ts'
import { organicMoleculeById } from '../src/data/organicLab/organicMoleculeRegistry.ts'
import {
  challengeBuildStage,
  ORGANIC_BUILD_CHALLENGES,
} from '../src/data/researchLab/organicBuildCatalog.ts'
import {
  isLessonComplete,
  markLessonProgress,
  getLessonProgress,
  loadOrganicCurriculumProgress,
  loadProgressV2,
  markModeDone,
  isLessonDoneV2,
} from '../src/data/organicLab/organicCurriculumProgress.ts'
import {
  LESSON_EXTRA_MOLECULES,
  lessonConstructorTasks,
  lessonIsomerSets,
  lessonModesV2,
  lessonMoleculeIds,
  lessonReactionIds,
} from '../src/data/organicLab/organicLessonsV2.ts'
import { parseModeParam, reactionIdFromSrc, resolveOrganicUrl } from '../src/components/organicV2/shell/organicUrl.ts'
import type { OV2Molecule, OV2ReactionsFile } from '../src/data/organicV2/types.ts'
import v2Mols from '../src/data/organicV2/molecules.json' with { type: 'json' }
import v2Rx from '../src/data/organicV2/reactions.json' with { type: 'json' }
import g10Book from '../src/data/textbook/equations-g10.json' with { type: 'json' }
import g11Book from '../src/data/textbook/equations-g11.json' with { type: 'json' }

const store = new Map<string, string>()
;(globalThis as { localStorage?: Storage }).localStorage = {
  getItem: (k) => store.get(k) ?? null,
  setItem: (k, v) => {
    store.set(k, String(v))
  },
  removeItem: (k) => {
    store.delete(k)
  },
  clear: () => store.clear(),
  key: () => null,
  length: 0,
}

const errors: string[] = []
const warn = (m: string) => console.warn('WARN', m)
const fail = (m: string) => {
  errors.push(m)
  console.error('FAIL', m)
}

const buildable = new Set(
  ORGANIC_BUILD_CHALLENGES.filter((c) => challengeBuildStage(c) !== 'cage').map((c) => c.id),
)

console.log('lessons', ORGANIC_CURRICULUM.length)
if (ORGANIC_CURRICULUM.length < 12 || ORGANIC_CURRICULUM.length > 30) {
  fail(`expected ~12–18 lessons, got ${ORGANIC_CURRICULUM.length}`)
}

const orderIds = ORGANIC_CURRICULUM.map((l) => l.id)
const alkaneIdx = orderIds.indexOf('alkanes')
const alcoholIdx = orderIds.indexOf('alcohols')
if (alkaneIdx < 0 || alcoholIdx < 0 || alkaneIdx >= alcoholIdx) {
  fail('path order: alkanes must appear before alcohols')
}

for (const lesson of ORGANIC_CURRICULUM) {
  if (!lesson.goalEn || lesson.goalEn === lesson.goalRu) {
    // allow only if intentional RU==EN (rare); warn if Uz also missing
  }
  if (!lesson.goalEn?.trim()) fail(`${lesson.id}: missing goalEn`)
  if (!lesson.goalUz?.trim()) fail(`${lesson.id}: missing goalUz`)

  for (const id of lesson.challengeIds) {
    if (!organicMoleculeById[id]) fail(`${lesson.id}: missing molecule ${id}`)
  }
  if (!organicMoleculeById[lesson.defaultMolId]) {
    fail(`${lesson.id}: defaultMolId missing ${lesson.defaultMolId}`)
  }

  const eqs = equationsForLesson(lesson)
  if (lesson.equationIds.length > 0 && eqs.length !== lesson.equationIds.length) {
    const found = new Set(eqs.map((e) => e.id))
    for (const id of lesson.equationIds) {
      if (!found.has(id)) fail(`${lesson.id}: unknown equation ${id}`)
    }
  }

  if (lessonHasBuild(lesson)) {
    const ok = lesson.challengeIds.some((id) => buildable.has(id))
    if (!ok) warn(`${lesson.id}: hasBuild but no non-cage challenge in catalog`)
  }
}

const alkanes = resolveOrganicLessonFromLearn(2, 1)
const alcohols = resolveOrganicLessonFromLearn(3, 1)
const cyclo = resolveOrganicLessonFromLearn(2, 5)
console.log('resolve ch2 s1 →', alkanes.id)
console.log('resolve ch2 s5 →', cyclo.id)
console.log('resolve ch3 s1 →', alcohols.id)
if (alkanes.id !== 'alkanes') fail(`expected alkanes, got ${alkanes.id}`)
if (alcohols.id !== 'alcohols') fail(`expected alcohols, got ${alcohols.id}`)
if (cyclo.id !== 'cycloalkanes') fail(`expected cycloalkanes, got ${cyclo.id}`)

const alk = ORGANIC_CURRICULUM.find((l) => l.id === 'alkanes')!
if (!lessonHasBuild(alk) || !lessonHasEquation(alk)) {
  fail('alkanes must support build + equation')
}
if (!alk.challengeIds.includes('methane') || !alk.challengeIds.includes('ethane')) {
  fail('alkanes must include methane and ethane')
}

markLessonProgress('alkanes', { viewed: true, built: true, equation: true })
const map = loadOrganicCurriculumProgress()
const prog = getLessonProgress(map, 'alkanes')
if (!isLessonComplete(prog, { requireBuild: true, requireEquation: true })) {
  fail('progress complete check failed after mark')
}
// simulate reload
const map2 = loadOrganicCurriculumProgress()
if (!getLessonProgress(map2, 'alkanes').built) fail('progress did not persist across reload')

console.log('alkanes eq count', equationsForLesson(alk).length)

/* ── Органика v2 ─────────────────────────────────────────────────── */
{
  const LESSON_IDS =
    'intro-structure isomers reaction-types nomenclature alkanes cycloalkanes alkenes alkadienes alkynes arenes halo ' +
    'sources-oil ch2-summary alcohols polyols phenols ethers aldehydes ketones acids esters fats carbohydrates ' +
    'disaccharides nitrogen industry-env'
  if (ORGANIC_CURRICULUM.map((l) => l.id).join(' ') !== LESSON_IDS) fail('v2: id/порядок 26 уроков изменились (на них 310 ссылок учебника)')

  const mols = v2Mols as unknown as Record<string, OV2Molecule>
  const rx = v2Rx as unknown as OV2ReactionsFile
  const rxIds = new Set(rx.reactions.map((r) => r.id))
  const covered = new Set(ORGANIC_CURRICULUM.flatMap((l) => lessonMoleculeIds(l)))
  const orphan = Object.keys(mols).filter((id) => !covered.has(id))
  if (orphan.length) fail(`v2: ${orphan.length} молекул ни в одном уроке: ${orphan.slice(0, 12).join(', ')}`)
  console.log('v2 molecules in lessons', covered.size, '/', Object.keys(mols).length)
  for (const id of Object.keys(mols)) if (!(rx.routes[id]?.length)) fail(`v2: у ${id} нет маршрута получения`)

  const formulaOf = (id: string) => mols[id]?.formula
  let tasks = 0
  for (const l of ORGANIC_CURRICULUM) {
    const ids = lessonMoleculeIds(l)
    if (ids.length < 4) fail(`v2: ${l.id}: мало молекул (${ids.length})`)
    for (const id of LESSON_EXTRA_MOLECULES[l.id] ?? []) if (!mols[id]) fail(`v2: ${l.id}: нет молекулы ${id}`)
    const sets = lessonIsomerSets(l, formulaOf)
    const modes = lessonModesV2(l, sets)
    for (const m of ['molecule', 'constructor', 'synthesis'] as const) if (!modes.includes(m)) fail(`v2: ${l.id}: нет режима ${m}`)
    if (l.isomerChallengeIds.length && !modes.includes('isomers')) fail(`v2: ${l.id}: были изомеры, режим пропал`)
    if (l.nomenclatureQuizId && !modes.includes('name')) fail(`v2: ${l.id}: пропал режим «Название»`)
    for (const s of sets) {
      if (Object.values(mols).filter((m) => m.formula === s.formula).length < 2) fail(`v2: ${l.id}: у ${s.formula} меньше 2 изомеров`)
      for (const e of s.expected) if (mols[e]?.formula !== s.formula) fail(`v2: ${l.id}: ${e} не ${s.formula}`)
    }
    const ct = lessonConstructorTasks(l, sets)
    tasks += ct.length
    if (!ct.some((t) => t.kind === 'build')) fail(`v2: ${l.id}: нет заданий «собери»`)
    for (const t of ct) if (t.kind === 'build' && !mols[t.targetId]) fail(`v2: ${l.id}: задание на ${t.targetId}`)
    const lr = lessonReactionIds(l)
    if (!lr.length) fail(`v2: ${l.id}: нет реакций`)
    for (const id of lr) if (!rxIds.has(id)) fail(`v2: ${l.id}: нет реакции ${id}`)
    console.log(`  ${l.id.padEnd(16)} mol ${String(ids.length).padStart(3)} · задания ${String(ct.length).padStart(3)} · изомеры ${sets.length} · реакции ${String(lr.length).padStart(2)} · ${modes.join('/')}`)
  }
  console.log('v2 constructor tasks', tasks)

  // 310 ссылок учебника → урок, режим «Реакции», нужная реакция
  let links = 0
  let exact = 0
  const walk = (o: unknown) => {
    if (!o || typeof o !== 'object') return
    for (const v of Object.values(o as Record<string, unknown>)) {
      if (typeof v === 'string' && v.startsWith('/organic?')) {
        links++
        const p = new URL('http://x' + v).searchParams
        const st = resolveOrganicUrl(p)
        if (st.lesson.id !== p.get('lesson')) fail(`v2 link → урок ${st.lesson.id} вместо ${p.get('lesson')}: ${v}`)
        if (st.mode !== 'reactions') fail(`v2 link → режим ${st.mode}: ${v}`)
        const want = reactionIdFromSrc(p.get('src'))
        if (want && rxIds.has(want)) {
          exact++
          if (st.rxId !== want) fail(`v2 link → rx ${st.rxId} вместо ${want}`)
        } else if (!lessonReactionIds(st.lesson).length) fail(`v2 link: нет реакции и у урока пусто: ${v}`)
      } else walk(v)
    }
  }
  walk(g10Book)
  walk(g11Book)
  console.log('v2 textbook links', links, 'точная реакция', exact)
  if (links !== 310) fail(`v2: ожидалось 310 ссылок учебника, найдено ${links}`)

  // старые режимы и адреса
  const S = (q: string) => resolveOrganicUrl(new URLSearchParams(q))
  const cases: [string, string, string, string?][] = [
    ['', 'intro-structure', 'molecule'],
    ['mode=view&lesson=alkanes', 'alkanes', 'molecule'],
    ['mode=build&challenge=ethanol&mol=ethanol', 'reaction-types', 'constructor', 'build:ethanol'],
    ['lesson=alcohols&mode=build&challenge=ethanol&mol=ethanol', 'alcohols', 'constructor', 'build:ethanol'],
    ['mode=isomer&lesson=isomers', 'isomers', 'isomers'],
    ['mode=name&lesson=nomenclature', 'nomenclature', 'name'],
    ['chapter=2&section=5', 'cycloalkanes', 'molecule'],
    ['mol=iodoform', 'halo', 'molecule'],
    ['mode=synthesis&mol=aspirin', 'acids', 'synthesis'],
    ['mode=constructor&mol=n-octane', 'alkanes', 'constructor', 'build:n-octane'],
    ['rx=g10-c1-s06-r2&mode=reactions', 'reaction-types', 'reactions'],
  ]
  for (const [q, lesson, mode, task] of cases) {
    const st = S(q)
    if (st.lesson.id !== lesson || st.mode !== mode || (task && st.task !== task)) {
      fail(`v2 url «${q}» → ${st.lesson.id}/${st.mode}/${st.task}, ожидалось ${lesson}/${mode}/${task ?? ''}`)
    }
  }
  if (parseModeParam('equation') !== 'reactions') fail('v2: mode=equation → reactions')

  // прогресс v2: миграция v1 и «урок пройден»
  store.clear()
  markLessonProgress('alkanes', { viewed: true, built: true, equation: true })
  const v2 = loadProgressV2()
  if (v2.alkanes?.molecule !== true || v2.alkanes?.constructor !== true || v2.alkanes?.reactions !== true) fail('v2: миграция прогресса v1')
  const alkModes = lessonModesV2(alk, lessonIsomerSets(alk, formulaOf))
  for (const m of alkModes) markModeDone('alkanes', m)
  if (!isLessonDoneV2(loadProgressV2().alkanes, alkModes)) fail('v2: урок не засчитан после всех режимов')
  if (isLessonDoneV2(loadProgressV2().alkenes, lessonModesV2(ORGANIC_CURRICULUM[6]!, []))) fail('v2: чужой урок засчитан')
  if (isLessonDoneV2({ molecule: true }, ['molecule', 'constructor'])) fail('v2: «constructor» засчитан без сборки (Object.prototype)')
}

console.log(errors.length === 0 ? 'OK verify-organic-curriculum' : `FAILED ${errors.length}`)
process.exit(errors.length === 0 ? 0 : 1)
