/**
 * Экспорт промптов для Nano Banana / Gemini Create images.
 * Запуск: npm run learn:nanobanana-prompts
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { allNanoBananaPromptEntries } from '../src/learn/learnNanoBananaPrompts'

const docsDir = join(process.cwd(), 'docs')
const publicDir = join(process.cwd(), 'public', 'learn')
mkdirSync(docsDir, { recursive: true })
mkdirSync(publicDir, { recursive: true })

const entries = allNanoBananaPromptEntries()
const lines: string[] = [
  '# Промпты Nano Banana для ATOMLAB (Обучение)',
  '',
  'Сгенерируйте каждое изображение в [Gemini → Создать изображения](https://gemini.google.com) или Nano Banana Pro.',
  'Сохраните файл как `public/learn/refs/{sceneId}.webp` (или `.png`).',
  '',
  'Пример: `public/learn/refs/topic_g7_c1_s01.webp`',
  '',
  `Всего параграфов: **${entries.length}**`,
  '',
  '---',
  '',
]

for (const e of entries) {
  lines.push(`## ${e.gradeId} / ${e.chapterId} / ${e.sectionId}`)
  lines.push('')
  lines.push(`**Сцена:** \`${e.sceneId}\``)
  lines.push('')
  lines.push(`**Тема:** ${e.title}`)
  lines.push('')
  lines.push('**Промпт (скопировать в Nano Banana):**')
  lines.push('')
  lines.push('```')
  lines.push(e.prompt)
  lines.push('```')
  lines.push('')
  lines.push(`**Файл:** \`public/learn/refs/${e.sceneId}.nanobanana.webp\``)
  lines.push('')
  lines.push('---')
  lines.push('')
}

const md = lines.join('\n')
const mdDocs = join(docsDir, 'nano-banana-prompts.md')
const mdPublic = join(publicDir, 'nano-banana-prompts.md')
writeFileSync(mdDocs, md, 'utf8')
writeFileSync(mdPublic, md, 'utf8')

const json = JSON.stringify(entries, null, 2)
writeFileSync(join(docsDir, 'nano-banana-prompts.json'), json, 'utf8')
writeFileSync(join(publicDir, 'nano-banana-prompts.json'), json, 'utf8')

console.log(`OK: ${entries.length} prompts → ${mdPublic}`)
