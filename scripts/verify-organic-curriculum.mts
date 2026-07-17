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
} from '../src/data/organicLab/organicCurriculumProgress.ts'

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
console.log(errors.length === 0 ? 'OK verify-organic-curriculum' : `FAILED ${errors.length}`)
process.exit(errors.length === 0 ? 0 : 1)
