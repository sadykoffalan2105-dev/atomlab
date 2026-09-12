import { chromium } from 'playwright'

const html = `<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>`

const run = async () => {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  page.on('console', (m) => console.log('[page]', m.text()))

  await page.route('https://atomlab-test.local/', (route) =>
    route.fulfill({ contentType: 'text/html', body: html }),
  )
  await page.goto('https://atomlab-test.local/')

  const result = await page.evaluate(async () => {
    const TRUSTED = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'
    const WIN_EPOCH = 11644473600
    const VER = '1-130.0.2849.68'
    const WSS =
      'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1'

    const sha256HexUpper = async (text) => {
      const data = new TextEncoder().encode(text)
      const buf = await crypto.subtle.digest('SHA-256', data)
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase()
    }
    let ticks = Date.now() / 1000 + WIN_EPOCH
    ticks -= ticks % 300
    ticks *= 1e7
    const sec = await sha256HexUpper(`${ticks.toFixed(0)}${TRUSTED}`)
    const id = crypto.randomUUID().replace(/-/g, '')
    const url = `${WSS}?TrustedClientToken=${TRUSTED}&Sec-MS-GEC=${sec}&Sec-MS-GEC-Version=${VER}&ConnectionId=${id}`

    return await new Promise((resolve) => {
      let done = false
      const finish = (v) => { if (!done) { done = true; resolve(v) } }
      let ws
      try { ws = new WebSocket(url) } catch (e) { finish({ ok: false, reason: 'ctor:' + e.message }); return }
      const t = setTimeout(() => { try { ws.close() } catch {} ; finish({ ok: false, reason: 'timeout' }) }, 15000)
      ws.onopen = () => { clearTimeout(t); try { ws.close() } catch {} ; finish({ ok: true }) }
      ws.onerror = () => { clearTimeout(t); finish({ ok: false, reason: 'error/403' }) }
    })
  })

  console.log('EDGE_WS_RESULT', JSON.stringify(result))
  await browser.close()
}

run().catch((e) => { console.error('FAILED', e); process.exit(1) })
