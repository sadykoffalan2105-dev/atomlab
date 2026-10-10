/**
 * Проверка src/data/elementPhotos.json (сеть нужна):
 *  - 118 записей, ключи совпадают с периодической таблицей;
 *  - Z ≥ 100 (Fm и тяжелее) — null: видимого образца нет;
 *  - у остальных фото есть, кроме честных исключений (Pm, Cm, Rn, Fr);
 *  - каждая миниатюра (и копия 2x) отвечает HTTP 200 и это image/*;
 *  - есть автор, лицензия и ссылка на страницу файла Commons (условие CC BY / BY-SA).
 *
 *   npx tsx scripts/test-element-photos.mts
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getElementNoPhotoReason } from '../src/data/elementPhotos'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const UA = 'ATOMLAB-element-photos-test/1.0 (educational app)'
const NO_PHOTO_OK = new Set(['Pm', 'Cm', 'Rn', 'Fr'])

type Photo = { thumb: string; thumb2x?: string; page: string; author: string; license: string }
const data = JSON.parse(fs.readFileSync(path.join(root, 'src/data/elementPhotos.json'), 'utf8')) as Record<
  string,
  Photo | null
>
const table = JSON.parse(fs.readFileSync(path.join(root, 'src/data/periodicTableRaw.json'), 'utf8')) as {
  symbol: string
  atomicNumber: number
}[]

const errors: string[] = []
const fail = (msg: string) => errors.push(msg)

if (Object.keys(data).length !== 118) fail(`записей ${Object.keys(data).length}, нужно 118`)
for (const { symbol, atomicNumber: z } of table) {
  if (!(symbol in data)) {
    fail(`${symbol}: нет записи`)
    continue
  }
  const photo = data[symbol]
  if (z >= 100 && photo) fail(`${symbol}: у синтетического элемента не должно быть фото`)
  if (z < 100 && !photo && !NO_PHOTO_OK.has(symbol)) fail(`${symbol}: нет фото`)
  if (!photo) {
    const reason = getElementNoPhotoReason(symbol, z)
    if (z >= 101 && reason !== 'accelerator') fail(`${symbol}: причина ${reason}, ждали accelerator`)
    continue
  }
  if (!/^https:\/\/(upload|thumb)\.wikimedia\.org\//.test(photo.thumb)) fail(`${symbol}: thumb не с Wikimedia`)
  if (!photo.page.startsWith('https://commons.wikimedia.org/wiki/File:')) fail(`${symbol}: page ${photo.page}`)
  if (!photo.author.trim() || !photo.license.trim()) fail(`${symbol}: нет автора или лицензии`)
}

async function checkImage(url: string): Promise<string | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    const type = res.headers.get('content-type') ?? ''
    const body = await res.arrayBuffer().catch(() => new ArrayBuffer(0))
    if (res.status === 200 && type.startsWith('image/') && body.byteLength > 1000) return null
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)))
      continue
    }
    return `HTTP ${res.status} ${type} ${body.byteLength} B`
  }
  return 'HTTP: слишком много повторов'
}

const urls = Object.entries(data).flatMap(([sym, p]) =>
  p ? [p.thumb, p.thumb2x].filter((u): u is string => !!u).map((u) => [sym, u] as const) : [],
)
let n = 0
for (const [sym, url] of urls) {
  const err = await checkImage(url)
  if (err) fail(`${sym}: ${err} — ${url}`)
  if (++n % 40 === 0) console.log(`  проверено ${n}/${urls.length}`)
}

const withPhoto = Object.values(data).filter(Boolean).length
if (errors.length) {
  console.error(`ОШИБКИ (${errors.length}):\n${errors.join('\n')}`)
  process.exit(1)
}
console.log(`OK: 118 записей, с фото ${withPhoto}, без фото ${118 - withPhoto}; ${urls.length} ссылок → 200 image/*`)
