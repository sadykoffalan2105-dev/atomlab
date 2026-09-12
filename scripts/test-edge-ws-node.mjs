const TRUSTED = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'
const WSS = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1'
const WIN_EPOCH = 11644473600
const GEC_VER = '1-130.0.2849.68'

async function sha256HexUpper(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase()
}

async function secGec() {
  let ticks = Date.now() / 1000 + WIN_EPOCH
  ticks -= ticks % 300
  ticks *= 1e7
  return sha256HexUpper(`${ticks.toFixed(0)}${TRUSTED}`)
}

const uuid = () => crypto.randomUUID().replace(/-/g, '')

const token = await secGec()
const url =
  `${WSS}?TrustedClientToken=${TRUSTED}` +
  `&Sec-MS-GEC=${token}&Sec-MS-GEC-Version=${GEC_VER}&ConnectionId=${uuid()}`

const parts = []
await new Promise((resolve, reject) => {
  const ws = new WebSocket(url)
  const timer = setTimeout(() => reject(new Error('timeout')), 15000)
  ws.onopen = () => {
    const ts = new Date().toUTCString().replace('GMT', 'GMT+0000 (Coordinated Universal Time)')
    const rid = uuid()
    ws.send(
      `X-Timestamp:${ts}\rContent-Type:application/json; charset=utf-8\rPath:speech.config\r\r` +
        '{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}',
    )
    ws.send(
      `X-RequestId:${rid}\rContent-Type:application/ssml+xml\rX-Timestamp:${ts}Z\rPath:ssml\r\r` +
        "<speak version='1.0' xml:lang='ru-RU'><voice name='ru-RU-DmitryNeural'>Привет учитель</voice></speak>",
    )
  }
  ws.onmessage = (ev) => {
    if (typeof ev.data === 'string') {
      if (ev.data.includes('turn.end')) {
        clearTimeout(timer)
        resolve(null)
      }
      return
    }
    const v = new Uint8Array(ev.data)
    const hl = (v[0] << 8) | v[1]
    const hdr = new TextDecoder().decode(v.subarray(2, hl + 2))
    if (hdr.includes('Path:audio')) parts.push(v.subarray(hl + 2))
  }
  ws.onerror = () => {
    clearTimeout(timer)
    reject(new Error('ws_error'))
  }
  ws.onclose = () => {
    if (parts.length) {
      clearTimeout(timer)
      resolve(null)
    }
  }
})

const total = parts.reduce((a, p) => a + p.length, 0)
console.log('OK audio bytes', total)
