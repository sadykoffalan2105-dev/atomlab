// Число шейдерных программ после смены опытов в одной вкладке (цель ≤ ~50): node scripts/lab3d-perf-programs.mjs <port> [q]
import { chromium } from 'playwright'
const [port, q = 'high'] = process.argv.slice(2)
const b = await chromium.launch({ args: ['--use-angle=d3d11'] })
const p = await b.newPage({ viewport: { width: 1280, height: 800 } })
const errs = []
p.on('pageerror', (e) => errs.push(e.message))
await p.goto(`http://localhost:${port}/#/vr-lab?exp=baso4&debugPerf=1&debugLab=1&q=${q}`, { waitUntil: 'load' })
await p.waitForFunction(() => window.__labPerf && typeof window.__labTaskIds === 'function', null, { timeout: 60000 })
const tasks = await p.evaluate(() => window.__labTaskIds())
const ids = ['zn-hcl', 'co2', 'metals-acids', 'nh3', 'water-oxides', ...tasks]
const rows = []
for (const id of ids) {
  await p.evaluate((x) => {
    location.hash = `#/vr-lab?exp=${x}&debugPerf=1&debugLab=1&q=${new URLSearchParams(location.hash.split('?')[1]).get('q')}`
  }, id)
  await p.waitForTimeout(4500)
  const info = await p.evaluate(() => window.__labPerf.info())
  rows.push(`${id}: programs ${info.programs}, calls ${info.calls}, tris ${info.triangles}`)
}
console.log(rows.join('\n'))
console.log(errs.length ? `ошибки: ${errs.slice(0, 3).join(' | ')}` : 'без ошибок')
await b.close()
