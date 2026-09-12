import { chromium } from 'playwright'

const TEXT = 'Привет! Это проверка мужского голоса учителя по химии.'

const html = `<!doctype html><html><head><meta charset="utf-8"></head>
<body><script src="https://js.puter.com/v2/"></script></body></html>`

const run = async () => {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  page.on('console', (m) => console.log('[page]', m.type(), m.text()))

  // Реальное origin вместо about:blank — ближе к боевому сайту.
  await page.route('https://atomlab-test.local/', (route) =>
    route.fulfill({ contentType: 'text/html', body: html }),
  )
  await page.goto('https://atomlab-test.local/')

  await page.waitForFunction(() => !!window.puter?.ai?.txt2speech, null, { timeout: 30000 })

  const result = await page.evaluate(async (text) => {
    const tryOne = async (voice, engine, language) => {
      try {
        const audio = await window.puter.ai.txt2speech(text, { voice, engine, language })
        const src = audio?.src
        if (!src) return { voice, engine, ok: false, reason: 'no src' }
        const res = await fetch(src)
        const buf = new Uint8Array(await res.arrayBuffer())
        return {
          voice,
          engine,
          ok: buf.length > 200,
          bytes: buf.length,
          type: res.headers.get('content-type'),
        }
      } catch (e) {
        return { voice, engine, ok: false, reason: String(e && e.message ? e.message : e) }
      }
    }
    const ru = await tryOne('Maxim', 'standard', 'ru-RU')
    const en = await tryOne('Matthew', 'neural', 'en-US')
    return { ru, en }
  }, TEXT)

  console.log('RESULT', JSON.stringify(result, null, 2))
  await browser.close()
}

run().catch((e) => {
  console.error('FAILED', e)
  process.exit(1)
})
