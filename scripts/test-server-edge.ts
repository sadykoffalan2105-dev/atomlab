import { writeFileSync } from 'node:fs'
import { synthesizeEdgeForServerless } from '../server/edgeTtsServerless'

async function main(): Promise<void> {
  const out = await synthesizeEdgeForServerless(
    'Привет! Это проверка мужского голоса учителя Дмитрия.',
    'ru',
  )
  if (!out) {
    writeFileSync('server-edge-result.json', JSON.stringify({ ok: false, reason: 'null' }))
    return
  }
  const bytes = Math.floor((out.audioBase64.length * 3) / 4)
  writeFileSync('server-edge-result.mp3', Buffer.from(out.audioBase64, 'base64'))
  writeFileSync(
    'server-edge-result.json',
    JSON.stringify({ ok: bytes > 1000, bytes, mimeType: out.mimeType }, null, 2),
  )
}

main().catch((e) => {
  writeFileSync(
    'server-edge-result.json',
    JSON.stringify({ ok: false, reason: e instanceof Error ? e.message : String(e) }),
  )
  process.exit(1)
})
