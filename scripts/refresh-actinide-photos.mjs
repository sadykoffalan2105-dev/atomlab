/**
 * Refresh a few local element webps from working Wikimedia URLs.
 * node scripts/refresh-actinide-photos.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'public/learn/elements')

const JOBS = [
  {
    file: '093-Np.webp',
    url: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Neptunium_%28Element_-_93%29_1.jpg',
  },
]

async function fetchBuf(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'ATOMLAB/1.0 (educational chemistry app; local asset refresh)',
      Accept: 'image/*',
    },
  })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return Buffer.from(await res.arrayBuffer())
}

for (const job of JOBS) {
  try {
    const buf = await fetchBuf(job.url)
    const webp = await sharp(buf)
      .resize(1200, 675, { fit: 'cover', position: 'centre' })
      .webp({ quality: 82 })
      .toBuffer()
    fs.writeFileSync(path.join(outDir, job.file), webp)
    console.log('OK', job.file, webp.length)
  } catch (e) {
    console.error('FAIL', job.file, e.message)
  }
}
