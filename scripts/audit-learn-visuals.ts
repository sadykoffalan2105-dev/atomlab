/**
 * Аудит визуалов §: topic_* vs molecule/atom overrides.
 * npm run learn:audit-visuals
 */
import { learnAllSections } from '../src/data/learnCurriculumUz'
import { LEARN_SECTION_VISUAL_MAP } from '../src/data/learnVisualMap'
import { getLearnVisual } from '../src/learn/learnVisualRegistry'
import { hasIsometricScene } from '../src/learn/learnIsometricScenes'

const sections = learnAllSections()
let topicCount = 0
let overrideCount = 0
const problems: string[] = []

for (const sec of sections) {
  const pathId = `${sec.gradeId}-${sec.chapterId}-${sec.id}`
  const vid = sec.defaultVisualId
  const spec = getLearnVisual(vid)
  if (!spec) {
    problems.push(`${pathId}: unknown visual ${vid}`)
    continue
  }
  if (spec.kind === 'topicScene') {
    topicCount++
    if (!hasIsometricScene(spec.sceneId)) {
      problems.push(`${pathId}: missing isometric def for ${spec.sceneId}`)
    }
  } else {
    overrideCount++
  }
}

const mapKeys = Object.keys(LEARN_SECTION_VISUAL_MAP).length
console.log(`§ всего: ${sections.length}`)
console.log(`  изометрия (topic_*): ${topicCount}`)
console.log(`  molecule/atom/svg: ${overrideCount} (явная карта: ${mapKeys} записей)`)

if (problems.length) {
  console.error('\nПроблемы:')
  problems.forEach((p) => console.error(' -', p))
  process.exit(1)
}
console.log('\n[learn:audit-visuals] OK')
