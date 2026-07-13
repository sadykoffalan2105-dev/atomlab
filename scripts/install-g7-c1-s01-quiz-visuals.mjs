/**
 * Install unique g7-c1-s01 quiz visuals from generated assets.
 * node scripts/install-g7-c1-s01-quiz-visuals.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const srcDir = path.join(
  process.env.USERPROFILE || '',
  '.cursor/projects/c-Users-Desktop/assets',
)
const outDir = path.join(root, 'public/learn/quiz-visuals')

const captions = {
  'g7-c1-s01-q01': 'Химия как наука о веществах',
  'g7-c1-s01-q02': 'Задачи химии: материалы и энергия',
  'g7-c1-s01-q03': 'Понятие «вещество»',
  'g7-c1-s01-q04': 'Эпоха алхимии в истории химии',
  'g7-c1-s01-q05': 'Абу Юсуф аль-Кинди (800–870)',
  'g7-c1-s01-q06': 'Ар-Рази и классификация веществ',
  'g7-c1-s01-q07': 'Ибн Сина (Авиценна) о металлах',
  'g7-c1-s01-q08': 'Роль химии в жизни',
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const W = 1792
const H = 1024
const barH = 168

for (const [id, caption] of Object.entries(captions)) {
  const src = path.join(srcDir, `${id}.png`)
  if (!fs.existsSync(src)) {
    console.error('MISSING', src)
    process.exit(1)
  }
  const overlay = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#00000000"/>
        <stop offset="55%" stop-color="#00000055"/>
        <stop offset="100%" stop-color="#000000cc"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#fade)"/>
    <rect x="0" y="${H - barH}" width="${W}" height="${barH}" fill="#020617e6"/>
    <text x="64" y="${H - 88}" font-family="Segoe UI, Arial, sans-serif" font-size="34" fill="#f8fafc">${esc(caption)}</text>
    <text x="64" y="${H - 42}" font-family="Segoe UI, Arial, sans-serif" font-size="22" fill="#94a3b8">ATOMLAB · Kimyo 7 · ${esc(id)}</text>
  </svg>`)

  const base = await sharp(src)
    .resize(W, H, { fit: 'cover', position: 'centre' })
    .toBuffer()
  const out = await sharp(base)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .png({ compressionLevel: 8 })
    .toBuffer()
  const dest = path.join(outDir, `${id}.png`)
  fs.writeFileSync(dest, out)
  console.log('OK', id, out.length)
}

console.log('Installed 8 unique quiz visuals for g7-c1-s01')
