/**
 * Проверка сервера мозга по адресу (локально или через Tailscale Funnel): /health и один вопрос потоком SSE.
 * Замеряет время до первого куска ответа — видно, что Funnel не копит поток (SSE доходит по кускам).
 *
 *   node --import <tsx> deploy/brain-pc/selftest.mts --url=https://atomlab-brain.xxx.ts.net [--q="Что такое моль?"] [--json=путь]
 *
 * Печатает JSON-строку {ok, url, health, firstMs, totalMs, chunks, route, text} и код выхода 0/1.
 */
import fs from 'node:fs'

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const base = (arg('url') ?? `http://127.0.0.1:${process.env.BRAIN_PORT || 8787}`).replace(/\/+$/, '')
const question = arg('q') ?? 'Что такое моль? Ответь кратко.'

type Result = { ok: boolean; url: string; health: unknown; firstMs: number | null; totalMs: number | null; chunks: number; route: string | null; text: string; error?: string }
const out: Result = { ok: false, url: base, health: null, firstMs: null, totalMs: null, chunks: 0, route: null, text: '' }

try {
  const h = await fetch(`${base}/health`, { signal: AbortSignal.timeout(20_000) })
  out.health = await h.json()
  const t0 = performance.now()
  const res = await fetch(`${base}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: `selftest-${Date.now()}`,
      studentId: 'selftest',
      lang: 'auto',
      stream: true,
      messages: [{ role: 'user', content: question }],
      context: { gradeId: 'g9', mode: 'chat', detail: 'brief' },
    }),
    signal: AbortSignal.timeout(180_000),
  })
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
  const dec = new TextDecoder()
  let buf = ''
  for await (const part of res.body as unknown as AsyncIterable<Uint8Array>) {
    buf += dec.decode(part, { stream: true })
    let i: number
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, i)
      buf = buf.slice(i + 2)
      const ev = /^event: (.+)$/m.exec(block)?.[1]
      const data = /^data: (.+)$/m.exec(block)?.[1]
      if (!ev || !data) continue
      const d = JSON.parse(data) as { text?: string; route?: string; message?: string }
      if (ev === 'meta') out.route = d.route ?? null
      if (ev === 'delta') {
        out.chunks++
        if (out.firstMs === null) out.firstMs = Math.round(performance.now() - t0)
      }
      if (ev === 'done') out.text = d.text ?? ''
      if (ev === 'error') throw new Error(d.message ?? 'error')
    }
  }
  out.totalMs = Math.round(performance.now() - t0)
  out.ok = !!out.text
} catch (err) {
  out.error = (err as Error).message
}
const json = JSON.stringify(out)
const file = arg('json')
if (file) fs.writeFileSync(file, json)
console.log(json)
process.exitCode = out.ok ? 0 : 1
