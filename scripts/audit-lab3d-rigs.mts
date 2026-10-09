/**
 * Аудит физики 3D-лаборатории (Playwright, по собранному сайту): для каждого опыта и каждого шага — в начале и в
 * конце шага (p = s) и в середине действия (p = s + 0.5) — window.__labRig.audit() в браузере:
 *  wall — шланг / трубка / палочка проходит сквозь стенку сосуда; table — ниже столешницы;
 *  float — предмет в покое висит в воздухе без опоры (только для p = s: в середине жеста предмет в руке).
 * Запуск: npx vite build --outDir .tmp/dist-x && npx vite preview --outDir .tmp/dist-x --port 4701 --strictPort
 *         npx tsx scripts/audit-lab3d-rigs.mts 4701 [id] [--shots]
 * --shots — кадры каждого шага с двух ракурсов в .smoke/lab3d-v6-rigs/ (для просмотра глазами).
 */
import fs from 'node:fs'
import { chromium } from 'playwright'

const args = process.argv.slice(2)
const port = args.find((a) => /^\d+$/.test(a)) ?? '4701'
const only = args.find((a) => /^[a-z]/.test(a) && !a.startsWith('--'))
const shots = args.includes('--shots')
const OUT = process.env.AUDIT_OUT ?? '.smoke/lab3d-v6-rigs'
const IDS = ['baso4', 'zn-hcl', 'ch4-burn', 'h2-practical', 'salt-purify', 'nh3', 'halogens', 'water-oxides', 'co2', 'metals-acids']
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface Issue {
  kind: string
  what: string
  detail: string
}
type RigApi = {
  total: number
  setP: (v: number | null) => void
  audit: () => Issue[]
  /** wall / table / float + orientation (userData.labOrientation: 'mouthUp' | 'mouthDown' в установках). */
  orient?: () => Issue[]
  selfTest: () => { wall: boolean; float: boolean } | null
  view: (pos: number[], target: number[]) => void
}

fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ args: ['--use-angle=d3d11'] })
let bad = 0
let orientChecked = 0
for (const id of IDS) {
  if (only && id !== only) continue
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  const errs: string[] = []
  page.on('pageerror', (e) => errs.push(e.message))
  await page.goto(`http://localhost:${port}/#/vr-lab?exp=${id}&debugLab=1`, { waitUntil: 'load', timeout: 60000 })
  await page.waitForFunction(() => !!(window as unknown as { __labRig?: unknown }).__labRig, null, { timeout: 60000 })
  await page.waitForFunction(() => !document.querySelector('[class*="loading"][role="status"]'), null, { timeout: 60000 })
  await sleep(1500)
  const total = await page.evaluate(() => (window as unknown as { __labRig: RigApi }).__labRig.total)
  const lines: string[] = []
  // сам детектор: временный шланг сквозь стенку и предмет в воздухе должны найтись
  const st = await page.evaluate(() => (window as unknown as { __labRig: RigApi }).__labRig.selfTest())
  if (!st?.wall || !st?.float) lines.push(`  детектор не сработал на подставной ошибке: ${JSON.stringify(st)}`)
  for (let s = 0; s <= total; s++) {
    for (const ps of s < total ? [s, s + 0.5] : [s]) {
      await page.evaluate((v) => (window as unknown as { __labRig: RigApi }).__labRig.setP(v), ps)
      await sleep(250)
      const found = await page.evaluate(() => (window as unknown as { __labRig: RigApi }).__labRig.audit())
      const keep = found.filter((f) => Number.isInteger(ps) || f.kind !== 'float')
      for (const f of keep) lines.push(`  p=${ps}: ${f.kind} — ${f.what}: ${f.detail}`)
      // ориентация: приёмник лёгкого газа — дном вверх, пробирка NH₄Cl + Ca(OH)₂ — отверстием чуть вниз
      const orient = await page.evaluate(() => (window as unknown as { __labRig: RigApi }).__labRig.orient?.() ?? [])
      for (const f of orient) lines.push(`  p=${ps}: ${f.kind} — ${f.what}: ${f.detail}`)
      orientChecked++
      if (shots && Number.isInteger(ps)) {
        for (const [k, pos] of [
          ['a', [0.05, 0.36, 0.62]],
          ['b', [-0.6, 0.3, 0.3]],
        ] as const) {
          await page.evaluate(([p0, t0]) => (window as unknown as { __labRig: RigApi }).__labRig.view(p0, t0), [pos as unknown as number[], [-0.05, 0.1, -0.04]])
          await sleep(1300)
          await page.screenshot({ path: `${OUT}/${id}-p${ps}-${k}.png` })
        }
      }
    }
  }
  bad += lines.length
  console.log(`${id}: ${lines.length ? `${lines.length} проблем` : '0 проблем ✓'}${errs.length ? `  ошибки страницы: ${errs.slice(0, 2).join(' | ')}` : ''}`)
  if (lines.length) console.log(lines.join('\n'))
  await page.close()
}
await browser.close()
console.log(`ориентация пробирок проверена в ${orientChecked} точках прогресса`)
console.log(bad ? `ИТОГО: ${bad} проблем` : 'ИТОГО: 0 проблем')
process.exit(bad ? 1 : 0)
