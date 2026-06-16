/**
 * Экспорт каталога визуалов для скриптов генерации.
 * npx tsx scripts/export-g7-quiz-visual-catalog.ts
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { G7_QUIZ_VISUAL_CATALOG } from '../src/learn/g7QuizVisualCatalog'

const out = join(process.cwd(), 'scripts/.g7-quiz-visual-catalog.json')
writeFileSync(out, JSON.stringify(G7_QUIZ_VISUAL_CATALOG, null, 2), 'utf8')
console.log(`Exported ${Object.keys(G7_QUIZ_VISUAL_CATALOG).length} entries → ${out}`)
