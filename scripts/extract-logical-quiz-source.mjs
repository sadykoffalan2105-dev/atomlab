import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const src = fs.readFileSync(path.join(ROOT, 'src/learn/g7LogicalQuestions.ts'), 'utf8')
const start = src.indexOf('const LOGICAL_MCQ_BY_CHAPTER')
const end = src.indexOf('export function getLogicalMcqForChapter')
const body = src.slice(start, end)

const re =
  /templateKey:\s*'([^']+)'\s*,\s*question:\s*'((?:\\'|[^'])*)'\s*,\s*choices:\s*\[([\s\S]*?)\]\s*,\s*correctIndex:\s*(\d+)(?:,\s*explanation:\s*'((?:\\'|[^'])*)')?/g

const unescape = (s) => s.replace(/\\'/g, "'").replace(/\\n/g, '\n')
const items = []
let m
while ((m = re.exec(body))) {
  const choices = [...m[3].matchAll(/'((?:\\'|[^'])*)'/g)].map((x) => unescape(x[1]))
  if (choices.length !== 4) {
    console.error('bad choices', m[1], choices)
    continue
  }
  items.push({
    id: m[1],
    templateKey: m[1],
    question: unescape(m[2]),
    choices,
    explanation: unescape(m[5] || ''),
    correctIndex: Number(m[4]),
  })
}

const out = path.join(ROOT, 'scripts/_generated/logical-quiz-i18n-source.json')
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, JSON.stringify(items))
console.log('logical', items.length)
