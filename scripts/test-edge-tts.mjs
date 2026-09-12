import WebSocket from 'ws'
import { randomUUID } from 'node:crypto'

const url =
  'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1' +
  '?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4' +
  '&ConnectionId=' +
  randomUUID().replace(/-/g, '')

const ssml =
  "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='ru-RU'>" +
  "<voice name='ru-RU-DmitryNeural'>" +
  "<prosody rate='-8%' pitch='-2Hz'>Привет, я учитель химии.</prosody>" +
  '</voice></speak>'

const ws = new WebSocket(url, {
  headers: {
    Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
  },
})

const parts = []

ws.on('open', () => {
  console.log('open')
  ws.send(
    'Content-Type:application/json; charset=utf-8\r\n' +
      'Path:speech.config\r\n\r\n' +
      '{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}',
  )
  ws.send(
    `X-RequestId:${randomUUID().replace(/-/g, '')}\r\n` +
      'Content-Type:application/ssml+xml\r\n' +
      'Path:ssml\r\n\r\n' +
      ssml,
  )
})

ws.on('message', (data) => {
  if (typeof data === 'string') {
    console.log('text:', data.slice(0, 200))
    return
  }
  const buf = Buffer.from(data)
  const marker = Buffer.from('\r\n\r\n')
  const idx = buf.indexOf(marker)
  const audioLen = idx >= 0 ? buf.length - idx - 4 : 0
  if (audioLen > 0) parts.push(audioLen)
  console.log('bin:', buf.length, 'audio:', audioLen)
})

ws.on('error', (e) => console.log('error:', e.message))
ws.on('close', (code) => {
  console.log('close', code, 'parts', parts, 'total', parts.reduce((a, b) => a + b, 0))
  process.exit(parts.length > 0 ? 0 : 1)
})

setTimeout(() => {
  console.log('timeout')
  ws.close()
}, 20000)
