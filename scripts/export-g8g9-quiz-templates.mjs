/** Export G8/G9 chapter quiz templates to JSON for Python quiz builder. */
import { writeFileSync } from 'node:fs'
import { G8_CHAPTER_TEMPLATES, G9_CHAPTER_TEMPLATES } from '../src/learn/g8g9TopicQuizTemplates.ts'

function exportGrade(templates) {
  const out = {}
  for (const [ch, items] of Object.entries(templates)) {
    out[ch] = items.map((t) => ({
      templateKey: t.templateKey,
      question: t.question,
      correct: t.choices[t.correctIndex],
      wrong: t.choices.filter((_, i) => i !== t.correctIndex),
      explanation: t.explanation ?? '',
    }))
  }
  return out
}

const payload = {
  g8: exportGrade(G8_CHAPTER_TEMPLATES),
  g9: exportGrade(G9_CHAPTER_TEMPLATES),
}

writeFileSync(
  new URL('./g8g9-quiz-templates.json', import.meta.url),
  JSON.stringify(payload, null, 2),
  'utf8',
)
console.log('Wrote g8g9-quiz-templates.json')
