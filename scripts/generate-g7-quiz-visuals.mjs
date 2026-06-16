/**
 * Генерация фотореалистичных PNG для вопросов теста 7 класса (OpenAI DALL-E 3).
 *
 * npm run learn:generate-quiz-visuals
 * npm run learn:generate-quiz-visuals -- --limit 5
 * npm run learn:generate-quiz-visuals -- --force
 * npm run learn:generate-quiz-visuals -- --id c2-t01
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const outDir = path.join(root, 'public/learn/quiz-visuals')
const catalogPath = path.join(root, 'scripts/.g7-quiz-visual-catalog.json')

const args = process.argv.slice(2)
const force = args.includes('--force')
const replacePlaceholders = args.includes('--replace-placeholders')
const PLACEHOLDER_MAX_BYTES = 250_000
const limitArg = args.find((a) => a.startsWith('--limit='))
const idArg = args.find((a) => a.startsWith('--id='))
const limit = limitArg ? Number(limitArg.split('=')[1]) : Infinity
const onlyId = idArg ? idArg.split('=')[1] : null

function loadEnv() {
  const envPath = path.join(root, '.env')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnv()

const apiKey = process.env.OPENAI_API_KEY
if (!apiKey) {
  console.error('OPENAI_API_KEY not set in .env')
  process.exit(1)
}

execSync('npx tsx scripts/export-g7-quiz-visual-catalog.ts', { cwd: root, stdio: 'inherit' })
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'))
fs.mkdirSync(outDir, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function generateImage(prompt) {
  const baseUrl = (process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, '')
  const res = await fetch(`${baseUrl}/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_IMAGE_MODEL ?? 'dall-e-3',
      prompt,
      n: 1,
      size: '1792x1024',
      quality: 'standard',
      response_format: 'b64_json',
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OpenAI ${res.status}: ${text}`)
  }
  const data = await res.json()
  const b64 = data?.data?.[0]?.b64_json
  if (!b64) throw new Error('No image data in response')
  return Buffer.from(b64, 'base64')
}

let done = 0
let skipped = 0
let failed = 0

const entries = Object.entries(catalog).filter(([id]) => !onlyId || id === onlyId)

for (const [id, entry] of entries) {
  if (done >= limit) break
  const out = path.join(outDir, `${id}.png`)
  const exists = fs.existsSync(out)
  const isPlaceholder = exists && fs.statSync(out).size < PLACEHOLDER_MAX_BYTES
  if (exists && !force && !replacePlaceholders) {
    skipped++
    continue
  }
  if (exists && replacePlaceholders && !isPlaceholder) {
    skipped++
    continue
  }

  process.stdout.write(`[${done + 1}] ${id}… `)
  try {
    const buf = await generateImage(entry.prompt)
    fs.writeFileSync(out, buf)
    console.log('OK')
    done++
    await sleep(1200)
  } catch (err) {
    console.log('FAIL:', err.message)
    failed++
    await sleep(3000)
  }
}

console.log(`Done: ${done} generated, ${skipped} skipped, ${failed} failed`)
