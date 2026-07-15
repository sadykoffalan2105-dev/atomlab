/**
 * Массовый перевод MCQ RU → EN + UZ через OpenAI.
 * Usage: node --env-file=.env scripts/translate-quiz-i18n.mjs
 * Resume-safe: дописывает src/data/sectionQuizI18n.json и g7LogicalQuizI18n.json
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')

function loadEnvFile() {
  const envPath = path.join(ROOT, '.env')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!m) continue
    let v = m[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    if (!(m[1] in process.env)) process.env[m[1]] = v
  }
}

loadEnvFile()

const API_KEY = process.env.OPENAI_API_KEY
if (!API_KEY) {
  console.error('OPENAI_API_KEY missing')
  process.exit(1)
}

const MODEL = process.env.QUIZ_I18N_MODEL || 'gpt-4o-mini'
const BATCH = Number(process.env.QUIZ_I18N_BATCH || 8)
const CONCURRENCY = Number(process.env.QUIZ_I18N_CONCURRENCY || 3)

const SECTION_OUT = path.join(ROOT, 'src/data/sectionQuizI18n.json')
const LOGICAL_OUT = path.join(ROOT, 'src/data/g7LogicalQuizI18n.json')
const SECTION_SRC = path.join(ROOT, 'scripts/_generated/quiz-i18n-source.json')
const LOGICAL_SRC = path.join(ROOT, 'scripts/_generated/logical-quiz-i18n-source.json')

function loadJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function saveJson(file, data) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

function isComplete(entry) {
  return (
    entry &&
    typeof entry.questionEn === 'string' &&
    entry.questionEn.trim() &&
    typeof entry.questionUz === 'string' &&
    entry.questionUz.trim() &&
    Array.isArray(entry.choicesEn) &&
    entry.choicesEn.length === 4 &&
    Array.isArray(entry.choicesUz) &&
    entry.choicesUz.length === 4
  )
}

async function translateBatch(items) {
  const payload = items.map((q) => ({
    id: q.id,
    question: q.question,
    choices: q.choices,
    explanation: q.explanation || '',
  }))

  const system = `You translate school chemistry multiple-choice questions from Russian to English and Uzbek (Latin script, Uzbekistan).
Return ONLY valid JSON object: { "items": [ ... ] }.
For each input item output exactly:
{
  "id": "<same id>",
  "questionEn": "...",
  "questionUz": "...",
  "choicesEn": ["a","b","c","d"],
  "choicesUz": ["a","b","c","d"],
  "explanationEn": "...",
  "explanationUz": "..."
}
Rules:
- Keep chemical formulas, symbols, numbers, subscripts, and proper names accurate (H2O, Al-Kindi/Al-Kindiy, etc.).
- Preserve choice ORDER exactly (correct answer stays at the same index).
- Uzbek: natural school language, Latin alphabet (o', g', sh, ch).
- explanation may be empty string if source explanation is empty.
- No markdown fences.`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: JSON.stringify({ items: payload }) },
      ],
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OpenAI ${res.status}: ${text.slice(0, 400)}`)
  }
  const data = await res.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('Empty completion')
  const parsed = JSON.parse(content)
  const list = Array.isArray(parsed.items) ? parsed.items : Array.isArray(parsed) ? parsed : null
  if (!list) throw new Error('Bad JSON shape')
  return list
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function mapPool(items, limit, fn) {
  let i = 0
  const results = []
  const workers = Array.from({ length: limit }, async () => {
    while (i < items.length) {
      const idx = i++
      results[idx] = await fn(items[idx], idx)
    }
  })
  await Promise.all(workers)
  return results
}

async function processFile(srcPath, outPath, keyField) {
  const source = loadJson(srcPath, [])
  const out = loadJson(outPath, {})
  const pending = source.filter((q) => !isComplete(out[q[keyField] || q.id]))
  console.log(`${path.basename(outPath)}: total=${source.length} pending=${pending.length}`)
  if (pending.length === 0) return out

  const batches = chunk(pending, BATCH)
  let done = 0
  await mapPool(batches, CONCURRENCY, async (batch) => {
    let attempt = 0
    for (;;) {
      try {
        const translated = await translateBatch(batch)
        const byId = new Map(translated.map((t) => [t.id, t]))
        for (const q of batch) {
          const key = q[keyField] || q.id
          const t = byId.get(q.id)
          if (!t || !Array.isArray(t.choicesEn) || t.choicesEn.length !== 4) {
            throw new Error(`Missing/bad translation for ${q.id}`)
          }
          out[key] = {
            questionEn: String(t.questionEn || '').trim(),
            questionUz: String(t.questionUz || '').trim(),
            choicesEn: t.choicesEn.map(String),
            choicesUz: t.choicesUz.map(String),
            explanationEn: String(t.explanationEn || '').trim(),
            explanationUz: String(t.explanationUz || '').trim(),
          }
        }
        done += batch.length
        saveJson(outPath, out)
        console.log(`  saved ${done}/${pending.length}`)
        return
      } catch (err) {
        attempt++
        console.warn(`  batch fail (try ${attempt}):`, err.message || err)
        if (attempt >= 4) throw err
        await new Promise((r) => setTimeout(r, 1500 * attempt))
      }
    }
  })
  return out
}

const section = await processFile(SECTION_SRC, SECTION_OUT, 'id')
console.log('section complete', Object.keys(section).length)

if (fs.existsSync(LOGICAL_SRC)) {
  const logical = await processFile(LOGICAL_SRC, LOGICAL_OUT, 'templateKey')
  console.log('logical complete', Object.keys(logical).length)
}

console.log('done')
