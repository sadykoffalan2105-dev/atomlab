/**
 * Пересобирает ELEMENT_WIKI_PHOTOS с корректными MD5-путями Wikimedia.
 * node scripts/fix-element-wiki-urls.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ELEMENT_WIKI_PHOTOS } from './elementWikiPhotos.mjs'
import { filenameFromWikiUrl, wikiCommonsUrl } from './wikiCommonsUrl.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

const fixed = {}
for (const [sym, oldUrl] of Object.entries(ELEMENT_WIKI_PHOTOS)) {
  const name = filenameFromWikiUrl(oldUrl)
  fixed[sym] = wikiCommonsUrl(name)
}

const lines = Object.entries(fixed)
  .map(([sym, url]) => `  ${sym}: '${url}',`)
  .join('\n')

const mjsBody = `/** Реальные фото образцов элементов (Wikimedia Commons, Alchemist-hp и др.) */
export const ELEMENT_WIKI_PHOTOS = {
${lines}
}
`

const tsBody = `/** Реальные фото образцов (Wikimedia Commons). Для отсутствующих — локальный fallback. */
export const ELEMENT_WIKI_PHOTOS: Readonly<Record<string, string>> = {
${lines}
}

export function getElementWikiPhotoUrl(symbol: string): string | undefined {
  return ELEMENT_WIKI_PHOTOS[symbol]
}
`

fs.writeFileSync(path.join(__dirname, 'elementWikiPhotos.mjs'), mjsBody)
fs.writeFileSync(path.join(root, 'src/data/elementWikiPhotos.ts'), tsBody)
console.log(`Updated ${Object.keys(fixed).length} URLs`)
