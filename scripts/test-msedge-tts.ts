import { writeFileSync } from 'node:fs'
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts'

async function main(): Promise<void> {
  const tts = new MsEdgeTTS()
  await tts.setMetadata('ru-RU-DmitryNeural', OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3)
  const { audioStream } = await tts.toStream('Привет, проверка мужского голоса Дмитрия.')
  const chunks: Buffer[] = []
  for await (const c of audioStream) chunks.push(Buffer.from(c))
  const merged = Buffer.concat(chunks)
  writeFileSync('msedge-test.mp3', merged)
  writeFileSync('msedge-test.json', JSON.stringify({ ok: merged.length > 1000, bytes: merged.length }))
}

main().catch((e) => {
  writeFileSync('msedge-test.json', JSON.stringify({ ok: false, error: String(e) }))
  process.exit(1)
})
