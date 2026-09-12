import { createHash, randomUUID } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import WebSocket from 'ws'
import { buildTeacherSsml } from '../src/learn/learnEdgeSsml'
import { EDGE_TTS_SEC_MS_GEC_VERSION, edgeTtsUtcTimestamp } from '../src/learn/edgeTtsSecMsGec'
import { TEACHER_VOICE_EDGE } from '../src/learn/learnTeacherVoiceProfile'

const TRUSTED = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'
const WSS = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1'
const WIN_EPOCH = 11644473600

const log: string[] = []
const say = (m: string) => {
  log.push(m)
  console.log(m)
}

function secGec(): string {
  let ticks = Date.now() / 1000 + WIN_EPOCH
  ticks -= ticks % 300
  ticks *= 1e7
  return createHash('sha256')
    .update(`${ticks.toFixed(0)}${TRUSTED}`, 'utf8')
    .digest('hex')
    .toUpperCase()
}

const voice = TEACHER_VOICE_EDGE.ru
const ssml = buildTeacherSsml('Тест.', voice, '-15%', '-5Hz', '+4%', 'ru-RU')
const id = randomUUID().replace(/-/g, '')
const url = `${WSS}?TrustedClientToken=${TRUSTED}&Sec-MS-GEC=${secGec()}&Sec-MS-GEC-Version=${EDGE_TTS_SEC_MS_GEC_VERSION}&ConnectionId=${id}`

const parts: Buffer[] = []

const ws = new WebSocket(url, {
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
    Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
  },
})

const timer = setTimeout(() => {
  say('timeout')
  ws.close()
  writeFileSync('server-edge-debug.json', JSON.stringify({ log, parts: parts.length }, null, 2))
  process.exit(1)
}, 20000)

ws.on('open', () => {
  say('open')
  const ts = edgeTtsUtcTimestamp()
  const rid = randomUUID().replace(/-/g, '')
  ws.send(
    `X-Timestamp:${ts}\rContent-Type:application/json; charset=utf-8\rPath:speech.config\r\r` +
      '{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r',
  )
  ws.send(
    `X-RequestId:${rid}\rContent-Type:application/ssml+xml\rX-Timestamp:${ts}Z\rPath:ssml\r\r${ssml}`,
  )
})

ws.on('message', (data, isBinary) => {
  if (!isBinary) {
    const t = data.toString('utf8')
    say('text: ' + t.slice(0, 120))
    if (t.includes('Path:turn.end')) {
      clearTimeout(timer)
      say('done parts=' + parts.length + ' bytes=' + Buffer.concat(parts).length)
      writeFileSync('server-edge-debug.json', JSON.stringify({ log, ok: parts.length > 0 }, null, 2))
      process.exit(parts.length > 0 ? 0 : 1)
    }
    return
  }
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer)
  if (buf.length > 2) {
    const hl = (buf[0]! << 8) | buf[1]!
    const hdr = buf.subarray(2, hl + 2).toString('utf8')
    if (hdr.includes('Path:audio')) {
      parts.push(buf.subarray(hl + 2))
      say('audio chunk ' + buf.subarray(hl + 2).length)
    } else {
      say('bin hdr: ' + hdr.slice(0, 80))
    }
  }
})

ws.on('error', (e) => {
  say('error: ' + String(e))
})

ws.on('close', (code, reason) => {
  say(`close ${code} ${reason.toString()}`)
  if (parts.length > 0) {
    clearTimeout(timer)
    writeFileSync('server-edge-debug.json', JSON.stringify({ log, ok: true }, null, 2))
    process.exit(0)
  }
})
