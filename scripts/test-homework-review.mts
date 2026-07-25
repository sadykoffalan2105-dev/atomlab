#!/usr/bin/env node
/**
 * Homework brain — authorship + chemistry local review.
 * Запуск: npx tsx scripts/test-homework-review.mts
 */
import assert from 'node:assert/strict'
import { analyzeAuthorshipLocal } from '../src/learn/homework/authenticityDetector.ts'
import { analyzeChemistryLocal } from '../src/learn/homework/chemistryHomeworkAnalysis.ts'
import { reviewHomeworkLocal } from '../src/learn/homework/homeworkReviewBrain.ts'
import { buildHomeworkReviewPrompt } from '../src/learn/homework/homeworkReviewPrompt.ts'

const AI_ESSAY = `
В заключение можно отметить, что важно подчеркнуть: оксид является веществом,
которое представляет собой соединение элемента с кислородом. Следует отметить, что
ключевым аспектом является степень окисления. Рассмотрим более подробно основные аспекты.
Во-первых, оксиды классифицируют на основные, кислотные и амфотерные. Во-вторых,
с точки зрения химии данная тема является фундаментом курса. В-третьих, подводя итог
вышесказанному, необходимо учитывать, что для более глубокого понимания стоит отметить следующее.
В современном мире оксиды играют важную роль. На основании вышеизложенного подведём итог.
`

const HUMAN_DRAFT = `
Я думаю оксид — это когда элемент с кислородом, типа CO2. На уроке учитель говорил
про кислотные оксиды. Не уверена насчёт амфотерных, вроде Al2O3 туда. Примерно
посчитала: если 10 г CaCO3, то n = 0.1 моль, CO2 получается около 2.24 л. Короче
в учебнике ещё про соли было, но я забыла формулу.
`

{
  const ai = analyzeAuthorshipLocal(AI_ESSAY, 'ru')
  assert.ok(ai.aiProbability >= 0.55, `AI essay should score high, got ${ai.aiProbability}`)
  assert.ok(
    ai.authorship === 'ai_likely' || ai.authorship === 'mixed' || ai.authorship === 'uncertain',
    `AI essay authorship=${ai.authorship}`,
  )
  assert.ok(ai.signals.some((s) => s.weight > 0), 'AI essay must have positive AI signals')
}

{
  const human = analyzeAuthorshipLocal(HUMAN_DRAFT, 'ru')
  assert.ok(human.aiProbability <= 0.45, `human draft should score low AI, got ${human.aiProbability}`)
  assert.ok(
    human.authorship === 'human' || human.authorship === 'uncertain' || human.authorship === 'mixed',
    `human authorship=${human.authorship}`,
  )
  assert.ok(human.signals.some((s) => s.id === 'human_voice'), 'expect human_voice signal')
}

{
  const chem = analyzeChemistryLocal(HUMAN_DRAFT, { locale: 'ru', topicHint: 'оксиды', gradeId: 'g8' })
  assert.ok(chem.score >= 40, `chemistry score too low: ${chem.score}`)
  assert.ok(chem.keyConceptsHit.length >= 1, 'should hit oxide/related concepts')
}

{
  const report = reviewHomeworkLocal({
    text: HUMAN_DRAFT,
    source: 'paste',
    topicHint: 'оксиды',
    gradeId: 'g8',
    locale: 'ru',
  })
  assert.ok(report.teacherBrief.includes('АВТОРСТВО'))
  assert.ok(report.studentFeedback.length > 10)
  assert.equal(report.input.hasImage, false)
}

{
  const en = analyzeAuthorshipLocal(
    'In conclusion, it is important to note that this topic is of great importance. Firstly, oxides. Secondly, acids. Thirdly, to summarize the above.',
    'en',
  )
  assert.ok(en.aiProbability >= 0.5, `EN AI boilerplate: ${en.aiProbability}`)

  const uz = analyzeAuthorshipLocal(
    "Xulosa qilib aytganda, shuni ta'kidlash lozim: ushbu mavzu muhim ahamiyatga ega. Kimyo nuqtai nazaridan oksidlar muhim rol o'ynaydi.",
    'uz',
  )
  assert.ok(uz.aiProbability >= 0.45, `UZ AI boilerplate: ${uz.aiProbability}`)
}

{
  const local = reviewHomeworkLocal({
    text: HUMAN_DRAFT,
    source: 'paste',
    locale: 'en',
    topicHint: 'oxides',
  })
  const prompt = buildHomeworkReviewPrompt({
    locale: 'en',
    text: HUMAN_DRAFT,
    topicHint: 'oxides',
    gradeId: 'g8',
    knowledgeSnippet: 'Oxides are compounds of elements with oxygen.',
    localAuthorship: local.authorship,
    localChemistry: local.chemistry,
  })
  assert.match(prompt, /AUTHORSHIP: human\|ai_likely\|mixed\|uncertain/)
  assert.match(prompt, /Elite Chemistry Teacher/)
}

{
  const short = analyzeAuthorshipLocal('Hi', 'ru')
  assert.equal(short.authorship, 'uncertain')
}

console.log('test-homework-review: ok')
