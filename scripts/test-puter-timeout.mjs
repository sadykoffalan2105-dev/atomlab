import { chromium } from 'playwright'

const html = `<!doctype html><html><head><meta charset=utf-8></head><body><script src=https://js.puter.com/v2/></script></body></html>`

const run = async () => {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  await page.route('https://t.local/', (r) =>
    r.fulfill({ contentType: 'text/html', body: html }),
  )
  await page.goto('https://t.local/')
  await page.waitForFunction(() => !!window.puter?.ai?.txt2speech, null, { timeout: 15000 })

  const result = await page.evaluate(async () => {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 12000)
    try {
      const audio = await Promise.race([
        window.puter.ai.txt2speech('Привет, тест.', {
          voice: 'Maxim',
          engine: 'standard',
          language: 'ru-RU',
        }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 12000)),
      ])
      clearTimeout(t)
      const src = audio?.src
      if (!src) return { ok: false, reason: 'no src' }
      const res = await fetch(src)
      const buf = new Uint8Array(await res.arrayBuffer())
      return { ok: buf.length > 500, bytes: buf.length }
    } catch (e) {
      clearTimeout(t)
      return { ok: false, reason: String(e) }
    }
  })

  console.log('PUTER', JSON.stringify(result))
  await browser.close()
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
