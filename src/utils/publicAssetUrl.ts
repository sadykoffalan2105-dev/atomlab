/** Абсолютный URL файла из `public/` — работает с hash-router и base `./`. */
export function publicAssetUrl(path: string): string {
  const clean = path.replace(/^\//, '')
  if (typeof window !== 'undefined') {
    const base = import.meta.env.BASE_URL || '/'
    if (base === './' || base === '.') {
      return `${window.location.origin}/${clean}`
    }
    if (base.startsWith('http')) {
      return `${base.replace(/\/$/, '')}/${clean}`
    }
    const root = base.startsWith('/') ? `${window.location.origin}${base}` : `${window.location.origin}/${base}`
    return `${root.replace(/\/$/, '')}/${clean}`
  }
  return `/${clean}`
}
