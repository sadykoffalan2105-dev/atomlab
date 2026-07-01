/** Абсолютный URL файла из `public/` — hash-router, GitHub Pages и Electron file://. */
export function publicAssetUrl(path: string): string {
  const clean = path.replace(/^\//, '')
  if (typeof window === 'undefined') return `/${clean}`

  const base = import.meta.env.BASE_URL || './'

  if (base.startsWith('http')) {
    return `${base.replace(/\/$/, '')}/${clean}`
  }

  if (base.startsWith('/')) {
    const root = `${window.location.origin}${base}`.replace(/\/$/, '')
    return `${root}/${clean}`
  }

  // ./ — Vite dev и Electron (loadFile): путь относительно dist/index.html
  return new URL(clean, window.location.href).href
}
