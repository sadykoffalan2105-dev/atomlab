import { validateLearnCurriculum } from '../src/learn/learnCurriculumGuarantee'
import { learnAllSections } from '../src/data/learnCurriculumUz'

const errors = validateLearnCurriculum()
if (errors.length) {
  console.error('[validate:learn] FAILED')
  errors.forEach((e) => console.error(' -', e))
  process.exit(1)
}
console.log('[validate:learn] OK —', learnAllSections().length, 'sections')
