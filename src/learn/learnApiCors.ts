/** CORS для serverless API (GitHub Pages / Netlify / Vercel previews). */
export function isLearnApiOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
  const dev = ['http://localhost:5173', 'http://127.0.0.1:5173']
  const all = [...allowedOrigins, ...dev]
  if (all.some((o) => origin === o || origin.startsWith(o))) return true
  if (/^https:\/\/[\w.-]+\.github\.io$/i.test(origin)) return true
  if (/^https:\/\/[\w.-]+\.netlify\.app$/i.test(origin)) return true
  if (/^https:\/\/[\w.-]+\.vercel\.app$/i.test(origin)) return true
  return false
}

export function learnApiCorsHeaders(
  origin: string | undefined,
  allowedOrigins: string[],
): Record<string, string> {
  const allow = origin && isLearnApiOriginAllowed(origin, allowedOrigins) ? origin : '*'
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}
