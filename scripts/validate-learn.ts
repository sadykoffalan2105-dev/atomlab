import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { LEARN_GRADES, learnAllSections } from '../src/data/learnCurriculumUz'
import { validateLearnCurriculum } from '../src/learn/learnCurriculumGuarantee'

const publicRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../public')

function publicFileExists(urlPath: string): boolean {
  if (!urlPath.startsWith('/')) return false
  return fs.existsSync(path.join(publicRoot, urlPath.slice(1)))
}

const errors = validateLearnCurriculum()

for (const grade of LEARN_GRADES) {
  for (const chapter of grade.chapters) {
    for (const section of chapter.sections) {
      for (const slide of section.slides) {
        if (slide.type !== 'visual') continue
        const img = slide.image
        if (!img || !img.includes('/topic_')) continue
        if (!publicFileExists(img)) {
          errors.push(`missing asset ${img} (${section.titleKey})`)
        }
      }
    }
  }
}

if (errors.length) {
  console.error('[validate:learn] FAILED')
  errors.forEach((e) => console.error(' -', e))
  process.exit(1)
}
console.log('[validate:learn] OK —', learnAllSections().length, 'sections')
