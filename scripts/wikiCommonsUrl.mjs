import crypto from 'node:crypto'

/** Прямой URL файла на upload.wikimedia.org (хеш = MD5 имени файла). */
export function wikiCommonsUrl(filename) {
  const h = crypto.createHash('md5').update(filename).digest('hex')
  const path = `${h[0]}/${h.slice(0, 2)}/${filename}`
  return `https://upload.wikimedia.org/wikipedia/commons/${path}`
}

/** Имя файла из старого URL commons. */
export function filenameFromWikiUrl(url) {
  const u = new URL(url)
  return decodeURIComponent(u.pathname.split('/').pop())
}
